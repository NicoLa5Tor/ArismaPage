"use client"

import { useState, type FormEvent } from "react"
import { CheckCircle, CircleNotch, Ticket, X } from "@phosphor-icons/react"
import { money } from "../domain/checkout"

/**
 * "¿Tienes un cupón?": the code is kept with the cart and the store decides, on every quote, whether it applies.
 * `applied` and `error` come from the latest quote; `checking` is true while it is being asked.
 */
export function CouponField({ code, applied, discount, error, checking, onApply }: { code: string; applied: boolean; discount: number; error: string | null; checking: boolean; onApply: (code: string) => void }) {
  const [open, setOpen] = useState(Boolean(code))
  const [draft, setDraft] = useState(code)
  const submit = (event: FormEvent) => { event.preventDefault(); onApply(draft.trim()) }

  if (code && applied) return (
    <p className="coupon-applied squircle" role="status">
      <CheckCircle size={18} weight="fill" aria-hidden="true" /> <span>Cupón <strong>{code}</strong>: ahorras {money(discount)}</span>
      <button type="button" aria-label={`Quitar el cupón ${code}`} onClick={() => { setDraft(""); onApply("") }}><X size={16} aria-hidden="true" /></button>
    </p>
  )
  if (!open) return <button type="button" className="coupon-toggle" onClick={() => setOpen(true)}><Ticket size={18} aria-hidden="true" /> ¿Tienes un cupón?</button>
  return (
    <form className="coupon-form" onSubmit={submit} noValidate>
      <label className="store-field">Código del cupón
        <span className="coupon-row">
          <input value={draft} maxLength={40} autoComplete="off" spellCheck={false} onChange={(e) => setDraft(e.target.value.toUpperCase())} aria-invalid={Boolean(code && error)} />
          <button type="submit" className="order-other squircle" disabled={checking || !draft.trim()}>{checking && draft === code ? <CircleNotch className="spin" size={16} aria-hidden="true" /> : "Aplicar"}</button>
        </span>
      </label>
      {code && error && !checking && <p className="store-field-error" role="alert">{error}</p>}
    </form>
  )
}
