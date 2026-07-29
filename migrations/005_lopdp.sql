-- ============================================================================
-- MIGRACIÓN 005 — MÓDULO PREMIUM DE DATOS PERSONALES (LOPDP Ecuador)
-- ============================================================================
-- Implementa el módulo especificado en MODULO-DATOS-PERSONALES-LOPDP.md:
-- clasificación de datos por activo, motor de riesgos (5 etapas Guía SPDP),
-- doble calificación (riesgo + cumplimiento), plan de acción, documentos
-- legales generados, y "Modo Defensa" (solicitudes de titulares art. 62,
-- procedimientos ante la SPDP arts. 63-66, incidentes art. 43).
--
-- ADITIVA: no altera ni borra datos existentes.
-- Idempotente: se puede ejecutar varias veces sin error.
--
-- Ejecutar:
--   psql -h 127.0.0.1 -U postgres -d techassets_pro -f migrations/005_lopdp.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Feature gate premium por empresa
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS lopdp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lopdp_activated_at TIMESTAMP;

-- ---------------------------------------------------------------------------
-- Perfil LOPDP de la empresa (1:1 con companies)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dp_company_profile (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  sector VARCHAR NOT NULL DEFAULT 'otro',        -- contable|salud|odontologia|legal|otro
  legal_rep_name VARCHAR,
  employee_count INTEGER,
  annual_revenue_range VARCHAR,                  -- <100k|100k-500k|500k-1m|>1m
  dpo_name VARCHAR,                              -- delegado de protección de datos
  dpo_email VARCHAR,
  arco_channel VARCHAR,                          -- correo/formulario para derechos
  questionnaire JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_processor BOOLEAN NOT NULL DEFAULT FALSE,   -- ¿actúa como encargado? (contadores)
  wizard_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_profile_company ON dp_company_profile(company_id);

-- ---------------------------------------------------------------------------
-- Clasificación de datos personales por activo / licencia / contrato
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dp_asset_classification (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_id VARCHAR REFERENCES assets(id) ON DELETE CASCADE,
  license_id VARCHAR REFERENCES licenses(id) ON DELETE CASCADE,
  contract_id VARCHAR REFERENCES contracts(id) ON DELETE CASCADE,
  has_personal_data BOOLEAN NOT NULL DEFAULT FALSE,
  data_categories TEXT[] NOT NULL DEFAULT '{}',  -- identificativos|contacto|laborales|
                                                 -- financieros|salud|biometricos|menores|otros_sensibles
  data_subjects TEXT[] NOT NULL DEFAULT '{}',    -- clientes|pacientes|empleados|proveedores|terceros
  subject_count_range VARCHAR,                   -- <100|100-1000|1000-10000|>10000
  storage_location VARCHAR,                      -- local|nube_ec|nube_ext
  is_processor_asset BOOLEAN NOT NULL DEFAULT FALSE,  -- proveedor = encargado (art. 28)
  retention_period VARCHAR,
  notes TEXT,
  classified_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  classified_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_class_company ON dp_asset_classification(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dp_class_asset ON dp_asset_classification(asset_id)
  WHERE asset_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_dp_class_license ON dp_asset_classification(license_id)
  WHERE license_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_dp_class_contract ON dp_asset_classification(contract_id)
  WHERE contract_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Escenarios de riesgo instanciados (etapa 2-4 de la Guía SPDP)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dp_risk_scenario (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_key VARCHAR NOT NULL,                 -- clave de la plantilla (engine.ts)
  classification_id VARCHAR REFERENCES dp_asset_classification(id) ON DELETE CASCADE,
  entity_name VARCHAR NOT NULL DEFAULT '',       -- nombre del activo afectado
  title VARCHAR NOT NULL,
  dimension VARCHAR NOT NULL,                    -- C|I|D (confidencialidad/integridad/disponibilidad)
  threat_community VARCHAR,
  attack_vector VARCHAR,
  vulnerabilities TEXT[] NOT NULL DEFAULT '{}',  -- claves presentes que elevan la probabilidad
  legal_basis VARCHAR,                           -- artículo LOPDP relacionado
  probability SMALLINT NOT NULL,                 -- 1..5 calculada
  impact SMALLINT NOT NULL,                      -- 1..5 calculada
  probability_override SMALLINT,
  impact_override SMALLINT,
  rationale TEXT NOT NULL DEFAULT '',            -- justificación (exigida por la Guía SPDP)
  override_rationale TEXT,
  residual_probability SMALLINT NOT NULL,
  residual_impact SMALLINT NOT NULL,
  level VARCHAR NOT NULL,                        -- bajo|medio|alto|muy_alto
  ale NUMERIC(14, 2),                            -- análisis cuantitativo opcional
  var90 NUMERIC(14, 2),
  frequency NUMERIC(8, 2),
  status VARCHAR NOT NULL DEFAULT 'open',        -- open|accepted|transferred|avoided
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_scenario_company ON dp_risk_scenario(company_id);
CREATE INDEX IF NOT EXISTS idx_dp_scenario_level ON dp_risk_scenario(company_id, level);

-- ---------------------------------------------------------------------------
-- Fotos de calificación (histórico para la gráfica de evolución)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dp_assessment (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  risk_score NUMERIC(6, 2) NOT NULL,
  risk_grade VARCHAR NOT NULL,                   -- A..E (menos es mejor)
  compliance_score NUMERIC(6, 2) NOT NULL,
  compliance_grade VARCHAR NOT NULL,             -- A..E (más es mejor)
  estimated_fine_min NUMERIC(14, 2) DEFAULT 0,
  estimated_fine_max NUMERIC(14, 2) DEFAULT 0,
  worst_infraction VARCHAR,                      -- leve|grave|muy_grave
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  trigger VARCHAR NOT NULL DEFAULT 'manual',     -- wizard|action_completed|scheduled|manual
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_assessment_company ON dp_assessment(company_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Plan de acción (etapa 5: tratamiento de riesgos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dp_action_item (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  control_key VARCHAR NOT NULL,
  category VARCHAR NOT NULL,                     -- juridica|organizacional|tecnica
  title VARCHAR NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  legal_basis VARCHAR,
  effort VARCHAR NOT NULL DEFAULT 'horas',       -- minutos|horas|dias
  compliance_points NUMERIC(6, 2) NOT NULL DEFAULT 0,
  risk_reduction JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {"p":1} | {"i":1}
  priority INTEGER NOT NULL DEFAULT 0,
  doc_type VARCHAR,                              -- si se resuelve generando un documento
  status VARCHAR NOT NULL DEFAULT 'pending',     -- pending|in_progress|done|not_applicable
  resolution_type VARCHAR,                       -- document|implemented|na
  document_id VARCHAR,
  na_rationale TEXT,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  procedure_id VARCHAR,                          -- si nace de una medida correctiva de la SPDP
  due_date TIMESTAMP,
  assigned_to VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_action_company ON dp_action_item(company_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dp_action_unique
  ON dp_action_item(company_id, control_key) WHERE procedure_id IS NULL;

-- ---------------------------------------------------------------------------
-- Documentos legales generados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dp_document (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doc_type VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR NOT NULL DEFAULT 'draft',       -- draft|generated|published
  related_entity_id VARCHAR,                     -- contrato/solicitud/incidente asociado
  generated_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_document_company ON dp_document(company_id, doc_type);

-- ---------------------------------------------------------------------------
-- Incidentes / vulneraciones de seguridad (arts. 43-46: 72 horas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dp_incident (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  detected_at TIMESTAMP NOT NULL,
  dimensions TEXT[] NOT NULL DEFAULT '{}',       -- C|I|D
  data_categories TEXT[] NOT NULL DEFAULT '{}',
  subject_count_estimate INTEGER,
  severity VARCHAR NOT NULL DEFAULT 'media',     -- baja|media|alta|critica
  status VARCHAR NOT NULL DEFAULT 'contencion',  -- contencion|evaluacion|notificado_spdp|
                                                 -- notificado_titulares|cerrado
  spdp_deadline TIMESTAMP NOT NULL,              -- detected_at + 72h
  spdp_notified_at TIMESTAMP,
  subjects_notified_at TIMESTAMP,
  measures_taken TEXT,
  final_report_document_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_incident_company ON dp_incident(company_id, status);

-- ---------------------------------------------------------------------------
-- MODO DEFENSA — Solicitudes de titulares (art. 62: 10 días término)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dp_titular_request (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  request_type VARCHAR NOT NULL,                 -- acceso|rectificacion|eliminacion|oposicion|
                                                 -- portabilidad|limitacion|queja|revocatoria
  titular_name VARCHAR NOT NULL,
  titular_contact VARCHAR,
  titular_id_number VARCHAR,
  channel VARCHAR,                               -- email|formulario|fisico|telefono
  detail TEXT,
  received_at TIMESTAMP NOT NULL,
  due_date TIMESTAMP NOT NULL,                   -- +10 días término (hábiles Ecuador)
  affected_asset_ids TEXT[] NOT NULL DEFAULT '{}',
  response_document_id VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'open',        -- open|in_progress|answered|executed|denied|expired
  resolution VARCHAR,                            -- concedida|parcial|negada
  resolution_rationale TEXT,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  answered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_request_company ON dp_titular_request(company_id, status);
CREATE INDEX IF NOT EXISTS idx_dp_request_due ON dp_titular_request(due_date);

-- ---------------------------------------------------------------------------
-- MODO DEFENSA — Procedimientos ante la SPDP (arts. 63-66)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dp_authority_procedure (
  id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  procedure_type VARCHAR NOT NULL,               -- actuacion_previa|requerimiento_info|
                                                 -- medida_correctiva|sancionatorio
  file_number VARCHAR,
  notified_at TIMESTAMP NOT NULL,
  deadline TIMESTAMP,
  description TEXT NOT NULL DEFAULT '',
  corrective_measures TEXT,
  status VARCHAR NOT NULL DEFAULT 'open',        -- open|responding|closed
  outcome TEXT,
  related_request_id VARCHAR REFERENCES dp_titular_request(id) ON DELETE SET NULL,
  package_document_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dp_procedure_company ON dp_authority_procedure(company_id, status);

-- ---------------------------------------------------------------------------
-- PERMISOS (la app conecta como techassets_user, no como el dueño postgres)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'techassets_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      dp_company_profile, dp_asset_classification, dp_risk_scenario,
      dp_assessment, dp_action_item, dp_document, dp_incident,
      dp_titular_request, dp_authority_procedure
      TO techassets_user;
  END IF;
END $$;

COMMENT ON TABLE dp_company_profile IS 'Perfil LOPDP de la empresa (sector, cuestionario, DPD)';
COMMENT ON TABLE dp_asset_classification IS 'Qué datos personales vive en cada activo (etapa 2 Guía SPDP)';
COMMENT ON TABLE dp_risk_scenario IS 'Escenarios de riesgo con P/I y rationale (etapas 2-4 Guía SPDP)';
COMMENT ON TABLE dp_assessment IS 'Histórico de calificaciones de riesgo y cumplimiento LOPDP';
COMMENT ON TABLE dp_action_item IS 'Plan de acción / tratamiento de riesgos (etapa 5 Guía SPDP)';
COMMENT ON TABLE dp_document IS 'Documentos legales generados (política, RAT, contratos art. 28)';
COMMENT ON TABLE dp_incident IS 'Vulneraciones de seguridad con plazo de 72h a la SPDP (art. 43)';
COMMENT ON TABLE dp_titular_request IS 'Requerimientos de titulares, 10 días término (art. 62)';
COMMENT ON TABLE dp_authority_procedure IS 'Procedimientos y medidas correctivas de la SPDP (arts. 63-66)';
