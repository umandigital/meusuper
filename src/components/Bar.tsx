/** Barra de progresso: `value` sobre `max`. Fica vermelha ao passar do limite; sem limite definido (max <= 0) fica vazia. */
export default function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const over = max > 0 && value > max;
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="bar" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={over ? "over" : ""} style={{ width: `${pct}%` }} />
    </div>
  );
}
