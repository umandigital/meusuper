import { supabase } from "../lib/supabase";

export interface PurchaseRow {
  id: string;
  total: number;
  purchased_at: string;
  store: { name: string } | null;
}

export interface FinishItem {
  product_id: string;
  brand_id: string | null;
  quantity: number;
  unit_price: number;
  /** true quando o preco foi informado por voce (entra no historico de precos). */
  record_price: boolean;
}

export async function finishPurchase(listId: string, items: FinishItem[]): Promise<string> {
  const { data, error } = await supabase.rpc("finish_purchase", { p_list_id: listId, p_items: items });
  if (error) throw error;
  return data as string;
}

export async function getPurchases(): Promise<PurchaseRow[]> {
  const { data, error } = await supabase
    .from("purchases")
    .select("id, total, purchased_at, store:stores(name)")
    .order("purchased_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as unknown as PurchaseRow[];
}

export interface PurchaseItemRow {
  id: string;
  quantity: number;
  unit_price: number;
  product: { name: string } | null;
  brand: { name: string } | null;
}

export async function getPurchaseItems(purchaseId: string): Promise<PurchaseItemRow[]> {
  const { data, error } = await supabase
    .from("purchase_items")
    .select("id, quantity, unit_price, product:products(name), brand:brands(name)")
    .eq("purchase_id", purchaseId);
  if (error) throw error;
  return data as unknown as PurchaseItemRow[];
}
