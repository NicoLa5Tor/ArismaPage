import { Star } from "@phosphor-icons/react/ssr"

/** Read-only rating: five stars with the filled part clipped to the average, plus the text assistive tech reads. */
export function Stars({ value, size = 18, label }: { value: number; size?: number; label?: string }) {
  const percent = Math.max(0, Math.min(100, (value / 5) * 100))
  const row = (weight: "fill" | "regular") => Array.from({ length: 5 }, (_, index) => <Star key={index} size={size} weight={weight} aria-hidden="true" />)
  return (
    <span className="stars" role="img" aria-label={label ?? `${value.toLocaleString("es-CO", { maximumFractionDigits: 1 })} de 5 estrellas`}>
      <span className="stars-empty">{row("regular")}</span>
      <span className="stars-full" style={{ width: `${percent}%` }}>{row("fill")}</span>
    </span>
  )
}
