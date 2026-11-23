"use client"

import Link from "next/link"
import { useEffect, useId, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CaretDown, ChatsCircle, House, List, Package, Sparkle, WhatsappLogo } from "@phosphor-icons/react"
import { useWhatsapp } from "../../shared/ui/store-profile"
import { useAskLabel } from "./store-brand"

const ease = [0.22, 1, 0.36, 1] as const

/**
 * The store's secondary links (home, products, the assistant, contact, WhatsApp), kept out of the header so it stays
 * light. A small dropdown under its button: the page stays visible and usable, and a click outside, Escape, leaving it
 * with Tab or choosing a link closes it.
 */
export function MobileMenu({ contactHref = "/#contacto" }: { contactHref?: string }) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const path = usePathname()
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  const askLabel = useAskLabel()
  const whatsappUrl = useWhatsapp()
  const whatsapp = whatsappUrl("Hola, quiero información sobre sus productos")

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setOpen(false)
      button.current?.focus()
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", key)
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key) }
  }, [open])

  const close = () => setOpen(false)
  const current = (href: string) => (path === href ? "page" : undefined)
  const links = [
    { href: "/", label: "Inicio", icon: House },
    { href: "/productos", label: "Productos", icon: Package },
    { href: "/buscar", label: askLabel, icon: Sparkle },
  ]

  return (
    <div ref={root} className="store-menu" onBlur={(event) => { if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false) }}>
      <button ref={button} type="button" className="menu-button squircle" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={id} aria-label={open ? "Cerrar el menú" : "Abrir el menú"}>
        <List size={20} weight="bold" aria-hidden="true" />
        <span className="menu-button-label">Menú</span>
        <CaretDown size={14} weight="bold" aria-hidden="true" className="menu-button-caret" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.nav id={id} aria-label="Menú" className="store-menu-panel squircle"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 }} transition={{ duration: 0.2, ease }}>
            <ul>
              {links.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} aria-current={current(href)} onClick={close} className="store-menu-item">
                    <Icon size={18} weight="fill" aria-hidden="true" className="store-menu-icon" />
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
              <li>
                <a href={contactHref} onClick={close} className="store-menu-item">
                  <ChatsCircle size={18} weight="fill" aria-hidden="true" className="store-menu-icon" />
                  <span>Contacto</span>
                </a>
              </li>
            </ul>
            {whatsapp && (
              <a className="store-menu-item is-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={close}>
                <WhatsappLogo size={18} weight="fill" aria-hidden="true" className="store-menu-icon" />
                <span>Escríbenos por WhatsApp</span>
              </a>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  )
}
