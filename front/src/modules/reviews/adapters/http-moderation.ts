import type { ModerationPort } from "../application/moderation-port"
import { json, qs, request, seg } from "../../shared/adapters/http-client"

export const httpModeration: ModerationPort = {
  list: (status, page) => request(`/posts?${qs({ estado: status, pagina: page })}`),
  async setStatus(postId, status, csrf) { await request(`/posts/${seg(postId)}/status`, json("PUT", { status }, csrf)) },
  async setReplyStatus(replyId, status, csrf) { await request(`/posts/replies/${seg(replyId)}/status`, json("PUT", { status }, csrf)) },
  async reply(postId, body, csrf) { await request(`/posts/${seg(postId)}/replies`, json("POST", { body }, csrf)) },
}
