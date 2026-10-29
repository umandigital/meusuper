import type { Product } from "../types/db.ts";
import { aliasKey, cleanProductName, guessSector, isSizeToken, kgToUnits, matchProduct, tokens, type Receipt } from "./nfce.ts";

/**
 * Completar uma compra ja importada com o texto COMPLETO da mesma nota (nomes inteiros e codigo de barras).
 * O PDF traz so 15 letras por nome; o texto copiado do app traz tudo. Aqui descobrimos, para cada item da compra,
 * o que fazer com o produto ligado a ele: manter, renomear, trocar por outro ou criar um separado.
 */

export interface PurchaseItemLite {
  id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
}

export type Target =
  | { kind: "keep"; product: Product }
  | { kind: "rename"; product: Product; name: string }
  | { kind: "existing"; product: Product }
  | { kind: "new"; key: string; name: string; sector: string; unit: "un" | "kg" | "l" };

export interface EnrichStep {
  itemId: string;
  from: Product;
  fullName: string;
  barcode: string | null;
  target: Target;
  /** Quantidade e preco que ficam gravados (so mudam quando a nota vem em KG e o produto e em unidade). */
  quantity: number;
  unit_price: number;
  origQuantity: number;
  origUnitPrice: number;
  changed: boolean;
}

export interface EnrichPlan {
  steps: EnrichStep[];
  /** itens do texto que nao acharam o item correspondente na compra */
  unmatched: string[];
  /** apelidos antigos (nome cortado) que apontavam para `from` e precisam apontar para outro produto ou sumir */
  aliasFixes: { alias: string; productId: string; to: string | null }[];
}

const money = (n: number) => Math.round(n * 100) / 100;
const sameTotal = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.05, b * 0.005);

/** o nome do produto ou algum apelido seu e o comeco do nome completo da nota */
function relatedByName(fullKey: string, product: Product, aliasKeys: string[]): boolean {
  const own = aliasKey(product.name);
  return [own, ...aliasKeys].some((k) => k.length >= 5 && (fullKey === k || fullKey.startsWith(k + " ") || fullKey.startsWith(k)));
}

const sizes = (s: string) => tokens(s).filter(isSizeToken);
const sizeConflict = (a: string, b: string) => {
  const x = sizes(a);
  const y = sizes(b);
  return x.length > 0 && y.length > 0 && !x.some((z) => y.includes(z));
};

export function planEnrich(
  parsed: Receipt["items"],
  purchaseItems: PurchaseItemLite[],
  products: Product[],
  aliases: Map<string, string>,
  barcodes: Map<string, string>,
): EnrichPlan {
  const byId = new Map(products.map((p) => [p.id, p]));
  const aliasKeysOf = new Map<string, string[]>();
  for (const [k, pid] of aliases) aliasKeysOf.set(pid, [...(aliasKeysOf.get(pid) ?? []), k]);

  // produtos proprios que hoje estao nesta compra sao os que vamos resolver: ficam fora da busca por nome completo
  const inPurchase = new Set(purchaseItems.map((i) => i.product_id).filter((x): x is string => !!x));
  const pool = products.filter((p) => !(p.user_id && inPurchase.has(p.id)));

  const used = new Set<string>();
  const claimed = new Map<string, string>(); // produto proprio -> chave do nome completo que ficou com ele
  const plan: EnrichPlan = { steps: [], unmatched: [], aliasFixes: [] };
  const targetOfAlias = new Map<string, Set<string>>(); // `${productId}|${alias}` -> destinos

  for (const f of parsed) {
    const fullKey = aliasKey(f.name);
    const total = f.quantity * f.unit_price;
    const found = purchaseItems.find((pi) => {
      if (used.has(pi.id) || !pi.product_id) return false;
      const p = byId.get(pi.product_id);
      if (!p) return false;
      return sameTotal(Number(pi.quantity) * Number(pi.unit_price), total) && relatedByName(fullKey, p, aliasKeysOf.get(p.id) ?? []);
    });
    if (!found) {
      plan.unmatched.push(f.name);
      continue;
    }
    used.add(found.id);
    const from = byId.get(found.product_id!)!;
    const m = matchProduct(f.name, pool, new Map(), f.barcode ?? null, barcodes, f.unit);
    const unit = f.unit.toUpperCase() === "KG" ? "kg" : f.unit.toUpperCase() === "L" || f.unit.toUpperCase() === "LT" ? "l" : "un";

    let target: Target;
    if (m && m.product.id !== from.id) target = { kind: "existing", product: m.product };
    else if (m) target = { kind: "keep", product: from };
    else if (!from.user_id) target = sizeConflict(from.name, f.name) ? newTarget(f, unit) : { kind: "keep", product: from };
    else if (!claimed.has(from.id) || claimed.get(from.id) === fullKey) {
      claimed.set(from.id, fullKey);
      const name = cleanProductName(f.name, f.unit);
      // nunca troca um nome por outro mais curto (o do PDF, cortado): so completa
      const already = aliasKey(from.name).startsWith(fullKey) || name.toLowerCase() === from.name.toLowerCase();
      target = already ? { kind: "keep", product: from } : { kind: "rename", product: from, name };
    } else target = newTarget(f, unit);

    const toProduct = target.kind === "existing" || target.kind === "keep" || target.kind === "rename" ? target.product : null;
    // item pesado (KG) que vai para um produto em unidade: grava em unidades
    const conv = toProduct && f.unit.toUpperCase() === "KG" && toProduct.unit === "un" && toProduct.unit_weight_g ? kgToUnits(f.quantity, f.unit_price, Number(toProduct.unit_weight_g)) : null;
    const quantity = conv?.quantity ?? Number(found.quantity);
    const unit_price = conv?.unit_price ?? Number(found.unit_price);
    const changed = target.kind !== "keep" || quantity !== Number(found.quantity) || unit_price !== Number(found.unit_price) || (target.kind === "keep" && !!f.barcode && !barcodes.has(f.barcode));
    plan.steps.push({ itemId: found.id, from, fullName: f.name, barcode: f.barcode ?? null, target, quantity, unit_price, origQuantity: Number(found.quantity), origUnitPrice: Number(found.unit_price), changed });

    // o apelido cortado antigo (ex.: "massa inst niss") so pode apontar para UM destino
    for (const k of aliasKeysOf.get(from.id) ?? []) {
      if (fullKey.startsWith(k)) {
        const slot = `${from.id}|${k}`;
        targetOfAlias.set(slot, (targetOfAlias.get(slot) ?? new Set()).add(targetKey(target)));
      }
    }
  }

  for (const [slot, dests] of targetOfAlias) {
    const [productId, alias] = [slot.slice(0, slot.indexOf("|")), slot.slice(slot.indexOf("|") + 1)];
    const only = dests.size === 1 ? [...dests][0] : null;
    if (only !== productId) plan.aliasFixes.push({ alias, productId, to: only });
  }
  return plan;
}

const targetKey = (t: Target): string => (t.kind === "new" ? `new:${t.key}` : t.product.id);

function newTarget(f: Receipt["items"][number], unit: "un" | "kg" | "l"): Target {
  return { kind: "new", key: `${aliasKey(f.name)}|${unit}`, name: cleanProductName(f.name, f.unit), sector: guessSector(f.name), unit };
}

/** Texto curto de cada passo, para mostrar antes de aplicar. */
export function describeStep(s: EnrichStep): string {
  const t = s.target;
  if (t.kind === "rename") return `renomear "${s.from.name}" para "${t.name}"`;
  if (t.kind === "existing") return `trocar "${s.from.name}" por "${t.product.name}"`;
  if (t.kind === "new") return `"${s.from.name}" vira o produto novo "${t.name}"`;
  return s.barcode ? `"${s.from.name}": guardar o código de barras` : `"${s.from.name}": já está certo`;
}
