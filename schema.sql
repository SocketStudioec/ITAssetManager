-- ============================================================================
-- TECHASSETS PRO - SCRIPT DE CREACIÓN DE BASE DE DATOS
-- ============================================================================
-- Este script crea la estructura completa de la base de datos para TechAssets Pro
-- Sistema de gestión de activos IT para PyMEs y Profesionales
--
-- INSTRUCCIONES DE USO:
-- 1. Crear base de datos: createdb techassets_pro
-- 2. Ejecutar script: psql -d techassets_pro -f schema.sql
--
-- REQUISITOS:
-- - PostgreSQL 13 o superior
-- - Extensión uuid-ossp para generación de UUIDs
-- ============================================================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMERACIONES (TIPOS PERSONALIZADOS)
-- ============================================================================

-- Roles de usuario
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'technical_admin',
  'manager_owner'
);

-- Estados de activos
CREATE TYPE asset_status AS ENUM (
  'active',
  'inactive',
  'maintenance',
  'deprecated',
  'disposed'
);

-- Tipos de activos
CREATE TYPE asset_type AS ENUM (
  'physical',
  'application',
  'license',
  'contract'
);

-- Tipos de aplicaciones
CREATE TYPE application_type AS ENUM (
  'saas',
  'custom_development'
);

-- Tipos de mantenimiento
CREATE TYPE maintenance_type AS ENUM (
  'preventive',
  'corrective',
  'emergency',
  'upgrade'
);

-- Estados de mantenimiento
CREATE TYPE maintenance_status AS ENUM (
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

-- Estados de contratos
CREATE TYPE contract_status AS ENUM (
  'active',
  'expired',
  'pending_renewal',
  'cancelled'
);

-- Planes de empresa
CREATE TYPE company_plan AS ENUM (
  'pyme',
  'professional'
);

-- ============================================================================
-- TABLA DE SESIONES (para express-session)
-- ============================================================================
-- Almacena sesiones de usuario para autenticación persistente
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

-- Índice para limpieza de sesiones expiradas
CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire);

-- ============================================================================
-- TABLA DE USUARIOS
-- ============================================================================
-- Almacena información de usuarios del sistema
-- Autenticación basada en email y password con hash bcrypt
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,  -- Hash bcrypt de la contraseña
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  profile_image_url VARCHAR,
  role user_role NOT NULL DEFAULT 'technical_admin',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- TABLA DE EMPRESAS
-- ============================================================================
-- Almacena información de empresas (multi-tenancy)
-- Soporta dos planes: PyME y Professional
CREATE TABLE companies (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name VARCHAR NOT NULL,
  description TEXT,
  plan company_plan NOT NULL DEFAULT 'pyme',
  max_users INTEGER DEFAULT 10,
  max_assets INTEGER DEFAULT 500,
  is_active BOOLEAN DEFAULT TRUE,
  -- Campos de registro
  ruc VARCHAR UNIQUE,            -- Para empresas PyME
  cedula VARCHAR UNIQUE,          -- Para profesionales
  address TEXT,
  phone VARCHAR,
  email VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas y reportes
CREATE INDEX idx_companies_plan ON companies(plan);
CREATE INDEX idx_companies_is_active ON companies(is_active);

-- ============================================================================
-- TABLA DE RELACIÓN USUARIO-EMPRESA
-- ============================================================================
-- Implementa relación many-to-many entre usuarios y empresas
-- Un usuario puede pertenecer a múltiples empresas con diferentes roles
CREATE TABLE user_companies (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'technical_admin',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para joins eficientes
CREATE INDEX idx_user_companies_user_id ON user_companies(user_id);
CREATE INDEX idx_user_companies_company_id ON user_companies(company_id);
CREATE UNIQUE INDEX idx_user_companies_unique ON user_companies(user_id, company_id);

-- ============================================================================
-- TABLA DE ACTIVOS
-- ============================================================================
-- Almacena todos los tipos de activos IT (físicos, aplicaciones, licencias)
CREATE TABLE assets (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  type asset_type NOT NULL,
  description TEXT,
  serial_number VARCHAR,
  model VARCHAR,
  manufacturer VARCHAR,
  purchase_date TIMESTAMP,
  warranty_expiry TIMESTAMP,
  monthly_cost DECIMAL(10, 2) DEFAULT 0,
  annual_cost DECIMAL(10, 2) DEFAULT 0,
  status asset_status NOT NULL DEFAULT 'active',
  location VARCHAR,
  assigned_to VARCHAR,
  notes TEXT,
  -- Campos específicos de aplicaciones
  application_type application_type,
  url VARCHAR,
  version VARCHAR,
  -- Costos de infraestructura
  domain_cost DECIMAL(10, 2) DEFAULT 0,
  ssl_cost DECIMAL(10, 2) DEFAULT 0,
  hosting_cost DECIMAL(10, 2) DEFAULT 0,
  server_cost DECIMAL(10, 2) DEFAULT 0,
  -- Fechas de vencimiento de infraestructura
  domain_expiry TIMESTAMP,
  ssl_expiry TIMESTAMP,
  hosting_expiry TIMESTAMP,
  server_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas y reportes
CREATE INDEX idx_assets_company_id ON assets(company_id);
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_warranty_expiry ON assets(warranty_expiry);

-- ============================================================================
-- TABLA DE CONTRATOS
-- ============================================================================
-- Gestiona contratos con proveedores
CREATE TABLE contracts (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  vendor VARCHAR NOT NULL,
  description TEXT,
  contract_type VARCHAR NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  renewal_date TIMESTAMP,
  monthly_cost DECIMAL(10, 2) DEFAULT 0,
  annual_cost DECIMAL(10, 2) DEFAULT 0,
  status contract_status NOT NULL DEFAULT 'active',
  auto_renewal BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas y alertas
CREATE INDEX idx_contracts_company_id ON contracts(company_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_end_date ON contracts(end_date);
CREATE INDEX idx_contracts_renewal_date ON contracts(renewal_date);

-- ============================================================================
-- TABLA DE LICENCIAS
-- ============================================================================
-- Control de licencias de software
CREATE TABLE licenses (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id VARCHAR REFERENCES assets(id) ON DELETE SET NULL,
  name VARCHAR NOT NULL,
  vendor VARCHAR NOT NULL,
  license_key TEXT,
  license_type VARCHAR,
  max_users INTEGER,
  current_users INTEGER DEFAULT 0,
  purchase_date TIMESTAMP,
  expiry_date TIMESTAMP,
  monthly_cost DECIMAL(10, 2) DEFAULT 0,
  annual_cost DECIMAL(10, 2) DEFAULT 0,
  status asset_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para compliance y alertas
CREATE INDEX idx_licenses_company_id ON licenses(company_id);
CREATE INDEX idx_licenses_asset_id ON licenses(asset_id);
CREATE INDEX idx_licenses_expiry_date ON licenses(expiry_date);
CREATE INDEX idx_licenses_status ON licenses(status);

-- ============================================================================
-- TABLA DE REGISTROS DE MANTENIMIENTO
-- ============================================================================
-- Historial de mantenimiento de activos
CREATE TABLE maintenance_records (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  asset_id VARCHAR NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  maintenance_type maintenance_type NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT NOT NULL,
  vendor VARCHAR,
  cost DECIMAL(10, 2) DEFAULT 0,
  scheduled_date TIMESTAMP,
  completed_date TIMESTAMP,
  next_maintenance_date TIMESTAMP,
  status maintenance_status NOT NULL DEFAULT 'scheduled',
  priority VARCHAR DEFAULT 'medium',
  technician VARCHAR,
  parts_replaced TEXT,
  time_spent INTEGER,
  notes TEXT,
  attachments TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para planificación y reportes
CREATE INDEX idx_maintenance_asset_id ON maintenance_records(asset_id);
CREATE INDEX idx_maintenance_company_id ON maintenance_records(company_id);
CREATE INDEX idx_maintenance_status ON maintenance_records(status);
CREATE INDEX idx_maintenance_scheduled_date ON maintenance_records(scheduled_date);
CREATE INDEX idx_maintenance_next_date ON maintenance_records(next_maintenance_date);

-- ============================================================================
-- TABLA DE LOG DE ACTIVIDADES
-- ============================================================================
-- Auditoría completa de todas las acciones en el sistema
CREATE TABLE activity_log (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR NOT NULL,
  entity_type VARCHAR NOT NULL,
  entity_id VARCHAR,
  entity_name VARCHAR,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para reportes de auditoría
CREATE INDEX idx_activity_company_id ON activity_log(company_id);
CREATE INDEX idx_activity_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_created_at ON activity_log(created_at);
CREATE INDEX idx_activity_entity_type ON activity_log(entity_type);

-- ============================================================================
-- COMENTARIOS DE TABLAS
-- ============================================================================

COMMENT ON TABLE sessions IS 'Almacena sesiones de usuario para autenticación con express-session';
COMMENT ON TABLE users IS 'Usuarios del sistema con autenticación por email/password';
COMMENT ON TABLE companies IS 'Empresas (multi-tenancy) con planes PyME o Professional';
COMMENT ON TABLE user_companies IS 'Relación many-to-many entre usuarios y empresas';
COMMENT ON TABLE assets IS 'Activos IT (físicos, aplicaciones, infraestructura)';
COMMENT ON TABLE contracts IS 'Contratos con proveedores y servicios';
COMMENT ON TABLE licenses IS 'Licencias de software con control de compliance';
COMMENT ON TABLE maintenance_records IS 'Historial de mantenimiento de activos';
COMMENT ON TABLE activity_log IS 'Log de auditoría de todas las acciones del sistema';

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
-- La base de datos está lista para usar
-- 
-- PRÓXIMOS PASOS:
-- 1. Configurar variable de entorno DATABASE_URL
-- 2. Configurar SESSION_SECRET para producción
-- 3. (Opcional) Crear usuario super_admin inicial:
--
-- INSERT INTO users (email, password_hash, first_name, last_name, role)
-- VALUES ('admin@ejemplo.com', '$2b$10$...', 'Admin', 'System', 'super_admin');
--
-- Nota: El password_hash debe generarse con bcrypt desde la aplicación
-- ============================================================================
