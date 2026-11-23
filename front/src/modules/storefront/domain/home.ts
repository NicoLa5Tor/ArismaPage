// Contenido de la home después del recorrido. Todo sale de arisma.com.co o del catálogo: nada de cifras inventadas.
import type { BrandTone } from "./catalog"

export const store = {
  legalName: "ARISMA S.A.",
  taxId: "860.049.903-8",
  since: 1984,
  warrantyMonths: 6,
  address: "Calle 53 No. 15-24, locales 103 al 105",
  city: "Bogotá, Colombia",
  hours: ["Lunes a viernes de 9:00 a. m. a 5:30 p. m.", "Sábados de 9:30 a. m. a 5:30 p. m."],
  phone: { label: "601 210 2138", href: "tel:+576012102138" },
  mobile: { label: "310 866 9112", href: "tel:+573108669112" },
  site: "https://arisma.com.co",
  instagram: "https://www.instagram.com/arisma_co/",
  facebook: "https://www.facebook.com/Arisma-101031415820418",
  youtube: "https://www.youtube.com/channel/UCTGBgINStdOQyZjACv1ygXw",
} as const

export const manifesto = { eyebrow: "Desde 1984 en Bogotá", lines: ["Aprender no cabe en un pupitre.", "Se arma, se juega y se comparte."] }

/** Real catalog photos with the background cut out; they float around the manifesto. `width` is in viewport-width units, `depth` is how much the toy moves with the scroll. */
export type ManifestoToy = { id: string; src: string; width: number; height: number; size: number; depth: number; tilt: number }

export const manifestoToys: ManifestoToy[] = [
  { id: "brazo-robotico", src: "/home/toys/brazo-robotico.webp", width: 800, height: 559, size: 27, depth: 1, tilt: -6 },
  { id: "torre-de-hanoi", src: "/home/toys/torre-de-hanoi.webp", width: 433, height: 138, size: 17, depth: 0.5, tilt: 5 },
  { id: "rompecabezas-colombia", src: "/home/toys/rompecabezas-colombia.webp", width: 428, height: 558, size: 12, depth: 0.7, tilt: -9 },
  { id: "dinosaurio", src: "/home/toys/dinosaurio.webp", width: 789, height: 800, size: 18, depth: 1.1, tilt: 8 },
  { id: "tangram", src: "/home/toys/tangram.webp", width: 534, height: 222, size: 19, depth: 0.6, tilt: -4 },
  { id: "ajedrez", src: "/home/toys/ajedrez.webp", width: 800, height: 588, size: 24, depth: 0.9, tilt: 6 },
]

export type Benefit = { id: "age" | "classroom" | "quote" | "shipping"; tone: BrandTone; title: string; text: string }

export const benefits: Benefit[] = [
  { id: "age", tone: "pink", title: "El juguete para la edad exacta", text: "Filtra por edad o cuéntale al asistente para quién es. Ves solo lo que le sirve hoy." },
  { id: "classroom", tone: "blue", title: "Un salón completo en una sola cotización", text: "Asesores y pedagogos arman contigo la dotación por área y por grado." },
  { id: "quote", tone: "orange", title: "Precio y entrega claros antes de pagar", text: "Una persona te responde por WhatsApp con valor, disponibilidad y tiempos." },
  { id: "shipping", tone: "green", title: "Llega a tu puerta en toda Colombia", text: "Despachamos a todo el país. En Bogotá el envío es gratis en compras de más de $150.000." },
]

export type Step = { id: "choose" | "quote" | "receive"; title: string; text: string; tone: BrandTone }

export const steps: Step[] = [
  { id: "choose", title: "Elige o pregunta", text: "Recorre el catálogo por categoría o describe lo que buscas en Pregúntale a Arisma.", tone: "blue" },
  { id: "quote", title: "Recibe tu cotización", text: "Toca Cotizar y te respondemos por WhatsApp con precio, disponibilidad y entrega.", tone: "orange" },
  { id: "receive", title: "Recíbelo en casa o en el colegio", text: "Pagas con el medio que prefieras y lo despachamos a cualquier ciudad de Colombia.", tone: "green" },
]

/** What the three step cards show. Photos and the toy are real catalog pictures. */
export const stepArt = {
  photos: ["/catalog/categorias/didacticos.jpg", "/catalog/categorias/ciencias-y-tecnologia.jpg", "/catalog/categorias/juguetes-geniales.jpg"],
  fallbackProduct: "Ajedrez de madera",
  reply: "¡Hola! Ya te confirmo precio, disponibilidad y tiempo de entrega.",
  payments: ["Tarjeta de crédito", "PSE", "Baloto", "Bancos"],
  shipping: "Envío gratis en Bogotá en compras de más de $150.000",
  toy: "/home/toys/dinosaurio.webp",
  marker: "/home/toys/brazo-robotico.webp",
} as const

/** Opiniones publicadas en arisma.com.co ("Nuestros clientes"), copiadas tal cual. */
export type Voice = { name: string; about: string; quote: string }

export const voices: Voice[] = [
  { name: "Carlos Cifuentes", about: "Materiales didácticos", quote: "Que buen lugar para comprar las cartillas de mini arco pues son fabricantes y también hemos encontrado muchos juguetes para nuestras hijas. Definitivamente recomendado." },
  { name: "Colegio Face", about: "Regletas matemáticas y bloques", quote: "Agradezco todo el servicio prestado, muy satisfechos con el material educativo y muy oportuna la entrega, y amabilidad en el asesor." },
  { name: "Rosana Álvarez", about: "MiniArco", quote: "Compré el Miniarco, un juego espectacular que me recomendó mi terapeuta ocupacional. Muy buenos precios y variedad de productos." },
  { name: "Héctor Barragán", about: "Tablero y cartillas MiniArco", quote: "La compra y la atención de Arisma por su canal digital fue excelente. La página es amigable y la pasarela de compra es fácil de manejar." },
  { name: "Andrea Patricia Rodríguez", about: "Robot, dominó y rompecabezas", quote: "Súper recomendado para todas las edades, desde 0 meses hasta adulto mayor." },
]

export const askExamples = [
  "Regalo para una niña de 6 años",
  "Material para enseñar a sumar",
  "Juegos de mesa para toda la familia",
  "Algo de robótica para un niño de 10 años",
]

export const askUrl = (question: string) => `/buscar?q=${encodeURIComponent(question)}`

export type Faq = { question: string; answer: string }

export const faqs: Faq[] = [
  { question: "¿A dónde despachan?", answer: "A todo el territorio nacional de Colombia. También atendemos distribuidores en Suramérica, Centroamérica y el Caribe." },
  { question: "¿Cuánto cuesta el envío?", answer: "En Bogotá el envío es gratis en compras de más de $150.000. Para el resto del país te confirmamos el valor por WhatsApp antes de que pagues. La compra mínima por la página es de $50.000." },
  { question: "¿Cómo puedo pagar?", answer: "Con tarjeta de crédito, PSE, Baloto o pago referenciado en bancos. El pago contra entrega aplica en compras desde $200.000." },
  { question: "¿Qué garantía tienen los productos?", answer: "Seis meses por defectos de fabricación. La garantía no cubre daños por uso inadecuado." },
  { question: "¿Por qué algunos productos dicen precio a cotizar?", answer: "Porque su valor depende de la cantidad o de la dotación que necesites. Toca Cotizar y te enviamos por WhatsApp el precio y la disponibilidad." },
  { question: "¿Atienden colegios y jardines?", answer: "Sí. Atendemos instituciones y familias. Nuestro equipo de asesores comerciales y pedagogos te ayuda a armar la dotación por edad y por área." },
  { question: "¿Puedo ir a la tienda?", answer: `Sí. Estamos en la ${store.address}, en Bogotá. ${store.hours[0]} y ${store.hours[1].toLowerCase()}.` },
  { question: "¿Cómo sé qué le sirve a mi hijo según su edad?", answer: "Entra a Pregúntale a Arisma, escribe la edad y lo que quieres trabajar y verás productos reales del catálogo. Si prefieres hablar con alguien, un asesor te orienta por WhatsApp." },
]

/** What a shopper wants to know before paying, on every product page. Same facts as the FAQ, taken from arisma.com.co. */
export type PurchaseFact = { id: "shipping" | "payment" | "warranty" | "store"; tone: BrandTone; title: string; text: string }

export const purchaseFacts: PurchaseFact[] = [
  { id: "shipping", tone: "green", title: "Envío a toda Colombia", text: "Despachamos a todo el país. En Bogotá el envío es gratis en compras de más de $150.000." },
  { id: "payment", tone: "blue", title: "Paga como prefieras", text: "Tarjeta de crédito, PSE, Baloto o pago referenciado en bancos." },
  { id: "warranty", tone: "orange", title: `Garantía de ${store.warrantyMonths} meses`, text: "Cubre defectos de fabricación. No cubre daños por uso inadecuado." },
  { id: "store", tone: "pink", title: "También en la tienda", text: `${store.address}, ${store.city}. ${store.hours[0]}` },
]
