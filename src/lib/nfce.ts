import type { Product } from "../types/db.ts";

/** Texto da nota ou do QR sem acento, em minusculas, com tamanhos colados ("1 L" -> "1l"). */
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/(\d+(?:\.\d+)?)\s+(kg|g|ml|l|lt|lts|un)\b/g, "$1$2")
    .replace(/(\d)(lts?)\b/g, "$1l")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/(^|\s)\.+|\.+(\s|$)/g, " ")
    .trim();
}

const STOP = new Set(["de", "da", "do", "das", "dos", "com", "sem", "em", "para", "tipo", "tp", "un", "c", "s", "a", "e", "o", "cx", "pct", "pc"]);

export function tokens(s: string): string[] {
  return [...new Set(normalizeText(s).split(" ").filter((t) => t && !STOP.has(t)))];
}

/** Chave estavel do nome da nota, usada para lembrar a ligacao com o produto. */
export const aliasKey = (receiptName: string) => normalizeText(receiptName);

export interface Match {
  product: Product;
  how: "barcode" | "alias" | "name";
}

/**
 * Liga o nome de um item da nota a um produto: primeiro pelo que voce ja ligou antes (alias),
 * depois por palavras em comum. Para valer, o nome do produto precisa estar quase todo contido
 * no texto da nota (arroz + 5kg), assim "arroz 1kg" nao e confundido com "arroz 5kg".
 */
export function matchProduct(
  receiptName: string,
  products: Product[],
  aliases: Map<string, string>,
  barcode: string | null = null,
  barcodes: Map<string, string> = new Map(),
): Match | null {
  // o codigo de barras (EAN) do XML e a ligacao mais segura
  const byBarcode = barcode ? barcodes.get(barcode) : undefined;
  if (byBarcode) {
    const p = products.find((x) => x.id === byBarcode);
    if (p) return { product: p, how: "barcode" };
  }
  const byAlias = aliases.get(aliasKey(receiptName));
  if (byAlias) {
    const p = products.find((x) => x.id === byAlias);
    if (p) return { product: p, how: "alias" };
  }
  const rt = tokens(receiptName);
  if (!rt.length) return null;
  const rset = new Set(rt);
  // abreviacao de nota: "int" cobre "integral", "refrig" cobre "refrigerante" (so palavras, nao tamanhos como 5kg)
  const covers = (t: string) => rset.has(t) || (!/\d/.test(t) && rt.some((r) => r.length >= 3 && r !== t && !/\d/.test(r) && t.startsWith(r)));
  let best: { p: Product; common: number; size: number; own: boolean } | null = null;
  for (const p of products) {
    const pt = tokens(p.name);
    if (!pt.length) continue;
    const common = pt.filter(covers).length;
    if (common < Math.max(1, Math.ceil(pt.length * 0.6)) || common < pt.length - 1) continue;
    const cand = { p, common, size: pt.length, own: !!p.user_id };
    if (
      !best ||
      cand.common / cand.size > best.common / best.size ||
      (cand.common / cand.size === best.common / best.size && (cand.common > best.common || (cand.common === best.common && cand.own && !best.own)))
    ) {
      best = cand;
    }
  }
  return best ? { product: best.p, how: "name" } : null;
}

/** Chave de acesso (44 digitos) que vem dentro do link do QR Code da NFC-e. */
export function accessKeyOf(qrText: string): string | null {
  return qrText.match(/(?<!\d)(\d{44})(?!\d)/)?.[1] ?? null;
}

/** Aceita so links http(s) de dominios da SEFAZ; devolve o link limpo ou null. */
export function receiptUrlOf(qrText: string): string | null {
  const m = qrText.trim().match(/https?:\/\/[^\s]+/i);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    return /(^|\.)(sefaz\.rs\.gov\.br|svrs\.rs\.gov\.br|fazenda\.gov\.br)$/.test(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface Receipt {
  store: string | null;
  date: string | null; // YYYY-MM-DD
  items: { name: string; quantity: number; unit: string; unit_price: number; barcode?: string | null }[];
  total: number | null;
}
