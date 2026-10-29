import { NavLink, Outlet } from "react-router-dom";
import Icon, { type IconName } from "./Icon";

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/", label: "Início", icon: "home", end: true },
  { to: "/supermarket", label: "Mercado", icon: "cart" },
  { to: "/planning", label: "Plano", icon: "target" },
  { to: "/settings", label: "Ajustes", icon: "sliders" },
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
      <nav className="bottom-nav" aria-label="Navegação principal">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon name={t.icon} />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
