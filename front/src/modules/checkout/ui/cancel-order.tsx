"use client"

import { useState, type FormEvent } from "react"
import { ArrowUUpLeft, CircleNotch, Clock, LockSimple, WarningCircle } from "@phosphor-icons/react"
import type { CheckoutPort, OrderAccess } from "../application/checkout-port"
import { money, type CancelPreview, type OrderView } from "../domain/checkout"
import { ACCOUNT_TYPES, BANKS, DOCUMENT_TYPES, accountErrors, emptyAccount, isWallet, type RefundAccount } from "../domain/refund-account"
import { usePort } from "../../shared/ui/ports"

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

/**
 * Cancelling the order while it has not left. Before confirming, the shopper sees how much comes back and how; when the
 * money goes back by transfer, they give the account here.
 */
export function CancelOrder({ order, access, onChanged }: { order: OrderView; access: OrderAccess; onChanged: (o: OrderView) => void }) {
  const port = usePort<CheckoutPort>("checkout")
  const [preview, setPreview] = useState<CancelPreview | null>(null), [loading, setLoading] = useState(false)
  const [reason, setReason] = useState(""), [account, setAccount] = useState<RefundAccount>(emptyAccount())
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [tried, setTried] = useState(false)
  if (!order.canCancel || access.kind !== "account") return null

  async function open() {
    setLoading(true); setError("")
    try { setPreview(await port.cancelPreview(access)) } catch (e) { setError(message(e, "No pudimos revisar tu pedido. Inténtalo de nuevo.")) } finally { setLoading(false) }
  }
  const errors = preview?.needsAccount ? accountErrors(account) : {}
  async function send(e: FormEvent) {
    e.preventDefault(); setTried(true); setError("")
    if (reason.trim().length < 3) { setError("Cuéntanos por qué quieres cancelarlo."); return }
    if (Object.keys(errors).length > 0) { setError("Revisa los datos de tu cuenta."); return }
    setBusy(true)
    try { onChanged(await port.cancelOrder(access, reason.trim(), preview?.needsAccount ? account : null)); setPreview(null) }
    catch (err) { setError(message(err, "No se pudo cancelar el pedido.")); if ((err as { status?: number }).status === 409) setPreview(null) }
    finally { setBusy(false) }
  }

  if (!preview) return (
    <div className="order-cancel-start">
      <button type="button" className="order-cancel-link" disabled={loading} onClick={() => void open()}>{loading ? "Revisando tu pedido…" : "Cancelar el pedido"}</button>
      {error && <p className="store-field-error" role="alert">{error}</p>}
    </div>
  )
  if (!preview.canCancel) return <p className="store-alert" role="alert"><WarningCircle size={18} weight="fill" aria-hidden="true" /> {preview.why}</p>
  return (
    <form className="order-cancel squircle" onSubmit={send} noValidate aria-labelledby="cancel-title">
      <h2 id="cancel-title">Cancelar el pedido #{order.number}</h2>
      <p className="cart-note">{Number(preview.refund) > 0
        ? <>Te devolvemos <strong>{money(Number(preview.refund))}</strong> {preview.routeLabel}. Según tu banco, puede tardar unos días hábiles en verse.</>
        : "No hiciste ningún pago, así que no hay nada que devolver."}</p>
      <label className="store-field">¿Por qué quieres cancelarlo?
        <textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={tried && reason.trim().length < 3} />
      </label>
      {preview.needsAccount && <AccountFields value={account} onChange={setAccount} errors={tried ? errors : {}} />}
      {error && <p className="store-field-error" role="alert">{error}</p>}
      <div className="order-cancel-actions">
        <button className="button-primary" disabled={busy}>{busy ? <><CircleNotch className="spin" size={18} aria-hidden="true" /> Cancelando…</> : "Sí, cancelar el pedido"}</button>
        <button type="button" className="link-arrow" disabled={busy} onClick={() => { setPreview(null); setError(""); setTried(false) }}>No, mantener el pedido</button>
      </div>
    </form>
  )
}

/** Where the money stands after cancelling; asks for the account when the gateway could not give it back. */
export function RefundStatus({ order, access, onChanged }: { order: OrderView; access: OrderAccess; onChanged: (o: OrderView) => void }) {
  const port = usePort<CheckoutPort>("checkout")
  const [account, setAccount] = useState<RefundAccount>(emptyAccount()), [busy, setBusy] = useState(false), [error, setError] = useState(""), [tried, setTried] = useState(false)
  const refund = order.refund
  if (!refund) return null
  const waitingAccount = refund.status === "to_transfer" && !refund.hasAccount
  const errors = accountErrors(account)
  async function send(e: FormEvent) {
    e.preventDefault(); setTried(true); setError("")
    if (Object.keys(errors).length > 0) { setError("Revisa los datos de tu cuenta."); return }
    setBusy(true)
    try { onChanged(await port.giveRefundAccount(access, account)) } catch (err) { setError(message(err, "No se pudo guardar tu cuenta.")) } finally { setBusy(false) }
  }
  const text = refund.status === "to_transfer"
    ? (refund.hasAccount ? "Te lo transferimos a la cuenta que nos diste. Te avisamos cuando esté hecho." : "No se pudo devolver por la pasarela de pago. Escribe la cuenta donde te lo consignamos.")
    : "Lo estamos devolviendo a tu medio de pago. Te avisamos cuando esté hecho."
  return (
    <section className="checkout-card squircle" aria-labelledby="order-refund">
      <h2 id="order-refund"><ArrowUUpLeft size={20} aria-hidden="true" /> Tu reembolso</h2>
      <p className="order-fact"><Clock size={18} aria-hidden="true" /> {money(Number(refund.amount))} · {text}</p>
      {waitingAccount && access.kind === "account" && <form className="grid gap-4" onSubmit={send} noValidate>
        <AccountFields value={account} onChange={setAccount} errors={tried ? errors : {}} />
        {error && <p className="store-field-error" role="alert">{error}</p>}
        <button className="button-primary" disabled={busy}>{busy ? <><CircleNotch className="spin" size={18} aria-hidden="true" /> Guardando…</> : "Guardar mi cuenta"}</button>
      </form>}
    </section>
  )
}

/** The account to transfer the refund to, with the reason we ask for it. */
function AccountFields({ value, onChange, errors }: { value: RefundAccount; onChange: (a: RefundAccount) => void; errors: Partial<Record<keyof RefundAccount, string>> }) {
  const set = (field: keyof RefundAccount) => (e: { target: { value: string } }) => onChange({ ...value, [field]: e.target.value })
  const wallet = isWallet(value.bank)
  const field = (name: keyof RefundAccount) => ({ "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `refund-${name}-error` : undefined })
  const problem = (name: keyof RefundAccount) => errors[name] ? <span id={`refund-${name}-error`} className="store-field-error">{errors[name]}</span> : null
  return (
    <fieldset className="refund-account">
      <legend>¿A dónde te devolvemos el dinero?</legend>
      <p className="refund-account-note"><LockSimple size={16} weight="fill" aria-hidden="true" /> Solo usamos estos datos para devolverte el dinero. Los guardamos cifrados y los borramos cuando el reembolso está hecho.</p>
      <label className="store-field">Banco o billetera
        <select value={value.bank} onChange={set("bank")} {...field("bank")}><option value="">Elige uno</option>{BANKS.map((b) => <option key={b} value={b}>{b}</option>)}</select>{problem("bank")}
      </label>
      {!wallet && <label className="store-field">Tipo de cuenta
        <select value={value.accountType} onChange={set("accountType")} {...field("accountType")}>{ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>{problem("accountType")}
      </label>}
      <label className="store-field">{wallet ? `Celular de tu ${value.bank}` : "Número de la cuenta"}
        <input inputMode="numeric" autoComplete="off" value={value.number} onChange={set("number")} {...field("number")} />{problem("number")}
      </label>
      <label className="store-field">Titular de la cuenta
        <input autoComplete="name" value={value.holder} onChange={set("holder")} {...field("holder")} />{problem("holder")}
      </label>
      <div className="refund-account-doc">
        <label className="store-field">Tipo de documento
          <select value={value.documentType} onChange={set("documentType")} {...field("documentType")}>{DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select>{problem("documentType")}
        </label>
        <label className="store-field">Número de documento
          <input inputMode="numeric" autoComplete="off" value={value.document} onChange={set("document")} {...field("document")} />{problem("document")}
        </label>
      </div>
    </fieldset>
  )
}
