import { LegalRoute, legalMetadata } from "../legal-route"

export const generateMetadata = () => legalMetadata("privacy")
export default function PrivacyPage() { return <LegalRoute kind="privacy" /> }
