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
eq(m("SUCO INTEGRAL ALIANCA UVA 200ML"), null, "nota: mesmo nome mas tamanho diferente (200ml x 1L) NAO casa");
const frutas: any = [...cat, { id: "11", user_id: null, name: "Uva" }, { id: "12", user_id: null, name: "Tomate" }, { id: "13", user_id: null, name: "Paçoca" }];
const mf = (n: string) => matchProduct(n, frutas, new Map())?.product.name ?? null;
eq([mf("MOLHO TOMATE POMAROLA BOLONH SHT 300G"), mf("SUCO INTEGRAL ALIANCA UVA 200ML"), mf("CHOCOLATE ARCOR BLOCK RECH PACOCA 165G")], [null, null, null], "nota: produtos de uma palavra nao casam no meio do nome (molho de TOMATE, suco de UVA, chocolate com PACOCA)");
eq([mf("TOMATE ITALIANO KG"), mf("UVA ITALIA KG"), mf("PACOCA ROLHA 20UN")], ["Tomate", "Uva", "Paçoca"], "nota: a palavra no inicio do nome continua casando");
eq(m("ARROZ TIO JOAO 2KG"), null, "nota: arroz 2kg nao casa com 5kg nem 1kg");
eq(m("LEITE INTEGRAL 1 LITRO PIRACANJUBA"), "Leite integral 1L", "nota: sem unidade colada no tamanho continua casando pelo nome quando o tamanho nao aparece");
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

import { parseNfeXml } from "../src/lib/nfe.ts";
// XML no layout oficial NFC-e 4.00 (estrutura real do schema; valores inventados)
const KEY = "43261089835672003570651080000907771001016297";
const xml = `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe versao="4.00" Id="NFe${KEY}">
<ide><cUF>43</cUF><mod>65</mod><serie>108</serie><nNF>90777</nNF><dhEmi>2026-10-28T20:41:03-03:00</dhEmi></ide>
<emit><CNPJ>89835672003570</CNPJ><xNome>SUPERMERCADO NICOLINI LTDA</xNome><xFant>NICOLINI</xFant></emit>
<det nItem="1"><prod><cProd>123</cProd><cEAN>7896006744108</cEAN><xProd>ARROZ TIO JOAO TP1 5KG</xProd><NCM>10063021</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>31.5000000000</vUnCom><vProd>63.00</vProd><cEANTrib>7896006744108</cEANTrib><uTrib>UN</uTrib><qTrib>2.0000</qTrib><vUnTrib>31.5000000000</vUnTrib><indTot>1</indTot></prod><imposto><ICMS><ICMS00><vICMS>0.00</vICMS></ICMS00></ICMS></imposto></det>
<det nItem="2"><prod><cProd>9</cProd><cEAN>SEM GTIN</cEAN><xProd>BANANA PRATA &amp; CIA KG</xProd><uCom>KG</uCom><qCom>1.3500</qCom><vUnCom>6.9900000000</vUnCom><vProd>9.44</vProd></prod></det>
<det nItem="3"><prod><cProd>7</cProd><cEAN>7891000100103</cEAN><xProd>LEITE INT 1L</xProd><uCom>UN</uCom><qCom>6.0000</qCom><vUnCom>5.9900000000</vUnCom><vProd>35.94</vProd><vDesc>1.20</vDesc></prod></det>
<total><ICMSTot><vProd>108.38</vProd><vDesc>1.20</vDesc><vNF>107.18</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
const nf = parseNfeXml(xml)!;
eq(nf.key, KEY, "XML: chave de acesso (do Id)");
eq(nf.store, "SUPERMERCADO NICOLINI LTDA", "XML: mercado vem do emitente (nao do destinatario)");
eq(nf.date, "2026-10-28", "XML: data de emissao");
eq(nf.total, 107.18, "XML: total da nota");
eq(nf.items.length, 3, "XML: 3 itens");
eq(nf.items[0], { name: "ARROZ TIO JOAO TP1 5KG", quantity: 2, unit: "UN", unit_price: 31.5, barcode: "7896006744108" }, "XML: item com codigo de barras");
eq([nf.items[1].name, nf.items[1].unit, nf.items[1].unit_price, nf.items[1].barcode], ["BANANA PRATA & CIA KG", "KG", 6.99, null], "XML: item por peso, entidade decodificada e SEM GTIN vira nulo");
eq(nf.items[2].unit_price, 5.79, "XML: desconto no item entra no preco pago ((35,94 - 1,20) / 6)");
eq(parseNfeXml("<html>nao e xml de nota</html>"), null, "XML: arquivo que nao e nota e recusado");
eq(parseNfeXml(xml.replace(/<nfeProc[^>]*>|<\/nfeProc>/g, ""))?.items.length, 3, "XML: tambem le a NFe sem o envelope nfeProc");

// Reconhecimento pelo codigo de barras do XML (tem prioridade sobre nome e alias)
const eanMap = new Map([["7891000100103", "3"]]);
eq(matchProduct("ITEM SEM NOME PARECIDO", cat, new Map(), "7891000100103", eanMap)?.product.name, "Leite integral 1L", "EAN: liga pelo codigo de barras mesmo com nome diferente");
eq(matchProduct("ARROZ TIO JOAO TP1 5KG", cat, new Map(), "7891000100103", eanMap)?.product.name, "Leite integral 1L", "EAN: tem prioridade sobre o nome");
eq(matchProduct("ARROZ TIO JOAO TP1 5KG", cat, new Map(), "0000", eanMap)?.product.name, "Arroz branco 5kg", "EAN desconhecido: cai para o nome");

import { parseCupomText } from "../src/lib/cupom.ts";
// ---- texto como na tela da SEFAZ (print real: itens, totais, emissao e chave)
const sefazText = `Cupom
SALGADOS FESTA NICOLINI KG (Código: 17 )
Qtde.:0,142 UN: KG Vl. Unit.: 59,9
Vl. Total
8,51
CHOCOLATE ARCOR BLOCK RECH PACOCA 165G
(Código: 1017528 )
Qtde.:1 UN: UN Vl. Unit.: 19,89
Vl. Total
19,89
MOLHO TOMATE POMAROLA BOLONH SHT 300G (Código: 1009790 ) Qtde.:1 UN: UN Vl. Unit.: 6,49 Vl. Total 6,49
SUCO INTEGRAL ALIANCA UVA 200ML (Código: 7813966 ) Qtde.:1 UN: UN Vl. Unit.: 4,29 Vl. Total 4,29
ENERGETICO BALY ENERGY DRINK 2L (Código: 7711969 )
Qtde.:2 UN: UN Vl. Unit.: 10,9
Vl. Total
21,80
Qtd. total de itens: 6
Valor a pagar R$: 60,98
Forma de pagamento: Cartão de Débito 60,98
Número: 90777 Série: 108 Emissão: 28/10/2026 17:43:19 - Via Consumidor 2
Chave de acesso:
4326 1089 8356 7200 3570 6510 8000 0907 7710 0101 6297
Consumidor não identificado`;
const cs = parseCupomText(sefazText)!;
eq(cs.items.length, 5, "cupom SEFAZ: 5 itens (nome em linha propria ou junto do codigo)");
eq(cs.items[0], { name: "SALGADOS FESTA NICOLINI KG", quantity: 0.142, unit: "KG", unit_price: 59.9, barcode: null }, "cupom SEFAZ: item por peso (0,142 kg a 59,9)");
eq(cs.items[1].name + "|" + cs.items[1].unit_price, "CHOCOLATE ARCOR BLOCK RECH PACOCA 165G|19.89", "cupom SEFAZ: codigo na linha de baixo usa a linha anterior como nome");
eq([cs.items[4].quantity, cs.items[4].unit_price], [2, 10.9], "cupom SEFAZ: quantidade 2");
eq([cs.date, cs.total, cs.expectedItems, cs.parsedLines], ["2026-10-28", 60.98, 6, 5], "cupom SEFAZ: data, total, itens esperados (6) e lidos (5) para o aviso");
eq(cs.key, "43261089835672003570651080000907771001016297", "cupom SEFAZ: chave de acesso (44 digitos, com espacos)");
// ---- texto como na tela do app do mercado (print real)
const appText = `LINGUICA BORRUSSIA DEF MIGNON KG
001 0.246 KG x R$ 59,90 14,74
SALSICHA EXCELSIOR DEF 18CM KG
002 0.934 KG x R$ 18,99 17,74
DUETO ERVILHA E MILHO FUGINI SHT 170G
GTIN: 7897517209643
003 1 UN x R$ 4,99 4,99
RACAO WHISKAS CARNE SHT 85G
GTIN: 7896029046609
004 1 UN x R$ 3,49 3,49
RACAO WHISKAS CARNE SHT 85G
GTIN: 7896029046609
005 1 UN x R$ 3,49 3,49
RACAO WHISKAS CARNE SHT 85G
GTIN: 7896029046609
006 1 UN x R$ 3,49 3,49
MASSA INST NISSIN YAKISSOBA 500G
GTIN: 7891079011515
007 1 UN x R$ 9,49 9,49`;
const ca = parseCupomText(appText)!;
eq(ca.items.length, 5, "cupom do app: 7 linhas viram 5 itens (3 racoes iguais somadas)");
eq(ca.items[0], { name: "LINGUICA BORRUSSIA DEF MIGNON KG", quantity: 0.246, unit: "KG", unit_price: 59.9, barcode: null }, "cupom do app: item por peso (ponto decimal na quantidade)");
eq(ca.items[2], { name: "DUETO ERVILHA E MILHO FUGINI SHT 170G", quantity: 1, unit: "UN", unit_price: 4.99, barcode: "7897517209643" }, "cupom do app: GTIN vira codigo de barras");
eq([ca.items[3].name, ca.items[3].quantity, ca.items[3].barcode], ["RACAO WHISKAS CARNE SHT 85G", 3, "7896029046609"], "cupom do app: racao 3x somada");
eq(ca.parsedLines, 7, "cupom do app: 7 linhas lidas");
eq(parseCupomText("texto qualquer sem itens"), null, "cupom: texto sem itens e recusado");
// os dois layouts reais em uma linha so (quando o texto e copiado sem quebras)
eq(parseCupomText("PAO FRANCES KG (Código: 5 ) Qtde.:0,5 UN: KG Vl. Unit.: 16,9 Vl. Total 8,45 LEITE 1L (Código: 6 ) Qtde.:2 UN: UN Vl. Unit.: 5,19 Vl. Total 10,38")?.items.map((i) => i.name + ":" + i.quantity), ["PAO FRANCES KG:0.5", "LEITE 1L:2"], "cupom: texto colado em uma linha so le todos os itens (o Vl. Total separa)");

// ---- cupom REAL copiado do app do Nicolini (Cupom Verde): cada item em varias linhas
const real = `Desenvolvido por Cupom Verde
OSMAR NICOLINI COMERCIO E DISTRIBUICAO S.A.
Detalhes do estabelecimento

LINGUICA BORRUSSIA DEF MIGNON KG
001
0.246 KG    x
R$ 59,90
14,74
SALSICHA EXCELSIOR DEF 18CM KG
002
0.934 KG    x
R$ 18,99
17,74
DUETO ERVILHA E MILHO FUGINI SHT 170G

GTIN: 7897517209643
003
1 UN    x
R$ 4,99
4,99
RACAO WHISKAS CARNE SHT 85G

GTIN: 7896029046609
004
1 UN    x
R$ 3,49
3,49
RACAO WHISKAS CARNE SHT 85G

GTIN: 7896029046609
005
1 UN    x
R$ 3,49
3,49
RACAO WHISKAS CARNE SHT 85G

GTIN: 7896029046609
006
1 UN    x
R$ 3,49
3,49
MASSA INST NISSIN YAKISSOBA 500G

GTIN: 7891079011515
007
1 UN    x
R$ 9,49
9,49
MASSA INST NISSIN GAL CAIPIRA PIC 85G

GTIN: 7891079014028
008
1 UN    x
R$ 2,89
2,89
MASSA INST NISSIN GAL CAIPIRA PIC 85G

GTIN: 7891079014028
009
1 UN    x
R$ 2,89
2,89
MASSA INST NISSIN GAL CAIPIRA PIC 85G

GTIN: 7891079014028
010
1 UN    x
R$ 2,89
2,89
AMENDOIM ELMA CHIPS OVINHO 145G

GTIN: 7892840821470
011
1 UN    x
R$ 8,99
8,99
AMENDOIM ELMA CHIPS OVINHO 145G

GTIN: 7892840821470
012
1 UN    x
R$ 8,99
8,99
MASSA INST NISSIN GAL CAIPIRA PIC 85G

GTIN: 7891079014028
013
1 UN    x
R$ 2,89
2,89
CHOCOLATE LACTA AO LEITE OREO 90G

GTIN: 7622210567567
014
1 UN    x
R$ 7,99
7,99
CHOCOLATE LACTA AO LEITE OREO 90G

GTIN: 7622210567567
015
1 UN    x
R$ 7,99
7,99
AMENDOIM YOKI CROC MOLHO PIMENTA 420G

GTIN: 7891095911851
016
1 UN    x
R$ 16,98
16,98
HOT POCKET SADIA X PICANHA 145G

GTIN: 7893000043213
017
1 UN    x
R$ 8,99
8,99
AMENDOIM ELMA CHIPS OVINHO 145G

GTIN: 7892840821470
018
1 UN    x
R$ 8,99
8,99
PIPOCA YOKI PREMIUM 400G

GTIN: 7891095911349
019
1 UN    x
R$ 7,29
7,29
FGO EMP PERDIGAO BIG CHICKEN TRAD 1KG

GTIN: 7891515786298
020
1 UN    x
R$ 39,99
39,99
QUEIJO PRATO PRESIDENT FAT 300G

GTIN: 7891097103858
021
1 UN    x
R$ 18,49
18,49
HORTI TOMATE CEREJA VERMELHO BJ 250G

GTIN: 751320848888
022
1 UN    x
R$ 7,99
7,99
HORTI BROCOLIS EMB UN
023
1 UN    x
R$ 5,99
5,99
PAPEL HIG MILI DUAL FD 60MT C 6UN

GTIN: 7896104993712
024
1 UN    x
R$ 18,69
18,69
OVOS VERMELHOS CAIPIRA BJ C20

GTIN: 7898961290300
025
1 UN    x
R$ 21,90
21,90
BEBIDA LACTEA TIROL COCO SC 900G

GTIN: 7896256601251
026
1 UN    x
R$ 5,49
5,49
PAO FRANCES CACETINHO KG
027
0.66 KG    x
R$ 15,98
10,55
SALGADOS FESTA NICOLINI KG
028
0.142 KG    x
R$ 59,90
8,51
CHOCOLATE ARCOR BLOCK RECH PACOCA 165G

GTIN: 7898142867376
029
1 UN    x
R$ 19,89
19,89
MOLHO TOMATE POMAROLA BOLONH SHT 300G

GTIN: 7896036095126
030
1 UN    x
R$ 6,49
6,49
SUCO INTEGRAL ALIANCA UVA 200ML

GTIN: 7896100503335
031
1 UN    x
R$ 4,29
4,29
ENERGETICO BALY ENERGY DRINK 2L

GTIN: 7898080662668
032
1 UN    x
R$ 10,90
10,90
Total de itens
32
Valor total
R$ 324,37
Desconto
R$ 0,00
Acréscimos
R$ 0,00
Valor a pagar
R$ 324,37
Troco
R$ 0,00
Forma de pagamento
Informações adicionais
Informações complementares
Sua chave de acesso
4326 1089 8356 7200 3570 6510 8000 0907 7710 0101 6297
Você pode consultar o seu Cupom Fiscal pelo portal da Secretaria da Fazenda, usando a chave de acesso.`;
const cr2 = parseCupomText(real)!;
eq(cr2.parsedLines, 32, "cupom real: 32 linhas lidas");
eq(cr2.expectedItems, 32, "cupom real: 'Total de itens 32' bate -> sem aviso");
eq(cr2.items.length, 24, "cupom real: 32 linhas viram 24 itens (repetidos somados, mesmo nao seguidos)");
eq(cr2.total, 324.37, "cupom real: valor a pagar");
eq(cr2.store, "OSMAR NICOLINI COMERCIO E DISTRIBUICAO S.A.", "cupom real: mercado vem do cabecalho");
eq(cr2.key, "43261089835672003570651080000907771001016297", "cupom real: chave de acesso");
const nissin = cr2.items.find((i) => i.name.includes("CAIPIRA"))!;
eq([nissin.quantity, nissin.unit_price, nissin.barcode], [4, 2.89, "7891079014028"], "cupom real: massa 4x somada (008, 009, 010 e 013)");
const elma = cr2.items.find((i) => i.name.includes("ELMA"))!; eq(elma.quantity, 3, "cupom real: amendoim 3x somado (011, 012 e 018)");
eq(cr2.items.find((i) => i.name.includes("BROCOLIS"))!.barcode, null, "cupom real: item sem GTIN (brocolis) fica sem codigo");
eq(cr2.items.find((i) => i.name.startsWith("PAO FRANCES"))!.quantity, 0.66, "cupom real: pao por peso");
const soma = cr2.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
eq(Math.abs(soma - 324.37) < 0.1, true, "cupom real: soma dos itens bate com o total (diferenca de centavos por arredondamento do peso)");

import { unitCompatible, guessSector } from "../src/lib/nfce.ts";
const catU: any = [
  { id: "q", user_id: null, name: "Queijo prato fatiado", unit: "kg" }, { id: "s", user_id: null, name: "Salsicha", unit: "kg" },
  { id: "p", user_id: null, name: "Pão francês", unit: "kg" }, { id: "l", user_id: null, name: "Leite integral 1L", unit: "l" },
  { id: "e", user_id: null, name: "Energético", unit: "un" },
];
const mu = (n: string, u: string) => matchProduct(n, catU, new Map(), null, new Map(), u)?.product.name ?? null;
eq(mu("QUEIJO PRATO PRESIDENT FAT 300G", "UN"), null, "unidade: pacote de 300g (UN) NAO liga a 'queijo por kg'");
eq(mu("QUEIJO PRATO FATIADO KG", "KG"), "Queijo prato fatiado", "unidade: item por KG liga a produto por kg");
eq(mu("SALSICHA EXCELSIOR DEF 18CM KG", "KG"), "Salsicha", "unidade: salsicha KG");
eq(mu("PAO FRANCES CACETINHO KG", "KG"), "Pão francês", "unidade: pao por KG");
eq(mu("LEITE INTEGRAL PIRACANJUBA 1L", "UN"), "Leite integral 1L", "unidade: caixa de leite (UN) liga a produto em litros");
eq(mu("ENERGETICO BALY ENERGY DRINK 2L", "UN"), "Energético", "unidade: energetico UN");
eq([unitCompatible("KG", "kg"), unitCompatible("KG", "un"), unitCompatible("UN", "kg"), unitCompatible("UN", "pct"), unitCompatible("LT", "l")], [true, false, false, true, true], "unidade: tabela de compatibilidade");
const sec = (n: string) => guessSector(n);
eq([sec("LINGUICA BORRUSSIA DEF MIGNON KG"), sec("RACAO WHISKAS CARNE SHT 85G"), sec("HORTI BROCOLIS EMB UN"), sec("MASSA INST NISSIN YAKISSOBA 500G"), sec("CHOCOLATE ARCOR BLOCK RECH PACOCA 165G")], ["acougue", "pet", "hortifruti", "mercearia", "doces"], "setor: sugestoes por primeira palavra (linguica, racao, horti, massa, chocolate)");
eq([sec("MOLHO TOMATE POMAROLA BOLONH SHT 300G"), sec("SUCO INTEGRAL ALIANCA UVA 200ML"), sec("PAPEL HIG MILI DUAL FD 60MT C 6UN"), sec("OVOS VERMELHOS CAIPIRA BJ C20"), sec("PAO FRANCES CACETINHO KG"), sec("FGO EMP PERDIGAO BIG CHICKEN TRAD 1KG"), sec("HOT POCKET SADIA X PICANHA 145G")], ["mercearia", "bebidas", "higiene", "frios", "padaria", "acougue", "congelados"], "setor: a primeira palavra manda (molho de tomate nao e hortifruti)");
eq(sec("COISA ESTRANHA XYZ"), "outros", "setor: desconhecido cai em 'outros'");

// data em outros formatos de cupom (DANFE do e-mail e seccoes abertas do app)
const comData = (extra: string) => parseCupomText(`PAO KG\n001\n0.5 KG    x\nR$ 10,00\n5,00\n${extra}`)?.date;
eq(comData("Dados da NFC-e\nN° 90777 - Série 108\nEmissão\n28/10/2026 às 17:43:19\nProtocolo de autorização\n243262073873948"), "2026-10-28", "data: formato do DANFE do e-mail (Emissão, linha, data 'às' hora)");
eq(comData("Número: 90777 Série: 108 Emissão: 27/10/2026 17:43:19 - Via Consumidor 2"), "2026-10-27", "data: formato da tela da SEFAZ");
eq(comData("Data de autorização\n26/10/2026 às 17:43:20"), "2026-10-26", "data: so a autorizacao (mesmo dia da emissao)");
eq(comData("Valor a pagar\nR$ 5,00"), null, "data: ausente continua nula (a tela avisa)");

// Cupom real com as secoes ABERTAS (print do app): data em "Informacoes adicionais", COO e chave quebrada em 2 linhas
const aberto = real.replace(
  "Forma de pagamento\nInformações adicionais\nInformações complementares\nSua chave de acesso\n4326 1089 8356 7200 3570 6510 8000 0907 7710 0101 6297",
  "Forma de pagamento\nCartão de Débito\nR$ 324,37\nInformações adicionais\nDados da NFC-e\nN° 90777 - Série 108\nEmissão\n28/10/2026 às 17:43:19\nProtocolo de autorização\n243262073873948\nData de autorização\n28/10/2026 às 17:43:20\nInformações complementares\nCOO: 101629\nSua chave de acesso\n4326108983567200357065108000090777 10\n01016297",
);
const ca2 = parseCupomText(aberto)!;
eq(ca2.date, "2026-10-28", "cupom real aberto: data de emissao lida (28/10/2026)");
eq(ca2.key, "43261089835672003570651080000907771001016297", "cupom real aberto: chave quebrada em duas linhas e sem espacos");
eq([ca2.items.length, ca2.parsedLines, ca2.expectedItems, ca2.total], [24, 32, 32, 324.37], "cupom real aberto: itens, linhas, esperado e total continuam certos");
