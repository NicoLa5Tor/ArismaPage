"use client"

import Image from "next/image"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Browser, ChatsCircle, Storefront, ChartBar, Receipt, Users, FileText, Package, Tag, Stack, Ticket, Percent, SignOut, List, SquaresFour, UsersThree, X, type Icon } from "@phosphor-icons/react"
import type { Permission } from "../../shared/domain/permission"
import { Avatar } from "../../shared/ui/rich"
import { BRAND_ICON } from "../../shared/domain/brand-assets"
import { useStoreProfile } from "../../shared/ui/store-profile"

export type AdminSection = "summary" | "orders" | "customers" | "quotes" | "products" | "categories" | "inventory" | "coupons" | "settings" | "users" | "reviews" | "store" | "site"
/** Sections with their URL slug (?seccion=pedidos), so reloads and shared links keep the place. */
/** Sections a role cannot use are hidden (permission); the backend rejects their writes anyway. */
export const SECTIONS: { id: AdminSection; slug: string; label: string; title: string; subtitle: string; icon: Icon; group: "sales" | "catalog" | "admin"; permission?: Permission }[] = [
  { id: "summary", slug: "resumen", label: "Resumen", title: "Resumen de ventas", subtitle: "Cómo va la tienda en el periodo que elijas", icon: ChartBar, group: "sales" },
  { id: "orders", slug: "pedidos", label: "Pedidos", title: "Pedidos", subtitle: "Del pago a la entrega, en un solo lugar", icon: Receipt, group: "sales" },
  { id: "customers", slug: "clientes", label: "Clientes", title: "Clientes", subtitle: "Quién compra y qué ha comprado", icon: Users, group: "sales" },
  { id: "quotes", slug: "cotizaciones", label: "Cotizaciones", title: "Cotizaciones", subtitle: "Solicitudes de clientes e instituciones", icon: FileText, group: "sales" },
  { id: "products", slug: "productos", label: "Productos", title: "Productos", subtitle: "Organiza y actualiza tu catálogo", icon: Package, group: "catalog" },
  { id: "categories", slug: "categorias", label: "Categorías", title: "Categorías", subtitle: "Organiza las categorías de tu tienda", icon: Tag, group: "catalog" },
  { id: "inventory", slug: "inventario", label: "Inventario", title: "Inventario", subtitle: "Movimientos de existencias y productos por reponer", icon: Stack, group: "catalog" },
  { id: "coupons", slug: "cupones", label: "Cupones", title: "Cupones", subtitle: "Descuentos y su uso real", icon: Ticket, group: "catalog" },
  { id: "reviews", slug: "opiniones", label: "Opiniones", title: "Opiniones y preguntas", subtitle: "Lo que dicen y preguntan tus clientes", icon: ChatsCircle, group: "catalog" },
  { id: "store", slug: "tienda", label: "Tienda", title: "Ajustes de la tienda", subtitle: "Pagos, envíos, conversaciones y página de producto", icon: Storefront, group: "admin", permission: "SETTINGS_MANAGE" },
  { id: "site", slug: "sitio", label: "Sitio", title: "Sitio", subtitle: "Documentos legales y páginas de error de la tienda", icon: Browser, group: "admin", permission: "SETTINGS_MANAGE" },
  { id: "users", slug: "usuarios", label: "Usuarios", title: "Usuarios", subtitle: "Quién entra al panel y qué puede hacer", icon: UsersThree, group: "admin", permission: "USERS_MANAGE" },
  { id: "settings", slug: "impuestos", label: "Impuestos", title: "Impuestos", subtitle: "Tasas de IVA que usan tus productos", icon: Percent, group: "admin", permission: "TAXES_MANAGE" },
]
type Props = { section: AdminSection; onSectionChange: (section: AdminSection) => void; onLogout: () => void; aside: ReactNode; children: ReactNode; user: { name: string; roleLabel: string; permissions: Permission[] }; onAccount: () => void
  /** The panel receives the store's changes as they happen. */
  live?: boolean }

/**
 * Desktop (≥1100px): spatial three-pane layout; the menu button collapses the sidebar.
 * Phone and tablet: the sidebar is an off-canvas drawer opened from the menu button; content scrolls with the page.
 */
export function AdminShell({ section, onSectionChange, onLogout, aside, children, user, onAccount, live = false }: Props) {
  const profile = useStoreProfile()
  const [wide, setWide] = useState(false)
  const [side, setSide] = useState(true)
  const [drawer, setDrawer] = useState(false)
  // The pending widgets stay out of the way where the work needs the width (Pedidos repeats their counts in its tabs);
  // the button shows or hides them per section.
  const [hiddenWidgets, setHiddenWidgets] = useState<Set<AdminSection>>(() => new Set<AdminSection>(["orders"]))
  const widgets = !hiddenWidgets.has(section)
  const setWidgets = (show: boolean) => setHiddenWidgets(prev => { const next = new Set(prev); if (show) next.delete(section); else next.add(section); return next })
  const scene = useRef<HTMLDivElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const firstItem = useRef<HTMLButtonElement>(null)
  const visible = SECTIONS.filter(s => !s.permission || user.permissions.includes(s.permission))
  const current = visible.find(s => s.id === section) ?? visible[0]

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1100px)")
    const fit = () => { setWide(query.matches); if (query.matches) setDrawer(false) }
    fit(); query.addEventListener("change", fit); return () => query.removeEventListener("change", fit)
  }, [])

  useEffect(() => {
    if (!wide || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let frame = 0
    const move = (event: PointerEvent) => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { if (scene.current) scene.current.style.perspectiveOrigin = `${50 + (event.clientX / window.innerWidth - 0.5) * 10}% ${42 + (event.clientY / window.innerHeight - 0.5) * 8}%` })
    }
    window.addEventListener("pointermove", move, { passive: true })
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(frame) }
  }, [wide])

  // Drawer: focus moves in on open and back to the menu button on close; Escape closes; the page behind does not scroll.
  useEffect(() => {
    if (!drawer) return
    firstItem.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false) }
    document.addEventListener("keydown", key)
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"
    const button = menuButton.current
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; button?.focus() }
  }, [drawer])

  const choose = (id: AdminSection) => { onSectionChange(id); setDrawer(false) }
  const item = (s: (typeof SECTIONS)[number], i: number) => <button key={s.id} ref={i === 0 ? firstItem : undefined} type="button" className={`glass-nav-item${current.id === s.id ? " is-active" : ""}`} aria-current={current.id === s.id ? "page" : undefined} onClick={() => choose(s.id)}><s.icon size={21} aria-hidden="true" />{s.label}</button>
  const sideHidden = wide ? !side : !drawer
  return <div className="glass-stage" data-layout={wide ? "spatial" : "flat"}>
    <div className="glass-env" aria-hidden="true"><div className="glass-env-photo" /><div className="glass-env-veil" /></div>
    {!wide && <div className="glass-scrim" data-open={drawer} aria-hidden="true" onClick={() => setDrawer(false)} />}
    <div ref={scene} className={`glass-space${side ? "" : " glass-no-side"}${widgets ? "" : " glass-no-right"}`}>
      <aside id="admin-nav" className="glass-window glass-side" data-open={drawer} aria-label="Navegación administrativa" inert={sideHidden || undefined}>
        <div className="glass-workspace"><Image src={BRAND_ICON} alt="" width={48} height={48} /><div><strong>{profile.shortName}</strong><span>Administración</span></div>
          {!wide && <button type="button" className="glass-round ml-auto" aria-label="Cerrar menú" onClick={() => setDrawer(false)}><X size={18} aria-hidden="true" /></button>}</div>
        <nav className="glass-nav" aria-label="Secciones del panel">
          <div className="glass-nav-group">
            <span className="glass-nav-label">Ventas</span>{visible.filter(s => s.group === "sales").map((s, i) => item(s, i))}
            <span className="glass-nav-label">Catálogo</span>{visible.filter(s => s.group === "catalog").map((s, i) => item(s, i + 4))}
            {visible.some(s => s.group === "admin") && <><span className="glass-nav-label">Administración</span>{visible.filter(s => s.group === "admin").map((s, i) => item(s, i + 9))}</>}
          </div>
          <button type="button" className="glass-nav-item" onClick={onLogout}><SignOut size={21} aria-hidden="true" />Cerrar sesión</button>
        </nav>
      </aside>
      <main id="contenido" className="glass-window glass-main"><div className="glass-main-inner">
        <header className="glass-page-head">
          <button ref={menuButton} type="button" onClick={() => wide ? setSide(!side) : setDrawer(true)} className="glass-round glass-menu-button" aria-label={wide ? (side ? "Ocultar navegación" : "Mostrar navegación") : "Abrir menú"} aria-controls="admin-nav" aria-expanded={wide ? side : drawer}><List size={20} aria-hidden="true" /></button>
          <div className="min-w-0 flex-1"><h1>{current.title}</h1><p>{current.subtitle}</p></div>
          <div className="glass-tools">{live && <span className="glass-live" title="Los pedidos se actualizan solos al cambiar">En vivo</span>}<button type="button" onClick={() => setWidgets(!widgets)} className="glass-round" aria-label={widgets ? "Ocultar pendientes" : "Mostrar pendientes"} aria-pressed={widgets}><SquaresFour size={20} aria-hidden="true" /></button><button type="button" className="glass-user-button" onClick={onAccount} aria-label={`Mi cuenta: ${user.name}, ${user.roleLabel}`}><Avatar name={user.name} size={40} /><span className="glass-user-text"><strong>{user.name}</strong><span>{user.roleLabel}</span></span></button></div>
        </header>
        {children}
      </div></main>
      <aside className="glass-right" aria-label="Pendientes de la tienda">{aside}</aside>
    </div>
  </div>
}
