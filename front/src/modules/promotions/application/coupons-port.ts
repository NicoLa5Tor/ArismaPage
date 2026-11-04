import type { Coupon, CouponInput } from "../domain/coupons"

export interface CouponsPort {
  list(): Promise<Coupon[]>
  save(id: string | null, coupon: CouponInput, csrf: string): Promise<Coupon>
}
