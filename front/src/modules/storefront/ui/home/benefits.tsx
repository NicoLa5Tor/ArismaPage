"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { Baby, ChalkboardTeacher, type Icon, Quotes, Truck, WhatsappLogo } from "@phosphor-icons/react"
import { formatCount } from "../../domain/catalog"
import { type Benefit, benefitsFor, store, voices } from "../../domain/home"
import { useStoreProfile } from "../../../shared/ui/store-profile"
import { Marquee } from "./marquee"
import { prefersReducedMotion, useInView } from "./scene"

const icons: Record<Benefit["id"], Icon> = { age: Baby, classroom: ChalkboardTeacher, quote: WhatsappLogo, shipping: Truck }

type Stat = { value: number; from: number; label: string; format: (value: number) => string }

/** Counts up to a real figure the first time it is seen. The final value is what the server renders. */
function CountUp({ stat, run }: { stat: Stat; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!run || !node || prefersReducedMotion()) return
    const counter = { value: stat.from }
    const tween = gsap.to(counter, { value: stat.value, duration: 1.8, ease: "power3.out", onUpdate: () => { node.textContent = stat.format(Math.round(counter.value)) } })
    return () => { tween.kill(); node.textContent = stat.format(stat.value) }
  }, [run, stat])
  return <span ref={ref} className="stat-value">{stat.format(stat.value)}</span>
}

export function Benefits({ productCount, categoryCount }: { productCount: number; categoryCount: number }) {
  const benefits = benefitsFor(useStoreProfile())
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.2 })
  const [statsRef, statsShown] = useInView<HTMLDListElement>({ threshold: 0.4 })
  const stats: Stat[] = [
    { value: store.since, from: 1950, label: "Año en que empezamos a acompañar a padres y maestros", format: String },
    ...(productCount > 0 ? [{ value: productCount, from: 0, label: "Productos publicados hoy en el catálogo", format: formatCount }] : []),
    ...(categoryCount > 0 ? [{ value: categoryCount, from: 0, label: "Categorías para explorar por edad y por área", format: String }] : []),
    { value: store.warrantyMonths, from: 0, label: "Meses de garantía por defectos de fabricación", format: String },
  ]
  return (
    <section id="beneficios" className="benefits" aria-labelledby="beneficios-titulo">
      <div className="home-inner">
        <div className="section-head">
          <div>
            <p className="eyebrow">Por qué Arisma</p>
            <h2 id="beneficios-titulo">Comprar material didáctico sin adivinar</h2>
          </div>
        </div>
        <div ref={ref} className="benefits-grid" data-shown={shown}>
          {benefits.map((benefit, index) => {
            const BenefitIcon = icons[benefit.id]
            return (
              <article key={benefit.id} className="benefit squircle reveal" data-tone={benefit.tone} style={{ "--i": index } as React.CSSProperties}>
                <span className="benefit-icon squircle"><BenefitIcon size={32} weight="duotone" aria-hidden="true" /></span>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </article>
            )
          })}
        </div>
        <dl ref={statsRef} className="stats" data-shown={statsShown}>
          {stats.map((stat, index) => (
            <div key={stat.label} className="stat reveal" style={{ "--i": index } as React.CSSProperties}>
              <dt>{stat.label}</dt>
              <dd><CountUp stat={stat} run={statsShown} /></dd>
            </div>
          ))}
        </dl>
      </div>
      <Marquee className="voices" label="Opiniones de clientes">
        {voices.map((voice) => (
          <figure key={voice.name} className="voice squircle">
            <Quotes size={28} weight="fill" aria-hidden="true" />
            <blockquote><p>{voice.quote}</p></blockquote>
            <figcaption><strong>{voice.name}</strong><span>{voice.about}</span></figcaption>
          </figure>
        ))}
      </Marquee>
    </section>
  )
}
