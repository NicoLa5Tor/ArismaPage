import type { CatalogPort } from "../application/catalog-port"
import { usePort } from "../../shared/ui/admin-context"
export const useCatalogPort = () => usePort<CatalogPort>("catalog")
