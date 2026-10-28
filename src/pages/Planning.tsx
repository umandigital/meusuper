import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Bar from "../components/Bar";
import PeriodNav from "../components/PeriodNav";
import { usePeriod } from "../lib/usePeriod";
import { periodFor } from "../lib/period";
import { addPlanItem, copyPreviousMonth, deletePlanItem, getPlan, type PlanItem } from "../services/plan";
import { expectedBalance, getMonthData, type PlanKind } from "../services/month";
import { formatBRL } from "../lib/format";

const SECTIONS: { kind: PlanKind; title: string; placeholder: string; installments: boolean }[] = [
  { kind: "income", title: "Receitas previstas", placeholder: "Ex: Salário, Freelance...", installments: false },
  { kind: "fixed_expense", title: "Despesas fixas", placeholder: "Ex: Aluguel, Internet...", installments: true },
  { kind: "credit_card", title: "Cartões de crédito", placeholder: "Ex: Nubank, Itaú...", installments: true },
  { kind: "general_budget", title: "Despesas gerais (extras)", placeholder: "Ex: Reserva para extras...", installments: true },
];

export default function Planning() {
  const qc = useQueryClient();
  const { period, offset, setOffset, startDay } = usePeriod();
  const { data: plan = [] } = useQuery({ queryKey: ["plan", period?.monthKey], queryFn: () => getPlan(period!.monthKey), enabled: !!period });
  const { data: month } = useQuery({ queryKey: ["month", period?.start], queryFn: () => getMonthData(period!), enabled: !!period });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["plan"] });
    qc.invalidateQueries({ queryKey: ["month"] });
  };
  const remove = useMutation({ mutationFn: deletePlanItem, onSuccess: refresh });
  const copy = useMutation({ mutationFn: () => copyPreviousMonth(period!.monthKey), onSuccess: refresh });

  const sum = (kind: PlanKind) => plan.filter((p) => p.kind === kind).reduce((s, p) => s + p.amount, 0);
  const income = sum("income");
  const fixed = sum("fixed_expense");
  const cards = sum("credit_card");
  const extras = sum("general_budget");
  const totalExpenses = fixed + cards + extras;
  const balance = income - totalExpenses;

  const prevLabel = period && startDay ? periodFor(new Date(), startDay, offset - 1).label : "";
  const hasEntries = plan.some((p) => p.kind !== "supermarket_budget" && p.installments === 1);

  async function onCopy() {
    const msg = hasEntries
      ? `Este mês já tem lançamentos. Copiar ${prevLabel} vai substituir os itens não parcelados de ${period!.label}. Deseja continuar?`
      : `Copiar o planejamento de ${prevLabel}? Isso traz receitas, despesas fixas, cartões e despesas gerais.`;
    if (!confirm(msg)) return;
    const n = await copy.mutateAsync();
    if (n === 0) alert(`${prevLabel} não tem itens para copiar.`);
  }

  const real = month;
  const realBalance = real ? income - (fixed + cards + real.general + real.supermarket) : 0;

  return (
    <main>
      <div className="head-row">
        <h1>Planejamento Mensal</h1>
        <button type="button" className="ghost-btn" onClick={onCopy} disabled={copy.isPending || !period}>Copiar mês anterior</button>
      </div>
      {period && <PeriodNav period={period} onShift={(d) => setOffset(offset + d)} />}
      {copy.isError && <p className="error">Não foi possível copiar o planejamento.</p>}

      {period && SECTIONS.map((s) => (
        <Section key={s.kind} {...s} monthKey={period.monthKey} items={plan.filter((p) => p.kind === s.kind)} onChanged={refresh} onRemove={(id) => remove.mutate(id)} />
      ))}

      <section className="panel">
        <h2>Resumo do planejamento</h2>
        <Line label="Receita prevista" value={income} good />
        <Line label="Despesas fixas" value={-fixed} />
        <Line label="Cartões de crédito" value={-cards} />
        <Line label="Despesas gerais" value={-extras} />
        <hr />
        <Line label="Total despesas previstas" value={totalExpenses} strong />
        <Line label="Saldo previsto" value={balance} strong good={balance >= 0} bad={balance < 0} />
      </section>

      <section className="panel">
        <h2>Previsto x Realizado</h2>
        <Compare label="Despesas gerais (extras)" planned={extras} real={real?.general ?? 0} />
        <Compare label="Supermercado" planned={real?.plan.supermarket_budget ?? 0} real={real?.supermarket ?? 0} />
        <hr />
        <Line label="Saldo previsto" value={balance} />
        <Line label="Saldo real" value={realBalance} strong good={realBalance >= 0} bad={realBalance < 0} />
        <p className="muted small">Saldo real = receita − (fixas + cartões + despesas gerais e supermercado gastos no mês).</p>
      </section>
    </main>
  );
}

function Line({ label, value, strong, good, bad }: { label: string; value: number; strong?: boolean; good?: boolean; bad?: boolean }) {
  const cls = bad ? "error" : good ? "ok" : "";
  return (
    <div className="split">
      <span className={strong ? "" : "muted"}>{label}</span>
      <span className={`${cls} ${strong ? "strong" : ""}`}>{value < 0 ? "− " : ""}{formatBRL(Math.abs(value))}</span>
    </div>
  );
}

function Compare({ label, planned, real }: { label: string; planned: number; real: number }) {
  return (
    <div className="compare">
      <div className="split"><strong>{label}</strong><span className={real > planned && planned > 0 ? "error" : "muted"}>{formatBRL(real)} de {formatBRL(planned)}</span></div>
      <Bar value={real} max={planned} />
    </div>
  );
}

function Section(props: {
  kind: PlanKind; title: string; placeholder: string; installments: boolean; monthKey: string;
  items: PlanItem[]; onChanged: () => void; onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [parcels, setParcels] = useState("");
  const amount = Number(value.replace(",", "."));
  const n = parcels.trim() ? Number(parcels) : 1;
  const valid = name.trim() !== "" && amount > 0 && Number.isInteger(n) && n >= 1 && n <= 60;

  const add = useMutation({
    mutationFn: () => addPlanItem(props.monthKey, props.kind, name, amount, n),
    onSuccess: () => {
      props.onChanged();
      setName("");
      setValue("");
      setParcels("");
    },
  });
  const total = props.items.reduce((s, i) => s + i.amount, 0);

  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); if (valid) add.mutate(); }}>
      <div className="split"><h2>{props.title}</h2><strong>{formatBRL(total)}</strong></div>
      <ul className="plain">
        {props.items.map((i) => (
          <li key={i.id}>
            <span className="grow">{i.description}</span>
            <strong>{formatBRL(i.amount)}</strong>
            <button type="button" className="ghost" aria-label={`Remover ${i.description}`} onClick={() => props.onRemove(i.id)}>✕</button>
          </li>
        ))}
      </ul>
      <input placeholder={props.placeholder} value={name} onChange={(e) => setName(e.target.value)} aria-label={`Descrição: ${props.title}`} />
      <div className="row tight">
        <input inputMode="decimal" placeholder="Valor" value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Valor: ${props.title}`} />
        {props.installments && <input inputMode="numeric" placeholder="Parcelas" value={parcels} onChange={(e) => setParcels(e.target.value)} aria-label={`Parcelas: ${props.title}`} />}
        <button type="submit" disabled={!valid || add.isPending} aria-label={`Adicionar: ${props.title}`}>＋</button>
      </div>
      {parcels.trim() && n > 1 && valid && <p className="muted small">Entra neste mês e nos próximos {n - 1}: {n}x de {formatBRL(amount)}.</p>}
      {add.isError && <p className="error">Não foi possível salvar.</p>}
    </form>
  );
}
