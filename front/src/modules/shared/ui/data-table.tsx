"use client"

import type { ReactNode } from "react"

export type Column<T> = {
  key: string
  label: string
  render: (row: T) => ReactNode
  /** Right-aligned numeric column. */
  numeric?: boolean
  /** The cell that names the row; it becomes the keyboard-accessible button and the card title on phones. */
  primary?: boolean
  /** Omitted from the phone card to keep it short. */
  desktopOnly?: boolean
}
type Selection = { selected: Set<string>; onToggle: (id: string) => void; onToggleAll: () => void; label: (row: string) => string }

/**
 * Table on wide screens, stacked cards on phones (each cell shows its column label).
 * Clicking a row or its primary button opens it; selection checkboxes are optional.
 */
export function DataTable<T extends { id: string }>({ caption, rows, columns, onOpen, selection }: { caption: string; rows: T[]; columns: Column<T>[]; onOpen?: (row: T) => void; selection?: Selection }) {
  const allSelected = !!selection && rows.length > 0 && rows.every(r => selection.selected.has(r.id))
  return <div className="glass-table-wrap" role="region" aria-label={caption} tabIndex={0}><table className="glass-table glass-table-responsive"><caption className="sr-only">{caption}</caption>
    <thead><tr>{selection && <th className="w-8"><input type="checkbox" aria-label="Seleccionar todo en esta página" checked={allSelected} onChange={selection.onToggleAll} /></th>}{columns.map(c => <th key={c.key} data-column={c.key} className={c.numeric ? "num" : undefined}>{c.label}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.id} data-clickable={onOpen ? "" : undefined} aria-selected={selection ? selection.selected.has(row.id) : undefined} onClick={onOpen ? () => onOpen(row) : undefined}>
      {selection && <td className="glass-cell-check" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={selection.label(row.id)} checked={selection.selected.has(row.id)} onChange={() => selection.onToggle(row.id)} /></td>}
      {columns.map(c => <td key={c.key} data-column={c.key} data-label={c.label} data-primary={c.primary ? "" : undefined} data-desktop-only={c.desktopOnly ? "" : undefined} className={c.numeric ? "num" : undefined}>
        {c.primary && onOpen ? <button type="button" className="glass-row-link" onClick={e => { e.stopPropagation(); onOpen(row) }}>{c.render(row)}</button> : c.render(row)}
      </td>)}
    </tr>)}</tbody>
  </table></div>
}
