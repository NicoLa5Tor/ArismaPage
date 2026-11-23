"use client"

import { createContext, useCallback, useContext, type ReactNode } from "react"
import { EMPTY_PROFILE, whatsappLink, type StoreProfile } from "../domain/store-profile"

const ProfileContext = createContext<StoreProfile>(EMPTY_PROFILE)

/** The composition root loads the profile once and hands it to every page below. */
export function StoreProfileProvider({ profile, children }: { profile: StoreProfile; children: ReactNode }) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}
export const useStoreProfile = () => useContext(ProfileContext)
/** A function that opens a WhatsApp chat with the store; it gives undefined when the store has no WhatsApp. */
export function useWhatsapp() {
  const profile = useStoreProfile()
  return useCallback((message: string) => whatsappLink(profile, message), [profile])
}
