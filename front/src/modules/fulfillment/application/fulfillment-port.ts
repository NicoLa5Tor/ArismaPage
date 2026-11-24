import type { CarrierInfo } from "../../shared/domain/carriers"
import type { Board, BulkResult, Courier, DeliveryMethod, DeliveryStatus, MoveDetails, Shipment, TrackingStatus } from "../domain/fulfillment"

export interface FulfillmentPort {
  board(method: DeliveryMethod | "", q: string, staleDays: number): Promise<Board>
  couriers(): Promise<Courier[]>
  shipment(orderId: string): Promise<Shipment>
  move(orderId: string, status: DeliveryStatus, details: MoveDetails, csrf: string): Promise<Shipment>
  reroute(orderId: string, method: DeliveryMethod, details: MoveDetails, csrf: string): Promise<Shipment>
  moveAll(orderIds: string[], status: DeliveryStatus, note: string, csrf: string): Promise<BulkResult>
  closeStale(days: number, csrf: string): Promise<BulkResult>
  /** Asks the carrier now; starts following the guide when it was not yet (counts against the month). */
  refreshTracking(orderId: string, csrf: string): Promise<Shipment>
  trackingStatus(): Promise<TrackingStatus>
  /** The store's carriers, in their order (the inactive ones too, for the settings). */
  carriers(): Promise<CarrierInfo[]>
  saveCarrier(carrier: CarrierInfo, csrf: string): Promise<CarrierInfo>
  setTracking(enabled: boolean, csrf: string): Promise<TrackingStatus>
  /** Saves the store's 17TRACK Security Key once 17TRACK accepts it (it is never shown again). */
  saveTrackingKey(key: string, csrf: string): Promise<TrackingStatus>
  removeTrackingKey(csrf: string): Promise<TrackingStatus>
}
