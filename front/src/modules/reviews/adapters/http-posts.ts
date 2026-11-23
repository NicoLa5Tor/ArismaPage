import type { PostsPort } from "../application/posts-port"
import type { PostList, Submitted } from "../domain/posts"
import { storeJson, storeRequest } from "../../shared/adapters/store-client"

export const httpPosts: PostsPort = {
  list: (productId, kind, page) => storeRequest<PostList>(`/public/products/${encodeURIComponent(productId)}/posts?tipo=${kind}&pagina=${page}`),
  submit: (productId, post, csrf) => storeRequest<Submitted>(`/shop/products/${encodeURIComponent(productId)}/posts`, storeJson("POST", post, csrf)),
}
