# Frontend de Arisma

Proyecto Next.js independiente para la interfaz de Arisma. La implementación empieza con el panel administrativo; no incluye la landing ni el código anterior de Medusa. El backend Quarkus está en `../back`.

```powershell
cd front
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

El panel está en `http://localhost:8000/admin`; la sección y sus filtros viajan en la URL (`/admin?seccion=pedidos&estado=processing`). La ruta de Next.js bajo `src/app/api/arisma-admin` actúa como adaptador HTTP hacia Quarkus.

## Arquitectura

`src/modules` sigue los mismos módulos que el backend (`catalog`, `sales`, `customers`, `quotes`, `inventory`, `promotions`, `reporting`, `identity`), cada uno con:

- `domain/`: tipos y reglas puras (transiciones de pedidos, cálculo de IVA). Sin React ni Next.
- `application/`: el puerto del módulo (interfaz que la interfaz necesita).
- `adapters/`: la implementación HTTP del puerto.
- `ui/`: secciones y diálogos. Obtienen su puerto con `usePort` (por ejemplo `useOrdersPort`), nunca importan adaptadores.

`shared` contiene el cliente HTTP, el formato de fechas y pesos, los componentes comunes (`DataTable`, `Async`, `Dialog`…) y el contexto de sesión. `admin` es la composición: el shell y `adapters/http-ports.ts`, que la página `src/app/admin/page.tsx` inyecta. ESLint hace cumplir estas capas (`no-restricted-imports` en `eslint.config.mjs`).

Las instrucciones para iniciar Quarkus y crear el usuario administrativo están en `../back/README.md`. El diseño sigue las reglas `landing-page-design` indicadas en el `AGENTS.md` del proyecto.

La interfaz usa Tailwind CSS 4 mediante PostCSS. El panel adapta la referencia Glassy Dashboard v8: `src/app/glass.css` contiene el escenario y los componentes de cristal, y `public/arisma-arcobot-fondo.png` es una imagen ambiental generada con referencias de productos del catálogo y la ilustración del proyecto Arcobot. Mantener la fuente Geist, los datos reales y los logos de Arisma. Respetar el movimiento reducido y la navegación con teclado.
