import { formatBRL } from "./format.ts";
import { SECTORS } from "./sectors.ts";

export interface ShareItem {
  name: string;
  sector: string;
  quantity: number;
  unit: string;
  brand: string | null;
  checked: boolean;
}

const qty = (q: number, unit: string) => {
  const n = Number(q.toFixed(3)).toString().replace(".", ",");
  return unit === "kg" ? `${n}kg` : unit === "l" ? `${n}L` : q === 1 ? "" : `${n}x `;
};

/** Texto da lista para mandar por WhatsApp, agrupado por setor, com o total estimado. */
export function listAsText(title: string, store: string | null, items: ShareItem[], total: number): string {
  const lines = [`🛒 *${title}*${store ? ` — ${store}` : ""}`];
  for (const s of SECTORS) {
    const group = items.filter((i) => i.sector === s.value);
    if (!group.length) continue;
    lines.push("", `${s.emoji} *${s.label}*`);
    for (const i of group) {
      const q = qty(i.quantity, i.unit);
      const sizeSuffix = i.unit === "kg" || i.unit === "l" ? ` (${q})` : "";
      const prefix = i.unit === "kg" || i.unit === "l" ? "" : q;
      lines.push(`${i.checked ? "✅" : "▫️"} ${prefix}${i.name}${i.brand ? ` — ${i.brand}` : ""}${sizeSuffix}`);
    }
  }
  if (total > 0) lines.push("", `Estimativa: ${formatBRL(total)}`);
  return lines.join("\n");
}
