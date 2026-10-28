import { supabase } from "../lib/supabase";
import type { Period } from "../lib/period";

export interface Expense {
  id: string;
  description: string;
  amount: number;
  spent_at: string;
  category: string | null;
}

export async function getExpenses(period: Period): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("general_expenses")
    .select("id, description, amount, spent_at, category")
    .gte("spent_at", period.start)
    .lte("spent_at", period.end)
    .order("spent_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw error;
  return (data as Expense[]).map((e) => ({ ...e, amount: Number(e.amount) }));
}

export async function addExpense(e: { description: string; amount: number; spent_at: string; category: string }) {
  const { error } = await supabase.from("general_expenses").insert({ ...e, description: e.description.trim() });
  if (error) throw error;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("general_expenses").delete().eq("id", id);
  if (error) throw error;
}
