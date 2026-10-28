-- Cada lista de compras e feita em um mercado: Nicolini ou Peruzzo.
alter table public.lists
  add column if not exists store text check (store in ('Nicolini', 'Peruzzo'));
