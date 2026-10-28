import { supabase } from "../lib/supabase";
import type { Brand, Product, Unit } from "../types/db";

/** Busca no catalogo base + produtos proprios; os proprios vem primeiro. */
export async function searchProducts(term: string): Promise<Product[]> {
  const q = term.trim();
  let query = supabase.from("products").select("*").order("name").limit(30);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, error } = await query;
  if (error) throw error;
  const lower = q.toLowerCase();
  const rank = (p: Product) => (p.user_id ? 0 : 2) + (p.name.toLowerCase().startsWith(lower) ? 0 : 1);
  return (data as Product[]).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 12);
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
