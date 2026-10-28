# App original (meusuper.lovable.app)

"Minhas Finanças / Meu Mercado": controle de gastos pessoais + supermercado. PWA, tema verde (#10b981), claro/escuro, fontes Inter e Plus Jakarta Sans. O original NÃO usa Supabase: guarda tudo em localStorage (`meumercado_*`).

Rotas: `/` painel, `/expenses`, `/history`, `/lists`, `/lists/:id`, `/planning`, `/products`, `/settings`, `/statistics`, `/supermarket`, `/tutorial`.

Funcionalidades vistas no texto do app: registrar compra de supermercado e despesas gerais (com cartão, parcelas, despesas fixas), listas de compras (itens marcados, arquivamento ao concluir), cadastro de produtos (por unidade ou peso, por setor), planejamento mensal (receitas previstas, despesas fixas, orçamento; copiar mês anterior), período financeiro configurável (dia 1–28), estatísticas (gasto por setor/produto, ticket médio, previsto x realizado, comparação 6 meses), tutorial.

Setores: ver `src/lib/sectors.ts`.
