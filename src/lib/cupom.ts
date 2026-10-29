import type { Receipt } from "./nfce.ts";

/**
 * Le o TEXTO copiado de um cupom (NFC-e) e devolve os itens. Dois formatos conhecidos:
 *  - tela da SEFAZ-RS:  "NOME (Código: 17 )" + "Qtde.:0,142 UN: KG Vl. Unit.: 59,9" + "Vl. Total 8,51"
 *  - tela do app do mercado (Cupom Verde): "NOME", [GTIN: 789...], depois "003", "1 UN x", "R$ 4,99", "4,99" em linhas
 *    separadas (ou tudo numa linha so)
 * Itens iguais (mesmo nome, unidade, preco e codigo), seguidos ou nao, viram um so, com a quantidade somada.
 */
export type CupomReceipt = Receipt & { key: string | null };

/** "1.234,56" ou "59,9" -> numero; vazio ou invalido -> NaN. */
const money = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/\./g, "").replace(",", ".")));
/** quantidade: aceita "0,142" e "0.246" */
const qty = (s: string) => Number(s.replace(",", "."));

type Item = NonNullable<Receipt["items"]>[number];

function merge(items: Item[]): Item[] {
  const out: Item[] = [];
  const seen = new Map<string, Item>();
  for (const it of items) {
    const k = `${it.name}|${it.unit}|${it.unit_price}|${it.barcode ?? ""}`;
    const first = seen.get(k);
    if (first) first.quantity = Math.round((first.quantity + it.quantity) * 1000) / 1000;
    else {
      const copy = { ...it };
      seen.set(k, copy);
      out.push(copy);
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
  const oneLine = /^(\d{1,3})\s+([\d.,]+)\s*([A-Za-z]+)\s*x\s*R?\$?\s*([\d.,]+)\s+([\d.,]+)$/i;
  const qtyLine = /^([\d.,]+)\s*([A-Za-z]+)\s*x$/i;
  const priceLine = /^R\$\s*([\d.,]+)$/i;
  const numLine = /^[\d.,]+$/;
  const gtinLine = /GTIN:?\s*(\d{8,14})/i;
  const items: Item[] = [];

  // o nome e a ultima linha de texto antes do numero do item; a linha do GTIN, se houver, fica no meio
  const nameBefore = (idx: number): { name: string; barcode: string | null } | null => {
    let barcode: string | null = null;
    let j = idx - 1;
    const g = lines[j]?.match(gtinLine);
    if (g) {
      barcode = /^0+$/.test(g[1]) ? null : g[1];
      j -= 1;
    }
    const name = lines[j];
    return name && !numLine.test(name) && !/^R\$/i.test(name) ? { name, barcode } : null;
  };

  for (let i = 0; i < lines.length; i++) {
    let quantity = NaN, unit = "", price = NaN, advance = 0;
    const single = lines[i].match(oneLine);
    if (single) {
      quantity = qty(single[2]); unit = single[3]; price = money(single[4]);
    } else if (/^\d{1,3}$/.test(lines[i]) && qtyLine.test(lines[i + 1] ?? "") && priceLine.test(lines[i + 2] ?? "") && numLine.test(lines[i + 3] ?? "")) {
      const q = lines[i + 1].match(qtyLine)!;
      quantity = qty(q[1]); unit = q[2]; price = money(lines[i + 2].match(priceLine)![1]); advance = 3;
    } else continue;
    const head = nameBefore(i);
    if (head && quantity > 0 && price >= 0) items.push({ name: head.name, quantity, unit: unit.toUpperCase(), unit_price: price, barcode: head.barcode });
    i += advance;
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
  // "Emissão: 28/10/2026 17:43:19" (tela da SEFAZ) ou "Emissão 28/10/2026 às 17:43:19" (DANFE e seções do app)
  const date = flat.match(/Emiss[ãa]o\D{0,15}(\d{2})\/(\d{2})\/(\d{4})/i) ?? flat.match(/Data\s+de\s+autoriza[çc][ãa]o\D{0,15}(\d{2})\/(\d{2})\/(\d{4})/i);
  const totalRaw = flat.match(/Valor\s+a\s+pagar\s+R\$:?\s*([\d.,]+)/i)?.[1];
  const expected = flat.match(/(?:Qtd\.?\s*)?total\s*de\s*itens:?\s*(\d+)/i)?.[1];
  // app do mercado: o nome da loja vem logo acima de "Detalhes do estabelecimento"
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const at = lines.findIndex((l) => /^Detalhes do estabelecimento/i.test(l));
  const store = at > 0 ? lines[at - 1] : null;
  const keyDigits = flat.match(/Chave\s+de\s+acesso:?\s*((?:\d[\s]*){44})/i)?.[1]?.replace(/\s+/g, "");
  return {
    store,
    date: date ? `${date[3]}-${date[2]}-${date[1]}` : null,
    items: merge(raw),
    total: totalRaw ? money(totalRaw) : null,
    key: keyDigits && keyDigits.length === 44 ? keyDigits : null,
    parsedLines: raw.length,
    expectedItems: expected ? Number(expected) : null,
  };
}
