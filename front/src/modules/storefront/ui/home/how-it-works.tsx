"use client"

import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ArrowRight, Bank, Checks, CreditCard, MagnifyingGlass, Package, Truck, WhatsappLogo } from "@phosphor-icons/react"
import { stepArt, stepPayments, stepShipping, steps } from "../../domain/home"
import { useStoreProfile } from "../../../shared/ui/store-profile"
import { type Scene, useScene } from "./scene"
import { optimized } from "../../../shared/ui/optimized-image"

const LAST = steps.length - 1

// The section is four screens tall and its stage sticks: the page waits while the scroll walks the timeline. Each step
// owns a third of that scroll, so a card is always shown whole; the rail fills up to the node of the step on screen.
function build(root: HTMLElement, { desktop, short }: Scene) {
  // too low to pin a stage (a phone held sideways): the three cards stay as a plain list
  if (short) return
  const cards = gsap.utils.toArray<HTMLElement>(".how-card", root)
  const nodes = gsap.utils.toArray<HTMLButtonElement>(".how-node", root)
  let current = -1
  const show = (step: number) => {
    if (step === current) return
    current = step
    cards.forEach((card, index) => { card.dataset.state = index === step ? "active" : index < step ? "past" : "next" })
    nodes.forEach((node, index) => { node.dataset.state = index === step ? "active" : index < step ? "past" : "next"; node.setAttribute("aria-current", index === step ? "step" : "false") })
  }
  root.dataset.live = "true"
  show(0)

  const walk = ScrollTrigger.create({
    trigger: root, start: "top top", end: "bottom bottom",
    onUpdate: (self) => show(Math.min(LAST, Math.floor(self.progress * steps.length))),
  })
  // the rail reaches the last node when the last step starts, then holds while that step is read
  const railEnd = () => `+=${((root.offsetHeight - window.innerHeight) * LAST) / steps.length}`
  const rail = { trigger: root, start: "top top", end: railEnd, scrub: 0.5, invalidateOnRefresh: true }
  gsap.fromTo(".how-rail-fill", desktop ? { scaleY: 0 } : { scaleX: 0 }, { ...(desktop ? { scaleY: 1 } : { scaleX: 1 }), ease: "none", scrollTrigger: rail })
  if (desktop) gsap.fromTo(".how-rail-toy", { y: 0 }, { y: () => root.querySelector<HTMLElement>(".how-rail-track")!.offsetHeight, ease: "none", scrollTrigger: rail })

  const jump = (event: Event) => {
    const index = nodes.indexOf(event.currentTarget as HTMLButtonElement)
    window.scrollTo({ top: walk.start + ((index + 0.5) / steps.length) * (walk.end - walk.start) })
  }
  nodes.forEach((node) => node.addEventListener("click", jump))
  return () => {
    nodes.forEach((node) => { node.removeEventListener("click", jump); delete node.dataset.state; node.removeAttribute("aria-current") })
    cards.forEach((card) => { delete card.dataset.state })
    delete root.dataset.live
  }
}

function StepArt({ id, product }: { id: (typeof steps)[number]["id"]; product: string }) {
  const profile = useStoreProfile()
  if (id === "choose") {
    return (
      <div className="how-art how-art-choose" aria-hidden="true">
        <div className="how-fan">{stepArt.photos.map((photo) => <img key={photo} {...optimized(photo, { sizes: "320px", width: 320 })} alt="" width={320} height={240} loading="lazy" />)}</div>
        <p className="how-search squircle"><MagnifyingGlass size={20} weight="bold" /> Regalo para una niña de 6 años <span><ArrowRight size={16} weight="bold" /></span></p>
      </div>
    )
  }
  if (id === "quote") {
    return (
      <div className="how-art how-chat" aria-hidden="true">
        <p className="how-chat-head"><WhatsappLogo size={20} weight="fill" /> Arisma</p>
        <p className="how-bubble is-mine" style={{ "--i": 0 } as React.CSSProperties}>Hola, quiero cotizar: {product} <Checks size={16} weight="bold" /></p>
        <p className="how-bubble" style={{ "--i": 1 } as React.CSSProperties}>{stepArt.reply}</p>
      </div>
    )
  }
  return (
    <div className="how-art how-art-receive" aria-hidden="true">
      <div className="how-box">
        <img {...optimized(stepArt.toy, { sizes: "(min-width: 64rem) 40vw, 80vw", width: 800 })} alt="" width={789} height={800} loading="lazy" />
        <span className="how-box-front squircle"><Package size={40} weight="duotone" /></span>
      </div>
      <ul className="how-pay">
        {stepPayments(profile).map((payment, index) => <li key={payment} style={{ "--i": index } as React.CSSProperties}>{payment === "Tarjeta" ? <CreditCard size={16} weight="fill" /> : payment === "Bancolombia" || payment === "Transferencia" ? <Bank size={16} weight="fill" /> : null} {payment}</li>)}
      </ul>
      <p className="how-ship"><Truck size={20} weight="fill" /> {stepShipping(profile)}</p>
    </div>
  )
}

/** `product` is the name used in the sample WhatsApp message: the store's real best seller when the catalog answers. */
export function HowItWorks({ product = stepArt.fallbackProduct }: { product?: string }) {
  const ref = useScene<HTMLElement>(build)
  return (
    <section ref={ref} id="como-funciona" className="how" aria-labelledby="como-funciona-titulo">
      <div className="how-stage">
        <div className="home-inner how-inner">
          <div className="how-side">
            <div className="how-heading">
              <p className="eyebrow">Cómo funciona</p>
              <h2 id="como-funciona-titulo">Tres pasos del catálogo a tu puerta</h2>
            </div>
            <div className="how-rail">
              <span className="how-rail-track" aria-hidden="true"><span className="how-rail-fill" /></span>
              <img className="how-rail-toy" {...optimized(stepArt.marker, { sizes: "(min-width: 64rem) 20vw, 40vw", width: 800 })} alt="" aria-hidden="true" width={800} height={559} loading="lazy" />
              <ol>
                {steps.map((step, index) => (
                  <li key={step.id}>
                    <button type="button" className="how-node" data-tone={step.tone} aria-label={`Paso ${index + 1}: ${step.title}`}>
                      <span className="how-node-dot" aria-hidden="true">{index + 1}</span>
                      <span className="how-node-label" aria-hidden="true">{step.title}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="how-cards">
            {steps.map((step, index) => (
              <article key={step.id} className="how-card squircle" data-tone={step.tone}>
                <div className="how-card-copy">
                  <span className="how-card-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <h3><span className="sr-only">Paso {index + 1}: </span>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
                <StepArt id={step.id} product={product} />
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
