import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnrichPlan, EnrichStep, Target } from "../lib/enrich.ts";
import { aliasKey } from "../lib/nfce.ts";

const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

/**
 * Aplica o plano de "completar a compra" no banco, na ordem: produtos novos e nomes, itens e precos, codigos de barras,
 * apelidos, e por fim apaga os produtos proprios que ficaram sem uso. Recebe o cliente para poder rodar fora do app.
 */
export async function applyEnrich(db: SupabaseClient, plan: EnrichPlan): Promise<{ changed: number; created: number; removed: number }> {
  const newIds = new Map<string, string>();
  let created = 0;

  for (const s of plan.steps) {
    const t = s.target;
    if (t.kind !== "new" || newIds.has(t.key)) continue;
    const ins = await db.from("products").insert({ name: t.name, sector: t.sector, unit: t.unit }).select("id").single();
    if (ins.error) {
      // ja existe um produto seu com esse nome: usa ele
      const ex = await db.from("products").select("id").ilike("name", t.name).not("user_id", "is", null).limit(1).single();
      fail(ex.error);
      newIds.set(t.key, ex.data!.id);
    } else {
      newIds.set(t.key, ins.data.id);
      created++;
    }
  }

  const idOf = (t: Target): string => (t.kind === "new" ? newIds.get(t.key)! : t.product.id);
  let changed = 0;

  for (const s of plan.steps) {
    const t = s.target;
    if (t.kind === "rename") {
      const r = await db.from("products").update({ name: t.name }).eq("id", t.product.id);
      fail(r.error);
    }
    const pid = idOf(t);
    if (pid !== s.from.id || s.quantity !== s.origQuantity || s.unit_price !== s.origUnitPrice) {
      const r = await db.from("purchase_items").update({ product_id: pid, quantity: s.quantity, unit_price: s.unit_price }).eq("id", s.itemId);
      fail(r.error);
      const p = await db.from("prices").update({ product_id: pid, price: s.unit_price }).eq("purchase_item_id", s.itemId);
      fail(p.error);
    }
    if (s.barcode) {
      const b = await db.from("product_brands").upsert({ product_id: pid, barcode: s.barcode }, { onConflict: "user_id,barcode", ignoreDuplicates: true });
      fail(b.error);
    }
    const a = await db.from("receipt_aliases").upsert({ alias: aliasKey(s.fullName), product_id: pid }, { onConflict: "user_id,alias" });
    fail(a.error);
    if (s.changed) changed++;
  }

  const stepFor = (key: string): EnrichStep | undefined => plan.steps.find((s) => s.target.kind === "new" && `new:${s.target.key}` === key);
  for (const fx of plan.aliasFixes) {
    if (fx.to === null) {
      fail((await db.from("receipt_aliases").delete().eq("alias", fx.alias).eq("product_id", fx.productId)).error);
    } else {
      const to = fx.to.startsWith("new:") ? idOf(stepFor(fx.to)!.target) : fx.to;
      fail((await db.from("receipt_aliases").update({ product_id: to }).eq("alias", fx.alias).eq("product_id", fx.productId)).error);
    }
  }

  // produto proprio que perdeu todos os usos some; o que ainda tem historico em outro lugar fica
  let removed = 0;
  const targets = new Set(plan.steps.map((s) => idOf(s.target)));
  for (const from of new Map(plan.steps.map((s) => [s.from.id, s.from])).values()) {
    if (!from.user_id || targets.has(from.id)) continue;
    const counts = await Promise.all(["purchase_items", "list_items", "prices"].map((t) => db.from(t).select("id", { count: "exact", head: true }).eq("product_id", from.id)));
    if (counts.every((c) => !c.error && c.count === 0)) {
      fail((await db.from("products").delete().eq("id", from.id)).error);
      removed++;
    }
  }
  return { changed, created, removed };
}
