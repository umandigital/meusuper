-- Produtos que se pede por UNIDADE mas o catalogo tratava por quilo (pao frances, banana, tomate...).
-- Passam a ser "un" (a lista e a estimativa contam unidades) e guardam o peso medio de 1 unidade, usado so para
-- converter notas fiscais que vem em KG (0,66 kg de pao -> 13 paes, com o total da nota preservado).
alter table public.products
  add column if not exists unit_weight_g numeric(8,2) check (unit_weight_g > 0);

do $$
declare
  r record;
begin
  for r in select * from (values
      ('Pão francês', 50),
      ('Pão francês integral', 50),
      ('Pão caseiro', 500),
      ('Pão sovado', 400),
      ('Pão de queijo', 35),
      ('Abacate', 400),
      ('Abobrinha', 250),
      ('Alho', 50),
      ('Ameixa', 70),
      ('Banana', 120),
      ('Batata', 150),
      ('Batata-doce', 250),
      ('Bergamota', 150),
      ('Berinjela', 300),
      ('Beterraba', 150),
      ('Caqui', 200),
      ('Cebola', 150),
      ('Cebola roxa', 150),
      ('Cenoura', 120),
      ('Chuchu', 250),
      ('Goiaba', 150),
      ('Kiwi', 80),
      ('Laranja', 200),
      ('Limão', 100),
      ('Maçã', 180),
      ('Mamão', 1000),
      ('Manga', 350),
      ('Maracujá', 150),
      ('Melancia', 6000),
      ('Melão', 1500),
      ('Pepino', 200),
      ('Pera', 170),
      ('Pêssego', 130),
      ('Pimentão', 150),
      ('Repolho', 1500),
      ('Repolho roxo', 1500),
      ('Tomate', 150),
      ('Frango inteiro', 1800)
    ) as t(name, g)
  loop
    -- 1) linhas que dependem do produto: kg -> unidades (so enquanto o produto ainda esta em kg, entao roda uma vez so)
    update public.list_items li
      set quantity = greatest(1, round(li.quantity * 1000 / r.g))
      from public.products p
      where li.product_id = p.id and p.name = r.name and p.user_id is null and p.unit = 'kg';

    -- o valor gasto na linha e preservado: novo preco unitario = (kg x preco/kg) / unidades
    update public.purchase_items pi
      set unit_price = round((pi.quantity * pi.unit_price) / greatest(1, round(pi.quantity * 1000 / r.g)), 2),
          quantity = greatest(1, round(pi.quantity * 1000 / r.g))
      from public.products p
      where pi.product_id = p.id and p.name = r.name and p.user_id is null and p.unit = 'kg';

    update public.prices pr
      set price = round(pr.price * r.g / 1000, 2)
      from public.products p
      where pr.product_id = p.id and p.name = r.name and p.user_id is null and p.unit = 'kg';

    -- 2) o proprio produto: preco de referencia por unidade
    update public.products p
      set unit = 'un', unit_weight_g = r.g, reference_price = round(p.reference_price * r.g / 1000, 2)
      where p.name = r.name and p.user_id is null and p.unit = 'kg';
  end loop;
end $$;
