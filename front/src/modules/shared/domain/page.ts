/** One page of a list plus the total number of matching rows. */
export type Page<T> = { items: T[]; total: number }
export const PAGE_SIZE = 25
/** Bogotá calendar days, inclusive; empty strings leave that side open. */
export type DateRange = { from: string; to: string }
