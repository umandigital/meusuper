import type { Period } from "../lib/period";
import { shortDate } from "../lib/period";
import Icon from "./Icon";

export default function PeriodNav({ period, onShift }: { period: Period; onShift: (delta: number) => void }) {
  return (
    <div className="period-nav">
      <button type="button" onClick={() => onShift(-1)} aria-label="Mês anterior"><Icon name="chevron-left" /></button>
      <div>
        <strong>{period.label}</strong>
        {period.isCurrent && <span className="badge">Atual</span>}
        <small>{shortDate(period.start)} a {shortDate(period.end)}</small>
      </div>
      <button type="button" onClick={() => onShift(1)} aria-label="Próximo mês"><Icon name="chevron-right" /></button>
    </div>
  );
}
