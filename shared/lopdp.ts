/**
 * TIPOS Y VALIDACIÓN DEL MÓDULO DE DATOS PERSONALES (LOPDP Ecuador)
 *
 * Compartido entre frontend y backend. Espec funcional completa en
 * MODULO-DATOS-PERSONALES-LOPDP.md.
 *
 * Metodología: Guía de Gestión de Riesgos e Impacto de la SPDP
 * (Res. SPDP-SPD-2025-0003-R) — 5 etapas, con rationale obligatorio en todo
 * valor de entrada.
 */
import { z } from "zod";

// ============================================================================
// ENUMERACIONES DEL DOMINIO
// ============================================================================

export type DpSector = "contable" | "salud" | "odontologia" | "legal" | "otro";

/** Categorías de datos. `salud`, `biometricos`, `menores` y `otros_sensibles`
 *  son categorías especiales del art. 25 LOPDP. */
export type DpDataCategory =
  | "identificativos"
  | "contacto"
  | "laborales"
  | "financieros"
  | "salud"
  | "biometricos"
  | "menores"
  | "otros_sensibles";

export type DpDataSubject =
  | "clientes"
  | "pacientes"
  | "empleados"
  | "proveedores"
  | "terceros";

export type DpSubjectCountRange = "<100" | "100-1000" | "1000-10000" | ">10000";
export type DpStorageLocation = "local" | "nube_ec" | "nube_ext";
export type DpDimension = "C" | "I" | "D";
export type DpRiskLevel = "bajo" | "medio" | "alto" | "muy_alto";
export type DpGrade = "A" | "B" | "C" | "D" | "E";
export type DpActionCategory = "juridica" | "organizacional" | "tecnica";
export type DpActionStatus = "pending" | "in_progress" | "done" | "not_applicable";
export type DpDocumentStatus = "draft" | "generated" | "published";
export type DpInfractionLevel = "leve" | "grave" | "muy_grave";

export type DpDocType =
  | "privacy_policy"
  | "tyc"
  | "dpa"
  | "dpa_processor"
  | "consent"
  | "consent_health"
  | "rat"
  | "arco"
  | "breach_protocol"
  | "eipdp"
  | "soa"
  | "diagnostico"
  | "riesgos"
  | "titular_response"
  | "descargos"
  | "medidas_informe"
  | "trazabilidad"
  | "expediente"
  | "certificado"
  | "spdp_notification";

export type DpRequestType =
  | "acceso"
  | "rectificacion"
  | "eliminacion"
  | "oposicion"
  | "portabilidad"
  | "limitacion"
  | "queja"
  | "revocatoria";

export type DpRequestStatus =
  | "open"
  | "in_progress"
  | "answered"
  | "executed"
  | "denied"
  | "expired";

export type DpProcedureType =
  | "actuacion_previa"
  | "requerimiento_info"
  | "medida_correctiva"
  | "sancionatorio";

export type DpIncidentStatus =
  | "contencion"
  | "evaluacion"
  | "notificado_spdp"
  | "notificado_titulares"
  | "cerrado";

// ============================================================================
// ETIQUETAS EN ESPAÑOL (UI)
// ============================================================================

export const DP_SECTOR_LABELS: Record<DpSector, string> = {
  contable: "Contable / tributario",
  salud: "Salud / consultorio médico",
  odontologia: "Odontología",
  legal: "Jurídico / estudio de abogados",
  otro: "Otro sector",
};

export const DP_CATEGORY_LABELS: Record<DpDataCategory, string> = {
  identificativos: "Identificativos (nombre, cédula)",
  contacto: "Contacto (teléfono, dirección, correo)",
  laborales: "Laborales / académicos",
  financieros: "Financieros / tributarios",
  salud: "Salud (sensible)",
  biometricos: "Biométricos (sensible)",
  menores: "Datos de menores de edad",
  otros_sensibles: "Otros sensibles (etnia, ideología, vida sexual)",
};

export const DP_SUBJECT_LABELS: Record<DpDataSubject, string> = {
  clientes: "Clientes",
  pacientes: "Pacientes",
  empleados: "Empleados",
  proveedores: "Proveedores",
  terceros: "Terceros",
};

export const DP_LEVEL_LABELS: Record<DpRiskLevel, string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
  muy_alto: "Muy alto",
};

export const DP_REQUEST_TYPE_LABELS: Record<DpRequestType, string> = {
  acceso: "Acceso",
  rectificacion: "Rectificación",
  eliminacion: "Eliminación",
  oposicion: "Oposición",
  portabilidad: "Portabilidad",
  limitacion: "Limitación del tratamiento",
  queja: "Queja / reclamación",
  revocatoria: "Revocatoria del consentimiento",
};

export const DP_PROCEDURE_TYPE_LABELS: Record<DpProcedureType, string> = {
  actuacion_previa: "Actuación previa (art. 63)",
  requerimiento_info: "Requerimiento de información",
  medida_correctiva: "Medida correctiva (arts. 65-66)",
  sancionatorio: "Procedimiento sancionatorio",
};

export const DP_DOC_LABELS: Record<DpDocType, string> = {
  privacy_policy: "Política de protección de datos personales",
  tyc: "Términos y condiciones",
  dpa: "Contrato de encargo del tratamiento (art. 28)",
  dpa_processor: "Contrato como encargado del tratamiento",
  consent: "Formulario de consentimiento",
  consent_health: "Consentimiento informado con datos de salud",
  rat: "Registro de Actividades de Tratamiento (RAT)",
  arco: "Procedimiento de derechos ARCO-PL",
  breach_protocol: "Protocolo de respuesta a vulneraciones",
  eipdp: "Evaluación de Impacto (EIPDP)",
  soa: "Declaración de aplicabilidad de controles",
  diagnostico: "Informe de diagnóstico LOPDP",
  riesgos: "Informe de gestión de riesgos",
  titular_response: "Respuesta a solicitud de titular",
  descargos: "Borrador de descargos ante la SPDP",
  medidas_informe: "Informe de cumplimiento de medidas correctivas",
  trazabilidad: "Informe de trazabilidad de datos",
  expediente: "Expediente de cumplimiento (índice)",
  certificado: "Certificado de cumplimiento",
  spdp_notification: "Notificación de vulneración a la SPDP",
};

/** Categorías especiales del art. 25 LOPDP: elevan el impacto al máximo. */
export const DP_SENSITIVE_CATEGORIES: DpDataCategory[] = [
  "salud",
  "biometricos",
  "menores",
  "otros_sensibles",
];

// ============================================================================
// INTERFACES DE DATOS
// ============================================================================

export interface DpCompanyProfile {
  id: string;
  companyId: string;
  sector: DpSector;
  legalRepName: string | null;
  employeeCount: number | null;
  annualRevenueRange: string | null;
  dpoName: string | null;
  dpoEmail: string | null;
  arcoChannel: string | null;
  questionnaire: Record<string, any>;
  isProcessor: boolean;
  wizardCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DpAssetClassification {
  id: string;
  companyId: string;
  assetId: string | null;
  licenseId: string | null;
  contractId: string | null;
  hasPersonalData: boolean;
  dataCategories: DpDataCategory[];
  dataSubjects: DpDataSubject[];
  subjectCountRange: DpSubjectCountRange | null;
  storageLocation: DpStorageLocation | null;
  isProcessorAsset: boolean;
  retentionPeriod: string | null;
  notes: string | null;
  classifiedBy: string | null;
  classifiedAt: Date | null;
  /** Enriquecido en la lectura: nombre y tipo de la entidad clasificada. */
  entityName?: string;
  entityKind?: "asset" | "license" | "contract";
  entityType?: string;
}

export interface DpRiskScenario {
  id: string;
  companyId: string;
  templateKey: string;
  classificationId: string | null;
  entityName: string;
  title: string;
  dimension: DpDimension;
  threatCommunity: string | null;
  attackVector: string | null;
  vulnerabilities: string[];
  legalBasis: string | null;
  probability: number;
  impact: number;
  probabilityOverride: number | null;
  impactOverride: number | null;
  rationale: string;
  overrideRationale: string | null;
  residualProbability: number;
  residualImpact: number;
  level: DpRiskLevel;
  ale: number | null;
  var90: number | null;
  frequency: number | null;
  status: string;
}

export interface DpAssessment {
  id: string;
  companyId: string;
  riskScore: number;
  riskGrade: DpGrade;
  complianceScore: number;
  complianceGrade: DpGrade;
  estimatedFineMin: number;
  estimatedFineMax: number;
  worstInfraction: DpInfractionLevel | null;
  breakdown: DpAssessmentBreakdown;
  trigger: string;
  createdAt: Date;
}

export interface DpComplianceItem {
  key: string;
  label: string;
  legalBasis: string;
  weight: number;
  earned: number;
  satisfied: boolean;
  partial: boolean;
  detail: string;
}

export interface DpAssessmentBreakdown {
  compliance: DpComplianceItem[];
  scenarioCount: number;
  scenariosByLevel: Record<DpRiskLevel, number>;
  classifiedAssets: number;
  totalAssets: number;
  pendingActions: number;
  openRequests: number;
  overdueRequests: number;
}

export interface DpActionItem {
  id: string;
  companyId: string;
  controlKey: string;
  category: DpActionCategory;
  title: string;
  description: string;
  legalBasis: string | null;
  effort: "minutos" | "horas" | "dias";
  compliancePoints: number;
  riskReduction: { p?: number; i?: number };
  priority: number;
  docType: DpDocType | null;
  status: DpActionStatus;
  resolutionType: string | null;
  documentId: string | null;
  naRationale: string | null;
  procedureId: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
}

export interface DpDocument {
  id: string;
  companyId: string;
  docType: DpDocType;
  title: string;
  version: number;
  content: string;
  variables: Record<string, any>;
  status: DpDocumentStatus;
  relatedEntityId: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DpTitularRequest {
  id: string;
  companyId: string;
  requestType: DpRequestType;
  titularName: string;
  titularContact: string | null;
  titularIdNumber: string | null;
  channel: string | null;
  detail: string | null;
  receivedAt: Date;
  dueDate: Date;
  affectedAssetIds: string[];
  responseDocumentId: string | null;
  status: DpRequestStatus;
  resolution: string | null;
  resolutionRationale: string | null;
  answeredAt: Date | null;
  /** Calculado en la lectura. */
  daysLeft?: number;
  isOverdue?: boolean;
}

export interface DpIncident {
  id: string;
  companyId: string;
  title: string;
  description: string;
  detectedAt: Date;
  dimensions: DpDimension[];
  dataCategories: DpDataCategory[];
  subjectCountEstimate: number | null;
  severity: string;
  status: DpIncidentStatus;
  spdpDeadline: Date;
  spdpNotifiedAt: Date | null;
  subjectsNotifiedAt: Date | null;
  measuresTaken: string | null;
  /** Calculado en la lectura: horas restantes del plazo de 72h. */
  hoursLeft?: number;
}

export interface DpAuthorityProcedure {
  id: string;
  companyId: string;
  procedureType: DpProcedureType;
  fileNumber: string | null;
  notifiedAt: Date;
  deadline: Date | null;
  description: string;
  correctiveMeasures: string | null;
  status: string;
  outcome: string | null;
  relatedRequestId: string | null;
  daysLeft?: number;
}

/** Estado general del módulo, drive del wizard y del paywall. */
export interface DpStatus {
  enabled: boolean;
  profileCompleted: boolean;
  totalAssets: number;
  classifiedAssets: number;
  scenarioCount: number;
  assessment: DpAssessment | null;
  pendingActions: number;
  openRequests: number;
  overdueRequests: number;
  openIncidents: number;
  openProcedures: number;
}

// ============================================================================
// ESQUEMAS ZOD
// ============================================================================

const sectorEnum = z.enum(["contable", "salud", "odontologia", "legal", "otro"]);

export const dpProfileSchema = z.object({
  sector: sectorEnum,
  legalRepName: z.string().optional().nullable(),
  employeeCount: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().int().min(0).optional().nullable(),
  ),
  annualRevenueRange: z.string().optional().nullable(),
  dpoName: z.string().optional().nullable(),
  dpoEmail: z.string().optional().nullable(),
  arcoChannel: z.string().optional().nullable(),
  questionnaire: z.record(z.any()).optional(),
  isProcessor: z.boolean().optional(),
  completed: z.boolean().optional(),
});

export const dpClassificationSchema = z.object({
  assetId: z.string().optional().nullable(),
  licenseId: z.string().optional().nullable(),
  contractId: z.string().optional().nullable(),
  hasPersonalData: z.boolean(),
  dataCategories: z.array(z.string()).optional().default([]),
  dataSubjects: z.array(z.string()).optional().default([]),
  subjectCountRange: z.string().optional().nullable(),
  storageLocation: z.string().optional().nullable(),
  isProcessorAsset: z.boolean().optional().default(false),
  retentionPeriod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const dpScenarioOverrideSchema = z.object({
  probabilityOverride: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().int().min(1).max(5).optional().nullable(),
  ),
  impactOverride: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().int().min(1).max(5).optional().nullable(),
  ),
  // La Guía SPDP exige justificar todo valor de entrada: sin rationale no hay override.
  overrideRationale: z.string().min(10, "Justifica el cambio (mínimo 10 caracteres)"),
  status: z.enum(["open", "accepted", "transferred", "avoided"]).optional(),
  frequency: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().min(0).optional().nullable(),
  ),
  impactMin: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().optional().nullable()),
  impactLikely: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().optional().nullable()),
  impactMax: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().optional().nullable()),
});

export const dpActionUpdateSchema = z.object({
  status: z.enum(["pending", "in_progress", "done", "not_applicable"]),
  naRationale: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.date().optional().nullable()),
  evidenceNote: z.string().optional().nullable(),
}).refine(
  (d) => d.status !== "not_applicable" || (d.naRationale && d.naRationale.trim().length >= 10),
  { message: "Para marcar 'no aplica' debes justificarlo (mínimo 10 caracteres)", path: ["naRationale"] },
);

export const dpDocumentCreateSchema = z.object({
  docType: z.string().min(1),
  relatedEntityId: z.string().optional().nullable(),
});

export const dpDocumentUpdateSchema = z.object({
  content: z.string().optional(),
  title: z.string().optional(),
  status: z.enum(["draft", "generated", "published"]).optional(),
});

export const dpTitularRequestSchema = z.object({
  requestType: z.enum([
    "acceso", "rectificacion", "eliminacion", "oposicion",
    "portabilidad", "limitacion", "queja", "revocatoria",
  ]),
  titularName: z.string().min(1, "El nombre del titular es requerido"),
  titularContact: z.string().optional().nullable(),
  titularIdNumber: z.string().optional().nullable(),
  channel: z.string().optional().nullable(),
  detail: z.string().optional().nullable(),
  receivedAt: z.coerce.date(),
  affectedAssetIds: z.array(z.string()).optional().default([]),
});

export const dpTitularRequestUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "answered", "executed", "denied", "expired"]).optional(),
  resolution: z.enum(["concedida", "parcial", "negada"]).optional().nullable(),
  resolutionRationale: z.string().optional().nullable(),
  affectedAssetIds: z.array(z.string()).optional(),
  evidenceNote: z.string().optional().nullable(),
}).refine(
  (d) => d.resolution !== "negada" || (d.resolutionRationale && d.resolutionRationale.trim().length >= 10),
  {
    message: "Negar una solicitud sin motivación es infracción leve (art. 67.1 LOPDP). Justifica la negativa.",
    path: ["resolutionRationale"],
  },
);

export const dpIncidentSchema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional().default(""),
  detectedAt: z.coerce.date(),
  dimensions: z.array(z.enum(["C", "I", "D"])).optional().default([]),
  dataCategories: z.array(z.string()).optional().default([]),
  subjectCountEstimate: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().int().min(0).optional().nullable(),
  ),
  severity: z.enum(["baja", "media", "alta", "critica"]).optional().default("media"),
});

export const dpIncidentUpdateSchema = z.object({
  status: z.enum([
    "contencion", "evaluacion", "notificado_spdp", "notificado_titulares", "cerrado",
  ]).optional(),
  measuresTaken: z.string().optional().nullable(),
  spdpNotifiedAt: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.date().optional().nullable()),
  subjectsNotifiedAt: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.date().optional().nullable()),
});

export const dpProcedureSchema = z.object({
  procedureType: z.enum(["actuacion_previa", "requerimiento_info", "medida_correctiva", "sancionatorio"]),
  fileNumber: z.string().optional().nullable(),
  notifiedAt: z.coerce.date(),
  deadline: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.date().optional().nullable()),
  description: z.string().optional().default(""),
  correctiveMeasures: z.string().optional().nullable(),
  relatedRequestId: z.string().optional().nullable(),
});

export const dpProcedureUpdateSchema = z.object({
  status: z.enum(["open", "responding", "closed"]).optional(),
  outcome: z.string().optional().nullable(),
  correctiveMeasures: z.string().optional().nullable(),
  deadline: z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.date().optional().nullable()),
});

export type DpProfileInput = z.infer<typeof dpProfileSchema>;
export type DpClassificationInput = z.infer<typeof dpClassificationSchema>;
export type DpTitularRequestInput = z.infer<typeof dpTitularRequestSchema>;
export type DpIncidentInput = z.infer<typeof dpIncidentSchema>;
export type DpProcedureInput = z.infer<typeof dpProcedureSchema>;

// ============================================================================
// HELPERS COMPARTIDOS
// ============================================================================

/** Color semáforo por letra (A mejor … E peor), usado en toda la UI. */
export function gradeColor(grade: DpGrade): string {
  switch (grade) {
    case "A": return "text-emerald-600";
    case "B": return "text-lime-600";
    case "C": return "text-amber-600";
    case "D": return "text-orange-600";
    default: return "text-red-600";
  }
}

export function levelColor(level: DpRiskLevel): string {
  switch (level) {
    case "bajo": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "medio": return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    case "alto": return "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300";
    default: return "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300";
  }
}
