export type Unit = "un" | "kg" | "l" | "pct";

export interface Product {
  id: string;
  user_id: string | null;
  name: string;
  sector: string;
  unit: Unit;
  reference_price: number | null;
  /** Peso medio de 1 unidade (g), quando o produto e pedido em unidade mas a nota vem em KG (pao, banana, tomate). */
  unit_weight_g?: number | null;
}

export interface Brand {
  id: string;
  user_id: string | null;
  name: string;
}

export interface ProductBrand {
  id: string;
  product_id: string;
  brand_id: string | null;
  barcode: string | null;
  size_label: string | null;
}

export interface Price {
  id: string;
  product_id: string;
  brand_id: string | null;
  store_id: string | null;
  price: number;
  paid_at: string;
  source: "manual" | "scan" | "receipt";
  /** Preenchido quando o historico e carregado com o mercado (join). */
  store?: { name: string } | null;
}

export interface ShoppingList {
  id: string;
  name: string;
  store: "Nicolini" | "Peruzzo" | null;
  archived: boolean;
  created_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  product_id: string;
  brand_id: string | null;
  quantity: number;
  checked: boolean;
  paid_price: number | null;
}
