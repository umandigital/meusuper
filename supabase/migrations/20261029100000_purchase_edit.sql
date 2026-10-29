-- Editar/excluir compras finalizadas: cada preco gravado passa a apontar para o item da compra
-- que o gerou. Apagar a compra apaga seus precos; corrigir a compra corrige seus precos.
alter table public.prices
  add column if not exists purchase_item_id uuid references public.purchase_items on delete cascade;
create index if not exists prices_purchase_item_idx on public.prices (purchase_item_id);

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
  v_item jsonb;
  v_item_id uuid;
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

  for v_item in select value from jsonb_array_elements(p_items) loop
    insert into public.purchase_items (purchase_id, product_id, brand_id, quantity, unit_price)
      values (v_purchase, (v_item->>'product_id')::uuid, nullif(v_item->>'brand_id', '')::uuid,
              (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric)
      returning id into v_item_id;

    -- so o preco que voce informou vira historico; estimativas nao entram
    if coalesce((v_item->>'record_price')::boolean, false) then
      insert into public.prices (product_id, brand_id, store_id, price, paid_at, purchase_item_id)
        values ((v_item->>'product_id')::uuid, nullif(v_item->>'brand_id', '')::uuid, v_store,
                (v_item->>'unit_price')::numeric, v_today, v_item_id);
    end if;
  end loop;

  update public.lists set archived = true where id = p_list_id;
  return v_purchase;
end;
$$;

-- p_items: [{id, quantity, unit_price}]. Itens que nao vierem na lista sao removidos da compra.
create or replace function public.update_purchase(p_purchase_id uuid, p_date date, p_store text, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_store uuid;
  v_total numeric(10,2);
begin
  perform 1 from public.purchases where id = p_purchase_id;
  if not found then
    raise exception 'compra nao encontrada';
  end if;

  if p_store is not null and p_store <> '' then
    insert into public.stores (name) values (p_store) on conflict (user_id, name) do nothing;
    select id into v_store from public.stores where name = p_store limit 1;
  end if;

  delete from public.purchase_items
    where purchase_id = p_purchase_id
      and id not in (select (i->>'id')::uuid from jsonb_array_elements(p_items) i);

  update public.purchase_items pi
    set quantity = (i->>'quantity')::numeric, unit_price = (i->>'unit_price')::numeric
    from jsonb_array_elements(p_items) i
    where pi.id = (i->>'id')::uuid and pi.purchase_id = p_purchase_id;

  select coalesce(sum(quantity * unit_price), 0) into v_total
    from public.purchase_items where purchase_id = p_purchase_id;

  update public.purchases
    set purchased_at = p_date, store_id = v_store, total = round(v_total, 2)
    where id = p_purchase_id;

  update public.prices pr
    set price = pi.unit_price, paid_at = p_date, store_id = v_store
    from public.purchase_items pi
    where pr.purchase_item_id = pi.id and pi.purchase_id = p_purchase_id;
end;
$$;
