"use client"

import { useEffect, useState } from "react"
import type { CatalogSearchPort } from "../../application/catalog-search-port"
import type { CatalogCategory } from "../../domain/catalog"
import { usePort } from "../../../shared/ui/ports"

/** The search over the published catalog, as the store wires it. */
export const useCatalogSearchPort = () => usePort<CatalogSearchPort>("catalogSearch")

/** The catalog's categories: the ones the page already has, or read once in the browser and shared by every header. */
export function useCatalogCategories(given?: CatalogCategory[]): CatalogCategory[] {
  const port = useCatalogSearchPort()
  const [loaded, setLoaded] = useState<CatalogCategory[]>([])
  const needed = !given || given.length === 0
  useEffect(() => {
    if (!needed) return
    let alive = true
    port.categories().then((list) => { if (alive) setLoaded(list) }).catch(() => { /* the box still searches products */ })
    return () => { alive = false }
  }, [needed, port])
  return needed ? loaded : given
}
