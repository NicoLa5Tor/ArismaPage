import type { CurrentUser } from "../domain/users"

export type Session = { csrf: string; user: CurrentUser }
/** Administrator session: cookie-based, with a CSRF token required on every change. */
export interface SessionPort {
  /** Current session, or null when signed out. */
  restore(): Promise<Session | null>
  /** `human` is the Turnstile token when the store asks for one. */
  login(email: string, password: string, human?: string): Promise<Session>
  logout(csrf: string): Promise<{ redirectUrl: string }>
  changePassword(current: string, next: string, csrf: string): Promise<void>
  /** Address of the identity provider's sign-in page for Google or Facebook. */
  socialStart(provider: "google" | "facebook"): Promise<string>
}
