import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/", label: "Início", icon: "🏠", end: true },
  { to: "/supermarket", label: "Mercado", icon: "🛒" },
  { to: "/planning", label: "Plano", icon: "🎯" },
  { to: "/settings", label: "Ajustes", icon: "⚙️" },
];

export default function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">MS</span>
        <strong>MeuSuper</strong>
      </header>
      <div className="content">
        <Outlet />
      </div>
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? "active" : "")}>
            <span>{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
