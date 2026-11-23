"use client"

import { useRef, useState, type DragEvent, type FormEvent } from "react"
import { CheckCircle, CloudArrowUp, EnvelopeSimple, FilePdf, Receipt, WhatsappLogo } from "@phosphor-icons/react"
import { channelLabel, invoiceFileError, invoiceMessage, type Invoice } from "../domain/invoice"
import { Dialog, Failure, Loading, useLoad } from "../../shared/ui/parts"
import { whatsappNumber } from "../../shared/ui/rich"
import { useSession } from "../../shared/ui/admin-context"
import { useStoreProfile } from "../../shared/ui/store-profile"
import { useOrdersPort } from "./use-orders"

/**
 * Sends an order's invoice. The store makes it in its own billing program: here the PDF is attached and goes to the
 * customer by email (as an attachment) or WhatsApp (as a download link). Sending it finishes the order.
 */
export function InvoiceDialog({ orderId, onClose, onSent }: { orderId: string; onClose: () => void; onSent: () => void }) {
  const api = useOrdersPort()
  const profile = useStoreProfile()
  const { csrf, notify } = useSession()
  const order = useLoad(() => api.get(orderId), [orderId])
  const saved = useLoad(() => api.invoice(orderId), [orderId])
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const current = invoice ?? saved.data
  const o = order.data

  const [file, setFile] = useState<File | null>(null), [number, setNumber] = useState(""), [replacing, setReplacing] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [busy, setBusy] = useState<"" | "upload" | "email" | "whatsapp">(""), [error, setError] = useState("")
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const customerEmail = o ? o.billing.email ?? o.customer?.email ?? "" : ""
  const to = email ?? customerEmail
  const phone = o ? whatsappNumber(o.billing.phone ?? o.customer?.phone) : null
  const hasFile = Boolean(current?.link)
  const showUpload = !hasFile || replacing

  function pick(files: File[]) {
    const chosen = files[0]
    if (!chosen) return
    const problem = invoiceFileError(chosen)
    setError(problem ?? "")
    setFile(problem ? null : chosen)
  }
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (!busy) pick(Array.from(e.dataTransfer.files)) }

  async function upload(e: FormEvent) {
    e.preventDefault(); if (!file) return
    setBusy("upload"); setError("")
    try { setInvoice(await api.attachInvoice(orderId, file, number, csrf)); setFile(null); setReplacing(false) }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo subir la factura") } finally { setBusy("") }
  }

  async function sendEmail(e: FormEvent) {
    e.preventDefault()
    setBusy("email"); setError("")
    try { await api.emailInvoice(orderId, to, csrf); notify(`Factura del pedido #${o?.number} enviada a ${to.trim().toLowerCase()}.`); onSent() }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo enviar el correo") } finally { setBusy("") }
  }

  async function sendWhatsapp() {
    if (!o || !current?.link || !phone) return
    const text = invoiceMessage({ firstName: o.billing.first_name ?? o.customer?.firstName, store: profile.name, orderNumber: o.number, invoiceNumber: current.number, link: current.link })
    // opened inside the click, so the browser does not block it; the team presses send in WhatsApp
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer")
    setBusy("whatsapp"); setError("")
    try { await api.whatsappInvoice(orderId, csrf); notify(`Factura del pedido #${o.number} enviada por WhatsApp.`); onSent() }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo marcar la factura como enviada") } finally { setBusy("") }
  }

  const failed = order.error || saved.error
  return <Dialog eyebrow={o ? `Pedido #${o.number}` : "Pedido"} title="Enviar factura" busy={Boolean(busy)} onClose={onClose}
    media={<span className="glass-panel-icon"><Receipt size={20} aria-hidden="true" /></span>}>
    {failed ? <Failure message={failed} onRetry={() => { order.reload(); saved.reload() }} /> : !o || !current ? <Loading label="Cargando factura" rows={3} /> : <div className="grid gap-6">
      <p className="text-sm text-stone-600">Sube el PDF que sacaste de tu programa de facturación y envíaselo al cliente. Al enviarlo, el pedido queda finalizado.</p>
      {current.status === "sent" && <p className="glass-banner" role="status"><CheckCircle size={16} aria-hidden="true" />Ya se envió por {channelLabel(current.channels)}. Puedes enviarla de nuevo.</p>}
      {error && <p role="alert" className="glass-alert">{error}</p>}

      <section className="grid gap-4" aria-labelledby={`invoice-file-${orderId}`}>
        <h3 id={`invoice-file-${orderId}`} className="text-sm font-semibold">1. El PDF de la factura</h3>
        {hasFile && !replacing && <div className="glass-subpanel flex flex-wrap items-center gap-4">
          <FilePdf size={28} aria-hidden="true" className="shrink-0 text-stone-500" />
          <div className="min-w-0 flex-1"><p className="truncate font-semibold">{current.fileName}</p>{current.number && <p className="text-xs text-stone-500">Factura {current.number}</p>}</div>
          <a className="glass-chip" href={api.invoiceFileUrl(orderId)} target="_blank" rel="noreferrer">Ver PDF</a>
          <button type="button" className="glass-chip" disabled={Boolean(busy)} onClick={() => { setReplacing(true); setNumber(current.number ?? "") }}>Reemplazar</button>
        </div>}
        {showUpload && <form onSubmit={upload} className="grid gap-4">
          <div className="glass-dropzone" data-over={over || undefined} data-compact={file ? true : undefined}
            onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true) } }} onDragLeave={() => setOver(false)} onDrop={drop}>
            {file ? <FilePdf size={28} aria-hidden="true" /> : <CloudArrowUp size={36} aria-hidden="true" />}
            <div className="min-w-0">{file ? <p className="truncate font-semibold">{file.name}</p> : <><p className="font-semibold">Arrastra el PDF aquí</p><p className="mt-1 text-xs text-stone-500">Un PDF de hasta 10 MB.</p></>}</div>
            <button type="button" className="glass-chip" disabled={Boolean(busy)} onClick={() => input.current?.click()}>{file ? "Elegir otro" : "Elegir archivo"}</button>
            <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={e => { pick(Array.from(e.target.files ?? [])); e.target.value = "" }} />
          </div>
          <label className="glass-label">Número de factura (opcional)<input className="glass-field" value={number} maxLength={40} onChange={e => setNumber(e.target.value)} placeholder="Por ejemplo FV 1234" /></label>
          <div className="flex flex-wrap justify-end gap-2">
            {replacing && <button type="button" className="glass-chip" disabled={Boolean(busy)} onClick={() => { setReplacing(false); setFile(null) }}>Cancelar</button>}
            <button className="glass-cta" disabled={!file || Boolean(busy)}>{busy === "upload" ? "Subiendo…" : "Subir factura"}</button>
          </div>
        </form>}
      </section>

      <section className="grid gap-4" aria-labelledby={`invoice-send-${orderId}`} aria-disabled={!hasFile || undefined}>
        <h3 id={`invoice-send-${orderId}`} className="text-sm font-semibold">2. Enviarla al cliente</h3>
        {!hasFile && <p className="text-sm text-stone-500">Primero sube el PDF.</p>}
        <form onSubmit={sendEmail} className="grid gap-2">
          <label className="glass-label">Correo del cliente<input className="glass-field" type="email" value={to} onChange={e => setEmail(e.target.value)} placeholder="cliente@correo.com" disabled={!hasFile} /></label>
          <button className="glass-cta w-fit" disabled={!hasFile || !to.trim() || Boolean(busy)}><EnvelopeSimple size={16} aria-hidden="true" />{busy === "email" ? "Enviando…" : "Enviar por correo"}</button>
          <p className="text-xs text-stone-500">Le llega con el PDF adjunto y un enlace para descargarla.</p>
        </form>
        <div className="grid gap-2">
          <button type="button" className="glass-chip w-fit" disabled={!hasFile || !phone || Boolean(busy)} onClick={() => void sendWhatsapp()}><WhatsappLogo size={16} aria-hidden="true" />{busy === "whatsapp" ? "Guardando…" : "Abrir WhatsApp"}</button>
          <p className="text-xs text-stone-500">{phone ? "Se abre el chat del cliente con el mensaje y el enlace de descarga; solo tienes que enviarlo." : "El pedido no tiene un celular colombiano para WhatsApp."}</p>
        </div>
      </section>
    </div>}
  </Dialog>
}
