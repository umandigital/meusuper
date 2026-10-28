# Banco de dados (Supabase)

- `baseline/0001_init.sql`: esquema inicial. Já aplicado no projeto à mão (SQL Editor); fica aqui só como referência e para recriar o banco do zero.
- `seed.sql`: catálogo base de produtos. Já carregado; só rodar de novo num banco novo.
- `migrations/`: mudanças novas, no formato `AAAAMMDDHHMMSS_nome.sql`. A integração GitHub do Supabase aplica cada arquivo novo quando ele chega na branch `main`. Escreva-as de forma idempotente (`if not exists`).
