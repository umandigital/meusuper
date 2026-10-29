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
  receiptUnit: string | null = null,
): Match | null {
  // o codigo de barras (EAN) do XML e a ligacao mais segura
  const byBarcode = barcode ? barcodes.get(barcode) : undefined;
  if (byBarcode) {
    const p = products.find((x) => x.id === byBarcode);
    if (p) return { product: p, how: "barcode" };
  }
  const norm = aliasKey(receiptName);
  const byAlias = aliases.get(norm) ?? truncatedAlias(norm, aliases);
  if (byAlias) {
    const p = products.find((x) => x.id === byAlias);
    if (p) return { product: p, how: "alias" };
  }
  const rt = tokens(receiptName);
  if (!rt.length) return null;
  const rset = new Set(rt);
  // abreviacao de nota: "int" cobre "integral", "refrig" cobre "refrigerante" (so palavras, nao tamanhos como 5kg)
  // tamanhos (5kg, 200ml, 1.5l): se os dois lados tem tamanho e nenhum coincide, e outro produto
  const isSize = (t: string) => /^\d+(\.\d+)?(kg|g|ml|l)$/.test(t);
  const rsizes = rt.filter(isSize);
  const covers = (t: string) => rset.has(t) || (!/\d/.test(t) && rt.some((r) => r.length >= 3 && r !== t && !/\d/.test(r) && t.startsWith(r)));
  let best: { p: Product; common: number; size: number; own: boolean } | null = null;
  for (const p of products) {
    const pt = tokens(p.name);
    if (!pt.length) continue;
    // o preco so e comparavel se a unidade for a mesma: item por KG so liga a produto por kg (nunca um pacote de 300g a "queijo por kg")
    if (receiptUnit && !unitCompatible(receiptUnit, p.unit)) continue;
    // na nota a 1a palavra diz o que o produto e (molho, suco, chocolate): "MOLHO TOMATE..." nao e "Tomate"
    if (!(pt[0] === rt[0] || (rt[0].length >= 3 && !/\d/.test(rt[0]) && pt[0].startsWith(rt[0])))) continue;
    const psizes = pt.filter(isSize);
    if (psizes.length && rsizes.length && !psizes.some((z) => rsizes.includes(z))) continue;
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

/**
 * O PDF do cupom corta os nomes em 15 letras ("LINGUICA BORRUS"). Se esse texto e o comeco de UM nome que voce
 * ja ligou antes, vale a mesma ligacao; se o comeco serve para produtos diferentes, nao adivinha.
 */
function truncatedAlias(norm: string, aliases: Map<string, string>): string | undefined {
  if (norm.length < 10 || norm.length > 15) return undefined;
  const hits = new Set<string>();
  for (const [key, productId] of aliases) if (key.length > norm.length && key.startsWith(norm + " ")) hits.add(productId);
  if (hits.size === 0) for (const [key, productId] of aliases) if (key.length > norm.length && key.startsWith(norm)) hits.add(productId);
  return hits.size === 1 ? [...hits][0] : undefined;
}

/** Unidade da nota (UN, KG, L...) x unidade do produto (un, pct, kg, l). */
export function unitCompatible(receiptUnit: string, productUnit: string): boolean {
  const u = receiptUnit.toUpperCase();
  if (u === "KG") return productUnit === "kg";
  if (u === "L" || u === "LT" || u === "LTS") return productUnit === "l";
  return productUnit === "un" || productUnit === "pct" || productUnit === "l";
}

/** Setor provavel de um produto novo, pelas primeiras palavras do nome na nota. */
const SECTOR_WORDS: [string, string[]][] = [
  ["hortifruti", ["horti", "banana", "maca", "laranja", "limao", "tomate", "cebola", "batata", "alface", "cenoura", "brocolis", "abobora", "pepino", "mamao", "melancia", "uva", "morango"]],
  ["acougue", ["linguica", "salsicha", "carne", "bife", "frango", "fgo", "peito", "coxa", "costela", "picanha", "alcatra", "patinho", "acem", "bacon", "hamburguer", "peixe", "file", "porco", "suino", "bovino"]],
  ["pet", ["racao", "areia", "petisco", "sache"]],
  ["frios", ["queijo", "presunto", "mortadela", "iogurte", "manteiga", "margarina", "requeijao", "ovos", "ovo", "leite", "bebida lactea", "creme", "nata", "salame", "peru"]],
  ["padaria", ["pao", "salgados", "bolo", "cuca", "torrada", "biscoito de polvilho", "croissant"]],
  ["congelados", ["hot", "pizza", "lasanha", "nuggets", "sorvete", "picole", "empanado", "congelado", "polpa", "kibe", "pastel"]],
  ["doces", ["chocolate", "bombom", "bala", "pirulito", "wafer", "alfajor", "doce", "goma", "marshmallow", "paçoca", "pacoca", "trufa"]],
  ["bebidas", ["suco", "refrigerante", "refrig", "agua", "cerveja", "vinho", "energetico", "cha", "isotonico", "vodka", "whisky", "cachaca", "espumante", "gin", "kombucha"]],
  ["limpeza", ["detergente", "sabao", "amaciante", "desinfetante", "alvejante", "agua sanitaria", "esponja", "multiuso", "limpa", "saco de lixo", "papel toalha", "lava"]],
  ["higiene", ["shampoo", "condicionador", "sabonete", "desodorante", "creme dental", "pasta dental", "escova", "absorvente", "fralda", "papel hig", "hig", "protetor", "hidratante", "cotonete", "algodao"]],
  ["mercearia", ["arroz", "feijao", "acucar", "cafe", "sal", "oleo", "azeite", "farinha", "macarrao", "massa", "molho", "extrato", "milho", "ervilha", "atum", "sardinha", "biscoito", "bolacha", "amendoim", "pipoca", "cereal", "aveia", "granola", "maionese", "ketchup", "tempero", "vinagre", "leite condensado", "dueto", "salgadinho", "batata palha", "castanha"]],
  ["utilidades", ["pilha", "lampada", "fosforo", "vela", "isqueiro", "carvao", "copo", "prato", "talher", "papel aluminio", "filme"]],
];

export function guessSector(receiptName: string): string {
  const t = ` ${normalizeText(receiptName)} `;
  const first = tokens(receiptName)[0] ?? "";
  const single = (w: string) => !w.includes(" ");
  // 1) frases ("papel hig", "papel toalha") primeiro, como frase
  for (const [sector, words] of SECTOR_WORDS) if (words.some((w) => !single(w) && t.includes(` ${w} `))) return sector;
  // 2) a primeira palavra manda ("MOLHO TOMATE" e mercearia, nao hortifruti); aceita abreviacao ("hig", "refrig")
  for (const [sector, words] of SECTOR_WORDS) if (words.some((w) => single(w) && (first === w || (first.length >= 3 && w.startsWith(first))))) return sector;
  // 3) qualquer palavra-chave no nome
  for (const [sector, words] of SECTOR_WORDS) if (words.some((w) => single(w) && t.includes(` ${w} `))) return sector;
  return "outros";
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
  /** "Qtd. total de itens" impresso na nota, e quantas linhas foram lidas: se diferirem, algo ficou de fora. */
  expectedItems?: number | null;
  parsedLines?: number;
}
