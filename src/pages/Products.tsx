import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getLastPrices, listProducts } from "../services/products";
import { createProduct } from "../services/catalog";
import { SECTORS } from "../lib/sectors";
import { UNITS, unitSuffix } from "../lib/units";
import { formatBRL } from "../lib/format";
import type { Unit } from "../types/db";
import Icon from "../components/Icon";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

export default function Products() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [sector, setSector] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [newSector, setNewSector] = useState("outros");
  const [unit, setUnit] = useState<Unit>("un");

  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const { data: last = new Map() } = useQuery({ queryKey: ["last-prices"], queryFn: getLastPrices });

  const create = useMutation({
    mutationFn: () => createProduct(name, newSector, unit),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setName("");
      setAdding(false);
    },
  });

  const shown = useMemo(() => {
    const q = norm(term.trim());
    return products
      .filter((p) => (!sector || p.sector === sector) && (!q || norm(p.name).includes(q)))
      .sort((a, b) => {
        // quem tem preco pago vem primeiro (o mais recente no topo), depois seus produtos, depois o catalogo
        const la = last.get(a.id)?.paid_at ?? "";
        const lb = last.get(b.id)?.paid_at ?? "";
        if (la !== lb) return la < lb ? 1 : -1;
        if (!!a.user_id !== !!b.user_id) return a.user_id ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [products, last, term, sector]);

  return (
    <main>
      <h1>Meus Produtos</h1>
      <div className="row">
        <input type="search" placeholder="Buscar produto…" value={term} onChange={(e) => setTerm(e.target.value)} />
        <button type="button" onClick={() => setAdding(!adding)}>{adding ? "Fechar" : <><Icon name="plus" size={18} /> Novo</>}</button>
      </div>

      {adding && (
        <form
          className="sheet-inline"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <label className="field"><span>Nome do produto</span><input placeholder="Ex: Arroz integral 1kg" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
          <select value={newSector} onChange={(e) => setNewSector(e.target.value)} aria-label="Setor">
            {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
          </select>
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} aria-label="Unidade">
            {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
          <button type="submit" disabled={create.isPending}>Salvar produto</button>
          {create.isError && <p className="error">Não foi possível salvar (talvez o nome já exista).</p>}
        </form>
      )}

      <select className="filter" value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Filtrar por setor">
        <option value="">Todos os setores</option>
        {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
      </select>

      {isLoading && <p className="muted">Carregando…</p>}
      {!isLoading && !shown.length && <p className="muted">Nenhum produto encontrado.</p>}
      <p className="muted small">{shown.length} produto(s)</p>

      <ul className="cards">
        {shown.map((p) => {
          const lp = last.get(p.id);
          const emoji = SECTORS.find((s) => s.value === p.sector)?.emoji;
          return (
            <li key={p.id}>
              <Link to={`/products/${p.id}`}>
                <span className="icon">{emoji}</span>
                <span className="grow">
                  <strong>{p.name}</strong>
                  <small>
                    {lp
                      ? `${formatBRL(lp.price)}${unitSuffix(p.unit)} · pago em ${fmtDate(lp.paid_at)}`
                      : p.reference_price != null
                        ? `${formatBRL(Number(p.reference_price))}${unitSuffix(p.unit)} · estimado`
                        : "sem preço"}
                  </small>
                </span>
                {p.user_id && <small className="tag">meu</small>}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
