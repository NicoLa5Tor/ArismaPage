import type { PanelUser, Role } from "../domain/users"

/** Results that create or reset an account carry the one-time temporary password. */
export type WithPassword = { user: PanelUser; temporaryPassword: string }
export interface UsersPort {
  list(): Promise<PanelUser[]>
  create(input: { email: string; name: string; role: Role }, csrf: string): Promise<WithPassword>
  update(id: string, input: { name: string; role: Role; active: boolean }, csrf: string): Promise<PanelUser>
  resetPassword(id: string, csrf: string): Promise<WithPassword>
  closeSessions(id: string, csrf: string): Promise<void>
}
