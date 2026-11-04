import type { CouponsPort } from "../application/coupons-port"
import { json, request, seg } from "../../shared/adapters/http-client"

export const httpCoupons: CouponsPort = {
  list() { return request("/coupons") },
  save(id, coupon, csrf) { return request(`/coupons${id ? `/${seg(id)}` : ""}`, json(id ? "PUT" : "POST", coupon, csrf)) },
}
