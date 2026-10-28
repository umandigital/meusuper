import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PeriodNav from "../components/PeriodNav";
import { usePeriod } from "../lib/usePeriod";
import { todayIso } from "../lib/period";
import { CATEGORIES } from "../lib/categories";
import { addExpense, deleteExpense, getExpenses } from "../services/expenses";
import { formatBRL } from "../lib/format";

const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

export default function Expenses() {
  const qc = useQueryClient();
  const { period, offset, setOffset } = usePeriod();
  const { data: expenses = [], isLoading } = useQuery({ queryKey: ["expenses", period?.start], queryFn: () => getExpenses(period!), enabled: !!period });

  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [date, setDate] = useState(todayIso());

  // a data sugerida acompanha o mes que voce esta vendo: hoje, se estiver nele; senao o primeiro dia
  useEffect(() => {
    if (!period) return;
    const t = todayIso();
    setDate(t >= period.start && t <= period.end ? t : period.start);
  }, [period?.start, period?.end]);

  const amount = Number(value.replace(",", "."));
  const valid = description.trim() !== "" && value.trim() !== "" && amount > 0 && !!date;
  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["month"] });
  };
  const add = useMutation({
    mutationFn: () => addExpense({ description, amount, spent_at: date, category }),
    onSuccess: () => {
      refresh();
      setDescription("");
      setValue("");
    },
  });
  const remove = useMutation({ mutationFn: deleteExpense, onSuccess: refresh });

  return (
    <main>
      <h1>Despesas Gerais</h1>
      {period && <PeriodNav period={period} onShift={(d) => setOffset(offset + d)} />}

      <section className="panel">
        <div className="muted small">Total Despesas Gerais</div>
        <div className="total">{formatBRL(total)}</div>
      </section>

      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) add.mutate();
        }}
      >
        <h2>Adicionar despesa</h2>
        <input placeholder="Ex: Conta de luz, Uber..." value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="two">
          <input inputMode="decimal" placeholder="Valor" value={value} onChange={(e) => setValue(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoria">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <input type="date" value={date} min={period?.start} max={period?.end} onChange={(e) => setDate(e.target.value)} aria-label="Data" />
        <button type="submit" className="primary" disabled={!valid || add.isPending}>＋ Adicionar</button>
        {add.isError && <p className="error">Não foi possível salvar. Tente novamente.</p>}
      </form>

      <h2 className="sector">DESPESAS DO MÊS ({expenses.length})</h2>
      {isLoading && <p className="muted">Carregando…</p>}
      {!isLoading && !expenses.length && <p className="muted">Nenhuma despesa geral registrada ainda.</p>}
      <ul className="plain">
        {expenses.map((e) => (
          <li key={e.id}>
            <span className="grow">
              <strong>{e.description}</strong>
              <small> · {fmtDate(e.spent_at)}{e.category && ` · ${e.category}`}</small>
            </span>
            <strong>{formatBRL(e.amount)}</strong>
            <button
              type="button"
              className="ghost"
              aria-label={`Excluir ${e.description}`}
              onClick={() => confirm(`Excluir a despesa "${e.description}"?`) && remove.mutate(e.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
