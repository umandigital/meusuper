import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ProductSearch from "../components/ProductSearch";
import { createBrand, listBrands } from "../services/catalog";
import { addItem, getList, setListStore, getListItems, getPrices, removeItem, updateItem, type ListItemWithProduct } from "../services/lists";
import { estimateUnitPrice, summarize } from "../lib/estimate";
import { formatBRL } from "../lib/format";
import { SECTORS } from "../lib/sectors";
import { STORES, type StoreName } from "../lib/stores";
import type { Price } from "../types/db";

const NEW_BRAND = "__new__";

export default function ListDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["items", id] });

  const { data: list } = useQuery({ queryKey: ["list", id], queryFn: () => getList(id) });
  const { data: items = [] } = useQuery({ queryKey: ["items", id], queryFn: () => getListItems(id) });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const productIds = useMemo(() => [...new Set(items.map((i) => i.product_id))], [items]);
  const { data: prices = [] } = useQuery({ queryKey: ["prices", productIds], queryFn: () => getPrices(productIds), enabled: productIds.length > 0 });

  const add = useMutation({ mutationFn: (productId: string) => addItem(id, productId), onSuccess: refresh });
  const patch = useMutation({ mutationFn: (a: { id: string; p: Parameters<typeof updateItem>[1] }) => updateItem(a.id, a.p), onSuccess: refresh });
  const del = useMutation({ mutationFn: removeItem, onSuccess: refresh });
  const changeStore = useMutation({ mutationFn: (s: StoreName) => setListStore(id, s), onSuccess: () => qc.invalidateQueries({ queryKey: ["list", id] }) });

  const totals = summarize(items.map((i) => ({ product: i.product, brandId: i.brand_id, quantity: i.quantity })), prices);

  async function changeBrand(item: ListItemWithProduct, value: string) {
    if (value === NEW_BRAND) {
      const name = prompt("Nome da marca");
      if (!name?.trim()) return;
      const brand = await createBrand(name);
      qc.invalidateQueries({ queryKey: ["brands"] });
      patch.mutate({ id: item.id, p: { brand_id: brand.id } });
    } else {
      patch.mutate({ id: item.id, p: { brand_id: value || null } });
    }
  }

  const bySector = SECTORS.map((s) => ({ sector: s, items: items.filter((i) => i.product.sector === s.value) })).filter((g) => g.items.length);

  return (
    <main>
      <Link to="/lists" className="back">← Listas</Link>
      <h1>{list?.name}</h1>
      <label className="store-pick">
        Mercado
        <select value={list?.store ?? ""} onChange={(e) => changeStore.mutate(e.target.value as StoreName)}>
          {!list?.store && <option value="" disabled>Escolha…</option>}
          {STORES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <section className="summary">
        <div className="total">{formatBRL(totals.total)}</div>
        {totals.items > 0 && (
          <>
            <div className="muted">entre {formatBRL(totals.low)} e {formatBRL(totals.high)}</div>
            <div className="muted small">
              {totals.fresh} de {totals.items} itens com preço recente
              {totals.withoutPrice > 0 && ` · ${totals.withoutPrice} sem preço`}
            </div>
          </>
        )}
      </section>

      <ProductSearch onPick={(p) => add.mutate(p.id)} />

      {!items.length && <p className="muted">Adicione itens usando o campo acima.</p>}

      {bySector.map(({ sector, items: group }) => (
        <section key={sector.value}>
          <h2 className="sector">{sector.emoji} {sector.label}</h2>
          <ul className="items">
            {group.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                prices={prices}
                brands={brands}
                onBrand={(v) => changeBrand(item, v)}
                onQty={(q) => q > 0 && patch.mutate({ id: item.id, p: { quantity: q } })}
                onCheck={(c) => patch.mutate({ id: item.id, p: { checked: c } })}
                onRemove={() => del.mutate(item.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function ItemRow(props: {
  item: ListItemWithProduct;
  prices: Price[];
  brands: { id: string; name: string }[];
  onBrand: (value: string) => void;
  onQty: (q: number) => void;
  onCheck: (c: boolean) => void;
  onRemove: () => void;
}) {
  const { item, prices, brands } = props;
  const e = estimateUnitPrice(item.product, item.brand_id, prices);
  const step = item.product.unit === "kg" || item.product.unit === "l" ? 0.5 : 1;
  const hint =
    e.source === "none" ? "sem preço" : e.source === "reference" ? "estimado" : e.fresh ? "" : "preço antigo";

  return (
    <li className={item.checked ? "done" : ""}>
      <input type="checkbox" checked={item.checked} onChange={(ev) => props.onCheck(ev.target.checked)} aria-label={`Marcar ${item.product.name}`} />
      <div className="name">{item.product.name}</div>
      <div className="price">
        <strong>{formatBRL(e.unit * item.quantity)}</strong>
        {hint && <small className={e.source === "none" ? "warn" : ""}>{hint}</small>}
      </div>
      <button type="button" className="ghost" onClick={props.onRemove} aria-label="Remover">✕</button>
      <div className="meta">
        <select value={item.brand_id ?? ""} onChange={(ev) => props.onBrand(ev.target.value)} aria-label="Marca">
          <option value="">Qualquer marca</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
          <option value={NEW_BRAND}>＋ Nova marca…</option>
        </select>
        <div className="qty">
          <button type="button" onClick={() => props.onQty(item.quantity - step)} aria-label="Menos">−</button>
          <span>{item.quantity}{item.product.unit === "kg" ? "kg" : item.product.unit === "l" ? "L" : ""}</span>
          <button type="button" onClick={() => props.onQty(item.quantity + step)} aria-label="Mais">+</button>
        </div>
      </div>
    </li>
  );
}
