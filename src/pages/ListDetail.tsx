import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ProductSearch from "../components/ProductSearch";
import BarcodeScanner from "../components/BarcodeScanner";
import NewCodeSheet, { type NewCodeResult } from "../components/NewCodeSheet";
import { createBrand, findOrCreateBrand, listBrands } from "../services/catalog";
import { findByBarcode, saveBarcode } from "../services/barcode";
import { addItem, getList, getListItems, getPrices, removeItem, setListStore, updateItem, type ListItemWithProduct } from "../services/lists";
import { finishPurchase } from "../services/purchases";
import { estimateUnitPrice, summarize } from "../lib/estimate";
import { formatBRL } from "../lib/format";
import { SECTORS } from "../lib/sectors";
import { STORES, type StoreName } from "../lib/stores";
import type { Price } from "../types/db";

const NEW_BRAND = "__new__";

export default function ListDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const refresh = () => qc.invalidateQueries({ queryKey: ["items", id] });

  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState("");
  const [unknownCode, setUnknownCode] = useState<string | null>(null);

  const { data: list } = useQuery({ queryKey: ["list", id], queryFn: () => getList(id) });
  const { data: items = [] } = useQuery({ queryKey: ["items", id], queryFn: () => getListItems(id) });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const productIds = useMemo(() => [...new Set(items.map((i) => i.product_id))], [items]);
  const { data: prices = [] } = useQuery({ queryKey: ["prices", productIds], queryFn: () => getPrices(productIds), enabled: productIds.length > 0 });

  // o leitor chama estas funcoes de dentro de um callback: precisam enxergar sempre o estado atual
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const noticeTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
  const flash = (msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 3000);
  };

  const add = useMutation({ mutationFn: (productId: string) => addItem(id, productId), onSuccess: refresh });
  // atualiza a tela na hora (no mercado a internet oscila) e desfaz se o servidor recusar
  const patch = useMutation({
    mutationFn: (a: { id: string; p: Parameters<typeof updateItem>[1] }) => updateItem(a.id, a.p),
    onMutate: async (a) => {
      await qc.cancelQueries({ queryKey: ["items", id] });
      const previous = qc.getQueryData<ListItemWithProduct[]>(["items", id]);
      qc.setQueryData<ListItemWithProduct[]>(["items", id], (old) => old?.map((i) => (i.id === a.id ? { ...i, ...a.p } : i)));
      return { previous };
    },
    onError: (_err, _a, ctx) => {
      if (ctx?.previous) qc.setQueryData(["items", id], ctx.previous);
    },
    onSettled: refresh,
  });
  const del = useMutation({ mutationFn: removeItem, onSuccess: refresh });
  const changeStore = useMutation({ mutationFn: (s: StoreName) => setListStore(id, s), onSuccess: () => qc.invalidateQueries({ queryKey: ["list", id] }) });

  const totals = summarize(items.map((i) => ({ product: i.product, brandId: i.brand_id, quantity: i.quantity })), prices);

  const unitFor = (i: ListItemWithProduct) => i.paid_price ?? estimateUnitPrice(i.product, i.brand_id, prices).unit;
  const inCart = items.filter((i) => i.checked);
  const cartTotal = inCart.reduce((sum, i) => sum + unitFor(i) * i.quantity, 0);

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

  /**
   * Poe o produto no carrinho: marca o item da lista se ele ja esta la; se ja estava no carrinho
   * (escaneou de novo), soma uma unidade; senao cria um item novo.
   */
  async function putInCart(productId: string, brandId: string | null): Promise<string> {
    const same = itemsRef.current.filter((i) => i.product_id === productId);
    const pending = same.find((i) => !i.checked);
    if (pending) {
      await updateItem(pending.id, { checked: true, brand_id: brandId ?? pending.brand_id });
      refresh();
      return pending.id;
    }
    const inCartAlready = same.find((i) => i.brand_id === brandId);
    if (inCartAlready) {
      await updateItem(inCartAlready.id, { quantity: Number(inCartAlready.quantity) + 1 });
      refresh();
      return inCartAlready.id;
    }
    const newId = await addItem(id, productId, brandId, true);
    refresh();
    return newId;
  }

  async function handleCode(code: string) {
    try {
      const match = await findByBarcode(code);
      if (!match) {
        setScanning(false);
        setUnknownCode(code);
        return;
      }
      await putInCart(match.product.id, match.brand?.id ?? null);
      flash(`✓ ${match.product.name}${match.brand ? ` · ${match.brand.name}` : ""}`);
    } catch {
      flash("Não consegui registrar este código. Tente de novo.");
    }
  }

  async function saveNewCode(r: NewCodeResult) {
    if (!unknownCode) return;
    try {
      const brand = r.brandName ? await findOrCreateBrand(r.brandName) : null;
      await saveBarcode(unknownCode, r.product.id, brand?.id ?? null);
      const itemId = await putInCart(r.product.id, brand?.id ?? null);
      if (r.price != null) await updateItem(itemId, { paid_price: r.price });
      qc.invalidateQueries({ queryKey: ["brands"] });
      refresh();
      setUnknownCode(null);
    } catch {
      flash("Não foi possível salvar o código.");
    }
  }

  const finish = useMutation({
    mutationFn: () =>
      finishPurchase(
        id,
        inCart.map((i) => ({
          product_id: i.product_id,
          brand_id: i.brand_id,
          quantity: i.quantity,
          unit_price: unitFor(i),
          record_price: i.paid_price != null,
        })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["prices"] });
      navigate("/history");
    },
  });

  function confirmFinish() {
    const left = items.length - inCart.length;
    const msg = `Finalizar a compra de ${formatBRL(cartTotal)} (${inCart.length} itens)?${left ? `\n${left} item(ns) não marcado(s) ficam de fora.` : ""}`;
    if (confirm(msg)) finish.mutate();
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
            <div className="muted">estimado, entre {formatBRL(totals.low)} e {formatBRL(totals.high)}</div>
            <div className="muted small">
              {totals.fresh} de {totals.items} itens com preço recente
              {totals.withoutPrice > 0 && ` · ${totals.withoutPrice} sem preço`}
            </div>
          </>
        )}
        {inCart.length > 0 && (
          <div className="cart">🛒 No carrinho: <strong>{formatBRL(cartTotal)}</strong> ({inCart.length} de {items.length})</div>
        )}
      </section>

      <div className="search-row">
        <ProductSearch onPick={(p) => add.mutate(p.id)} />
        <button type="button" className="scan-btn" onClick={() => setScanning(true)} aria-label="Escanear código de barras">📷</button>
      </div>

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
                onPaid={(v) => patch.mutate({ id: item.id, p: { paid_price: v } })}
                onRemove={() => del.mutate(item.id)}
              />
            ))}
          </ul>
        </section>
      ))}

      {inCart.length > 0 && (
        <div className="finish-bar">
          <button type="button" onClick={confirmFinish} disabled={finish.isPending}>
            {finish.isPending ? "Salvando…" : `Finalizar compra · ${formatBRL(cartTotal)}`}
          </button>
          {finish.isError && <p className="error">Não foi possível finalizar. Tente novamente.</p>}
        </div>
      )}

      {scanning && <BarcodeScanner onCode={handleCode} onClose={() => setScanning(false)} notice={notice} />}
      {unknownCode && <NewCodeSheet code={unknownCode} brands={brands} onSave={saveNewCode} onCancel={() => setUnknownCode(null)} />}
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
  onPaid: (v: number | null) => void;
  onRemove: () => void;
}) {
  const { item, prices, brands } = props;
  const e = estimateUnitPrice(item.product, item.brand_id, prices);
  const unit = item.paid_price ?? e.unit;
  const step = item.product.unit === "kg" || item.product.unit === "l" ? 0.5 : 1;
  const hint =
    item.paid_price != null ? "preço pago" : e.source === "none" ? "sem preço" : e.source === "reference" ? "estimado" : e.fresh ? "" : "preço antigo";

  function commitPaid(raw: string) {
    const text = raw.trim();
    if (!text) return props.onPaid(null);
    const v = Number(text.replace(",", "."));
    if (v >= 0) props.onPaid(v);
  }

  return (
    <li className={item.checked ? "done" : ""}>
      <input type="checkbox" checked={item.checked} onChange={(ev) => props.onCheck(ev.target.checked)} aria-label={`Marcar ${item.product.name}`} />
      <div className="name">{item.product.name}</div>
      <div className="price">
        <strong>{formatBRL(unit * item.quantity)}</strong>
        {hint && <small className={e.source === "none" && item.paid_price == null ? "warn" : ""}>{hint}</small>}
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
      {item.checked && (
        <div className="paid">
          <label>
            Preço na prateleira (un)
            <input
              key={`${item.id}-${item.paid_price}`}
              inputMode="decimal"
              placeholder={e.unit ? e.unit.toFixed(2).replace(".", ",") : "0,00"}
              defaultValue={item.paid_price != null ? String(item.paid_price).replace(".", ",") : ""}
              onBlur={(ev) => commitPaid(ev.target.value)}
            />
          </label>
        </div>
      )}
    </li>
  );
}
