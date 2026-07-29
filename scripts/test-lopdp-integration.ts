/**
 * PRUEBA DE INTEGRACIÓN DEL MÓDULO LOPDP (contra base de datos real)
 *
 * Carga 5 empresas de los perfiles objetivo (contador, médico, odontólogo,
 * abogado y pyme general) con sus activos, y ejecuta el flujo completo:
 * clasificación → motor de riesgos → calificaciones → plan de acción →
 * documentos legales → Modo Defensa (solicitudes, incidentes, SPDP).
 *
 * Ejecutar contra una base DE PRUEBAS:
 *   DATABASE_URL=postgres://... npx tsx scripts/test-lopdp-integration.ts
 *
 * ⚠️ Crea datos. No apuntar a producción salvo que se quiera sembrar la demo
 * (usar --seed-only para solo cargar las empresas sin ejecutar aserciones).
 */
import { pool } from "../server/db";
import { lopdpStorage } from "../server/storage-lopdp";

const SEED_ONLY = process.argv.includes("--seed-only");
const PREFIX = process.env.LOPDP_DEMO_PREFIX ?? "DEMO LOPDP";

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
const section = (t: string) => console.log(`\n${t}`);

// ============================================================================
// DATOS DE LAS 5 EMPRESAS DEMO
// ============================================================================

interface DemoAsset { name: string; type: string; model?: string; monthlyCost?: number }
interface DemoCompany {
  key: string;
  name: string;
  ruc: string;
  sector: string;
  revenue: string;
  isProcessor: boolean;
  legalRep: string;
  assets: DemoAsset[];
  licenses: Array<{ name: string; vendor: string }>;
  contracts: Array<{ name: string; vendor: string; type: string }>;
  /** Respuestas del cuestionario: lo que la empresa YA tiene implementado. */
  questionnaire: Record<string, any>;
  classify: Record<string, { categories: string[]; subjects: string[]; count: string; storage: string; processor?: boolean }>;
}

const COMPANIES: DemoCompany[] = [
  {
    key: "contador",
    name: `${PREFIX} — Estudio Contable Andrade & Asociados`,
    ruc: "1791234567001",
    sector: "contable",
    revenue: "100k-500k",
    isProcessor: true,
    legalRep: "María Andrade Vélez",
    assets: [
      { name: "Laptop contabilidad principal", type: "physical", model: "Dell Latitude 5540" },
      { name: "Servidor de archivos tributarios", type: "physical", model: "HP ProLiant ML30" },
      { name: "Sistema contable de clientes", type: "application" },
      { name: "Portal de nómina de clientes", type: "application" },
      { name: "Impresora multifunción", type: "physical", model: "Epson L6270" },
    ],
    licenses: [
      { name: "Microsoft 365 Business", vendor: "Microsoft" },
      { name: "Sistema de facturación electrónica", vendor: "Bflash" },
    ],
    contracts: [
      { name: "Servicio de nube contable", vendor: "Contifico", type: "software" },
      { name: "Soporte informático externo", vendor: "TecnoSoporte Cía. Ltda.", type: "servicio" },
    ],
    questionnaire: {
      hasBackups: true, hasAntivirus: true, hasDeviceLock: true,
      treatmentIsCoreActivity: true,
      purposes: [
        { name: "Contabilidad y declaraciones tributarias de clientes", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Procesamiento de nómina por cuenta de clientes", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Facturación propia", basis: "Obligación legal (art. 7.4)" },
      ],
    },
    classify: {
      "Laptop contabilidad principal": { categories: ["identificativos", "financieros"], subjects: ["clientes"], count: "100-1000", storage: "local" },
      "Servidor de archivos tributarios": { categories: ["identificativos", "financieros", "laborales"], subjects: ["clientes", "terceros"], count: "1000-10000", storage: "local" },
      "Sistema contable de clientes": { categories: ["identificativos", "financieros"], subjects: ["clientes"], count: "1000-10000", storage: "nube_ext" },
      "Portal de nómina de clientes": { categories: ["identificativos", "laborales", "financieros"], subjects: ["terceros"], count: "1000-10000", storage: "nube_ext" },
      "Impresora multifunción": { categories: [], subjects: [], count: "<100", storage: "local" },
      "Microsoft 365 Business": { categories: ["identificativos", "contacto"], subjects: ["clientes", "empleados"], count: "100-1000", storage: "nube_ext" },
      "Sistema de facturación electrónica": { categories: ["identificativos", "financieros"], subjects: ["clientes"], count: "1000-10000", storage: "nube_ec" },
      "Servicio de nube contable": { categories: ["identificativos", "financieros"], subjects: ["clientes"], count: "1000-10000", storage: "nube_ext", processor: true },
      "Soporte informático externo": { categories: ["identificativos"], subjects: ["empleados"], count: "<100", storage: "local", processor: true },
    },
  },
  {
    key: "medico",
    name: `${PREFIX} — Centro Médico Vida Sana`,
    ruc: "1792345678001",
    sector: "salud",
    revenue: "500k-1m",
    isProcessor: false,
    legalRep: "Dr. Carlos Jaramillo Ortiz",
    assets: [
      { name: "Sistema de historias clínicas", type: "application" },
      { name: "Servidor de imágenes médicas", type: "physical", model: "Dell PowerEdge T350" },
      { name: "Laptop de consultorio 1", type: "physical", model: "Lenovo ThinkPad E14" },
      { name: "Laptop de consultorio 2", type: "physical", model: "Lenovo ThinkPad E14" },
      { name: "Equipo de rayos X digital", type: "physical", model: "Siemens Multix" },
      { name: "Portal de agendamiento de pacientes", type: "application" },
    ],
    licenses: [
      { name: "Software de laboratorio clínico", vendor: "LabSoft" },
      { name: "Antivirus corporativo", vendor: "ESET" },
    ],
    contracts: [
      { name: "Laboratorio externo de análisis", vendor: "Laboratorios NetLab", type: "servicio" },
      { name: "Hosting de historias clínicas", vendor: "AWS", type: "infraestructura" },
    ],
    questionnaire: {
      hasAntivirus: true, hasDeviceLock: true, hasBackups: true,
      clinicalRecordsDigital: true,
      purposes: [
        { name: "Atención médica e historia clínica", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Agendamiento y recordatorios de citas", basis: "Consentimiento del titular (art. 7.1)" },
        { name: "Facturación de servicios de salud", basis: "Obligación legal (art. 7.4)" },
      ],
    },
    classify: {
      "Sistema de historias clínicas": { categories: ["identificativos", "contacto", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "nube_ext" },
      "Servidor de imágenes médicas": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "local" },
      "Laptop de consultorio 1": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "local" },
      "Laptop de consultorio 2": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "local" },
      "Equipo de rayos X digital": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "local" },
      "Portal de agendamiento de pacientes": { categories: ["identificativos", "contacto"], subjects: ["pacientes"], count: ">10000", storage: "nube_ext" },
      "Software de laboratorio clínico": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "nube_ec" },
      "Antivirus corporativo": { categories: [], subjects: [], count: "<100", storage: "local" },
      "Laboratorio externo de análisis": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "nube_ec", processor: true },
      "Hosting de historias clínicas": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "nube_ext", processor: true },
    },
  },
  {
    key: "odontologo",
    name: `${PREFIX} — Clínica Odontológica Sonrisa`,
    ruc: "1793456789001",
    sector: "odontologia",
    revenue: "100k-500k",
    isProcessor: false,
    legalRep: "Od. Paola Cevallos MuÑoz",
    assets: [
      { name: "Software de fichas odontológicas", type: "application" },
      { name: "Computador de recepción", type: "physical", model: "HP Pavilion" },
      { name: "Escáner intraoral", type: "physical", model: "3Shape TRIOS" },
      { name: "Radiografía panorámica digital", type: "physical", model: "Vatech PaX-i" },
    ],
    licenses: [{ name: "Software de diseño de sonrisa", vendor: "Exocad" }],
    contracts: [{ name: "Laboratorio dental externo", vendor: "Dental Lab Quito", type: "servicio" }],
    questionnaire: {
      hasDeviceLock: true,
      clinicalRecordsDigital: true,
      purposes: [
        { name: "Atención odontológica y ficha clínica", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Recordatorio de citas y controles", basis: "Consentimiento del titular (art. 7.1)" },
      ],
    },
    classify: {
      "Software de fichas odontológicas": { categories: ["identificativos", "contacto", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "local" },
      "Computador de recepción": { categories: ["identificativos", "contacto"], subjects: ["pacientes"], count: "1000-10000", storage: "local" },
      "Escáner intraoral": { categories: ["identificativos", "salud", "biometricos"], subjects: ["pacientes"], count: "100-1000", storage: "local" },
      "Radiografía panorámica digital": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "local" },
      "Software de diseño de sonrisa": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "nube_ext" },
      "Laboratorio dental externo": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "local", processor: true },
    },
  },
  {
    key: "abogado",
    name: `${PREFIX} — Estudio Jurídico Herrera & Peña`,
    ruc: "1794567890001",
    sector: "legal",
    revenue: "100k-500k",
    isProcessor: false,
    legalRep: "Ab. Diego Herrera Salazar",
    assets: [
      { name: "Gestor de expedientes de clientes", type: "application" },
      { name: "Servidor de documentos legales", type: "physical", model: "Synology DS923+" },
      { name: "Laptop socio principal", type: "physical", model: "MacBook Pro 14" },
      { name: "Laptop asociado", type: "physical", model: "Dell XPS 13" },
    ],
    licenses: [
      { name: "Base de datos jurídica", vendor: "Lexis" },
      { name: "Firma electrónica", vendor: "Security Data" },
    ],
    contracts: [{ name: "Almacenamiento en la nube", vendor: "Google Workspace", type: "software" }],
    questionnaire: {
      hasNda: true, hasDeviceLock: true, hasBackups: true, hasEncryption: true,
      filesDigitized: true,
      purposes: [
        { name: "Patrocinio y gestión de casos", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Facturación de honorarios", basis: "Obligación legal (art. 7.4)" },
      ],
    },
    classify: {
      "Gestor de expedientes de clientes": { categories: ["identificativos", "contacto", "otros_sensibles"], subjects: ["clientes"], count: "100-1000", storage: "local" },
      "Servidor de documentos legales": { categories: ["identificativos", "contacto", "financieros"], subjects: ["clientes"], count: "100-1000", storage: "local" },
      "Laptop socio principal": { categories: ["identificativos", "contacto"], subjects: ["clientes"], count: "100-1000", storage: "local" },
      "Laptop asociado": { categories: ["identificativos", "contacto"], subjects: ["clientes"], count: "100-1000", storage: "local" },
      "Base de datos jurídica": { categories: [], subjects: [], count: "<100", storage: "nube_ext" },
      "Firma electrónica": { categories: ["identificativos", "biometricos"], subjects: ["clientes"], count: "100-1000", storage: "nube_ec" },
      "Almacenamiento en la nube": { categories: ["identificativos", "contacto"], subjects: ["clientes"], count: "100-1000", storage: "nube_ext", processor: true },
    },
  },
  {
    key: "pyme",
    name: `${PREFIX} — Distribuidora Comercial El Roble`,
    ruc: "1795678901001",
    sector: "otro",
    revenue: "500k-1m",
    isProcessor: false,
    legalRep: "Ing. Roberto Salgado Mora",
    assets: [
      { name: "Sistema de facturación y ventas", type: "application" },
      { name: "CRM de clientes", type: "application" },
      { name: "Servidor de la empresa", type: "physical", model: "Dell PowerEdge R350" },
      { name: "Laptop de gerencia", type: "physical", model: "HP EliteBook" },
      { name: "Computadores de bodega (5)", type: "physical", model: "Lenovo ThinkCentre" },
    ],
    licenses: [
      { name: "Microsoft 365", vendor: "Microsoft" },
      { name: "Sistema de nómina", vendor: "SmartNomina" },
    ],
    contracts: [
      { name: "Servicio contable externo", vendor: "Contadores Asociados", type: "servicio" },
      { name: "Plataforma de correo masivo", vendor: "Mailchimp", type: "marketing" },
    ],
    questionnaire: {
      hasBackups: true, hasAntivirus: true, hasDeviceLock: true, hasMfa: true,
      hasPrivacyPolicy: true, hasAccessControl: true,
      purposes: [
        { name: "Gestión de clientes y ventas", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Gestión de nómina y talento humano", basis: "Obligación legal (art. 7.4)" },
        { name: "Comunicaciones comerciales", basis: "Consentimiento del titular (art. 7.1)" },
      ],
    },
    classify: {
      "Sistema de facturación y ventas": { categories: ["identificativos", "contacto", "financieros"], subjects: ["clientes"], count: ">10000", storage: "local" },
      "CRM de clientes": { categories: ["identificativos", "contacto"], subjects: ["clientes"], count: ">10000", storage: "nube_ext" },
      "Servidor de la empresa": { categories: ["identificativos", "laborales", "financieros"], subjects: ["empleados", "clientes"], count: ">10000", storage: "local" },
      "Laptop de gerencia": { categories: ["identificativos", "laborales"], subjects: ["empleados"], count: "<100", storage: "local" },
      "Computadores de bodega (5)": { categories: [], subjects: [], count: "<100", storage: "local" },
      "Microsoft 365": { categories: ["identificativos", "contacto"], subjects: ["empleados", "clientes"], count: "1000-10000", storage: "nube_ext" },
      "Sistema de nómina": { categories: ["identificativos", "laborales", "financieros"], subjects: ["empleados"], count: "<100", storage: "nube_ec" },
      "Servicio contable externo": { categories: ["identificativos", "laborales", "financieros"], subjects: ["empleados"], count: "<100", storage: "local", processor: true },
      "Plataforma de correo masivo": { categories: ["identificativos", "contacto"], subjects: ["clientes"], count: ">10000", storage: "nube_ext", processor: true },
    },
  },
];

// ============================================================================
// SIEMBRA
// ============================================================================

async function ensureDemoUser(): Promise<string> {
  const email = "demo.lopdp@techassets.local";
  const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows[0]) return existing.rows[0].id;

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1, $2, 'Demo', 'LOPDP', 'technical_admin') RETURNING id`,
    [email, "no-login-demo-account"],
  );
  return rows[0].id;
}

async function cleanPrevious(): Promise<void> {
  // Borra solo lo sembrado por este script (prefijo DEMO), nunca datos reales.
  await pool.query(`DELETE FROM companies WHERE name LIKE $1`, [`${PREFIX}%`]);
}

async function seedCompany(demo: DemoCompany, userId: string): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO companies (name, description, plan, ruc, address, phone, email, lopdp_enabled, lopdp_activated_at)
     VALUES ($1,$2,'pyme',$3,$4,$5,$6, TRUE, NOW()) RETURNING id`,
    [
      demo.name,
      `Empresa de demostración del módulo LOPDP — perfil ${demo.sector}`,
      demo.ruc,
      "Av. Amazonas N34-100, Quito, Ecuador",
      "0999999999",
      `contacto.${demo.key}@demo-lopdp.ec`,
    ],
  );
  const companyId = rows[0].id;

  await pool.query(
    `INSERT INTO user_companies (user_id, company_id, role) VALUES ($1,$2,'manager_owner')
     ON CONFLICT DO NOTHING`,
    [userId, companyId],
  );

  for (const a of demo.assets) {
    await pool.query(
      `INSERT INTO assets (company_id, name, type, model, status, monthly_cost, purchase_date)
       VALUES ($1,$2,$3::asset_type,$4,'active',$5, NOW() - INTERVAL '1 year')`,
      [companyId, a.name, a.type, a.model ?? null, a.monthlyCost ?? 0],
    );
  }
  for (const l of demo.licenses) {
    await pool.query(
      `INSERT INTO licenses (company_id, name, vendor, billing_cycle, status, expiry_date)
       VALUES ($1,$2,$3,'annual','active', NOW() + INTERVAL '6 months')`,
      [companyId, l.name, l.vendor],
    );
  }
  for (const c of demo.contracts) {
    await pool.query(
      `INSERT INTO contracts (company_id, name, vendor, contract_type, start_date, end_date, status)
       VALUES ($1,$2,$3,$4, NOW() - INTERVAL '6 months', NOW() + INTERVAL '6 months', 'active')`,
      [companyId, c.name, c.vendor, c.type],
    );
  }
  return companyId;
}

async function classifyAll(companyId: string, demo: DemoCompany, userId: string): Promise<number> {
  const rows = await lopdpStorage.getClassifications(companyId);
  let count = 0;
  for (const row of rows) {
    const spec = demo.classify[row.entityName];
    const idField =
      row.entityKind === "asset" ? "assetId" : row.entityKind === "license" ? "licenseId" : "contractId";
    await lopdpStorage.upsertClassification(companyId, userId, {
      [idField]: row.entityId,
      hasPersonalData: Boolean(spec && spec.categories.length > 0),
      dataCategories: spec?.categories ?? [],
      dataSubjects: spec?.subjects ?? [],
      subjectCountRange: spec?.count ?? null,
      storageLocation: spec?.storage ?? null,
      isProcessorAsset: spec?.processor === true,
      retentionPeriod: null,
      notes: null,
    });
    count++;
  }
  return count;
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

async function main() {
  console.log(`\n${"=".repeat(64)}`);
  console.log("PRUEBA DE INTEGRACIÓN — MÓDULO DE DATOS PERSONALES (LOPDP)");
  console.log(`Base de datos: ${(process.env.DATABASE_URL ?? "").replace(/:[^:@]*@/, ":****@")}`);
  console.log("=".repeat(64));

  section("0. Preparación");
  await cleanPrevious();
  const userId = await ensureDemoUser();
  check("usuario de demostración disponible", Boolean(userId));

  const created: Array<{ demo: DemoCompany; companyId: string }> = [];
  for (const demo of COMPANIES) {
    const companyId = await seedCompany(demo, userId);
    created.push({ demo, companyId });
  }
  check(`5 empresas creadas con sus activos`, created.length === 5, `${created.length}`);

  const totalAssets = await pool.query(
    `SELECT COUNT(*) AS n FROM assets a JOIN companies c ON c.id = a.company_id WHERE c.name LIKE $1`,
    [`${PREFIX}%`],
  );
  check("los activos quedaron cargados", Number(totalAssets.rows[0].n) === 24,
    `${totalAssets.rows[0].n} activos`);

  // ------------------------------------------------------------------
  section("1. Flujo completo por empresa");
  // ------------------------------------------------------------------
  const results: Record<string, any> = {};

  for (const { demo, companyId } of created) {
    console.log(`\n  ── ${demo.name}`);

    // Perfil
    await lopdpStorage.upsertProfile(companyId, {
      sector: demo.sector,
      legalRepName: demo.legalRep,
      employeeCount: 12,
      annualRevenueRange: demo.revenue,
      arcoChannel: `datos.${demo.key}@demo-lopdp.ec`,
      questionnaire: demo.questionnaire,
      isProcessor: demo.isProcessor,
      completed: true,
    });

    // Clasificación
    const classified = await classifyAll(companyId, demo, userId);
    check(`  ${demo.key}: activos clasificados (${classified})`, classified > 0);

    // Motor
    const assessment = await lopdpStorage.runEngine(companyId, "wizard");
    const scenarios = await lopdpStorage.getScenarios(companyId);
    const actions = await lopdpStorage.getActions(companyId);

    results[demo.key] = { assessment, scenarios, actions, companyId };

    console.log(
      `     riesgo ${Number(assessment.riskScore).toFixed(1)} (${assessment.riskGrade}) · ` +
      `cumplimiento ${Number(assessment.complianceScore).toFixed(1)} (${assessment.complianceGrade}) · ` +
      `${scenarios.length} escenarios · ${actions.length} acciones · ` +
      `multa estimada $${Number(assessment.estimatedFineMin).toFixed(0)}-$${Number(assessment.estimatedFineMax).toFixed(0)}`,
    );

    check(`  ${demo.key}: se generaron escenarios de riesgo`, scenarios.length > 0);
    check(`  ${demo.key}: se generó plan de acción`, actions.length > 0);
    check(`  ${demo.key}: todos los escenarios tienen justificación`,
      scenarios.every((s: any) => s.rationale && s.rationale.length > 30));
    check(`  ${demo.key}: la calificación de riesgo está en rango 0-100`,
      Number(assessment.riskScore) >= 0 && Number(assessment.riskScore) <= 100);
    check(`  ${demo.key}: la calificación de cumplimiento está en rango 0-100`,
      Number(assessment.complianceScore) >= 0 && Number(assessment.complianceScore) <= 100);
  }

  if (SEED_ONLY) {
    console.log("\n--seed-only: empresas cargadas, se omiten las aserciones del flujo.");
    await pool.end();
    return;
  }

  // ------------------------------------------------------------------
  section("2. Coherencia sectorial de los resultados");
  // ------------------------------------------------------------------

  const medico = results.medico;
  const abogado = results.abogado;
  const contador = results.contador;
  const odontologo = results.odontologo;

  check("el centro médico tiene escenario de historias clínicas (datos sensibles)",
    medico.scenarios.some((s: any) => s.templateKey === "historia_clinica"));
  check("el centro médico requiere EIPDP (art. 42)",
    medico.actions.some((a: any) => a.controlKey === "J07"));
  check("el centro médico requiere designar DPD (datos sensibles a gran escala)",
    medico.actions.some((a: any) => a.controlKey === "J09"));
  check("el estudio jurídico tiene escenario de secreto profesional",
    abogado.scenarios.some((s: any) => s.templateKey === "secreto_profesional"));
  check("el contador recibe el contrato espejo como encargado (art. 28)",
    contador.actions.some((a: any) => a.controlKey === "J05P"));
  check("las empresas con nube en el exterior tienen escenario de transferencia internacional",
    contador.scenarios.some((s: any) => s.templateKey === "transferencia_internacional"));
  check("los proveedores marcados como encargados generan el escenario del art. 28",
    medico.scenarios.some((s: any) => s.templateKey === "encargado_sin_contrato"));
  check("el odontólogo (datos de salud y biométricos) tiene escenarios de nivel muy alto",
    odontologo.scenarios.some((s: any) => s.level === "muy_alto"));
  check("el centro médico enfrenta infracción muy grave sin EIPDP",
    medico.assessment.worstInfraction === "muy_grave",
    `obtenido ${medico.assessment.worstInfraction}`);
  check("la multa estimada del centro médico es mayor que la del odontólogo (más facturación)",
    Number(medico.assessment.estimatedFineMax) > Number(odontologo.assessment.estimatedFineMax));

  // ------------------------------------------------------------------
  section("3. Aislamiento multi-tenant");
  // ------------------------------------------------------------------

  const medicoScenarios = await lopdpStorage.getScenarios(medico.companyId);
  check("los escenarios de una empresa no incluyen activos de otra",
    medicoScenarios.every((s: any) =>
      COMPANIES.find((c) => c.key === "medico")!.classify[s.entityName] !== undefined));

  let rejected = false;
  try {
    await lopdpStorage.upsertClassification(medico.companyId, userId, {
      assetId: (await pool.query(`SELECT id FROM assets WHERE company_id = $1 LIMIT 1`, [contador.companyId])).rows[0].id,
      hasPersonalData: true, dataCategories: ["identificativos"], dataSubjects: ["clientes"],
    });
  } catch {
    rejected = true;
  }
  check("no se puede clasificar un activo de otra empresa", rejected);

  // ------------------------------------------------------------------
  section("4. Plan de acción y progreso de la calificación");
  // ------------------------------------------------------------------

  const before = await lopdpStorage.getLatestAssessment(odontologo.companyId);
  const pendingActions = (await lopdpStorage.getActions(odontologo.companyId))
    .filter((a: any) => a.status === "pending");
  check("el odontólogo tiene acciones pendientes", pendingActions.length > 0);

  // Completar las 3 acciones de mayor prioridad
  for (const action of pendingActions.slice(0, 3)) {
    await lopdpStorage.updateAction(odontologo.companyId, action.id, { status: "done" });
  }
  const after = await lopdpStorage.getLatestAssessment(odontologo.companyId);

  check("completar acciones sube la calificación de cumplimiento",
    Number(after.complianceScore) > Number(before.complianceScore),
    `${Number(before.complianceScore).toFixed(1)} → ${Number(after.complianceScore).toFixed(1)}`);
  check("completar acciones no empeora la calificación de riesgo",
    Number(after.riskScore) <= Number(before.riskScore),
    `${Number(before.riskScore).toFixed(1)} → ${Number(after.riskScore).toFixed(1)}`);

  const history = await lopdpStorage.getAssessmentHistory(odontologo.companyId);
  check("el histórico de calificaciones registra la evolución", history.length >= 2, `${history.length} registros`);

  // "No aplica" exige justificación
  const naAction = (await lopdpStorage.getActions(odontologo.companyId)).find((a: any) => a.status === "pending");
  if (naAction) {
    await lopdpStorage.updateAction(odontologo.companyId, naAction.id, {
      status: "not_applicable",
      naRationale: "No tenemos proveedores externos que accedan a datos de pacientes.",
    });
    const updated = (await lopdpStorage.getActions(odontologo.companyId)).find((a: any) => a.id === naAction.id);
    check("una acción marcada 'no aplica' guarda su justificación",
      updated?.status === "not_applicable" && Boolean(updated?.naRationale));
  }

  // ------------------------------------------------------------------
  section("5. Documentos legales");
  // ------------------------------------------------------------------

  const docTypes = ["privacy_policy", "tyc", "rat", "arco", "consent_health", "dpa", "breach_protocol", "eipdp", "riesgos", "diagnostico", "trazabilidad"];
  for (const docType of docTypes) {
    const doc = await lopdpStorage.createDocument(medico.companyId, userId, docType as any, null);
    const hasDisclaimer = doc.content.includes("No constituye asesoría legal") ||
      doc.content.includes("no constituye asesoría legal") ||
      doc.content.includes("No constituyen asesoría");
    check(`  documento generado: ${docType}`, doc.content.length > 500, `${doc.content.length} caracteres`);
    if (docType !== "certificado") {
      check(`  ${docType} incluye el aviso legal obligatorio`, hasDisclaimer);
    }
  }

  const politica = (await lopdpStorage.getDocuments(medico.companyId)).find((d: any) => d.docType === "privacy_policy");
  const full = await lopdpStorage.getDocument(medico.companyId, politica.id);
  check("la política menciona el nombre real de la empresa", full.content.includes("Centro Médico Vida Sana"));
  check("la política cita el plazo correcto del art. 62 (10 días)",
    full.content.includes("diez (10) días"));
  check("la política reconoce el tratamiento de datos sensibles",
    full.content.includes("categorías especiales"));

  const rat = (await lopdpStorage.getDocuments(medico.companyId)).find((d: any) => d.docType === "rat");
  const ratFull = await lopdpStorage.getDocument(medico.companyId, rat.id);
  check("el RAT lista las finalidades declaradas",
    ratFull.content.includes("Atención médica e historia clínica"));
  check("el RAT lista los activos que soportan el tratamiento",
    ratFull.content.includes("Sistema de historias clínicas"));

  // Publicar sube el puntaje
  const antesPublicar = await lopdpStorage.getLatestAssessment(medico.companyId);
  await lopdpStorage.updateDocument(medico.companyId, politica.id, { status: "published" });
  const despuesPublicar = await lopdpStorage.getLatestAssessment(medico.companyId);
  check("publicar un documento sube la calificación de cumplimiento",
    Number(despuesPublicar.complianceScore) > Number(antesPublicar.complianceScore),
    `${Number(antesPublicar.complianceScore).toFixed(1)} → ${Number(despuesPublicar.complianceScore).toFixed(1)}`);

  // Versionado
  const v2 = await lopdpStorage.createDocument(medico.companyId, userId, "privacy_policy", null);
  check("regenerar un documento crea una versión nueva", v2.version === 2, `versión ${v2.version}`);

  // ------------------------------------------------------------------
  section("6. Modo Defensa — solicitudes de titulares (art. 62)");
  // ------------------------------------------------------------------

  const receivedAt = new Date();
  const request = await lopdpStorage.createTitularRequest(medico.companyId, {
    requestType: "acceso",
    titularName: "Ana Lucía Torres",
    titularContact: "ana.torres@correo.com",
    titularIdNumber: "1712345678",
    channel: "email",
    detail: "Solicito copia de mi historia clínica completa.",
    receivedAt,
    affectedAssetIds: [],
  });

  const diasHabiles = Math.round(
    (new Date(request.dueDate).getTime() - receivedAt.getTime()) / 86400000,
  );
  check("la solicitud calcula su vencimiento en días término",
    diasHabiles >= 12 && diasHabiles <= 16,
    `${diasHabiles} días calendario para 10 días hábiles`);

  const requests = await lopdpStorage.getTitularRequests(medico.companyId);
  check("la solicitud aparece con días hábiles restantes",
    requests[0].daysLeft > 0 && requests[0].daysLeft <= 10, `${requests[0].daysLeft} días`);
  check("una solicitud recién creada no está vencida", requests[0].isOverdue === false);

  const respuesta = await lopdpStorage.createDocument(
    medico.companyId, userId, "titular_response", request.id,
  );
  check("se genera la respuesta al titular con sus datos", respuesta.content.includes("Ana Lucía Torres"));
  check("la respuesta cita el término de 10 días del art. 62",
    respuesta.content.includes("diez (10) días"));

  await lopdpStorage.updateTitularRequest(medico.companyId, request.id, {
    status: "executed", resolution: "concedida",
    resolutionRationale: "Se entregó copia digital de la historia clínica previa verificación de identidad.",
    evidenceNote: "Entregado por correo electrónico certificado.",
  });
  const atendida = (await lopdpStorage.getTitularRequests(medico.companyId))[0];
  check("la solicitud atendida registra fecha de respuesta", Boolean(atendida.answeredAt));

  // Solicitud vencida penaliza el cumplimiento
  const antesVencida = await lopdpStorage.getLatestAssessment(medico.companyId);
  const vieja = new Date();
  vieja.setDate(vieja.getDate() - 40);
  await lopdpStorage.createTitularRequest(medico.companyId, {
    requestType: "eliminacion", titularName: "Titular Moroso", receivedAt: vieja, affectedAssetIds: [],
  });
  const conVencida = await lopdpStorage.getTitularRequests(medico.companyId);
  check("una solicitud fuera de plazo se marca como vencida",
    conVencida.some((r: any) => r.isOverdue === true));
  const despuesVencida = await lopdpStorage.recomputeAssessment(medico.companyId, "manual");
  check("una solicitud vencida degrada la calificación de cumplimiento",
    Number(despuesVencida.complianceScore) < Number(antesVencida.complianceScore),
    `${Number(antesVencida.complianceScore).toFixed(1)} → ${Number(despuesVencida.complianceScore).toFixed(1)}`);

  // ------------------------------------------------------------------
  section("7. Modo Defensa — incidentes (art. 43: 72 horas)");
  // ------------------------------------------------------------------

  const detectedAt = new Date();
  const incident = await lopdpStorage.createIncident(medico.companyId, {
    title: "Acceso no autorizado al correo institucional",
    description: "Se detectó un inicio de sesión desde una IP desconocida en la cuenta de recepción.",
    detectedAt,
    dimensions: ["C"],
    dataCategories: ["identificativos", "contacto", "salud"],
    subjectCountEstimate: 320,
    severity: "alta",
  });

  const horas = (new Date(incident.spdpDeadline).getTime() - detectedAt.getTime()) / 3600000;
  check("el incidente fija el plazo de 72 horas a la SPDP", Math.round(horas) === 72, `${horas} horas`);

  const incidents = await lopdpStorage.getIncidents(medico.companyId);
  check("el incidente muestra las horas restantes",
    incidents[0].hoursLeft > 70 && incidents[0].hoursLeft <= 72, `${incidents[0].hoursLeft} h`);

  const notificacion = await lopdpStorage.createDocument(
    medico.companyId, userId, "spdp_notification", incident.id,
  );
  check("se genera la notificación a la SPDP con los datos del incidente",
    notificacion.content.includes("Acceso no autorizado al correo institucional"));
  check("la notificación cita el art. 43 y las 72 horas",
    notificacion.content.includes("artículo 43") && notificacion.content.includes("72"));
  check("la notificación informa el número de titulares afectados",
    notificacion.content.includes("320"));

  await lopdpStorage.updateIncident(medico.companyId, incident.id, {
    status: "notificado_spdp", spdpNotifiedAt: new Date(),
    measuresTaken: "Se revocaron credenciales, se activó MFA y se forzó cambio de contraseñas.",
  });
  const notificado = (await lopdpStorage.getIncidents(medico.companyId))[0];
  check("el incidente registra la notificación a la autoridad", Boolean(notificado.spdpNotifiedAt));

  // ------------------------------------------------------------------
  section("8. Modo Defensa — procedimientos de la SPDP (arts. 63-66)");
  // ------------------------------------------------------------------

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 15);
  const procedure = await lopdpStorage.createProcedure(medico.companyId, {
    procedureType: "medida_correctiva",
    fileNumber: "SPDP-2026-0042",
    notifiedAt: new Date(),
    deadline,
    description: "Requerimiento por presunta falta de medidas de seguridad sobre datos de salud.",
    correctiveMeasures:
      "Publicar la política de protección de datos personales\n" +
      "Suscribir contratos de encargo con el laboratorio externo\n" +
      "Implementar cifrado en el servidor de imágenes médicas",
  });

  check("el procedimiento queda registrado", Boolean(procedure.id));

  const accionesConMedidas = await lopdpStorage.getActions(medico.companyId);
  const medidas = accionesConMedidas.filter((a: any) => a.procedureId === procedure.id);
  check("cada medida correctiva se convierte en una acción del plan", medidas.length === 3, `${medidas.length}`);
  check("las medidas correctivas heredan la fecha límite del procedimiento",
    medidas.every((m: any) => m.dueDate !== null));
  check("las medidas correctivas citan los arts. 65-66",
    medidas.every((m: any) => (m.legalBasis ?? "").includes("65")));

  const descargos = await lopdpStorage.createDocument(medico.companyId, userId, "descargos", procedure.id);
  check("el borrador de descargos incluye el número de expediente",
    descargos.content.includes("SPDP-2026-0042"));
  check("los descargos invocan el art. 66.2 (medidas correctivas antes que sanción)",
    descargos.content.includes("66.2"));
  check("los descargos incluyen la evidencia de responsabilidad proactiva",
    descargos.content.includes("responsabilidad proactiva"));

  // ------------------------------------------------------------------
  section("9. Expediente de cumplimiento y certificado");
  // ------------------------------------------------------------------

  const expediente = await lopdpStorage.createDocument(medico.companyId, userId, "expediente", null);
  check("el expediente lista los 12 puntos del índice",
    expediente.content.includes("12. Bitácora de trazabilidad"));
  check("el expediente marca lo disponible", expediente.content.includes("✔ Disponible"));
  check("el expediente marca en rojo lo que falta (no lo inventa)",
    expediente.content.includes("NO DISPONIBLE"));
  check("el expediente reporta las estadísticas de solicitudes de titulares",
    expediente.content.includes("solicitudes"));

  const certificado = await lopdpStorage.createDocument(medico.companyId, userId, "certificado", null);
  check("el certificado incluye las dos calificaciones",
    certificado.content.includes("Calificación de cumplimiento") &&
    certificado.content.includes("Calificación de riesgo"));
  check("el certificado aclara que NO es la certificación oficial del art. 54",
    certificado.content.includes("No constituye una certificación oficial"));
  check("el certificado indica vigencia de 6 meses", certificado.content.includes("(6 meses)"));

  // ------------------------------------------------------------------
  section("10. Trazabilidad");
  // ------------------------------------------------------------------

  const mapa = await lopdpStorage.getTraceabilityMap(medico.companyId);
  check("el mapa de trazabilidad lista las finalidades", mapa.purposes.length === 3, `${mapa.purposes.length}`);
  check("el mapa identifica los activos con datos personales", mapa.assets.length > 0);
  check("el mapa identifica a los encargados del tratamiento", mapa.processors.length > 0);
  check("el mapa detecta la transferencia internacional", mapa.foreignTransfer === true);

  const trazabilidad = await lopdpStorage.createDocument(medico.companyId, userId, "trazabilidad", null);
  check("el informe de trazabilidad detalla el flujo por activo",
    trazabilidad.content.includes("Sistema de historias clínicas"));

  // ------------------------------------------------------------------
  section("11. Determinismo y reproducibilidad");
  // ------------------------------------------------------------------

  const primera = await lopdpStorage.runEngine(contador.companyId, "manual");
  const segunda = await lopdpStorage.runEngine(contador.companyId, "manual");
  check("ejecutar el motor dos veces da el mismo resultado",
    Number(primera.riskScore) === Number(segunda.riskScore) &&
    Number(primera.complianceScore) === Number(segunda.complianceScore),
    `${primera.riskScore}/${primera.complianceScore} vs ${segunda.riskScore}/${segunda.complianceScore}`);

  const escenariosAntes = (await lopdpStorage.getScenarios(contador.companyId)).length;
  await lopdpStorage.runEngine(contador.companyId, "manual");
  const escenariosDespues = (await lopdpStorage.getScenarios(contador.companyId)).length;
  check("recalcular no duplica escenarios",
    escenariosAntes === escenariosDespues, `${escenariosAntes} vs ${escenariosDespues}`);

  const historial = await lopdpStorage.getAssessmentHistory(contador.companyId);
  check("recalcular sin cambios no ensucia el histórico", historial.length <= 3, `${historial.length} registros`);

  // ------------------------------------------------------------------
  section("12. Gate premium");
  // ------------------------------------------------------------------

  await lopdpStorage.setEnabled(contador.companyId, false);
  check("el módulo se puede desactivar", (await lopdpStorage.isEnabled(contador.companyId)) === false);
  const statusOff = await lopdpStorage.getStatus(contador.companyId);
  check("el estado refleja el módulo desactivado", statusOff.enabled === false);
  await lopdpStorage.setEnabled(contador.companyId, true);
  check("el módulo se puede reactivar", (await lopdpStorage.isEnabled(contador.companyId)) === true);

  // ------------------------------------------------------------------
  section("13. Resumen de las 5 empresas");
  // ------------------------------------------------------------------

  console.log("\n  Empresa                        Riesgo  Cumpl.  Escen.  Acciones  Multa estimada");
  console.log("  " + "-".repeat(84));
  for (const { demo, companyId } of created) {
    const a = await lopdpStorage.getLatestAssessment(companyId);
    const sc = await lopdpStorage.getScenarios(companyId);
    const ac = await lopdpStorage.getActions(companyId);
    const name = demo.name.replace(`${PREFIX} — `, "").slice(0, 30).padEnd(30);
    console.log(
      `  ${name} ${String(Number(a.riskScore).toFixed(0)).padStart(3)} ${a.riskGrade}   ` +
      `${String(Number(a.complianceScore).toFixed(0)).padStart(3)} ${a.complianceGrade}   ` +
      `${String(sc.length).padStart(4)}   ${String(ac.length).padStart(6)}   ` +
      `$${Number(a.estimatedFineMin).toFixed(0)}-$${Number(a.estimatedFineMax).toFixed(0)}`,
    );
  }

  console.log(`\n${"=".repeat(64)}`);
  console.log(`RESULTADO: ${passed} pruebas superadas, ${failed} fallidas`);
  if (failed > 0) {
    console.log("\nFallos:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log("=".repeat(64));

  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error("\nERROR FATAL EN LA PRUEBA:", error);
  try { await pool.end(); } catch { /* ignorar */ }
  process.exit(1);
});
