import type { Shopper, ShopperSession, SocialProvider } from "../domain/account"

/** Store account: cookie session with a CSRF token required on every change. */
export interface AccountPort {
  /** Current session, or null when signed out. */
  restore(): Promise<ShopperSession | null>
  /** `human` is the Turnstile token when the store asks for one; sign-in, sign-up and the reset request need it then. */
  login(email: string, password: string, human?: string): Promise<ShopperSession>
  /** acceptsPrivacy: they authorized the treatment of their data and accepted the terms (required). */
  register(name: string, email: string, password: string, acceptsPrivacy: boolean, human?: string): Promise<ShopperSession>
  logout(csrf: string): Promise<void>
  /** Address of the identity provider's sign-in page; it also remembers where to come back to after it. */
  socialStart(provider: SocialProvider, next: string): Promise<string>
  /** Finishes a social sign-in with what the provider sent back; answers the session and where the shopper was going. */
  socialFinish(state: string, code: string): Promise<{ session: ShopperSession; next: string }>

  rename(name: string, csrf: string): Promise<Shopper>
  /** `current` is ignored for accounts that never had a password (made with Google or Facebook). Other sessions close. */
  changePassword(current: string, next: string, csrf: string): Promise<void>
  logoutEverywhere(csrf: string): Promise<void>
  /** Everything the store keeps about the shopper, as JSON to save (Ley 1581). */
  exportData(): Promise<Blob>
  /** Erases the account: the password, or for one without a password the word ELIMINAR. */
  erase(password: string, confirm: string, csrf: string): Promise<void>
  /** Emails a link that confirms the address. */
  requestVerification(csrf: string): Promise<void>
  confirmEmail(token: string): Promise<void>
  /** Always succeeds, whether the email has an account or not. */
  requestReset(email: string, human?: string): Promise<void>
  resetPassword(token: string, password: string): Promise<void>
  /** Tells the other open tabs that the session changed (signed in or out). */
  announce(): void
  /** Calls back when another tab announced a change. Returns how to stop listening. */
  onAnnounce(listener: () => void): () => void
  /** Calls back when an account call found the session gone. */
  onSessionLost(listener: () => void): () => void
}
