import { formatBRL } from "../lib/format";

export interface BarPoint {
  label: string;
  a: number;
  b: number;
}

/** Duas barras por mes (a = supermercado, b = despesas gerais), na mesma escala. */
export default function MonthBars({ points, aName, bName }: { points: BarPoint[]; aName: string; bName: string }) {
  const max = Math.max(1, ...points.flatMap((p) => [p.a, p.b]));
  return (
    <div>
      <div className="mbars" role="img" aria-label="Gastos dos últimos meses">
        {points.map((p) => (
          <div key={p.label} className="mcol">
            <div className="mpair">
              <div className="mbar a" style={{ height: `${(p.a / max) * 100}%` }} title={`${aName}: ${formatBRL(p.a)}`} />
              <div className="mbar b" style={{ height: `${(p.b / max) * 100}%` }} title={`${bName}: ${formatBRL(p.b)}`} />
            </div>
            <span>{p.label.slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <div className="legend small muted">
        <span><i className="dot a" /> {aName}</span>
        <span><i className="dot b" /> {bName}</span>
      </div>
    </div>
  );
}
