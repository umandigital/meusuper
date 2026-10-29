import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deletePrice, deleteProduct, deleteProductBrand, getProduct, getProductBrands, getProductPrices, updateProduct,
} from "../services/products";
import { SECTORS } from "../lib/sectors";
import { UNITS, unitSuffix } from "../lib/units";
import { formatBRL } from "../lib/format";
import type { Unit } from "../types/db";
import Icon from "../components/Icon";

const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

export default function ProductDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: product } = useQuery({ queryKey: ["product", id], queryFn: () => getProduct(id) });
  const { data: brands = [] } = useQuery({ queryKey: ["product-brands", id], queryFn: () => getProductBrands(id) });
  const { data: prices = [] } = useQuery({ queryKey: ["product-prices", id], queryFn: () => getProductPrices(id) });

  const [name, setName] = useState("");
  const [sector, setSector] = useState("outros");
  const [unit, setUnit] = useState<Unit>("un");
  useEffect(() => {
    if (product) {
      setName(product.name);
      setSector(product.sector);
      setUnit(product.unit);
    }
  }, [product]);

  const mine = !!product?.user_id;
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["product", id] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["last-prices"] });
    qc.invalidateQueries({ queryKey: ["product-prices", id] });
    qc.invalidateQueries({ queryKey: ["product-brands", id] });
  };

  const save = useMutation({ mutationFn: () => updateProduct(id, { name, sector, unit }), onSuccess: refreshAll });
  const remove = useMutation({
    mutationFn: () => deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate("/products");
    },
  });
  const dropPrice = useMutation({ mutationFn: deletePrice, onSuccess: refreshAll });
  const dropCode = useMutation({ mutationFn: deleteProductBrand, onSuccess: refreshAll });

  if (!product) return <main><Link to="/products" className="back"><Icon name="arrow-left" size={20} />Produtos</Link></main>;

  const dirty = name.trim() !== product.name || sector !== product.sector || unit !== product.unit;

  return (
    <main>
      <Link to="/products" className="back"><Icon name="arrow-left" size={20} />Produtos</Link>
      <h1>{product.name}</h1>

      {mine ? (
        <form
          className="sheet-inline"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && dirty) save.mutate();
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome" />
          <select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Setor">
            {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
          </select>
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="Unidade">
            {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
          <button type="submit" disabled={!dirty || save.isPending}>Salvar alterações</button>
          {save.isError && <p className="error">Não foi possível salvar (talvez o nome já exista).</p>}
        </form>
      ) : (
        <p className="muted">
          Produto do catálogo base: {SECTORS.find((s) => s.value === product.sector)?.label} · {UNITS.find((u) => u.value === product.unit)?.label}
          {product.reference_price != null && ` · preço de referência ${formatBRL(Number(product.reference_price))}${unitSuffix(product.unit)} (estimado)`}
          . Ele não pode ser editado, mas você pode usar à vontade e cadastrar marcas e preços.
        </p>
      )}

      <h2 className="sector">Marcas e códigos de barras</h2>
      {!brands.length && <p className="muted small">Nenhum código cadastrado. Ele é salvo quando você escaneia um produto novo na lista.</p>}
      <ul className="plain">
        {brands.map((b) => (
          <li key={b.id}>
            <span className="grow">
              <strong>{b.brand?.name ?? "Sem marca"}</strong>
              {b.barcode && <small> · {b.barcode}</small>}
            </span>
            <button
              type="button"
              className="ghost"
              aria-label="Remover código"
              onClick={() => confirm("Remover este código de barras? O produto continua cadastrado.") && dropCode.mutate(b.id)}
            >
              <Icon name="x" size={20} />
            </button>
          </li>
        ))}
      </ul>

      <h2 className="sector">Histórico de preços</h2>
      {!prices.length && <p className="muted small">Ainda sem preços pagos. Eles entram quando você finaliza uma compra com o preço da prateleira preenchido.</p>}
      <ul className="plain">
        {prices.map((p) => (
          <li key={p.id}>
            <span className="grow">
              <strong>{formatBRL(Number(p.price))}{unitSuffix(product.unit)}</strong>
              <small> · {fmtDate(p.paid_at)}{p.store?.name && ` · ${p.store.name}`}{p.brand?.name && ` · ${p.brand.name}`}</small>
            </span>
            <button
              type="button"
              className="ghost"
              aria-label="Apagar este preço"
              onClick={() => confirm("Apagar este preço do histórico?") && dropPrice.mutate(p.id)}
            >
              <Icon name="x" size={20} />
            </button>
          </li>
        ))}
      </ul>

      {mine && (
        <button
          type="button"
          className="danger"
          onClick={() =>
            confirm(`Excluir "${product.name}"?\nEle sai das listas abertas e o histórico de preços dele é apagado. Compras já finalizadas continuam, sem o nome do produto.`) &&
            remove.mutate()
          }
        >
          Excluir produto
        </button>
      )}
    </main>
  );
}
