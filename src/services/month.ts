import { supabase } from "../lib/supabase";
import type { Period } from "../lib/period";

export type PlanKind = "income" | "fixed_expense" | "credit_card" | "general_budget" | "supermarket_budget";

export interface MonthData {
  supermarket: number;
  general: number;
  plan: Record<PlanKind, number>;
}

const sum = (rows: { [k: string]: unknown }[] | null, key: string) => (rows ?? []).reduce((s, r) => s + Number(r[key] ?? 0), 0);

/** Totais do mes fiscal: gasto no supermercado, despesas gerais e o que foi planejado. */
export async function getMonthData(period: Period): Promise<MonthData> {
  const [purchases, expenses, plan] = await Promise.all([
    supabase.from("purchases").select("total").gte("purchased_at", period.start).lte("purchased_at", period.end),
    supabase.from("general_expenses").select("amount").gte("spent_at", period.start).lte("spent_at", period.end),
    supabase.from("monthly_plan").select("kind, amount").eq("month", period.monthKey),
  ]);
  for (const r of [purchases, expenses, plan]) if (r.error) throw r.error;
  const byKind: Record<PlanKind, number> = { income: 0, fixed_expense: 0, credit_card: 0, general_budget: 0, supermarket_budget: 0 };
  for (const r of (plan.data ?? []) as { kind: PlanKind; amount: number }[]) byKind[r.kind] += Number(r.amount);
  return { supermarket: sum(purchases.data, "total"), general: sum(expenses.data, "amount"), plan: byKind };
}

/** Saldo previsto = receita - (fixas + cartoes + extras). */
export const expectedBalance = (p: MonthData["plan"]) => p.income - (p.fixed_expense + p.credit_card + p.general_budget);

export async function getSupermarketBudget(period: Period): Promise<{ id: string; amount: number } | null> {
  const { data, error } = await supabase
    .from("monthly_plan")
    .select("id, amount")
    .eq("month", period.monthKey)
    .eq("kind", "supermarket_budget")
    .limit(1);
  if (error) throw error;
  return data.length ? { id: data[0].id, amount: Number(data[0].amount) } : null;
}

export async function saveSupermarketBudget(period: Period, amount: number) {
  const current = await getSupermarketBudget(period);
  const q = current
    ? supabase.from("monthly_plan").update({ amount }).eq("id", current.id)
    : supabase.from("monthly_plan").insert({ month: period.monthKey, kind: "supermarket_budget", description: "Orçamento do supermercado", amount });
  const { error } = await q;
  if (error) throw error;
}

export interface PeriodPurchase {
  id: string;
  total: number;
  purchased_at: string;
  store: { name: string } | null;
}

export async function getPurchasesIn(period: Period): Promise<PeriodPurchase[]> {
  const { data, error } = await supabase
    .from("purchases")
    .select("id, total, purchased_at, store:stores(name)")
    .gte("purchased_at", period.start)
    .lte("purchased_at", period.end)
    .order("purchased_at", { ascending: false });
  if (error) throw error;
  return data as unknown as PeriodPurchase[];
}
