import { supabase } from "../lib/supabase";
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

export async function createList(name: string): Promise<ShoppingList> {
  const { data, error } = await supabase.from("lists").insert({ name: name.trim() }).select().single();
  if (error) throw error;
  return data as ShoppingList;
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

export async function addItem(listId: string, productId: string, brandId: string | null = null) {
  const { error } = await supabase.from("list_items").insert({ list_id: listId, product_id: productId, brand_id: brandId });
  if (error) throw error;
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
    .select("*")
    .in("product_id", productIds)
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return data as Price[];
}
