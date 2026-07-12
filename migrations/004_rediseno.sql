-- ============================================================================
-- MIGRACIÓN 004 — Gran rediseño 2026-07
-- Categorías de activos, fotos, código único/QR, campos personalizados,
-- depreciación (norma Ecuador), pago/motivo/renovación en aplicaciones y
-- licencias, archivo+contactos en contratos, líneas de mantenimiento e
-- informe quincenal.
--
-- Aplicar con:  psql -d techassets_pro -f migrations/004_rediseno.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. CATEGORÍAS DE ACTIVOS (por empresa, creables al vuelo desde el wizard)
--    depreciation_years según Reglamento LRTI Art. 28 (línea recta):
--    equipos de cómputo 3 años (33%), maquinaria/equipos/muebles 10 años (10%),
--    vehículos 5 años (20%).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_categories (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  depreciation_years INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_categories_unique
  ON asset_categories(company_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_asset_categories_company
  ON asset_categories(company_id);

-- Categorías por defecto para las empresas existentes (idempotente)
INSERT INTO asset_categories (company_id, name, depreciation_years)
SELECT c.id, cat.name, cat.years
FROM companies c
CROSS JOIN (VALUES
  ('Equipos de cómputo', 3),
  ('Servidores y redes', 3),
  ('Impresoras y escáneres', 3),
  ('Cámaras de seguridad', 10),
  ('Biométricos y control de acceso', 10),
  ('Telefonía y comunicaciones', 10),
  ('Vehículos', 5)
) AS cat(name, years)
WHERE NOT EXISTS (
  SELECT 1 FROM asset_categories ac
  WHERE ac.company_id = c.id AND LOWER(ac.name) = LOWER(cat.name)
);

-- ----------------------------------------------------------------------------
-- 2. ACTIVOS: categoría, código único, costos de depreciación y campos de
--    suscripción (para assets tipo 'application')
-- ----------------------------------------------------------------------------
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS category_id VARCHAR REFERENCES asset_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asset_code VARCHAR,
  ADD COLUMN IF NOT EXISTS purchase_cost DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS residual_value DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depreciation_years INTEGER,          -- NULL => hereda de la categoría
  -- Suscripciones (assets tipo 'application')
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR,               -- monthly|quarterly|semiannual|annual
  ADD COLUMN IF NOT EXISTS provider VARCHAR,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR,              -- card|transfer|cash|other
  ADD COLUMN IF NOT EXISTS card_name VARCHAR,
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR,
  ADD COLUMN IF NOT EXISTS purpose TEXT,                        -- motivo de la suscripción
  ADD COLUMN IF NOT EXISTS renewal_type VARCHAR DEFAULT 'manual',  -- automatic|manual
  ADD COLUMN IF NOT EXISTS renewal_date TIMESTAMP;

-- Código único legible para activos existentes: AST-XXXXXXXX (derivado del id)
UPDATE assets
SET asset_code = 'AST-' || UPPER(SUBSTRING(REPLACE(id, '-', '') FROM 1 FOR 8))
WHERE asset_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_asset_code ON assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_renewal_date ON assets(renewal_date);

-- ----------------------------------------------------------------------------
-- 3. FOTOS DE ACTIVOS (varias por activo; archivo en disco bajo uploads/)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_photos (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id VARCHAR NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  file_path VARCHAR NOT NULL,          -- ruta relativa servida por /uploads
  original_name VARCHAR,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_photos_asset ON asset_photos(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_photos_company ON asset_photos(company_id);

-- ----------------------------------------------------------------------------
-- 4. CAMPOS PERSONALIZADOS (líneas nombre → valor, estilo detalle de factura)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_custom_fields (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id VARCHAR NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  field_name VARCHAR NOT NULL,
  field_value TEXT NOT NULL DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asset_custom_fields_asset ON asset_custom_fields(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_custom_fields_company ON asset_custom_fields(company_id);

-- ----------------------------------------------------------------------------
-- 5. LICENCIAS: forma de pago, motivo y tipo de renovación
--    (billing_cycle ya es VARCHAR: ahora acepta monthly|quarterly|semiannual|
--     annual|one_time)
-- ----------------------------------------------------------------------------
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR,
  ADD COLUMN IF NOT EXISTS card_name VARCHAR,
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS renewal_type VARCHAR DEFAULT 'manual';

-- ----------------------------------------------------------------------------
-- 6. CONTRATOS: archivo del contrato y contactos de soporte
-- ----------------------------------------------------------------------------
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS contract_file VARCHAR,               -- ruta bajo /uploads
  ADD COLUMN IF NOT EXISTS support_contacts JSONB NOT NULL DEFAULT '[]'::jsonb;
  -- support_contacts: [{"name": "...", "phone": "...", "email": "..."}]

-- ----------------------------------------------------------------------------
-- 7. LÍNEAS DE MANTENIMIENTO (detalle tipo factura: piezas / servicio)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_lines (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  maintenance_id VARCHAR NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  description VARCHAR NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_maintenance_lines_maintenance
  ON maintenance_lines(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_lines_company
  ON maintenance_lines(company_id);

-- ----------------------------------------------------------------------------
-- 8. INFORME QUINCENAL (días 15 y 30) — preferencias por empresa.
--    El dedupe de envíos reutiliza notification_email_log con claves
--    'biweekly-report:YYYY-MM-DD'.
-- ----------------------------------------------------------------------------
ALTER TABLE company_notification_settings
  ADD COLUMN IF NOT EXISTS biweekly_report_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS report_recipient_emails TEXT NOT NULL DEFAULT '';

-- ----------------------------------------------------------------------------
-- 9. PERMISOS (la app conecta como techassets_user, no como postgres)
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON asset_categories TO techassets_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON asset_photos TO techassets_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON asset_custom_fields TO techassets_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON maintenance_lines TO techassets_user;

COMMENT ON TABLE asset_categories IS 'Categorías de activos por empresa con años de depreciación (norma Ecuador, línea recta)';
COMMENT ON TABLE asset_photos IS 'Fotos de activos (varias por activo), archivo físico en uploads/';
COMMENT ON TABLE asset_custom_fields IS 'Campos personalizados nombre→valor por activo (estilo detalle de factura)';
COMMENT ON TABLE maintenance_lines IS 'Líneas de detalle de mantenimiento (piezas/servicio) tipo factura';

COMMIT;
