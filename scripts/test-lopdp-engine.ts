/**
 * PRUEBAS UNITARIAS DEL MOTOR LOPDP (sin base de datos)
 *
 * Verifican que el cálculo de riesgo, cumplimiento, multas y plazos legales sea
 * correcto y DETERMINISTA. Si estas pruebas fallan, los informes que se
 * entregan a la Superintendencia estarían mal.
 *
 * Ejecutar:  npx tsx scripts/test-lopdp-engine.ts
 */
import {
  addBusinessDays,
  baseImpactForCategories,
  buildActionPlan,
  businessDaysLeft,
  complianceGrade,
  computeComplianceScore,
  computeRiskScore,
  computeScenarios,
  estimateFine,
  incidentSpdpDeadline,
  isDpoRequired,
  isHighRiskTreatment,
  presentVulnerabilities,
  quantitativeRisk,
  riskGrade,
  riskLevel,
  rosi,
  titularRequestDueDate,
  type ClassificationInput,
} from "../server/lopdp/engine";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    failures.push(name + (detail ? ` — ${detail}` : ""));
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq(name: string, actual: any, expected: any) {
  check(name, actual === expected, `esperado ${expected}, obtenido ${actual}`);
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ============================================================================
section("1. Criterios de impacto (art. 25 LOPDP y criterios de la Guía SPDP)");
// ============================================================================

eq("datos de salud → impacto máximo (5)", baseImpactForCategories(["identificativos", "salud"]), 5);
eq("datos biométricos → impacto máximo (5)", baseImpactForCategories(["biometricos"]), 5);
eq("datos de menores → impacto máximo (5)", baseImpactForCategories(["menores"]), 5);
eq("datos financieros → impacto 4", baseImpactForCategories(["identificativos", "financieros"]), 4);
eq("datos laborales → impacto 3", baseImpactForCategories(["identificativos", "laborales"]), 3);
eq("solo identificativos → impacto 2", baseImpactForCategories(["identificativos"]), 2);
eq("sin categorías → impacto 1", baseImpactForCategories([]), 1);

// ============================================================================
section("2. Matriz de niveles de riesgo");
// ============================================================================

eq("impacto máximo con probabilidad alta → muy alto", riskLevel(3, 5), "muy_alto");
eq("impacto máximo con probabilidad mínima → alto (nunca bajo)", riskLevel(1, 5), "alto");
eq("probabilidad y impacto mínimos → bajo", riskLevel(1, 1), "bajo");
eq("probabilidad 4 × impacto 4 → muy alto", riskLevel(4, 4), "muy_alto");
eq("probabilidad 2 × impacto 4 → alto", riskLevel(2, 4), "alto");
eq("probabilidad 2 × impacto 2 → medio", riskLevel(2, 2), "medio");

// ============================================================================
section("3. Identificación de vulnerabilidades");
// ============================================================================

const empresaSinNada = {};
const vulnsSinNada = presentVulnerabilities(empresaSinNada);
// 9 jurídicas (J01-J09) + 4 organizacionales (O01-O04) + 6 técnicas (T01-T06)
check("empresa sin controles → las 19 vulnerabilidades del catálogo presentes", vulnsSinNada.length === 19,
  `obtenidas ${vulnsSinNada.length}`);

const empresaCompleta: Record<string, boolean> = {};
for (const k of [
  "hasLegalBasis", "hasRat", "hasPrivacyPolicy", "hasConsent", "hasDpaContracts",
  "hasArcoChannel", "hasEipdp", "hasBreachProtocol", "hasDpo", "hasTraining",
  "hasAccessControl", "hasSecurityPolicy", "hasNda", "hasBackups", "hasEncryption",
  "hasMfa", "hasAntivirus", "hasDeviceLock", "hasAuditLogs",
]) empresaCompleta[k] = true;
eq("empresa con todo declarado → sin vulnerabilidades", presentVulnerabilities(empresaCompleta).length, 0);

check("pregunta sin responder cuenta como vulnerabilidad (criterio del 'SER')",
  presentVulnerabilities({ hasBackups: undefined }).includes("T01"));

// ============================================================================
section("4. Generación de escenarios de riesgo");
// ============================================================================

const consultorio: ClassificationInput[] = [{
  id: "cls-1",
  entityName: "Sistema de historias clínicas",
  hasPersonalData: true,
  dataCategories: ["identificativos", "contacto", "salud"],
  dataSubjects: ["pacientes"],
  subjectCountRange: "1000-10000",
  storageLocation: "local",
  isProcessorAsset: false,
}];

const escenariosMedico = computeScenarios(consultorio, {}, "salud", []);
check("consultorio médico genera escenarios", escenariosMedico.length > 0, `${escenariosMedico.length}`);
check("incluye el escenario específico de historias clínicas",
  escenariosMedico.some((s) => s.templateKey === "historia_clinica"));
check("todos los escenarios tienen justificación (exigencia de la Guía SPDP)",
  escenariosMedico.every((s) => s.rationale && s.rationale.length > 30));
check("impacto tope 5 con datos de salud + pacientes + volumen alto",
  escenariosMedico.every((s) => s.impact === 5), `impactos: ${Array.from(new Set(escenariosMedico.map((s) => s.impact))).join(",")}`);
// Con impacto 5, la matriz nunca baja de "alto" aunque la probabilidad sea mínima:
// lo que se protege son derechos, no activos (advertencia de la Guía SPDP).
check("ningún escenario con datos de salud baja de nivel alto",
  escenariosMedico.every((s) => s.level === "alto" || s.level === "muy_alto"),
  `niveles: ${Array.from(new Set(escenariosMedico.map((s) => s.level))).join(", ")}`);
check("los escenarios de salud con varias vulnerabilidades llegan a muy alto",
  escenariosMedico.some((s) => s.level === "muy_alto"));

const activoSinDatos: ClassificationInput[] = [{
  id: "cls-2", entityName: "Impresora", hasPersonalData: false,
  dataCategories: [], dataSubjects: [], subjectCountRange: null,
  storageLocation: null, isProcessorAsset: false,
}];
eq("activo sin datos personales no genera escenarios", computeScenarios(activoSinDatos, {}, "otro", []).length, 0);

// Escenarios condicionales
const nubeExterior: ClassificationInput[] = [{
  ...consultorio[0], id: "cls-3", storageLocation: "nube_ext",
}];
check("nube en el exterior activa el escenario de transferencia internacional",
  computeScenarios(nubeExterior, {}, "salud", []).some((s) => s.templateKey === "transferencia_internacional"));

const proveedorEncargado: ClassificationInput[] = [{
  ...consultorio[0], id: "cls-4", isProcessorAsset: true,
}];
check("proveedor encargado activa el escenario del art. 28",
  computeScenarios(proveedorEncargado, {}, "salud", []).some((s) => s.templateKey === "encargado_sin_contrato"));

check("el sector legal activa el escenario de secreto profesional",
  computeScenarios([{ ...consultorio[0], id: "cls-5", dataCategories: ["identificativos"] }], {}, "legal", [])
    .some((s) => s.templateKey === "secreto_profesional"));

// Determinismo
const corrida1 = computeScenarios(consultorio, {}, "salud", []);
const corrida2 = computeScenarios(consultorio, {}, "salud", []);
check("el motor es determinista (misma entrada → misma salida)",
  JSON.stringify(corrida1) === JSON.stringify(corrida2));

// Efecto de los controles
const conControles = computeScenarios(consultorio, empresaCompleta, "salud", ["T01", "T02", "T03", "O01", "O02"]);
const probSinControles = escenariosMedico.find((s) => s.templateKey === "ransomware")!.residualProbability;
const probConControles = conControles.find((s) => s.templateKey === "ransomware")!.residualProbability;
check("implementar controles baja la probabilidad residual",
  probConControles < probSinControles, `sin controles ${probSinControles}, con controles ${probConControles}`);

// ============================================================================
section("5. Calificación de riesgo");
// ============================================================================

const scoreSinControles = computeRiskScore(escenariosMedico.map((s) => ({
  residualProbability: s.residualProbability, residualImpact: s.residualImpact, level: s.level,
})));
const scoreConControles = computeRiskScore(conControles.map((s) => ({
  residualProbability: s.residualProbability, residualImpact: s.residualImpact, level: s.level,
})));

check("consultorio sin controles tiene riesgo alto", scoreSinControles > 60, `${scoreSinControles}`);
check("implementar controles reduce la calificación de riesgo",
  scoreConControles < scoreSinControles, `${scoreSinControles} → ${scoreConControles}`);
eq("sin escenarios el riesgo es 0", computeRiskScore([]), 0);

eq("riesgo 15 → letra A", riskGrade(15), "A");
eq("riesgo 35 → letra B", riskGrade(35), "B");
eq("riesgo 55 → letra C", riskGrade(55), "C");
eq("riesgo 75 → letra D", riskGrade(75), "D");
eq("riesgo 95 → letra E", riskGrade(95), "E");

check("los escenarios aceptados no cuentan en el riesgo",
  computeRiskScore([
    { residualProbability: 5, residualImpact: 5, level: "muy_alto", status: "accepted" },
  ]) === 0);

// ============================================================================
section("6. Calificación de cumplimiento LOPDP");
// ============================================================================

const cumplimientoCero = computeComplianceScore({
  questionnaire: {}, completedControls: [], documents: {},
  highRisk: true, dpoRequired: true, overdueRequests: 0,
});
eq("empresa sin nada → cumplimiento 0", cumplimientoCero.score, 0);
eq("con alto riesgo y DPD obligatorio se evalúan 11 obligaciones", cumplimientoCero.items.length, 11);

const cumplimientoTotal = computeComplianceScore({
  questionnaire: {},
  completedControls: ["J01", "J02", "J03", "J04", "J05", "J06", "J07", "J08", "J09", "O01", "O02", "T01", "T02", "T03"],
  documents: {},
  highRisk: true, dpoRequired: true, overdueRequests: 0,
});
eq("empresa con todos los controles → cumplimiento 100", cumplimientoTotal.score, 100);

const soloGenerado = computeComplianceScore({
  questionnaire: {}, completedControls: [], documents: { privacy_policy: "generated" },
  highRisk: false, dpoRequired: false, overdueRequests: 0,
});
const itemPolitica = soloGenerado.items.find((i) => i.key === "politica")!;
check("documento generado pero no publicado vale la mitad",
  itemPolitica.earned === itemPolitica.weight / 2, `${itemPolitica.earned} de ${itemPolitica.weight}`);
check("el ítem generado se marca como parcial", itemPolitica.partial === true);

const publicado = computeComplianceScore({
  questionnaire: {}, completedControls: [], documents: { privacy_policy: "published" },
  highRisk: false, dpoRequired: false, overdueRequests: 0,
});
const itemPublicado = publicado.items.find((i) => i.key === "politica")!;
check("documento publicado vale el puntaje completo", itemPublicado.earned === itemPublicado.weight);

const sinAltoRiesgo = computeComplianceScore({
  questionnaire: {}, completedControls: [], documents: {},
  highRisk: false, dpoRequired: false, overdueRequests: 0,
});
check("sin alto riesgo no se exige EIPDP", !sinAltoRiesgo.items.some((i) => i.key === "eipdp"));
check("sin obligación de DPD no se exige designarlo", !sinAltoRiesgo.items.some((i) => i.key === "dpd"));

const conVencidas = computeComplianceScore({
  questionnaire: {}, completedControls: ["J06"], documents: { arco: "published" },
  highRisk: false, dpoRequired: false, overdueRequests: 2,
});
const itemArco = conVencidas.items.find((i) => i.key === "arco")!;
check("una solicitud vencida degrada el ítem ARCO aunque el documento esté publicado",
  itemArco.earned <= itemArco.weight * 0.5, `${itemArco.earned} de ${itemArco.weight}`);

eq("cumplimiento 95 → letra A", complianceGrade(95), "A");
eq("cumplimiento 80 → letra B", complianceGrade(80), "B");
eq("cumplimiento 60 → letra C", complianceGrade(60), "C");
eq("cumplimiento 40 → letra D", complianceGrade(40), "D");
eq("cumplimiento 20 → letra E", complianceGrade(20), "E");

// ============================================================================
section("7. Multa potencial estimada (arts. 80-83 LOPDP)");
// ============================================================================

const multaMuyGrave = estimateFine(cumplimientoCero.items, true, "500k-1m");
eq("sin EIPDP con alto riesgo → infracción muy grave", multaMuyGrave.worst, "muy_grave");
check("infracción muy grave llega al 1 % de la facturación",
  Math.round(multaMuyGrave.max) === 7500, `${multaMuyGrave.max}`);

const multaCumplidor = estimateFine(cumplimientoTotal.items, true, "500k-1m");
eq("empresa que cumple todo → sin infracción", multaCumplidor.worst, null);
eq("empresa que cumple todo → multa estimada 0", multaCumplidor.max, 0);

const sinFacturacion = estimateFine(cumplimientoCero.items, true, null);
check("sin facturación declarada usa el rango mínimo de referencia", sinFacturacion.max > 0);

// ============================================================================
section("8. Análisis cuantitativo (ALE y VaR 90 %)");
// ============================================================================

// Caso del material del curso: ransomware λ=1.2, triangular (10k, 25k, 50k)
const cuantitativo = quantitativeRisk(1.2, 10000, 25000, 50000);
check("ALE del caso de estudio ≈ USD 34.000",
  Math.abs(cuantitativo.ale - 34000) < 100, `obtenido ${cuantitativo.ale}`);
check("VaR 90 % es superior al ALE", cuantitativo.var90 > cuantitativo.ale,
  `ALE ${cuantitativo.ale}, VaR ${cuantitativo.var90}`);
eq("sin frecuencia no hay cálculo cuantitativo", quantitativeRisk(0, 1, 2, 3).ale, 0);

eq("ROSI del ejemplo de la Guía (130k de reducción, 1k de costo) = 12900 %", rosi(130000, 1000), 12900);
eq("ROSI sin costo devuelve 0", rosi(1000, 0), 0);

// ============================================================================
section("9. Plazos legales");
// ============================================================================

// Lunes 6 de julio de 2026
const lunes = new Date(Date.UTC(2026, 6, 6));
const vencimiento = titularRequestDueDate(lunes);
eq("10 días término desde el lunes 6-jul-2026 → lunes 20-jul-2026",
  vencimiento.toISOString().slice(0, 10), "2026-07-20");
check("el vencimiento cae en día hábil", ![0, 6].includes(vencimiento.getUTCDay()));

// Viernes: el plazo debe saltar el fin de semana
const viernes = new Date(Date.UTC(2026, 6, 3));
const desdeViernes = addBusinessDays(viernes, 1);
eq("un día término desde el viernes cae el lunes", desdeViernes.toISOString().slice(0, 10), "2026-07-06");

// Feriado nacional: 10 de agosto de 2026 (lunes)
const antesFeriado = new Date(Date.UTC(2026, 7, 7)); // viernes 7-ago
const saltaFeriado = addBusinessDays(antesFeriado, 1);
eq("el plazo salta el feriado del 10 de agosto", saltaFeriado.toISOString().slice(0, 10), "2026-08-11");

eq("días hábiles entre el 6 y el 20 de julio de 2026", businessDaysLeft(
  new Date(Date.UTC(2026, 6, 20)), new Date(Date.UTC(2026, 6, 6))), 10);
check("una fecha pasada devuelve días negativos",
  businessDaysLeft(new Date(Date.UTC(2026, 6, 6)), new Date(Date.UTC(2026, 6, 20))) < 0);

const deteccion = new Date("2026-07-06T10:00:00Z");
eq("plazo de la SPDP = detección + 72 horas (art. 43)",
  incidentSpdpDeadline(deteccion).toISOString(), "2026-07-09T10:00:00.000Z");

// ============================================================================
section("10. Alto riesgo y obligación de designar DPD");
// ============================================================================

check("datos de salud → tratamiento de alto riesgo", isHighRiskTreatment(consultorio));
check("solo datos identificativos y poco volumen → no es alto riesgo",
  !isHighRiskTreatment([{
    id: "x", entityName: "Agenda", hasPersonalData: true,
    dataCategories: ["identificativos"], dataSubjects: ["clientes"],
    subjectCountRange: "<100", storageLocation: "local", isProcessorAsset: false,
  }]));
check("nube en el exterior convierte el tratamiento en alto riesgo",
  isHighRiskTreatment([{
    id: "x", entityName: "CRM", hasPersonalData: true,
    dataCategories: ["identificativos"], dataSubjects: ["clientes"],
    subjectCountRange: "<100", storageLocation: "nube_ext", isProcessorAsset: false,
  }]));

check("datos sensibles a gran escala → DPD obligatorio", isDpoRequired(consultorio, {}));
check("el tratamiento como actividad principal → DPD obligatorio",
  isDpoRequired([], { treatmentIsCoreActivity: true }));
check("consultorio pequeño sin gran escala → DPD no obligatorio",
  !isDpoRequired([{ ...consultorio[0], subjectCountRange: "<100" }], {}));

// ============================================================================
section("11. Plan de acción");
// ============================================================================

const plan = buildActionPlan({}, true, true, false);
check("empresa sin controles recibe un plan de acción completo", plan.length >= 19, `${plan.length} acciones`);
check("el plan viene ordenado por prioridad (impacto/esfuerzo)",
  plan.every((a, i) => i === 0 || plan[i - 1].priority >= a.priority));
check("MFA aparece antes que designar al DPD (más impacto, menos esfuerzo)",
  plan.findIndex((a) => a.key === "T03") < plan.findIndex((a) => a.key === "J09"));

const planSinAltoRiesgo = buildActionPlan({}, false, false, false);
check("sin alto riesgo no se pide la EIPDP", !planSinAltoRiesgo.some((a) => a.key === "J07"));
check("sin obligación de DPD no se pide designarlo", !planSinAltoRiesgo.some((a) => a.key === "J09"));

const planEncargado = buildActionPlan({}, false, false, true);
check("quien actúa como encargado recibe el contrato espejo (art. 28)",
  planEncargado.some((a) => a.key === "J05P"));

const planCumplidor = buildActionPlan(empresaCompleta, false, false, false);
eq("empresa que ya cumple todo no recibe acciones pendientes", planCumplidor.length, 0);

// ============================================================================
console.log(`\n${"=".repeat(64)}`);
console.log(`RESULTADO: ${passed} pruebas superadas, ${failed} fallidas`);
if (failed > 0) {
  console.log("\nFallos:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log("Todas las pruebas del motor LOPDP pasaron.");
