import { supabase } from "../lib/supabase";
import type { Receipt } from "../lib/nfce";

export type ReceiptError = "layout" | "auth" | "url" | "network";

/** Erro ao buscar a nota; em "layout" traz o texto da pagina para diagnostico. */
export class ReceiptFetchError extends Error {
  constructor(public kind: ReceiptError, public debug?: string) {
    super(kind);
  }
}

/** Pede ao servidor (api/nfce) que busque a nota na SEFAZ. */
export async function fetchReceipt(url: string): Promise<Receipt> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch("/api/nfce", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new ReceiptFetchError("network");
  }
  if (res.ok) return (await res.json()) as Receipt;
  const body = (await res.json().catch(() => ({}))) as { debug?: string };
  const kind: ReceiptError = res.status === 422 ? "layout" : res.status === 401 ? "auth" : res.status === 400 ? "url" : "network";
  throw new ReceiptFetchError(kind, body.debug);
}

export async function getAliases(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("receipt_aliases").select("alias, product_id");
  if (error) throw error;
  return new Map((data as { alias: string; product_id: string }[]).map((r) => [r.alias, r.product_id]));
}

export interface ImportItem {
  alias: string;
  quantity: number;
  unit_price: number;
  product_id?: string;
  new_name?: string;
  new_sector?: string;
  new_unit?: string;
}

export async function importReceipt(store: string | null, date: string, accessKey: string | null, items: ImportItem[]): Promise<string> {
  const { data, error } = await supabase.rpc("import_receipt", { p_store: store, p_date: date, p_access_key: accessKey, p_items: items });
  if (error) throw new Error(/nota ja importada/.test(error.message) ? "duplicate" : error.message);
  return data as string;
}
