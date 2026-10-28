import { Link } from "react-router-dom";

const LINKS = [
  { to: "/lists", icon: "📋", title: "Listas", sub: "Monte a lista e veja a estimativa" },
  { to: "/products", icon: "📦", title: "Produtos", sub: "Seus produtos e marcas" },
  { to: "/history", icon: "🕘", title: "Histórico", sub: "Compras anteriores" },
  { to: "/statistics", icon: "📊", title: "Estatísticas", sub: "Gastos por setor e produto" },
];

export default function Supermarket() {
  return (
    <main>
      <h1>🛒 Supermercado</h1>
      <ul className="cards">
        {LINKS.map((l) => (
          <li key={l.to}>
            <Link to={l.to}>
              <span className="icon">{l.icon}</span>
              <span className="grow">
                <strong>{l.title}</strong>
                <small>{l.sub}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
