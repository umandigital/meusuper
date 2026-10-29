import { estimateUnitPrice, summarize } from "../src/lib/estimate.ts";
const prod: any = { id: "p1", name: "Arroz 5kg", reference_price: 27.9 };
const today = new Date("2026-10-28T00:00:00");
const mk = (brand: string | null, price: number, d: string): any => ({ id: Math.random()+"", product_id: "p1", brand_id: brand, price, paid_at: d });
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.log("FAIL", m, a, b); process.exitCode = 1; } else console.log("ok", m); };
eq(estimateUnitPrice(prod, null, [], today).source, "reference", "sem historico usa referencia");
const r = estimateUnitPrice(prod, null, [], today); eq([+r.low.toFixed(2), +r.high.toFixed(2)], [23.71, 32.08], "faixa +-15%");
const ps = [mk("A", 30, "2026-10-20"), mk("A", 26, "2026-09-01"), mk("B", 24, "2026-10-10")];
eq(estimateUnitPrice(prod, "A", ps, today).unit, 30, "marca A = ultimo preco");
eq(estimateUnitPrice(prod, null, ps, today).unit, 27, "sem marca = mediana dos ultimos por marca (30,24)");
const e = estimateUnitPrice(prod, "A", ps, today); eq([e.low, e.high, e.fresh], [26, 30, true], "faixa e fresco");
eq(estimateUnitPrice(prod, "A", [mk("A", 20, "2026-06-01")], today).fresh, false, "preco antigo");
eq(estimateUnitPrice(prod, "Z", ps, today).unit, 27, "marca sem historico cai para o produto");
const s = summarize([{ product: prod, brandId: "A", quantity: 2 }, { product: { ...prod, id: "x", reference_price: null }, brandId: null, quantity: 1 }], ps, today);
eq([s.total, s.fresh, s.withoutPrice, s.items], [60, 1, 1, 2], "totais");

import { autoListName } from "../src/lib/stores.ts";
eq(autoListName(new Date("2026-10-28T23:45:00Z")), "28/10/2026 20:45", "nome automatico da lista (horario de Brasilia)");

import { periodFor } from "../src/lib/period.ts";
const per = (d: string, day: number, off = 0) => { const p = periodFor(new Date(d + "T12:00:00"), day, off); return [p.start, p.end, p.label, p.monthKey]; };
eq(per("2026-10-28", 10), ["2026-10-10", "2026-11-09", "Outubro 2026", "2026-10-01"], "periodo: dia 28/10 com inicio no dia 10");
eq(per("2026-10-05", 10), ["2026-09-10", "2026-10-09", "Setembro 2026", "2026-09-01"], "periodo: dia 05/10 ainda e o mes fiscal de setembro");
eq(per("2026-10-10", 10), ["2026-10-10", "2026-11-09", "Outubro 2026", "2026-10-01"], "periodo: no proprio dia de inicio");
eq(per("2026-01-05", 10), ["2025-12-10", "2026-01-09", "Dezembro 2025", "2025-12-01"], "periodo: virada de ano");
eq(per("2026-10-28", 10, -1), ["2026-09-10", "2026-10-09", "Setembro 2026", "2026-09-01"], "periodo: mes anterior");
eq(per("2026-12-20", 10, 1), ["2027-01-10", "2027-02-09", "Janeiro 2027", "2027-01-01"], "periodo: proximo mes cruza o ano");
eq(per("2026-02-15", 1), ["2026-02-01", "2026-02-28", "Fevereiro 2026", "2026-02-01"], "periodo: inicio no dia 1 (fevereiro)");
eq(per("2028-02-15", 1), ["2028-02-01", "2028-02-29", "Fevereiro 2028", "2028-02-01"], "periodo: fevereiro bissexto");
eq(per("2026-03-20", 28), ["2026-02-28", "2026-03-27", "Fevereiro 2026", "2026-02-01"], "periodo: inicio no dia 28 (20/03 ainda e o periodo de fevereiro)");

import { bySector, topProducts, average, change, bucketOf } from "../src/lib/stats.ts";
const it = (name: string, sector: string, quantity: number, unit_price: number): any => ({ quantity, unit_price, product: { name, sector } });
const sold = [it("Arroz", "mercearia", 2, 30), it("Leite", "frios", 6, 5), it("Arroz", "mercearia", 1, 32), it("Feijao", "mercearia", 1, 9.5)];
eq(bySector(sold).map((x: any) => [x.sector.value, x.total]), [["mercearia", 101.5], ["frios", 30]], "estatisticas: gasto por setor (ordenado)");
eq(topProducts(sold, "").map((x: any) => [x.name, x.total, x.qty]), [["Arroz", 92, 3], ["Feijao", 9.5, 1], ["Leite", 30, 6]].sort((a: any, b: any) => b[1] - a[1]), "estatisticas: produtos que mais pesaram");
eq(topProducts(sold, "frios").map((x: any) => x.name), ["Leite"], "estatisticas: filtro por setor");
eq(average(122, 2), 61, "estatisticas: ticket medio"); eq(average(10, 0), 0, "estatisticas: ticket medio sem compras");
eq(change(5000, 4000), 25, "estatisticas: variacao +25%"); eq(change(10, 0), null, "estatisticas: sem base de comparacao");
const periodos: any = [{ start: "2026-09-10", end: "2026-10-09" }, { start: "2026-10-10", end: "2026-11-09" }];
eq([bucketOf("2026-10-09", periodos), bucketOf("2026-10-10", periodos), bucketOf("2026-11-10", periodos)], [0, 1, -1], "estatisticas: data cai no periodo certo (limites)");

// --- estimativa por mercado
const px = (brand: string | null, price: number, d: string, store: string | null): any => ({ id: Math.random() + "", product_id: "p1", brand_id: brand, price, paid_at: d, store: store ? { name: store } : null });
const hist = [px("A", 30, "2026-10-20", "Nicolini"), px("A", 26, "2026-10-22", "Peruzzo"), px("B", 24, "2026-10-21", "Peruzzo")];
eq(estimateUnitPrice(prod, "A", hist, today, "Nicolini").unit, 30, "mercado: marca A no Nicolini = 30");
eq(estimateUnitPrice(prod, "A", hist, today, "Peruzzo").unit, 26, "mercado: marca A no Peruzzo = 26");
eq(estimateUnitPrice(prod, "A", hist, today, null).unit, 26, "mercado: sem mercado usa o preco mais recente da marca");
eq(estimateUnitPrice(prod, "B", hist, today, "Nicolini").unit, 24, "mercado: marca B so existe no Peruzzo -> usa a marca em outro mercado");
eq(estimateUnitPrice(prod, null, hist, today, "Nicolini").unit, 30, "mercado: sem marca no Nicolini = so o que existe la");
eq(estimateUnitPrice(prod, null, hist, today, "Peruzzo").unit, 25, "mercado: sem marca no Peruzzo = mediana de 26 e 24");
eq(estimateUnitPrice(prod, null, hist, today, "Outro").unit, 25, "mercado: mercado sem historico cai para o geral (mediana do ultimo preco de cada marca)");
const mini = (store: string | null) => summarize([{ product: prod, brandId: "A", quantity: 2 }], hist, today, store).total;
eq([mini("Nicolini"), mini("Peruzzo")], [60, 52], "mercado: total da lista muda conforme o mercado");

import { brandOptions } from "../src/lib/brands.ts";
const bs: any = [{ id: "A", name: "Tio Joao" }, { id: "B", name: "Camil" }, { id: "C", name: "Prato Fino" }];
const bo = brandOptions("p1", null, bs, [{ product_id: "p1", brand_id: "C" }], [px("A", 30, "2026-10-20", null)]);
eq([bo.mine.map((b: any) => b.id), bo.others.map((b: any) => b.id)], [["A", "C"], ["B"]], "marcas: as ja usadas no produto vem primeiro");
eq(brandOptions("p1", "B", bs, [], []).mine.map((b: any) => b.id), ["B"], "marcas: a marca atual do item sempre aparece");
eq(brandOptions("p2", null, bs, [], [px("A", 1, "2026-10-20", null)]).mine, [], "marcas: historico de outro produto nao conta");

import { listAsText } from "../src/lib/share.ts";
const shared = listAsText("29/10/2026 20:45", "Peruzzo", [
  { name: "Banana", sector: "hortifruti", quantity: 1.5, unit: "kg", brand: null, checked: false },
  { name: "Arroz branco 5kg", sector: "mercearia", quantity: 2, unit: "pct", brand: "Tio Joao", checked: true },
  { name: "Leite integral 1L", sector: "frios", quantity: 6, unit: "l", brand: null, checked: false },
  { name: "Café", sector: "mercearia", quantity: 1, unit: "pct", brand: null, checked: false },
], 123.4);
eq(shared.split("\n")[0], "🛒 *29/10/2026 20:45* — Peruzzo", "compartilhar: cabecalho com data e mercado");
eq(shared.includes("▫️ Banana (1,5kg)") && shared.includes("✅ 2x Arroz branco 5kg — Tio Joao") && shared.includes("▫️ Leite integral 1L (6L)") && shared.includes("▫️ Café"), true, "compartilhar: itens com quantidade, marca e marcacao");
eq(shared.indexOf("Hortifruti") < shared.indexOf("Frios") && shared.indexOf("Frios") < shared.indexOf("Mercearia"), true, "compartilhar: setores na ordem do mercado");
eq(shared.replace(/\u00a0/g, " ").endsWith("Estimativa: R$ 123,40"), true, "compartilhar: termina com a estimativa");
