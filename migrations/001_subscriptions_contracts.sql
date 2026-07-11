-- ============================================================================
-- MIGRACIÓN 001 — Licencias/suscripciones y relación contratos-activos
-- Fecha: 2026-07-11
-- Aditiva e idempotente: segura de ejecutar sobre la base en producción.
--
-- Aplicar con:
--   psql -h 127.0.0.1 -U postgres -d techassets_pro -f migrations/001_subscriptions_contracts.sql
-- ============================================================================

-- 1. Ciclo de facturación en licencias (mensual / anual / pago único)
ALTER TABLE licenses
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR NOT NULL DEFAULT 'monthly';

COMMENT ON COLUMN licenses.billing_cycle IS 'Recurrencia del pago: monthly | annual | one_time';

-- Inferir el ciclo para registros existentes: si solo tiene costo anual → annual
UPDATE licenses
SET billing_cycle = 'annual'
WHERE billing_cycle = 'monthly'
  AND COALESCE(annual_cost, 0) > 0
  AND COALESCE(monthly_cost, 0) = 0;

-- 2. Relación N:M entre contratos y activos (equipos físicos o aplicaciones)
CREATE TABLE IF NOT EXISTS contract_assets (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  contract_id VARCHAR NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  asset_id VARCHAR NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_assets_unique
  ON contract_assets(contract_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_contract_assets_contract_id
  ON contract_assets(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_assets_asset_id
  ON contract_assets(asset_id);

COMMENT ON TABLE contract_assets IS 'Relación N:M: activos cubiertos por cada contrato';

-- 3. Permisos: la app conecta como techassets_user, no como postgres (dueño).
-- Sin este GRANT, la tabla nueva da "permission denied" al leer/escribir.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'techassets_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON contract_assets TO techassets_user;
  END IF;
END $$;

-- ============================================================================
-- FIN — verificar con: \d contract_assets  y  \d licenses
-- ============================================================================
