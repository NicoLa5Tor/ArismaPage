"use client"

import { Minus, Plus } from "@phosphor-icons/react"

/** Units of one product: − and + around the number, bounded by what one order may carry. */
export function Quantity({ value, max, onChange, label, size = "md" }: { value: number; max: number; onChange: (value: number) => void; label: string; size?: "sm" | "md" }) {
  const atMax = value >= max
  return (
    <div className="quantity squircle" data-size={size} role="group" aria-label={label}>
      <button type="button" aria-label="Quitar una unidad" disabled={value <= 1} onClick={() => onChange(value - 1)}><Minus size={16} weight="bold" aria-hidden="true" /></button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="Agregar una unidad" disabled={atMax} title={atMax ? `Máximo ${max} por pedido` : undefined} onClick={() => onChange(value + 1)}><Plus size={16} weight="bold" aria-hidden="true" /></button>
    </div>
  )
}
