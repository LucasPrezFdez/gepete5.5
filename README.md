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

## Cuentas de administrador

El panel `/admin` está reservado a los emails listados en la variable `ADMIN_EMAILS`:

```bash
ADMIN_EMAILS=foo@example.com,bar@example.com
```

- La lista se separa por comas, las espacios alrededor se ignoran y los emails se normalizan a minúsculas.
- La marca `is_admin` se sincroniza en cada signin/signup. Si quitas un email de la variable, el usuario deja de ser admin en su siguiente login.
- **No hay UI** para promover ni degradar admins — el flag se controla solo desde esta variable.
- El panel no aparece enlazado públicamente: el botón "Admin" del header se muestra únicamente cuando la sesión activa es admin. Cualquier no-admin que escriba `/admin` directamente es redirigido a `/`.
- Cambiar `ADMIN_EMAILS` en producción requiere redeploy para que las nuevas variables surtan efecto.

Usuarios con `banned_at` activo no pueden iniciar sesión (signin devuelve 403). Los bans se gestionan desde el propio panel.

### Sembrar usuarios y contenido mock en Neon

Los 50 perfiles de [data/fallback-users.ts](data/fallback-users.ts) son contenido de la UI pública (`/users`, `/lists/...`), no cuentas reales. Para que aparezcan también en el panel `/admin/users` con su contenido completo (listas, reseñas, valoraciones):

```bash
npx tsx scripts/seed-fallback-content.ts
```

El script siembra de forma idempotente:

- 50 cuentas en `app_users` + fila en `profiles` (emails `@mock.gameindex.local`, passwords aleatorios — no pueden iniciar sesión).
- Los juegos referenciados que aún no estén en `games` (los toma de [data/fallback-games.ts](data/fallback-games.ts)).
- ~110 listas con sus `list_items`.
- ~100 reseñas y sus `ratings` asociados.

Usa UUIDs derivados (sha256) de los slugs/IDs del mock para que re-ejecutar el script actualice contenido sin duplicar filas.

También hay un botón **Sembrar mocks** en `/admin/users` que dispara el endpoint `POST /api/admin/seed/fallback-users` con la misma lógica desde el panel.
