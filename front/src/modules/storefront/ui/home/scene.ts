"use client"

import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"

/** `desktop`: wide screen with a mouse. `short`: a phone held sideways or any screen too low to pin a section. */
export type Scene = { desktop: boolean; short: boolean }
export type SceneBuilder<T extends HTMLElement> = (root: T, scene: Scene) => void | (() => void)

/**
 * Runs a GSAP scene scoped to the returned ref. Nothing runs with reduced motion, so every section must already look
 * finished in plain CSS. The scene is rebuilt when the layout crosses the desktop breakpoint and reverted on unmount.
 * Pass a module-level function as `build`, so it stays stable between renders.
 */
export function useScene<T extends HTMLElement>(build: SceneBuilder<T>) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    gsap.registerPlugin(ScrollTrigger, SplitText)
    const media = gsap.matchMedia(root)
    media.add({ motion: "(prefers-reduced-motion: no-preference)", desktop: "(min-width: 64rem) and (hover: hover)", short: "(max-height: 30rem)" }, (context) => {
      if (!context.conditions?.motion) return
      return build(root, { desktop: Boolean(context.conditions.desktop), short: Boolean(context.conditions.short) })
    })
    return () => media.revert()
  }, [build])
  return ref
}

/** IntersectionObserver reveal: `shown` turns true the first time the element is on screen (or follows it when `once` is false). */
export function useInView<T extends HTMLElement>({ threshold = 0.25, once = true }: { threshold?: number; once?: boolean } = {}) {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); if (once) observer.disconnect() } else if (!once) setShown(false)
    }, { threshold })
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, once])
  return [ref, shown] as const
}

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
