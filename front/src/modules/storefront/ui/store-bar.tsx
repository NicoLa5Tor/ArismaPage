"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CaretDown, SquaresFour } from "@phosphor-icons/react"
import { AccountButton } from "../../account/ui/account-button"
import { CartButton } from "../../cart/ui/cart-button"
import { type CatalogCategory, catalogHref } from "../domain/catalog"
import { CategoryExplorer } from "./catalog/category-explorer"
import { MobileMenu } from "./mobile-menu"
import { StoreSearch, type StoreSearchProps } from "./search/store-search"
import { useCatalogCategories } from "./search/use-catalog-categories"
import { BrandLink } from "./store-brand"

type Props = {
  /** The catalog passes its live search; other pages leave it out and Enter opens the catalog. */
  search?: Pick<StoreSearchProps, "value" | "onValueChange" | "onSubmit">
  categories?: CatalogCategory[]
  /** The category being browsed. */
  current?: string
  /** The catalog filters in place; other pages open the catalog on the category. */
  onCategory?: (slug: string) => void
  /** The catalog opens the explorer from more than one place, so it may hold its state. */
  explorer?: { open: boolean; setOpen: (open: boolean) => void }
  contactHref?: string
}

/**
 * The one header of the store: logo, categories, the search box and the cart. Everything else lives in the menu. On a phone
 * the search sits on its own row and is the part that stays on screen while scrolling.
 */
export function StoreBar({ search, categories: given, current, onCategory, explorer, contactHref }: Props) {
  const router = useRouter()
  const [ownOpen, setOwnOpen] = useState(false)
  const open = explorer?.open ?? ownOpen
  const setOpen = explorer?.setOpen ?? setOwnOpen
  const categories = useCatalogCategories(given)
  const select = onCategory ?? ((slug: string) => router.push(catalogHref({ category: slug })))

  return (
    <header className="store-bar">
      <div className="store-bar-row">
        <BrandLink className="brand store-bar-brand" />
        <button type="button" className="store-bar-categories squircle" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} aria-label="Ver categorías">
          <SquaresFour size={20} weight="fill" aria-hidden="true" />
          <span className="store-bar-categories-label">Categorías</span>
          <CaretDown className="store-bar-categories-caret" size={14} weight="bold" aria-hidden="true" />
        </button>
        <div className="store-bar-search">
          <StoreSearch {...search} categories={categories} onCategory={onCategory} />
        </div>
        <div className="store-bar-actions">
          <AccountButton />
          <CartButton />
          <MobileMenu contactHref={contactHref} />
        </div>
      </div>
      <CategoryExplorer open={open} onClose={() => setOpen(false)} categories={categories} current={current} onSelect={select} />
    </header>
  )
}
