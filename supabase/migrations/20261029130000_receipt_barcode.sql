-- Importacao de nota: o codigo de barras (EAN) de cada item do XML fica guardado e liga o produto,
-- para o leitor de codigo de barras e as proximas notas o reconhecerem sozinhos.
create or replace function public.import_receipt(p_store text, p_date date, p_access_key text, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_store uuid;
  v_purchase uuid;
  v_item jsonb;
  v_item_id uuid;
  v_product uuid;
  v_total numeric(10,2);
begin
  if p_access_key is not null and exists (select 1 from public.purchases where access_key = p_access_key) then
    raise exception 'nota ja importada';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'nota sem itens';
  end if;

  if p_store is not null and p_store <> '' then
    insert into public.stores (name) values (p_store) on conflict (user_id, name) do nothing;
    select id into v_store from public.stores where name = p_store limit 1;
  end if;

  select coalesce(sum((i->>'unit_price')::numeric * (i->>'quantity')::numeric), 0)
    into v_total from jsonb_array_elements(p_items) i;

  insert into public.purchases (store_id, total, purchased_at, access_key)
    values (v_store, round(v_total, 2), p_date, p_access_key)
    returning id into v_purchase;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product := nullif(v_item->>'product_id', '')::uuid;
    if v_product is null then
      insert into public.products (name, sector, unit)
        values (v_item->>'new_name', v_item->>'new_sector', coalesce(nullif(v_item->>'new_unit', ''), 'un'))
        on conflict do nothing
        returning id into v_product;
      if v_product is null then
        select id into v_product from public.products
          where lower(name) = lower(v_item->>'new_name') and user_id = (select auth.uid()) limit 1;
      end if;
    end if;

    insert into public.purchase_items (purchase_id, product_id, quantity, unit_price)
      values (v_purchase, v_product, (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric)
      returning id into v_item_id;

    insert into public.prices (product_id, store_id, price, paid_at, source, purchase_item_id)
      values (v_product, v_store, (v_item->>'unit_price')::numeric, p_date, 'receipt', v_item_id);

    if coalesce(v_item->>'alias', '') <> '' then
      insert into public.receipt_aliases (alias, product_id) values (v_item->>'alias', v_product)
        on conflict (user_id, alias) do update set product_id = excluded.product_id;
    end if;

    if coalesce(v_item->>'barcode', '') ~ '^[0-9]{8,14}$' and (v_item->>'barcode') !~ '^0+$' then
      insert into public.product_brands (product_id, barcode) values (v_product, v_item->>'barcode')
        on conflict (user_id, barcode) do nothing;
    end if;
  end loop;

  return v_purchase;
end;
$$;
