/**
 * SIEMBRA DE EMPRESAS "RECIÉN COMPRADAS"
 *
 * 3 estudios contables + 3 consultorios odontológicos, cada uno con su
 * inventario cargado (3 computadores, 1 biométrico, 10 cámaras) y 5 empleados,
 * pero con el módulo de Datos Personales COMPLETAMENTE VACÍO: sin perfil, sin
 * clasificación y sin evaluación.
 *
 * Sirve para recorrer el flujo tal como lo vive alguien que acaba de comprar:
 * entra, ve que no sabe nada del tema, y el asistente se lo enseña.
 *
 * Ejecutar:
 *   DATABASE_URL=postgres://... npx tsx scripts/seed-lopdp-nuevos.ts
 *
 * Borrar:
 *   DELETE FROM companies WHERE name LIKE 'NUEVO %';
 *   DELETE FROM users WHERE email LIKE '%@nuevo-lopdp.ec';
 */
import crypto from "crypto";
import { pool } from "../server/db";

const PASSWORD = process.env.LOPDP_DEMO_PASSWORD ?? "DemoLopdp2026*";
const hashPassword = (p: string) => crypto.createHash("sha256").update(p).digest("hex");

interface NuevaEmpresa {
  slug: string;
  name: string;
  ruc: string;
  giro: "contable" | "odontologia";
  owner: { email: string; firstName: string; lastName: string };
  empleados: Array<{ firstName: string; lastName: string }>;
  /** Marca y modelo del equipamiento, para que el inventario se vea real. */
  computadores: string[];
  biometrico: string;
  camaraModelo: string;
}

const EMPRESAS: NuevaEmpresa[] = [
  // ---------------------------- CONTABLES ----------------------------
  {
    slug: "contaplus",
    name: "Contaplus Asesores Tributarios",
    ruc: "1796100001001",
    giro: "contable",
    owner: { email: "contaplus@nuevo-lopdp.ec", firstName: "Verónica", lastName: "Tapia" },
    empleados: [
      { firstName: "Andrés", lastName: "Cabrera" },
      { firstName: "Lucía", lastName: "Moreno" },
      { firstName: "Fernando", lastName: "Ríos" },
      { firstName: "Gabriela", lastName: "Sandoval" },
      { firstName: "Marco", lastName: "Peñafiel" },
    ],
    computadores: ["Dell OptiPlex 7010", "HP ProDesk 400 G9", "Lenovo ThinkCentre M70q"],
    biometrico: "ZKTeco K40 (control de asistencia)",
    camaraModelo: "Hikvision DS-2CD1043G0",
  },
  {
    slug: "fiscalnorte",
    name: "Fiscal Norte Contadores",
    ruc: "1796100002001",
    giro: "contable",
    owner: { email: "fiscalnorte@nuevo-lopdp.ec", firstName: "Jorge", lastName: "Almeida" },
    empleados: [
      { firstName: "Daniela", lastName: "Quiroz" },
      { firstName: "Esteban", lastName: "Vaca" },
      { firstName: "Mónica", lastName: "Lara" },
      { firstName: "Pablo", lastName: "Iturralde" },
      { firstName: "Silvia", lastName: "Chamorro" },
    ],
    computadores: ["HP EliteDesk 800 G6", "Dell Vostro 3020", "Asus ExpertCenter D500"],
    biometrico: "Suprema BioEntry W2 (huella)",
    camaraModelo: "Dahua IPC-HFW1230S",
  },
  {
    slug: "balanceec",
    name: "Balance EC Servicios Contables",
    ruc: "1796100003001",
    giro: "contable",
    owner: { email: "balanceec@nuevo-lopdp.ec", firstName: "Cristina", lastName: "Yépez" },
    empleados: [
      { firstName: "Raúl", lastName: "Benítez" },
      { firstName: "Karina", lastName: "Espinoza" },
      { firstName: "Luis", lastName: "Zambrano" },
      { firstName: "Patricia", lastName: "Naranjo" },
      { firstName: "Iván", lastName: "Mendoza" },
    ],
    computadores: ["Lenovo IdeaCentre 3", "HP Pavilion Desktop TP01", "Dell Inspiron 3020"],
    biometrico: "ZKTeco MB460 (rostro y huella)",
    camaraModelo: "Ezviz C3N",
  },
  // --------------------------- ODONTOLOGÍAS --------------------------
  {
    slug: "dentalvida",
    name: "Dental Vida Consultorio Odontológico",
    ruc: "1796200001001",
    giro: "odontologia",
    owner: { email: "dentalvida@nuevo-lopdp.ec", firstName: "Andrea", lastName: "Coronel" },
    empleados: [
      { firstName: "José", lastName: "Vinueza" },
      { firstName: "Michelle", lastName: "Arias" },
      { firstName: "Byron", lastName: "Toapanta" },
      { firstName: "Elena", lastName: "Guerrero" },
      { firstName: "Santiago", lastName: "Freire" },
    ],
    computadores: ["HP ProOne 440 G9 (recepción)", "Dell OptiPlex 3000 (consultorio 1)", "Lenovo V50a (consultorio 2)"],
    biometrico: "ZKTeco F18 (acceso al área clínica)",
    camaraModelo: "Hikvision DS-2CD2043G2",
  },
  {
    slug: "sonrisaplena",
    name: "Sonrisa Plena Odontología Integral",
    ruc: "1796200002001",
    giro: "odontologia",
    owner: { email: "sonrisaplena@nuevo-lopdp.ec", firstName: "Ricardo", lastName: "Bastidas" },
    empleados: [
      { firstName: "Carla", lastName: "Pazmiño" },
      { firstName: "Diego", lastName: "Suárez" },
      { firstName: "Valeria", lastName: "Ordóñez" },
      { firstName: "Henry", lastName: "Calderón" },
      { firstName: "Nathaly", lastName: "Robalino" },
    ],
    computadores: ["Apple iMac 24 (recepción)", "HP EliteDesk 800 (consultorio)", "Dell Precision 3260 (imagenología)"],
    biometrico: "Suprema FaceStation F2 (rostro)",
    camaraModelo: "Dahua IPC-HDW2431T",
  },
  {
    slug: "odontocentro",
    name: "Odontocentro Especialidades Dentales",
    ruc: "1796200003001",
    giro: "odontologia",
    owner: { email: "odontocentro@nuevo-lopdp.ec", firstName: "Mariela", lastName: "Zurita" },
    empleados: [
      { firstName: "Alex", lastName: "Cadena" },
      { firstName: "Johanna", lastName: "Sarmiento" },
      { firstName: "Wilson", lastName: "Andrade" },
      { firstName: "Tatiana", lastName: "Villacís" },
      { firstName: "Kevin", lastName: "Cueva" },
    ],
    computadores: ["Lenovo ThinkCentre M90a", "HP Z2 Mini G9 (radiología)", "Dell OptiPlex 5000 (recepción)"],
    biometrico: "ZKTeco SpeedFace V5L (rostro)",
    camaraModelo: "Hikvision DS-2CD1327G0",
  },
];

/** Zonas donde se instalan las cámaras, según el giro del negocio. */
const UBICACIONES: Record<string, string[]> = {
  contable: [
    "Recepción", "Sala de espera", "Oficina principal", "Oficina de asistentes", "Archivo físico",
    "Pasillo", "Entrada principal", "Estacionamiento", "Sala de reuniones", "Bodega de documentos",
  ],
  odontologia: [
    "Recepción", "Sala de espera", "Consultorio 1", "Consultorio 2", "Área de esterilización",
    "Pasillo", "Entrada principal", "Estacionamiento", "Laboratorio", "Bodega de insumos",
  ],
};

async function upsertUser(u: { email: string; firstName: string; lastName: string }, role: string): Promise<string> {
  const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [u.email]);
  if (existing.rows[0]) {
    await pool.query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
      [existing.rows[0].id, hashPassword(PASSWORD)]);
    return existing.rows[0].id;
  }
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1,$2,$3,$4,$5::user_role) RETURNING id`,
    [u.email, hashPassword(PASSWORD), u.firstName, u.lastName, role],
  );
  return rows[0].id;
}

async function main() {
  console.log("\nSembrando 6 empresas nuevas (solo inventario, módulo LOPDP en blanco)…\n");

  // Limpieza de una siembra anterior
  await pool.query(`DELETE FROM companies WHERE name LIKE 'NUEVO %'`);

  const resumen: Array<{ empresa: string; giro: string; usuario: string; activos: number; empleados: number }> = [];

  for (const e of EMPRESAS) {
    const ownerId = await upsertUser(e.owner, "manager_owner");

    const { rows } = await pool.query(
      `INSERT INTO companies (name, description, plan, ruc, address, phone, email,
                              lopdp_enabled, lopdp_activated_at, max_users, max_assets)
       VALUES ($1,$2,'pyme',$3,$4,$5,$6, TRUE, NOW(), 10, 500) RETURNING id`,
      [
        `NUEVO — ${e.name}`,
        `Empresa de prueba del flujo inicial del módulo LOPDP (${e.giro}). Inventario cargado, ` +
          `módulo de datos personales sin configurar. Datos sintéticos.`,
        e.ruc,
        "Av. República del Salvador N36-84, Quito, Ecuador",
        "0987654321",
        e.owner.email,
      ],
    );
    const companyId = rows[0].id;

    await pool.query(
      `INSERT INTO user_companies (user_id, company_id, role) VALUES ($1,$2,'manager_owner')
       ON CONFLICT DO NOTHING`,
      [ownerId, companyId],
    );

    // 5 empleados como usuarios de la empresa
    for (const emp of e.empleados) {
      const email = `${emp.firstName}.${emp.lastName}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z.]/g, "") + `.${e.slug}@nuevo-lopdp.ec`;
      const empId = await upsertUser({ email, firstName: emp.firstName, lastName: emp.lastName }, "technical_admin");
      await pool.query(
        `INSERT INTO user_companies (user_id, company_id, role) VALUES ($1,$2,'technical_admin')
         ON CONFLICT DO NOTHING`,
        [empId, companyId],
      );
    }

    // 3 computadores, asignados a los primeros empleados
    for (let i = 0; i < e.computadores.length; i++) {
      const emp = e.empleados[i];
      await pool.query(
        `INSERT INTO assets (company_id, name, type, model, manufacturer, status, location,
                             assigned_to, purchase_date, purchase_cost, depreciation_years)
         VALUES ($1,$2,'physical',$3,$4,'active',$5,$6, NOW() - INTERVAL '8 months', $7, 3)`,
        [
          companyId,
          `Computador ${i + 1} — ${e.giro === "odontologia" ? ["recepción", "consultorio 1", "consultorio 2"][i] : ["contabilidad", "asistencia", "gerencia"][i]}`,
          e.computadores[i],
          e.computadores[i].split(" ")[0],
          e.giro === "odontologia" ? ["Recepción", "Consultorio 1", "Consultorio 2"][i] : ["Oficina principal", "Oficina de asistentes", "Gerencia"][i],
          `${emp.firstName} ${emp.lastName}`,
          850,
        ],
      );
    }

    // 1 biométrico
    await pool.query(
      `INSERT INTO assets (company_id, name, type, model, manufacturer, status, location,
                           purchase_date, purchase_cost, depreciation_years, notes)
       VALUES ($1,$2,'physical',$3,$4,'active','Entrada principal', NOW() - INTERVAL '8 months', 320, 3, $5)`,
      [
        companyId,
        "Lector biométrico de acceso",
        e.biometrico,
        e.biometrico.split(" ")[0],
        e.giro === "odontologia"
          ? "Controla el acceso al área clínica y registra la asistencia del personal."
          : "Registra la asistencia del personal.",
      ],
    );

    // 10 cámaras
    const zonas = UBICACIONES[e.giro];
    for (let i = 0; i < 10; i++) {
      await pool.query(
        `INSERT INTO assets (company_id, name, type, model, manufacturer, status, location,
                             purchase_date, purchase_cost, depreciation_years)
         VALUES ($1,$2,'physical',$3,$4,'active',$5, NOW() - INTERVAL '8 months', 95, 3)`,
        [
          companyId,
          `Cámara ${String(i + 1).padStart(2, "0")} — ${zonas[i]}`,
          e.camaraModelo,
          e.camaraModelo.split(" ")[0],
          zonas[i],
        ],
      );
    }

    const total = await pool.query(`SELECT COUNT(*) AS n FROM assets WHERE company_id = $1`, [companyId]);

    resumen.push({
      empresa: e.name,
      giro: e.giro,
      usuario: e.owner.email,
      activos: Number(total.rows[0].n),
      empleados: e.empleados.length,
    });

    console.log(`  ✔ ${e.name.padEnd(44)} ${total.rows[0].n} activos · ${e.empleados.length} empleados · módulo en blanco`);
  }

  // Verificación: ninguna de estas empresas debe tener datos del módulo LOPDP.
  const sucias = await pool.query(
    `SELECT c.name FROM companies c
      WHERE c.name LIKE 'NUEVO %'
        AND (EXISTS (SELECT 1 FROM dp_company_profile p WHERE p.company_id = c.id)
          OR EXISTS (SELECT 1 FROM dp_asset_classification x WHERE x.company_id = c.id)
          OR EXISTS (SELECT 1 FROM dp_assessment a WHERE a.company_id = c.id))`,
  );

  console.log(`\n${"=".repeat(80)}`);
  console.log("EMPRESAS NUEVAS — el módulo de Datos Personales arranca desde cero");
  console.log("=".repeat(80));
  console.log(`Contraseña (dueños y empleados): ${PASSWORD}\n`);
  console.log("  Empresa                                        Giro          Usuario dueño");
  console.log("  " + "-".repeat(76));
  for (const r of resumen) {
    console.log(`  ${r.empresa.slice(0, 44).padEnd(46)} ${r.giro.padEnd(13)} ${r.usuario}`);
  }
  console.log(`\n  Cada una: 3 computadores + 1 biométrico + 10 cámaras = 14 activos, y 5 empleados.`);
  console.log(
    sucias.rowCount === 0
      ? "  ✔ Verificado: ninguna tiene perfil, clasificación ni evaluación LOPDP."
      : `  ✘ ATENCIÓN: ${sucias.rowCount} empresa(s) tienen datos LOPDP.`,
  );
  console.log("=".repeat(80));

  await pool.end();
  if (sucias.rowCount !== 0) process.exit(1);
}

main().catch(async (e) => {
  console.error("ERROR:", e);
  try { await pool.end(); } catch { /* ignorar */ }
  process.exit(1);
});
