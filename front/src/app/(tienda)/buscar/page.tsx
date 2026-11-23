import type { Metadata } from "next"
import { httpStoreProfile } from "../../../modules/shared/adapters/http-store-profile"
import { cleanQuestion } from "../../../modules/storefront/domain/assistant"
import { AssistantClient } from "./assistant-client"

export async function generateMetadata(): Promise<Metadata> {
  const { shortName } = await httpStoreProfile.load()
  return {
    title: { absolute: `Pregúntale a ${shortName} | Buscador de juguetes educativos` },
    description: `Describe para quién es, su edad o qué quiere aprender y te mostramos los productos de ${shortName} que encajan. Cotiza por WhatsApp.`,
    robots: { index: true, follow: true },
    alternates: { canonical: "/buscar" },
  }
}

// /buscar?q=... (the example questions on the home) arrives with the question already written, ready to send.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams
  return <AssistantClient initialQuestion={cleanQuestion((Array.isArray(q) ? q[0] : q) ?? "")} />
}
