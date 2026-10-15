// React y useState controlan el componente y el estado del menú.
import React, { useEffect, useState } from "react";
// NavLink navega; Outlet muestra la página seleccionada.
import { NavLink, Outlet } from "react-router-dom";
import { usePermissions } from "../../context/PermissionsContext";
import { filterNavigation } from "../../security/modules";
import { navigation } from "../../data/navigation";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  LayoutDashboard,
  LogOut,
  Search,
  CalendarDays,
  Menu,
  Settings,
} from "lucide-react";
import AnimalIcon from "./AnimalIcon";
import pavoReparticion from "../../assets/icons/pavo-reparticion.svg";
import polloAsia from "../../assets/icons/pollo-asia.svg";
import pollitoCarabayllo from "../../assets/icons/pollito-carabayllo.svg";
import gallinaLumbra from "../../assets/icons/gallina-lumbra.svg";

// Convierte cada tipo de unidad en su icono lineal.
function LineIcon({ kind }) {
  if (kind === 'settings') return <Settings size={17} strokeWidth={1.8} />;
  if (kind === "turkey") return <img className="sidebar-animal-image" src={pavoReparticion} alt="" />;
  if (kind === "cooked-turkey") return <img className="sidebar-animal-image" src={polloAsia} alt="" />;
  if (kind === "young-chicken") return <img className="sidebar-animal-image" src={pollitoCarabayllo} alt="" />;
  if (kind === "hen") return <img className="sidebar-animal-image" src={gallinaLumbra} alt="" />;
  if (["hen", "turkey", "cooked-turkey", "young-chicken"].includes(kind))
    return <AnimalIcon kind={kind} />;
  if (kind === "eggs") return <AnimalIcon kind="eggs" />;
  const Icon =
    kind === "calendar"
      ? CalendarDays
      : kind === "home"
        ? LayoutDashboard
        : LayoutDashboard;
  return <Icon size={17} strokeWidth={1.8} />;
}

// Componente principal del sidebar y del marco general de la aplicación.
export default function Layout() {
  const { session, signOut } = useAuth();
  const { can } = usePermissions();
  const visibleNavigation = filterNavigation(navigation, can);
  const [collapsed, setCollapsed] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [calendarInfo, setCalendarInfo] = useState(null);
  useEffect(() => {
    // Obtiene la fecha actual y la semana desde la tabla calendario de Supabase.
    // Buscamos hoy, no la fecha máxima, porque el calendario contiene fechas futuras.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    supabase
      ?.from("calendario")
      .select("*")
      .eq("fecha", today)
      .limit(1)
      .then(({ data, error }) => {
        setSupabaseConnected(!error);
        setCalendarInfo(data?.[0] || null);
      });
  }, []);
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      {/* Sidebar: marca, botón de repliegue, navegación y usuario. */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">I</div>
          {!collapsed && (
            <div>
              <strong>ISAMISA</strong>
              <small>Planeamiento Avícola</small>
            </div>
          )}
        </div>
        {/* Este botón alterna entre menú completo y solo iconos. */}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expandir menú" : "Replegar menú"}
        >
          <Menu size={22} strokeWidth={2.2} />
        </button>
        {/* Las opciones y rutas se mantienen en src/data/navigation.js. */}
        <nav>
          {visibleNavigation.map((item) =>
            item.children ? (
              <div className="nav-group" key={item.label}>
                <NavLink to={item.path || "#"} className="nav-heading">
                  <LineIcon kind={item.icon} />
                  {!collapsed && item.label}
                </NavLink>
                {!collapsed &&
                  item.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      className="nav-link"
                    >
                      <LineIcon kind={child.icon} />
                      {child.label}
                    </NavLink>
                  ))}
              </div>
            ) : (
              <NavLink
                end
                key={item.path}
                to={item.path}
                className="nav-link nav-root"
              >
                <LineIcon kind={item.icon} />
                {!collapsed && item.label}
              </NavLink>
            ),
          )}
        </nav>
        {/* Pie: acceso a planeamiento, datos del usuario y cierre de sesión. */}
        <div className="sidebar-footer">
          {can("planeamiento") && <NavLink to="/planeamiento" className="planning-link">
            <CalendarDays size={16} />
            {!collapsed && " Planeamiento"}
          </NavLink>}
          {can("administracion") && <NavLink to="/administracion" className="planning-link">
            <Settings size={16} />
            {!collapsed && " Administración"}
          </NavLink>}
          <div className="user-mini">
            <span>{session?.user?.email?.[0]?.toUpperCase() || "U"}</span>
            {!collapsed && (
              <div>
                <b>{session?.user?.email?.split("@")[0] || "Usuario"}</b>
                <small>Sesión activa</small>
              </div>
            )}
            <button onClick={signOut}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {/* Área principal: aquí se renderiza la página activa mediante Outlet. */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">
              {calendarInfo
                ? `${new Date(`${calendarInfo.fecha}T00:00:00`).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Semana ${calendarInfo.semana ?? calendarInfo.Semana ?? "-"}`
                : "Cargando calendario..."}
            </span>
            <h1>Planeamiento y Control de la Producción</h1>
          </div>
          <div className="top-actions">
            <span
              className={`status-dot ${supabaseConnected ? "connected" : "disconnected"}`}
            >
              <i /> Conexion a Supabase
            </span>
            <button className="avatar">
              {session?.user?.email?.[0]?.toUpperCase() || "U"}
            </button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
