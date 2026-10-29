import { supabase } from "../lib/supabase";
import type { Period } from "../lib/period";
import { bucketOf, type SoldItem } from "../lib/stats";

/** Itens comprados no periodo (cada linha = produto, quantidade e preco pago). */
export async function getSoldItems(period: Period): Promise<SoldItem[]> {
  const { data, error } = await supabase
    .from("purchase_items")
    .select("quantity, unit_price, product:products(name, sector), purchase:purchases!inner(purchased_at)")
    .gte("purchase.purchased_at", period.start)
    .lte("purchase.purchased_at", period.end);
  if (error) throw error;
  return data as unknown as SoldItem[];
}

export interface SeriesPoint {
  label: string;
  supermarket: number;
  general: number;
  income: number;
  purchases: number;
}

/** Totais de cada periodo da lista, com uma consulta por tabela. */
export async function getSeries(periods: Period[]): Promise<SeriesPoint[]> {
  const first = periods[0].start;
  const last = periods[periods.length - 1].end;
  const [pur, exp, plan] = await Promise.all([
    supabase.from("purchases").select("purchased_at, total").gte("purchased_at", first).lte("purchased_at", last),
    supabase.from("general_expenses").select("spent_at, amount").gte("spent_at", first).lte("spent_at", last),
    supabase.from("monthly_plan").select("month, kind, amount").in("month", periods.map((p) => p.monthKey)).eq("kind", "income"),
  ]);
  for (const r of [pur, exp, plan]) if (r.error) throw r.error;
  const points: SeriesPoint[] = periods.map((p) => ({ label: p.label, supermarket: 0, general: 0, income: 0, purchases: 0 }));
  for (const r of pur.data ?? []) {
    const i = bucketOf(r.purchased_at, periods);
    if (i >= 0) { points[i].supermarket += Number(r.total); points[i].purchases += 1; }
  }
  for (const r of exp.data ?? []) {
    const i = bucketOf(r.spent_at, periods);
    if (i >= 0) points[i].general += Number(r.amount);
  }
  for (const r of plan.data ?? []) {
    const i = periods.findIndex((p) => p.monthKey === r.month);
    if (i >= 0) points[i].income += Number(r.amount);
  }
  return points;
}

export interface Committed {
  month: string;
  total: number;
}

/** Parcelas ja lancadas para os meses seguintes (compras parceladas no credito, fixas parceladas...). */
export async function getCommitted(monthKey: string): Promise<Committed[]> {
  const { data, error } = await supabase
    .from("monthly_plan")
    .select("month, amount")
    .gt("month", monthKey)
    .gt("installments", 1)
    .in("kind", ["credit_card", "fixed_expense", "general_budget"])
    .order("month");
  if (error) throw error;
  const byMonth = new Map<string, number>();
  for (const r of data) byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + Number(r.amount));
  return [...byMonth].map(([month, total]) => ({ month, total }));
}
