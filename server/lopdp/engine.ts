/**
 * MOTOR DE RIESGOS LOPDP — Metodología de la Guía SPDP (Res. SPDP-SPD-2025-0003-R)
 *
 * Funciones PURAS y DETERMINISTAS: la misma entrada produce siempre la misma
 * salida. Eso permite auditarlas, testearlas y —sobre todo— explicar cada
 * número al usuario, que es lo que la Guía SPDP exige (todo valor de entrada
 * debe tener un rationale justificado; nada de "listas de chequeo mágicas").
 *
 * Las 5 etapas de la guía se mapean así:
 *  1. Contexto      → CRITERIOS de impacto/probabilidad (constantes de abajo)
 *  2. Identificación→ VULNERABILITY_CATALOG + SCENARIO_TEMPLATES
 *  3. Análisis      → computeScenarios() (cualitativo) + quantitative()
 *  4. Evaluación    → computeRiskScore() + matriz P×I
 *  5. Tratamiento   → CONTROL_CATALOG + computeComplianceScore()
 */
import type {
  DpDataCategory,
  DpAssessmentBreakdown,
  DpComplianceItem,
  DpDimension,
  DpGrade,
  DpInfractionLevel,
  DpRiskLevel,
  DpSector,
  DpActionCategory,
  DpDocType,
} from "@shared/lopdp";
import { DP_SENSITIVE_CATEGORIES } from "@shared/lopdp";

// ============================================================================
// ETAPA 1 — CRITERIOS DE EVALUACIÓN (establecimiento del contexto)
// ============================================================================

/**
 * Impacto base según la categoría de datos más sensible presente en el activo.
 * Criterio (a) de la Guía SPDP: las categorías especiales del art. 25 LOPDP
 * ocasionan proporcionalmente mayor impacto en derechos y libertades.
 */
export function baseImpactForCategories(categories: DpDataCategory[]): number {
  if (categories.some((c) => DP_SENSITIVE_CATEGORIES.includes(c))) return 5;
  if (categories.includes("financieros")) return 4;
  if (categories.includes("laborales")) return 3;
  if (categories.length > 0) return 2;
  return 1;
}

/** Criterio (c) de la Guía: la cantidad de titulares afectados eleva el impacto. */
function subjectCountBonus(range: string | null | undefined): number {
  if (range === ">10000") return 2;
  if (range === "1000-10000") return 1;
  return 0;
}

/** Criterio (b): grupos especialmente vulnerables (art. 40.2 LOPDP). */
function vulnerableGroupBonus(categories: DpDataCategory[], subjects: string[]): number {
  if (categories.includes("menores")) return 1;
  if (subjects.includes("pacientes")) return 1;
  return 0;
}

const clamp = (n: number, min = 1, max = 5) => Math.max(min, Math.min(max, n));

// ============================================================================
// ETAPA 2 — CATÁLOGO DE VULNERABILIDADES (jurídicas / organizacionales / técnicas)
// ============================================================================

export interface VulnerabilityDef {
  key: string;
  label: string;
  category: DpActionCategory;
  /** Se considera PRESENTE cuando esta respuesta del cuestionario es falsa. */
  questionKey: string;
}

export const VULNERABILITY_CATALOG: VulnerabilityDef[] = [
  // Jurídicas — falta de madurez en obligaciones de la LOPDP
  { key: "J01", label: "Sin base legal identificada para los tratamientos", category: "juridica", questionKey: "hasLegalBasis" },
  { key: "J02", label: "Sin Registro de Actividades de Tratamiento (RAT)", category: "juridica", questionKey: "hasRat" },
  { key: "J03", label: "Sin política de protección de datos publicada", category: "juridica", questionKey: "hasPrivacyPolicy" },
  { key: "J04", label: "Sin mecanismos de consentimiento documentado", category: "juridica", questionKey: "hasConsent" },
  { key: "J05", label: "Sin contratos de encargo con proveedores (art. 28)", category: "juridica", questionKey: "hasDpaContracts" },
  { key: "J06", label: "Sin canal para el ejercicio de derechos ARCO-PL", category: "juridica", questionKey: "hasArcoChannel" },
  { key: "J07", label: "Sin evaluación de impacto (EIPDP) en tratamientos de alto riesgo", category: "juridica", questionKey: "hasEipdp" },
  { key: "J08", label: "Sin protocolo de respuesta a vulneraciones (72 horas)", category: "juridica", questionKey: "hasBreachProtocol" },
  { key: "J09", label: "Sin delegado de protección de datos designado", category: "juridica", questionKey: "hasDpo" },
  // Organizacionales — debilidades en procesos
  { key: "O01", label: "Personal sin capacitación en protección de datos", category: "organizacional", questionKey: "hasTraining" },
  { key: "O02", label: "Sin control de accesos por rol (mínimo privilegio)", category: "organizacional", questionKey: "hasAccessControl" },
  { key: "O03", label: "Sin política interna de seguridad de la información", category: "organizacional", questionKey: "hasSecurityPolicy" },
  { key: "O04", label: "Sin acuerdos de confidencialidad con el personal", category: "organizacional", questionKey: "hasNda" },
  // Técnicas — software y hardware
  { key: "T01", label: "Sin respaldos probados de la información", category: "tecnica", questionKey: "hasBackups" },
  { key: "T02", label: "Sin cifrado de datos en reposo o en tránsito", category: "tecnica", questionKey: "hasEncryption" },
  { key: "T03", label: "Sin autenticación de múltiples factores (MFA)", category: "tecnica", questionKey: "hasMfa" },
  { key: "T04", label: "Sin antivirus / protección de endpoints actualizada", category: "tecnica", questionKey: "hasAntivirus" },
  { key: "T05", label: "Equipos sin contraseña o sin bloqueo automático", category: "tecnica", questionKey: "hasDeviceLock" },
  { key: "T06", label: "Sin registros de auditoría (logs) de accesos", category: "tecnica", questionKey: "hasAuditLogs" },
];

/**
 * Vulnerabilidades presentes = respuestas del cuestionario en falso.
 * Una pregunta sin responder cuenta como vulnerabilidad presente: el criterio
 * de la Guía es el "SER" y no el "DEBER SER" — sin evidencia, no se asume
 * cumplimiento.
 */
export function presentVulnerabilities(questionnaire: Record<string, any>): string[] {
  return VULNERABILITY_CATALOG.filter((v) => questionnaire[v.questionKey] !== true).map((v) => v.key);
}

export function vulnerabilityLabel(key: string): string {
  return VULNERABILITY_CATALOG.find((v) => v.key === key)?.label ?? key;
}

// ============================================================================
// ETAPA 2 — PLANTILLAS DE ESCENARIOS DE RIESGO
// ============================================================================

export interface ScenarioTemplate {
  key: string;
  title: string;
  dimension: DpDimension;
  threatCommunity: string;
  attackVector: string;
  /** Vulnerabilidades que, si están presentes, elevan la probabilidad. */
  vulnerabilityKeys: string[];
  legalBasis: string;
  /** Solo aplica si el activo tiene alguna de estas categorías (vacío = todas). */
  requiresCategories?: DpDataCategory[];
  /** Solo aplica a estos sectores (vacío = todos). */
  sectors?: DpSector[];
  /** Solo aplica si el activo es un proveedor/encargado. */
  requiresProcessor?: boolean;
  /** Solo aplica si los datos salen del país. */
  requiresForeignStorage?: boolean;
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    key: "fuga_base_datos",
    title: "Fuga de la base de datos de titulares",
    dimension: "C",
    threatCommunity: "Cibercriminales (phishing, malware, credenciales robadas)",
    attackVector: "Ingeniería social y troyano / robo de credenciales",
    vulnerabilityKeys: ["T02", "T03", "O01", "O02"],
    legalBasis: "Arts. 37-39 LOPDP (seguridad de datos)",
  },
  {
    key: "ransomware",
    title: "Ransomware cifra los sistemas y detiene el servicio",
    dimension: "D",
    threatCommunity: "Cibercriminales con motivación económica",
    attackVector: "Malware de cifrado (ransomware)",
    vulnerabilityKeys: ["T01", "T04", "O01"],
    legalBasis: "Art. 37 LOPDP (disponibilidad); art. 43 (notificación 72h)",
  },
  {
    key: "acceso_interno",
    title: "Acceso indebido de personal interno a datos personales",
    dimension: "C",
    threatCommunity: "Empleados con privilegios excesivos",
    attackVector: "Abuso de permisos / consulta no autorizada",
    vulnerabilityKeys: ["O02", "T06", "O04"],
    legalBasis: "Art. 38 LOPDP (confidencialidad); ISO 27002 cl. 5.15",
  },
  {
    key: "robo_equipo",
    title: "Pérdida o robo de equipo con datos personales",
    dimension: "C",
    threatCommunity: "Robo físico / extravío",
    attackVector: "Sustracción de portátil, disco o dispositivo móvil",
    vulnerabilityKeys: ["T02", "T05"],
    legalBasis: "Art. 37 LOPDP (medidas de seguridad físicas)",
  },
  {
    key: "error_humano",
    title: "Error humano expone datos personales a terceros",
    dimension: "C",
    threatCommunity: "Personal sin capacitación",
    attackVector: "Envío erróneo, publicación accidental, copia indebida",
    vulnerabilityKeys: ["O01", "O03"],
    legalBasis: "Art. 49 LOPDP (capacitación); art. 10 (responsabilidad)",
  },
  {
    key: "sin_base_legal",
    title: "Tratamiento de datos sin base legal ni consentimiento válido",
    dimension: "C",
    threatCommunity: "El propio responsable del tratamiento",
    attackVector: "Recolección o uso sin legitimidad (art. 7)",
    vulnerabilityKeys: ["J01", "J03", "J04"],
    legalBasis: "Arts. 7 y 8 LOPDP (legitimidad y consentimiento)",
  },
  {
    key: "encargado_sin_contrato",
    title: "Proveedor accede a datos sin contrato de encargo",
    dimension: "C",
    threatCommunity: "Proveedor tecnológico / encargado del tratamiento",
    attackVector: "Tratamiento sin instrucciones ni obligaciones documentadas",
    vulnerabilityKeys: ["J05", "J02"],
    legalBasis: "Art. 28 LOPDP (encargado del tratamiento)",
    requiresProcessor: true,
  },
  {
    key: "derechos_no_atendidos",
    title: "Imposibilidad de atender derechos ARCO-PL en plazo",
    dimension: "I",
    threatCommunity: "El propio responsable (falta de procesos)",
    attackVector: "Sin canal ni procedimiento: el titular escala a la SPDP",
    vulnerabilityKeys: ["J06", "J02"],
    legalBasis: "Arts. 12-22 y 62 LOPDP (10 días término)",
  },
  {
    key: "desastre_fisico",
    title: "Incendio, inundación o desastre destruye el archivo",
    dimension: "D",
    threatCommunity: "Amenazas naturales",
    attackVector: "Evento natural o siniestro en las instalaciones",
    vulnerabilityKeys: ["T01"],
    legalBasis: "Art. 37 LOPDP (continuidad y disponibilidad)",
  },
  {
    key: "transferencia_internacional",
    title: "Transferencia internacional de datos sin garantías",
    dimension: "C",
    threatCommunity: "Proveedor de nube en el exterior",
    attackVector: "Datos alojados fuera del Ecuador sin nivel adecuado",
    vulnerabilityKeys: ["J05", "J01"],
    legalBasis: "Arts. 55-61 LOPDP (transferencias internacionales)",
    requiresForeignStorage: true,
  },
  {
    key: "historia_clinica",
    title: "Divulgación de historias clínicas (datos sensibles de salud)",
    dimension: "C",
    threatCommunity: "Cibercriminales y personal con acceso",
    attackVector: "Acceso no autorizado al sistema de historias clínicas",
    vulnerabilityKeys: ["T02", "T03", "O02", "J07"],
    legalBasis: "Art. 25 LOPDP (datos sensibles); art. 42 (EIPDP obligatoria)",
    requiresCategories: ["salud"],
  },
  {
    key: "secreto_profesional",
    title: "Filtración de expedientes bajo secreto profesional",
    dimension: "C",
    threatCommunity: "Cibercriminales, personal interno, contraparte",
    attackVector: "Acceso indebido a expedientes de clientes",
    vulnerabilityKeys: ["T02", "O02", "O04"],
    legalBasis: "Art. 38 LOPDP (deber de confidencialidad)",
    sectors: ["legal", "contable"],
  },
];

// ============================================================================
// ETAPA 3 — ANÁLISIS DE RIESGOS (cálculo de P, I y rationale)
// ============================================================================

export interface ClassificationInput {
  id: string;
  entityName: string;
  hasPersonalData: boolean;
  dataCategories: DpDataCategory[];
  dataSubjects: string[];
  subjectCountRange: string | null;
  storageLocation: string | null;
  isProcessorAsset: boolean;
}

export interface ComputedScenario {
  templateKey: string;
  classificationId: string;
  entityName: string;
  title: string;
  dimension: DpDimension;
  threatCommunity: string;
  attackVector: string;
  vulnerabilities: string[];
  legalBasis: string;
  probability: number;
  impact: number;
  residualProbability: number;
  residualImpact: number;
  level: DpRiskLevel;
  rationale: string;
}

function templateApplies(
  tpl: ScenarioTemplate,
  cls: ClassificationInput,
  sector: DpSector,
): boolean {
  if (tpl.requiresCategories && !tpl.requiresCategories.some((c) => cls.dataCategories.includes(c))) {
    return false;
  }
  if (tpl.sectors && !tpl.sectors.includes(sector)) return false;
  if (tpl.requiresProcessor && !cls.isProcessorAsset) return false;
  if (tpl.requiresForeignStorage && cls.storageLocation !== "nube_ext") return false;
  return true;
}

/** Matriz 5×5. Representación (no cálculo ciego): P e I quedan siempre visibles. */
export function riskLevel(p: number, i: number): DpRiskLevel {
  const product = p * i;
  // Un impacto máximo (datos sensibles) nunca puede quedar en "bajo" aunque la
  // probabilidad sea mínima: la Guía advierte que multiplicar ofusca el impacto
  // real cuando lo que se protege son derechos, no activos.
  if (i >= 5 && p >= 3) return "muy_alto";
  if (i >= 5) return "alto";
  if (product >= 15) return "muy_alto";
  if (product >= 8) return "alto";
  if (product >= 4) return "medio";
  return "bajo";
}

/**
 * Instancia los escenarios de riesgo de una empresa.
 * @param completedControls claves de controles YA implementados (reducen el riesgo residual)
 */
export function computeScenarios(
  classifications: ClassificationInput[],
  questionnaire: Record<string, any>,
  sector: DpSector,
  completedControls: string[] = [],
): ComputedScenario[] {
  const present = new Set(presentVulnerabilities(questionnaire));
  const scenarios: ComputedScenario[] = [];

  for (const cls of classifications) {
    if (!cls.hasPersonalData) continue;

    const baseImpact = baseImpactForCategories(cls.dataCategories);
    const countBonus = subjectCountBonus(cls.subjectCountRange);
    const groupBonus = vulnerableGroupBonus(cls.dataCategories, cls.dataSubjects);
    const impact = clamp(baseImpact + countBonus + groupBonus);

    for (const tpl of SCENARIO_TEMPLATES) {
      if (!templateApplies(tpl, cls, sector)) continue;

      const activeVulns = tpl.vulnerabilityKeys.filter((k) => present.has(k));
      // Probabilidad = 1 (línea base: el riesgo nunca es cero) + vulnerabilidades presentes.
      const probability = clamp(1 + activeVulns.length);

      // Riesgo residual: los controles ya implementados que mitigan este escenario.
      const mitigating = tpl.vulnerabilityKeys.filter((k) => completedControls.includes(k)).length;
      const residualProbability = clamp(probability - Math.min(mitigating, 2));
      const residualImpact = impact; // el impacto en derechos no baja por controles preventivos

      const rationaleParts = [
        `Impacto ${impact}/5: ${impactRationale(cls, baseImpact, countBonus, groupBonus)}`,
        `Probabilidad ${probability}/5: ${
          activeVulns.length > 0
            ? `vulnerabilidades presentes — ${activeVulns.map(vulnerabilityLabel).join("; ")}`
            : "no se detectaron vulnerabilidades asociadas; se mantiene la probabilidad mínima porque ningún control elimina el riesgo por completo"
        }`,
      ];
      if (mitigating > 0) {
        rationaleParts.push(
          `Riesgo residual: ${mitigating} control(es) implementado(s) reducen la probabilidad a ${residualProbability}/5.`,
        );
      }

      scenarios.push({
        templateKey: tpl.key,
        classificationId: cls.id,
        entityName: cls.entityName,
        title: tpl.title,
        dimension: tpl.dimension,
        threatCommunity: tpl.threatCommunity,
        attackVector: tpl.attackVector,
        vulnerabilities: activeVulns,
        legalBasis: tpl.legalBasis,
        probability,
        impact,
        residualProbability,
        residualImpact,
        level: riskLevel(residualProbability, residualImpact),
        rationale: rationaleParts.join(" | "),
      });
    }
  }

  return scenarios;
}

function impactRationale(
  cls: ClassificationInput,
  base: number,
  countBonus: number,
  groupBonus: number,
): string {
  const parts: string[] = [];
  const sensitive = cls.dataCategories.filter((c) => DP_SENSITIVE_CATEGORIES.includes(c));
  if (sensitive.length > 0) {
    parts.push(`el activo trata categorías especiales del art. 25 LOPDP (${sensitive.join(", ")})`);
  } else {
    parts.push(`categorías tratadas: ${cls.dataCategories.join(", ") || "sin categorías declaradas"}`);
  }
  if (countBonus > 0) parts.push(`volumen de titulares ${cls.subjectCountRange} (+${countBonus})`);
  if (groupBonus > 0) parts.push("afecta a grupos especialmente vulnerables (art. 40.2) (+1)");
  parts.push(`impacto base ${base}/5`);
  return parts.join("; ");
}

// ============================================================================
// ETAPA 4 — EVALUACIÓN: calificación de riesgo
// ============================================================================

const LEVEL_WEIGHT: Record<DpRiskLevel, number> = { muy_alto: 4, alto: 3, medio: 2, bajo: 1 };

/**
 * Calificación de riesgo 0-100 (MENOS es mejor).
 * Promedio ponderado por nivel: los escenarios altos dominan el resultado, de
 * modo que un puñado de riesgos muy altos no se diluye entre muchos bajos.
 */
export function computeRiskScore(
  scenarios: Array<{ residualProbability: number; residualImpact: number; level: DpRiskLevel; status?: string }>,
): number {
  const active = scenarios.filter((s) => s.status !== "accepted" && s.status !== "avoided");
  if (active.length === 0) return 0;

  let weighted = 0;
  let weights = 0;
  for (const s of active) {
    const w = LEVEL_WEIGHT[s.level];
    const norm = (s.residualProbability * s.residualImpact - 1) / 24; // P×I ∈ [1,25] → [0,1]
    weighted += w * norm;
    weights += w;
  }
  return Math.round((100 * weighted) / weights * 100) / 100;
}

export function riskGrade(score: number): DpGrade {
  if (score <= 20) return "A";
  if (score <= 40) return "B";
  if (score <= 60) return "C";
  if (score <= 80) return "D";
  return "E";
}

// ============================================================================
// ETAPA 5 — TRATAMIENTO: catálogo de controles / plan de acción
// ============================================================================

export interface ControlDef {
  key: string;
  category: DpActionCategory;
  title: string;
  description: string;
  legalBasis: string;
  effort: "minutos" | "horas" | "dias";
  compliancePoints: number;
  riskReduction: { p?: number; i?: number };
  /** Ítem de la checklist de cumplimiento que satisface. */
  complianceKey?: string;
  /** Documento que resuelve la acción, si aplica. */
  docType?: DpDocType;
  /** Solo se propone si estas condiciones se cumplen. */
  onlyIfHighRisk?: boolean;
  onlyIfProcessor?: boolean;
  onlyIfDpoRequired?: boolean;
}

export const CONTROL_CATALOG: ControlDef[] = [
  {
    key: "J01", category: "juridica", complianceKey: "base_legal",
    title: "Identificar la base legal de cada tratamiento",
    description:
      "Define para cada finalidad si el tratamiento se legitima en consentimiento, contrato, obligación legal o interés legítimo. Sin base legal el tratamiento es ilegítimo y constituye infracción.",
    legalBasis: "Art. 7 LOPDP", effort: "horas", compliancePoints: 12, riskReduction: { p: 1 },
  },
  {
    key: "J02", category: "juridica", complianceKey: "rat", docType: "rat",
    title: "Generar el Registro de Actividades de Tratamiento (RAT)",
    description:
      "Documento obligatorio que describe cada actividad de tratamiento: finalidad, categorías de datos y de titulares, activos, encargados, plazos y medidas. Debe revisarse cada 6 meses.",
    legalBasis: "Art. 37 LOPDP", effort: "horas", compliancePoints: 12, riskReduction: { p: 1 },
  },
  {
    key: "J03", category: "juridica", complianceKey: "politica", docType: "privacy_policy",
    title: "Publicar la política de protección de datos personales",
    description:
      "Aviso de privacidad accesible a los titulares con finalidades, bases legales, plazos de conservación, destinatarios y cómo ejercer sus derechos.",
    legalBasis: "Arts. 10 y 11 LOPDP", effort: "horas", compliancePoints: 10, riskReduction: { p: 1 },
  },
  {
    key: "J04", category: "juridica", complianceKey: "consentimiento", docType: "consent",
    title: "Implementar formularios de consentimiento",
    description:
      "Donde la base legal sea el consentimiento, este debe ser libre, específico, informado e inequívoco, y revocable con la misma facilidad con que se otorgó.",
    legalBasis: "Art. 8 LOPDP", effort: "horas", compliancePoints: 10, riskReduction: { p: 1 },
  },
  {
    key: "J05", category: "juridica", complianceKey: "encargos", docType: "dpa",
    title: "Firmar contratos de encargo con los proveedores",
    description:
      "Todo proveedor que trate datos por cuenta de la empresa necesita contrato con instrucciones documentadas, confidencialidad, medidas de seguridad, prohibición de subencargo sin autorización y devolución/eliminación al final.",
    legalBasis: "Art. 28 LOPDP", effort: "dias", compliancePoints: 12, riskReduction: { p: 1 },
  },
  {
    key: "J06", category: "juridica", complianceKey: "arco", docType: "arco",
    title: "Habilitar el canal de derechos ARCO-PL",
    description:
      "Canal visible (correo o formulario) y procedimiento interno para atender acceso, rectificación, eliminación, oposición, portabilidad y limitación. El titular tiene derecho a respuesta en 10 días término.",
    legalBasis: "Arts. 12-22 y 62 LOPDP", effort: "horas", compliancePoints: 10, riskReduction: { p: 1 },
  },
  {
    key: "J07", category: "juridica", complianceKey: "eipdp", docType: "eipdp", onlyIfHighRisk: true,
    title: "Realizar la Evaluación de Impacto (EIPDP)",
    description:
      "Obligatoria cuando el tratamiento implica alto riesgo (datos sensibles, grupos vulnerables, perfilamiento o transferencias internacionales). Su ausencia es infracción muy grave.",
    legalBasis: "Arts. 40-42 LOPDP", effort: "dias", compliancePoints: 10, riskReduction: { p: 1, i: 1 },
  },
  {
    key: "J08", category: "juridica", complianceKey: "brechas", docType: "breach_protocol",
    title: "Documentar el protocolo de vulneraciones (72 horas)",
    description:
      "Procedimiento de contención, evaluación, notificación a la SPDP dentro de 72 horas y comunicación a los titulares sin dilación indebida.",
    legalBasis: "Arts. 43-46 LOPDP", effort: "horas", compliancePoints: 8, riskReduction: { i: 1 },
  },
  {
    key: "J09", category: "juridica", complianceKey: "dpd", onlyIfDpoRequired: true,
    title: "Designar y registrar al Delegado de Protección de Datos",
    description:
      "Obligatorio cuando se tratan datos sensibles a gran escala o el tratamiento es la actividad principal. Debe registrarse ante la SPDP.",
    legalBasis: "Arts. 47-49 LOPDP; Res. SPDP-SPD-2025-0028-R", effort: "dias", compliancePoints: 4, riskReduction: { p: 1 },
  },
  {
    key: "O01", category: "organizacional", complianceKey: "capacitacion",
    title: "Capacitar al personal en protección de datos",
    description:
      "Capacitación anual mínima. La negligencia por falta de capacitación no exime de responsabilidad: evidencia una vulnerabilidad organizacional.",
    legalBasis: "Art. 49 LOPDP", effort: "dias", compliancePoints: 4, riskReduction: { p: 1 },
  },
  {
    key: "O02", category: "organizacional", complianceKey: "tecnicas",
    title: "Implementar control de accesos por rol (mínimo privilegio)",
    description:
      "Cada persona accede solo a los datos que necesita para su función. Revisar permisos periódicamente y retirarlos al terminar la relación laboral.",
    legalBasis: "Art. 38 LOPDP; ISO/IEC 27002:2022 cl. 5.15", effort: "horas", compliancePoints: 3, riskReduction: { p: 1 },
  },
  {
    key: "O03", category: "organizacional",
    title: "Aprobar la política interna de seguridad de la información",
    description: "Reglas de uso de equipos, contraseñas, respaldos, escritorio limpio y manejo de información confidencial.",
    legalBasis: "Arts. 37-39 LOPDP", effort: "horas", compliancePoints: 2, riskReduction: { p: 1 },
  },
  {
    key: "O04", category: "organizacional",
    title: "Firmar acuerdos de confidencialidad con el personal",
    description: "El deber de secreto subsiste incluso después de terminada la relación con el titular de los datos.",
    legalBasis: "Art. 38 LOPDP", effort: "horas", compliancePoints: 2, riskReduction: { p: 1 },
  },
  {
    key: "T01", category: "tecnica", complianceKey: "tecnicas",
    title: "Implementar respaldos probados y verificados",
    description:
      "Copias periódicas, cifradas y con restauración probada. Es el control que convierte una vulneración de disponibilidad en un incidente temporal en lugar de una pérdida definitiva.",
    legalBasis: "Art. 37 LOPDP", effort: "horas", compliancePoints: 3, riskReduction: { p: 1, i: 1 },
  },
  {
    key: "T02", category: "tecnica", complianceKey: "tecnicas",
    title: "Cifrar los datos personales en reposo y en tránsito",
    description:
      "El cifrado con algoritmos seguros reduce el impacto de un acceso no autorizado y es una medida expresamente valorada por la autoridad.",
    legalBasis: "Arts. 37-39 LOPDP", effort: "horas", compliancePoints: 3, riskReduction: { p: 1, i: 1 },
  },
  {
    key: "T03", category: "tecnica", complianceKey: "tecnicas",
    title: "Activar autenticación de múltiples factores (MFA)",
    description: "MFA en correo, sistemas de gestión y accesos administrativos: corta la mayoría de ataques por credenciales robadas.",
    legalBasis: "Art. 37 LOPDP", effort: "minutos", compliancePoints: 3, riskReduction: { p: 1 },
  },
  {
    key: "T04", category: "tecnica",
    title: "Mantener antivirus y actualizaciones al día",
    description: "Protección de endpoints y parcheo de sistemas operativos y aplicaciones.",
    legalBasis: "Art. 37 LOPDP", effort: "horas", compliancePoints: 2, riskReduction: { p: 1 },
  },
  {
    key: "T05", category: "tecnica",
    title: "Proteger los equipos con contraseña y bloqueo automático",
    description: "Especialmente en portátiles y dispositivos móviles que salen de la oficina.",
    legalBasis: "Art. 37 LOPDP", effort: "minutos", compliancePoints: 2, riskReduction: { p: 1 },
  },
  {
    key: "T06", category: "tecnica",
    title: "Habilitar registros de auditoría (logs) de accesos",
    description: "Permiten detectar accesos indebidos y son la evidencia de trazabilidad que pide la autoridad.",
    legalBasis: "Art. 39 LOPDP", effort: "horas", compliancePoints: 2, riskReduction: { p: 1 },
  },
  {
    key: "J05P", category: "juridica", docType: "dpa_processor", onlyIfProcessor: true,
    title: "Formalizar tu rol de encargado ante tus clientes",
    description:
      "Si tratas datos por cuenta de tus clientes (típico en estudios contables), necesitas el contrato espejo que documente sus instrucciones y tus obligaciones.",
    legalBasis: "Art. 28 LOPDP", effort: "dias", compliancePoints: 0, riskReduction: { p: 1 },
  },
];

// ============================================================================
// CHECKLIST DE CUMPLIMIENTO (calificación LOPDP)
// ============================================================================

export interface ComplianceCheckDef {
  key: string;
  label: string;
  legalBasis: string;
  weight: number;
  /** Documento cuya publicación satisface el ítem (50 % si solo está generado). */
  docType?: DpDocType;
  /** Control cuya implementación satisface el ítem. */
  controlKeys?: string[];
  conditional?: "high_risk" | "dpo_required";
}

export const COMPLIANCE_CHECKS: ComplianceCheckDef[] = [
  { key: "base_legal", label: "Base legal identificada para cada tratamiento", legalBasis: "Art. 7 LOPDP", weight: 12, controlKeys: ["J01"] },
  { key: "rat", label: "Registro de Actividades de Tratamiento vigente", legalBasis: "Art. 37 LOPDP", weight: 12, docType: "rat", controlKeys: ["J02"] },
  { key: "politica", label: "Política de protección de datos publicada", legalBasis: "Arts. 10-11 LOPDP", weight: 10, docType: "privacy_policy", controlKeys: ["J03"] },
  { key: "consentimiento", label: "Consentimientos implementados", legalBasis: "Art. 8 LOPDP", weight: 10, docType: "consent", controlKeys: ["J04"] },
  { key: "encargos", label: "Contratos de encargo con proveedores", legalBasis: "Art. 28 LOPDP", weight: 12, docType: "dpa", controlKeys: ["J05"] },
  { key: "arco", label: "Canal y procedimiento de derechos ARCO-PL", legalBasis: "Arts. 12-22, 62 LOPDP", weight: 10, docType: "arco", controlKeys: ["J06"] },
  { key: "eipdp", label: "Evaluación de impacto (EIPDP) realizada", legalBasis: "Arts. 40-42 LOPDP", weight: 10, docType: "eipdp", controlKeys: ["J07"], conditional: "high_risk" },
  { key: "brechas", label: "Protocolo de vulneraciones (72 horas)", legalBasis: "Arts. 43-46 LOPDP", weight: 8, docType: "breach_protocol", controlKeys: ["J08"] },
  { key: "tecnicas", label: "Medidas técnicas mínimas (cifrado, respaldos, accesos, MFA)", legalBasis: "Arts. 37-39 LOPDP", weight: 8, controlKeys: ["T01", "T02", "T03", "O02"] },
  { key: "dpd", label: "Delegado de Protección de Datos designado y registrado", legalBasis: "Arts. 47-49 LOPDP", weight: 4, controlKeys: ["J09"], conditional: "dpo_required" },
  { key: "capacitacion", label: "Personal capacitado (último año)", legalBasis: "Art. 49 LOPDP", weight: 4, controlKeys: ["O01"] },
];

export interface ComplianceContext {
  questionnaire: Record<string, any>;
  completedControls: string[];
  /** doc_type → estado del documento más reciente. */
  documents: Record<string, "draft" | "generated" | "published">;
  highRisk: boolean;
  dpoRequired: boolean;
  /** Solicitudes de titulares vencidas: penalizan el ítem ARCO. */
  overdueRequests: number;
}

/**
 * Calificación de cumplimiento 0-100 (MÁS es mejor).
 * Reglas anti-inflación: un documento generado pero no publicado vale la mitad;
 * los ítems que no aplican redistribuyen su peso al resto (pro rata).
 */
export function computeComplianceScore(ctx: ComplianceContext): {
  score: number;
  items: DpComplianceItem[];
} {
  const applicable = COMPLIANCE_CHECKS.filter((c) => {
    if (c.conditional === "high_risk") return ctx.highRisk;
    if (c.conditional === "dpo_required") return ctx.dpoRequired;
    return true;
  });

  const totalWeight = applicable.reduce((sum, c) => sum + c.weight, 0);
  const items: DpComplianceItem[] = [];
  let earnedTotal = 0;

  for (const check of applicable) {
    let ratio = 0;
    const details: string[] = [];

    if (check.controlKeys && check.controlKeys.length > 0) {
      const done = check.controlKeys.filter((k) => ctx.completedControls.includes(k));
      ratio = done.length / check.controlKeys.length;
      if (done.length > 0) details.push(`${done.length}/${check.controlKeys.length} controles implementados`);
    }

    if (check.docType) {
      const docState = ctx.documents[check.docType];
      const docRatio = docState === "published" ? 1 : docState ? 0.5 : 0;
      if (docRatio > ratio) ratio = docRatio;
      if (docState === "published") details.push("documento publicado");
      else if (docState) details.push("documento generado pero no publicado (50 %)");
    }

    // Una solicitud de titular vencida demuestra que el canal ARCO no funciona
    // en la práctica: el criterio de la Guía es el "SER", no el "DEBER SER".
    if (check.key === "arco" && ctx.overdueRequests > 0) {
      ratio = Math.min(ratio, 0.5);
      details.push(`${ctx.overdueRequests} solicitud(es) vencida(s): el canal no cumple en la práctica`);
    }

    const earned = Math.round(check.weight * ratio * 100) / 100;
    earnedTotal += earned;
    items.push({
      key: check.key,
      label: check.label,
      legalBasis: check.legalBasis,
      weight: check.weight,
      earned,
      satisfied: ratio >= 1,
      partial: ratio > 0 && ratio < 1,
      detail: details.join("; ") || "sin evidencia registrada",
    });
  }

  const score = totalWeight > 0 ? Math.round((earnedTotal / totalWeight) * 10000) / 100 : 0;
  return { score, items };
}

export function complianceGrade(score: number): DpGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "E";
}

// ============================================================================
// MULTA POTENCIAL ESTIMADA (arts. 67-71, 80-83 LOPDP)
// ============================================================================

const REVENUE_MIDPOINT: Record<string, number> = {
  "<100k": 60000,
  "100k-500k": 300000,
  "500k-1m": 750000,
  ">1m": 1500000,
};

/**
 * Determina la infracción más grave detectada y estima el rango de multa.
 * Las sanciones se calculan sobre la facturación anual: 0.1 %-0.7 % (graves) y
 * 0.7 %-1 % (muy graves). Es una ESTIMACIÓN referencial, no una liquidación.
 */
export function estimateFine(
  items: DpComplianceItem[],
  highRisk: boolean,
  revenueRange: string | null,
): { min: number; max: number; worst: DpInfractionLevel | null } {
  const missing = (key: string) => {
    const item = items.find((i) => i.key === key);
    return !item || !item.satisfied;
  };

  let worst: DpInfractionLevel | null = null;

  // Muy graves: EIPDP ausente en alto riesgo, o datos sensibles sin consentimiento.
  if ((highRisk && missing("eipdp")) || (highRisk && missing("consentimiento"))) {
    worst = "muy_grave";
  } else if (missing("tecnicas") || missing("encargos") || missing("base_legal") || missing("arco")) {
    // Graves: falta de medidas de seguridad, sin contratos de encargo,
    // tratamiento sin base legal, no respetar derechos del titular.
    worst = "grave";
  } else if (missing("politica") || missing("rat") || missing("brechas")) {
    worst = "leve";
  }

  if (!worst) return { min: 0, max: 0, worst: null };

  const revenue = REVENUE_MIDPOINT[revenueRange ?? ""] ?? 60000;
  if (worst === "muy_grave") return { min: revenue * 0.007, max: revenue * 0.01, worst };
  if (worst === "grave") return { min: revenue * 0.001, max: revenue * 0.007, worst };
  return { min: revenue * 0.0005, max: revenue * 0.001, worst };
}

// ============================================================================
// ANÁLISIS CUANTITATIVO OPCIONAL (ALE y VaR 90 %)
// ============================================================================

/**
 * Pérdida anual esperada y valor al riesgo con distribución triangular.
 * ALE = λ × E(impacto), con E = (a+m+b)/3.
 * VaR 90 %: percentil 90 de la triangular, escalado por la frecuencia.
 * Fórmula cerrada en lugar de Monte Carlo: mismo resultado esperado, sin
 * dependencias ni variabilidad entre ejecuciones (los informes deben ser
 * reproducibles ante la autoridad).
 */
export function quantitativeRisk(
  frequency: number,
  min: number,
  likely: number,
  max: number,
): { ale: number; var90: number } {
  if (!(frequency > 0) || !(max > min)) return { ale: 0, var90: 0 };
  const expected = (min + likely + max) / 3;
  const ale = frequency * expected;

  const p = 0.9;
  const fc = (likely - min) / (max - min); // punto de corte de la CDF
  const percentile =
    p < fc
      ? min + Math.sqrt(p * (max - min) * (likely - min))
      : max - Math.sqrt((1 - p) * (max - min) * (max - likely));

  return {
    ale: Math.round(ale * 100) / 100,
    var90: Math.round(percentile * Math.max(1, frequency) * 100) / 100,
  };
}

/** Retorno de la inversión en seguridad (ENISA/Guía SPDP §5.3). */
export function rosi(lossReduction: number, controlCost: number): number {
  if (controlCost <= 0) return 0;
  return Math.round(((lossReduction - controlCost) / controlCost) * 100);
}

// ============================================================================
// PLAZOS LEGALES
// ============================================================================

/** Feriados nacionales de Ecuador (fijos + los movibles más comunes). */
const ECUADOR_HOLIDAYS_MMDD = ["01-01", "05-01", "05-24", "08-10", "10-09", "11-02", "11-03", "12-25"];

function isBusinessDay(date: Date): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mmdd = `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return !ECUADOR_HOLIDAYS_MMDD.includes(mmdd);
}

/**
 * Suma días TÉRMINO (hábiles) — el plazo del art. 62 LOPDP para responder al
 * titular es de 10 días término, no días calendario.
 */
export function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start.getTime());
  let added = 0;
  while (added < days) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isBusinessDay(result)) added++;
  }
  return result;
}

/** Días hábiles restantes hasta la fecha límite (negativo si ya venció). */
export function businessDaysLeft(due: Date, from: Date = new Date()): number {
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()));
  if (end.getTime() === start.getTime()) return 0;

  const forward = end > start;
  let count = 0;
  const cursor = new Date(forward ? start : end);
  const limit = forward ? end : start;
  while (cursor < limit) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor)) count++;
  }
  return forward ? count : -count;
}

/** Plazo del art. 62 LOPDP: 10 días término desde la recepción. */
export function titularRequestDueDate(receivedAt: Date): Date {
  return addBusinessDays(receivedAt, 10);
}

/** Plazo del art. 43 LOPDP: 72 horas para notificar a la SPDP. */
export function incidentSpdpDeadline(detectedAt: Date): Date {
  return new Date(detectedAt.getTime() + 72 * 60 * 60 * 1000);
}

// ============================================================================
// UTILIDADES DE CONTEXTO
// ============================================================================

/** Alto riesgo = datos sensibles, menores, o grupos vulnerables (art. 42). */
export function isHighRiskTreatment(classifications: ClassificationInput[]): boolean {
  return classifications.some(
    (c) =>
      c.hasPersonalData &&
      (c.dataCategories.some((cat) => DP_SENSITIVE_CATEGORIES.includes(cat)) ||
        c.storageLocation === "nube_ext" ||
        c.subjectCountRange === ">10000"),
  );
}

/** DPD obligatorio: datos sensibles a gran escala o tratamiento como actividad principal. */
export function isDpoRequired(
  classifications: ClassificationInput[],
  questionnaire: Record<string, any>,
): boolean {
  if (questionnaire.treatmentIsCoreActivity === true) return true;
  return classifications.some(
    (c) =>
      c.hasPersonalData &&
      c.dataCategories.some((cat) => DP_SENSITIVE_CATEGORIES.includes(cat)) &&
      (c.subjectCountRange === "1000-10000" || c.subjectCountRange === ">10000"),
  );
}

/**
 * Construye el plan de acción a partir de los gaps detectados.
 * Prioridad = puntos de cumplimiento / esfuerzo: primero lo que más sube la
 * calificación con menos trabajo (compromiso encadenado).
 */
export function buildActionPlan(
  questionnaire: Record<string, any>,
  highRisk: boolean,
  dpoRequired: boolean,
  isProcessor: boolean,
): Array<ControlDef & { priority: number }> {
  const present = new Set(presentVulnerabilities(questionnaire));
  const effortWeight = { minutos: 1, horas: 3, dias: 8 };

  return CONTROL_CATALOG.filter((c) => {
    if (c.onlyIfHighRisk && !highRisk) return false;
    if (c.onlyIfDpoRequired && !dpoRequired) return false;
    if (c.onlyIfProcessor && !isProcessor) return false;
    // Solo se propone lo que falta (los controles cuya vulnerabilidad está presente).
    return c.key === "J05P" ? true : present.has(c.key);
  })
    .map((c) => ({
      ...c,
      priority: Math.round(((c.compliancePoints + 1) / effortWeight[c.effort]) * 100),
    }))
    .sort((a, b) => b.priority - a.priority);
}
