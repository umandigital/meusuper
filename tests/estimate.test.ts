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

import { matchProduct, aliasKey, accessKeyOf, receiptUrlOf, normalizeText } from "../src/lib/nfce.ts";
const cat: any = [
  { id: "1", user_id: null, name: "Arroz branco 5kg" }, { id: "2", user_id: null, name: "Arroz branco 1kg" },
  { id: "3", user_id: null, name: "Leite integral 1L" }, { id: "4", user_id: null, name: "Banana" },
  { id: "5", user_id: null, name: "Feijão preto 1kg" }, { id: "6", user_id: null, name: "Leite integral caixa 12 unidades" },
  { id: "7", user_id: null, name: "Refrigerante cola 2L" }, { id: "8", user_id: null, name: "Açúcar refinado 1kg" },
  { id: "9", user_id: null, name: "Leite desnatado 1L" }, { id: "10", user_id: null, name: "Refrigerante guaraná 2L" },
];
const m = (n: string, al: Map<string, string> = new Map()) => matchProduct(n, cat, al)?.product.name ?? null;
eq(normalizeText("LEITE INT. 1 L Piracanjuba"), "leite int. 1l piracanjuba".replace("int.", "int"), "nota: normaliza tamanho e pontuacao");
eq(m("ARROZ TIO JOAO TP1 5KG"), "Arroz branco 5kg", "nota: arroz 5kg liga ao arroz 5kg");
eq(m("ARROZ CAMIL 1 KG"), "Arroz branco 1kg", "nota: arroz 1kg nao vira 5kg");
eq(m("LEITE INTEGRAL UHT PIRACANJUBA 1L"), "Leite integral 1L", "nota: leite integral 1L");
eq(m("BANANA PRATA KG"), "Banana", "nota: banana");
eq(m("LEITE INT PIRACANJUBA 1L"), "Leite integral 1L", "nota: abreviacao INT = integral (nao confunde com desnatado)");
eq(m("LEITE DESN ITALAC 1L"), "Leite desnatado 1L", "nota: abreviacao DESN = desnatado");
eq(m("REFRIG GUARANA ANTARCTICA 2L"), "Refrigerante guaraná 2L", "nota: REFRIG = refrigerante e sabor certo");
eq(m("REFRIG COCA COLA 2L"), "Refrigerante cola 2L", "nota: abreviacao + marca ainda casa pelas palavras em comum");
eq(m("SUCO DEL VALLE UVA 1L"), null, "nota: sem palavras suficientes em comum nao casa (usuario decide)");
eq(m("FEIJAO PRETO CAMIL 1KG"), "Feijão preto 1kg", "nota: acento e maiuscula nao atrapalham");
eq(m("ACUCAR REFINADO UNIAO 1KG"), "Açúcar refinado 1kg", "nota: acucar sem acento");
eq(m("SHAMPOO XYZ 350ML"), null, "nota: produto desconhecido nao casa");
eq(m("XPTO 123 ESPECIAL", new Map([[aliasKey("XPTO 123 ESPECIAL"), "5"]])), "Feijão preto 1kg", "nota: alias lembrado tem prioridade (e funciona mesmo sem palavras em comum)");
eq(accessKeyOf("https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43261012345678901234567890123456789012345678|2|1|1|ABC"), "43261012345678901234567890123456789012345678", "nota: extrai a chave de 44 digitos");
eq(accessKeyOf("https://x.com/?p=123"), null, "nota: sem chave");
eq(receiptUrlOf("https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=1"), "https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=1", "nota: link da SEFAZ-RS aceito");
eq(receiptUrlOf("https://evil.example.com/?u=sefaz.rs.gov.br"), null, "nota: dominio estranho recusado");
eq(receiptUrlOf("https://sefaz.rs.gov.br.evil.com/x"), null, "nota: dominio disfarcado recusado");
eq(receiptUrlOf("texto qualquer"), null, "nota: texto sem link");

import { parseNfce, isAllowedUrl, diagnosticText } from "../api/nfce.ts";
// Trecho no layout padrao de consulta publica de NFC-e (modelado, nao capturado de uma nota real).
const html = `<html><body>
<div id="u20" class="txtTopo">SUPERMERCADO NICOLINI LTDA</div>
<table id="tabResult">
<tr id="Item + 1"><td><span class="txtTit">ARROZ TIO JOAO TP1 5KG</span><span class="RCod">(Código: 123)</span><br/>
<span class="Rqtd"><strong>Qtde.:</strong>2,0000</span><span class="RUN"><strong>UN: </strong>UN</span><span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;&nbsp;31,50</span></td><td class="txtTit noWrap">Vl. Total<br/><span class="valor">63,00</span></td></tr>
<tr id="Item + 2"><td><span class="txtTit">BANANA PRATA KG</span>
<span class="Rqtd"><strong>Qtde.:</strong>1,3500</span><span class="RUN"><strong>UN: </strong>KG</span><span class="RvlUnit"><strong>Vl. Unit.:</strong> 6,99</span></td><td><span class="valor">9,44</span></td></tr>
<tr id="Item + 3"><td><span class="txtTit">LEITE INT PIRACANJUBA &amp; CIA 1L</span>
<span class="Rqtd"><strong>Qtde.:</strong>6,0000</span><span class="RUN"><strong>UN: </strong>UN</span></td><td><span class="valor">34,74</span></td></tr>
<tr><td><span class="txtTit">ITEM SEM QUANTIDADE</span></td></tr>
</table>
<div><strong>Emissão: </strong>28/10/2026 20:41:03 - Via Consumidor</div>
<div id="totalNota"><label>Valor total R$</label><span class="totalNumb txtMax">107,18</span></div>
</body></html>`;
const rc = parseNfce(html);
eq(rc.store, "SUPERMERCADO NICOLINI LTDA", "leitor da nota: nome do mercado");
eq(rc.date, "2026-10-28", "leitor da nota: data de emissao");
eq(rc.total, 107.18, "leitor da nota: total");
eq(rc.items.length, 3, "leitor da nota: 3 itens (o sem quantidade e ignorado)");
eq(rc.items[0], { name: "ARROZ TIO JOAO TP1 5KG", quantity: 2, unit: "UN", unit_price: 31.5 }, "leitor da nota: item por unidade");
eq(rc.items[1], { name: "BANANA PRATA KG", quantity: 1.35, unit: "KG", unit_price: 6.99 }, "leitor da nota: item por peso (kg)");
eq(rc.items[2].name + "|" + rc.items[2].unit_price, "LEITE INT PIRACANJUBA & CIA 1L|5.79", "leitor da nota: sem valor unitario usa total/qtd e decodifica &amp;");
eq(parseNfce("<html>pagina qualquer</html>").items.length, 0, "leitor da nota: pagina diferente nao inventa itens");
eq([isAllowedUrl("https://www.sefaz.rs.gov.br/NFCE/x")?.hostname, isAllowedUrl("http://www.sefaz.rs.gov.br/x"), isAllowedUrl("https://sefaz.rs.gov.br.evil.com/"), isAllowedUrl("https://127.0.0.1/")], ["www.sefaz.rs.gov.br", null, null, null], "funcao: so https e so dominios da SEFAZ");


// Estrategia B: tabela com cabecalho (colunas achadas pelo texto, em qualquer ordem). Fixture MODELADA, nao capturada.
const htmlB = `<html><body><h2>NFC-e</h2><div>Emitida em: Emissão 28/10/2026 20:41:03</div>
<table class="table"><thead><tr><th>Código</th><th>Descrição</th><th>Qtde</th><th>UN</th><th>Vl. Unit.</th><th>Vl. Total</th></tr></thead><tbody>
<tr><td>1</td><td>ARROZ TIO JOAO TP1 5KG</td><td>2,0000</td><td>UN</td><td>31,50</td><td>63,00</td></tr>
<tr><td>2</td><td>BANANA PRATA KG</td><td>1,3500</td><td>KG</td><td>6,99</td><td>9,44</td></tr>
<tr><td>3</td><td>LEITE &amp; CIA</td><td>6</td><td>UN</td><td></td><td>34,74</td></tr>
</tbody></table><table><tr><th>Forma de pagamento</th><th>Valor</th></tr><tr><td>Dinheiro</td><td>107,18</td></tr></table></body></html>`;
const rb = parseNfce(htmlB);
eq(rb.items.length, 3, "leitor B (tabela): 3 itens e ignora a tabela de pagamento");
eq(rb.items[0], { name: "ARROZ TIO JOAO TP1 5KG", quantity: 2, unit: "UN", unit_price: 31.5 }, "leitor B: item por unidade");
eq(rb.items[1].unit + "|" + rb.items[1].unit_price, "KG|6.99", "leitor B: item por peso");
eq(rb.items[2].name + "|" + rb.items[2].unit_price, "LEITE & CIA|5.79", "leitor B: sem unitario usa total/qtd");
eq(rb.date, "2026-10-28", "leitor B: data");
// colunas em outra ordem
const htmlC = `<table><tr><th>Valor Total</th><th>Quantidade</th><th>Descrição do produto</th><th>Valor Unitário</th></tr><tr><td>12,00</td><td>3</td><td>FEIJAO PRETO 1KG</td><td>4,00</td></tr></table>`;
eq(parseNfce(htmlC).items, [{ name: "FEIJAO PRETO 1KG", quantity: 3, unit: "UN", unit_price: 4 }], "leitor B: colunas em outra ordem");
// pagina de erro real do portal (resposta a uma chave inventada)
eq(parseNfce("<div>Falha inesperada no sistema. Motivo: Modelo (56) desconhecido Parameter name: chaveAcesso</div>").items.length, 0, "leitor: pagina de erro do portal nao inventa itens");
const diag = diagnosticText("<html><head><script>var x=1</script></head><body><table><tr><td>CPF do consumidor</td><td>123.456.789-09</td></tr><tr><td>Item</td><td>ARROZ</td></tr></table></body></html>");
eq(diag.includes("123.456.789-09") || diag.includes("var x"), false, "diagnostico: CPF mascarado e sem scripts");
eq(diag.includes("***.***.***-**") && diag.includes("ARROZ"), true, "diagnostico: mantem o texto util");
