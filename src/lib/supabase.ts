import { createClient } from "@supabase/supabase-js";

// Sem as variáveis o main.tsx mostra um aviso antes de qualquer tela usar o cliente.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "http://localhost",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "missing"
);
