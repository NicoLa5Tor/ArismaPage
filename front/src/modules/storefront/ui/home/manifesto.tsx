"use client"

import gsap from "gsap"
import { SplitText } from "gsap/SplitText"
import { manifesto, manifestoToys } from "../../domain/home"
import { type Scene, useScene } from "./scene"
import { optimized } from "../../../shared/ui/optimized-image"

// The page lands here from the dive into the logo: real toys pop in and drift past at different depths, the words
// light up as the shopper scrolls, and a circle opens from the floor to hand over to the catalog.
function build(root: HTMLElement, { desktop }: Scene) {
  const split = SplitText.create(root.querySelectorAll(".manifesto-line"), { type: "words" })
  const depth = (toy: HTMLElement) => Number(toy.dataset.depth)
  const stage = root.querySelector<HTMLElement>(".manifesto-stage")!
  const rise = () => -(stage.offsetHeight + root.querySelector<HTMLElement>(".manifesto-wave svg")!.getBoundingClientRect().height)
  gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true } })
    .fromTo(".manifesto-toy > span", { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.3, stagger: 0.06, ease: "back.out(1.6)" }, 0)
    .fromTo(".manifesto-toy", { y: (_, toy: HTMLElement) => depth(toy) * 64, rotate: (_, toy: HTMLElement) => -Number(toy.dataset.tilt) }, { y: (_, toy: HTMLElement) => depth(toy) * -64, rotate: (_, toy: HTMLElement) => Number(toy.dataset.tilt), duration: 2.4 }, 0)
    .fromTo(".manifesto-eyebrow", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 0)
    .fromTo(split.words, { opacity: 0.2 }, { opacity: 1, duration: 0.3, stagger: 0.1 }, 0.1)
    // two waves roll in from the floor, each drifting its own way, and the front one floods the screen with the next section's colour
    .fromTo(".manifesto-wave.is-back", { y: 0, xPercent: 0 }, { y: rise, xPercent: 25, duration: 0.8, ease: "power2.in" }, 1.55)
    .fromTo(".manifesto-wave.is-front", { y: 0, xPercent: 0 }, { y: rise, xPercent: -25, duration: 0.8, ease: "power2.in" }, 1.7)

  if (!desktop) return
  const followers = gsap.utils.toArray<HTMLElement>(".manifesto-toy img", root).map((toy) => ({
    x: gsap.quickTo(toy, "x", { duration: 0.9, ease: "power3.out" }), y: gsap.quickTo(toy, "y", { duration: 0.9, ease: "power3.out" }), reach: 48 * depth(toy.closest<HTMLElement>(".manifesto-toy")!),
  }))
  const move = (event: PointerEvent) => {
    const x = event.clientX / window.innerWidth - 0.5
    const y = event.clientY / window.innerHeight - 0.5
    for (const follower of followers) { follower.x(x * follower.reach); follower.y(y * follower.reach) }
  }
  root.addEventListener("pointermove", move)
  return () => root.removeEventListener("pointermove", move)
}

export function Manifesto() {
  const ref = useScene<HTMLElement>(build)
  return (
    <section ref={ref} className="manifesto" aria-label="Lema de Arisma">
      <div className="manifesto-stage">
        <div className="manifesto-toys" aria-hidden="true">
          {manifestoToys.map((toy) => (
            <div key={toy.id} className="manifesto-toy" data-toy={toy.id} data-depth={toy.depth} data-tilt={toy.tilt} style={{ "--size": toy.size } as React.CSSProperties}>
              <span><img {...optimized(toy.src, { sizes: `${toy.size}vw`, width: toy.width })} alt="" width={toy.width} height={toy.height} loading="lazy" decoding="async" /></span>
            </div>
          ))}
        </div>
        <div className="manifesto-copy">
          <p className="manifesto-eyebrow">{manifesto.eyebrow}</p>
          <p className="manifesto-text">{manifesto.lines.map((line) => <span key={line} className="manifesto-line">{line}</span>)}</p>
        </div>
        <div className="manifesto-waves" aria-hidden="true">
          <div className="manifesto-wave is-back"><svg viewBox="0 0 1440 120" preserveAspectRatio="none"><path d="M0 60 Q180 120 360 60 T720 60 T1080 60 T1440 60 V120 H0 Z" /></svg><span /></div>
          <div className="manifesto-wave is-front"><svg viewBox="0 0 1440 120" preserveAspectRatio="none"><path d="M0 60 Q180 0 360 60 T720 60 T1080 60 T1440 60 V120 H0 Z" /></svg><span /></div>
        </div>
      </div>
    </section>
  )
}
