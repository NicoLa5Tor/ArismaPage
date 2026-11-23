import { usePort } from "../../shared/ui/ports"
import type { AddressBookPort } from "../application/address-book-port"

export const useAddressBookPort = () => usePort<AddressBookPort>("addressBook")
