# TechAssets Pro - Guía de Deployment en AlmaLinux

Esta guía proporciona instrucciones detalladas para desplegar TechAssets Pro en un servidor AlmaLinux, con frontend y backend separados para producción.

## Tabla de Contenidos

1. [Requisitos del Sistema](#requisitos-del-sistema)
2. [Preparación del Servidor](#preparación-del-servidor)
3. [Instalación de Dependencias](#instalación-de-dependencias)
4. [Configuración de Base de Datos](#configuración-de-base-de-datos)
5. [Deployment del Backend](#deployment-del-backend)
6. [Deployment del Frontend](#deployment-del-frontend)
7. [Configuración de Nginx](#configuración-de-nginx)
8. [Configuración de SSL/HTTPS](#configuración-de-sslhttps)
9. [Servicios Systemd](#servicios-systemd)
10. [Variables de Entorno](#variables-de-entorno)
11. [Mantenimiento](#mantenimiento)

---

## Requisitos del Sistema

### Hardware Mínimo
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disco**: 20GB SSD
- **Red**: 100 Mbps

### Software
- **SO**: AlmaLinux 8/9
- **Node.js**: v20 LTS o superior
- **PostgreSQL**: 13 o superior
- **Nginx**: 1.20 o superior
- **PM2**: Para gestión de procesos Node.js

---

## Preparación del Servidor

### 1. Actualizar el Sistema

```bash
sudo dnf update -y
sudo dnf install -y epel-release
sudo dnf install -y wget curl git vim
```

### 2. Configurar Firewall

```bash
# Habilitar firewall
sudo systemctl enable --now firewalld

# Abrir puertos necesarios
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=5000/tcp  # Backend (solo para desarrollo)
sudo firewall-cmd --reload
```

### 3. Crear Usuario de Aplicación

```bash
# Crear usuario sin privilegios para ejecutar la aplicación
sudo useradd -m -s /bin/bash techassets
sudo passwd techassets

# Agregar al grupo wheel para sudo (opcional)
sudo usermod -aG wheel techassets
```

---

## Instalación de Dependencias

### 1. Instalar Node.js

```bash
# Instalar Node.js 20 LTS
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Verificar instalación
node --version  # Debe mostrar v20.x.x
npm --version   # Debe mostrar 10.x.x
```

### 2. Instalar PostgreSQL

```bash
# Instalar PostgreSQL 15
sudo dnf install -y postgresql15-server postgresql15-contrib

# Inicializar base de datos
sudo postgresql-setup --initdb

# Iniciar servicio
sudo systemctl enable --now postgresql

# Verificar estado
sudo systemctl status postgresql
```

### 3. Instalar Nginx

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 4. Instalar PM2 (Gestor de Procesos)

```bash
sudo npm install -g pm2

# Configurar PM2 para iniciar con el sistema
pm2 startup systemd -u techassets --hp /home/techassets
```

---

## Configuración de Base de Datos

### 1. Configurar PostgreSQL

```bash
# Cambiar a usuario postgres
sudo su - postgres

# Crear usuario de base de datos
createuser --interactive --pwprompt
# Nombre: techassets_user
# Password: [CONTRASEÑA_SEGURA]
# Superuser: No
# Create databases: Yes
# Create roles: No

# Crear base de datos
createdb -O techassets_user techassets_pro

# Salir de usuario postgres
exit
```

### 2. Configurar Autenticación

Editar `/var/lib/pgsql/data/pg_hba.conf`:

```bash
sudo vim /var/lib/pgsql/data/pg_hba.conf
```

Agregar/modificar:
```
# TYPE  DATABASE        USER            ADDRESS         METHOD
local   all             all                             peer
host    techassets_pro  techassets_user 127.0.0.1/32   md5
host    techassets_pro  techassets_user ::1/128        md5
```

Reiniciar PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### 3. Ejecutar Script de Creación de Tablas

```bash
# Como usuario postgres
sudo su - postgres
psql -d techassets_pro -U techassets_user -f /path/to/schema.sql
exit
```

---

## Deployment del Backend

### 1. Clonar Código Fuente

```bash
# Cambiar a usuario techassets
su - techassets

# Crear directorio de aplicación
mkdir -p /home/techassets/app
cd /home/techassets/app

# Clonar o copiar el código
# git clone [TU_REPOSITORIO] .
# O copiar archivos manualmente
```

### 2. Instalar Dependencias del Backend

```bash
cd /home/techassets/app

# Instalar todas las dependencias
npm install

# Construir el backend
npm run build
```

### 3. Configurar Variables de Entorno

Crear archivo `/home/techassets/app/.env.production`:

```bash
# Variables de Entorno - BACKEND
NODE_ENV=production

# Puerto del backend (interno)
PORT=5000

# Base de Datos
DATABASE_URL=postgresql://techassets_user:PASSWORD@localhost:5432/techassets_pro

# Session Secret (CAMBIAR en producción)
SESSION_SECRET=tu-secret-muy-seguro-y-aleatorio-aqui

# CORS - Origen del frontend
FRONTEND_ORIGIN=https://tu-dominio.com
```

**IMPORTANTE**: 
- Cambiar `PASSWORD` por la contraseña real de PostgreSQL
- Generar un `SESSION_SECRET` seguro: `openssl rand -base64 32`
- Actualizar `FRONTEND_ORIGIN` con tu dominio real

### 4. Iniciar Backend con PM2

```bash
cd /home/techassets/app

# Iniciar con PM2
pm2 start npm --name "techassets-backend" -- start

# Guardar configuración PM2
pm2 save

# Ver logs
pm2 logs techassets-backend

# Ver estado
pm2 status
```

---

## Deployment del Frontend

### 1. Build del Frontend

```bash
cd /home/techassets/app

# Construir el frontend para producción
npm run build

# El build genera archivos en: dist/public/
```

Los archivos del frontend compilados estarán en `dist/public/` y serán servidos por Nginx.

### 2. Configurar Variables de Entorno del Frontend

El frontend necesita saber la URL del backend API. Crear archivo `.env.production` antes del build:

```bash
# Variables de Entorno - FRONTEND
VITE_API_URL=https://api.tu-dominio.com
```

Luego reconstruir:
```bash
npm run build
```

---

## Configuración de Nginx

### 1. Crear Configuración del Sitio

Crear archivo `/etc/nginx/conf.d/techassets.conf`:

```nginx
# Configuración para TechAssets Pro

# Upstream para el backend
upstream techassets_backend {
    server localhost:5000;
    keepalive 64;
}

# Servidor Principal (HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name tu-dominio.com www.tu-dominio.com;

    # Redirigir a HTTPS (descomentar después de configurar SSL)
    # return 301 https://$server_name$request_uri;

    # Ubicación del frontend compilado
    root /home/techassets/app/dist/public;
    index index.html;

    # Compresión
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private must-revalidate;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    # Logs
    access_log /var/log/nginx/techassets_access.log;
    error_log /var/log/nginx/techassets_error.log;

    # Proxy para el backend API
    location /api/ {
        proxy_pass http://techassets_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        proxy_redirect off;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Servir archivos estáticos del frontend
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Denegar acceso a archivos ocultos
    location ~ /\. {
        deny all;
    }
}
```

### 2. Verificar y Aplicar Configuración

```bash
# Verificar sintaxis
sudo nginx -t

# Si no hay errores, recargar nginx
sudo systemctl reload nginx
```

### 3. Ajustar Permisos

```bash
# Dar permiso a nginx para acceder a los archivos
sudo chmod 755 /home/techassets
sudo chmod 755 /home/techassets/app
sudo chmod -R 755 /home/techassets/app/dist/public

# Configurar SELinux (si está habilitado)
sudo chcon -R -t httpd_sys_content_t /home/techassets/app/dist/public
sudo setsebool -P httpd_can_network_connect 1
```

---

## Configuración de SSL/HTTPS

### Opción 1: Let's Encrypt (Recomendado)

```bash
# Instalar Certbot
sudo dnf install -y certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Renovación automática
sudo systemctl enable --now certbot-renew.timer
```

### Opción 2: Certificado Autofirmado (Solo para Desarrollo)

```bash
sudo mkdir /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/techassets.key \
  -out /etc/nginx/ssl/techassets.crt
```

Luego actualizar nginx config para usar estos certificados.

---

## Servicios Systemd

### Crear Servicio Systemd para el Backend

Crear archivo `/etc/systemd/system/techassets-backend.service`:

```ini
[Unit]
Description=TechAssets Pro Backend
After=network.target postgresql.service

[Service]
Type=simple
User=techassets
WorkingDirectory=/home/techassets/app
Environment="NODE_ENV=production"
EnvironmentFile=/home/techassets/app/.env.production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=techassets-backend

[Install]
WantedBy=multi-user.target
```

### Habilitar y Gestionar el Servicio

```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar servicio
sudo systemctl enable techassets-backend

# Iniciar servicio
sudo systemctl start techassets-backend

# Ver estado
sudo systemctl status techassets-backend

# Ver logs
sudo journalctl -u techassets-backend -f
```

---

## Variables de Entorno

### Variables Requeridas del Backend

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecución | `production` |
| `PORT` | Puerto del backend | `5000` |
| `DATABASE_URL` | URL de PostgreSQL | `postgresql://user:pass@localhost:5432/db` |
| `SESSION_SECRET` | Secret para cookies de sesión | `[random-string]` |
| `FRONTEND_ORIGIN` | Origen del frontend para CORS | `https://tu-dominio.com` |

### Variables Opcionales

| Variable | Descripción | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Nivel de logging | `info` |
| `MAX_UPLOAD_SIZE` | Tamaño máximo de archivos | `10mb` |

### Generar Secrets Seguros

```bash
# Generar SESSION_SECRET
openssl rand -base64 32

# Generar password de base de datos
openssl rand -base64 24
```

---

## Estructura de Directorios en Producción

```
/home/techassets/app/
├── dist/                       # Código compilado
│   ├── index.js               # Backend compilado
│   └── public/                # Frontend compilado (servido por nginx)
│       ├── index.html
│       ├── assets/
│       └── ...
├── node_modules/              # Dependencias de Node.js
├── .env.production            # Variables de entorno
├── package.json
├── schema.sql                 # Script de base de datos
└── logs/                      # Logs de aplicación
```

---

## Separación Frontend/Backend

### Backend (Node.js/Express)

**Ubicación**: `/home/techassets/app/dist/index.js`

**Responsabilidades**:
- API REST en `/api/*`
- Autenticación y sesiones
- Lógica de negocio
- Acceso a base de datos
- Validación de datos

**Puerto**: 5000 (interno, no expuesto)

**Gestión**: PM2 o systemd

**Inicio**:
```bash
cd /home/techassets/app
npm start
# O con PM2:
pm2 start npm --name "techassets-backend" -- start
```

### Frontend (React/Vite)

**Ubicación**: `/home/techassets/app/dist/public/`

**Responsabilidades**:
- Interfaz de usuario (HTML/CSS/JS)
- Routing del lado del cliente
- Consumo de API
- Validación de formularios

**Servidor**: Nginx (archivos estáticos)

**Build**:
```bash
npm run build
# Genera archivos en dist/public/
```

**No requiere** Node.js en runtime - son archivos estáticos servidos por Nginx.

---

## Mantenimiento

### Actualizar la Aplicación

```bash
# 1. Cambiar a usuario techassets
su - techassets
cd /home/techassets/app

# 2. Obtener nuevo código
git pull origin main
# O copiar archivos actualizados

# 3. Instalar nuevas dependencias
npm install

# 4. Reconstruir
npm run build

# 5. Reiniciar backend
pm2 restart techassets-backend
# O con systemd:
# sudo systemctl restart techassets-backend

# 6. Recargar nginx (si cambió configuración)
sudo systemctl reload nginx
```

### Backup de Base de Datos

```bash
# Crear backup
sudo su - postgres
pg_dump techassets_pro > backup_$(date +%Y%m%d).sql
exit

# Restaurar desde backup
sudo su - postgres
psql techassets_pro < backup_20250104.sql
exit
```

### Monitoreo

```bash
# Ver logs del backend
pm2 logs techassets-backend

# Ver logs de nginx
sudo tail -f /var/log/nginx/techassets_access.log
sudo tail -f /var/log/nginx/techassets_error.log

# Ver uso de recursos
pm2 monit

# Estado del sistema
systemctl status postgresql
systemctl status nginx
systemctl status techassets-backend
```

### Solución de Problemas Comunes

#### Backend no inicia
```bash
# Verificar logs
pm2 logs techassets-backend
# O
sudo journalctl -u techassets-backend -n 50

# Verificar variables de entorno
cat /home/techassets/app/.env.production

# Verificar conexión a base de datos
psql -h localhost -U techassets_user -d techassets_pro
```

#### Frontend no carga
```bash
# Verificar permisos
ls -la /home/techassets/app/dist/public/

# Verificar configuración de nginx
sudo nginx -t

# Ver logs de nginx
sudo tail -f /var/log/nginx/techassets_error.log
```

#### Error de sesiones
```bash
# Verificar que SESSION_SECRET esté configurado
grep SESSION_SECRET /home/techassets/app/.env.production

# Reiniciar backend
pm2 restart techassets-backend
```

---

## Checklist de Deployment

- [ ] AlmaLinux actualizado
- [ ] Node.js 20 LTS instalado
- [ ] PostgreSQL 15 instalado y configurado
- [ ] Nginx instalado
- [ ] PM2 instalado globalmente
- [ ] Usuario `techassets` creado
- [ ] Base de datos `techassets_pro` creada
- [ ] Script `schema.sql` ejecutado
- [ ] Código fuente clonado/copiado
- [ ] Dependencias instaladas (`npm install`)
- [ ] Variables de entorno configuradas (`.env.production`)
- [ ] Backend compilado (`npm run build`)
- [ ] Frontend compilado (`npm run build`)
- [ ] Permisos de archivos configurados
- [ ] Configuración de nginx creada y verificada
- [ ] SSL/HTTPS configurado (Let's Encrypt)
- [ ] Backend iniciado con PM2
- [ ] Nginx reiniciado
- [ ] Firewall configurado
- [ ] SELinux configurado (si aplica)
- [ ] Backup de base de datos configurado
- [ ] Monitoreo configurado

---

## Soporte

Para problemas o preguntas:
1. Revisar logs: `pm2 logs` y `/var/log/nginx/`
2. Verificar estado de servicios: `systemctl status`
3. Consultar documentación de AlmaLinux y PostgreSQL

---

## Notas Adicionales

### Diferencias con Replit

Esta configuración **NO usa**:
- Replit OIDC (autenticación de Replit)
- Variables de entorno de Replit
- Servicios de Replit

En su lugar usa:
- Autenticación con email/password y bcrypt
- Variables de entorno en archivo `.env.production`
- PostgreSQL local
- Nginx como reverse proxy

### Seguridad

- Cambiar todos los secrets por defecto
- Usar HTTPS en producción (Let's Encrypt)
- Mantener el sistema actualizado
- Configurar firewall correctamente
- Limitar acceso SSH
- Usar passwords fuertes para PostgreSQL
- Revisar logs regularmente
