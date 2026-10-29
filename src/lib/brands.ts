import type { Brand, Price } from "../types/db.ts";

/**
 * Marcas para o seletor de um produto: primeiro as que ja foram usadas com ele (compras, codigo de barras
 * ou a marca atual do item), depois as demais.
 */
export function brandOptions(
  productId: string,
  currentBrandId: string | null,
  brands: Brand[],
  links: { product_id: string; brand_id: string | null }[],
  prices: Price[],
): { mine: Brand[]; others: Brand[] } {
  const used = new Set<string>();
  for (const l of links) if (l.product_id === productId && l.brand_id) used.add(l.brand_id);
  for (const p of prices) if (p.product_id === productId && p.brand_id) used.add(p.brand_id);
  if (currentBrandId) used.add(currentBrandId);
  return { mine: brands.filter((b) => used.has(b.id)), others: brands.filter((b) => !used.has(b.id)) };
}
