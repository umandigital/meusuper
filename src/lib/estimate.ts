import type { Price, Product } from "../types/db.ts";

export const FRESH_DAYS = 60;
const RECENT_SAMPLES = 8;
/** Quantas compras (datas diferentes) entram na media e o peso de cada uma, da mais recente para a mais antiga. */
const AVERAGE_WEIGHTS = [3, 2, 1];
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
 * Media das ultimas compras (ate 3 datas diferentes), com mais peso para a mais recente.
 * Varias linhas no mesmo dia (3 racoes iguais) contam como uma compra so. `sorted` vem do mais novo para o mais antigo.
 */
function recentAverage(sorted: Price[]): number {
  const perDay = new Map<string, number[]>();
  for (const p of sorted) {
    if (perDay.size === AVERAGE_WEIGHTS.length && !perDay.has(p.paid_at)) break;
    perDay.set(p.paid_at, [...(perDay.get(p.paid_at) ?? []), p.price]);
  }
  let sum = 0;
  let weights = 0;
  [...perDay.values()].forEach((day, i) => {
    sum += (day.reduce((a, b) => a + b, 0) / day.length) * AVERAGE_WEIGHTS[i];
    weights += AVERAGE_WEIGHTS[i];
  });
  return Math.round((sum / weights) * 100) / 100;
}

/**
 * Preco unitario esperado de um produto (com marca e mercado opcionais).
 * Procura o historico nesta ordem, usando o primeiro grupo que tiver precos:
 *   1) mesma marca no mesmo mercado   2) mesma marca em qualquer mercado
 *   3) qualquer marca no mesmo mercado  4) qualquer marca em qualquer mercado
 * Com marca definida, vale a media das ultimas compras (a mais recente pesa mais); sem marca, a mediana dessa media de cada marca.
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
      unit = recentAverage(sorted);
    } else {
      const perBrand = new Map<string, Price[]>();
      for (const p of sorted) perBrand.set(p.brand_id ?? "none", [...(perBrand.get(p.brand_id ?? "none") ?? []), p]);
      unit = median([...perBrand.values()].map(recentAverage));
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
