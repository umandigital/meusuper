import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createList, deleteList, getLists } from "../services/lists";
import { autoListName, STORES, type StoreName } from "../lib/stores";

const LAST_STORE_KEY = "meusuper:lastStore";

function lastStore(): StoreName {
  try {
    const v = localStorage.getItem(LAST_STORE_KEY);
    if (v && (STORES as readonly string[]).includes(v)) return v as StoreName;
  } catch { /* sem localStorage: usa o primeiro */ }
  return STORES[0];
}

export default function Lists() {
  const [store, setStore] = useState<StoreName>(lastStore);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: lists = [], isLoading } = useQuery({ queryKey: ["lists"], queryFn: getLists });

  const create = useMutation({
    mutationFn: () => createList(autoListName(), store),
    onSuccess: (l) => {
      try { localStorage.setItem(LAST_STORE_KEY, store); } catch { /* ignora */ }
      qc.invalidateQueries({ queryKey: ["lists"] });
      navigate(`/lists/${l.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: deleteList,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
  });

  return (
    <main>
      <h1>Listas de Compras</h1>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <select value={store} onChange={(e) => setStore(e.target.value as StoreName)} aria-label="Mercado">
          {STORES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" disabled={create.isPending}>Nova lista</button>
      </form>
      {create.isError && <p className="error">Não foi possível criar a lista. Tente novamente.</p>}
      {isLoading && <p className="muted">Carregando…</p>}
      {!isLoading && !lists.length && <p className="muted">Nenhuma lista. Escolha o mercado e toque em “Nova lista”.</p>}
      <ul className="cards">
        {lists.map((l) => (
          <li key={l.id}>
            <Link to={`/lists/${l.id}`}>
              <span className="grow">
                <strong>{l.name}</strong>
                {l.store && <small>{l.store}</small>}
              </span>
            </Link>
            <button
              type="button"
              className="ghost"
              aria-label={`Excluir lista ${l.name}`}
              onClick={() => confirm(`Excluir a lista de ${l.name}?`) && remove.mutate(l.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
