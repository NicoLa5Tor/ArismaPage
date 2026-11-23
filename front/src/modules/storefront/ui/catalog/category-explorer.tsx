"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"
import { ArrowRight, CaretLeft, CaretRight, X } from "@phosphor-icons/react"
import { type CatalogCategory, categoryMetaOf, childCategories, formatCount, mainCategories, rootOf } from "../../domain/catalog"
import { useDialogFocus, useMediaQuery } from "../../../shared/ui/dialog-focus"
import { useScrollLock } from "../../../shared/ui/scroll-lock"
import { AllCategoriesIcon, CategoryIcon } from "./category-icons"
import { optimized } from "../../../shared/ui/optimized-image"

const ease = [0.22, 1, 0.36, 1] as const
const STORE_PHOTO = "/catalog/hero.jpg"

type Props = {
  open: boolean
  onClose: () => void
  categories: CatalogCategory[]
  /** The category being browsed, so the explorer opens on it. */
  current?: string
  /** "" is the whole catalog. */
  onSelect: (slug: string) => void
}

/**
 * The way into the catalog by category, built on the category photos. With a mouse it is a wide panel: pointing at a
 * category swaps the photo, the description and its subcategories. On a phone it is a full screen of photo cards; tapping
 * one grows its photo into the header and lists what is inside.
 */
export function CategoryExplorer({ open, onClose, categories, current = "", onSelect }: Props) {
  const [mounted, setMounted] = useState(false)
  const wide = useMediaQuery("(min-width: 64rem)")
  const panel = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const mains = useMemo(() => mainCategories(categories), [categories])
  useEffect(() => setMounted(true), [])
  useScrollLock(open)
  useDialogFocus(open, panel, onClose)

  // every photo is fetched as soon as the panel opens, so pointing at a category never waits for one
  useEffect(() => {
    if (!open) return
    for (const category of mains) { const image = categoryMetaOf(category.slug).image; if (image) new Image().src = image }
  }, [open, mains])

  const choose = (slug: string) => { onSelect(slug); onClose() }
  const currentRoot = current ? rootOf(categories, current)?.slug ?? "" : ""

  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="storefront explorer-root" data-lenis-prevent>
          <motion.button type="button" className="explorer-backdrop" aria-label="Cerrar categorías" tabIndex={-1} onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div ref={panel} className="explorer squircle" role="dialog" aria-modal="true" aria-label="Categorías"
            initial={reduce ? { opacity: 0 } : wide ? { opacity: 0, y: -12 } : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : wide ? { opacity: 0, y: -12 } : { opacity: 0, y: 24 }} transition={{ duration: 0.35, ease }}>
            {wide
              ? <DeskExplorer categories={categories} mains={mains} initial={currentRoot} current={current} onChoose={choose} onClose={onClose} />
              : <PhoneExplorer categories={categories} mains={mains} current={current} onChoose={choose} onClose={onClose} />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

type ViewProps = { categories: CatalogCategory[]; mains: CatalogCategory[]; current: string; onChoose: (slug: string) => void; onClose: () => void }

function DeskExplorer({ categories, mains, initial, current, onChoose, onClose }: ViewProps & { initial: string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(initial)
  const category = mains.find((item) => item.slug === shown) ?? null
  const meta = category ? categoryMetaOf(category.slug, mains.indexOf(category)) : null
  const image = category ? meta?.image ?? null : STORE_PHOTO
  const subs = category ? childCategories(categories, category.id) : mains
  const total = category?.productCount ?? null

  return (
    <div className="explorer-desk">
      <div className="explorer-list">
        <p className="explorer-eyebrow">Categorías</p>
        <ul>
          <li>
            <button type="button" className="explorer-item" data-tone="ink" aria-current={shown === ""} onMouseEnter={() => setShown("")} onFocus={() => setShown("")} onClick={() => onChoose("")}>
              <span className="explorer-item-icon squircle"><AllCategoriesIcon size={18} weight="fill" aria-hidden="true" /></span>
              <span className="explorer-item-name">Todo el catálogo</span>
              <CaretRight className="explorer-item-caret" size={14} weight="bold" aria-hidden="true" />
            </button>
          </li>
          {mains.map((item, index) => {
            return (
              <li key={item.id}>
                <button type="button" className="explorer-item" data-tone={categoryMetaOf(item.slug, index).tone} aria-current={shown === item.slug}
                  data-autofocus={item.slug === initial ? true : undefined}
                  onMouseEnter={() => setShown(item.slug)} onFocus={() => setShown(item.slug)} onClick={() => onChoose(item.slug)}>
                  <span className="explorer-item-icon squircle"><CategoryIcon slug={item.slug} size={18} weight="fill" aria-hidden="true" /></span>
                  <span className="explorer-item-name">{item.name}</span>
                  <span className="explorer-item-count">{formatCount(item.productCount)}</span>
                  <CaretRight className="explorer-item-caret" size={14} weight="bold" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="explorer-stage" data-tone={meta?.tone ?? "pink"}>
        <div className="explorer-photo squircle">
          <AnimatePresence initial={false}>
            {image && (
              <motion.img key={image} {...optimized(image, { sizes: "(min-width: 64rem) 40rem, 100vw", width: 1200 })} alt="" className="explorer-photo-image"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease }} />
            )}
          </AnimatePresence>
          <div className="explorer-photo-shade" aria-hidden="true" />
          <motion.div key={shown} className="explorer-photo-copy" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}>
            <h2>{category?.name ?? "Todo el catálogo"}</h2>
            <p>{meta?.blurb ?? "Juguetes y material didáctico para la casa y el aula, organizados por lo que quieres trabajar."}</p>
            <button type="button" className="explorer-cta squircle" onClick={() => onChoose(category?.slug ?? "")}>
              {category ? <>Ver todo {category.name}{total !== null ? ` (${formatCount(total)})` : ""}</> : "Ver todo el catálogo"} <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </button>
          </motion.div>
        </div>
        {subs.length > 0 && (
          <div className="explorer-subs">
            <p className="explorer-eyebrow">{category ? `Dentro de ${category.name}` : "Elige por dónde empezar"}</p>
            <ul>
              {subs.map((sub) => (
                <li key={sub.id}>
                  <button type="button" className="explorer-chip squircle" aria-current={current === sub.slug} onClick={() => onChoose(sub.slug)}>
                    <span>{sub.name}</span><span className="explorer-chip-count">{formatCount(sub.productCount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button type="button" className="explorer-close" onClick={onClose} aria-label="Cerrar categorías"><X size={20} aria-hidden="true" /></button>
    </div>
  )
}

function PhoneExplorer({ categories, mains, current, onChoose, onClose }: ViewProps) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState<string | null>(null)
  const category = mains.find((item) => item.slug === open) ?? null
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }) }, [open])
  const layout = reduce ? undefined : (slug: string) => `explorer-photo-${slug}`

  return (
    <LayoutGroup>
      <div className="explorer-phone">
        <div className="explorer-head">
          {category ? (
            <button type="button" className="explorer-back" onClick={() => setOpen(null)} data-autofocus><CaretLeft size={18} weight="bold" aria-hidden="true" /> Categorías</button>
          ) : <h2 className="explorer-head-title">Categorías</h2>}
          <button type="button" className="explorer-close" onClick={onClose} aria-label="Cerrar categorías"><X size={20} aria-hidden="true" /></button>
        </div>

        <div className="explorer-scroll" ref={scroller}>
          {category ? (
            <CategoryDetail category={category} index={mains.indexOf(category)} subs={childCategories(categories, category.id)} current={current} layoutId={layout?.(category.slug)} onChoose={onChoose} />
          ) : (
            <ul className="explorer-cards">
              <li className="is-wide">
                <button type="button" className="explorer-card squircle" data-tone="ink" onClick={() => onChoose("")}>
                  <img {...optimized(STORE_PHOTO, { sizes: "100vw", width: 1200 })} alt="" decoding="async" />
                  <span className="explorer-card-label squircle"><AllCategoriesIcon size={18} weight="fill" aria-hidden="true" /><span className="explorer-card-name">Todo el catálogo</span></span>
                </button>
              </li>
              {mains.map((item, index) => {
                const meta = categoryMetaOf(item.slug, index)
                return (
                  <li key={item.id}>
                    <button type="button" className="explorer-card squircle" data-tone={meta.tone} aria-current={current !== "" && rootOf(categories, current)?.id === item.id}
                      onClick={() => (childCategories(categories, item.id).length > 0 ? setOpen(item.slug) : onChoose(item.slug))}>
                      {meta.image ? <motion.img layoutId={layout?.(item.slug)} {...optimized(meta.image, { sizes: "(min-width: 40rem) 33vw, 50vw", width: 640 })} alt="" decoding="async" loading={index < 4 ? "eager" : "lazy"} /> : <span className="explorer-card-fallback"><CategoryIcon slug={item.slug} size={40} weight="duotone" aria-hidden="true" /></span>}
                      <span className="explorer-card-label squircle">
                        <CategoryIcon slug={item.slug} size={18} weight="fill" aria-hidden="true" />
                        <span className="explorer-card-name">{item.name}</span>
                        <span className="explorer-card-count">{formatCount(item.productCount)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </LayoutGroup>
  )
}

function CategoryDetail({ category, index, subs, current, layoutId, onChoose }: { category: CatalogCategory; index: number; subs: CatalogCategory[]; current: string; layoutId?: string; onChoose: (slug: string) => void }) {
  const reduce = useReducedMotion()
  const meta = categoryMetaOf(category.slug, index)
  return (
    <div className="explorer-detail" data-tone={meta.tone}>
      <div className="explorer-detail-photo squircle">
        {meta.image ? <motion.img layoutId={layoutId} {...optimized(meta.image, { sizes: "100vw", width: 1200 })} alt="" /> : <span className="explorer-card-fallback"><CategoryIcon slug={category.slug} size={48} weight="duotone" aria-hidden="true" /></span>}
      </div>
      <motion.div className="explorer-detail-copy" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease, delay: reduce ? 0 : 0.1 }}>
        <h2><span className="explorer-item-icon squircle"><CategoryIcon slug={category.slug} size={18} weight="fill" aria-hidden="true" /></span>{category.name}</h2>
        {meta.blurb && <p>{meta.blurb}</p>}
        <button type="button" className="explorer-cta squircle" onClick={() => onChoose(category.slug)}>Ver los {formatCount(category.productCount)} productos <ArrowRight size={16} weight="bold" aria-hidden="true" /></button>
        <ul className="explorer-rows">
          {subs.map((sub) => (
            <li key={sub.id}>
              <button type="button" className="explorer-row" aria-current={current === sub.slug} onClick={() => onChoose(sub.slug)}>
                <span className="explorer-row-name">{sub.name}</span>
                <span className="explorer-chip-count">{formatCount(sub.productCount)}</span>
                <CaretRight size={14} weight="bold" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  )
}
