"use client"

import Link from "next/link"
import { Sparkle } from "@phosphor-icons/react"
import { BRAND_LOGO } from "../../shared/domain/brand-assets"
import { useStoreProfile } from "../../shared/ui/store-profile"
import { optimized } from "../../shared/ui/optimized-image"

/** The store's logo, linking home. */
export function BrandLink({ className = "brand" }: { className?: string }) {
  const { name } = useStoreProfile()
  return <Link href="/" className={className} aria-label={`${name}, inicio`}>{BRAND_LOGO ? <img {...optimized(BRAND_LOGO, { sizes: "160px", width: 160 })} alt={name} /> : <span className="brand-name">{name}</span>}</Link>
}
/** The assistant's name: "Pregúntale a" and how people call the store. */
export function useAskLabel() { return `Pregúntale a ${useStoreProfile().shortName}` }
/** The header link to the assistant. */
export function AskLink({ className = "catalog-header-ask squircle" }: { className?: string }) {
  const label = useAskLabel()
  return <Link href="/buscar" className={className}><Sparkle size={16} weight="fill" aria-hidden="true" /><span>{label}</span></Link>
}
