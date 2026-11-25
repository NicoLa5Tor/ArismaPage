"use client"

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Plus, WhatsappLogo } from "@phosphor-icons/react"
import { faqsFor } from "../../domain/home"
import { useInView } from "./scene"
import { useStoreProfile, useWhatsapp } from "../../../shared/ui/store-profile"

const ease = [0.22, 1, 0.36, 1] as const

export function Faq() {
  const whatsappUrl = useWhatsapp()
  const faqs = faqsFor(useStoreProfile())
  const reduce = useReducedMotion()
  const [open, setOpen] = useState<number | null>(0)
  const [ref, shown] = useInView<HTMLDivElement>({ threshold: 0.1 })
  return (
    <section id="preguntas" className="faq" aria-labelledby="preguntas-titulo">
      <div className="home-inner faq-inner">
        <div className="faq-intro">
          <p className="eyebrow">Preguntas frecuentes</p>
          <h2 id="preguntas-titulo">Lo que casi todos preguntan antes de comprar</h2>
          <p>Si tu duda no está aquí, un asesor te responde.</p>
          <a className="button-whatsapp" href={whatsappUrl("Hola, tengo una pregunta antes de comprar")} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={20} weight="fill" aria-hidden="true" /> Escribir por WhatsApp</a>
        </div>
        <div ref={ref} className="faq-list" data-shown={shown}>
          {faqs.map((faq, index) => {
            const expanded = open === index
            return (
              <div key={faq.question} className="faq-item squircle reveal" data-open={expanded} style={{ "--i": index } as React.CSSProperties}>
                <h3>
                  <button type="button" id={`faq-button-${index}`} aria-expanded={expanded} aria-controls={`faq-panel-${index}`} onClick={() => setOpen(expanded ? null : index)}>
                    <span>{faq.question}</span>
                    <Plus className="faq-icon" size={20} weight="bold" aria-hidden="true" />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div id={`faq-panel-${index}`} role="region" aria-labelledby={`faq-button-${index}`} className="faq-panel"
                      initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={{ duration: 0.45, ease }}>
                      <p>{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
