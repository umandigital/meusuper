import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BarcodeScanner from "../components/BarcodeScanner";
import ProductSearch from "../components/ProductSearch";
import { accessKeyOf, aliasKey, cleanProductName, guessSector, isSizeToken, kgToUnits, matchProduct, receiptUrlOf, tokens, type Receipt } from "../lib/nfce";
import { describeStep, planEnrich } from "../lib/enrich";
import { applyEnrich } from "../services/enrich";
import { supabase } from "../lib/supabase";
import { SECTORS } from "../lib/sectors";
import { STORES } from "../lib/stores";
import { formatBRL } from "../lib/format";
import { fetchReceipt, findPurchaseByKey, findReplaceable, getAliases, getBarcodes, importReceipt, ReceiptFetchError, type ReceiptError } from "../services/receipt";
import { parseNfeXml } from "../lib/nfe";
import { parseCupomText } from "../lib/cupom";
import { pdfFileToText } from "../lib/pdfText";
import { takeSharedFile } from "../lib/shared";
import { listProducts } from "../services/products";
import type { Product } from "../types/db";
import Icon from "../components/Icon";

type Choice = { kind: "product"; product: Product } | { kind: "review"; product: Product } | { kind: "new"; name: string; sector: string } | { kind: "skip" } | { kind: "pick" };
interface Row { name: string; quantity: number; unit: string; unit_price: number; barcode?: string | null; choice: Choice; suggested: Product | null }

const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
const INVALIDATE = ["purchases", "products", "last-prices", "aliases", "barcodes", "month", "purchases-in", "series", "sold", "latest-purchase", "frequent", "replaceable"];
const unitOf = (u: string) => (u === "KG" ? "kg" : u === "L" || u === "LT" ? "l" : "un");
const MESSAGES: Record<ReceiptError, string> = {
  layout: "Não consegui ler o layout desta nota. Ela pode ter um formato diferente do esperado.",
  auth: "Sua sessão expirou. Saia e entre de novo.",
  url: "Esse link não é de uma nota fiscal da SEFAZ.",
  network: "Não consegui buscar a nota agora. Verifique a internet e tente de novo.",
};

export default function ReceiptImport() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const productsQ = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const aliasesQ = useQuery({ queryKey: ["aliases"], queryFn: getAliases });
  const barcodesQ = useQuery({ queryKey: ["barcodes"], queryFn: getBarcodes });
  const dataReady = productsQ.isSuccess && aliasesQ.isSuccess && barcodesQ.isSuccess;
  const products = useMemo(() => productsQ.data ?? [], [productsQ.data]);
  const aliases = useMemo(() => aliasesQ.data ?? new Map<string, string>(), [aliasesQ.data]);
  const barcodes = useMemo(() => barcodesQ.data ?? new Map<string, string>(), [barcodesQ.data]);

  const [scanning, setScanning] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [debug, setDebug] = useState("");
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [dateGuess, setDateGuess] = useState(false);
  const [fromPdf, setFromPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<(Receipt & { key: string | null }) | null>(null);
  const [overrides, setOverrides] = useState<Record<number, Choice>>({});
  const [store, setStore] = useState("");
  const [date, setDate] = useState("");
  const [existing, setExisting] = useState<{ id: string; items: { id: string; product_id: string | null; quantity: number; unit_price: number }[] } | null>(null);
  const [replaceChoice, setReplaceChoice] = useState<string | null | undefined>(undefined); // undefined = sugestao automatica
  const [enriched, setEnriched] = useState<{ changed: number; created: number; removed: number } | null>(null);

  function begin(r: Receipt, key: string | null) {
    setOverrides({});
    setExisting(null);
    setEnriched(null);
    setReplaceChoice(undefined);
    // nota que ja entrou antes: em vez de recusar, oferece completar nomes e codigos de barras dos produtos
    if (key) void findPurchaseByKey(key).then(setExisting, () => setExisting(null));
    setReceipt({ ...r, key });
    const s = (r.store ?? "").toLowerCase();
    setStore(s.includes("nicolini") ? "Nicolini" : s.includes("peruzzo") ? "Peruzzo" : "");
    setDate(r.date ?? new Date().toISOString().slice(0, 10));
    setDateGuess(!r.date);
  }

  /** PDF do cupom, XML da nota ou texto: descobre pelo nome/tipo do arquivo. */
  async function loadFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setDebug("");
    setFromPdf(false);
    const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
    const isXml = /xml/i.test(file.type) || /\.xml$/i.test(file.name);
    setLoading(true);
    try {
      if (isXml) {
        const parsed = parseNfeXml(await file.text());
        if (!parsed || !parsed.items.length) throw new Error("xml");
        begin(parsed, parsed.key);
      } else {
        const text = isPdf ? await pdfFileToText(file) : await file.text();
        const parsed = parseCupomText(text);
        if (!parsed) throw new Error("texto");
        setFromPdf(isPdf);
        begin(parsed, parsed.key);
      }
    } catch {
      setError(isPdf ? "Não consegui ler esse PDF como um cupom. Use o PDF do cupom fiscal (DANFE NFC-e)." : "Esse arquivo não parece ser um cupom ou o XML de uma nota fiscal com itens.");
    } finally {
      setLoading(false);
    }
  }

  // chegou pelo "Compartilhar" do Android: o service worker guardou o arquivo e abriu /import?shared=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("shared") !== "1") return;
    void takeSharedFile().then((f) => {
      if (f) void loadFile(f);
      else setError("Não chegou nenhum arquivo. Tente compartilhar o cupom de novo.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadText() {
    setError("");
    setDebug("");
    const parsed = parseCupomText(pasted);
    if (!parsed) {
      setError("Não encontrei itens nesse texto. Copie a tela inteira do cupom e cole de novo.");
      return;
    }
    begin(parsed, parsed.key);
  }

  async function load(text: string) {
    const url = receiptUrlOf(text);
    if (!url) {
      setError(MESSAGES.url);
      return;
    }
    setScanning(false);
    setError("");
    setDebug("");
    setCopied(false);
    setLoading(true);
    try {
      const r = await fetchReceipt(url);
      begin(r, accessKeyOf(url));
    } catch (e) {
      const kind = e instanceof ReceiptFetchError ? e.kind : "network";
      setError(MESSAGES[kind]);
      setDebug(e instanceof ReceiptFetchError && e.debug ? e.debug : "");
    } finally {
      setLoading(false);
    }
  }

  const replaceQ = useQuery({ queryKey: ["replaceable", date, store], queryFn: () => findReplaceable(date, store), enabled: !!receipt && !existing && !!date });
  const receiptTotal = (receipt?.items ?? []).reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
  const candidates = useMemo(() => [...(replaceQ.data ?? [])].sort((a, b) => Math.abs(a.total - receiptTotal) - Math.abs(b.total - receiptTotal)), [replaceQ.data, receiptTotal]);
  const replaceId = replaceChoice === undefined ? candidates[0]?.id ?? null : replaceChoice;

  const enrichPlan = useMemo(
    () => (existing && receipt && dataReady && !fromPdf ? planEnrich(receipt.items, existing.items, products, aliases, barcodes) : null),
    [existing, receipt, dataReady, fromPdf, products, aliases, barcodes],
  );
  const enrich = useMutation({
    mutationFn: () => applyEnrich(supabase, enrichPlan!),
    onSuccess: (r) => {
      setEnriched(r);
      for (const k of INVALIDATE) qc.invalidateQueries({ queryKey: [k] });
    },
  });

  // a sugestao e calculada aqui, so quando a nota E o catalogo ja chegaram; o que voce muda fica em `overrides`
  const rows: Row[] = useMemo(
    () =>
      (receipt?.items ?? []).map((it, i) => {
        const m = matchProduct(it.name, products, aliases, it.barcode ?? null, barcodes, it.unit);
        // PDF corta o nome e esconde o tamanho: se o produto sugerido tem um tamanho (340g, 1L) que a nota nao mostra, pede confirmacao
        const unsure = !!m && fromPdf && m.how === "name" && tokens(m.product.name).some((t) => isSizeToken(t) && !tokens(it.name).includes(t));
        const fallback: Choice = m ? { kind: unsure ? "review" : "product", product: m.product } : { kind: "new", name: cleanProductName(it.name, it.unit), sector: guessSector(it.name) };
        return { ...it, suggested: m?.product ?? null, choice: overrides[i] ?? fallback };
      }),
    [receipt, products, aliases, barcodes, overrides, fromPdf],
  );
  const setChoice = (i: number, choice: Choice) => setOverrides((o) => ({ ...o, [i]: choice }));
  const included = rows.filter((r) => r.choice.kind !== "skip");
  const total = included.reduce((s, r) => s + r.quantity * r.unit_price, 0);
  const ready = !!receipt && included.length > 0 && !!date && rows.every((r) => r.choice.kind !== "pick" && r.choice.kind !== "review" && (r.choice.kind !== "new" || r.choice.name.trim() !== ""));

  const run = useMutation({
    mutationFn: () =>
      importReceipt(
        store || null,
        date,
        receipt!.key,
        included.map((r) => {
          const c = r.choice as Exclude<Choice, { kind: "review" }>;
          // item pesado (KG) de produto que se pede em unidade (pao, banana): grava em unidades
          const conv = c.kind === "product" && r.unit === "KG" && c.product.unit_weight_g ? kgToUnits(r.quantity, r.unit_price, Number(c.product.unit_weight_g)) : null;
          const base = { alias: aliasKey(r.name), barcode: r.barcode ?? null, quantity: conv?.quantity ?? r.quantity, unit_price: conv?.unit_price ?? r.unit_price };
          return c.kind === "product" ? { ...base, product_id: c.product.id } : { ...base, new_name: (c as { name: string }).name.trim(), new_sector: (c as { sector: string }).sector, new_unit: unitOf(r.unit) };
        }),
        replaceId,
      ),
    onSuccess: () => {
      for (const k of INVALIDATE) qc.invalidateQueries({ queryKey: [k] });
      navigate("/history");
    },
  });
  const failed = run.error ? ((run.error as Error).message === "duplicate" ? "Esta nota já foi importada antes." : "Não foi possível importar. Tente novamente.") : "";

  return (
    <main>
      <Link to="/history" className="back"><Icon name="arrow-left" size={20} />Histórico</Link>
      <h1>Importar nota fiscal</h1>

      {!receipt && (
        <section className="panel">
          <p>No app do <strong>Cupom Verde</strong> (ou no e-mail do mercado), abra o cupom, toque em <strong>Compartilhar</strong> e escolha <strong>MeuSuper</strong>. Ou escolha o PDF aqui:</p>
          <label className="field file-pick">
            <span>PDF do cupom (ou XML da nota)</span>
            <input type="file" accept=".pdf,application/pdf,.xml,text/xml,application/xml" disabled={!dataReady} onChange={(e) => void loadFile(e.target.files?.[0])} />
          </label>
          {!dataReady && <p className="muted small">Carregando seus produtos…</p>}
          {loading && <p className="muted">Lendo o cupom…</p>}
          {error && <p className="error" role="alert">{error}</p>}
          {debug && (
            <button type="button" className="link" onClick={() => navigator.clipboard.writeText(debug).then(() => setCopied(true), () => setCopied(false))}>
              {copied ? "Diagnóstico copiado. Cole na conversa." : "Copiar diagnóstico da página"}
            </button>
          )}
          <details className="other-ways">
            <summary>Outras formas de importar</summary>
            <button type="button" onClick={() => { setError(""); setScanning(true); }} disabled={loading || !dataReady}><Icon name="camera" size={20} /> Ler o QR Code da nota</button>
            <label className="field">
              <span>Colar o texto do cupom (traz o nome inteiro e o código de barras)</span>
              <small className="muted">Dica: abra todas as seções do cupom (Detalhes, Informações adicionais) antes de copiar, para a data vir junto.</small>
              <textarea rows={4} placeholder="Selecione todo o texto do cupom, copie e cole aqui" value={pasted} onChange={(e) => setPasted(e.target.value)} />
            </label>
            <button type="button" disabled={!pasted.trim() || !dataReady} onClick={loadText}>Ler o texto colado</button>
            <form className="row tight" onSubmit={(e) => { e.preventDefault(); void load(link); }}>
              <label className="field grow"><span>Colar o link da nota</span><input placeholder="https://www.sefaz.rs.gov.br/..." value={link} onChange={(e) => setLink(e.target.value)} /></label>
              <button type="submit" disabled={!link.trim() || loading || !dataReady}>Buscar</button>
            </form>
          </details>
        </section>
      )}

      {receipt && existing && (
        <section className="panel">
          <h2>Esta nota já foi importada</h2>
          {enriched ? (
            <>
              <p role="status">Pronto: {enriched.changed} produtos completados{enriched.created ? `, ${enriched.created} novos criados` : ""}{enriched.removed ? `, ${enriched.removed} repetidos removidos` : ""}.</p>
              <Link to="/products" className="big-btn">Ver produtos</Link>
            </>
          ) : fromPdf ? (
            <>
              <p className="muted">O PDF só traz nomes cortados e sem código de barras, então não dá para completar os produtos com ele. Cole o texto do cupom pelo app do mercado (Outras formas de importar) para completar.</p>
              <Link to="/history" className="big-btn">Voltar ao histórico</Link>
            </>
          ) : !enrichPlan ? (
            <p className="muted">Carregando seus produtos…</p>
          ) : enrichPlan.steps.some((st) => st.changed) ? (
            <>
              <p className="muted small">Com o texto completo do cupom posso completar os nomes cortados, guardar os códigos de barras e corrigir ligações erradas. A compra e os preços continuam como estão.</p>
              <ul className="plain">
                {enrichPlan.steps.filter((st) => st.changed).map((st) => <li key={st.itemId} className="small">{describeStep(st)}</li>)}
              </ul>
              {enrichPlan.unmatched.length > 0 && <p className="muted small">Sem correspondência na compra: {enrichPlan.unmatched.join(", ")}.</p>}
              <button type="button" disabled={enrich.isPending} onClick={() => enrich.mutate()}>{enrich.isPending ? "Completando…" : `Completar ${enrichPlan.steps.filter((st) => st.changed).length} produtos`}</button>
              {enrich.isError && <p className="error" role="alert">Não foi possível completar. Tente novamente.</p>}
            </>
          ) : (
            <>
              <p className="muted">Os produtos desta compra já estão completos.</p>
              <Link to="/history" className="big-btn">Voltar ao histórico</Link>
            </>
          )}
        </section>
      )}

      {receipt && !existing && (
        <>
          {receipt.expectedItems != null && (receipt.parsedLines ?? receipt.items.length) !== receipt.expectedItems && (
            <p className="error" role="alert">
              A nota diz ter {receipt.expectedItems} itens, mas li {receipt.parsedLines ?? receipt.items.length}. Confira a lista antes de importar: pode ter ficado item de fora.
            </p>
          )}
          {fromPdf && (
            <p className="muted small">O PDF traz os nomes cortados em 15 letras e sem código de barras. Confira os produtos novos e complete o nome, se quiser. Depois, colando o texto do mesmo cupom pelo app, eu completo tudo sozinho.</p>
          )}
          <section className="panel">
            <div className="muted small">{receipt.store ?? "Mercado não identificado"}</div>
            <label className="store-pick">Mercado
              <select value={store} onChange={(e) => setStore(e.target.value)}>
                <option value="">Outro / sem mercado</option>
                {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="store-pick">Data <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            {dateGuess && <p className="muted small">A data não veio no texto: coloquei hoje. Corrija se a compra foi em outro dia.</p>}
          </section>

          {candidates.length > 0 && (
            <section className="panel" aria-label="Compra já concluída pela lista">
              <label className="store-pick">Você já concluiu uma lista nesse dia. Este cupom substitui:
                <select value={replaceId ?? ""} onChange={(e) => setReplaceChoice(e.target.value || null)}>
                  {candidates.map((c) => <option key={c.id} value={c.id}>Compra da lista de {fmtDate(c.purchased_at)} · {formatBRL(c.total)}</option>)}
                  <option value="">Não substituir (manter as duas compras)</option>
                </select>
              </label>
              <p className="muted small">Assim o mesmo gasto não entra duas vezes. A compra da lista é trocada pelos itens e preços reais do cupom.</p>
            </section>
          )}

          <ul className="items">
            {rows.map((r, i) => (
              <li key={i} className="edit-row">
                <div className="name">{r.name}<small className="muted"> · {r.quantity} {r.unit.toLowerCase()} × {formatBRL(r.unit_price)}</small>
                  {r.choice.kind === "product" && r.unit === "KG" && r.choice.product.unit_weight_g ? (() => {
                    const c = kgToUnits(r.quantity, r.unit_price, Number(r.choice.product.unit_weight_g));
                    return <small className="muted"> · vira {c.quantity} un × {formatBRL(c.unit_price)}</small>;
                  })() : null}</div>
                <strong>{r.choice.kind === "skip" ? "—" : formatBRL(r.quantity * r.unit_price)}</strong>
                <div className="meta">
                  <select
                    aria-label={`Produto para ${r.name}`}
                    value={r.choice.kind === "product" ? "match" : r.choice.kind}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "match" && r.suggested) setChoice(i, { kind: "product", product: r.suggested });
                      else if (v === "review" && r.suggested) setChoice(i, { kind: "review", product: r.suggested });
                      else if (v === "new") setChoice(i, { kind: "new", name: cleanProductName(r.name, r.unit), sector: guessSector(r.name) });
                      else if (v === "skip") setChoice(i, { kind: "skip" });
                      else setChoice(i, { kind: "pick" });
                    }}
                  >
                    {r.choice.kind === "product" && <option value="match">{r.choice.product.name}</option>}
                    {r.choice.kind === "review" && <option value="review">Confirmar: {r.choice.product.name}</option>}
                    <option value="pick">Escolher outro produto…</option>
                    <option value="new">Criar produto novo</option>
                    <option value="skip">Ignorar este item</option>
                  </select>
                </div>
                {r.choice.kind === "review" && (
                  <div className="pick review">
                    <p className="small">O PDF corta o nome e não mostra o tamanho. É o produto <strong>{r.choice.product.name}</strong>?</p>
                    <div className="row tight">
                      <button type="button" onClick={() => setChoice(i, { kind: "product", product: (r.choice as { product: Product }).product })}>Sim, é esse</button>
                      <button type="button" onClick={() => setChoice(i, { kind: "new", name: cleanProductName(r.name, r.unit), sector: guessSector(r.name) })}>Não, é outro</button>
                    </div>
                  </div>
                )}
                {r.choice.kind === "pick" && <div className="pick"><ProductSearch onPick={(p) => setChoice(i, { kind: "product", product: p })} /></div>}
                {r.choice.kind === "new" && (
                  <div className="pick new-product">
                    <input value={r.choice.name} onChange={(e) => setChoice(i, { ...(r.choice as { kind: "new"; sector: string }), kind: "new", name: e.target.value })} aria-label="Nome do produto novo" />
                    <select value={r.choice.sector} onChange={(e) => setChoice(i, { kind: "new", name: (r.choice as { name: string }).name, sector: e.target.value })} aria-label="Setor do produto novo">
                      {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
                    </select>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="finish-bar">
            <button type="button" disabled={!ready || run.isPending} onClick={() => run.mutate()}>
              {run.isPending ? "Importando…" : `Importar compra · ${formatBRL(total)}`}
            </button>
            {failed && <p className="error">{failed}</p>}
          </div>
        </>
      )}

      {scanning && <BarcodeScanner kind="qr" notice="" onCode={(c) => void load(c)} onClose={() => setScanning(false)} />}
    </main>
  );
}
