import { supabase } from "../lib/supabase";
import type { StoreName } from "../lib/stores";
import type { ListItem, Price, Product, ShoppingList } from "../types/db";

export type ListItemWithProduct = ListItem & { product: Product };

export async function getLists(): Promise<ShoppingList[]> {
  const { data, error } = await supabase.from("lists").select("*").eq("archived", false).order("created_at", { ascending: false });
  if (error) throw error;
  return data as ShoppingList[];
}

export async function getList(id: string): Promise<ShoppingList> {
  const { data, error } = await supabase.from("lists").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ShoppingList;
}

export async function createList(name: string, store: StoreName): Promise<ShoppingList> {
  const { data, error } = await supabase.from("lists").insert({ name: name.trim(), store }).select().single();
  if (error) throw error;
  return data as ShoppingList;
}

export async function setListStore(id: string, store: StoreName) {
  const { error } = await supabase.from("lists").update({ store }).eq("id", id);
  if (error) throw error;
}

export async function deleteList(id: string) {
  const { error } = await supabase.from("lists").delete().eq("id", id);
  if (error) throw error;
}

export async function getListItems(listId: string): Promise<ListItemWithProduct[]> {
  const { data, error } = await supabase
    .from("list_items")
    .select("*, product:products(*)")
    .eq("list_id", listId)
    .order("id");
  if (error) throw error;
  return data as unknown as ListItemWithProduct[];
}

export async function addItem(listId: string, productId: string, brandId: string | null = null, checked = false): Promise<string> {
  const { data, error } = await supabase
    .from("list_items")
    .insert({ list_id: listId, product_id: productId, brand_id: brandId, checked })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateItem(id: string, patch: Partial<Pick<ListItem, "brand_id" | "quantity" | "checked" | "paid_price">>) {
  const { error } = await supabase.from("list_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeItem(id: string) {
  const { error } = await supabase.from("list_items").delete().eq("id", id);
  if (error) throw error;
}

/** Historico de precos dos produtos informados, do mais recente para o mais antigo. */
export async function getPrices(productIds: string[]): Promise<Price[]> {
  if (!productIds.length) return [];
  const { data, error } = await supabase
    .from("prices")
    .select("*, store:stores(name)")
    .in("product_id", productIds)
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return data as Price[];
}

/** Ligacoes produto-marca ja cadastradas (por codigo de barras), para sugerir as marcas certas. */
export async function getBrandLinks(productIds: string[]): Promise<{ product_id: string; brand_id: string | null }[]> {
  if (!productIds.length) return [];
  const { data, error } = await supabase.from("product_brands").select("product_id, brand_id").in("product_id", productIds);
  if (error) throw error;
  return data as { product_id: string; brand_id: string | null }[];
}
