import { getImageProps } from "next/image"

// Photos go through Next.js' image optimizer: it answers WebP at the width the screen needs and keeps it cached, so a
// 500 KB PNG from the catalog arrives as a few KB. Same <img> element, so layouts, refs and onError stay as they were.

/** Hosts the optimizer may fetch from; next.config.js allows the same ones. Others are shown as they are. */
const OPTIMIZED_HOSTS = new Set(["arisma.com.co"])

const optimizable = (src: string) => {
  if (src.startsWith("/") && !src.startsWith("//")) return !src.endsWith(".svg") && !src.endsWith(".gif")
  try {
    const url = new URL(src)
    return url.protocol === "https:" && OPTIMIZED_HOSTS.has(url.hostname)
  } catch { return false }
}

/**
 * `src`, `srcSet` and `sizes` for an <img>. `sizes` says how wide the image is shown (as in the CSS); `width` is the widest
 * it is ever drawn, in CSS pixels, so the list of candidates stops there.
 */
export function optimized(src: string, { sizes, width, quality = 75 }: { sizes: string; width: number; quality?: number }): { src: string; srcSet?: string; sizes?: string } {
  if (!src || !optimizable(src)) return { src }
  const { props } = getImageProps({ src, alt: "", width, height: width, sizes, quality })
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes }
}
