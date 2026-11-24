/**
 * The account a refund is transferred to. The same rules as the store (sales/domain/Payout.java): the store checks
 * again, this only helps the shopper see a mistake before sending.
 */
export type RefundAccount = { bank: string; accountType: string; number: string; holder: string; documentType: string; document: string }

export const BANKS = ["Bancolombia", "Banco de Bogotá", "Davivienda", "BBVA", "Banco de Occidente", "Banco Popular", "Banco AV Villas", "Banco Caja Social",
  "Scotiabank Colpatria", "Itaú", "Banco Agrario", "Banco Falabella", "Banco Pichincha", "Bancoomeva", "Banco GNB Sudameris", "Banco W", "Banco Finandina",
  "Banco Serfinanza", "Bancamía", "Banco Mundo Mujer", "Banco Cooperativo Coopcentral", "Confiar", "Lulo Bank", "Nu Colombia", "Nequi", "Daviplata", "Movii", "RappiPay", "Dale!"]
export const WALLETS = ["Nequi", "Daviplata", "Movii", "RappiPay", "Dale!"]
export const ACCOUNT_TYPES = [{ value: "ahorros", label: "Ahorros" }, { value: "corriente", label: "Corriente" }]
export const DOCUMENT_TYPES = [{ value: "CC", label: "Cédula de ciudadanía" }, { value: "CE", label: "Cédula de extranjería" }, { value: "NIT", label: "NIT" }, { value: "PP", label: "Pasaporte" }, { value: "TI", label: "Tarjeta de identidad" }]

export const emptyAccount = (): RefundAccount => ({ bank: "", accountType: "ahorros", number: "", holder: "", documentType: "CC", document: "" })
export const isWallet = (bank: string) => WALLETS.includes(bank)

/** The first problem of each field, or none. */
export function accountErrors(a: RefundAccount): Partial<Record<keyof RefundAccount, string>> {
  const errors: Partial<Record<keyof RefundAccount, string>> = {}
  const number = a.number.replace(/[\s-]/g, ""), document = a.document.replace(/[\s.-]/g, ""), holder = a.holder.trim().replace(/\s+/g, " ")
  if (!BANKS.includes(a.bank)) errors.bank = "Elige tu banco o billetera."
  if (isWallet(a.bank) ? !/^3\d{9}$/.test(number) : !/^\d{6,20}$/.test(number)) errors.number = isWallet(a.bank) ? "Escribe el celular: 10 dígitos que empiezan por 3." : "Escribe el número de la cuenta: solo dígitos, entre 6 y 20."
  if (!isWallet(a.bank) && !["ahorros", "corriente"].includes(a.accountType)) errors.accountType = "Elige el tipo de cuenta."
  if (holder.length < 5 || holder.length > 80 || !/^[A-Za-zÀ-ÖØ-öø-ÿÑñ .'-]+$/.test(holder)) errors.holder = "Escribe el nombre completo del titular."
  if (!DOCUMENT_TYPES.some((d) => d.value === a.documentType)) errors.documentType = "Elige el tipo de documento."
  if (!/^[0-9A-Za-z]{5,15}$/.test(document)) errors.document = "Escribe el número de documento del titular."
  return errors
}
