import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deletePurchase, getPurchaseItems, getPurchases, repeatPurchase, type PurchaseRow } from "../services/purchases";
import { formatBRL } from "../lib/format";
import Icon from "../components/Icon";

const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

export default function History() {
  const { data: purchases = [], isLoading } = useQuery({ queryKey: ["purchases"], queryFn: getPurchases });
  return (
    <main>
      <h1>Histórico</h1>
      <Link to="/import" className="link"><Icon name="receipt" size={20} />Importar nota fiscal</Link>
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
  const qc = useQueryClient();
  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: () => deletePurchase(p.id),
    onSuccess: () => {
      for (const k of ["purchases", "prices", "last-prices", "product-prices", "month", "purchases-in", "series", "sold"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });
  const repeat = useMutation({
    mutationFn: () => repeatPurchase(p.id),
    onSuccess: (listId) => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      navigate(`/lists/${listId}`);
    },
  });
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
      {open && (
        <div className="purchase-actions">
          <button type="button" onClick={() => repeat.mutate()} disabled={repeat.isPending}><Icon name="repeat" size={18} />Repetir</button>
          <Link to={`/history/${p.id}`}><Icon name="edit" size={18} />Editar</Link>
          <button
            type="button"
            className="danger-text"
            disabled={remove.isPending}
            onClick={() => confirm(`Excluir a compra de ${fmtDate(p.purchased_at)} (${formatBRL(Number(p.total))})?\nOs preços dela também saem do histórico de preços.`) && remove.mutate()}
          >
            <Icon name="trash" size={18} />Excluir
          </button>
        </div>
      )}
      {(repeat.isError || remove.isError) && <p className="error" style={{ padding: "0 16px 12px" }}>Não foi possível concluir. Tente novamente.</p>}
    </li>
  );
}
