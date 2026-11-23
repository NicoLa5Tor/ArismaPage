import { createElement } from "react"
import { Atom, Baby, Chalkboard, HandHeart, type Icon, type IconProps, PaintBrushHousehold, PuzzlePiece, Rocket, Sparkle, SquaresFour } from "@phosphor-icons/react"

// One recognisable icon per main category; unknown slugs fall back to a neutral one.
const icons: Record<string, Icon> = {
  didacticos: PuzzlePiece,
  "educando-para-la-vida": HandHeart,
  "aulas-de-clase": Chalkboard,
  "por-edades": Baby,
  "juguetes-geniales": Rocket,
  "ciencias-y-tecnologia": Atom,
  "variedades-y-decoracion": PaintBrushHousehold,
  "nuevos-juegos": Sparkle,
}

export const categoryIcon = (slug: string): Icon => icons[slug] ?? SquaresFour
export const AllCategoriesIcon = SquaresFour

/** A main category's icon as an element, for places that only know the slug. */
export function CategoryIcon({ slug, ...props }: { slug: string } & IconProps) {
  return createElement(categoryIcon(slug), props)
}
