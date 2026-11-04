export type CouponKind = "FIXED_CART" | "PERCENT" | "FIXED_PRODUCT"
export const COUPON_KINDS: CouponKind[] = ["PERCENT", "FIXED_CART", "FIXED_PRODUCT"]
export type Coupon = { id: string; code: string; kind: string; amount: number; minimumAmount: number | null; maximumAmount: number | null; usageLimit: number | null; usageLimitPerCustomer: number | null
  individualUse: boolean; freeShipping: boolean; excludeSaleItems: boolean; expiresAt: string | null; active: boolean; description: string; uses: number; discounted: number; redeemable: boolean }
export type CouponInput = Omit<Coupon, "id" | "uses" | "discounted" | "redeemable" | "kind"> & { kind: CouponKind }
/** The API stores kinds in lowercase (fixed_cart); the panel works with the enum names. */
export const couponKind = (c: Pick<Coupon, "kind">) => c.kind.toUpperCase() as CouponKind
