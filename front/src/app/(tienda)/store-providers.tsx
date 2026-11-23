"use client"

import type { ReactNode } from "react"
import { httpAccount } from "../../modules/account/adapters/http-account"
import { httpAddressBook } from "../../modules/account/adapters/http-address-book"
import { AccountProvider } from "../../modules/account/ui/account-context"
import { localCartStore } from "../../modules/cart/adapters/local-cart-store"
import { CartProvider } from "../../modules/cart/ui/cart-context"
import { CartDrawer } from "../../modules/cart/ui/cart-drawer"
import { httpCheckout } from "../../modules/checkout/adapters/http-checkout"
import { httpPosts } from "../../modules/reviews/adapters/http-posts"
import { httpCatalogSearch } from "../../modules/storefront/adapters/http-catalog-search"
import type { StoreProfile } from "../../modules/shared/domain/store-profile"
import { PortsProvider } from "../../modules/shared/ui/ports"
import { StoreProfileProvider } from "../../modules/shared/ui/store-profile"

// Composition root of the public store: the adapters behind each port, the shopper's session, the cart shared by every
// page and its drawer.
const ports = { cartStore: localCartStore, account: httpAccount, addressBook: httpAddressBook, posts: httpPosts, checkout: httpCheckout, catalogSearch: httpCatalogSearch }

export function StoreProviders({ profile, children }: { profile: StoreProfile; children: ReactNode }) {
  return (
    <StoreProfileProvider profile={profile}>
    <PortsProvider ports={ports}>
      <AccountProvider>
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
      </AccountProvider>
    </PortsProvider>
    </StoreProfileProvider>
  )
}
