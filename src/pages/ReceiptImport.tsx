import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BarcodeScanner from "../components/BarcodeScanner";
import ProductSearch from "../components/ProductSearch";
import { accessKeyOf, aliasKey, matchProduct, receiptUrlOf, type Receipt } from "../lib/nfce";
import { SECTORS } from "../lib/sectors";
import { STORES } from "../lib/stores";
import { formatBRL } from "../lib/format";
import { fetchReceipt, getAliases, getBarcodes, importReceipt, ReceiptFetchError, type ReceiptError } from "../services/receipt";
import { parseNfeXml } from "../lib/nfe";
import { parseCupomText } from "../lib/cupom";
import { listProducts } from "../services/products";
import type { Product } from "../types/db";
import Icon from "../components/Icon";

type Choice = { kind: "product"; product: Product } | { kind: "new"; name: string; sector: string } | { kind: "skip" } | { kind: "pick" };
interface Row { name: string; quantity: number; unit: string; unit_price: number; barcode?: string | null; choice: Choice; suggested: Product | null }

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
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
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<(Receipt & { key: string | null }) | null>(null);
  const [overrides, setOverrides] = useState<Record<number, Choice>>({});
  const [store, setStore] = useState("");
  const [date, setDate] = useState("");

  function begin(r: Receipt, key: string | null) {
    setOverrides({});
    setReceipt({ ...r, key });
    const s = (r.store ?? "").toLowerCase();
    setStore(s.includes("nicolini") ? "Nicolini" : s.includes("peruzzo") ? "Peruzzo" : "");
    setDate(r.date ?? new Date().toISOString().slice(0, 10));
  }

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

  async function loadXml(file: File | undefined) {
    if (!file) return;
    setError("");
    setDebug("");
    const parsed = parseNfeXml(await file.text());
    if (!parsed || !parsed.items.length) {
      setError("Esse arquivo não parece ser o XML de uma nota fiscal com itens.");
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

  // a sugestao e calculada aqui, so quando a nota E o catalogo ja chegaram; o que voce muda fica em `overrides`
  const rows: Row[] = useMemo(
    () =>
      (receipt?.items ?? []).map((it, i) => {
        const m = matchProduct(it.name, products, aliases, it.barcode ?? null, barcodes);
        const fallback: Choice = m ? { kind: "product", product: m.product } : { kind: "new", name: titleCase(it.name), sector: "outros" };
        return { ...it, suggested: m?.product ?? null, choice: overrides[i] ?? fallback };
      }),
    [receipt, products, aliases, barcodes, overrides],
  );
  const setChoice = (i: number, choice: Choice) => setOverrides((o) => ({ ...o, [i]: choice }));
  const included = rows.filter((r) => r.choice.kind !== "skip");
  const total = included.reduce((s, r) => s + r.quantity * r.unit_price, 0);
  const ready = !!receipt && included.length > 0 && !!date && rows.every((r) => r.choice.kind !== "pick" && (r.choice.kind !== "new" || r.choice.name.trim() !== ""));

  const run = useMutation({
    mutationFn: () =>
      importReceipt(
        store || null,
        date,
        receipt!.key,
        included.map((r) => {
          const base = { alias: aliasKey(r.name), barcode: r.barcode ?? null, quantity: r.quantity, unit_price: r.unit_price };
          const c = r.choice;
          return c.kind === "product" ? { ...base, product_id: c.product.id } : { ...base, new_name: (c as { name: string }).name.trim(), new_sector: (c as { sector: string }).sector, new_unit: unitOf(r.unit) };
        }),
      ),
    onSuccess: () => {
      for (const k of ["purchases", "products", "last-prices", "aliases", "barcodes", "month", "purchases-in", "series", "sold", "latest-purchase", "frequent"]) qc.invalidateQueries({ queryKey: [k] });
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
          <p className="muted small">Leia o QR Code da nota fiscal (NFC-e) do mercado. Os itens e preços entram como uma compra.</p>
          <button type="button" className="primary" onClick={() => { setError(""); setScanning(true); }} disabled={loading || !dataReady}><Icon name="camera" size={20} /> Ler QR Code da nota</button>
          <label className="field">
            <span>Arquivo XML da nota (anexo do e-mail do cupom)</span>
            <input type="file" accept=".xml,text/xml,application/xml" disabled={!dataReady} onChange={(e) => void loadXml(e.target.files?.[0])} />
          </label>
          <label className="field">
            <span>Ou cole o texto do cupom (tela da SEFAZ ou do app do mercado)</span>
            <textarea rows={4} placeholder="Selecione todo o texto do cupom, copie e cole aqui" value={pasted} onChange={(e) => setPasted(e.target.value)} />
          </label>
          <button type="button" className="primary" disabled={!pasted.trim() || !dataReady} onClick={loadText}>Ler o texto colado</button>
          <form className="row tight" onSubmit={(e) => { e.preventDefault(); void load(link); }}>
            <label className="field grow"><span>Ou cole o link da nota</span><input placeholder="https://www.sefaz.rs.gov.br/..." value={link} onChange={(e) => setLink(e.target.value)} /></label>
            <button type="submit" disabled={!link.trim() || loading || !dataReady}>Buscar</button>
          </form>
          {!dataReady && <p className="muted small">Carregando seus produtos…</p>}
          {loading && <p className="muted">Buscando a nota…</p>}
          {error && <p className="error" role="alert">{error}</p>}
          {debug && (
            <button type="button" className="link" onClick={() => navigator.clipboard.writeText(debug).then(() => setCopied(true), () => setCopied(false))}>
              {copied ? "Diagnóstico copiado. Cole na conversa." : "Copiar diagnóstico da página"}
            </button>
          )}
        </section>
      )}

      {receipt && (
        <>
          {receipt.expectedItems != null && (receipt.parsedLines ?? receipt.items.length) !== receipt.expectedItems && (
            <p className="error" role="alert">
              A nota diz ter {receipt.expectedItems} itens, mas li {receipt.parsedLines ?? receipt.items.length}. Confira a lista antes de importar: pode ter ficado item de fora.
            </p>
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
          </section>

          <ul className="items">
            {rows.map((r, i) => (
              <li key={i} className="edit-row">
                <div className="name">{r.name}<small className="muted"> · {r.quantity} {r.unit.toLowerCase()} × {formatBRL(r.unit_price)}</small></div>
                <strong>{r.choice.kind === "skip" ? "—" : formatBRL(r.quantity * r.unit_price)}</strong>
                <div className="meta">
                  <select
                    aria-label={`Produto para ${r.name}`}
                    value={r.choice.kind === "product" ? "match" : r.choice.kind}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "match" && r.suggested) setChoice(i, { kind: "product", product: r.suggested });
                      else if (v === "new") setChoice(i, { kind: "new", name: titleCase(r.name), sector: "outros" });
                      else if (v === "skip") setChoice(i, { kind: "skip" });
                      else setChoice(i, { kind: "pick" });
                    }}
                  >
                    {r.choice.kind === "product" && <option value="match">{r.choice.product.name}</option>}
                    <option value="pick">Escolher outro produto…</option>
                    <option value="new">Criar produto novo</option>
                    <option value="skip">Ignorar este item</option>
                  </select>
                </div>
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
