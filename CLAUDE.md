# CLAUDE.md — Guía del proyecto ITAssetManager

Guía para agentes (Claude/Opus) que trabajen en este repositorio. Léela completa
antes de modificar código o desplegar.

## Qué es esta aplicación

**ITAssetManager** (marca: TechAssets Pro) es un SaaS multi-tenant de gestión de
activos de TI para empresas ecuatorianas. Cada empresa registra sus activos
físicos, aplicaciones, licencias de software, contratos con proveedores y
mantenimientos. Corre en producción en **https://techassets.socket-studio.com**.

- **Frontend**: React 18 + Vite, routing con `wouter`, estado de servidor con
  TanStack Query v5, UI con shadcn/ui (Radix + Tailwind), formularios con
  react-hook-form + Zod, gráficos con Recharts.
- **Backend**: Express 4 (ESM, TypeScript), SQL nativo con `pg` (NO se usa el
  ORM de Drizzle aunque esté en dependencias), autenticación JWT en cookie
  httpOnly llamada `jwt`.
- **Base de datos**: PostgreSQL. El esquema fuente de verdad es
  [schema.sql](schema.sql) (las tablas usan snake_case).

## Estructura del repositorio

```
client/src/           Frontend React
  pages/              Una página por módulo: dashboard, assets, contracts,
                      licenses, maintenance, reports, settings, admin, landing
  components/         layout/ (header, sidebar), ui/ (shadcn), modales de CRUD
  lib/                queryClient de TanStack Query, utilidades
server/
  index.ts            Entry point. Arranque, middleware de logging, manejador
                      de errores, escucha en HOST:PORT (default 127.0.0.1:5000)
  routes.ts           TODAS las rutas de la API REST (~1000 líneas, controladores)
  storage.ts          Capa de acceso a datos (patrón Repository, SQL nativo)
  auth.ts             JWT: setupAuth middleware, isAuthenticated, passwordUtils
  db.ts               Pool de pg (lee DATABASE_URL, carga dotenv)
  static.ts           serveStatic + log para PRODUCCIÓN (sin dependencia de vite)
  vite.ts             setupVite solo para DESARROLLO (nunca debe cargarse en prod)
shared/schema.ts      Tipos TypeScript + esquemas Zod compartidos front/back
schema.sql            DDL completo de PostgreSQL
ecosystem.config.cjs  Configuración PM2 de producción
DESPLIEGUE-VPS.md     Runbook detallado de despliegue
.env.example          Variables de entorno requeridas
```

## Conceptos clave del dominio

- **Multi-tenancy**: todo dato pertenece a una `company`. Los usuarios se
  vinculan a empresas vía la tabla `user_companies`. **Toda query en
  storage.ts filtra por `companyId`** — al agregar endpoints, mantener ese
  filtro o se rompe el aislamiento entre empresas.
- **Roles**: `super_admin` (acceso global, gestiona planes), `manager_owner`
  (dueño de empresa), `technical_admin` (admin técnico), `technician`
  (solo mantenimiento). El rol viaja dentro del JWT (`req.user.role`).
- **Planes**: `pyme` (10 usuarios / 500 activos) y `professional`
  (50 usuarios / 2000 activos). Límites en la tabla `companies`.
- **Convención de nombres**: PostgreSQL usa snake_case, TypeScript camelCase.
  storage.ts tiene funciones `mapXFromDb()` que convierten. Si agregas
  columnas, agrega el mapeo o el campo llegará `undefined` al frontend.
- **Auditoría**: las operaciones de escritura registran en `activity_log` vía
  `storage.logActivity()` — requiere `companyId` obligatorio.

## Comandos

```bash
npm run dev      # desarrollo local (tsx + vite HMR) en puerto 5000
npm run build    # vite build (cliente → dist/public) + esbuild (server → dist/index.js)
npm run check    # tsc --noEmit (OJO: hay ~90 errores PREEXISTENTES en client/src
                 # por queries de react-query sin tipar; no son regresiones tuyas)
npm start        # node dist/index.js con NODE_ENV=production
```

Para desarrollo local se necesita `.env` con `DATABASE_URL` (ver `.env.example`).

## ⚠️ Reglas críticas — NO romper esto

Estas reglas existen porque su violación causó un crash-loop de 1.5M reinicios
en producción (julio 2026):

1. **NUNCA usar `import.meta.dirname`** — el servidor corre Node 18/20 antiguo
   donde vale `undefined`. Usar el patrón existente:
   `path.dirname(fileURLToPath(import.meta.url))`.
2. **NUNCA importar `vite`, `./vite`, o `../vite.config` desde código que corra
   en producción.** `server/vite.ts` solo se carga con import dinámico dentro
   del branch de desarrollo en index.ts, y el build lo excluye con
   `--external:./vite`. Si necesitas helpers compartidos, van en
   `server/static.ts`.
3. **Toda dependencia importada por `server/*` debe estar en `dependencies`**
   (no devDependencies) — el build usa esbuild `--packages=external`, así que
   los paquetes se resuelven de node_modules en runtime.
4. **No eliminar** `pool.on("error")` en db.ts ni los handlers de
   `unhandledRejection`/señales en index.ts — evitan que caídas de PostgreSQL
   tumben el proceso.
5. **El manejador de errores de Express no debe relanzar (`throw err`)** después
   de responder.
6. **Producción exige `JWT_SECRET` y `DATABASE_URL`** en el `.env` — la app se
   niega a arrancar sin ellos (a propósito: fail-fast con error legible).
7. **Verificar siempre antes de entregar**: `npm run build` debe pasar y
   `node dist/index.js` debe arrancar e imprimir `serving on http://...`
   (se puede probar con DATABASE_URL falsa; el pool conecta lazy).

## Despliegue en el VPS (cada vez que hay cambios)

La app corre en `/var/www/apps-node/ITAssetManager` bajo PM2 (proceso
`ITAssetManager`), detrás de nginx (techassets.socket-studio.com → 127.0.0.1:5000).
Runbook completo en [DESPLIEGUE-VPS.md](DESPLIEGUE-VPS.md). Resumen:

```bash
cd /var/www/apps-node/ITAssetManager
git pull origin main
npm ci                      # instala EXACTAMENTE el package-lock.json
npm run build               # compila cliente y servidor en el servidor
pm2 reload ITAssetManager   # reinicio sin downtime
pm2 logs ITAssetManager --lines 20   # verificar que no hay errores
curl -I https://techassets.socket-studio.com   # debe responder 200
```

Si PM2 muestra el proceso `errored` o `stopped`: `pm2 logs ITAssetManager --err`
muestra la causa real (la config limita a 10 reinicios fallidos, no hay bucle).
Si es la primera vez o cambió `ecosystem.config.cjs`:
`pm2 delete ITAssetManager && pm2 start ecosystem.config.cjs && pm2 save`.

**Nunca**: `pm2 start dist/index.js` suelto (pierde el cwd y el .env),
`pm2 start npm -- start`, ni subir `dist/` compilado a git.

## Deuda técnica conocida (no "arreglar" sin plan)

- **Contraseñas con SHA-256 sin salt** en auth.ts (`passwordUtils`). bcrypt ya
  está en dependencias pero sin usar. Migrar requiere re-hashear en el próximo
  login de cada usuario (hash dual transitorio). No cambiar el hashing a secas:
  rompería todos los logins existentes.
- **~90 errores de `tsc` en client/src**: los `useQuery` no declaran tipos
  genéricos y devuelven `unknown`. El build no hace type-check, así que no
  bloquean. Si tocas una página, tipar sus queries es bienvenido.
- **drizzle-orm/drizzle-kit están en dependencias pero no se usan** (el acceso
  a datos es SQL nativo). `npm run db:push` NO es el flujo real; los cambios de
  esquema se aplican editando schema.sql y ejecutándolo manualmente en psql.
- El bundle del cliente pesa >1MB (sin code-splitting).

## Contexto del servidor

VPS `srv909363` (root). Convive con otras apps PM2: gymApp (:3001),
apiRuc (:3004), apicedula (:3003), subs (:3002). nginx central en
`/etc/nginx/nginx.conf` con todos los server blocks. No tocar los puertos de
las otras apps. El puerto de ITAssetManager es **5000** y solo escucha en
127.0.0.1 (nginx hace el TLS).
