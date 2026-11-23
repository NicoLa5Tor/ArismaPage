import type { StoreProfile } from "../domain/store-profile"

export interface StoreProfilePort {
  load(): Promise<StoreProfile>
}
