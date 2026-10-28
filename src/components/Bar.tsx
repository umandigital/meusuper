/** Barra de progresso: `value` sobre `max`. Fica vermelha ao passar do limite. */
export default function Bar({ value, max }: { value: number; max: number }) {
  const over = max > 0 ? value > max : value > 0;
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : value > 0 ? 100 : 0;
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={over ? "over" : ""} style={{ width: `${pct}%` }} />
    </div>
  );
}
