-- ============================================================================
-- MIGRACIÓN 002 — Descartes de notificaciones de vencimiento
-- Fecha: 2026-07-11
-- Aditiva e idempotente.
--
-- Los vencimientos se CALCULAN en tiempo real desde licencias, contratos,
-- garantías de equipos e infraestructura de apps. Esta tabla solo guarda qué
-- alertas descartó cada usuario (para no volver a mostrarlas hasta que la
-- fecha cambie: la "notification_key" incluye la fecha objetivo).
--
-- Aplicar con:
--   psql -h 127.0.0.1 -U postgres -d techassets_pro -f migrations/002_notification_dismissals.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_dismissals (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_key VARCHAR NOT NULL,  -- p.ej. license:<id>:expiry:2027-01-01
  dismissed_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dismiss_unique
  ON notification_dismissals(company_id, user_id, notification_key);
CREATE INDEX IF NOT EXISTS idx_notif_dismiss_company
  ON notification_dismissals(company_id);

COMMENT ON TABLE notification_dismissals IS 'Alertas de vencimiento descartadas por cada usuario';

-- Permisos: la app conecta como techassets_user, no como el dueño postgres.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'techassets_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON notification_dismissals TO techassets_user;
  END IF;
END $$;

-- ============================================================================
-- FIN
-- ============================================================================
