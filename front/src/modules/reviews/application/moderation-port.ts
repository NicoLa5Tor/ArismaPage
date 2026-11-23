export type PostStatus = "pending" | "published" | "hidden"
export type ModeratedReply = { id: string; staff: boolean; authorName: string; body: string; status: PostStatus; createdAt: string }
export type ModeratedPost = {
  id: string; kind: "review" | "question"; rating: number | null; body: string; authorName: string; verifiedPurchase: boolean; status: PostStatus; createdAt: string
  productId: string; productTitle: string; productSlug: string; accountEmail: string | null; replies: ModeratedReply[]
}
export type ModerationPage = { items: ModeratedPost[]; total: number; page: number; pageSize: number }

/** The panel's side of reviews and questions. */
export interface ModerationPort {
  list(status: PostStatus | "", page: number): Promise<ModerationPage>
  setStatus(postId: string, status: PostStatus, csrf: string): Promise<void>
  setReplyStatus(replyId: string, status: PostStatus, csrf: string): Promise<void>
  /** Answers in the name of the store; a pending post is published with its answer. */
  reply(postId: string, body: string, csrf: string): Promise<void>
}
