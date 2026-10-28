import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Bar from "../components/Bar";
import PeriodNav from "../components/PeriodNav";
import { usePeriod } from "../lib/usePeriod";
import { getMonthData, getPurchasesIn, getSupermarketBudget, saveSupermarketBudget } from "../services/month";
import { formatBRL } from "../lib/format";

const TILES = [
  { to: "/lists", icon: "📋", title: "Listas" },
  { to: "/products", icon: "📦", title: "Produtos" },
  { to: "/history", icon: "🕘", title: "Histórico" },
  { to: "/statistics", icon: "📊", title: "Estatísticas" },
];

const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

export default function Supermarket() {
  const qc = useQueryClient();
  const { period, offset, setOffset } = usePeriod();
  const { data: month } = useQuery({ queryKey: ["month", period?.start], queryFn: () => getMonthData(period!), enabled: !!period });
  const { data: budgetRow } = useQuery({ queryKey: ["sm-budget", period?.monthKey], queryFn: () => getSupermarketBudget(period!), enabled: !!period });
  const { data: purchases = [] } = useQuery({ queryKey: ["purchases-in", period?.start], queryFn: () => getPurchasesIn(period!), enabled: !!period });

  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => { setText(budgetRow ? String(budgetRow.amount).replace(".", ",") : ""); }, [budgetRow]);

  const save = useMutation({
    mutationFn: () => saveSupermarketBudget(period!, Number(text.replace(",", "."))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sm-budget"] });
      qc.invalidateQueries({ queryKey: ["month"] });
      setEditing(false);
    },
  });

  const spent = month?.supermarket ?? 0;
  const budget = budgetRow?.amount ?? 0;
  const valid = text.trim() !== "" && Number(text.replace(",", ".")) >= 0;

  return (
    <main>
      <h1>🛒 Supermercado</h1>
      {period && <PeriodNav period={period} onShift={(d) => setOffset(offset + d)} />}

      <ul className="tiles">
        {TILES.map((t) => (
          <li key={t.to}><Link to={t.to}><span>{t.icon}</span>{t.title}</Link></li>
        ))}
      </ul>

      <section className="panel">
        <div className="muted small">Total Supermercado no Mês</div>
        <div className="total">{formatBRL(spent)}</div>
        {(budget > 0 || editing) && <Bar value={spent} max={budget} />}
        {budget > 0 && (
          <div className={`small ${spent > budget ? "error" : "muted"}`}>
            {spent > budget ? `Orçamento excedido em ${formatBRL(spent - budget)}` : `Orçamento: ${formatBRL(budget)} · restam ${formatBRL(budget - spent)}`}
          </div>
        )}
        {editing ? (
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
            <input inputMode="decimal" placeholder="Orçamento do mês (R$)" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <button type="submit" disabled={!valid || save.isPending}>Salvar</button>
          </form>
        ) : (
          <button type="button" className="link" onClick={() => setEditing(true)}>🎯 {budget > 0 ? "Alterar orçamento mensal" : "Definir orçamento mensal"}</button>
        )}
      </section>

      <Link to="/lists" className="big-btn">＋ Nova compra (lista)</Link>

      <h2 className="sector">COMPRAS DO MÊS ({purchases.length})</h2>
      {!purchases.length && <p className="muted">Nenhuma compra registrada. Finalize uma lista para ela aparecer aqui.</p>}
      <ul className="plain">
        {purchases.map((p) => (
          <li key={p.id}>
            <span className="grow"><strong>{fmtDate(p.purchased_at)}</strong><small> · {p.store?.name ?? "Sem mercado"}</small></span>
            <strong>{formatBRL(Number(p.total))}</strong>
          </li>
        ))}
      </ul>
    </main>
  );
}
