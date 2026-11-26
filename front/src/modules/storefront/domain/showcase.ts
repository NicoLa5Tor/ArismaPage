// Historia del scroll: cada producto aparece mientras el video lo muestra en acción (segundos del video).
export interface ShowcaseStop {
  id: string
  chapter: string
  name: string
  description: string
  image: string
  imageAlt: string
  from: number
  to: number
}

export const showcaseVideo = { src: "/scroll-world/historia-desktop.mp4?v=8", mobileSrc: "/scroll-world/historia-movil.mp4?v=3", portraitSrc: "/scroll-world/historia-vertical.mp4?v=6", duration: 23.04 }

export const heroUntil = 1.2

// Reparto del scroll (0 a 1): el video ocupa el primer tramo, luego entra el logo y al final la zambullida.
export const outro = { videoEnd: 0.72, logoIn: 0.71, dive: 0.86 }

export const finale = { from: 19.6, lines: ["Juegos que hacen", "volar la imaginación"] }

export const showcaseStops: ShowcaseStop[] = [
  {
    id: "brazo-robotico",
    chapter: "El primer movimiento",
    name: "Brazo robótico",
    description: "Se arma pieza por pieza y se controla con un mando por cable. Una forma concreta de entender cómo se mueve una máquina.",
    image: "/scroll-world/products/brazo-robotico.webp",
    imageAlt: "Brazo robótico amarillo y negro para armar, con pinza y mando de control por cable",
    from: 1.4,
    to: 7.8,
  },
  {
    id: "ajedrez",
    chapter: "Las fichas despiertan",
    name: "Ajedrez de madera",
    description: "Tablero de 45 por 45 cm con fichas plásticas. Estrategia, paciencia y concentración en una mesa compartida.",
    image: "/scroll-world/products/ajedrez.webp",
    imageAlt: "Tablero de ajedrez de madera de Arisma con las fichas blancas y negras en posición inicial",
    from: 8.4,
    to: 12.8,
  },
  {
    id: "dinosaurio",
    chapter: "¡Llega el dinosaurio!",
    name: "Títere de dinosaurio",
    description: "Un títere de mano en tela suave para inventar historias, practicar la voz y animarse a hablar frente a otros.",
    image: "/scroll-world/products/dinosaurio.webp",
    imageAlt: "Títere de mano verde con forma de dinosaurio, boca abierta y cresta en la espalda",
    from: 13.4,
    to: 18,
  },
]
