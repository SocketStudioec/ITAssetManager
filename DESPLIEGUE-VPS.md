# Despliegue correcto en el VPS (techassets.socket-studio.com)

Runbook para desplegar ITAssetManager en `/var/www/apps-node/ITAssetManager`
con PM2 + nginx. Reemplaza al procedimiento anterior que causaba el bucle de
reinicios (1.5M+ restarts).

## Por qué se caía antes (resumen)

1. **`import.meta.dirname` es `undefined` en Node < 20.11** → `serveStatic()`
   lanzaba `TypeError` al arrancar → crash inmediato → PM2 reiniciaba sin
   límite. **Causa principal del bucle.** (Corregido en el código con fallback.)
2. **El bundle importaba `vite` en producción** (devDependency) → si se
   instalaba con `--omit=dev`, `ERR_MODULE_NOT_FOUND`. (Corregido: import
   dinámico + `--external:./vite`.)
3. **`pg` no estaba en package.json** → dependía de que estuviera instalado
   por accidente. (Corregido: agregado a dependencies.)
4. **PM2 sin `cwd` ni límites de reinicio** → si se lanzaba desde `/root`,
   dotenv no encontraba el `.env` (crash por `DATABASE_URL must be set`) y
   PM2 reiniciaba infinitamente. (Corregido: `ecosystem.config.cjs`.)
5. **Errores de clientes idle de PostgreSQL sin manejar** → cualquier corte
   de red o reinicio de Postgres tumbaba el proceso. (Corregido:
   `pool.on("error")`.)

## Requisitos en el servidor

- Node.js **20 LTS o superior** recomendado (el código ya funciona en 18,
  pero 18 está fuera de soporte desde abril 2025).
- PostgreSQL con la base creada y `schema.sql` aplicado.
- PM2 instalado globalmente.

## Despliegue (primera vez con esta configuración)

```bash
# 1. Detener y eliminar el proceso mal configurado
pm2 delete ITAssetManager

# 2. Actualizar el código
cd /var/www/apps-node/ITAssetManager
git pull origin main

# 3. Crear el .env (solo la primera vez)
cp .env.example .env
nano .env    # poner DATABASE_URL y JWT_SECRET reales
             # generar secreto: openssl rand -hex 32

# 4. Instalar dependencias y compilar
npm ci            # o npm install si aún no hay package-lock.json en git
npm run build

# 5. Probar el arranque ANTES de dárselo a PM2
node dist/index.js
# Debe imprimir: "serving on http://127.0.0.1:5000"
# Probar en otra terminal: curl -I http://127.0.0.1:5000
# Ctrl+C para salir

# 6. Crear carpeta de logs y arrancar con PM2
mkdir -p /var/log/pm2
pm2 start ecosystem.config.cjs
pm2 save

# 7. Verificar
pm2 list          # status: online, restarts: 0
pm2 logs ITAssetManager --lines 20
curl -I https://techassets.socket-studio.com
```

## Despliegues siguientes (actualizaciones)

```bash
cd /var/www/apps-node/ITAssetManager
git pull origin main
npm ci
npm run build
pm2 reload ITAssetManager
pm2 logs ITAssetManager --lines 20
```

## Qué NO hacer

- ❌ `pm2 start dist/index.js` a secas desde `/root` — sin `cwd` el `.env`
  no se carga. Usar siempre `pm2 start ecosystem.config.cjs`.
- ❌ `pm2 start npm -- start` — PM2 no puede manejar señales ni reinicios
  correctamente a través del wrapper de npm.
- ❌ Subir `dist/` o `dist.zip` a git y descomprimirlo en el servidor —
  compilar siempre en el servidor con `npm run build` para que el bundle
  coincida con las dependencias instaladas.

## Bloque nginx recomendado para techassets

El bloque actual funciona; esta versión ordena la indentación y agrega
`proxy_http_version` y límite de subida:

```nginx
server {
    listen 443 ssl http2;
    server_name techassets.socket-studio.com;

    ssl_certificate /etc/letsencrypt/live/techassets.socket-studio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/techassets.socket-studio.com/privkey.pem;

    access_log /var/log/nginx/techassets-access.log;
    error_log /var/log/nginx/techassets-error.log;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }
}
```

Después de editar: `nginx -t && systemctl reload nginx`.

## Diagnóstico rápido si vuelve a caerse

```bash
pm2 logs ITAssetManager --err --lines 50   # ver el error real
pm2 describe ITAssetManager                # ver restarts y uptime
node --version                             # confirmar >= 20
ss -tlnp | grep 5000                       # confirmar que escucha
```

Con `ecosystem.config.cjs`, si la app muere 10 veces seguidas sin llegar a
10 segundos viva, PM2 la deja en estado `errored` en lugar de reiniciarla
millones de veces — así el error queda visible en los logs.
