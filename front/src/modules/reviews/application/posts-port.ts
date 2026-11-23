import type { PostKind, PostList, Submitted } from "../domain/posts"

/** Reading is public; writing needs the shopper's session (its CSRF token). */
export interface PostsPort {
  list(productId: string, kind: PostKind, page: number): Promise<PostList>
  submit(productId: string, post: { kind: PostKind; rating: number | null; body: string }, csrf: string): Promise<Submitted>
}
