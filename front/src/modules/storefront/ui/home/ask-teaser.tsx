"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Sparkle } from "@phosphor-icons/react"
import { askExamples, askUrl } from "../../domain/home"
import { prefersReducedMotion, useInView } from "./scene"

// Three.js is a separate download, kept out of the page's first load.
const Orb = dynamic(() => import("../assistant/orb").then((module) => module.Orb), { ssr: false })

/**
 * True once the section is about a screen and a half away and the browser has a free moment: the sphere is set up
 * then, so it is already turning when the shopper reaches it, and phones that never scroll this far skip Three.js.
 * Safari has no requestIdleCallback.
 */
function useOrbReady(section: React.RefObject<HTMLElement | null>) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const node = section.current
    if (!node) return
    let idle = 0
    const start = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(() => setReady(true), { timeout: 1500 })
      else setReady(true)
    }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { observer.disconnect(); start() } }, { rootMargin: "150% 0px" })
    observer.observe(node)
    return () => { observer.disconnect(); if (idle) window.cancelIdleCallback(idle) }
  }, [section])
  return ready
}

/** Types the example questions one after another while the section is on screen. */
function useTypedExample(active: boolean) {
  const [text, setText] = useState(askExamples[0])
  useEffect(() => {
    if (!active || prefersReducedMotion()) return
    let example = 0
    let length = askExamples[0].length
    let direction = -1
    let timer = window.setTimeout(function tick() {
      length += direction
      setText(askExamples[example].slice(0, length))
      let wait = direction > 0 ? 48 : 24
      if (direction > 0 && length === askExamples[example].length) { direction = -1; wait = 2000 }
      else if (direction < 0 && length === 0) { direction = 1; example = (example + 1) % askExamples.length; wait = 320 }
      timer = window.setTimeout(tick, wait)
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [active])
  return text
}

export function AskTeaser() {
  const [ref, visible] = useInView<HTMLElement>({ threshold: 0.2, once: false })
  const orbReady = useOrbReady(ref)
  const typed = useTypedExample(visible)
  return (
    <section ref={ref} id="preguntale" className="ask-teaser" aria-labelledby="preguntale-titulo">
      <div className="home-inner ask-teaser-inner">
        <div className="ask-teaser-copy">
          <p className="eyebrow"><Sparkle size={16} weight="fill" aria-hidden="true" /> Pregúntale a Arisma</p>
          <h2 id="preguntale-titulo">Dinos para quién es y te mostramos qué le sirve</h2>
          <p>Escribe la edad, el tema o la ocasión. El buscador responde con productos reales del catálogo, listos para cotizar.</p>
          <Link href="/buscar" className="ask-teaser-box squircle" aria-label="Abrir Pregúntale a Arisma">
            <span className="ask-teaser-typed" aria-hidden="true">{typed}<i /></span>
            <span className="ask-teaser-send" aria-hidden="true"><ArrowRight size={20} weight="bold" /></span>
          </Link>
          <ul className="ask-teaser-chips" aria-label="Preguntas de ejemplo">
            {askExamples.map((example) => <li key={example}><Link href={askUrl(example)} className="ask-teaser-chip">{example}</Link></li>)}
          </ul>
        </div>
        <div className="ask-teaser-orb" aria-hidden="true">{orbReady && <Orb active={false} />}</div>
      </div>
    </section>
  )
}
