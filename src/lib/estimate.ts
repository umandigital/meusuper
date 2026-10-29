import type { Price, Product } from "../types/db.ts";

export const FRESH_DAYS = 60;
const RECENT_SAMPLES = 8;
const REFERENCE_MARGIN = 0.15;

export interface Estimate {
  unit: number;
  low: number;
  high: number;
  /** "paid": veio do que foi pago; "reference": estimativa do catalogo; "none": sem preco. */
  source: "paid" | "reference" | "none";
  fresh: boolean;
  date: string | null;
}

export interface EstimateItem {
  product: Product;
  brandId: string | null;
  quantity: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const daysBetween = (isoDate: string, today: Date) =>
  Math.floor((today.getTime() - new Date(isoDate + "T00:00:00").getTime()) / 86_400_000);

/**
 * Preco unitario esperado de um produto (com marca e mercado opcionais).
 * Procura o historico nesta ordem, usando o primeiro grupo que tiver precos:
 *   1) mesma marca no mesmo mercado   2) mesma marca em qualquer mercado
 *   3) qualquer marca no mesmo mercado  4) qualquer marca em qualquer mercado
 * Com marca definida, vale o ultimo preco; sem marca, a mediana do ultimo preco de cada marca.
 * Sem historico, usa o preco de referencia do catalogo (+-15%). A faixa vem das ultimas compras.
 */
export function estimateUnitPrice(
  product: Product,
  brandId: string | null,
  prices: Price[],
  today = new Date(),
  storeName: string | null = null,
): Estimate {
  const mine = prices.filter((p) => p.product_id === product.id);
  const here = storeName ? mine.filter((p) => p.store?.name === storeName) : [];
  const brandIn = (list: Price[]) => (brandId ? list.filter((p) => p.brand_id === brandId) : []);
  const candidates: { pool: Price[]; byBrand: boolean }[] = [
    { pool: brandIn(here), byBrand: true },
    { pool: brandIn(mine), byBrand: true },
    { pool: here, byBrand: false },
    { pool: mine, byBrand: false },
  ];
  const chosen = candidates.find((c) => c.pool.length > 0);

  if (chosen) {
    const sorted = [...chosen.pool].sort((a, b) => b.paid_at.localeCompare(a.paid_at));
    let unit: number;
    if (chosen.byBrand) {
      unit = sorted[0].price;
    } else {
      const latestPerBrand = new Map<string, number>();
      for (const p of sorted) {
        const key = p.brand_id ?? "none";
        if (!latestPerBrand.has(key)) latestPerBrand.set(key, p.price);
      }
      unit = median([...latestPerBrand.values()]);
    }
    const samples = sorted.slice(0, RECENT_SAMPLES).map((p) => p.price);
    return {
      unit,
      low: Math.min(unit, ...samples),
      high: Math.max(unit, ...samples),
      source: "paid",
      fresh: daysBetween(sorted[0].paid_at, today) <= FRESH_DAYS,
      date: sorted[0].paid_at,
    };
  }

  if (product.reference_price != null) {
    const unit = product.reference_price;
    return {
      unit,
      low: unit * (1 - REFERENCE_MARGIN),
      high: unit * (1 + REFERENCE_MARGIN),
      source: "reference",
      fresh: false,
      date: null,
    };
  }

  return { unit: 0, low: 0, high: 0, source: "none", fresh: false, date: null };
}

export interface ListTotals {
  total: number;
  low: number;
  high: number;
  items: number;
  fresh: number;
  withoutPrice: number;
}

export function summarize(items: EstimateItem[], prices: Price[], today = new Date(), storeName: string | null = null): ListTotals {
  const totals: ListTotals = { total: 0, low: 0, high: 0, items: items.length, fresh: 0, withoutPrice: 0 };
  for (const it of items) {
    const e = estimateUnitPrice(it.product, it.brandId, prices, today, storeName);
    totals.total += e.unit * it.quantity;
    totals.low += e.low * it.quantity;
    totals.high += e.high * it.quantity;
    if (e.fresh) totals.fresh += 1;
    if (e.source === "none") totals.withoutPrice += 1;
  }
  return totals;
}
