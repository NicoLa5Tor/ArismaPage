"use client"

import { useEffect } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import Lenis from "lenis"
import "lenis/dist/lenis.css"

/**
 * Inertial wheel scrolling for the home, in step with ScrollTrigger (touch screens and reduced motion keep native
 * scrolling). It also owns the one ScrollTrigger refresh of the page: whenever the page changes height (a lazy image
 * loads, fonts swap, a section grows) the triggers are measured again once, so no scene keeps stale start and end points.
 */
export function SmoothScroll() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const page = document.querySelector<HTMLElement>("main.storefront")
    let timer = 0, height = page?.offsetHeight ?? 0
    const resize = new ResizeObserver(() => {
      if (!page || Math.abs(page.offsetHeight - height) < 2) return
      height = page.offsetHeight
      window.clearTimeout(timer)
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 150)
    })
    if (page) resize.observe(page)
    const cleanup = () => { resize.disconnect(); window.clearTimeout(timer) }

    if (!window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return cleanup
    const lenis = new Lenis({ anchors: true })
    lenis.on("scroll", ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    return () => { cleanup(); gsap.ticker.remove(raf); gsap.ticker.lagSmoothing(500, 33); lenis.destroy() }
  }, [])
  return null
}
