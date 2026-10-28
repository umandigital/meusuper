import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPurchaseItems, getPurchases, type PurchaseRow } from "../services/purchases";
import { formatBRL } from "../lib/format";

const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

export default function History() {
  const { data: purchases = [], isLoading } = useQuery({ queryKey: ["purchases"], queryFn: getPurchases });
  return (
    <main>
      <h1>Histórico</h1>
      {isLoading && <p className="muted">Carregando…</p>}
      {!isLoading && !purchases.length && <p className="muted">Nenhuma compra ainda. Finalize uma lista para ela aparecer aqui.</p>}
      <ul className="cards">
        {purchases.map((p) => <PurchaseCard key={p.id} p={p} />)}
      </ul>
    </main>
  );
}

function PurchaseCard({ p }: { p: PurchaseRow }) {
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useQuery({ queryKey: ["purchase-items", p.id], queryFn: () => getPurchaseItems(p.id), enabled: open });
  return (
    <li className="purchase">
      <button type="button" className="purchase-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="grow">
          <strong>{fmtDate(p.purchased_at)}</strong>
          <small>{p.store?.name ?? "Sem mercado"}</small>
        </span>
        <strong>{formatBRL(Number(p.total))}</strong>
      </button>
      {open && (
        <ul className="purchase-items">
          {items.map((i) => (
            <li key={i.id}>
              <span className="grow">{i.product?.name ?? "Produto removido"}{i.brand && <small> · {i.brand.name}</small>}</span>
              <span>{i.quantity} × {formatBRL(Number(i.unit_price))}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
