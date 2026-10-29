import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Bar from "../components/Bar";
import { usePeriod } from "../lib/usePeriod";
import { expectedBalance, getMonthData } from "../services/month";
import { formatBRL } from "../lib/format";
import Icon, { type IconName } from "../components/Icon";

const MODULES: { to: string; icon: IconName; title: string; sub: string }[] = [
  { to: "/planning", icon: "target", title: "Planejamento Mensal", sub: "Previsto vs Realizado" },
  { to: "/supermarket", icon: "cart", title: "Supermercado", sub: "Compras, listas e produtos" },
  { to: "/expenses", icon: "wallet", title: "Despesas Gerais", sub: "Contas, transporte, lazer..." },
  { to: "/statistics", icon: "chart", title: "Estatísticas", sub: "Análises e relatórios" },
  { to: "/settings", icon: "sliders", title: "Ajustes", sub: "Período financeiro e preferências" },
  { to: "/tutorial", icon: "help", title: "Como usar o app", sub: "Tutorial e explicações" },
];

export default function Dashboard() {
  const { period } = usePeriod();
  const { data } = useQuery({ queryKey: ["month", period?.start], queryFn: () => getMonthData(period!), enabled: !!period });
  const balance = data ? expectedBalance(data.plan) : 0;
  const budget = data?.plan.supermarket_budget ?? 0;

  return (
    <main>
      <p className="muted small">{period?.label ?? "…"}</p>
      <h1>Painel Financeiro</h1>

      <div className="two">
        <div className="stat"><span className="muted small">Despesas Gerais</span><strong>{formatBRL(data?.general ?? 0)}</strong></div>
        <div className="stat"><span className="muted small">Supermercado</span><strong>{formatBRL(data?.supermarket ?? 0)}</strong></div>
      </div>

      <section className="panel">
        <h2>Saldo previsto x Despesas Gerais</h2>
        <Bar value={data?.general ?? 0} max={balance} label="Despesas gerais em relação ao saldo previsto" />
        <div className="split small muted"><span>Saldo previsto: {formatBRL(balance)}</span><span>Despesas Gerais: {formatBRL(data?.general ?? 0)}</span></div>
        <hr />
        <h2>Supermercado – Orçamento x Gasto</h2>
        <Bar value={data?.supermarket ?? 0} max={budget} label="Gasto no supermercado em relação ao orçamento" />
        <div className="split small muted"><span>Orçamento: {formatBRL(budget)}</span><span>Gasto até agora: {formatBRL(data?.supermarket ?? 0)}</span></div>
      </section>

      <h2 className="sector">AÇÕES RÁPIDAS</h2>
      <ul className="cards">
        <li>
          <Link to="/expenses">
            <span className="icon big"><Icon name="plus" /></span>
            <span className="grow"><strong>Adicionar Despesa</strong><small>Supermercado ou despesa geral</small></span>
          </Link>
        </li>
      </ul>

      <h2 className="sector">MÓDULOS</h2>
      <ul className="cards">
        {MODULES.map((m) => (
          <li key={m.to}>
            <Link to={m.to}>
              <span className="icon"><Icon name={m.icon} /></span>
              <span className="grow"><strong>{m.title}</strong><small>{m.sub}</small></span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
