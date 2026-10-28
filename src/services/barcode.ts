import { supabase } from "../lib/supabase";
import type { Brand, Product } from "../types/db";

export interface BarcodeMatch {
  product: Product;
  brand: Brand | null;
}

export async function findByBarcode(code: string): Promise<BarcodeMatch | null> {
  const { data, error } = await supabase
    .from("product_brands")
    .select("product:products(*), brand:brands(*)")
    .eq("barcode", code)
    .limit(1);
  if (error) throw error;
  const row = data?.[0] as unknown as { product: Product; brand: Brand | null } | undefined;
  return row ? { product: row.product, brand: row.brand } : null;
}

export async function saveBarcode(code: string, productId: string, brandId: string | null) {
  const { error } = await supabase.from("product_brands").insert({ barcode: code, product_id: productId, brand_id: brandId });
  if (error) throw error;
}

/** Sugestao de nome/marca na base publica Open Food Facts. Melhor esforco: falha em silencio. */
export async function suggestFromOpenFoodFacts(code: string): Promise<string | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands`);
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: number; product?: { product_name?: string; brands?: string } };
    if (json.status !== 1 || !json.product?.product_name) return null;
    const brand = json.product.brands?.split(",")[0]?.trim();
    return brand ? `${json.product.product_name} (${brand})` : json.product.product_name;
  } catch {
    return null;
  }
}
