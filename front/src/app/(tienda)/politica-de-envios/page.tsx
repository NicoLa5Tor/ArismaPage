import { LegalRoute, legalMetadata } from "../legal-route"

export const generateMetadata = () => legalMetadata("shipping")
export default function ShippingPolicyPage() { return <LegalRoute kind="shipping" /> }
