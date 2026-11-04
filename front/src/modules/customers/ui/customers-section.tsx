"use client"

import { useState } from "react"
import { Users } from "@phosphor-icons/react"
import { fullName, type CustomerRow, type CustomerSort } from "../domain/customers"
import { count, date, money, plural } from "../../shared/ui/format"
import { Async, Card, Chips, Pager, Search, useDebounced, useLoad } from "../../shared/ui/parts"
import { DataTable, type Column } from "../../shared/ui/data-table"
import { useSession } from "../../shared/ui/admin-context"
import { useCustomersPort } from "./use-customers"

const COLUMNS: Column<CustomerRow>[] = [
  { key: "name", label: "Cliente", primary: true, render: c => <span className="block min-w-0"><span className="block max-w-64 truncate">{fullName(c)}</span><span className="block max-w-64 truncate text-xs font-normal muted">{c.email}</span></span> },
  { key: "city", label: "Ciudad", desktopOnly: true, render: c => <span className="muted">{c.city ?? "—"}</span> },
  { key: "account", label: "Cuenta", desktopOnly: true, render: c => <span className="muted">{c.hasAccount ? "Registrado" : "Invitado"}</span> },
  { key: "orders", label: "Pedidos", numeric: true, render: c => count(c.orders) },
  { key: "spent", label: "Total comprado", numeric: true, render: c => <span className="font-semibold">{money(c.totalSpent)}</span> },
  { key: "last", label: "Última compra", render: c => <span className="muted whitespace-nowrap">{date(c.lastOrderAt)}</span> },
]
const SORTS: { value: CustomerSort; label: string }[] = [{ value: "recent", label: "Compra reciente" }, { value: "spent", label: "Mayor valor" }, { value: "orders", label: "Más pedidos" }, { value: "name", label: "Apellido" }]

export function CustomersSection() {
  const api = useCustomersPort()
  const { openCustomer, version } = useSession()
  const [q, setQ] = useState(""), [buyers, setBuyers] = useState(true), [sort, setSort] = useState<CustomerSort>("recent"), [offset, setOffset] = useState(0)
  const query = useDebounced(q)
  const customers = useLoad(() => api.list(query, buyers, sort, offset), [query, buyers, sort, offset, version])
  return <div className="glass-scroll"><Card icon={Users} title={buyers ? "Clientes que han comprado" : "Todos los clientes y cuentas"} subtitle={customers.data ? plural(customers.data.total, "cliente", "clientes") : undefined}>
    <div className="mt-4 grid gap-4">
      <div className="glass-filters"><Search value={q} onChange={v => { setQ(v); setOffset(0) }} label="Buscar por nombre, correo, teléfono o documento" />
        <label className="glass-check py-2"><input type="checkbox" checked={buyers} onChange={e => { setBuyers(e.target.checked); setOffset(0) }} />Solo quienes han comprado</label></div>
      <Chips label="Ordenar por" value={sort} onChange={v => { setSort((v || "recent") as CustomerSort); setOffset(0) }} options={SORTS} />
    </div>
    <div className="mt-4"><Async state={customers} label="Cargando clientes" rows={6} empty={{ icon: Users, title: "No encontramos clientes", hint: buyers ? "Desmarca “Solo quienes han comprado” para ver todas las cuentas." : "Prueba con otra búsqueda.", when: d => d.items.length === 0 }}>{d => <>
      <DataTable caption="Clientes" rows={d.items} columns={COLUMNS} onOpen={c => openCustomer(c.id)} />
      <Pager offset={offset} total={d.total} onChange={setOffset} />
    </>}</Async></div>
  </Card></div>
}
