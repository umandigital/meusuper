import { supabase } from "../lib/supabase";
import type { Brand, Price, Product, ProductBrand, Unit } from "../types/db";

export interface LastPrice {
  price: number;
  paid_at: string;
}

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*").order("name").limit(1000);
  if (error) throw error;
  return data as Product[];
}

/** Ultimo preco pago de cada produto (considera o historico mais recente primeiro). */
export async function getLastPrices(): Promise<Map<string, LastPrice>> {
  const { data, error } = await supabase
    .from("prices")
    .select("product_id, price, paid_at")
    .order("paid_at", { ascending: false })
    .limit(3000);
  if (error) throw error;
  const map = new Map<string, LastPrice>();
  for (const r of data as { product_id: string; price: number; paid_at: string }[]) {
    if (!map.has(r.product_id)) map.set(r.product_id, { price: Number(r.price), paid_at: r.paid_at });
  }
  return map;
}

export async function getProduct(id: string): Promise<Product> {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Product;
}

export type ProductBrandRow = ProductBrand & { brand: Brand | null };

export async function getProductBrands(productId: string): Promise<ProductBrandRow[]> {
  const { data, error } = await supabase.from("product_brands").select("*, brand:brands(*)").eq("product_id", productId);
  if (error) throw error;
  return data as unknown as ProductBrandRow[];
}

export type PriceRow = Price & { brand: { name: string } | null; store: { name: string } | null };

export async function getProductPrices(productId: string): Promise<PriceRow[]> {
  const { data, error } = await supabase
    .from("prices")
    .select("*, brand:brands(name), store:stores(name)")
    .eq("product_id", productId)
    .order("paid_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as unknown as PriceRow[];
}

export async function updateProduct(id: string, patch: { name: string; sector: string; unit: Unit }) {
  const { error } = await supabase.from("products").update({ ...patch, name: patch.name.trim() }).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function deletePrice(id: string) {
  const { error } = await supabase.from("prices").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteProductBrand(id: string) {
  const { error } = await supabase.from("product_brands").delete().eq("id", id);
  if (error) throw error;
}
