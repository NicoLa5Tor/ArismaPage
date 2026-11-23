import Link from "next/link"
import { ArrowRight, DownloadSimple, FilePdf } from "@phosphor-icons/react/ssr"
import { LEGAL_PATHS, legalAnchor, legalDocumentHref, type LegalKind, type LegalPage } from "../../../shared/domain/legal"
import type { StoreProfile } from "../../../shared/domain/store-profile"
import { StoreHeader } from "../store-header"

const OTHER: Record<LegalKind, { kind: LegalKind; label: string }> = {
  terms: { kind: "privacy", label: "Política de tratamiento de datos" },
  privacy: { kind: "terms", label: "Términos y condiciones de uso" },
}

/**
 * A legal page exactly as the store wrote it: its blocks in order, a table of contents built from its titles, and the
 * documents it attaches shown inside the page with a link to open or save them.
 */
export function LegalView({ kind, page, profile }: { kind: LegalKind; page: LegalPage; profile: StoreProfile }) {
  const sections = page.blocks.filter((block) => block.kind === "subheading")
  const contents = (sections.length > 1 ? sections : page.blocks.filter((block) => block.kind === "heading"))
    .map((block) => ("text" in block ? block.text : "")).filter(Boolean)
  const other = OTHER[kind]
  const otherHref = profile.legal[other.kind] ? LEGAL_PATHS[other.kind] : null

  return (
    <main id="contenido" className="storefront catalog legal-page">
      <StoreHeader />
      <header className="legal-hero">
        <p className="eyebrow">Legal</p>
        <h1>{page.title}</h1>
        {profile.legalName && <p className="legal-owner">{profile.legalName}{profile.taxId ? ` · NIT ${profile.taxId}` : ""}</p>}
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
          {otherHref && (
            <p className="legal-next"><Link href={otherHref} className="link-arrow">{other.label} <ArrowRight size={16} weight="bold" aria-hidden="true" /></Link></p>
          )}
        </article>
      </div>
    </main>
  )
}
