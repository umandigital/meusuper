import { SECTORS } from "./sectors.ts";
import type { Period } from "./period.ts";

export interface SoldItem {
  quantity: number;
  unit_price: number;
  product: { name: string; sector: string } | null;
}

const spent = (i: SoldItem) => Number(i.quantity) * Number(i.unit_price);

/** Gasto por setor, na ordem do mercado; setores sem gasto ficam de fora. */
export function bySector(items: SoldItem[]) {
  const totals = new Map<string, number>();
  for (const i of items) {
    const s = i.product?.sector ?? "outros";
    totals.set(s, (totals.get(s) ?? 0) + spent(i));
  }
  return SECTORS.filter((s) => totals.has(s.value))
    .map((s) => ({ sector: s, total: totals.get(s.value)! }))
    .sort((a, b) => b.total - a.total);
}

/** Produtos que mais pesaram no bolso, opcionalmente de um setor. */
export function topProducts(items: SoldItem[], sector: string, limit = 10) {
  const totals = new Map<string, { name: string; total: number; qty: number }>();
  for (const i of items) {
    if (!i.product || (sector && i.product.sector !== sector)) continue;
    const cur = totals.get(i.product.name) ?? { name: i.product.name, total: 0, qty: 0 };
    cur.total += spent(i);
    cur.qty += Number(i.quantity);
    totals.set(i.product.name, cur);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

export const average = (total: number, count: number) => (count > 0 ? total / count : 0);

/** Variacao percentual contra o mes anterior; null quando nao ha base de comparacao. */
export function change(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Em qual periodo cai uma data (YYYY-MM-DD); -1 se nenhum. */
export function bucketOf(date: string, periods: Period[]): number {
  return periods.findIndex((p) => date >= p.start && date <= p.end);
}
