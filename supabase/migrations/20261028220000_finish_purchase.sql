-- Fechar compra de forma atomica: grava a compra, os itens, atualiza o historico de precos
-- e arquiva a lista. security invoker: a RLS de cada tabela continua valendo.
create unique index if not exists stores_user_name_key on public.stores (user_id, name);

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

  insert into public.purchases (store_id, list_id, total)
    values (v_store, p_list_id, round(v_total, 2))
    returning id into v_purchase;

  insert into public.purchase_items (purchase_id, product_id, brand_id, quantity, unit_price)
    select v_purchase, (i->>'product_id')::uuid, nullif(i->>'brand_id', '')::uuid,
           (i->>'quantity')::numeric, (i->>'unit_price')::numeric
    from jsonb_array_elements(p_items) i;

  -- so o preco que voce informou vira historico; estimativas nao entram
  insert into public.prices (product_id, brand_id, store_id, price)
    select (i->>'product_id')::uuid, nullif(i->>'brand_id', '')::uuid, v_store, (i->>'unit_price')::numeric
    from jsonb_array_elements(p_items) i
    where coalesce((i->>'record_price')::boolean, false);

  update public.lists set archived = true where id = p_list_id;
  return v_purchase;
end;
$$;
