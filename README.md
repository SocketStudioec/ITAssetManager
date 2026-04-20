# TechAssets Pro

Sistema integral de gestión de activos TI para pequeñas y medianas empresas (PyMEs). Permite gestionar equipos físicos, aplicaciones, contratos, licencias y servicios de infraestructura con seguimiento de costos y alertas de vencimiento.

## 📁 Estructura del Proyecto

```
techassets-pro/
├── client/                    # 🎨 FRONTEND - Aplicación React
│   ├── src/
│   │   ├── components/       # Componentes reutilizables de UI
│   │   │   ├── layout/      # Layout principal, header, sidebar
│   │   │   ├── dashboard/   # Widgets del dashboard
│   │   │   └── ui/          # Componentes shadcn/ui
│   │   ├── pages/           # Páginas de la aplicación
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   └── ...
│   │   ├── lib/             # Utilidades del frontend
│   │   │   └── queryClient.ts # Configuración TanStack Query
│   │   ├── App.tsx          # Router principal
│   │   ├── main.tsx         # Entry point de React
│   │   └── index.css        # Estilos globales
│   └── index.html           # HTML template
│
├── server/                   # ⚙️ BACKEND - API Node.js/Express
│   ├── db.ts               # Configuración de PostgreSQL pool
│   ├── storage.ts          # Capa de acceso a datos (Repository Pattern)
│   ├── routes.ts           # Endpoints de la API REST
│   ├── auth.ts             # Lógica de autenticación
│   ├── index.ts            # Entry point del servidor
│   └── vite.ts             # Configuración Vite para desarrollo
│
├── shared/                  # 🔗 COMPARTIDO - Frontend & Backend
│   └── schema.ts           # Tipos TypeScript y validaciones Zod
│
├── schema.sql              # 💾 Schema completo de PostgreSQL
├── package.json            # Dependencias del proyecto
├── tsconfig.json           # Configuración TypeScript
├── vite.config.ts          # Configuración Vite
└── README.md              # Este archivo
```

### Separación Frontend/Backend

**Frontend (`/client`):**
- Aplicación React + TypeScript ejecutándose en el navegador
- Comunicación con backend vía API REST (`fetch`)
- Gestión de estado con TanStack Query
- UI construida con shadcn/ui + Tailwind CSS
- **Puerto de desarrollo:** 5000 (sirve Vite)

**Backend (`/server`):**
- API REST con Express + TypeScript
- Queries SQL nativos a PostgreSQL 17
- Autenticación con sesiones persistentes
- **Puerto de desarrollo:** 5000 (mismo puerto, Vite proxy en dev)
- **Puerto de producción:** Configurable vía `PORT` env var

**Shared (`/shared`):**
- Tipos TypeScript compartidos entre frontend y backend
- Esquemas de validación Zod
- Garantiza consistencia de tipos en toda la aplicación

## 🚀 Características Principales

- **Gestión Multi-empresa**: Soporte para múltiples compañías con control de acceso basado en roles
- **Activos Físicos**: Inventario de equipos, servidores y hardware con historial de mantenimiento
- **Aplicaciones**: Diferenciación entre SaaS y desarrollo interno con costos de infraestructura
- **Servicios de Infraestructura**: Seguimiento de dominios, SSL, hosting y servidores virtuales
- **Alertas de Vencimiento**: Notificaciones automáticas para servicios próximos a expirar
- **Dashboard de Costos**: Análisis visual de gastos y tendencias
- **Historial de Actividad**: Registro completo de todas las operaciones del sistema

## 🛠️ Stack Tecnológico

### Frontend (React SPA)
- **React 18** con TypeScript - Framework UI moderno
- **Vite** - Build tool ultra-rápido con HMR
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Componentes accesibles con Radix UI
- **TanStack Query (React Query)** - Gestión de estado del servidor
- **Wouter** - Routing minimalista para React
- **Recharts** - Librería de gráficos basada en D3
- **React Hook Form** - Manejo de formularios performante
- **Zod** - Validación de esquemas TypeScript-first

### Backend (Node.js API)
- **Node.js 18+** con Express - Runtime y framework web
- **TypeScript** - Lenguaje con tipado estático
- **pg (node-postgres)** - Cliente nativo PostgreSQL
- **bcrypt** - Hashing seguro de contraseñas (10 rounds)
- **express-session** - Gestión de sesiones
- **connect-pg-simple** - Store de sesiones en PostgreSQL
- **Passport.js** - Middleware de autenticación

### Base de Datos
- **PostgreSQL 17** - Base de datos relacional
- **Queries SQL Nativos** - Sin ORM, control total sobre SQL
- **Prepared Statements** - Prevención de SQL injection
- **Connection Pooling** - Pool de conexiones optimizado
- **ACID Transactions** - Integridad de datos garantizada

## 📋 Requisitos Previos

- **Node.js 18 o superior** - Runtime JavaScript
- **PostgreSQL 17** - Base de datos (también compatible con 15-16)
- **npm o yarn** - Gestor de paquetes
- **Git** - Control de versiones

## 🚀 Instalación y Configuración

### 1. Clonar el Repositorio

```bash
git clone <url-del-repositorio>
cd techassets-pro
```

### 2. Instalar Dependencias

```bash
npm install
```

Esto instalará todas las dependencias de frontend y backend definidas en `package.json`.

### 3. Configurar Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto:

```bash
# ========================================
# CONFIGURACIÓN DE BASE DE DATOS
# ========================================
DATABASE_URL="postgresql://techassets_user:tu_contraseña@localhost:5432/techassets_pro"
PGHOST="localhost"
PGPORT="5432"
PGUSER="techassets_user"
PGPASSWORD="tu_contraseña_segura"
PGDATABASE="techassets_pro"

# ========================================
# CONFIGURACIÓN DE AUTENTICACIÓN
# ========================================
# Generar con: openssl rand -base64 32
SESSION_SECRET="clave-secreta-muy-segura-de-al-menos-32-caracteres"

# ========================================
# CONFIGURACIÓN DEL SERVIDOR
# ========================================
PORT=5000
NODE_ENV=development
```

### 4. Configurar PostgreSQL 17

#### Instalar PostgreSQL 17 en AlmaLinux 9:

```bash
# Agregar repositorio oficial de PostgreSQL
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# Deshabilitar módulo PostgreSQL por defecto
sudo dnf -qy module disable postgresql

# Instalar PostgreSQL 17
sudo dnf install -y postgresql17-server postgresql17-contrib

# Inicializar el cluster de base de datos
sudo /usr/pgsql-17/bin/postgresql-17-setup initdb

# Iniciar y habilitar el servicio
sudo systemctl enable postgresql-17
sudo systemctl start postgresql-17

# Verificar que está corriendo
sudo systemctl status postgresql-17
```

#### Instalar PostgreSQL 17 en Ubuntu/Debian:

```bash
# Agregar repositorio oficial de PostgreSQL
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Actualizar e instalar
sudo apt update
sudo apt install -y postgresql-17 postgresql-contrib-17

# El servicio se inicia automáticamente
sudo systemctl status postgresql
```

#### Crear Base de Datos y Usuario:

```bash
# Cambiar a usuario postgres
sudo -u postgres psql

# Ejecutar en el shell de PostgreSQL:
CREATE DATABASE techassets_pro;
CREATE USER techassets_user WITH PASSWORD 'tu_contraseña_segura';
GRANT ALL PRIVILEGES ON DATABASE techassets_pro TO techassets_user;

-- Permisos adicionales para PostgreSQL 15+
\c techassets_pro
GRANT ALL ON SCHEMA public TO techassets_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO techassets_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO techassets_user;

\q
```

#### Aplicar el Schema de Base de Datos:

El proyecto incluye `schema.sql` con la definición completa de la base de datos:

```bash
# Aplicar el schema completo
psql -h localhost -U techassets_user -d techassets_pro -f schema.sql

# Verificar que las tablas se crearon correctamente
psql -h localhost -U techassets_user -d techassets_pro -c "\dt"
```

**Contenido del schema.sql:**
- ✅ 8 tipos ENUM (role_type, asset_type, plan_type, etc.)
- ✅ 8 tablas principales (users, companies, assets, contracts, licenses, maintenance_records, activity_log, sessions)
- ✅ 25+ índices optimizados para consultas rápidas
- ✅ Foreign keys y constraints para integridad referencial
- ✅ Tabla de sesiones para express-session
- ✅ Configuración de CASCADE para deletes
- ✅ Comentarios de documentación integrados

#### Script de Instalación Automática (AlmaLinux 9):

Guardar como `install_db.sh`:

```bash
#!/bin/bash

# Script de instalación de PostgreSQL 17 para TechAssets Pro
# Compatible con AlmaLinux 9

set -e

echo "📦 Instalando PostgreSQL 17..."
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
sudo dnf -qy module disable postgresql
sudo dnf install -y postgresql17-server postgresql17-contrib

echo "🔧 Inicializando PostgreSQL..."
sudo /usr/pgsql-17/bin/postgresql-17-setup initdb

echo "🚀 Iniciando servicio..."
sudo systemctl enable postgresql-17
sudo systemctl start postgresql-17

echo "📊 Creando base de datos y usuario..."
sudo -u postgres psql << EOF
CREATE DATABASE techassets_pro;
CREATE USER techassets_user WITH PASSWORD 'CambiarEstaContraseña123!';
GRANT ALL PRIVILEGES ON DATABASE techassets_pro TO techassets_user;
\c techassets_pro
GRANT ALL ON SCHEMA public TO techassets_user;
EOF

echo "📋 Aplicando schema..."
psql -h localhost -U techassets_user -d techassets_pro -f schema.sql

echo "✅ Instalación completada!"
echo "🔐 IMPORTANTE: Cambiar la contraseña en el script y en .env"
```

Ejecutar:

```bash
chmod +x install_db.sh
./install_db.sh
```

### 5. Crear Usuario Administrador Inicial

Opción 1: Registrarse desde la interfaz web en `/register`

Opción 2: Crear manualmente desde la línea de comandos:

```bash
# Generar hash de contraseña con Node.js
node -e "require('bcrypt').hash('TuContraseñaSegura', 10).then(h => console.log(h))"

# Copiar el hash generado e insertar en la base de datos
psql -h localhost -U techassets_user -d techassets_pro
```

```sql
-- Insertar usuario super admin
INSERT INTO users (email, password_hash, first_name, last_name, role)
VALUES (
  'admin@tuempresa.com',
  '$2b$10$hash_generado_aqui',
  'Admin',
  'Sistema',
  'super_admin'
);
```

## 🏃‍♂️ Ejecutar en Desarrollo

```bash
npm run dev
```

Esto iniciará:
- 🎨 **Frontend (Vite Dev Server)**: `http://localhost:5000`
- ⚙️ **Backend (Express API)**: Mismo puerto con proxy automático
- 🔄 **Hot Module Replacement**: Recarga automática en cambios

La aplicación estará disponible en `http://localhost:5000`

## 🏗️ Compilar para Producción

```bash
# Compilar frontend y backend
npm run build

# El output estará en:
# - Frontend: dist/public/
# - Backend: dist/server/
```

## 🚀 Despliegue en Producción (AlmaLinux 9)

### Preparación del Servidor

```bash
# 1. Actualizar sistema
sudo dnf update -y

# 2. Instalar Node.js 18 (LTS)
sudo dnf install -y gcc-c++ make
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# 3. Instalar PM2 para gestión de procesos
sudo npm install -g pm2

# 4. Instalar PostgreSQL 17 (ver sección anterior)

# 5. Instalar Nginx
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Configurar el Proyecto

```bash
# 1. Clonar repositorio en /var/www
sudo mkdir -p /var/www
sudo git clone <url-repositorio> /var/www/techassets-pro
cd /var/www/techassets-pro

# 2. Cambiar permisos
sudo chown -R $USER:$USER /var/www/techassets-pro

# 3. Instalar dependencias (solo producción)
npm ci --only=production

# 4. Configurar variables de entorno
sudo nano .env
# (Copiar y ajustar las variables de entorno)

# 5. Aplicar schema de base de datos
psql -h localhost -U techassets_user -d techassets_pro -f schema.sql

# 6. Compilar aplicación
npm run build
```

### Configurar PM2

Crear `ecosystem.config.js`:

```javascript
/**
 * Configuración de PM2 para TechAssets Pro
 * 
 * Este archivo define cómo PM2 debe ejecutar la aplicación:
 * - Modo cluster para aprovechar múltiples CPUs
 * - Auto-restart en caso de fallos
 * - Variables de entorno de producción
 */
module.exports = {
  apps: [{
    name: 'techassets-pro',
    script: './dist/server/index.js',
    cwd: '/var/www/techassets-pro',
    instances: 'max',           // Usar todos los CPUs disponibles
    exec_mode: 'cluster',        // Modo cluster para load balancing
    watch: false,                // No watch en producción
    max_memory_restart: '1G',    // Restart si usa más de 1GB RAM
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

Iniciar aplicación:

```bash
# Crear directorio de logs
mkdir -p logs

# Iniciar con PM2
pm2 start ecosystem.config.js --env production

# Guardar configuración para auto-inicio
pm2 save

# Configurar inicio automático en boot
pm2 startup systemd
# Ejecutar el comando que PM2 muestra

# Verificar estado
pm2 status
pm2 logs techassets-pro
```

### Configurar Nginx como Reverse Proxy

Crear `/etc/nginx/conf.d/techassets-pro.conf`:

```nginx
# Configuración de Nginx para TechAssets Pro
# Este archivo configura Nginx como reverse proxy hacia la aplicación Node.js

# Limitar tamaño de uploads
client_max_body_size 10M;

# Configuración upstream (backend)
upstream techassets_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

# Servidor HTTP (redirige a HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name tu-dominio.com www.tu-dominio.com;
    
    # Redirigir todo a HTTPS
    return 301 https://$server_name$request_uri;
}

# Servidor HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name tu-dominio.com www.tu-dominio.com;

    # Certificados SSL (configurar después con Certbot)
    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
    
    # Configuración SSL segura
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Headers de seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logs
    access_log /var/log/nginx/techassets-access.log;
    error_log /var/log/nginx/techassets-error.log;

    # Proxy hacia Node.js
    location / {
        proxy_pass http://techassets_backend;
        proxy_http_version 1.1;
        
        # Headers esenciales
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        proxy_cache_bypass $http_upgrade;
    }

    # Cache para assets estáticos
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://techassets_backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Activar configuración:

```bash
# Verificar sintaxis
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx

# Verificar estado
sudo systemctl status nginx
```

### Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo dnf install -y certbot python3-certbot-nginx

# Obtener certificado (reemplazar tu-dominio.com)
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Verificar renovación automática
sudo certbot renew --dry-run

# El certificado se renueva automáticamente
sudo systemctl list-timers | grep certbot
```

### Configurar Firewall

```bash
# Permitir HTTP y HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Verificar
sudo firewall-cmd --list-all
```

## 📊 Monitoreo y Mantenimiento

### Logs de Aplicación

```bash
# Ver logs en tiempo real
pm2 logs techassets-pro

# Ver solo errores
pm2 logs techassets-pro --err

# Monitoreo de recursos
pm2 monit

# Información detallada
pm2 describe techassets-pro

# Limpiar logs antiguos
pm2 flush
```

### Backup de Base de Datos

```bash
# Crear backup completo
pg_dump -h localhost -U techassets_user -d techassets_pro \
  -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).dump

# Backup en formato SQL plano
pg_dump -h localhost -U techassets_user -d techassets_pro \
  > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar desde backup
pg_restore -h localhost -U techassets_user -d techassets_pro backup.dump

# O desde SQL plano
psql -h localhost -U techassets_user -d techassets_pro < backup.sql
```

### Script de Backup Automático

Crear `/usr/local/bin/backup-techassets.sh`:

```bash
#!/bin/bash
# Script de backup automático para TechAssets Pro

BACKUP_DIR="/var/backups/techassets"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

# Backup de base de datos
pg_dump -h localhost -U techassets_user -d techassets_pro \
  -F c -b -v -f $BACKUP_DIR/db_backup_$DATE.dump

# Backup de archivos de configuración
tar -czf $BACKUP_DIR/config_backup_$DATE.tar.gz \
  /var/www/techassets-pro/.env \
  /var/www/techassets-pro/ecosystem.config.js \
  /etc/nginx/conf.d/techassets-pro.conf

# Eliminar backups antiguos
find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completado: $DATE"
```

Configurar cron:

```bash
# Hacer ejecutable
sudo chmod +x /usr/local/bin/backup-techassets.sh

# Agregar a crontab (backup diario a las 2 AM)
sudo crontab -e
```

Agregar línea:
```
0 2 * * * /usr/local/bin/backup-techassets.sh >> /var/log/techassets-backup.log 2>&1
```

### Actualizaciones

```bash
# 1. Hacer backup de la base de datos
pg_dump -h localhost -U techassets_user -d techassets_pro > backup_antes_actualizacion.sql

# 2. Detener aplicación
pm2 stop techassets-pro

# 3. Actualizar código
cd /var/www/techassets-pro
git pull origin main

# 4. Instalar dependencias actualizadas
npm ci --only=production

# 5. Recompilar
npm run build

# 6. Aplicar cambios de schema si hay (revisar antes)
# psql -h localhost -U techassets_user -d techassets_pro -f schema.sql

# 7. Reiniciar aplicación
pm2 restart techassets-pro

# 8. Verificar logs
pm2 logs techassets-pro --lines 100
```

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Ejecutar en modo desarrollo (frontend + backend)

# Producción
npm run build        # Compilar frontend y backend para producción
npm start            # Ejecutar aplicación compilada

# Base de datos
npm run db:push      # Sincronizar schema (si usas Drizzle)
npm run db:studio    # Abrir Drizzle Studio (si usas Drizzle)

# Testing (si se implementa)
npm test             # Ejecutar tests
npm run test:e2e     # Tests end-to-end
```

## 🛡️ Seguridad

### Checklist de Seguridad

- [ ] **Variables de Entorno**: `.env` en `.gitignore`, nunca commitear
- [ ] **Contraseñas Fuertes**: Base de datos con contraseñas de 20+ caracteres
- [ ] **SESSION_SECRET**: Generar con `openssl rand -base64 32`
- [ ] **HTTPS Obligatorio**: Certificado SSL/TLS válido en producción
- [ ] **Firewall Configurado**: Solo puertos 22, 80, 443 abiertos
- [ ] **PostgreSQL Local**: No exponer puerto 5432 públicamente
- [ ] **Dependencias Actualizadas**: `npm audit fix` regularmente
- [ ] **Headers de Seguridad**: Configurados en Nginx
- [ ] **Backups Automáticos**: Script de backup diario funcionando
- [ ] **Logs Monitoreados**: Revisar logs de errores semanalmente

### Generar SESSION_SECRET Seguro

```bash
# Linux/macOS
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Hardening de PostgreSQL

Editar `/var/lib/pgsql/17/data/pg_hba.conf`:

```
# Solo permitir conexiones locales
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
```

Reiniciar PostgreSQL:

```bash
sudo systemctl restart postgresql-17
```

## 🐛 Solución de Problemas

### Error: "Cannot connect to database"

```bash
# 1. Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql-17

# 2. Verificar credenciales en .env
cat .env | grep DATABASE_URL

# 3. Probar conexión manual
psql -h localhost -U techassets_user -d techassets_pro

# 4. Verificar logs de PostgreSQL
sudo tail -f /var/lib/pgsql/17/data/log/postgresql-*.log
```

### Error: "bcrypt arguments required"

Este error indica que el password hash no se está mapeando correctamente. Verificar:

```bash
# 1. Verificar que getUserByEmail retorna passwordHash
# 2. Ver logs de autenticación
pm2 logs techassets-pro | grep "password"

# 3. Verificar estructura de la tabla users
psql -U techassets_user -d techassets_pro -c "\d users"
```

### Error: "Session store error"

```bash
# 1. Verificar que la tabla sessions existe
psql -U techassets_user -d techassets_pro -c "\d sessions"

# 2. Si no existe, crear manualmente
psql -U techassets_user -d techassets_pro -c "
CREATE TABLE session (
  sid VARCHAR NOT NULL COLLATE \"default\",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid)
);
CREATE INDEX IDX_session_expire ON session (expire);
"
```

### Error: "Port 5000 already in use"

```bash
# 1. Encontrar proceso usando el puerto
sudo lsof -i :5000

# 2. Matar el proceso
kill -9 <PID>

# 3. O cambiar puerto en .env
echo "PORT=5001" >> .env
```

### Problemas de Rendimiento

```bash
# 1. Monitorear uso de recursos
pm2 monit

# 2. Ver queries lentas en PostgreSQL
# Editar postgresql.conf y agregar:
# log_min_duration_statement = 1000  # Log queries > 1s

# 3. Reiniciar PostgreSQL
sudo systemctl restart postgresql-17

# 4. Ver queries lentas
sudo tail -f /var/lib/pgsql/17/data/log/postgresql-*.log | grep duration
```

### Reset Completo (DESARROLLO ÚNICAMENTE)

```bash
# ⚠️ ESTO BORRARÁ TODOS LOS DATOS

# 1. Detener aplicación
pm2 stop techassets-pro

# 2. Eliminar base de datos
sudo -u postgres psql -c "DROP DATABASE techassets_pro;"
sudo -u postgres psql -c "CREATE DATABASE techassets_pro;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE techassets_pro TO techassets_user;"

# 3. Aplicar schema
psql -h localhost -U techassets_user -d techassets_pro -f schema.sql

# 4. Reiniciar aplicación
pm2 restart techassets-pro
```

## 📚 Documentación de la Arquitectura

### Flujo de Datos

```
┌─────────────┐      HTTP/REST      ┌─────────────┐      SQL       ┌──────────────┐
│             │ ───── (JSON) ─────> │             │ ── Queries ──> │              │
│   Frontend  │                     │   Backend   │                │  PostgreSQL  │
│   (React)   │ <──── Response ──── │  (Express)  │ <── Results ── │      17      │
│             │                     │             │                │              │
└─────────────┘                     └─────────────┘                └──────────────┘
     │                                     │                              │
     │                                     │                              │
 TanStack Query                     Storage Layer                   Tables (8)
 State Management                   (Repository Pattern)            ENUMs (8)
 Form Validation                    SQL Queries Nativas             Índices (25+)
```

### Patrones de Diseño Implementados

1. **Repository Pattern** (`server/storage.ts`)
   - Abstrae la lógica de acceso a datos
   - Facilita testing y mantenimiento
   - Centraliza las queries SQL

2. **API REST** (`server/routes.ts`)
   - Endpoints organizados por recurso
   - Validación con Zod en cada endpoint
   - Response consistentes (JSON)

3. **Session-Based Auth** (`server/auth.ts`)
   - Sesiones persistentes en PostgreSQL
   - Password hashing con bcrypt
   - Middleware de autenticación reutilizable

4. **Component Composition** (Frontend)
   - Componentes reutilizables en `/client/src/components/ui`
   - Layouts compartidos
   - Custom hooks para lógica compartida

### Seguridad Implementada

- ✅ Prepared Statements (prevención SQL injection)
- ✅ Password hashing con bcrypt (10 rounds)
- ✅ Sesiones seguras con httpOnly cookies
- ✅ HTTPS en producción con certificados SSL
- ✅ Headers de seguridad en Nginx
- ✅ Validación de datos con Zod
- ✅ CORS configurado correctamente

## 📝 Licencia

[Especificar licencia - MIT, Apache, Propietario, etc.]

## 🤝 Contribución

Para contribuir al proyecto:

1. Fork el repositorio
2. Crear una rama feature (`git checkout -b feature/NuevaCaracteristica`)
3. Commit cambios (`git commit -m 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/NuevaCaracteristica`)
5. Abrir Pull Request

## 📞 Soporte

- **Email**: soporte@tuempresa.com
- **Documentación**: [Wiki del proyecto]
- **Issues**: [GitHub Issues]
- **Chat**: [Discord/Slack del equipo]

---

**Desarrollado con ❤️ para gestionar tus activos TI eficientemente**
