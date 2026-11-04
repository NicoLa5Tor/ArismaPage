import type { MediaPort } from "../application/media-port"

export const httpMedia: MediaPort = {
  src({ productId, imageId, imageUrl, imageUploaded }) {
    if (imageUrl && !imageUploaded) return imageUrl
    return productId && imageId ? `/api/arisma-admin/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}/content` : imageUrl
  },
}
