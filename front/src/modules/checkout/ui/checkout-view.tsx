"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, Bank, CircleNotch, CreditCard, Flask, ImageSquare, Lock, Plus, Storefront, Truck, UserCircle, WhatsappLogo } from "@phosphor-icons/react"
import { useAccount } from "../../account/ui/account-context"
import { useCart } from "../../cart/ui/cart-context"
import { usePort } from "../../shared/ui/ports"
import type { CheckoutPort } from "../application/checkout-port"
import { type Options, deliveryOf, money, quoteImageSrc } from "../domain/checkout"
import { emptyProfile, profileErrors, type Profile, type ProfileErrors, type SavedAddress } from "../../account/domain/address"
import { useAddressBookPort } from "../../account/ui/use-address-book"
import { AddressForm } from "../../account/ui/address-form"
import { AddressCard } from "../../account/ui/my-addresses"
import { ProfileFields } from "../../account/ui/buyer-data"
import { goToPayment } from "./go-to-payment"
import { CouponField } from "./coupon-field"
import { useQuote } from "./use-quote"
import { useStoreProfile } from "../../shared/ui/store-profile"
import { optimized } from "../../shared/ui/optimized-image"

const paymentText: Record<string, { hint: string; icon: typeof CreditCard }> = {
  wompi: { hint: "Tarjeta, PSE, Nequi o Bancolombia. Pagas en la página segura de Wompi.", icon: CreditCard },
  payu: { hint: "Tarjeta, PSE o efectivo. Pagas en la página segura de PayU.", icon: CreditCard },
  manual: { hint: "Te mostramos los datos para pagar y confirmamos tu pedido por WhatsApp.", icon: Bank },
}

/**
 * One page: where it goes (a saved address or pickup), who buys, how it is paid and the order as the store prices it.
 * Buying needs an account: the address book and the buyer's data come from it and stay there for next time.
 */
/** legal: the policies the store publishes (only those with an address); cancels: shoppers cancel on their own before it leaves. */
export function CheckoutView({ legal, cancels, whatsapp }: { legal: { label: string; href: string }[]; cancels: boolean; whatsapp?: string }) {
  const port = usePort<CheckoutPort>("checkout")
  const book = useAddressBookPort()
  const profile = useStoreProfile()
  const router = useRouter()
  const cart = useCart()
  const { session, ready } = useAccount()
  const [contact, setContact] = useState<Profile | null>(null)
  const [addresses, setAddresses] = useState<SavedAddress[] | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [pickup, setPickup] = useState(false)
  const [note, setNote] = useState("")
  const [options, setOptions] = useState<Options | null>(null)
  const [accepts, setAccepts] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [loadError, setLoadError] = useState(false)

  const address = addresses?.find((a) => a.id === chosen) ?? null
  const delivery = deliveryOf({ pickup, city: address?.city ?? "", state: address?.state ?? "" }, profile)
  const { quote, checking, failed, lines } = useQuote(delivery, session?.shopper.email ?? "")
  const payment = options?.payment ?? null

  useEffect(() => { port.options().then(setOptions).catch(() => setLoadError(true)) }, [port])
  // the buyer's data and saved addresses: the default address is chosen, the profile fills "Tus datos"
  useEffect(() => {
    if (!session) return
    let live = true
    const [first, ...rest] = session.shopper.name.split(/\s+/)
    book.profile().then((p) => { if (live) setContact({ ...p, firstName: p.firstName || first || "", lastName: p.lastName || rest.join(" "), documentType: p.documentType || "CC" }) })
      .catch(() => { if (live) setContact({ ...emptyProfile, firstName: first || "", lastName: rest.join(" ") }) })
    book.addresses().then((found) => { if (live) { setAddresses(found); setChosen(found.find((a) => a.isDefault)?.id ?? found[0]?.id ?? null); setAdding(found.length === 0) } })
      .catch(() => { if (live) { setAddresses([]); setAdding(true) } })
    return () => { live = false }
  }, [session, book])

  useEffect(() => {
    if (address?.phone) queueMicrotask(() => setContact((c) => (c && !c.phone ? { ...c, phone: address.phone } : c)))
  }, [address?.phone])

  const errors: ProfileErrors = contact ? profileErrors(contact) : {}
  const shown: ProfileErrors = submitted ? errors : {}
  const priced = quote?.cart
  const cartProblem = priced ? priced.lines.find((line) => line.problem)?.problem ?? priced.blockers[0] ?? null : null
  const couponProblem = cart.coupon && quote?.couponError ? quote.couponError : null

  async function submit(event: FormEvent) {
    event.preventDefault(); setSubmitted(true); setError("")
    if (!contact) return
    if (!pickup && !address) { setError(adding ? "Guarda la dirección de entrega antes de continuar." : "Elige la dirección de entrega."); document.getElementById("checkout-delivery")?.scrollIntoView({ behavior: "smooth", block: "start" }); return }
    const first = Object.keys(errors)[0]
    if (first) { document.getElementById(`checkout-${first}`)?.focus(); return }
    if (!payment) { setError("La tienda no está recibiendo pagos en este momento. Escríbenos por WhatsApp."); return }
    if (couponProblem) { setError(`Cupón: ${couponProblem}. Quítalo o escribe otro.`); return }
    if (!accepts) { setError("Acepta los términos y las políticas de la tienda para continuar."); return }
    setBusy(true)
    try {
      const placed = await port.place(lines, { contact, pickup, addressId: pickup ? null : address!.id, note }, cart.coupon, accepts)
      // the order is the account's: it is followed and paid signed in, from "Mis pedidos"
      const orderUrl = `/cuenta/pedidos/${encodeURIComponent(placed.number)}`
      cart.clear()
      // the order exists from here on: if the payment page cannot be opened, the order page lets them try again
      try { if (session && goToPayment(await port.startPayment({ kind: "account", number: placed.number, csrf: session.csrf }))) return } catch { /* fall through to the order page */ }
      router.replace(orderUrl)
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo crear el pedido. Inténtalo de nuevo."); setBusy(false) }
  }

  if (cart.ready && cart.lines.length === 0 && !busy) return (
    <div className="checkout-body"><div className="cart-empty cart-empty-page"><h1>No hay nada por pagar</h1><p>Tu carrito está vacío. Agrega productos y vuelve aquí para finalizar la compra.</p><Link href="/productos" className="button-primary">Ver productos</Link></div></div>
  )
  if (!ready) return <div className="checkout-body"><p className="store-wait"><CircleNotch className="spin" size={18} aria-hidden="true" /> Cargando…</p></div>
  if (!session) return (
    <div className="checkout-body">
      <Link href="/carrito" className="checkout-back"><ArrowLeft size={18} aria-hidden="true" /> Volver al carrito</Link>
      <div className="checkout-signin squircle">
        <UserCircle size={40} weight="fill" aria-hidden="true" />
        <h1>Inicia sesión para comprar</h1>
        <p>Con tu cuenta guardamos tus direcciones y tus datos, y sigues tus pedidos desde «Mi cuenta». Entra con Google, Facebook o tu correo; tu carrito te espera.</p>
        <Link href="/cuenta?volver=/checkout&motivo=comprar" className="button-primary">Entrar o crear mi cuenta</Link>
      </div>
    </div>
  )

  return (
    <div className="checkout-body">
      <Link href="/carrito" className="checkout-back"><ArrowLeft size={18} aria-hidden="true" /> Volver al carrito</Link>
      <h1>Finalizar compra</h1>
      {priced && <a href="#checkout-resumen" className="checkout-jump squircle"><span>Total del pedido</span><strong>{money(priced.total)}</strong><span className="checkout-jump-go">Ver resumen</span></a>}
      <form className="checkout-grid" onSubmit={submit} noValidate>
        <div className="checkout-steps">
          <section className="checkout-card squircle" aria-labelledby="checkout-delivery">
            <h2 id="checkout-delivery"><span>1</span> Entrega</h2>
            <div className="choice-list" role="radiogroup" aria-label="Forma de entrega">
              <label className="choice squircle" data-checked={!pickup}><input type="radio" name="entrega" className="sr-only" checked={!pickup} onChange={() => setPickup(false)} /><Truck size={24} weight="fill" aria-hidden="true" /><span><strong>Envío a domicilio</strong><small>A cualquier ciudad de Colombia.</small></span></label>
              {options?.shipping.pickup !== false && <label className="choice squircle" data-checked={pickup}><input type="radio" name="entrega" className="sr-only" checked={pickup} onChange={() => setPickup(true)} /><Storefront size={24} weight="fill" aria-hidden="true" /><span><strong>Recoger en la tienda</strong><small>{profile.pickupLine ? `${profile.pickupLine}. ` : ""}Sin costo.</small></span></label>}
            </div>
            {!pickup && (!addresses ? <p className="store-wait"><CircleNotch className="spin" size={18} aria-hidden="true" /> Cargando tus direcciones…</p>
              : adding ? <div className="checkout-new-address">
                  <h3>{addresses.length ? "Nueva dirección" : "¿A dónde lo enviamos?"}</h3>
                  <AddressForm start={{ recipient: contact ? `${contact.firstName} ${contact.lastName}`.trim() : session.shopper.name, phone: contact?.phone ?? "" }} submitLabel="Guardar y usar esta dirección"
                    onSaved={(saved) => { setAddresses((list) => [saved, ...(list ?? []).filter((a) => a.id !== saved.id)]); setChosen(saved.id); setAdding(false) }}
                    onCancel={addresses.length ? () => setAdding(false) : undefined} />
                </div>
              : <>
                  <div className="address-choices" role="radiogroup" aria-label="Dirección de entrega">{addresses.map((a) => (
                    <label key={a.id} className="address-choice" data-checked={chosen === a.id || undefined}>
                      <input type="radio" name="direccion" className="sr-only" checked={chosen === a.id} onChange={() => setChosen(a.id)} />
                      <AddressCard address={a} />
                    </label>))}
                  </div>
                  <div className="address-choices-more">
                    <button type="button" className="order-other squircle" onClick={() => setAdding(true)}><Plus size={18} aria-hidden="true" /> Agregar otra dirección</button>
                    <Link href="/cuenta" className="link-arrow">Editar mis direcciones</Link>
                  </div>
                </>)}
            <label className="store-field"><span>Nota para el pedido<span className="store-field-optional"> (opcional)</span></span>
              <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Horario de entrega, a nombre de quién va la factura…" />
            </label>
          </section>

          <section className="checkout-card squircle" aria-labelledby="checkout-contact">
            <h2 id="checkout-contact"><span>2</span> Tus datos</h2>
            <p className="checkout-hint">Compras con <strong>{session.shopper.email}</strong>. Estos datos van en tu pedido y en la factura, y quedan guardados para la próxima.</p>
            {!contact ? <p className="store-wait"><CircleNotch className="spin" size={18} aria-hidden="true" /> Cargando tus datos…</p> : <ProfileFields profile={contact} onChange={setContact} shown={shown} idPrefix="checkout" />}
          </section>

          <section className="checkout-card squircle" aria-labelledby="checkout-payment">
            <h2 id="checkout-payment"><span>3</span> Pago</h2>
            {!options ? (loadError ? <p className="store-alert" role="alert">No pudimos cargar el medio de pago. Revisa tu conexión.</p> : <p className="store-wait"><CircleNotch className="spin" size={18} aria-hidden="true" /> Cargando…</p>)
              : !payment ? (
                <div className="store-alert" role="alert"><span>La tienda no está recibiendo pagos por la página en este momento.</span>
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={16} weight="fill" aria-hidden="true" /> Termina tu compra por WhatsApp</a></div>
              ) : (() => { const text = paymentText[payment.code]; const Icon = text.icon; return (
                <div className="choice squircle" data-checked="true"><Icon size={24} weight="fill" aria-hidden="true" /><span><strong>{payment.label}</strong><small>{text.hint}</small></span></div>
              ) })()}
            {payment?.test && <p className="test-mode squircle" role="note"><Flask size={18} weight="fill" aria-hidden="true" /> Modo de pruebas: no se hará ningún cobro real.</p>}
          </section>
        </div>

        <aside id="checkout-resumen" className="order-summary squircle" aria-label="Tu pedido" aria-busy={checking}>
          <h2>Tu pedido</h2>
          {failed && !priced ? <p className="store-alert" role="alert">No pudimos calcular tu pedido. Revisa tu conexión.</p> : !priced ? <p className="store-wait"><CircleNotch className="spin" size={18} aria-hidden="true" /> Calculando…</p> : (
            <>
              <ul className="summary-lines">
                {priced.lines.map((line) => { const src = quoteImageSrc(line); return (
                  <li key={line.productId} data-problem={Boolean(line.problem)}>
                    <span className="summary-photo squircle">{src ? <img {...optimized(src, { sizes: "56px", width: 56 })} alt="" width={56} height={56} loading="lazy" decoding="async" /> : <ImageSquare size={20} aria-hidden="true" />}<b>{line.quantity}</b></span>
                    <span className="summary-title">{line.title}{line.problem && <small>{line.problem}</small>}</span>
                    <span className="summary-price">{money(line.total)}</span>
                  </li>
                ) })}
              </ul>
              <CouponField code={cart.coupon} applied={Boolean(priced.coupon)} discount={priced.discount} error={quote?.couponError ?? null} checking={checking} onApply={cart.setCoupon} />
              <dl>
                <div><dt>Productos</dt><dd>{money(priced.goods)}</dd></div>
                {priced.discount > 0 && <div className="order-summary-discount"><dt>Cupón {priced.coupon}</dt><dd>−{money(priced.discount)}</dd></div>}
                <div><dt>Envío</dt><dd>{priced.shipping === null ? (pickup ? "Sin costo" : "Elige la dirección") : priced.shipping === 0 ? "Gratis" : money(priced.shipping)}</dd></div>
                <div className="order-summary-total"><dt>Total</dt><dd>{money(priced.total)}</dd></div>
              </dl>
              <p className="cart-note">Incluye {money(priced.tax)} de IVA.</p>
            </>
          )}
          {cartProblem && <p className="store-alert" role="alert">{cartProblem}. <Link href="/carrito">Revisa tu carrito</Link>.</p>}
          <p className="checkout-cancel-rule">{cancels ? "Puedes cancelar tu pedido desde tu cuenta mientras no haya salido; te devolvemos el dinero. Cuando ya salió, no se cancela desde la tienda." : "Para cancelar tu pedido antes de que salga, escríbenos. Cuando ya salió, no se cancela desde la tienda."}</p>
          <label className="checkout-terms"><input type="checkbox" checked={accepts} onChange={(e) => setAccepts(e.target.checked)} /> <span>Acepto {legal.length === 0 ? "las condiciones de compra de la tienda" : legal.map((l, i) => <span key={l.href}>{i > 0 && (i === legal.length - 1 ? " y " : ", ")}{l.label.startsWith("Términos") ? "los " : "la "}<a href={l.href} target="_blank" rel="noopener noreferrer">{l.label.charAt(0).toLowerCase() + l.label.slice(1)}</a></span>)} y autorizo el tratamiento de mis datos para este pedido.</span></label>
          {error && <p className="store-alert" role="alert">{error}</p>}
          <button type="submit" className="button-primary" disabled={busy || !priced || Boolean(cartProblem) || !payment}>{busy ? <><CircleNotch className="spin" size={18} aria-hidden="true" /> Creando tu pedido…</> : <><Lock size={18} weight="fill" aria-hidden="true" /> {payment?.code === "manual" ? "Hacer el pedido" : payment?.test ? "Ir a pagar (prueba)" : "Ir a pagar"}</>}</button>
          <p className="cart-note">{payment?.code === "manual" ? "Te mostramos los datos para pagar al terminar." : `Tus datos de pago los recibe la pasarela, no ${profile.shortName}.`}</p>
        </aside>
      </form>
    </div>
  )
}
