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
create policy "sectors readable" on public.sectors for select using (true);

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
  reference_price numeric(10,2),          -- estimativa do catalogo (marcada como "estimado")
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
  price numeric(10,2) not null,
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
  quantity numeric(10,3) not null default 1,
  checked boolean not null default false,
  paid_price numeric(10,2)               -- preco real informado no mercado
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  store_id uuid references public.stores on delete set null,
  list_id uuid references public.lists on delete set null,
  total numeric(10,2) not null,
  purchased_at date not null default current_date,
  notes text
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  purchase_id uuid not null references public.purchases on delete cascade,
  product_id uuid references public.products on delete set null,
  brand_id uuid references public.brands on delete set null,
  quantity numeric(10,3) not null default 1,
  unit_price numeric(10,2) not null
);

create table public.general_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  description text not null,
  amount numeric(10,2) not null,
  spent_at date not null default current_date,
  card text,
  installments int not null default 1,
  fixed boolean not null default false
);

create table public.monthly_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  month date not null,
  kind text not null check (kind in ('income','fixed_expense','credit_card','general_budget','supermarket_budget')),
  description text,
  amount numeric(10,2) not null,
  installments int not null default 1
);

create table public.sector_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  month date not null,
  sector text not null references public.sectors,
  amount numeric(10,2) not null,
  unique (user_id, month, sector)
);

-- RLS: tabelas 100% do usuario
do $$
declare t text;
begin
  foreach t in array array['settings','product_brands','stores','prices','lists','list_items','purchases','purchase_items','general_expenses','monthly_plan','sector_budgets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Catalogo base (user_id nulo) e leitura para todos; escrita so nas proprias linhas.
alter table public.products enable row level security;
create policy "read catalog and own" on public.products for select using (user_id is null or user_id = auth.uid());
create policy "write own" on public.products for insert with check (user_id = auth.uid());
create policy "update own" on public.products for update using (user_id = auth.uid());
create policy "delete own" on public.products for delete using (user_id = auth.uid());

alter table public.brands enable row level security;
create policy "read catalog and own" on public.brands for select using (user_id is null or user_id = auth.uid());
create policy "write own" on public.brands for insert with check (user_id = auth.uid());
create policy "update own" on public.brands for update using (user_id = auth.uid());
create policy "delete own" on public.brands for delete using (user_id = auth.uid());
