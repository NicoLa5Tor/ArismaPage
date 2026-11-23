import type { AddressBookPort } from "../application/address-book-port"
import type { Profile, SavedAddress } from "../domain/address"
import { storeJson, storeRequest } from "../../shared/adapters/store-client"

const BOOK = "/shop/account/addresses"
const cities = new Map<string, Promise<string[]>>()

export const httpAddressBook: AddressBookPort = {
  addresses: () => storeRequest<SavedAddress[]>(BOOK),
  add: (draft, csrf) => storeRequest<SavedAddress>(BOOK, storeJson("POST", draft, csrf)),
  update: (id, draft, csrf) => storeRequest<SavedAddress>(`${BOOK}/${encodeURIComponent(id)}`, storeJson("PUT", draft, csrf)),
  async remove(id, csrf) { await storeRequest(`${BOOK}/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "X-CSRF-Token": csrf } }) },
  makeDefault: (id, csrf) => storeRequest<SavedAddress[]>(`${BOOK}/${encodeURIComponent(id)}/default`, { method: "PUT", headers: { "X-CSRF-Token": csrf } }),
  profile: () => storeRequest<Profile>("/shop/account/profile"),
  saveProfile: (profile, csrf) => storeRequest<Profile>("/shop/account/profile", storeJson("PUT", profile, csrf)),
  cities(state) {
    // the same department is asked once per visit; a failed answer is asked again next time
    let found = cities.get(state)
    if (!found) {
      found = storeRequest<string[]>(`/public/places/cities?departamento=${encodeURIComponent(state)}`).catch((error) => { cities.delete(state); throw error })
      cities.set(state, found)
    }
    return found
  },
}
