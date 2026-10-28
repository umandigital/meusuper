# MeuSuper

Webapp PWA (mobile-first) com Supabase. Réplica do app em https://meusuper.lovable.app/.

Stack: Vite + React + TypeScript + React Router + TanStack Query + Supabase + vite-plugin-pwa.

```
public/            favicon e ícones do PWA (icons/icon-192.png, icon-512.png)
src/components/    componentes (ui/ = base reutilizável)
src/pages/         telas
src/hooks/         hooks
src/services/      acesso a dados (Supabase)
src/lib/           cliente Supabase e utilitários
src/types/         tipos
supabase/migrations/  SQL do banco
docs/              documentação
```

## Rodar

```bash
cp .env.example .env   # preencher URL e anon key do Supabase
npm install
npm run dev
```
