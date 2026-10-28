import { supabase } from "../lib/supabase";

export const DEFAULT_START_DAY = 10;

export async function getStartDay(): Promise<number> {
  const { data, error } = await supabase.from("settings").select("period_start_day").maybeSingle();
  if (error) throw error;
  return data?.period_start_day ?? DEFAULT_START_DAY;
}

export async function saveStartDay(day: number) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("sem sessao");
  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: auth.user.id, period_start_day: day, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
