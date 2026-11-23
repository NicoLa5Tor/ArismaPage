"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CaretLeft, CaretRight, ImageSquare, X } from "@phosphor-icons/react"
import { useScrollLock } from "../../../shared/ui/scroll-lock"
import { type GalleryImage, galleryImageSrc } from "../../domain/product"
import { optimized } from "../../../shared/ui/optimized-image"

// Adapted from 21st.dev "Thumbnail image viewer" (ibrandify): a stage with previous/next, a counter and a thumbnail
// strip that works as a tab list (arrows, Home, End). Here the stage also zooms towards the pointer on desktop; on touch
// screens a swipe changes the photo and a tap opens it full screen.

const ease = [0.22, 1, 0.36, 1] as const

export function ProductGallery({ productId, title, images, badges }: { productId: string; title: string; images: GalleryImage[]; badges?: React.ReactNode }) {
  const id = useId()
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const [broken, setBroken] = useState<Set<string>>(() => new Set())
  const strip = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const viewer = useRef<HTMLDialogElement>(null)
  const [viewing, setViewing] = useState(false)
  useScrollLock(viewing)
  useEffect(() => {
    const dialog = viewer.current
    if (!dialog) return
    if (viewing && !dialog.open) dialog.showModal()
    if (!viewing && dialog.open) dialog.close()
  }, [viewing])

  const usable = images.filter((image) => !broken.has(image.id))
  const index = Math.min(active, Math.max(0, usable.length - 1))
  const current = usable[index]
  const src = current ? galleryImageSrc(productId, current) : null
  const altOf = (image: GalleryImage, position: number) => image.alt || (position === 0 ? title : `${title}, foto ${position + 1}`)

  const choose = (next: number) => setActive((next + usable.length) % Math.max(1, usable.length))
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? usable.length - 1 : null
    if (next === null) return
    event.preventDefault()
    const target = (next + usable.length) % usable.length
    setActive(target)
    strip.current?.querySelectorAll<HTMLButtonElement>("button")[target]?.focus()
  }
  // the zoom origin follows the pointer; one write per frame
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || !stage.current) return
    const box = stage.current.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * 100, y = ((event.clientY - box.top) / box.height) * 100
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => { stage.current?.style.setProperty("--zoom-x", `${x}%`); stage.current?.style.setProperty("--zoom-y", `${y}%`) })
  }

  // a sideways swipe changes the photo; a tap without movement opens the viewer. The mouse keeps the zoom instead.
  const onPointerDown = (event: PointerEvent<HTMLElement>) => { if (event.pointerType !== "mouse") touch.current = { x: event.clientX, y: event.clientY } }
  const onPointerUp = (tapOpens: boolean) => (event: PointerEvent<HTMLElement>) => {
    const start = touch.current
    touch.current = null
    if (!start || event.pointerType === "mouse") return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && usable.length > 1) choose(dx < 0 ? index + 1 : index - 1)
    else if (tapOpens && Math.abs(dx) < 8 && Math.abs(dy) < 8 && src) setViewing(true)
  }

  return (
    <div className="gallery">
      <div ref={stage} className="gallery-stage squircle" id={`${id}-panel`} role={usable.length > 1 ? "tabpanel" : undefined} aria-labelledby={usable.length > 1 ? `${id}-tab-${index}` : undefined}
        onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={onPointerUp(true)} onPointerCancel={() => { touch.current = null }} data-zoom={!reduce && src ? "true" : "false"}>
        <AnimatePresence mode="wait" initial={false}>
          {src && current ? (
            <motion.img key={current.id} data-product-photo {...optimized(src, { sizes: "(min-width: 64rem) 50vw, 100vw", width: 1200 })} alt={altOf(current, index)} draggable={false} decoding="async" fetchPriority={index === 0 ? "high" : "auto"}
              onError={() => setBroken((seen) => new Set(seen).add(current.id))}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease }} />
          ) : (
            <div key="empty" className="gallery-empty" role="img" aria-label={`${title}, sin foto`}><ImageSquare size={64} aria-hidden="true" /></div>
          )}
        </AnimatePresence>
        {badges && <div className="gallery-badges">{badges}</div>}
        {usable.length > 1 && (
          <>
            <span className="gallery-count" aria-hidden="true">{index + 1} / {usable.length}</span>
            <div className="gallery-arrows">
              <button type="button" aria-label="Foto anterior" onClick={() => choose(index - 1)}><CaretLeft size={18} weight="bold" aria-hidden="true" /></button>
              <button type="button" aria-label="Foto siguiente" onClick={() => choose(index + 1)}><CaretRight size={18} weight="bold" aria-hidden="true" /></button>
            </div>
          </>
        )}
      </div>
      {usable.length > 1 && (
        <div ref={strip} className="gallery-strip" role="tablist" aria-label="Fotos del producto" onKeyDown={onKeyDown}>
          {usable.map((image, position) => {
            const thumb = galleryImageSrc(productId, image)
            return (
              <button key={image.id} type="button" role="tab" id={`${id}-tab-${position}`} aria-selected={position === index} aria-controls={`${id}-panel`} aria-label={`Foto ${position + 1} de ${usable.length}`}
                tabIndex={position === index ? 0 : -1} className="gallery-thumb squircle" onClick={() => setActive(position)}>
                {thumb && <img {...optimized(thumb, { sizes: "96px", width: 96 })} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken((seen) => new Set(seen).add(image.id))} />}
              </button>
            )
          })}
        </div>
      )}
      <dialog ref={viewer} className="gallery-viewer" aria-label={`Fotos de ${title}`} onClose={() => setViewing(false)} onClick={(event) => { if (event.target === event.currentTarget) setViewing(false) }}>
        {viewing && src && current && (
          <>
            <div className="gallery-viewer-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp(false)} onPointerCancel={() => { touch.current = null }}>
              <img {...optimized(src, { sizes: "100vw", width: 1920 })} alt={altOf(current, index)} draggable={false} decoding="async" />
            </div>
            <button type="button" className="gallery-viewer-close" onClick={() => setViewing(false)} aria-label="Cerrar la foto"><X size={20} weight="bold" aria-hidden="true" /></button>
            {usable.length > 1 && (
              <div className="gallery-viewer-bar">
                <button type="button" aria-label="Foto anterior" onClick={() => choose(index - 1)}><CaretLeft size={20} weight="bold" aria-hidden="true" /></button>
                <span aria-live="polite">{index + 1} / {usable.length}</span>
                <button type="button" aria-label="Foto siguiente" onClick={() => choose(index + 1)}><CaretRight size={20} weight="bold" aria-hidden="true" /></button>
              </div>
            )}
          </>
        )}
      </dialog>
    </div>
  )
}
