# Plan de migración: WordPress/WooCommerce a Medusa

## Objetivo

Reemplazar WordPress/WooCommerce como sistema operativo de la tienda sin perder datos ni capacidad operativa. La nueva tienda usará Next.js como storefront y Medusa como backend de comercio.

## Principios de seguridad

- La base `arisma` de producción no se modifica durante la migración.
- El respaldo `backups/arisma-20261023T003224Z` se conserva inmutable y verificó correctamente su checksum.
- `arisma_migration_staging` es una restauración aislada para extracción y validación.
- Cada importación debe ser repetible, idempotente y mantener una tabla de correspondencia entre IDs de origen y destino.
- El corte final incluirá una sincronización delta desde WordPress para incluir cambios posteriores al snapshot.

## Inventario validado

- 2,348 productos, de los cuales 1,917 están publicados.
- 1,455 pedidos y 405 solicitudes de cotización.
- 6,433 cuentas de usuario.
- 3,526 adjuntos multimedia.
- 141 categorías de producto.
- 0 variaciones WooCommerce reales; los atributos existentes se auditarán antes de crear opciones de Medusa.

## Decisiones tomadas

- El checkout nuevo usará **solo Wompi**.
- PayU no se integra al nuevo checkout. Sus transacciones se preservan como datos históricos vinculados a los pedidos migrados.
- Las cuentas se migran con perfil, direcciones e historial; el acceso se reestablece mediante activación o restablecimiento de contraseña.
- Los tokens de pago no se migran.
- Las cotizaciones de YITH se migran a un módulo de cotizaciones o draft orders, separado de órdenes pagadas.

## Flujos que deben quedar operativos

1. Catálogo, SKU, precios, stock, promociones e imágenes.
2. Búsqueda y filtros por categoría, edad, habilidad, marca y atributos técnicos.
3. Registro, inicio de sesión, gestión de direcciones y consulta de historial.
4. Carrito, checkout, pagos Wompi y confirmaciones de pedido.
5. Tarifas por departamento de Colombia, envío gratis para Bogotá y recogida local según la política validada.
6. Gestión de pedidos, fulfillment, rastreo, estados e historial.
7. Solicitudes de cotización.
8. Facturación, notificaciones, SEO y redirecciones desde URLs antiguas.

## Próximos entregables técnicos

1. Diccionario de datos WooCommerce a Medusa.
2. Normalización de taxonomías y campos de juguetes.
3. Exportador de catálogo, media, usuarios, direcciones, pedidos y cotizaciones desde staging.
4. Importador idempotente a Medusa con reporte de validación.
5. Integración Wompi y reglas de envío.
6. Dry run, conciliación de conteos y sincronización delta final.

## Extractor implementado

El extractor está en `platform/scripts/migration/extract-woocommerce.mjs` y solo acepta una URL de base cuyo nombre contenga `staging` o `migration`. No escribe ni altera WordPress.

```powershell
$env:WORDPRESS_DATABASE_URL = 'mysql://usuario:clave@host:3306/arisma_migration_staging'
pnpm --dir platform migration:extract
```

Produce snapshots JSON con checksum de productos y todos sus metadatos, categorías, media, usuarios y metadatos, pedidos y metadatos, ítems de pedido y cotizaciones. Los archivos son privados: contienen PII y nunca deben subirse al repositorio ni a almacenamiento público.
