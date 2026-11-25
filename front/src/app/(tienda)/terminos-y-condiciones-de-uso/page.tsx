import { LegalRoute, legalMetadata } from "../legal-route"

export const generateMetadata = () => legalMetadata("terms")
export default function TermsPage() { return <LegalRoute kind="terms" /> }
