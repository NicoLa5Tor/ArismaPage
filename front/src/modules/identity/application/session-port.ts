import type { CurrentUser } from "../domain/users"

export type Session = { csrf: string; user: CurrentUser }
/** Administrator session: cookie-based, with a CSRF token required on every change. */
export interface SessionPort {
  /** Current session, or null when signed out. */
  restore(): Promise<Session | null>
  login(email: string, password: string): Promise<Session>
  logout(csrf: string): Promise<void>
  changePassword(current: string, next: string, csrf: string): Promise<void>
}
