import Link from "next/link"
import { ArrowRight, DownloadSimple, FilePdf } from "@phosphor-icons/react/ssr"
import { LEGAL_KINDS, LEGAL_LABELS, LEGAL_PATHS, legalAnchor, legalDocumentHref, type LegalKind, type PublishedLegalPage } from "../../../shared/domain/legal"
import type { StoreProfile } from "../../../shared/domain/store-profile"
import { StoreHeader } from "../store-header"

const published = (date: string) => {
  const at = new Date(date)
  return Number.isNaN(at.getTime()) ? "" : at.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" })
}

/**
 * A legal page exactly as the store wrote it: its blocks in order, a table of contents built from its titles, and the
 * documents it attaches shown inside the page with a link to open or save them.
 */
export function LegalView({ kind, page, profile }: { kind: LegalKind; page: PublishedLegalPage; profile: StoreProfile }) {
  const sections = page.blocks.filter((block) => block.kind === "subheading")
  const contents = (sections.length > 1 ? sections : page.blocks.filter((block) => block.kind === "heading"))
    .map((block) => ("text" in block ? block.text : "")).filter(Boolean)
  const others = LEGAL_KINDS.filter((other) => other !== kind && profile.legal[other])
  const date = published(page.publishedAt)

  return (
    <main id="contenido" className="storefront catalog legal-page">
      <StoreHeader />
      <header className="legal-hero">
        <p className="eyebrow">Legal</p>
        <h1>{page.title}</h1>
        {profile.legalName && <p className="legal-owner">{profile.legalName}{profile.taxId ? ` · NIT ${profile.taxId}` : ""}</p>}
        <p className="legal-version">Versión {page.version}{date ? `, vigente desde el ${date}` : ""}</p>
      </header>
      <div className={`legal-layout ${contents.length > 1 ? "has-contents" : ""}`}>
        {contents.length > 1 && (
          <nav className="legal-contents squircle" aria-labelledby="legal-contents-title">
            <h2 id="legal-contents-title">Tabla de contenido</h2>
            <ol>{contents.map((text) => <li key={text}><a href={`#${legalAnchor(text)}`}>{text}</a></li>)}</ol>
          </nav>
        )}
        <article className="legal-body">
          {page.blocks.map((block, index) => {
            if (block.kind === "list") return <ul key={index}>{block.items.map((item, at) => <li key={at}>{item}</li>)}</ul>
            if (block.kind === "heading") return <h2 key={index} id={legalAnchor(block.text)}>{block.text}</h2>
            if (block.kind === "subheading") return <h3 key={index} id={legalAnchor(block.text)}>{block.text}</h3>
            return <p key={index}>{block.text}</p>
          })}
          {page.documents.length > 0 && (
            <section className="legal-documents" aria-labelledby="legal-documents-title">
              <h2 id="legal-documents-title">Documentos relacionados</h2>
              {page.documents.map((document) => {
                const href = legalDocumentHref(document.file)
                return (
                  <figure key={document.file} className="legal-document squircle">
                    <figcaption>
                      <span className="legal-document-icon squircle" aria-hidden="true"><FilePdf size={24} weight="duotone" /></span>
                      <span className="legal-document-name">{document.title}</span>
                      <a href={href} target="_blank" rel="noopener noreferrer" className="legal-document-open">Abrir PDF <ArrowRight size={16} weight="bold" aria-hidden="true" /></a>
                      <a href={href} download={document.file} className="legal-document-save" aria-label={`Descargar ${document.title}`}><DownloadSimple size={20} weight="bold" aria-hidden="true" /></a>
                    </figcaption>
                    <iframe src={`${href}#view=FitH`} title={document.title} loading="lazy" className="legal-document-frame" />
                  </figure>
                )
              })}
            </section>
          )}
          {others.length > 0 && (
            <nav className="legal-next" aria-label="Otras páginas legales">
              {others.map((other) => <Link key={other} href={LEGAL_PATHS[other]} className="link-arrow">{LEGAL_LABELS[other]} <ArrowRight size={16} weight="bold" aria-hidden="true" /></Link>)}
            </nav>
          )}
        </article>
      </div>
    </main>
  )
}
