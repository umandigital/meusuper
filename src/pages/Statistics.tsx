import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Bar from "../components/Bar";
import MonthBars from "../components/MonthBars";
import PeriodNav from "../components/PeriodNav";
import { usePeriod } from "../lib/usePeriod";
import { periodFor } from "../lib/period";
import { average, bySector, change, topProducts } from "../lib/stats";
import { SECTORS } from "../lib/sectors";
import { formatBRL } from "../lib/format";
import { getCommitted, getSeries, getSoldItems } from "../services/stats";

const MONTHS_SHOWN = 6;
const monthName = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

export default function Statistics() {
  const { period, offset, setOffset, startDay } = usePeriod();
  const [sector, setSector] = useState("");

  const periods = startDay ? Array.from({ length: MONTHS_SHOWN }, (_, i) => periodFor(new Date(), startDay, offset - (MONTHS_SHOWN - 1) + i)) : [];
  const { data: items = [] } = useQuery({ queryKey: ["sold", period?.start], queryFn: () => getSoldItems(period!), enabled: !!period });
  const { data: series = [] } = useQuery({ queryKey: ["series", periods[0]?.start, periods[MONTHS_SHOWN - 1]?.start], queryFn: () => getSeries(periods), enabled: periods.length > 0 });
  const { data: committed = [] } = useQuery({ queryKey: ["committed", period?.monthKey], queryFn: () => getCommitted(period!.monthKey), enabled: !!period });

  const current = series[MONTHS_SHOWN - 1];
  const previous = series[MONTHS_SHOWN - 2];
  const total = current?.supermarket ?? 0;
  const count = current?.purchases ?? 0;
  const sectors = bySector(items);
  const sectorsTotal = sectors.reduce((s, x) => s + x.total, 0);
  const products = topProducts(items, sector);

  const expenses = (p?: { supermarket: number; general: number }) => (p ? p.supermarket + p.general : 0);
  const dExpenses = change(expenses(current), expenses(previous));
  const dIncome = change(current?.income ?? 0, previous?.income ?? 0);

  return (
    <main>
      <h1>Estatísticas Financeiras</h1>
      {period && <PeriodNav period={period} onShift={(d) => setOffset(offset + d)} />}

      <div className="two three">
        <div className="stat"><span className="muted small">Total Gasto</span><strong>{formatBRL(total)}</strong></div>
        <div className="stat"><span className="muted small">Compras</span><strong>{count}</strong></div>
        <div className="stat"><span className="muted small">Ticket Médio</span><strong>{formatBRL(average(total, count))}</strong></div>
      </div>

      <section className="panel">
        <h2>Gasto por Setor</h2>
        {!sectors.length && <p className="muted small">Sem dados neste período.</p>}
        {sectors.map((s) => (
          <div key={s.sector.value} className="compare">
            <div className="split"><span>{s.sector.emoji} {s.sector.label}</span><strong>{formatBRL(s.total)} <small className="muted">({Math.round((s.total / sectorsTotal) * 100)}%)</small></strong></div>
            <Bar value={s.total} max={sectorsTotal} />
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="split"><h2>Gasto por Produto</h2>
          <select className="mini" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Filtrar por setor">
            <option value="">Todos os setores</option>
            {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
          </select>
        </div>
        {!products.length && <p className="muted small">Sem dados neste período.</p>}
        <ul className="plain">
          {products.map((p, i) => (
            <li key={p.name}><span className="muted">{i + 1}.</span><span className="grow">{p.name} <small>· {Number(p.qty.toFixed(2))} un/kg</small></span><strong>{formatBRL(p.total)}</strong></li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Comparação Mensal — Últimos {MONTHS_SHOWN} meses</h2>
        {series.length > 0 && <MonthBars points={series.map((p) => ({ label: p.label, a: p.supermarket, b: p.general }))} aName="Supermercado" bName="Despesas gerais" />}
      </section>

      <section className="panel">
        <h2>Em relação ao mês anterior</h2>
        <Delta label="Despesas vs mês anterior" value={dExpenses} goodWhenDown />
        <Delta label="Receita vs mês anterior" value={dIncome} />
        <p className="muted small">Despesas = supermercado + despesas gerais. Receita = receita prevista no Planejamento.</p>
      </section>

      <section className="panel">
        <h2>Valores comprometidos</h2>
        <p className="muted small">Parcelas já lançadas para os meses seguintes (cartões e itens parcelados no Planejamento).</p>
        {!committed.length && <p className="muted small">Nada comprometido nos próximos meses.</p>}
        <ul className="plain">
          {committed.map((c) => <li key={c.month}><span className="grow">{monthName(c.month)}</span><strong>{formatBRL(c.total)}</strong></li>)}
        </ul>
      </section>
    </main>
  );
}

function Delta({ label, value, goodWhenDown }: { label: string; value: number | null; goodWhenDown?: boolean }) {
  if (value === null) return <div className="split"><span className="muted">{label}</span><span className="muted">sem base de comparação</span></div>;
  const up = value > 0;
  const good = goodWhenDown ? !up : up;
  const cls = Math.abs(value) < 0.05 ? "muted" : good ? "ok" : "error";
  return (
    <div className="split">
      <span className="muted">{label}</span>
      <strong className={cls}>{up ? "▲" : value < 0 ? "▼" : "•"} {Math.abs(value).toFixed(1).replace(".", ",")}%</strong>
    </div>
  );
}
