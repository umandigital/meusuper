import { supabase } from "../lib/supabase";
import { shiftMonthKey } from "../lib/period";
import type { PlanKind } from "./month";

export interface PlanItem {
  id: string;
  month: string;
  kind: PlanKind;
  description: string | null;
  amount: number;
  installments: number;
}

const COPIED_KINDS: PlanKind[] = ["income", "fixed_expense", "credit_card", "general_budget"];

export async function getPlan(monthKey: string): Promise<PlanItem[]> {
  const { data, error } = await supabase.from("monthly_plan").select("*").eq("month", monthKey).order("id");
  if (error) throw error;
  return (data as PlanItem[]).map((r) => ({ ...r, amount: Number(r.amount) }));
}

/** Com N parcelas, o item entra neste mes e nos N-1 seguintes, como "Nome (2/5)". */
export async function addPlanItem(monthKey: string, kind: PlanKind, name: string, amount: number, installments = 1) {
  const n = Math.max(1, Math.floor(installments));
  const rows = Array.from({ length: n }, (_, i) => ({
    month: shiftMonthKey(monthKey, i),
    kind,
    description: n > 1 ? `${name.trim()} (${i + 1}/${n})` : name.trim(),
    amount,
    installments: n,
  }));
  const { error } = await supabase.from("monthly_plan").insert(rows);
  if (error) throw error;
}

export async function deletePlanItem(id: string) {
  const { error } = await supabase.from("monthly_plan").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Copia receitas, fixas, cartoes e extras do mes anterior para este. Itens parcelados nao sao copiados
 * (as parcelas ja foram projetadas nos meses seguintes) e continuam no mes. Devolve quantos itens vieram.
 */
export async function copyPreviousMonth(monthKey: string): Promise<number> {
  const prevKey = shiftMonthKey(monthKey, -1);
  const { data: prev, error: e1 } = await supabase
    .from("monthly_plan")
    .select("kind, description, amount")
    .eq("month", prevKey)
    .eq("installments", 1)
    .in("kind", COPIED_KINDS);
  if (e1) throw e1;
  if (!prev.length) return 0;

  const { data: current, error: e2 } = await supabase
    .from("monthly_plan")
    .select("id")
    .eq("month", monthKey)
    .eq("installments", 1)
    .in("kind", COPIED_KINDS);
  if (e2) throw e2;
  if (current.length) {
    const { error } = await supabase.from("monthly_plan").delete().in("id", current.map((r) => r.id));
    if (error) throw error;
  }
  const { error: e3 } = await supabase.from("monthly_plan").insert(prev.map((r) => ({ ...r, month: monthKey, installments: 1 })));
  if (e3) throw e3;
  return prev.length;
}
