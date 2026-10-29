import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPurchase, updatePurchase } from "../services/purchases";
import { STORES, type StoreName } from "../lib/stores";
import { formatBRL } from "../lib/format";
import Icon from "../components/Icon";

interface Row { id: string; name: string; brand: string | null; qty: string; price: string }

const num = (s: string) => Number(s.replace(",", "."));
const show = (n: number) => String(n).replace(".", ",");

export default function PurchaseEdit() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: purchase } = useQuery({ queryKey: ["purchase", id], queryFn: () => getPurchase(id) });

  const [date, setDate] = useState("");
  const [store, setStore] = useState<StoreName | "">("");
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!purchase) return;
    setDate(purchase.purchased_at);
    setStore((STORES as readonly string[]).includes(purchase.store?.name ?? "") ? (purchase.store!.name as StoreName) : "");
    setRows(purchase.items.map((i) => ({ id: i.id, name: i.product?.name ?? "Produto removido", brand: i.brand?.name ?? null, qty: show(Number(i.quantity)), price: show(Number(i.unit_price)) })));
  }, [purchase]);

  const valid = !!date && rows.every((r) => num(r.qty) > 0 && num(r.price) >= 0 && r.price.trim() !== "");
  const total = rows.reduce((s, r) => s + (num(r.qty) || 0) * (num(r.price) || 0), 0);

  const save = useMutation({
    mutationFn: () => updatePurchase(id, date, store || null, rows.map((r) => ({ id: r.id, quantity: num(r.qty), unit_price: num(r.price) }))),
    onSuccess: () => {
      for (const k of ["purchases", "purchase", "purchase-items", "prices", "last-prices", "product-prices", "month", "purchases-in", "series", "sold"]) qc.invalidateQueries({ queryKey: [k] });
      navigate("/history");
    },
  });

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  if (!purchase) return <main><Link to="/history" className="back"><Icon name="arrow-left" size={20} />Histórico</Link></main>;

  return (
    <main>
      <Link to="/history" className="back"><Icon name="arrow-left" size={20} />Histórico</Link>
      <h1>Editar compra</h1>

      <section className="panel">
        <label className="store-pick">Data <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="store-pick">
          Mercado
          <select value={store} onChange={(e) => setStore(e.target.value as StoreName | "")}>
            <option value="">Sem mercado</option>
            {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </section>

      <ul className="items">
        {rows.map((r, i) => (
          <li key={r.id} className="edit-row">
            <div className="name">{r.name}{r.brand && <small className="muted"> · {r.brand}</small>}</div>
            <button type="button" className="ghost" aria-label={`Remover ${r.name}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}><Icon name="x" size={20} /></button>
            <div className="meta">
              <label>Qtd <input inputMode="decimal" value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} aria-label={`Quantidade de ${r.name}`} /></label>
              <label>Preço (R$) <input inputMode="decimal" value={r.price} onChange={(e) => set(i, { price: e.target.value })} aria-label={`Preço de ${r.name}`} /></label>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length && <p className="muted">Todos os itens foram removidos. Salvar deixa a compra com total R$ 0,00.</p>}

      <div className="finish-bar">
        <button type="button" onClick={() => save.mutate()} disabled={!valid || save.isPending}>
          {save.isPending ? "Salvando…" : `Salvar · ${formatBRL(total)}`}
        </button>
        {save.isError && <p className="error">Não foi possível salvar. Tente novamente.</p>}
      </div>
    </main>
  );
}
