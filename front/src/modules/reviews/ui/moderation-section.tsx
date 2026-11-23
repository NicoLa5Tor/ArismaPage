"use client"

import { useState } from "react"
import { ChatsCircle, Star } from "@phosphor-icons/react"
import { useCan, usePort, useSession } from "../../shared/ui/admin-context"
import { Async, Badge, Card, Chips, type Tone, useLoad } from "../../shared/ui/parts"
import type { ModeratedPost, ModerationPort, PostStatus } from "../application/moderation-port"
import { formatDate } from "../domain/posts"
import { useStoreProfile } from "../../shared/ui/store-profile"

const STATUS: Record<PostStatus, { label: string; tone: Tone }> = { pending: { label: "Por revisar", tone: "warn" }, published: { label: "Publicado", tone: "good" }, hidden: { label: "Oculto", tone: "neutral" } }

function PostCard({ post, onChanged }: { post: ModeratedPost; onChanged: () => void }) {
  const profile = useStoreProfile()
  const api = usePort<ModerationPort>("moderation")
  const { csrf, notify, openProduct } = useSession()
  const can = useCan()("REVIEWS_MANAGE")
  const [answer, setAnswer] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("")
  async function run(action: () => Promise<void>, done: string) {
    setBusy(true); setError("")
    try { await action(); notify(done); onChanged() } catch (err) { setError(err instanceof Error ? err.message : "No se pudo completar") } finally { setBusy(false) }
  }
  return <article className="glass-subpanel grid gap-2">
    <header className="flex flex-wrap items-center gap-2 text-sm">
      <Badge tone={STATUS[post.status].tone}>{STATUS[post.status].label}</Badge>
      <Badge tone="info">{post.kind === "review" ? "Opinión" : "Pregunta"}</Badge>
      {post.rating != null && <span className="inline-flex items-center gap-1 font-semibold" aria-label={`${post.rating} de 5 estrellas`}>{post.rating}<Star size={14} weight="fill" aria-hidden="true" /></span>}
      {post.verifiedPurchase && <Badge tone="good">Compra verificada</Badge>}
      <span className="text-stone-500">{formatDate(post.createdAt)}</span>
    </header>
    <p className="text-sm"><button type="button" className="font-semibold underline underline-offset-4" onClick={() => openProduct(post.productId)}>{post.productTitle}</button></p>
    <p className="whitespace-pre-line">{post.body}</p>
    <p className="text-xs text-stone-500">{post.authorName}{post.accountEmail ? ` · ${post.accountEmail}` : ""}</p>
    {post.replies.map(reply => <div key={reply.id} className="glass-subpanel grid gap-1 text-sm">
      <p className="flex flex-wrap items-center gap-2"><strong>{reply.authorName}</strong>{!reply.staff && <Badge tone={STATUS[reply.status].tone}>{STATUS[reply.status].label}</Badge>}</p>
      <p className="whitespace-pre-line">{reply.body}</p>
      {can && <p className="flex flex-wrap gap-2">
        {reply.status !== "published" && <button type="button" className="glass-chip" disabled={busy} onClick={() => void run(() => api.setReplyStatus(reply.id, "published", csrf), "Respuesta publicada.")}>Publicar</button>}
        {reply.status !== "hidden" && <button type="button" className="glass-chip" disabled={busy} onClick={() => void run(() => api.setReplyStatus(reply.id, "hidden", csrf), "Respuesta oculta.")}>Ocultar</button>}
      </p>}
    </div>)}
    {error && <p role="alert" className="glass-alert">{error}</p>}
    {can && <>
      <label className="glass-label">Responder como {profile.name}<textarea className="glass-field" rows={2} maxLength={1500} value={answer} onChange={e => setAnswer(e.target.value)} placeholder={post.kind === "question" ? "Tu respuesta se publica junto a la pregunta" : "Agradece o aclara; se publica bajo la opinión"} /></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="glass-cta" disabled={busy || answer.trim().length < 2} onClick={() => void run(async () => { await api.reply(post.id, answer.trim(), csrf); setAnswer("") }, "Respuesta publicada.")}>{post.status === "pending" ? "Responder y publicar" : "Responder"}</button>
        {post.status !== "published" && <button type="button" className="glass-chip" disabled={busy} onClick={() => void run(() => api.setStatus(post.id, "published", csrf), "Publicado en la tienda.")}>Publicar</button>}
        {post.status !== "hidden" && <button type="button" className="glass-chip" disabled={busy} onClick={() => void run(() => api.setStatus(post.id, "hidden", csrf), "Oculto de la tienda.")}>Ocultar</button>}
      </div>
    </>}
  </article>
}

/** Panel section "Opiniones": what waits for approval first, then everything else, with the store's answers. */
export function ModerationSection() {
  const api = usePort<ModerationPort>("moderation")
  const { version, changed } = useSession()
  const [status, setStatus] = useState<PostStatus | "">("pending")
  const [page, setPage] = useState(1)
  const state = useLoad(() => api.list(status, page), [status, page, version])
  return <div className="glass-scroll"><Card icon={ChatsCircle} title="Opiniones y preguntas" subtitle="Aprueba, oculta y responde lo que escriben los clientes en cada producto"
    actions={<Chips label="Estado" value={status} onChange={v => { setStatus(v); setPage(1) }} options={[{ value: "pending", label: "Por revisar" }, { value: "published", label: "Publicadas" }, { value: "hidden", label: "Ocultas" }, { value: "", label: "Todas" }]} />}>
    <div className="mt-4"><Async state={state} label="Cargando opiniones" rows={4} empty={{ icon: ChatsCircle, title: status === "pending" ? "Nada por revisar" : "No hay publicaciones aquí", hint: status === "pending" ? "Cuando un cliente opine o pregunte, aparecerá en esta lista." : "Cambia el filtro para ver otras.", when: d => d.items.length === 0 }}>{data => <div className="grid gap-4">
      {data.items.map(post => <PostCard key={post.id} post={post} onChanged={changed} />)}
      {data.total > data.pageSize && <div className="flex items-center gap-2"><button type="button" className="glass-chip" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anteriores</button><span className="text-sm text-stone-500">Página {data.page} de {Math.ceil(data.total / data.pageSize)}</span><button type="button" className="glass-chip" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Siguientes</button></div>}
    </div>}</Async></div>
  </Card></div>
}
