import type { AddressDraft, Profile, SavedAddress } from "../domain/address"

/** The signed-in shopper's address book and own data. Writes carry the session's CSRF token. */
export interface AddressBookPort {
  /** The default one first. */
  addresses(): Promise<SavedAddress[]>
  add(draft: AddressDraft, csrf: string): Promise<SavedAddress>
  update(id: string, draft: AddressDraft, csrf: string): Promise<SavedAddress>
  remove(id: string, csrf: string): Promise<void>
  /** Answers the book again, with the new default first. */
  makeDefault(id: string, csrf: string): Promise<SavedAddress[]>
  profile(): Promise<Profile>
  saveProfile(profile: Profile, csrf: string): Promise<Profile>
  /** The department's official municipalities (DANE), alphabetically: the only choices for an address. */
  cities(state: string): Promise<string[]>
}
