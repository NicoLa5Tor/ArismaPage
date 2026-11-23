"use client"

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react"
import type { CartStorePort } from "../application/cart-store-port"
import { type CartItem, type CartLine, addToCart, itemCount, removeFromCart, setQuantity, subtotal } from "../domain/cart"
import { usePort } from "../../shared/ui/ports"

type Cart = {
  lines: CartLine[]
  count: number
  subtotal: number
  /** False until the browser's cart has been read, so the page does not flash "empty". */
  ready: boolean
  open: boolean
  setOpen: (open: boolean) => void
  /** Adds units and answers how many went in (0 when the line was already at its limit or the cart is full). */
  add: (item: CartItem, quantity?: number) => { added: number; full: boolean }
  change: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: () => void
  /** The coupon typed by the shopper ("" when none); the store decides whether it applies. */
  coupon: string
  setCoupon: (code: string) => void
}

const CartContext = createContext<Cart | null>(null)
const EMPTY: CartLine[] = []
const never = () => () => {}

export function CartProvider({ children }: { children: ReactNode }) {
  const store = usePort<CartStorePort>("cartStore")
  const lines = useSyncExternalStore(store.subscribe, store.read, () => EMPTY)
  const ready = useSyncExternalStore(never, () => true, () => false)
  const coupon = useSyncExternalStore(store.subscribe, store.readCoupon, () => "")
  const [open, setOpen] = useState(false)

  const add = useCallback<Cart["add"]>((item, quantity = 1) => {
    const result = addToCart(store.read(), item, quantity)
    if (result.added > 0) store.write(result.lines)
    return { added: result.added, full: result.full }
  }, [store])
  const change = useCallback((productId: string, quantity: number) => store.write(setQuantity(store.read(), productId, quantity)), [store])
  const remove = useCallback((productId: string) => store.write(removeFromCart(store.read(), productId)), [store])
  const clear = useCallback(() => { store.write([]); store.writeCoupon("") }, [store])
  const setCoupon = useCallback((code: string) => store.writeCoupon(code), [store])

  const value = useMemo<Cart>(() => ({ lines, count: itemCount(lines), subtotal: subtotal(lines), ready, open, setOpen, add, change, remove, clear, coupon, setCoupon }), [lines, ready, open, add, change, remove, clear, coupon, setCoupon])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): Cart {
  const cart = useContext(CartContext)
  if (!cart) throw new Error("CartProvider missing")
  return cart
}
