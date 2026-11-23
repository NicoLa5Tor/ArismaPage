// The shopper's saved addresses and own data, as Mercado Libre asks for them. The store checks everything again.
import { departmentName } from "../../shared/domain/colombia"

export type AddressLabel = "casa" | "trabajo" | "otro"
export const LABELS: { value: AddressLabel; label: string }[] = [{ value: "casa", label: "Casa" }, { value: "trabajo", label: "Trabajo" }, { value: "otro", label: "Otro" }]
export const labelName = (label: AddressLabel) => LABELS.find((l) => l.value === label)?.label ?? "Otro"

export type SavedAddress = {
  id: string; label: AddressLabel; recipient: string; phone: string; state: string; city: string; neighborhood: string
  street: string; detail: string; instructions: string; isDefault: boolean
}
/** What the form edits; makeDefault asks for it to become the default. */
export type AddressDraft = Omit<SavedAddress, "id" | "isDefault"> & { makeDefault: boolean }
export const MAX_ADDRESSES = 10

export const emptyAddress = (recipient = "", phone = ""): AddressDraft =>
  ({ label: "casa", recipient, phone, state: "", city: "", neighborhood: "", street: "", detail: "", instructions: "", makeDefault: false })
export const draftOf = (a: SavedAddress): AddressDraft =>
  ({ label: a.label, recipient: a.recipient, phone: a.phone, state: a.state, city: a.city, neighborhood: a.neighborhood, street: a.street, detail: a.detail, instructions: a.instructions, makeDefault: a.isDefault })

export type AddressErrors = Partial<Record<keyof AddressDraft, string>>
const BAD = /[<>]/
export function addressErrors(d: AddressDraft): AddressErrors {
  const e: AddressErrors = {}
  if (d.recipient.trim().length < 2) e.recipient = "Escribe el nombre de quien recibe"
  if (d.phone.replace(/\D/g, "").length < 7) e.phone = "Escribe un celular de contacto"
  if (!d.state) e.state = "Elige el departamento"
  if (d.city.trim().length < 2) e.city = "Elige el municipio"
  if (d.street.trim().length < 5) e.street = "Escribe la dirección, por ejemplo Calle 10 # 20-30"
  for (const key of ["recipient", "city", "neighborhood", "street", "detail", "instructions"] as const) if (BAD.test(d[key])) e[key] = "Escríbelo sin símbolos < o >"
  return e
}

/** The address in two lines: "Calle 10 # 20-30, Apto 301" and "Chapinero, Medellín, Antioquia". */
export function addressLines(a: Pick<SavedAddress, "street" | "detail" | "neighborhood" | "city" | "state">): [string, string] {
  return [[a.street, a.detail].filter(Boolean).join(", "), [a.neighborhood, a.city, departmentName(a.state)].filter(Boolean).join(", ")]
}

/** The buyer's own data, filled in when buying and kept for next time. */
export type Profile = { firstName: string; lastName: string; phone: string; documentType: string; documentNumber: string; company: string }
export const emptyProfile: Profile = { firstName: "", lastName: "", phone: "", documentType: "CC", documentNumber: "", company: "" }
export type ProfileErrors = Partial<Record<keyof Profile, string>>
export function profileErrors(p: Profile): ProfileErrors {
  const e: ProfileErrors = {}
  if (p.firstName.trim().length < 2) e.firstName = "Escribe tu nombre"
  if (p.lastName.trim().length < 2) e.lastName = "Escribe tu apellido"
  if (p.phone.replace(/\D/g, "").length < 7) e.phone = "Escribe un celular de contacto"
  if (p.documentNumber.replace(/[^0-9A-Za-z]/g, "").length < 5) e.documentNumber = "Escribe el número de documento"
  return e
}
