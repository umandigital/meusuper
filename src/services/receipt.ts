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

/** Codigos de barras ja conhecidos: EAN -> produto. */
export async function getBarcodes(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("product_brands").select("barcode, product_id").not("barcode", "is", null);
  if (error) throw error;
  return new Map((data as { barcode: string; product_id: string }[]).map((r) => [r.barcode, r.product_id]));
}

export interface ImportItem {
  alias: string;
  barcode?: string | null;
  quantity: number;
  unit_price: number;
  product_id?: string;
  new_name?: string;
  new_sector?: string;
  new_unit?: string;
}

/** `replaceId`: compra concluida pela lista que este cupom substitui (para o gasto nao entrar duas vezes). */
export async function importReceipt(store: string | null, date: string, accessKey: string | null, items: ImportItem[], replaceId: string | null = null): Promise<string> {
  const { data, error } = await supabase.rpc("import_receipt", { p_store: store, p_date: date, p_access_key: accessKey, p_items: items, ...(replaceId ? { p_replace: replaceId } : {}) });
  if (error) throw new Error(/nota ja importada/.test(error.message) ? "duplicate" : error.message);
  return data as string;
}

export interface ReplaceCandidate {
  id: string;
  total: number;
  purchased_at: string;
  store: string | null;
}

/** Compras concluidas pela lista (sem chave de nota) perto da data do cupom: candidatas a serem substituidas por ele. */
export async function findReplaceable(date: string, store: string): Promise<ReplaceCandidate[]> {
  const day = (d: number) => new Date(new Date(date + "T12:00:00Z").getTime() + d * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("purchases")
    .select("id, total, purchased_at, store:stores(name)")
    .is("access_key", null)
    .gte("purchased_at", day(-3))
    .lte("purchased_at", day(3))
    .order("purchased_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as { id: string; total: number; purchased_at: string; store: { name: string } | null }[])
    .filter((p) => !store || !p.store || p.store.name === store)
    .map((p) => ({ id: p.id, total: Number(p.total), purchased_at: p.purchased_at, store: p.store?.name ?? null }));
}

/** Compra ja importada com esta chave de nota (e seus itens), se houver. */
export async function findPurchaseByKey(key: string): Promise<{ id: string; items: { id: string; product_id: string | null; quantity: number; unit_price: number }[] } | null> {
  const { data, error } = await supabase.from("purchases").select("id, items:purchase_items(id, product_id, quantity, unit_price)").eq("access_key", key).maybeSingle();
  if (error) throw error;
  return data as { id: string; items: { id: string; product_id: string | null; quantity: number; unit_price: number }[] } | null;
}
