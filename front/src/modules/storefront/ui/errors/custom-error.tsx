"use client"

import { usePathname } from "next/navigation"
import type { ErrorPage } from "../../../shared/domain/error-page"
import { ErrorFrame } from "../../../shared/ui/error-frame"
import { useStoreProfile } from "../../../shared/ui/store-profile"

/** The store's own error page, written in the panel, inside the store's header and footer. */
export function CustomError({ page, onRetry }: { page: ErrorPage; onRetry?: () => void }) {
  const profile = useStoreProfile()
  const path = usePathname()
  return <ErrorFrame page={page} store={{ name: profile.name, whatsapp: profile.whatsapp }} path={path} onRetry={onRetry} title={onRetry ? "Error al cargar la página" : "Página no encontrada"} />
}
