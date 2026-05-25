# GameIndex

Plataforma web tipo base de datos, red social y agregador de reseñas de videojuegos.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Componentes estilo shadcn/ui
- Neon Postgres
- Autenticación propia con tokens firmados y usuarios en Neon
- Meilisearch
- Servicios preparados para IGDB y RAWG

## Arranque

```bash
npm install
npm run dev
```

## Variables de entorno

```bash
DATABASE_URL=postgresql://...
AUTH_SECRET=una_clave_larga_y_secreta
MEILISEARCH_HOST=http://127.0.0.1:7700
MEILISEARCH_API_KEY=
IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=
RAWG_API_KEY=
```

## Catálogo de videojuegos

La ruta `/games` usa RAWG en servidor para listar videojuegos paginados. Añade tu clave en `.env`:

```bash
RAWG_API_KEY=tu_clave_de_rawg
```

Si la clave no está configurada, la aplicación mantiene el fallback con datos locales.

## Rutas incluidas

- `/`
- `/games`
- `/games/[slug]`
- `/games/[slug]/reviews`
- `/rankings`
- `/rankings/top-50`
- `/platforms/[slug]`
- `/genres/[slug]`
- `/companies/[slug]`
- `/users/[username]`
- `/lists/[slug]`

## Base de datos

El esquema inicial está en `database/schema.sql`. La aplicación usa `DATABASE_URL` para leer/escribir en Neon desde servidor. La tabla `app_users` guarda usuarios de la autenticación propia y `profiles` guarda los perfiles públicos.
