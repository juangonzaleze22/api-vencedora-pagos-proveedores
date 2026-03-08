# Despliegue en Hostinger – Qué se ejecuta

## Cuando haces **build** (`npm run build`)

Se ejecuta en este orden:

1. `rimraf dist` – borra la carpeta `dist`
2. `prisma generate` – genera el cliente de Prisma (según `schema.prisma`)
3. **`prisma db push`** – sincroniza el schema con la base de datos (crea/actualiza tablas y columnas)
4. `tsc` – compila TypeScript a JavaScript en `dist/`

**Importante:** En Hostinger, si el **build** se hace en un entorno donde **no** hay acceso a la base de datos (o `DATABASE_URL` no está definida), `prisma db push` puede **fallar** y el build no termina. En ese caso la base de datos no se actualiza sola.

---

## Cuando se **inicia** la app (`npm start` → `node dist/server.js`)

Solo se ejecuta:

1. Cargar variables de entorno (panel o `.env`)
2. Conectar a la base de datos (`prisma.$connect()`)
3. Arrancar Express

**No se ejecutan migraciones ni `db push` al iniciar.** Si la base de datos no tiene las tablas o columnas que espera el código, el servidor puede arrancar igual; el fallo aparecerá en la **primera petición** que use Prisma (error de tabla/columna inexistente).

---

## Riesgos en un proyecto nuevo

| Situación | Qué puede fallar |
|-----------|-------------------|
| Base de datos vacía o sin tablas | `prisma db push` no se ejecutó (build sin BD) o falló. Al usar la API: error tipo "Table 'xxx' doesn't exist". |
| Schema cambiado (nuevo campo en `schema.prisma`) | Si no se ha vuelto a ejecutar `db push` o migraciones, la BD no tiene esa columna → error al leer/escribir ese campo. |
| Build en Hostinger sin `DATABASE_URL` | `prisma db push` falla → el build puede romperse o la BD quedarse desactualizada. |

---

## Qué hacer en un proyecto nuevo en Hostinger (sin consola)

1. **Crear la base de datos** en el panel de Hostinger (MySQL) y anotar usuario, contraseña, host y nombre de la BD.
2. **Variables de entorno** en el panel de Hostinger:
   - `DATABASE_URL` (MySQL)
   - `JWT_SECRET`, `NODE_ENV`, `JWT_EXPIRES_IN`, `API_BASE_URL`, etc.
   - **`RUN_DB_PUSH_ON_START` = `true`**  
     Con esto, cada vez que la app arranque (deploy o reinicio), se ejecutará **prisma db push** y se sincronizará el schema con la BD. No necesitas consola ni SSH.
3. **Deploy:** sube el código y deja que Hostinger ejecute build y start. La primera vez que arranque con `RUN_DB_PUSH_ON_START=true`, se crearán/actualizarán las tablas solas.
4. **Opcional – datos iniciales (seed):** el seed no se ejecuta solo. Si necesitas usuarios/roles iniciales, tendrías que ejecutar `npm run prisma:seed` alguna vez (por ejemplo desde tu PC con `DATABASE_URL` apuntando a la BD de Hostinger, o si en el futuro tienes acceso a ejecutar un script en el panel).

---

## Resumen

- **Al crear/instanciar el proyecto:** solo corre lo que configures (normalmente `npm start`). No se ejecutan migraciones ni `db push` en el arranque.
- **Las “migraciones” (schema aplicado a la BD)** se aplican en el **build** con `prisma db push`, y solo si el build puede conectarse a la BD.
- **Si algo falla por tablas o campos:** la BD no está sincronizada con `schema.prisma`. Hay que ejecutar `prisma db push` (o migraciones) donde sí tengas `DATABASE_URL` y acceso a la BD.
