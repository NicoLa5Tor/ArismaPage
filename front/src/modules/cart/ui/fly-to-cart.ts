import gsap from "gsap"

/**
 * Sends a copy of the product photo from where it is to the cart button, so the shopper sees where the product went.
 * Purely decorative: skipped with reduced motion, when the photo or the button is off screen, or when either is missing.
 */
export function flyToCart(source: HTMLElement | null) {
  if (!source || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  const target = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-button]")).find((button) => button.getClientRects().length > 0)
  if (!target) return
  const from = source.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (!from.width || !to.width || from.bottom < 0 || from.top > window.innerHeight) return

  const ghost = source.cloneNode(true) as HTMLElement
  ghost.removeAttribute("id")
  ghost.setAttribute("aria-hidden", "true")
  Object.assign(ghost.style, { position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, margin: "0", zIndex: "70", pointerEvents: "none", borderRadius: "24px", objectFit: "contain", background: "#fff" })
  document.body.appendChild(ghost)

  const scale = Math.max(to.width / from.width, 0.08)
  gsap.timeline({ onComplete: () => ghost.remove() })
    .to(ghost, { x: to.left + to.width / 2 - (from.left + from.width / 2), y: to.top + to.height / 2 - (from.top + from.height / 2), scale, duration: 0.7, ease: "power3.inOut" })
    .to(ghost, { opacity: 0, duration: 0.2, ease: "power1.out" }, "-=0.2")
    .fromTo(target, { scale: 1 }, { scale: 1.18, duration: 0.16, yoyo: true, repeat: 1, ease: "power2.out", clearProps: "scale" }, "-=0.1")
}
