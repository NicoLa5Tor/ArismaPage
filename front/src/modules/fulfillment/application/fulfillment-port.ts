import type { Board, BulkResult, Courier, DeliveryMethod, DeliveryStatus, MoveDetails, Shipment } from "../domain/fulfillment"

export interface FulfillmentPort {
  board(method: DeliveryMethod | "", q: string, staleDays: number): Promise<Board>
  couriers(): Promise<Courier[]>
  shipment(orderId: string): Promise<Shipment>
  move(orderId: string, status: DeliveryStatus, details: MoveDetails, csrf: string): Promise<Shipment>
  reroute(orderId: string, method: DeliveryMethod, details: MoveDetails, csrf: string): Promise<Shipment>
  moveAll(orderIds: string[], status: DeliveryStatus, note: string, csrf: string): Promise<BulkResult>
  closeStale(days: number, csrf: string): Promise<BulkResult>
}
