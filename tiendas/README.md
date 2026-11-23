# Tiendas de clientes

Cada cliente tiene su propia tienda: su base de datos, su carpeta de fotos, su llave de cifrado y sus puertos. Todas
usan el mismo código; lo que cambia entre una y otra está en los ajustes del panel y en este archivo de cada tienda:

```
tiendas/<tienda>/.env      puertos, base, llave de cifrado (secreto: no se comparte ni se sube)
```

Por ahora se montan en este computador, al lado de Arisma, que sigue igual (`back/start-local.ps1` y `pnpm dev`).

| Tienda  | Back   | Tienda (front) | Buscador |
|---------|--------|----------------|----------|
| Arisma  | 9001   | 8000           | 9002     |
| n.º *n* | 9100+*n* | 3100+*n*     | 9200+*n* |

`node back/scripts/new-store.cjs lista` muestra las que hay.

## Montar una tienda nueva

El nombre de la tienda va en minúsculas y sin espacios, por ejemplo `jugueterianorte`.

1. **Crearla** (base, carpeta de fotos y su `.env`):
   ```
   cd back
   node scripts/new-store.cjs crear jugueterianorte
   ```
2. **Arrancar su back**. La primera vez empaqueta el código y crea las tablas. Con `-Build` se vuelve a empaquetar
   después de cambiar el back.
   ```
   ./start-store.ps1 jugueterianorte
   ```
3. **Crear su primer administrador**, en otra terminal:
   ```
   $env:ADMIN_EMAIL="dueno@jugueterianorte.com"; $env:ADMIN_PASSWORD="<12 caracteres o más>"
   node scripts/new-store.cjs admin jugueterianorte
   Remove-Item Env:ADMIN_PASSWORD
   ```
4. **Arrancar su tienda**:
   ```
   cd ..\front
   ./start-store.ps1 jugueterianorte
   ```
   Se abre en `http://jugueterianorte.localhost:<puerto>`. Usa ese nombre y no `localhost`: así las sesiones de una tienda
   no se cruzan con las de otra.
5. **En el panel** (`/admin`), sección Tienda:
   - **Perfil**: nombre, ciudad, WhatsApp, dirección, enlaces legales, color.
   - **Pagos**: las credenciales de Wompi o PayU del cliente (cada tienda cobra a su propia cuenta).
   - **Envíos** y **Correo**.
   - Después, categorías y productos.

## Lo que se hace a medida para cada cliente

- **Su página de inicio.** Mientras no exista, la tienda abre en el catálogo (`STORE_HOME=catalogo`, por defecto en
  las tiendas nuevas). La de Arisma es la que está en `front/src/modules/storefront/ui/home`.
- **Su logo.** Los archivos van en `front/public/brand/` y se indican en su `.env` con `BRAND_LOGO=/brand/...` y
  `BRAND_ICON=/brand/...`. Sin logo se muestra el nombre de la tienda.
- **Su buscador «Pregúntale a…»** (opcional). Se copia `search/stores/arisma.json` como `search/stores/<tienda>.json`
  con las palabras de su negocio y se arranca con `search/start-store.ps1 <tienda>`. Sin él, la tienda funciona igual.
- **Seguimiento de envíos.** `ARISMA_TRACKING_PLAN=free` o `plus` y `ARISMA_TRACKING_KEY` en su `.env`.

## Todavía atado a Arisma

Las fotos y textos de las categorías del catálogo (`front/src/modules/storefront/domain/catalog.ts`) y algunos textos
del rubro («juguetes educativos») en el catálogo y el buscador. Una tienda de otro rubro necesita que pasen a sus
ajustes antes de abrirla al público.
