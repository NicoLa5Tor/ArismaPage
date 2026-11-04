import type { ImageRef } from "../domain/image"

/** Resolves where an image can be displayed: historical photos keep their original URL, uploads go through the API. */
export interface MediaPort {
  src(ref: ImageRef): string | null
}
