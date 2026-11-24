"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { CheckCircle, CircleNotch, EnvelopeSimple, ImageSquare, MapPin, Package, SignOut, UserCircle } from "@phosphor-icons/react"
import { firstName, nameError, passwordError } from "../domain/account"
import { useAccount, useAccountPort } from "./account-context"
import { usePort } from "../../shared/ui/ports"
import type { CheckoutPort } from "../../checkout/application/checkout-port"
import { type OwnedOrder, money, orderImageSrc, stageLabels } from "../../checkout/domain/checkout"
import { optimized } from "../../shared/ui/optimized-image"
import { MyAddresses } from "./my-addresses"
import { BuyerData } from "./buyer-data"

type Tab = "pedidos" | "direcciones" | "datos"
const dates = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" })
const message = (e: unknown) => (e instanceof Error ? e.message : "No se pudo completar. Inténtalo de nuevo.")

/** The signed-in shopper's account: their orders, their saved addresses and their data. */
export function AccountHome({ next }: { next: string }) {
  const { session, logout } = useAccount()
  const [tab, setTab] = useState<Tab>("pedidos")
  if (!session) return null
  const shopper = session.shopper
  return (
    <div className="account-home">
      <header className="account-home-head">
        <span className="account-avatar squircle" aria-hidden="true"><UserCircle size={40} weight="fill" /></span>
        <div><h1>Hola, {firstName(shopper.name)}</h1><p className="account-lead">{shopper.email}</p></div>
        <button type="button" className="account-logout" onClick={() => void logout()}><SignOut size={18} aria-hidden="true" /> Cerrar sesión</button>
      </header>
      {next !== "/" && next !== "/cuenta" && <p className="order-notice squircle"><CheckCircle size={20} weight="fill" aria-hidden="true" /> Ya entraste. <Link href={next}>Volver a donde estabas</Link></p>}
      {!shopper.emailVerified && <VerifyBanner />}
      <div className="account-tabs" role="tablist" aria-label="Tu cuenta">
        <button type="button" role="tab" aria-selected={tab === "pedidos"} onClick={() => setTab("pedidos")}><Package size={18} aria-hidden="true" /> Mis pedidos</button>
        <button type="button" role="tab" aria-selected={tab === "direcciones"} onClick={() => setTab("direcciones")}><MapPin size={18} aria-hidden="true" /> Direcciones</button>
        <button type="button" role="tab" aria-selected={tab === "datos"} onClick={() => setTab("datos")}><UserCircle size={18} aria-hidden="true" /> Mis datos</button>
      </div>
      <div role="tabpanel">{tab === "pedidos" ? <MyOrders verified={shopper.emailVerified} /> : tab === "direcciones" ? <MyAddresses /> : <MyData />}</div>
    </div>
  )
}

function VerifyBanner() {
  const port = useAccountPort()
  const { session } = useAccount()
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle"), [error, setError] = useState("")
  async function send() {
    if (!session) return
    setState("busy"); setError("")
    try { await port.requestVerification(session.csrf); setState("sent") } catch (e) { setError(message(e)); setState("idle") }
  }
  return (
    <div className="account-verify squircle">
      <EnvelopeSimple size={24} weight="fill" aria-hidden="true" />
      <div><strong>Confirma tu correo</strong><p>Así ves también tus pedidos anteriores con este correo y tus opiniones llevan la marca de compra verificada.</p>
        {error && <p className="store-field-error" role="alert">{error}</p>}</div>
      {state === "sent" ? <p className="account-verify-sent" role="status">Te enviamos el enlace. Revisa tu correo.</p>
        : <button type="button" className="order-other squircle" disabled={state === "busy"} onClick={() => void send()}>{state === "busy" ? "Enviando…" : "Enviarme el enlace"}</button>}
    </div>
  )
}

function MyOrders({ verified }: { verified: boolean }) {
  const port = usePort<CheckoutPort>("checkout")
  const [orders, setOrders] = useState<OwnedOrder[] | null>(null), [error, setError] = useState(""), [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    port.myOrders().then((found) => { if (active) { setOrders(found); setError("") } }).catch((e) => { if (active) setError(message(e)) })
    return () => { active = false }
  }, [port, reload])
  if (error) return <div className="posts-empty squircle"><p>{error}</p><button type="button" className="link-arrow" onClick={() => { setError(""); setReload((n) => n + 1) }}>Intentar de nuevo</button></div>
  if (!orders) return <p className="store-wait"><CircleNotch className="spin" size={18} aria-hidden="true" /> Cargando tus pedidos…</p>
  if (orders.length === 0) return (
    <div className="posts-empty squircle"><Package size={32} weight="fill" aria-hidden="true" />
      <p>Aún no tienes pedidos con esta cuenta.{verified ? "" : " Si compraste antes con este correo, confírmalo y aparecerán aquí."}</p>
      <Link href="/productos" className="link-arrow">Ver productos</Link></div>
  )
  return (
    <ul className="my-orders">
      {orders.map((order) => {
        const stage = stageLabels[order.stage] ?? stageLabels.issue
        const src = orderImageSrc(order)
        return (
          <li key={order.number}>
            <Link href={`/cuenta/pedidos/${encodeURIComponent(order.number)}`} className="my-order squircle">
              <span className="summary-photo squircle">{src ? <img {...optimized(src, { sizes: "56px", width: 56 })} alt="" width={56} height={56} loading="lazy" decoding="async" /> : <ImageSquare size={20} aria-hidden="true" />}</span>
              <span className="my-order-main"><strong>Pedido #{order.number}{order.test ? " · prueba" : ""}{order.unseen && <span className="my-order-new">Nuevo</span>}</strong>
                {order.unseen && order.latestStep && <span className="my-order-news">{order.latestStep}</span>}
                <span>{order.firstTitle ?? "Pedido"}{order.lines > 1 ? ` y ${order.lines - 1} más` : ""}</span>
                <span className="my-order-date">{dates.format(new Date(order.placedAt))}</span></span>
              <span className="my-order-side"><span className="my-order-stage" data-tone={stage.tone}>{stage.label}</span><strong>{money(Number(order.total))}</strong></span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function MyData() {
  const port = useAccountPort()
  const { session, updateShopper, setSession } = useAccount()
  const [name, setName] = useState(session?.shopper.name ?? "")
  const [nameState, setNameState] = useState(""), [nameBusy, setNameBusy] = useState(false)
  const [current, setCurrent] = useState(""), [next, setNext] = useState(""), [passState, setPassState] = useState(""), [passError, setPassError] = useState(""), [passBusy, setPassBusy] = useState(false)
  const [allBusy, setAllBusy] = useState(false)
  if (!session) return null

  async function saveName(event: FormEvent) {
    event.preventDefault(); setNameState("")
    const problem = nameError(name)
    if (problem) { setNameState(problem); return }
    setNameBusy(true)
    try { updateShopper(await port.rename(name.trim(), session!.csrf)); setNameState("Guardado.") } catch (e) { setNameState(message(e)) } finally { setNameBusy(false) }
  }
  async function savePassword(event: FormEvent) {
    event.preventDefault(); setPassState(""); setPassError("")
    const problem = passwordError(next)
    if (problem) { setPassError(problem); return }
    setPassBusy(true)
    try { await port.changePassword(current, next, session!.csrf); setCurrent(""); setNext(""); setPassState("Contraseña actualizada. Cerramos tus otras sesiones.") }
    catch (e) { setPassError(message(e)) } finally { setPassBusy(false) }
  }
  async function everywhere() {
    setAllBusy(true)
    try { await port.logoutEverywhere(session!.csrf) } catch { /* the session is gone either way */ } finally { setSession(null); setAllBusy(false) }
  }
  return (
    <div className="account-data">
      <BuyerData />
      <form className="checkout-card squircle" onSubmit={saveName} noValidate>
        <h2>Tu nombre</h2>
        <label className="store-field">Nombre<input value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} /></label>
        <span className="store-field-hint">Así apareces en tus opiniones: nombre e inicial del apellido.</span>
        {nameState && <p className={nameState === "Guardado." ? "account-ok" : "store-field-error"} role="status">{nameState}</p>}
        <button type="submit" className="order-other squircle" disabled={nameBusy}>{nameBusy ? "Guardando…" : "Guardar nombre"}</button>
      </form>
      <form className="checkout-card squircle" onSubmit={savePassword} noValidate>
        <h2>Contraseña</h2>
        <p className="store-field-hint">Si entras con Google o Facebook y nunca pusiste contraseña, deja vacía la actual.</p>
        <label className="store-field">Contraseña actual<input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
        <label className="store-field">Contraseña nueva<input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={Boolean(passError)} /></label>
        {passError && <p className="store-field-error" role="alert">{passError}</p>}
        {passState && <p className="account-ok" role="status">{passState}</p>}
        <button type="submit" className="order-other squircle" disabled={passBusy}>{passBusy ? "Guardando…" : "Cambiar contraseña"}</button>
      </form>
      <div className="checkout-card squircle">
        <h2>Sesiones</h2>
        <p className="store-field-hint">Cierra tu cuenta en todos los computadores y celulares donde la abriste, incluido este.</p>
        <button type="button" className="order-other squircle" disabled={allBusy} onClick={() => void everywhere()}>{allBusy ? "Cerrando…" : "Cerrar sesión en todas partes"}</button>
      </div>
    </div>
  )
}
