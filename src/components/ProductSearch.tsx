import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createProduct, searchProducts } from "../services/catalog";
import { SECTORS } from "../lib/sectors";
import type { Product } from "../types/db";

export default function ProductSearch({ onPick }: { onPick: (p: Product) => void }) {
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [sector, setSector] = useState("outros");
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["search", term], queryFn: () => searchProducts(term), enabled: term.trim().length > 0 });

  const exact = data.some((p) => p.name.toLowerCase() === term.trim().toLowerCase());

  function pick(p: Product) {
    onPick(p);
    setTerm("");
    setCreating(false);
  }

  async function create() {
    const p = await createProduct(term, sector, "un");
    qc.invalidateQueries({ queryKey: ["search"] });
    pick(p);
  }

  return (
    <div className="search">
      <input
        type="search"
        placeholder="Buscar produto (ex.: arroz)"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        autoComplete="off"
      />
      {term.trim() && (
        <ul className="results">
          {data.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => pick(p)}>
                <span>{SECTORS.find((s) => s.value === p.sector)?.emoji}</span>
                <span className="grow">{p.name}</span>
                {p.user_id && <small>meu</small>}
              </button>
            </li>
          ))}
          {!exact && (
            <li>
              {creating ? (
                <div className="create">
                  <select value={sector} onChange={(e) => setSector(e.target.value)}>
                    {SECTORS.map((s) => (
                      <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={create}>Criar “{term.trim()}”</button>
                </div>
              ) : (
                <button type="button" onClick={() => setCreating(true)}>
                  <span>＋</span>
                  <span className="grow">Criar “{term.trim()}”</span>
                </button>
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
