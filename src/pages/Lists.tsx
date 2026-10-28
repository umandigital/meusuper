import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createList, deleteList, getLists } from "../services/lists";

export default function Lists() {
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: lists = [], isLoading } = useQuery({ queryKey: ["lists"], queryFn: getLists });

  const create = useMutation({
    mutationFn: createList,
    onSuccess: (l) => {
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
          if (name.trim()) create.mutate(name);
        }}
      >
        <input placeholder="Nome da lista" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">Criar</button>
      </form>
      {isLoading && <p className="muted">Carregando…</p>}
      {!isLoading && !lists.length && <p className="muted">Nenhuma lista. Crie a primeira acima.</p>}
      <ul className="cards">
        {lists.map((l) => (
          <li key={l.id}>
            <Link to={`/lists/${l.id}`}>{l.name}</Link>
            <button
              type="button"
              className="ghost"
              aria-label={`Excluir ${l.name}`}
              onClick={() => confirm(`Excluir a lista "${l.name}"?`) && remove.mutate(l.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
