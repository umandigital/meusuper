import { supabase } from "../lib/supabase";
import type { Brand, Product, Unit } from "../types/db";

/** Busca no catalogo base + produtos proprios, sem acento; os proprios vem primeiro. */
export async function searchProducts(term: string): Promise<Product[]> {
  const q = term.trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc("search_products", { q });
  if (error) throw error;
  return data as Product[];
}

export async function createProduct(name: string, sector: string, unit: Unit): Promise<Product> {
  const { data, error } = await supabase.from("products").insert({ name: name.trim(), sector, unit }).select().single();
  if (error) throw error;
  return data as Product;
}

export async function listBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from("brands").select("*").order("name");
  if (error) throw error;
  return data as Brand[];
}

export async function createBrand(name: string): Promise<Brand> {
  const { data, error } = await supabase.from("brands").insert({ name: name.trim() }).select().single();
  if (error) throw error;
  return data as Brand;
}

/** Marca existente (sem diferenciar maiusculas) ou nova. */
export async function findOrCreateBrand(name: string): Promise<Brand> {
  const clean = name.trim();
  const { data, error } = await supabase.from("brands").select("*").ilike("name", clean).limit(1);
  if (error) throw error;
  if (data.length) return data[0] as Brand;
  return createBrand(clean);
}
