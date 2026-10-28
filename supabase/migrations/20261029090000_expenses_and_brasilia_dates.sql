-- 1) Categoria nas despesas gerais.
alter table public.general_expenses add column if not exists category text;

-- 2) Datas no horario de Brasilia (o banco roda em UTC: depois das 21h a data viraria "amanha"
--    e poderia cair no mes fiscal errado).
alter table public.purchases alter column purchased_at set default ((now() at time zone 'America/Sao_Paulo')::date);
alter table public.prices alter column paid_at set default ((now() at time zone 'America/Sao_Paulo')::date);
alter table public.general_expenses alter column spent_at set default ((now() at time zone 'America/Sao_Paulo')::date);

create or replace function public.finish_purchase(p_list_id uuid, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_store_name text;
  v_store uuid;
  v_purchase uuid;
  v_total numeric(10,2);
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select store into v_store_name from public.lists where id = p_list_id and not archived;
  if not found then
    raise exception 'lista nao encontrada ou ja finalizada';
  end if;

  if v_store_name is not null then
    insert into public.stores (name) values (v_store_name) on conflict (user_id, name) do nothing;
    select id into v_store from public.stores where name = v_store_name limit 1;
  end if;

  select coalesce(sum((i->>'unit_price')::numeric * (i->>'quantity')::numeric), 0)
    into v_total
    from jsonb_array_elements(p_items) i;

  insert into public.purchases (store_id, list_id, total, purchased_at)
    values (v_store, p_list_id, round(v_total, 2), v_today)
    returning id into v_purchase;

  insert into public.purchase_items (purchase_id, product_id, brand_id, quantity, unit_price)
    select v_purchase, (i->>'product_id')::uuid, nullif(i->>'brand_id', '')::uuid,
           (i->>'quantity')::numeric, (i->>'unit_price')::numeric
    from jsonb_array_elements(p_items) i;

  insert into public.prices (product_id, brand_id, store_id, price, paid_at)
    select (i->>'product_id')::uuid, nullif(i->>'brand_id', '')::uuid, v_store, (i->>'unit_price')::numeric, v_today
    from jsonb_array_elements(p_items) i
    where coalesce((i->>'record_price')::boolean, false);

  update public.lists set archived = true where id = p_list_id;
  return v_purchase;
end;
$$;
