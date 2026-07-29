/**
 * SIEMBRA DE EMPRESAS DEMO DEL MÓDULO LOPDP (con usuarios que SÍ pueden entrar)
 *
 * Crea 5 empresas de los perfiles objetivo, cada una con su usuario propio,
 * sus activos clasificados y la evaluación ya ejecutada, para poder recorrer el
 * flujo completo sin configurar nada.
 *
 * Los datos son SINTÉTICOS: ninguna persona real aparece en estas empresas.
 *
 * Ejecutar:
 *   DATABASE_URL=postgres://... npx tsx scripts/seed-lopdp-demo.ts
 *
 * Borrar todo lo sembrado (una sola sentencia):
 *   DELETE FROM companies WHERE name LIKE 'DEMO LOPDP%';
 *   DELETE FROM users WHERE email LIKE '%@demo-lopdp.ec';
 */
import crypto from "crypto";
import { pool } from "../server/db";
import { lopdpStorage } from "../server/storage-lopdp";
import { DEMO_COMPANIES, type DemoCompanySpec } from "./lopdp-demo-data";

const PREFIX = "DEMO LOPDP";
const PASSWORD = process.env.LOPDP_DEMO_PASSWORD ?? "DemoLopdp2026*";

/** Mismo hashing que server/auth.ts (SHA-256 hex, sin sal). */
const hashPassword = (p: string) => crypto.createHash("sha256").update(p).digest("hex");

type DemoUser = DemoCompanySpec["user"];

async function upsertUser(u: DemoUser): Promise<string> {
  const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [u.email]);
  if (existing.rows[0]) {
    await pool.query(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
      [existing.rows[0].id, hashPassword(PASSWORD)]);
    return existing.rows[0].id;
  }
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role)
     VALUES ($1,$2,$3,$4,'manager_owner') RETURNING id`,
    [u.email, hashPassword(PASSWORD), u.firstName, u.lastName],
  );
  return rows[0].id;
}

async function main() {
  const specs = DEMO_COMPANIES;
  console.log(`\nSembrando ${specs.length} empresas demo del módulo LOPDP…\n`);

  // Limpieza de una siembra anterior (solo lo que lleva el prefijo DEMO).
  await pool.query(`DELETE FROM companies WHERE name LIKE $1`, [`${PREFIX}%`]);

  const credentials: Array<{ empresa: string; sector: string; email: string; activos: number }> = [];

  for (const spec of specs) {
    const userId = await upsertUser(spec.user);

    const { rows } = await pool.query(
      `INSERT INTO companies (name, description, plan, ruc, address, phone, email,
                              lopdp_enabled, lopdp_activated_at, max_users, max_assets)
       VALUES ($1,$2,'pyme',$3,$4,$5,$6, TRUE, NOW(), 10, 500) RETURNING id`,
      [
        `${PREFIX} — ${spec.name}`,
        `Empresa de demostración del módulo LOPDP — perfil ${spec.sector}. Datos sintéticos.`,
        spec.ruc,
        "Av. Amazonas N34-100, Quito, Ecuador",
        "0999999999",
        spec.user.email,
      ],
    );
    const companyId = rows[0].id;

    await pool.query(
      `INSERT INTO user_companies (user_id, company_id, role) VALUES ($1,$2,'manager_owner')
       ON CONFLICT DO NOTHING`,
      [userId, companyId],
    );

    for (const a of spec.assets) {
      await pool.query(
        `INSERT INTO assets (company_id, name, type, model, status, purchase_date)
         VALUES ($1,$2,$3::asset_type,$4,'active', NOW() - INTERVAL '1 year')`,
        [companyId, a.name, a.type, a.model ?? null],
      );
    }
    for (const l of spec.licenses) {
      await pool.query(
        `INSERT INTO licenses (company_id, name, vendor, billing_cycle, status, expiry_date)
         VALUES ($1,$2,$3,'annual','active', NOW() + INTERVAL '6 months')`,
        [companyId, l.name, l.vendor],
      );
    }
    for (const c of spec.contracts) {
      await pool.query(
        `INSERT INTO contracts (company_id, name, vendor, contract_type, start_date, end_date, status)
         VALUES ($1,$2,$3,$4, NOW() - INTERVAL '6 months', NOW() + INTERVAL '6 months', 'active')`,
        [companyId, c.name, c.vendor, c.type],
      );
    }

    // Perfil LOPDP
    await lopdpStorage.upsertProfile(companyId, {
      sector: spec.sector,
      legalRepName: spec.legalRep,
      employeeCount: 12,
      annualRevenueRange: spec.revenue,
      arcoChannel: `datos.${spec.key}@demo-lopdp.ec`,
      questionnaire: spec.questionnaire,
      isProcessor: spec.isProcessor,
      completed: true,
    });

    // Clasificación de todos los activos
    const rowsToClassify = await lopdpStorage.getClassifications(companyId);
    for (const row of rowsToClassify) {
      const s = spec.classify[row.entityName];
      const idField =
        row.entityKind === "asset" ? "assetId" : row.entityKind === "license" ? "licenseId" : "contractId";
      await lopdpStorage.upsertClassification(companyId, userId, {
        [idField]: row.entityId,
        hasPersonalData: Boolean(s && s.categories.length > 0),
        dataCategories: s?.categories ?? [],
        dataSubjects: s?.subjects ?? [],
        subjectCountRange: s?.count ?? null,
        storageLocation: s?.storage ?? null,
        isProcessorAsset: s?.processor === true,
      });
    }

    const assessment = await lopdpStorage.runEngine(companyId, "wizard");
    const interpretation = await lopdpStorage.getInterpretation(companyId);

    credentials.push({
      empresa: spec.name,
      sector: spec.sector,
      email: spec.user.email,
      activos: rowsToClassify.length,
    });

    console.log(
      `  ✔ ${spec.name.padEnd(36)} riesgo ${String(Number(assessment.riskScore).toFixed(0)).padStart(3)} (${assessment.riskGrade}) · ` +
      `cumplimiento ${String(Number(assessment.complianceScore).toFixed(0)).padStart(3)} (${assessment.complianceGrade}) · ` +
      `${interpretation.status}`,
    );
  }

  console.log(`\n${"=".repeat(78)}`);
  console.log("CREDENCIALES DE ACCESO (todas con la misma contraseña)");
  console.log("=".repeat(78));
  console.log(`Contraseña para todos: ${PASSWORD}\n`);
  console.log("  Empresa                              Sector        Usuario");
  console.log("  " + "-".repeat(74));
  for (const c of credentials) {
    console.log(`  ${c.empresa.slice(0, 34).padEnd(36)} ${c.sector.padEnd(13)} ${c.email}`);
  }
  console.log("\nURL: https://techassets.socket-studio.com");
  console.log("Para borrar la demo:  DELETE FROM companies WHERE name LIKE 'DEMO LOPDP%';");
  console.log("=".repeat(78));

  await pool.end();
}

main().catch(async (e) => {
  console.error("ERROR:", e);
  try { await pool.end(); } catch { /* ignorar */ }
  process.exit(1);
});
