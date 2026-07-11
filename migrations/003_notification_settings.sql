-- ============================================================================
-- MIGRACIÓN 003 — Configuración de notificaciones por email (por empresa)
-- Fecha: 2026-07-11
-- Aditiva e idempotente.
--
-- Añade el módulo de notificaciones por correo que vive en Configuración →
-- Notificaciones de cada empresa. Dos tablas:
--
--   company_notification_settings : preferencias por empresa (activar email,
--     destinatarios, cuántos días antes avisar, qué fuentes vigilar).
--   notification_email_log        : registro de correos ya enviados, con clave
--     determinística (source:entity_id:fecha) para NO enviar dos veces el mismo
--     aviso aunque el scheduler corra varias veces al día o tras un reinicio.
--
-- Aplicar con:
--   psql -h 127.0.0.1 -U postgres -d techassets_pro -f migrations/003_notification_settings.sql
-- ============================================================================

-- Preferencias de notificación por empresa (1:1 con companies).
CREATE TABLE IF NOT EXISTS company_notification_settings (
  company_id VARCHAR PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  -- Destinatarios: correos separados por coma/;/espacio. Si queda vacío se usa
  -- companies.email como respaldo.
  recipient_emails TEXT NOT NULL DEFAULT '',
  -- Cuántos días antes del vencimiento avisar (el requisito es 1 = un día antes).
  days_before INTEGER NOT NULL DEFAULT 1,
  -- Qué fuentes de vencimiento vigilar.
  notify_licenses BOOLEAN NOT NULL DEFAULT TRUE,
  notify_contracts BOOLEAN NOT NULL DEFAULT TRUE,
  notify_warranties BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE company_notification_settings IS 'Preferencias de notificación por email de cada empresa';

-- Registro de correos de vencimiento ya enviados (dedupe por clave + empresa).
CREATE TABLE IF NOT EXISTS notification_email_log (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  notification_key VARCHAR NOT NULL,  -- p.ej. license:<id>:2027-01-01
  recipients TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_email_log_unique
  ON notification_email_log(company_id, notification_key);
CREATE INDEX IF NOT EXISTS idx_notif_email_log_company
  ON notification_email_log(company_id);

COMMENT ON TABLE notification_email_log IS 'Correos de vencimiento ya enviados (evita duplicados)';

-- Permisos: la app conecta como techassets_user, no como el dueño postgres.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'techassets_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON company_notification_settings TO techassets_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON notification_email_log TO techassets_user;
  END IF;
END $$;

-- ============================================================================
-- FIN
-- ============================================================================
