"use client"

import { useEffect } from "react"

let locks = 0
let saved: { overflow: string; position: string; top: string; width: string; y: number } | null = null

function lock() {
  if (locks++ > 0) return
  const body = document.body
  const y = window.scrollY
  saved = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width, y }
  body.style.overflow = "hidden"
  // iOS Safari ignores overflow on the body for touch scrolling; pinning the body is the reliable way to keep the page still
  if (window.matchMedia("(hover: none)").matches) {
    body.style.position = "fixed"
    body.style.top = `-${y}px`
    body.style.width = "100%"
  }
}

function unlock() {
  if (--locks > 0 || !saved) return
  const body = document.body
  const pinned = body.style.position === "fixed"
  body.style.overflow = saved.overflow
  body.style.position = saved.position
  body.style.top = saved.top
  body.style.width = saved.width
  if (pinned) window.scrollTo({ top: saved.y, behavior: "instant" })
  saved = null
}

/** Keeps the page behind a sheet, drawer or menu from scrolling while `active` is true, also on iOS. Nested locks stack. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
