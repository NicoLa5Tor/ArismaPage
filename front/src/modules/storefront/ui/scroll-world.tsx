"use client"

import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ArrowDown, CircleNotch, SealCheck, Sparkle } from "@phosphor-icons/react"
import { finale, heroUntil, outro, showcaseStops, showcaseVideo } from "../domain/showcase"
import { ArismaLogo } from "./arisma-logo"

type Status = "loading" | "ready" | "static"

const sparkles = [
  { x: -46, y: -38, size: 28 }, { x: 44, y: -44, size: 20 }, { x: 52, y: 30, size: 32 },
  { x: -50, y: 36, size: 22 }, { x: 4, y: -54, size: 16 }, { x: -10, y: 52, size: 18 },
]

// Scroll drives one GSAP timeline: the pre-rendered story video, then the Arisma logo, then a dive into the
// logo that hands over to the next (brand pink) section. The video is loaded as a blob so seeking works on
// static hosting, and seeks are coalesced: one in flight at a time, retried on `seeked`.
export function ScrollWorld({ proof }: { proof?: string }) {
  const sectionRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>("loading")
  const [time, setTime] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    const section = sectionRef.current
    if (!video || !section) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStatus("static"); return }

    let objectUrl = ""
    let seeking = false
    let wanted = 0
    const controller = new AbortController()

    const seek = () => {
      if (seeking || !video.duration) return
      if (Math.abs(video.currentTime - wanted) < 1 / 60) return
      seeking = true
      video.currentTime = wanted
    }
    const onSeeked = () => { seeking = false; seek() }
    video.addEventListener("seeked", onSeeked)

    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {
      const story = { t: 0 }
      const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 1, invalidateOnRefresh: true } })
      // The "camera" (video + logo together) flies into the pink counter of the A, so it reads as moving forward.
      const holeOrigin = () => {
        const icon = section.querySelector(".arisma-logo-icon")!.getBoundingClientRect()
        const stage = section.querySelector(".scroll-world-stage")!.getBoundingClientRect()
        return `${icon.left - stage.left + icon.width * 0.45}px ${icon.top - stage.top + icon.height * 0.62}px`
      }
      tl.to(story, { t: showcaseVideo.duration, duration: outro.videoEnd, onUpdate: () => { wanted = Math.min(story.t, (video.duration || showcaseVideo.duration) - 0.06); setTime(story.t); seek() } }, 0)
        .to(".scroll-world-fade", { autoAlpha: 0, duration: 0.05, ease: "power1.inOut" }, outro.videoEnd - 0.03)
        .fromTo(".arisma-logo", { autoAlpha: 0, scale: 0.96 }, { autoAlpha: 1, scale: 1, duration: 0.08, ease: "power1.inOut" }, outro.logoIn)
        .fromTo(".arisma-logo-didacticos", { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.05, ease: "power2.out" }, outro.logoIn + 0.04)
        .fromTo(".scroll-world-sparkle", { autoAlpha: 0, scale: 0, rotate: -90 }, { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.04, stagger: 0.008, ease: "back.out(2.5)" }, outro.logoIn + 0.04)
        // Dive: the whole camera pushes in a little, then the heavy video dissolves into the brand pink behind it and only the vector A keeps
        // growing, so the browser never composites a huge video layer. Once pink covers the screen the camera stops painting.
        .set(".scroll-world-camera", { transformOrigin: holeOrigin }, outro.dive)
        .set(".arisma-logo", { transformOrigin: "15.43% 49.1%" }, outro.dive)
        .to(".scroll-world-camera", { scale: 4, duration: 0.06, ease: "power2.in" }, outro.dive)
        .to([".scroll-world-sparkle", ".arisma-logo-risma", ".arisma-logo-didacticos"], { autoAlpha: 0, duration: 0.03 }, outro.dive + 0.02)
        .to(video, { autoAlpha: 0, duration: 0.04, ease: "power1.in" }, outro.dive + 0.02)
        .to(".arisma-logo", { scale: 20, duration: 1 - outro.dive - 0.08, ease: "power2.in" }, outro.dive + 0.06)
        .to(".scroll-world-cover", { autoAlpha: 1, duration: 0.02 }, 0.97)
        .set(".scroll-world-camera", { autoAlpha: 0 }, 0.995)
    }, section)

    // Phones held upright get the native 9:16 story; small landscape screens get a light 540p encode of the 16:9 one.
    // Every version is all keyframes, so scrubbing stays instant.
    const portrait = window.matchMedia("(orientation: portrait) and (max-width: 768px)").matches
    const src = portrait ? showcaseVideo.portraitSrc : window.matchMedia("(max-width: 768px)").matches ? showcaseVideo.mobileSrc : showcaseVideo.src
    if (portrait) video.poster = showcaseVideo.portraitPoster
    // The bytes are read into memory and wrapped as a Blob here: `response.blob()` needs the browser's blob storage,
    // which refuses a video this size on a device short of disk space (Chrome then reports "Failed to fetch").
    const download = (cache?: RequestCache) => fetch(src, { signal: controller.signal, cache })
      .then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.arrayBuffer() })
      .then((bytes) => new Blob([bytes], { type: "video/mp4" }))
    const play = (url: string) => {
      video.addEventListener("loadeddata", () => { setStatus("ready"); seek() }, { once: true })
      video.addEventListener("error", () => { ctx.revert(); setStatus("static") }, { once: true })
      video.preload = "auto"
      video.src = url
    }
    // A second try skips the browser cache (it can hold a broken copy); if both fail the video streams from its address,
    // which scrubs less smoothly but still tells the story. Only a video that cannot load at all leaves the still image.
    download()
      .catch((error: unknown) => { if ((error as Error).name === "AbortError") throw error; return download("no-store") })
      .then((blob) => { objectUrl = URL.createObjectURL(blob); play(objectUrl) })
      .catch((error: unknown) => { if ((error as Error).name !== "AbortError") play(src) })

    return () => {
      controller.abort()
      ctx.revert()
      video.removeEventListener("seeked", onSeeked)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  const isStatic = status === "static"

  return (
    <section ref={sectionRef} className={`scroll-world ${isStatic ? "is-static" : ""}`} aria-label="Historia de los juguetes Arisma">
      <div className="scroll-world-stage">
        <div className="scroll-world-camera">
        <video ref={videoRef} className="scroll-world-video" poster={showcaseVideo.poster} muted playsInline preload="none" aria-hidden="true" tabIndex={-1} />
        {!isStatic && (
          <div className="scroll-world-outro">
            <div className="scroll-world-logo-wrap">
              {sparkles.map((sparkle, index) => (
                <Sparkle key={index} className="scroll-world-sparkle" weight="fill" size={sparkle.size} aria-hidden="true" style={{ left: `calc(50% + ${sparkle.x}%)`, top: `calc(50% + ${sparkle.y}%)` }} />
              ))}
              <ArismaLogo />
            </div>
          </div>
        )}
        </div>

        <div className="scroll-world-hero" data-visible={isStatic || time < heroUntil}>
          <p className="eyebrow">Arisma Didácticos</p>
          <h1>Juguetes que enseñan jugando</h1>
          <p className="lead">Robótica, juegos de mesa, títeres y material didáctico para niños, familias y colegios en Colombia.</p>
          <div className="actions">
            <a className="button-primary" href="/productos">Ver juguetes</a>
          </div>
          {proof && <p className="scroll-world-proof"><SealCheck size={18} weight="fill" aria-hidden="true" /> {proof}</p>}
          {status === "loading" && <p className="scroll-world-status" role="status"><CircleNotch className="spin" size={16} aria-hidden="true" /> Preparando la historia</p>}
          {status === "ready" && <p className="scroll-world-status"><ArrowDown size={16} aria-hidden="true" /> Baja y mira lo que pasa en el tablero</p>}
        </div>

        {!isStatic && (
          <>
            <div className="scroll-world-fade">
              {showcaseStops.map((stop, index) => (
                <article key={stop.id} className={`scroll-world-stop ${index % 2 ? "is-right" : ""}`} data-visible={time >= stop.from && time < stop.to} aria-hidden={!(time >= stop.from && time < stop.to)}>
                  <img src={stop.image} alt={stop.imageAlt} loading="lazy" />
                  <div>
                    <p className="eyebrow">{stop.chapter}</p>
                    <h2>{stop.name}</h2>
                  </div>
                </article>
              ))}
              <p className="scroll-world-finale" data-visible={time >= finale.from} aria-hidden={time < finale.from}>{finale.lines.map((line) => <span key={line}>{line}</span>)}</p>
            </div>

            <div className="scroll-world-cover" aria-hidden="true" />
          </>
        )}
      </div>
    </section>
  )
}
