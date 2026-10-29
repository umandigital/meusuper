import type { Receipt } from "./nfce.ts";

/**
 * Le o TEXTO copiado de um cupom (NFC-e) e devolve os itens. Dois formatos conhecidos:
 *  - tela da SEFAZ-RS:  "NOME (Código: 17 )" + "Qtde.:0,142 UN: KG Vl. Unit.: 59,9" + "Vl. Total 8,51"
 *  - tela do app do mercado:  "NOME" [+ "GTIN: 789..."] + "003 1 UN x R$ 4,99 4,99"
 * Itens iguais e seguidos (mesmo nome, unidade, preco e codigo) viram um so, com a quantidade somada.
 */
export type CupomReceipt = Receipt & { key: string | null };

/** "1.234,56" ou "59,9" -> numero; vazio ou invalido -> NaN. */
const money = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/\./g, "").replace(",", ".")));
/** quantidade: aceita "0,142" e "0.246" */
const qty = (s: string) => Number(s.replace(",", "."));

type Item = NonNullable<Receipt["items"]>[number];

function merge(items: Item[]): Item[] {
  const out: Item[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.name === it.name && last.unit === it.unit && last.unit_price === it.unit_price && (last.barcode ?? null) === (it.barcode ?? null)) {
      last.quantity = Math.round((last.quantity + it.quantity) * 1000) / 1000;
    } else {
      out.push({ ...it });
    }
  }
  return out;
}

/** Formato da tela da SEFAZ. */
function parseSefazScreen(text: string): Item[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: Item[] = [];
  const detail = /Qtde\.?:?\s*([\d.,]+)\s*UN:?\s*([A-Za-z]+)\s*Vl\.?\s*Unit\.?:?\s*([\d.,]+)/i;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(.*?)\s*\(\s*C[óo]digo:?[^)]*\)/i);
    if (!m) continue;
    const name = (m[1] || lines[i - 1] || "").trim();
    // os campos podem vir na mesma linha ou nas proximas
    const window = [lines[i].slice(m[0].length), ...lines.slice(i + 1, i + 6)].join(" ");
    const d = window.match(detail);
    if (!name || !d) continue;
    const quantity = qty(d[1]);
    const price = money(d[3]);
    if (!(quantity > 0) || !(price >= 0)) continue;
    items.push({ name, quantity, unit: d[2].toUpperCase(), unit_price: price, barcode: null });
  }
  return items;
}

/** Formato da tela do app do mercado (com GTIN). */
function parseMarketApp(text: string): Item[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: Item[] = [];
  const row = /^(\d{1,3})\s+([\d.,]+)\s*([A-Za-z]+)\s*x\s*R?\$?\s*([\d.,]+)\s+([\d.,]+)$/i;
  let name = "";
  let barcode: string | null = null;
  for (const line of lines) {
    const g = line.match(/GTIN:?\s*(\d{8,14})/i);
    if (g) {
      barcode = /^0+$/.test(g[1]) ? null : g[1];
      continue;
    }
    const r = line.match(row);
    if (r && name) {
      const quantity = qty(r[2]);
      const price = money(r[4]);
      if (quantity > 0 && price >= 0) items.push({ name, quantity, unit: r[3].toUpperCase(), unit_price: price, barcode });
      name = "";
      barcode = null;
      continue;
    }
    name = line;
    barcode = null;
  }
  return items;
}

export function parseCupomText(text: string): (CupomReceipt & { parsedLines: number; expectedItems: number | null }) | null {
  // o "Vl. Total" fecha cada item: quebra de linha depois dele separa os itens mesmo em texto colado numa linha so
  const t = text.replace(/\r/g, "").replace(/(Vl\.?\s*Total:?\s*[\d.,]+)/gi, "$1\n");
  let raw = parseSefazScreen(t);
  if (!raw.length) raw = parseMarketApp(t);
  if (!raw.length) return null;
  const flat = t.replace(/\s+/g, " ");
  const date = flat.match(/Emiss[ãa]o:?\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  const totalRaw = flat.match(/Valor\s+a\s+pagar\s+R\$:?\s*([\d.,]+)/i)?.[1];
  const expected = flat.match(/Qtd\.?\s*total\s*de\s*itens:?\s*(\d+)/i)?.[1];
  const keyDigits = flat.match(/Chave\s+de\s+acesso:?\s*((?:\d[\s]*){44})/i)?.[1]?.replace(/\s+/g, "");
  return {
    store: null,
    date: date ? `${date[3]}-${date[2]}-${date[1]}` : null,
    items: merge(raw),
    total: totalRaw ? money(totalRaw) : null,
    key: keyDigits && keyDigits.length === 44 ? keyDigits : null,
    parsedLines: raw.length,
    expectedItems: expected ? Number(expected) : null,
  };
}
