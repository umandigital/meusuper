import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BarcodeScanner from "../components/BarcodeScanner";
import ProductSearch from "../components/ProductSearch";
import { accessKeyOf, aliasKey, matchProduct, receiptUrlOf, type Receipt } from "../lib/nfce";
import { SECTORS } from "../lib/sectors";
import { STORES } from "../lib/stores";
import { formatBRL } from "../lib/format";
import { fetchReceipt, getAliases, importReceipt, type ReceiptError } from "../services/receipt";
import { listProducts } from "../services/products";
import type { Product } from "../types/db";

type Choice = { kind: "product"; product: Product } | { kind: "new"; name: string; sector: string } | { kind: "skip" } | { kind: "pick" };
interface Row { name: string; quantity: number; unit: string; unit_price: number; choice: Choice; suggested: Product | null }

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
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const { data: aliases = new Map<string, string>() } = useQuery({ queryKey: ["aliases"], queryFn: getAliases });

  const [scanning, setScanning] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<(Receipt & { key: string | null }) | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [store, setStore] = useState("");
  const [date, setDate] = useState("");

  async function load(text: string) {
    const url = receiptUrlOf(text);
    if (!url) {
      setError(MESSAGES.url);
      return;
    }
    setScanning(false);
    setError("");
    setLoading(true);
    try {
      const r = await fetchReceipt(url);
      setReceipt({ ...r, key: accessKeyOf(url) });
      setRows(
        r.items.map((i) => {
          const m = matchProduct(i.name, products, aliases);
          return {
            ...i,
            suggested: m?.product ?? null,
            choice: m ? { kind: "product", product: m.product } : { kind: "new", name: titleCase(i.name), sector: "outros" },
          };
        }),
      );
      const s = (r.store ?? "").toLowerCase();
      setStore(s.includes("nicolini") ? "Nicolini" : s.includes("peruzzo") ? "Peruzzo" : "");
      setDate(r.date ?? new Date().toISOString().slice(0, 10));
    } catch (e) {
      setError(MESSAGES[(e as Error).message as ReceiptError] ?? MESSAGES.network);
    } finally {
      setLoading(false);
    }
  }

  const setChoice = (i: number, choice: Choice) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, choice } : r)));
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
          const base = { alias: aliasKey(r.name), quantity: r.quantity, unit_price: r.unit_price };
          const c = r.choice;
          return c.kind === "product" ? { ...base, product_id: c.product.id } : { ...base, new_name: (c as { name: string }).name.trim(), new_sector: (c as { sector: string }).sector, new_unit: unitOf(r.unit) };
        }),
      ),
    onSuccess: () => {
      for (const k of ["purchases", "products", "last-prices", "aliases", "month", "purchases-in", "series", "sold", "latest-purchase", "frequent"]) qc.invalidateQueries({ queryKey: [k] });
      navigate("/history");
    },
  });
  const failed = run.error ? ((run.error as Error).message === "duplicate" ? "Esta nota já foi importada antes." : "Não foi possível importar. Tente novamente.") : "";

  return (
    <main>
      <Link to="/history" className="back">← Histórico</Link>
      <h1>Importar nota fiscal</h1>

      {!receipt && (
        <section className="panel">
          <p className="muted small">Leia o QR Code da nota fiscal (NFC-e) do mercado. Os itens e preços entram como uma compra.</p>
          <button type="button" className="primary" onClick={() => { setError(""); setScanning(true); }} disabled={loading}>📷 Ler QR Code da nota</button>
          <form className="row tight" onSubmit={(e) => { e.preventDefault(); void load(link); }}>
            <input placeholder="ou cole o link da nota" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Link da nota" />
            <button type="submit" disabled={!link.trim() || loading}>Buscar</button>
          </form>
          {loading && <p className="muted">Buscando a nota…</p>}
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {receipt && (
        <>
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
