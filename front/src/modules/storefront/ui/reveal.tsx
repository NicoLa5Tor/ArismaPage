"use client"

import { useEffect, useRef, type ReactNode } from "react"

/** Fades its content up the first time it enters the screen (IntersectionObserver, no scroll listener). CSS holds the motion and its reduced-motion fallback. */
export function Reveal({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!("IntersectionObserver" in window)) { el.dataset.visible = "true"; return }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { (entry.target as HTMLElement).dataset.visible = "true"; observer.unobserve(entry.target) }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return <Tag ref={ref as never} className={`reveal ${className}`}>{children}</Tag>
}
