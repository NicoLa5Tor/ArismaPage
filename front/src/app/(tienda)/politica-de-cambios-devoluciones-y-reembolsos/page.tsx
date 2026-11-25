import { LegalRoute, legalMetadata } from "../legal-route"

export const generateMetadata = () => legalMetadata("returns")
export default function ReturnsPage() { return <LegalRoute kind="returns" /> }
