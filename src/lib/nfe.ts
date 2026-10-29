import type { Receipt } from "./nfce.ts";

/**
 * Leitor do XML oficial da NF-e / NFC-e (layout 4.00, o mesmo que o mercado envia por e-mail).
 * Usa leitura por texto (sem DOMParser) para funcionar igual no navegador e nos testes.
 */
const decodeEntities = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");

const tag = (xml: string, name: string): string | null => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`));
  return m ? decodeEntities(m[1].trim()) : null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** EAN/GTIN valido para guardar: so digitos, 8 a 14, e nao "SEM GTIN" nem zeros. */
const gtin = (s: string | null) => (s && /^\d{8,14}$/.test(s) && !/^0+$/.test(s) ? s : null);

export type NfeReceipt = Receipt & { key: string | null; items: (Receipt["items"][number] & { barcode: string | null })[] };

export function parseNfeXml(xml: string): NfeReceipt | null {
  if (!/<(?:\w+:)?infNFe[\s>]/.test(xml)) return null;
  const key = xml.match(/<(?:\w+:)?infNFe[^>]*\sId="NFe(\d{44})"/)?.[1] ?? null;
  const items: NfeReceipt["items"] = [];
  for (const raw of xml.split(/<(?:\w+:)?det[\s>]/).slice(1)) {
    const det = raw.split(/<\/(?:\w+:)?det>/)[0];
    const name = tag(det, "xProd");
    const qty = Number(tag(det, "qCom"));
    const vProd = Number(tag(det, "vProd"));
    const vDesc = Number(tag(det, "vDesc") ?? 0) || 0;
    const vUn = Number(tag(det, "vUnCom"));
    if (!name || !(qty > 0)) continue;
    // com desconto no item, o preco pago de verdade e (valor - desconto) / quantidade
    const price = vDesc > 0 && vProd >= vDesc ? (vProd - vDesc) / qty : Number.isFinite(vUn) ? vUn : vProd / qty;
    if (!Number.isFinite(price) || price < 0) continue;
    items.push({ name, quantity: qty, unit: (tag(det, "uCom") ?? "UN").toUpperCase().slice(0, 4), unit_price: round2(price), barcode: gtin(tag(det, "cEAN")) });
  }
  const emit = tag(xml, "emit") ?? "";
  const dh = tag(xml, "dhEmi") ?? tag(xml, "dEmi");
  const total = Number(tag(xml, "vNF"));
  return {
    store: tag(emit, "xNome"),
    date: dh && /^\d{4}-\d{2}-\d{2}/.test(dh) ? dh.slice(0, 10) : null,
    items,
    total: Number.isFinite(total) ? total : null,
    key,
  };
}
