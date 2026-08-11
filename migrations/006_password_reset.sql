-- ============================================================================
-- MIGRACIÓN 006 — Restablecer contraseña desde el panel de administración
-- Fecha: 2026-08-11
-- Aditiva e idempotente.
--
-- El super administrador puede fijarle a un usuario una contraseña temporal.
-- Cuando ese usuario entra, la app lo obliga a definir una contraseña nueva
-- antes de dejarlo usar el sistema.
--
--   must_change_password : TRUE mientras el usuario siga con la contraseña que
--     le puso el administrador. Se apaga solo cuando el usuario la cambia.
--   password_updated_at  : cuándo se cambió por última vez (auditoría).
--
-- Aplicar con:
--   psql -h 127.0.0.1 -U postgres -d techassets_pro -f migrations/006_password_reset.sql
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMP;

-- La app conecta como techassets_user, no como el dueño de las tablas.
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO techassets_user;

COMMENT ON COLUMN users.must_change_password IS
  'TRUE = el usuario debe cambiar su contraseña en el proximo ingreso (reset del admin)';
COMMENT ON COLUMN users.password_updated_at IS
  'Ultima vez que se cambio la contrasena (reset del admin o cambio del usuario)';
