# Buscador conversacional

Servicio interno (por defecto `127.0.0.1:9002`) que responde los mensajes de "Pregúntale a…": conversa, pregunta cuando falta información y muestra productos reales del catálogo. No usa un modelo generativo: las respuestas son frases preparadas y los productos salen del índice.

```
pnpm install
pnpm fetch-model   # una sola vez: descarga el modelo de significado
pnpm start         # o pnpm dev
pnpm test
```

## Cómo entiende un mensaje

1. **Lee las condiciones**: edad, presupuesto, ofertas y categoría nombrada (`src/domain/query.ts`).
2. **Decide si es charla**: saludos, gracias y preguntas de la tienda se reconocen por parecido con frases de ejemplo (`src/domain/dialogue.ts`, `src/application/dialogue-state.ts`). Una palabra que el catálogo vende ("teléfono de juguete") lo vuelve búsqueda.
3. **Lo lee sobre la conversación**: "más baratos" o "para 6 años" ajustan la búsqueda anterior; un producto nuevo empieza otra (`src/domain/conversation.ts`).
4. **Pregunta si es vago**: "un regalo" recibe una pregunta con opciones tomadas del catálogo, máximo dos seguidas.
5. **Busca**: por palabras y por significado, y ordena (`src/application/search-service.ts`).

El servicio no guarda nada entre mensajes ni registra consultas. La memoria viaja con la conversación: cada respuesta trae un `context` que el navegador devuelve con el siguiente mensaje (`POST /search { q, context }`), y que se valida campo por campo.

## Palabras clave y edad

La tienda les enseña al buscador sus propias palabras desde el admin:

- **Categorías → Para que la encuentren**: palabras clave ("puzzle" en Rompecabezas) y edad. Las heredan todos los productos de la categoría y de sus subcategorías.
- **Producto → pestaña Búsqueda**: palabras clave propias y edad del producto, que manda sobre la de sus categorías.

El buscador las recoge en la siguiente sincronización (cada 5 minutos). Un borrador inicial está en `stores/arisma-keywords.draft.json` y se carga con `node back/scripts/load-keywords.cjs` (solo agrega, nunca borra; `--dry-run` para simular).

## Cuántos resultados muestra

Si el cliente escribe el nombre de un producto (dos o más palabras que solo están juntas en el nombre de 1 a 3 productos), muestra esos y unos pocos parecidos, con un botón "Ver más parecidos". Si no, muestra hasta 12. El parecido de significado no se usa para esto porque no distingue un nombre exacto de una búsqueda general; los números que lo muestran salen de `scripts/calibrate.ts` y la regla está en `src/domain/relevance.ts`.

## Medir antes de cambiar

```
pnpm phrases                 # frases afinadas
pnpm phrases --fresh         # otras frases (también --final, --words, --exact)
tsx scripts/calibrate.ts     # puntajes de cada búsqueda, para fijar cortes
tsx scripts/build-variant.ts <variante> <salida.json>   # índice con otra forma de escribir los productos
tsx scripts/compare-index.ts <a.json> <b.json>         # qué índice ordena mejor
```

Si cambias los campos indexados o el texto que lee el modelo (`passageOf` en `src/domain/product.ts`), sube `INDEX_VERSION` en `src/main.ts`. Al arrancar, el índice anterior sigue respondiendo mientras el nuevo se arma por detrás (unos 6 minutos para 1.917 productos en un portátil).

## Montar otra tienda

Todo lo propio de una tienda está en `stores/<id>.json`. El motor no nombra a ninguna.

1. Copia `stores/arisma.json` con otro nombre, por ejemplo `stores/mitienda.json`, y cambia:
   - `name`, `locale`, `currency`, `offer` (qué vende, en pocas palabras), `catalog` (lista más completa) y dos `examples` de búsqueda.
   - `topics`: las preguntas de la tienda (envíos, pagos, ubicación…) con al menos tres frases de ejemplo y su respuesta. `handoff: true` muestra el botón de contacto. Lo que la tienda no tenga, se quita.
   - `audienceWords`: para quién se compra ("niño", "sobrina"). Déjalo vacío si no aplica.
   - `genericWords`: palabras que no dicen qué producto ("juguete", "herramienta").
   - `slots`: qué preguntar cuando la búsqueda es vaga y en qué orden: `age` (solo si el catálogo tiene categorías por rango de edad), `category`, `budget` (usa `budgetSteps`).
   - `invitations`: las frases que cierran cada respuesta de charla.
2. Arranca con `STORE_PROFILE=mitienda` y `CATALOG_URL` apuntando al catálogo de esa tienda.
3. El catálogo debe exponer `GET /api/public/catalog/feed` y `GET /api/public/catalog/categories` con la forma que lee `src/adapters/http-catalog-feed.ts`. Si la tienda tiene otro backend, se escribe otro adaptador de `CatalogFeed` (`src/application/ports.ts`) y se conecta en `src/main.ts`.

Si el perfil tiene un campo mal, el servicio no arranca y dice cuál. Las categorías, los rangos de edad y el vocabulario de productos no van en el perfil: se leen del catálogo en cada sincronización.

Para enseñarle una forma nueva de decir algo, agrega una frase a `examples` del tema (en el perfil si es de la tienda, en `src/domain/dialogue.ts` si es un saludo o cortesía) y reinicia. No hay que reentrenar nada.

## Variables

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `STORE_PROFILE` | `arisma` | Perfil de `stores/` |
| `CATALOG_URL` | `http://127.0.0.1:9001` | Catálogo público de la tienda |
| `SEARCH_HOST` / `SEARCH_PORT` | `127.0.0.1` / `9002` | Dónde escucha (solo red privada) |
| `SEARCH_TOKEN` | sin definir | Habilita `POST /reindex` (24 caracteres o más) |
