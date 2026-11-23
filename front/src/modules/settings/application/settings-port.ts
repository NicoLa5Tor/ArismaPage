import type { Profile, CheckoutRules, Conversations, CredentialsChange, Environment, GatewayCode, Mail, MailView, Outbox, Payments, Shipping, StoreSettings } from "../domain/settings"

export interface SettingsPort {
  load(): Promise<StoreSettings>
  saveStore(value: Profile, csrf: string): Promise<Profile>
  saveConversations(value: Conversations, csrf: string): Promise<Conversations>
  saveShipping(value: Shipping, csrf: string): Promise<Shipping>
  saveCheckout(value: CheckoutRules, csrf: string): Promise<CheckoutRules>
  /** Store-wide choice per section of the product page: "show" or "hide". */
  saveProductPage(value: Record<string, string>, csrf: string): Promise<Record<string, string>>
  /** The one method shoppers pay with ("" for none) and whether it charges for real. */
  choosePayments(active: GatewayCode | "", mode: Environment, csrf: string): Promise<Payments>
  /** A secret left blank keeps the stored one. */
  saveCredentials(code: GatewayCode, environment: Environment, change: CredentialsChange, csrf: string): Promise<Payments>
  loadMail(): Promise<MailView>
  /** A blank password keeps the stored one. */
  saveMail(value: Mail, password: string, csrf: string): Promise<MailView>
  sendTestMail(to: string, csrf: string): Promise<string>
  outbox(limit: number, offset: number): Promise<Outbox>
}
