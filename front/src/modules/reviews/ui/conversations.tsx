"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"
import gsap from "gsap"
import { ChatCircleDots, CheckCircle, CircleNotch, PencilSimpleLine, SealCheck, Star, Storefront } from "@phosphor-icons/react"
import { loginUrl } from "../../account/domain/account"
import { useAccount } from "../../account/ui/account-context"
import { usePort } from "../../shared/ui/ports"
import type { PostsPort } from "../application/posts-port"
import { LIMITS, type Post, type PostKind, type PostList, bodyError, distribution, formatDate, ratingWords } from "../domain/posts"
import { useStoreProfile } from "../../shared/ui/store-profile"
import { legalHref } from "../../shared/domain/store-profile"
import { useInfoPanel } from "../../shared/ui/info-panel"

const usePosts = () => usePort<PostsPort>("posts")

function StarsRow({ value, size = 16 }: { value: number; size?: number }) {
  return <span className="post-stars" role="img" aria-label={`${value} de 5 estrellas`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} weight={n <= Math.round(value) ? "fill" : "regular"} data-on={n <= Math.round(value)} aria-hidden="true" />)}</span>
}

/** Five radio buttons drawn as stars: arrow keys move, and the word says what the number means. */
function RatingInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <fieldset className="rating-input">
      <legend>Tu calificación</legend>
      <div className="rating-input-stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} onMouseEnter={() => setHover(n)} data-on={n <= shown}>
            <input type="radio" name="rating" className="sr-only" value={n} checked={value === n} onChange={() => onChange(n)} />
            <Star size={32} weight={n <= shown ? "fill" : "regular"} aria-hidden="true" />
            <span className="sr-only">{n} {n === 1 ? "estrella" : "estrellas"}: {ratingWords[n]}</span>
          </label>
        ))}
        <span className="rating-input-word" aria-hidden="true">{ratingWords[shown]}</span>
      </div>
    </fieldset>
  )
}

function PostItem({ post }: { post: Post }) {
  return (
    <li className="post squircle">
      <header>
        <span className="post-author">{post.authorName}</span>
        {post.verifiedPurchase && <span className="post-verified"><SealCheck size={16} weight="fill" aria-hidden="true" /> Compra verificada</span>}
        <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
      </header>
      {post.rating !== null && <StarsRow value={post.rating} />}
      <p className="post-body">{post.body}</p>
      {post.replies.length > 0 && (
        <ul className="post-replies">
          {post.replies.map((reply) => (
            <li key={reply.id} data-staff={reply.staff}>
              <span className="post-author">{reply.staff && <Storefront size={16} weight="fill" aria-hidden="true" />} {reply.authorName}</span>
              <p className="post-body">{reply.body}</p>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function PostForm({ productId, kind, onSent }: { productId: string; kind: PostKind; onSent: (published: boolean) => void }) {
  const profile = useStoreProfile()
  const privacy = legalHref(profile, "privacy")
  const port = usePosts()
  const { session, ready } = useAccount()
  const path = usePathname()
  const [rating, setRating] = useState(0), [body, setBody] = useState("")
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [touched, setTouched] = useState(false)
  const problem = (kind === "review" && rating === 0 ? "Elige cuántas estrellas le das" : null) ?? bodyError(kind, body)

  if (!ready) return null
  if (!session) return (
    <div className="post-login squircle">
      <p>{kind === "review" ? "Entra con tu cuenta para calificar este producto." : `Entra con tu cuenta para preguntar. ${profile.shortName} te responde aquí mismo.`}</p>
      <Link href={`${loginUrl(`${path}#${kind === "review" ? "opiniones" : "preguntas"}`)}&motivo=opinar`} className="button-primary">Entrar o crear cuenta</Link>
    </div>
  )

  async function submit(event: FormEvent) {
    event.preventDefault(); setTouched(true); setError("")
    if (problem || !session) return
    setBusy(true)
    try {
      const sent = await port.submit(productId, { kind, rating: kind === "review" ? rating : null, body: body.trim() }, session.csrf)
      setBody(""); setRating(0); setTouched(false); onSent(sent.status === "published")
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo enviar. Inténtalo de nuevo.") } finally { setBusy(false) }
  }
  return (
    <form className="post-form squircle" onSubmit={submit} noValidate>
      {kind === "review" && <RatingInput value={rating} onChange={setRating} />}
      <label className="store-field">{kind === "review" ? "Tu opinión" : "Tu pregunta"}
        <textarea rows={kind === "review" ? 4 : 3} maxLength={LIMITS[kind].max} value={body} onChange={(e) => setBody(e.target.value)} aria-invalid={touched && Boolean(problem)}
          placeholder={kind === "review" ? "¿Qué tal salió? ¿Para quién lo compraste?" : "Por ejemplo: ¿qué medidas tiene?, ¿sirve para 4 años?"} />
        <span className="store-field-hint">Se publica con tu nombre y la inicial de tu apellido{privacy ? <>, según nuestra <a href={privacy} target="_blank" rel="noopener noreferrer">política de datos</a></> : ""}. {body.trim().length} de {LIMITS[kind].max}.</span>
      </label>
      {touched && problem && <p className="store-field-error" role="alert">{problem}</p>}
      {error && <p className="store-alert" role="alert">{error}</p>}
      <button type="submit" className="button-primary" disabled={busy}>{busy ? <><CircleNotch className="spin" size={18} aria-hidden="true" /> Enviando…</> : kind === "review" ? "Publicar opinión" : "Enviar pregunta"}</button>
    </form>
  )
}

/**
 * Writing an opinion or a question, folded behind one button so the page does not open with an empty form. It
 * unfolds with GSAP (at once with reduced motion), and it is open on arrival when the shopper comes back from signing
 * in to write (#opiniones or #preguntas).
 */
function Compose({ productId, kind, onSent }: { productId: string; kind: PostKind; onSent: (published: boolean) => void }) {
  const [writing, setWriting] = useState(false)
  const body = useRef<HTMLDivElement>(null), opened = useRef(false)
  const anchor = kind === "review" ? "opiniones" : "preguntas"
  useEffect(() => { if (window.location.hash === `#${anchor}`) queueMicrotask(() => setWriting(true)) }, [anchor])
  useLayoutEffect(() => {
    if (!writing || !body.current || !opened.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    gsap.fromTo(body.current, { height: 0, autoAlpha: 0 }, { height: "auto", autoAlpha: 1, duration: 0.45, ease: "power3.out", clearProps: "height,opacity,visibility" })
  }, [writing])
  if (!writing) return (
    <button type="button" className="button-primary post-compose" onClick={() => { opened.current = true; setWriting(true) }}>
      <PencilSimpleLine size={20} weight="bold" aria-hidden="true" /> {kind === "review" ? "Escribir una opinión" : "Hacer una pregunta"}
    </button>
  )
  return (
    <div ref={body} className="post-compose-body">
      <PostForm productId={productId} kind={kind} onSent={(published) => { setWriting(false); onSent(published) }} />
      <button type="button" className="post-compose-close" onClick={() => setWriting(false)}>{kind === "review" ? "Ahora no" : "Cerrar"}</button>
    </div>
  )
}

/** bare: inside the product's tabs, whose tab already names it (no title, no address of its own). */
function Section({ productId, kind, initialCount, bare = false }: { productId: string; kind: PostKind; initialCount?: number; bare?: boolean }) {
  const port = usePosts()
  const [data, setData] = useState<PostList | null>(null)
  const [items, setItems] = useState<Post[]>([])
  const [page, setPage] = useState(1)
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [notice, setNotice] = useState("")

  const load = useCallback(async (next: number) => {
    setState("loading")
    try {
      const found = await port.list(productId, kind, next)
      setData(found); setPage(next)
      setItems((current) => (next === 1 ? found.posts.items : [...current, ...found.posts.items.filter((post) => !current.some((c) => c.id === post.id))]))
      setState("ready")
    } catch { setState("error") }
  }, [port, productId, kind])
  useEffect(() => { void load(1) }, [load])

  const review = kind === "review"
  const total = data?.posts.total ?? initialCount ?? 0
  useInfoPanel({ empty: Boolean(data && !data.open), count: data ? data.posts.total : undefined })
  if (data && !data.open) return null
  const rated = review && data && data.summary.count > 0
  return (
    <section {...(bare ? {} : { id: review ? "opiniones" : "preguntas" })} className={bare ? "posts" : "product-block posts"} aria-labelledby={bare ? undefined : `${kind}-title`} aria-label={bare ? (review ? "Opiniones de clientes" : "Preguntas y respuestas") : undefined}>
      {!bare && <div className="product-block-head"><h2 id={`${kind}-title`}>{review ? "Opiniones de clientes" : "Preguntas y respuestas"}{total > 0 && <span className="posts-count">{total}</span>}</h2></div>}
      <div className="posts-layout" data-rated={rated || undefined}>
        <div className="posts-side">
          {review && data && data.summary.count > 0 && (
            <div className="rating-summary squircle">
              <p className="rating-summary-score"><strong>{data.summary.average.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong><span>de 5</span></p>
              <StarsRow value={data.summary.average} size={20} />
              <p className="rating-summary-count">{data.summary.count} {data.summary.count === 1 ? "opinión" : "opiniones"}</p>
              <ul className="rating-bars">
                {distribution(data.summary).map((row) => (
                  <li key={row.stars}><span>{row.stars} <Star size={12} weight="fill" aria-hidden="true" /></span><span className="rating-bar" role="img" aria-label={`${row.count} con ${row.stars} estrellas`}><span style={{ width: `${row.percent}%` }} /></span><span>{row.percent}%</span></li>
                ))}
              </ul>
            </div>
          )}
          {notice ? <p className="post-notice squircle" role="status"><CheckCircle size={20} weight="fill" aria-hidden="true" /> {notice}</p> : null}
          <Compose productId={productId} kind={kind} onSent={(published) => { setNotice(published ? "Gracias. Ya está publicado." : "Gracias. Lo revisamos y lo publicamos pronto."); if (published) void load(1) }} />
        </div>
        <div className="posts-list" aria-busy={state === "loading"}>
          {state === "error" ? (
            <div className="posts-empty squircle"><p>No pudimos cargar {review ? "las opiniones" : "las preguntas"}.</p><button type="button" className="link-arrow" onClick={() => void load(page)}>Intentar de nuevo</button></div>
          ) : items.length === 0 && state === "loading" ? (
            <ul className="posts-items" aria-hidden="true">{[0, 1].map((n) => <li key={n} className="post squircle is-skeleton"><span className="skeleton-line short" /><span className="skeleton-line" /><span className="skeleton-line" /></li>)}</ul>
          ) : items.length === 0 ? (
            <p className="posts-empty-line"><ChatCircleDots size={24} weight="fill" aria-hidden="true" /> {review ? "Todavía nadie ha opinado sobre este producto. La primera opinión puede ser la tuya." : "Aún no hay preguntas. Si tienes una duda, escríbela y te respondemos aquí."}</p>
          ) : (
            <>
              <ul className="posts-items">{items.map((post) => <PostItem key={post.id} post={post} />)}</ul>
              {data && items.length < data.posts.total && <button type="button" className="posts-more squircle" disabled={state === "loading"} onClick={() => void load(page + 1)}>{state === "loading" ? "Cargando…" : review ? "Ver más opiniones" : "Ver más preguntas"}</button>}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

/** The opinions of a product, inside its tabs. */
export function ReviewsPanel({ productId, reviewCount }: { productId: string; reviewCount: number }) { return <Section productId={productId} kind="review" initialCount={reviewCount} bare /> }
/** The questions about a product and the store's answers, inside its tabs. */
export function QuestionsPanel({ productId }: { productId: string }) { return <Section productId={productId} kind="question" bare /> }

/** The conversation blocks of a product page. Each one hides itself when the store or the product has it switched off. */
export function Conversations({ productId, reviews, questions, reviewCount }: { productId: string; reviews: boolean; questions: boolean; reviewCount: number }) {
  return <>{reviews && <Section productId={productId} kind="review" initialCount={reviewCount} />}{questions && <Section productId={productId} kind="question" />}</>
}
