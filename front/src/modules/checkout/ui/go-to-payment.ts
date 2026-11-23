import type { Instruction } from "../domain/checkout"

const GATEWAYS = new Set(["checkout.wompi.co", "checkout.payulatam.com", "sandbox.checkout.payulatam.com"])

/**
 * Sends the browser to the gateway's own payment page. The address comes from the store, and still it is only followed
 * when it is one of the known gateway hosts over https. Returns false when there is nowhere to go (manual payment).
 */
export function goToPayment(instruction: Instruction): boolean {
  if (instruction.kind === "manual" || !instruction.url) return false
  const url = new URL(instruction.url)
  if (url.protocol !== "https:" || !GATEWAYS.has(url.hostname)) throw new Error("No se pudo abrir la página de pago.")
  if (instruction.kind === "redirect") { window.location.assign(url.href); return true }
  const form = document.createElement("form")
  form.method = "POST"; form.action = url.href; form.style.display = "none"
  for (const [name, value] of Object.entries(instruction.fields)) {
    const input = document.createElement("input")
    input.type = "hidden"; input.name = name; input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
  return true
}
