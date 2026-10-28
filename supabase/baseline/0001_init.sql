-- MeuSuper: esquema inicial. Uso pessoal; cada linha pertence a um usuario (RLS).
-- products/brands com user_id nulo formam o catalogo base (leitura para todos).

create table public.sectors (
  value text primary key,
  label text not null,
  emoji text not null,
  position int not null
);

insert into public.sectors (value, label, emoji, position) values
  ('hortifruti','Hortifruti','🥬',1),
  ('acougue','Açougue / Carnes','🥩',2),
  ('frios','Frios / Laticínios','🧀',3),
  ('padaria','Padaria','🍞',4),
  ('mercearia','Mercearia / Secos','🫘',5),
  ('doces','Doces e Chocolates','🍫',6),
  ('bebidas','Bebidas','🥤',7),
  ('congelados','Congelados','🧊',8),
  ('limpeza','Limpeza','🧹',9),
  ('higiene','Higiene Pessoal','🧴',10),
  ('utilidades','Utilidades Domésticas','🏠',11),
  ('pet','Pet / Animais','🐾',12),
  ('outros','Bazar / Outros','📦',13);

alter table public.sectors enable row level security;
create policy "sectors readable" on public.sectors for select to authenticated using (true);

create table public.settings (
  user_id uuid primary key references auth.users on delete cascade default auth.uid(),
  period_start_day int not null default 10 check (period_start_day between 1 and 28),
  updated_at timestamptz not null default now()
);

-- Produto = o que se quer comprar ("Arroz 5kg"). Marca e opcional e fica em product_brands.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade default auth.uid(),
  name text not null,
  sector text not null references public.sectors,
  unit text not null default 'un' check (unit in ('un','kg','l','pct')),
  reference_price numeric(10,2) check (reference_price >= 0),          -- estimativa do catalogo (marcada como "estimado")
  created_at timestamptz not null default now()
);
create unique index products_name_owner on public.products (lower(name), coalesce(user_id, '00000000-0000-0000-0000-000000000000'));

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade default auth.uid(),
  name text not null
);
create unique index brands_name_owner on public.brands (lower(name), coalesce(user_id, '00000000-0000-0000-0000-000000000000'));

-- Combinacao produto + marca, com o codigo de barras (EAN).
create table public.product_brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  product_id uuid not null references public.products on delete cascade,
  brand_id uuid references public.brands on delete set null,
  barcode text,
  size_label text,
  unique (user_id, barcode)
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null
);

-- Historico de precos: o ultimo preco pago por produto/marca/mercado alimenta a estimativa.
create table public.prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  product_id uuid not null references public.products on delete cascade,
  brand_id uuid references public.brands on delete set null,
  store_id uuid references public.stores on delete set null,
  price numeric(10,2) not null check (price >= 0),
  paid_at date not null default current_date,
  source text not null default 'manual' check (source in ('manual','scan','receipt'))
);
create index prices_lookup on public.prices (user_id, product_id, paid_at desc);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  list_id uuid not null references public.lists on delete cascade,
  product_id uuid not null references public.products on delete cascade,
  brand_id uuid references public.brands on delete set null,
  quantity numeric(10,3) not null default 1 check (quantity > 0),
  checked boolean not null default false,
  paid_price numeric(10,2)               -- preco real informado no mercado
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  store_id uuid references public.stores on delete set null,
  list_id uuid references public.lists on delete set null,
  total numeric(10,2) not null check (total >= 0),
  purchased_at date not null default current_date,
  notes text
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  purchase_id uuid not null references public.purchases on delete cascade,
  product_id uuid references public.products on delete set null,
  brand_id uuid references public.brands on delete set null,
  quantity numeric(10,3) not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0)
);

create table public.general_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  description text not null,
  amount numeric(10,2) not null,
  spent_at date not null default current_date,
  card text,
  installments int not null default 1 check (installments >= 1),
  fixed boolean not null default false
);

create table public.monthly_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  month date not null,
  kind text not null check (kind in ('income','fixed_expense','credit_card','general_budget','supermarket_budget')),
  description text,
  amount numeric(10,2) not null,
  installments int not null default 1 check (installments >= 1)
);

create table public.sector_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  month date not null,
  sector text not null references public.sectors,
  amount numeric(10,2) not null,
  unique (user_id, month, sector)
);

-- Indices: Postgres nao indexa FK sozinho, e as policies filtram por user_id.
create index products_sector_idx on public.products (sector);
create index product_brands_user_idx on public.product_brands (user_id);
create index product_brands_product_idx on public.product_brands (product_id);
create index product_brands_brand_idx on public.product_brands (brand_id);
create index stores_user_idx on public.stores (user_id);
create index prices_product_idx on public.prices (product_id);
create index prices_brand_idx on public.prices (brand_id);
create index prices_store_idx on public.prices (store_id);
create index lists_user_idx on public.lists (user_id, created_at desc);
create index list_items_user_idx on public.list_items (user_id);
create index list_items_list_idx on public.list_items (list_id);
create index list_items_product_idx on public.list_items (product_id);
create index list_items_brand_idx on public.list_items (brand_id);
create index purchases_user_date_idx on public.purchases (user_id, purchased_at desc);
create index purchases_store_idx on public.purchases (store_id);
create index purchases_list_idx on public.purchases (list_id);
create index purchase_items_user_idx on public.purchase_items (user_id);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index purchase_items_product_idx on public.purchase_items (product_id);
create index purchase_items_brand_idx on public.purchase_items (brand_id);
create index general_expenses_user_date_idx on public.general_expenses (user_id, spent_at desc);
create index monthly_plan_user_month_idx on public.monthly_plan (user_id, month);

-- RLS: tabelas 100% do usuario. (select auth.uid()) avalia uma vez por consulta, nao por linha.
do $$
declare t text;
begin
  foreach t in array array['settings','product_brands','stores','prices','lists','list_items','purchases','purchase_items','general_expenses','monthly_plan','sector_budgets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Catalogo base (user_id nulo): leitura para logados; escrita so nas proprias linhas.
do $$
declare t text;
begin
  foreach t in array array['products','brands'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read catalog and own" on public.%I for select to authenticated using (user_id is null or user_id = (select auth.uid()))', t);
    execute format('create policy "insert own" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "update own" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "delete own" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Busca sem acento ("acucar" acha "Açúcar"). security invoker: a RLS de products continua valendo.
create extension if not exists unaccent with schema extensions;

create or replace function public.search_products(q text)
returns setof public.products
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.products p
  where extensions.unaccent(p.name) ilike '%' || extensions.unaccent(q) || '%'
  order by
    (p.user_id is null),                                                        -- meus produtos primeiro
    not (extensions.unaccent(lower(p.name)) like extensions.unaccent(lower(q)) || '%'),  -- comeca com o termo
    p.name
  limit 12;
$$;
