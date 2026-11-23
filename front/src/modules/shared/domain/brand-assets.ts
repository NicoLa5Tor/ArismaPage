// The store's own image files and deployment settings. This front is Arisma's: its files are the defaults. Another
// store sets NEXT_PUBLIC_BRAND_LOGO and NEXT_PUBLIC_BRAND_ICON to its own files in public/brand ("none": no logo, the
// store's name is shown instead; PowerShell drops empty variables, so empty cannot mean that). Name and colours come
// from the store profile.
const env = (value: string | undefined, fallback: string) => (!value ? fallback : value === "none" ? "" : value)
export const BRAND_LOGO = env(process.env.NEXT_PUBLIC_BRAND_LOGO, "/brand/logo-arisma-2023.jpg")
export const BRAND_ICON = env(process.env.NEXT_PUBLIC_BRAND_ICON, "/brand/favicon-arisma.png") || "/brand/tienda.svg"
/** Where social sign-in (Logto) lives; the panel only follows redirects to it. Set per deployment. */
export const SOCIAL_LOGIN_ORIGIN = process.env.NEXT_PUBLIC_SOCIAL_LOGIN_ORIGIN || "https://logto.arisma.com.co"
