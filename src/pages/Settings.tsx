import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getStartDay, saveStartDay } from "../services/settings";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/auth";
import { periodFor, shortDate } from "../lib/period";
import Icon from "../components/Icon";

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export default function Settings() {
  const qc = useQueryClient();
  const session = useSession();
  const { data: saved } = useQuery({ queryKey: ["start-day"], queryFn: getStartDay });
  const [day, setDay] = useState(10);
  const [done, setDone] = useState(false);
  const [touched, setTouched] = useState(false);
  // o valor salvo so preenche o campo enquanto voce ainda nao mexeu nele
  useEffect(() => { if (saved && !touched) setDay(saved); }, [saved, touched]);

  const save = useMutation({
    mutationFn: () => saveStartDay(day),
    onSuccess: () => {
      qc.invalidateQueries();
      setTouched(false);
      setDone(true);
      window.setTimeout(() => setDone(false), 3000);
    },
  });

  const preview = periodFor(new Date(), day);
  const changed = saved !== undefined && day !== saved;

  return (
    <main>
      <h1>Ajustes</h1>

      <section className="panel">
        <h2>Período financeiro</h2>
        <label className="store-pick">
          O mês fiscal começa no dia:
          <select value={day} onChange={(e) => { setTouched(true); setDay(Number(e.target.value)); }}>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <p className="muted small">
          Prévia: o período atual vai de {shortDate(preview.start)} a {shortDate(preview.end)} e se chama <strong>{preview.label}</strong>.
          Ex.: com início no dia {day}, cada mês fiscal vai do dia {day} ao dia {day === 1 ? "último" : day - 1} do mês seguinte.
        </p>
        <button
          type="button"
          className="primary"
          disabled={!changed || save.isPending}
          onClick={() => confirm("Alterar o dia de início do mês fiscal recalcula os totais mensais em todas as telas. Deseja continuar?") && save.mutate()}
        >
          {save.isPending ? "Salvando…" : "Salvar"}
        </button>
        {done && <p className="ok" role="status"><Icon name="check" size={18} /> Período financeiro atualizado!</p>}
        {save.isError && <p className="error">Não foi possível salvar. Tente novamente.</p>}
      </section>

      <section className="panel">
        <h2>Conta</h2>
        <p className="muted small">{session?.user.email}</p>
        <button type="button" className="danger-line" onClick={() => supabase.auth.signOut()}>Sair</button>
      </section>
    </main>
  );
}
