import { supabase } from "../lib/supabase";
import { autoListName, STORES, type StoreName } from "../lib/stores";
import { addItems, createList } from "./lists";

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

export interface PurchaseDetail {
  id: string;
  purchased_at: string;
  total: number;
  store: { name: string } | null;
  items: {
    id: string;
    product_id: string | null;
    brand_id: string | null;
    quantity: number;
    unit_price: number;
    product: { name: string; unit: string } | null;
    brand: { name: string } | null;
  }[];
}

export async function getPurchase(id: string): Promise<PurchaseDetail> {
  const { data, error } = await supabase
    .from("purchases")
    .select("id, purchased_at, total, store:stores(name), items:purchase_items(id, product_id, brand_id, quantity, unit_price, product:products(name, unit), brand:brands(name))")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as PurchaseDetail;
}

export async function updatePurchase(id: string, date: string, store: StoreName | null, items: { id: string; quantity: number; unit_price: number }[]) {
  const { error } = await supabase.rpc("update_purchase", { p_purchase_id: id, p_date: date, p_store: store, p_items: items });
  if (error) throw error;
}

export async function deletePurchase(id: string) {
  const { error } = await supabase.from("purchases").delete().eq("id", id);
  if (error) throw error;
}

/** Cria uma lista nova com os mesmos itens (produto, marca e quantidade) de uma compra anterior. */
export async function repeatPurchase(purchaseId: string): Promise<string> {
  const p = await getPurchase(purchaseId);
  const store = (STORES as readonly string[]).includes(p.store?.name ?? "") ? (p.store!.name as StoreName) : STORES[0];
  const list = await createList(autoListName(), store);
  await addItems(
    list.id,
    p.items.filter((i) => i.product_id).map((i) => ({ product_id: i.product_id!, brand_id: i.brand_id, quantity: Number(i.quantity) })),
  );
  return list.id;
}

export async function getLatestPurchaseId(): Promise<string | null> {
  const { data, error } = await supabase.from("purchases").select("id").order("purchased_at", { ascending: false }).order("id", { ascending: false }).limit(1);
  if (error) throw error;
  return data[0]?.id ?? null;
}
