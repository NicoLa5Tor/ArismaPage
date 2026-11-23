// Logo Arisma Didácticos: el ícono va en SVG para verse nítido al escalarlo en la zambullida;
// las palabras salen del logo oficial con fondo transparente.
export const brandPink = "#ff1850"

export function ArismaLogo() {
  return (
    <div className="arisma-logo" role="img" aria-label="Arisma Didácticos">
      <svg className="arisma-logo-icon" viewBox="0 0 456 452" aria-hidden="true">
        <defs><clipPath id="arisma-a-clip"><rect width="456" height="392" /></clipPath></defs>
        <rect width="456" height="452" rx="30" fill={brandPink} />
        <path clipPath="url(#arisma-a-clip)" d="M399 430 L215 98 L86 364 L258 366 Q290 370 310 430" fill="none" stroke="#fff" strokeWidth="56" strokeLinejoin="round" />
      </svg>
      <img className="arisma-logo-risma" src="/brand/logo-arisma-risma.webp" alt="" />
      <img className="arisma-logo-didacticos" src="/brand/logo-arisma-didacticos.webp" alt="" />
    </div>
  )
}
