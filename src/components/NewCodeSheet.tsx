import { useEffect, useState } from "react";
import ProductSearch from "./ProductSearch";
import { suggestFromOpenFoodFacts } from "../services/barcode";
import type { Brand, Product } from "../types/db";

export interface NewCodeResult {
  product: Product;
  brandName: string;
  price: number | null;
}

/** Codigo de barras ainda desconhecido: escolha o produto e a marca uma vez; da proxima ele e reconhecido. */
export default function NewCodeSheet({ code, brands, onSave, onCancel }: {
  code: string;
  brands: Brand[];
  onSave: (r: NewCodeResult) => void;
  onCancel: () => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    suggestFromOpenFoodFacts(code).then(setHint);
  }, [code]);

  const parsed = price.trim() ? Number(price.replace(",", ".")) : null;

  return (
    <div className="sheet-backdrop">
      <div className="sheet">
        <h2>Código novo</h2>
        <p className="muted small">{code}{hint && <> · base pública: {hint}</>}</p>
        {product ? (
          <p><strong>{product.name}</strong> <button type="button" className="ghost" onClick={() => setProduct(null)}>trocar</button></p>
        ) : (
          <ProductSearch onPick={setProduct} />
        )}
        <label className="field"><span>Marca (opcional)</span><input list="brand-options" placeholder="Ex: Tio João" value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
        <datalist id="brand-options">
          {brands.map((b) => <option key={b.id} value={b.name} />)}
        </datalist>
        <label className="field"><span>Preço na prateleira (opcional)</span><input inputMode="decimal" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <div className="create">
          <button
            type="button"
            disabled={!product || (parsed !== null && !(parsed >= 0))}
            onClick={() => product && onSave({ product, brandName: brand.trim(), price: parsed })}
          >
            Salvar e adicionar
          </button>
          <button type="button" className="ghost" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
