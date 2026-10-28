-- Modelo inferido do app original (que guarda tudo em localStorage:
-- meumercado_products, _lists, _purchases, _general_expenses, _monthly_plan, _budgets, _settings).
-- Rascunho: revisar campos contra o app antes de aplicar.

create table public.settings (
  user_id uuid primary key references auth.users on delete cascade,
  period_start_day int not null default 1 check (period_start_day between 1 and 28),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  sector text not null,
  is_weight boolean not null default false,
  price numeric(10,2),            -- por unidade, ou por kg se is_weight
  created_at timestamptz not null default now()
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  name text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists on delete cascade,
  product_id uuid references public.products on delete set null,
  name text not null,
  sector text,
  quantity numeric(10,3) not null default 1,
  price numeric(10,2),
  checked boolean not null default false
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  store text,
  total numeric(10,2) not null,
  purchased_at date not null default current_date,
  list_id uuid references public.lists on delete set null,
  notes text
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
  month date not null,            -- primeiro dia do período
  kind text not null check (kind in ('income','fixed_expense','general_budget','supermarket_budget')),
  description text,
  amount numeric(10,2) not null
);

create table public.sector_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  month date not null,
  sector text not null,
  amount numeric(10,2) not null,
  unique (user_id, month, sector)
);

do $$
declare t text;
begin
  foreach t in array array['products','lists','purchases','general_expenses','monthly_plan','sector_budgets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table public.settings enable row level security;
create policy "own settings" on public.settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.list_items enable row level security;
create policy "own list items" on public.list_items for all
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));
