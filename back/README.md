# Arisma: backend Quarkus

Trabajo en curso para el panel administrativo. **No desplegar ni utilizar para ventas:** faltan las pruebas integrales de imágenes y panel, la migración de medios. La tienda pública continúa dependiendo de Medusa.

El esquema PostgreSQL es independiente de Medusa y WooCommerce.

Arquitectura modular y hexagonal: cada módulo (`catalog`, `sales`, `customers`, `quotes`, `inventory`, `promotions`, `reporting`, `identity`, `media`) tiene `domain` (reglas puras, sin frameworks), `application` (puertos y casos de uso con `@Transactional`) y `adapter` (REST y PostgreSQL). Un módulo usa otro solo a través de su `application` (por ejemplo, `sales` devuelve stock con `inventory.application.StockLedger`). `ArchitectureTest` hace fallar el build si se rompen estas reglas.

Requiere Java 21, Maven, Docker, Node.js y pnpm. Ejecutar `pnpm install` dentro de `back` para instalar las dependencias de las herramientas locales. El archivo `.env` local contiene contraseñas; no compartirlo ni subirlo a un repositorio.

En PowerShell, desde `back`, con `.env` que contenga `ARISMA_DB_PASSWORD`:

```powershell
docker compose -p arisma-quarkus up -d
$env:DB_PASSWORD=(Get-Content .env).Split('=',2)[1]
$env:ARISMA_COOKIE_SECURE='false' # solo HTTP local; en producción se requiere HTTPS
mvn quarkus:dev
```

El backend escucha en `127.0.0.1:9001` y aplica sus migraciones al iniciar. Para preparar la importación, en otra terminal:

```powershell
$env:DB_PASSWORD=(Get-Content .env).Split('=',2)[1]
$env:DATABASE_URL="postgresql://arisma:$($env:DB_PASSWORD)@127.0.0.1:5433/arisma_quarkus"
$env:CATALOG_DIR=(Resolve-Path ..\platform\.local-data).Path
node scripts/import-catalog.cjs             # simulación con rollback
node scripts/import-catalog.cjs --apply     # solo tras revisar el informe
```

El importador no actualiza productos ya existentes y registra conflictos para evitar sobrescribir cambios del administrador. No importa clientes ni pedidos.

### Historial completo de WooCommerce

`scripts/import-woocommerce.cjs` carga precios (normal, oferta y tasa de IVA), atributos, galería, clientes, direcciones, cupones, pedidos con sus líneas, envíos, descuentos y pagos, cotizaciones YITH, notas y los movimientos de inventario por venta. Lee de una copia **local** restaurada del dump de WordPress (nunca de producción) y es idempotente: cada registro se identifica por `source_key` y no se sobrescribe. Antes de confirmar compara contra WooCommerce los pedidos, las cotizaciones, las líneas, las ventas por año y las unidades por producto, y no confirma si algo descuadra.

```powershell
docker run -d --name arisma-wp-analysis -e MARIADB_ROOT_PASSWORD=<local> -p 127.0.0.1:3307:3306 mariadb:11
# restaurar arisma.sql.gz en ese contenedor (crea la base `arisma`)
$env:WP_DATABASE_URL="mysql://root:<local>@127.0.0.1:3307/arisma"
node scripts/import-woocommerce.cjs          # simulación con informe de conciliación
node scripts/import-woocommerce.cjs --apply  # confirma solo si la conciliación cuadra
```

Los precios se guardan **sin IVA** y cada producto apunta a una tasa de `tax_rate` (configurable en el panel, sección Impuestos). `price_cop` queda obsoleto y refleja `regular_price` hasta que una migración posterior lo elimine. Los pedidos en procesando, completado y en espera cuentan como venta pagada en los reportes. La base local contiene datos personales reales de clientes: no compartir volcados ni subirlos a un repositorio. Para crear el primer administrador, definir `ADMIN_EMAIL`, `ADMIN_PASSWORD` y opcionalmente `ADMIN_NAME` como variables de entorno y ejecutar `node scripts/create-admin.cjs`. Usar una contraseña única de al menos 12 caracteres; eliminar las variables después de usar el comando. Los demás usuarios (roles Administrador y Vendedor) se crean desde el panel, sección Usuarios: reciben una contraseña temporal que deben cambiar al entrar. Cinco intentos fallidos bloquean la cuenta 15 minutos; cada escritura de la API declara su permiso con `@Requires` y `ArchitectureTest` lo exige.

Para crear el primer usuario local de forma interactiva, ejecutar `./create-admin.ps1` mientras PostgreSQL y Quarkus están activos. Para reiniciar el backend con el almacenamiento local ya configurado, ejecutar `./start-local.ps1`. El panel está en `/admin` en el servidor Next.js; iniciar también el frontend desde `../front` con `pnpm dev`.

El entorno local usa MinIO en el puerto 19010 y el bucket privado `arisma-media`, que debe crearse antes de usarlo. Para otro entorno, configurar `ARISMA_S3_BUCKET`, `ARISMA_S3_REGION`, `ARISMA_S3_ENDPOINT` (solo para un servicio compatible) y las credenciales estándar del AWS SDK. No se han copiado los medios históricos: los enlaces importados siguen apuntando a la fuente original.

## Tienda pública: pagos, correo y prueba de punta a punta

Todo se configura en el panel, sección **Tienda**:

- **Perfil.** Quién es la tienda: nombre y nombre corto, razón social, NIT, dirección, ciudad y departamento,
  WhatsApp, teléfono, correo, horario, enlaces legales y color de marca. Los correos, el checkout, la pasarela, las
  respuestas a opiniones y todas las páginas compartidas del front lo leen de ahí (`GET /api/public/store`): nada de
  una tienda está escrito en el código. Quien compra en esa ciudad o departamento paga la **tarifa local** de Envíos.
  Una base nueva arranca con un perfil vacío; la base de Arisma (con pedidos importados) lo recibió lleno en `V20`.
  En el front, lo único propio de cada tienda es su home y sus archivos de logo (`shared/domain/brand-assets.ts`).
- **Pagos.** La tienda cobra con **un solo medio activo** (Wompi, PayU o transferencia) en **modo pruebas** o
  **producción**. Cada pasarela guarda credenciales separadas para cada modo; no se puede activar un medio, ni pasar a
  producción, si le faltan datos. Los pedidos hechos en modo pruebas quedan marcados como «Prueba» y no cuentan en los
  reportes de ventas.
  - PayU publica credenciales de pruebas para Colombia: comercio `508029`, cuenta `512321`.
  - En Wompi, la URL de eventos es la dirección de la tienda seguida de `/api/pagos/wompi`; PayU recibe su dirección
    de confirmación (`/api/pagos/payu`) en cada cobro.
- **Correo.** Cualquier servidor SMTP (Brevo, Google Workspace, Amazon SES). Sin servidor, cada correo (confirmación
  de pedido, pago recibido, despacho, confirmar correo, recuperar contraseña) queda en la **bandeja** del panel y no se
  envía; desde ahí se pueden abrir sus enlaces en local.

Las credenciales y la contraseña del correo se guardan cifradas con `ARISMA_SECRETS_KEY` (32 bytes en base64, en
`.env`; `start-local.ps1` la crea si falta). Si esa llave cambia o se pierde, hay que volver a escribirlas en el panel.
`arisma.public-url` (por defecto `http://localhost:3100`) es la dirección pública que se usa en los enlaces de los
correos y en las direcciones de retorno de las pasarelas; en producción debe ser el dominio real con https.

### Seguimiento automático de envíos (17TRACK)

Al despachar con transportadora y guía, la tienda puede seguir la guía sola: la registra en 17TRACK, la consulta
cada 4 horas (tarea cada 30 minutos) y, cuando la transportadora confirma la entrega, marca el envío entregado y
completa el pedido. El cliente ve el paso a paso y el enlace a la página de la transportadora en su pedido; el
correo de despacho lleva ese enlace. El administrador lo activa en **Tienda, Envíos**.

- `ARISMA_TRACKING_KEY`: la *Security Key* de 17TRACK (en `.env`; `start-local.ps1` la pasa). Sin ella el
  interruptor queda deshabilitado y el cliente solo ve la guía y el enlace.
- `ARISMA_TRACKING_PLAN`: `free` (10 envíos al mes, por defecto) o `plus` (50 al mes, el plan de 5 USD). Se cambia
  en el servidor cuando la tienda paga; el panel solo muestra el plan y el uso del mes (hora de Bogotá).
- Cada guía cuenta una vez, al empezar a seguirse. Las guías rechazadas (formato, transportadora) no cuentan.

Prueba con un 17TRACK simulado (arranca el backend con `ARISMA_TRACKING_KEY=smoke` y
`ARISMA_TRACKING_URL=http://127.0.0.1:9099`):

```
DATABASE_URL=postgres://arisma:<clave>@127.0.0.1:5433/arisma_quarkus node scripts/tracking-smoke-test.cjs
```

Prueba de punta a punta de la tienda (con el backend corriendo; deja la base como estaba):

```
DATABASE_URL=postgres://arisma:<clave>@127.0.0.1:5433/arisma_quarkus node scripts/store-smoke-test.cjs
```
