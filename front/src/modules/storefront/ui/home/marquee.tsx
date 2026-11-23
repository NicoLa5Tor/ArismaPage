"use client"

import { type ReactNode, useState } from "react"
import { Pause, Play } from "@phosphor-icons/react"

/**
 * Endless row. The copy that makes the loop seamless is hidden from assistive tech; hover or focus pauses it, and the
 * button under it pauses it on touch screens too (moving content must be stoppable).
 */
export function Marquee({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  const [paused, setPaused] = useState(false)
  return (
    <div className="marquee-wrap" data-paused={paused}>
      <div className={`marquee ${className}`} role={label ? "group" : undefined} aria-label={label}>
        <div className="marquee-group">{children}</div>
        <div className="marquee-group" aria-hidden="true" inert>{children}</div>
      </div>
      <button type="button" className="marquee-toggle" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
        {paused ? <Play size={16} weight="fill" aria-hidden="true" /> : <Pause size={16} weight="fill" aria-hidden="true" />}
        {paused ? "Reanudar" : "Pausar"}
      </button>
    </div>
  )
}
