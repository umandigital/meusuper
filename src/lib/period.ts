/** Mes fiscal: comeca no dia `startDay` (1 a 28) e vai ate o dia anterior do mes seguinte. */
export interface Period {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD, inclusive
  label: string; // "Outubro 2026" (mes em que o periodo comeca)
  monthKey: string; // YYYY-MM-01, chave estavel mesmo se o dia de inicio mudar
  isCurrent: boolean;
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function periodFor(ref: Date, startDay: number, offset = 0): Period {
  let month = ref.getMonth() + offset - (ref.getDate() < startDay ? 1 : 0);
  const first = new Date(ref.getFullYear(), month, 1);
  const y = first.getFullYear();
  month = first.getMonth();
  const start = new Date(y, month, startDay);
  const end = new Date(y, month + 1, startDay - 1);
  return {
    start: iso(start),
    end: iso(end),
    label: `${MONTHS[month]} ${y}`,
    monthKey: iso(first),
    isCurrent: offset === 0,
  };
}

/** "2026-10-10" -> "10/10" */
export const shortDate = (isoDate: string) => `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
