"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ShoppingBag, Warning } from "@phosphor-icons/react"

// Adapted from 21st.dev "Add to Cart Button" (bidyut10): one fixed icon slot and stacked labels that crossfade between
// phases, so the button never changes size. Adding is instant here, so the phases are idle → added (or full) → idle.

type Phase = "idle" | "added" | "full"

export function AddToCartButton({ onAdd, label = "Agregar al carrito", className = "", disabled }: { onAdd: () => { added: number; full: boolean }; label?: string; className?: string; disabled?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle")
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const click = () => {
    if (phase !== "idle") return
    const result = onAdd()
    setPhase(result.added > 0 ? "added" : "full")
    timer.current = window.setTimeout(() => setPhase("idle"), 1800)
  }
  const message = phase === "added" ? "Agregado al carrito" : phase === "full" ? "Ya llevas el máximo" : ""
  const layers: { phase: Phase; text: string; icon: React.ReactNode }[] = [
    { phase: "idle", text: label, icon: <ShoppingBag size={20} weight="fill" /> },
    { phase: "added", text: "Agregado al carrito", icon: <Check size={20} weight="bold" /> },
    { phase: "full", text: "Ya llevas el máximo", icon: <Warning size={20} weight="fill" /> },
  ]
  return (
    <button type="button" className={`add-to-cart squircle ${className}`} data-phase={phase} disabled={disabled} aria-disabled={phase !== "idle" || undefined} onClick={click}>
      <span className="sr-only" aria-live="polite">{message}</span>
      <span className="add-to-cart-icon" aria-hidden="true">{layers.map((layer) => <span key={layer.phase} data-on={phase === layer.phase}>{layer.icon}</span>)}</span>
      <span className="add-to-cart-label">{layers.map((layer) => <span key={layer.phase} data-on={phase === layer.phase} aria-hidden={phase !== layer.phase}>{layer.text}</span>)}</span>
    </button>
  )
}
