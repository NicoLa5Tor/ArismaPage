import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Hexagonal layers, per module: domain → nothing; application → domain; ui → application/domain/shared ui;
  // adapters are wired only by the composition root (src/app and modules/admin/adapters).
  {
    files: ["src/modules/*/domain/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [
      { group: ["**/application/*", "**/adapters/*", "**/ui/*"], message: "El dominio no depende de otras capas." },
      { group: ["react", "react-dom", "next", "next/*", "@phosphor-icons/*"], message: "El dominio no depende de frameworks." },
    ] }] },
  },
  {
    files: ["src/modules/*/application/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [
      { group: ["**/adapters/*", "**/ui/*"], message: "La aplicación solo define puertos y casos de uso." },
      { group: ["react", "react-dom", "next", "next/*"], message: "La aplicación no depende de frameworks." },
    ] }] },
  },
  {
    files: ["src/modules/*/ui/**"],
    ignores: ["src/modules/admin/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [
      { group: ["**/adapters/*"], message: "La interfaz usa puertos (usePort), nunca adaptadores." },
    ] }] },
  },
  // Admin images come from the authenticated API proxy or local blob previews, which the Next optimizer cannot fetch.
  { files: ["src/modules/**/ui/**"], rules: { "@next/next/no-img-element": "off" } },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "*.config.js",
    "check-env-variables.js",
    "next-sitemap.js",
  ]),
])
