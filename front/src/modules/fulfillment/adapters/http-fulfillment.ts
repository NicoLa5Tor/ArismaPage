import type { FulfillmentPort } from "../application/fulfillment-port"
import { json, qs, request, seg } from "../../shared/adapters/http-client"

export const httpFulfillment: FulfillmentPort = {
  board(method, q, staleDays) { return request(`/fulfillment/board?${qs({ method, q, staleDays })}`) },
  couriers() { return request("/fulfillment/couriers") },
  shipment(orderId) { return request(`/orders/${seg(orderId)}/shipment`) },
  move(orderId, status, details, csrf) { return request(`/orders/${seg(orderId)}/shipment/status`, json("POST", { status, ...details }, csrf)) },
  reroute(orderId, method, details, csrf) { return request(`/orders/${seg(orderId)}/shipment`, json("PUT", { method, ...details }, csrf)) },
  moveAll(orderIds, status, note, csrf) { return request("/fulfillment/status", json("POST", { orderIds, status, note }, csrf)) },
  closeStale(days, csrf) { return request("/fulfillment/close-stale", json("POST", { days }, csrf)) },
  refreshTracking(orderId, csrf) { return request(`/orders/${seg(orderId)}/shipment/tracking`, json("POST", {}, csrf)) },
  trackingStatus() { return request("/tracking") },
  setTracking(enabled, csrf) { return request("/tracking", json("PUT", { enabled }, csrf)) },
}
