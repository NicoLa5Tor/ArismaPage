// Mirrors back/.../catalog/domain/Pricing.java: base prices keep cents, customer prices round to whole pesos.
export function withTax(base: number | null, percent: number): number | null {
  return base == null ? null : Math.round(base * (1 + percent / 100))
}
export function withoutTax(gross: number | null, percent: number): number | null {
  return gross == null ? null : Math.round(gross / (1 + percent / 100) * 100) / 100
}
