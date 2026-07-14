require("dotenv").config();

const fs = require("fs");
const crypto = require("crypto");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BEGROUP_ID = "a973f81c-68d4-4ab4-be96-7ba67d112032";
const KEVIN_USER_ID = "a9588089-85f4-493f-979e-fbc80f34919b";
const SOCKET_RUC = "2390633869001";
const SOCKET_NAME = "Socket Studio";

const ASSET_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const CATEGORY_YEARS = new Map([
  ["equipos de cómputo", 3],
  ["monitores y pantallas", 3],
  ["impresoras y escáneres", 3],
  ["periféricos", 3],
  ["cámaras de seguridad", 10],
  ["energía y ups", 10],
  ["climatización", 10],
  ["otros equipos", 10],
]);

const categoryCache = new Map();

function readCargaFile(filePath) {
  if (!filePath) {
    throw new Error(
      "Uso: node tools/loader-carga.cjs <ruta-a-carga.json>"
    );
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);

  const socketApps = data.socketApps;
  const begroupApps = data.begroupApps;
  const begroupAssets = data.begroupAssets;

  if (!Array.isArray(socketApps)) {
    throw new Error("El JSON debe contener socketApps como arreglo.");
  }

  if (!Array.isArray(begroupApps)) {
    throw new Error("El JSON debe contener begroupApps como arreglo.");
  }

  if (!Array.isArray(begroupAssets)) {
    throw new Error("El JSON debe contener begroupAssets como arreglo.");
  }

  return { socketApps, begroupApps, begroupAssets };
}

function createRandomAssetCode() {
  let suffix = "";

  for (let index = 0; index < 8; index += 1) {
    const alphabetIndex = crypto.randomInt(0, ASSET_CODE_ALPHABET.length);
    suffix += ASSET_CODE_ALPHABET[alphabetIndex];
  }

  return `AST-${suffix}`;
}

async function genAssetCode(client) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const assetCode = createRandomAssetCode();
    const existing = await client.query(
      "SELECT 1 FROM assets WHERE asset_code = $1 LIMIT 1",
      [assetCode]
    );

    if (existing.rowCount === 0) {
      return assetCode;
    }
  }

  throw new Error(
    "No fue posible generar un código de activo único después de 6 intentos."
  );
}

function getDefaultCategoryYears(name) {
  const normalizedName = String(name).trim().toLocaleLowerCase("es");
  return CATEGORY_YEARS.get(normalizedName) ?? 3;
}

async function getOrCreateCategory(client, companyId, name, years) {
  const categoryName = String(name || "Otros equipos").trim() || "Otros equipos";
  const cacheKey = `${companyId}:${categoryName.toLocaleLowerCase("es")}`;

  if (categoryCache.has(cacheKey)) {
    return categoryCache.get(cacheKey);
  }

  const existing = await client.query(
    `SELECT id
     FROM asset_categories
     WHERE company_id = $1
       AND LOWER(name) = LOWER($2)
     LIMIT 1`,
    [companyId, categoryName]
  );

  if (existing.rowCount > 0) {
    const categoryId = existing.rows[0].id;
    categoryCache.set(cacheKey, categoryId);
    return categoryId;
  }

  const depreciationYears =
    years == null ? getDefaultCategoryYears(categoryName) : years;

  const inserted = await client.query(
    `INSERT INTO asset_categories (
       company_id,
       name,
       depreciation_years
     )
     VALUES ($1, $2, $3)
     RETURNING id`,
    [companyId, categoryName, depreciationYears]
  );

  const categoryId = inserted.rows[0].id;
  categoryCache.set(cacheKey, categoryId);
  return categoryId;
}

async function insertCustomFields(client, companyId, assetId, fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return;
  }

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const fieldName = String((field && field.fieldName) || "").trim();
    if (!fieldName) continue;
    const fieldValue = String((field && field.fieldValue) ?? "");

    await client.query(
      `INSERT INTO asset_custom_fields (
         company_id, asset_id, field_name, field_value, sort_order
       ) VALUES ($1, $2, $3, $4, $5)`,
      [companyId, assetId, fieldName, fieldValue, index]
    );
  }
}

async function insertApplication(client, companyId, app) {
  if (!app || typeof app !== "object") {
    throw new Error("Se encontró una aplicación inválida en el archivo JSON.");
  }

  if (!app.name) {
    throw new Error("Todas las aplicaciones deben tener un nombre.");
  }

  const assetCode = await genAssetCode(client);

  const inserted = await client.query(
    `INSERT INTO assets (
       company_id,
       name,
       type,
       status,
       application_type,
       provider,
       manufacturer,
       billing_cycle,
       monthly_cost,
       annual_cost,
       purpose,
       payment_method,
       card_name,
       bank_name,
       renewal_type,
       renewal_date,
       asset_code
     )
     VALUES (
       $1,
       $2,
       'application',
       'active',
       'saas',
       $3,
       $3,
       $4,
       $5,
       $6,
       $7,
       $8,
       $9,
       NULL,
       $10,
       NULL,
       $11
     )
     RETURNING id`,
    [
      companyId,
      app.name,
      app.provider ?? null,
      app.billingCycle ?? null,
      app.monthlyCost ?? 0,
      app.annualCost ?? 0,
      app.purpose ?? null,
      app.paymentMethod ?? null,
      app.cardName || null,
      app.renewalType || "manual",
      assetCode,
    ]
  );

  await insertCustomFields(client, companyId, inserted.rows[0].id, app.customFields);
}

async function insertAsset(client, asset) {
  if (!asset || typeof asset !== "object") {
    throw new Error("Se encontró un activo físico inválido en el archivo JSON.");
  }

  if (!asset.name) {
    throw new Error("Todos los activos físicos deben tener un nombre.");
  }

  const categoryId = await getOrCreateCategory(
    client,
    BEGROUP_ID,
    asset.category
  );
  const assetCode = await genAssetCode(client);

  const inserted = await client.query(
    `INSERT INTO assets (
       company_id,
       name,
       type,
       status,
       description,
       location,
       assigned_to,
       category_id,
       asset_code,
       purchase_cost,
       residual_value
     )
     VALUES (
       $1,
       $2,
       'physical',
       'active',
       $3,
       $4,
       $5,
       $6,
       $7,
       0,
       0
     )
     RETURNING id`,
    [
      BEGROUP_ID,
      asset.name,
      asset.description ?? null,
      asset.location ?? null,
      asset.assignedTo ?? null,
      categoryId,
      assetCode,
    ]
  );

  await insertCustomFields(client, BEGROUP_ID, inserted.rows[0].id, asset.customFields);
}

async function insertApplications(
  client,
  companyId,
  applications,
  label
) {
  console.log(`Insertando ${applications.length} aplicaciones de ${label}...`);

  for (let index = 0; index < applications.length; index += 1) {
    await insertApplication(client, companyId, applications[index]);

    const completed = index + 1;
    if (completed % 25 === 0 || completed === applications.length) {
      console.log(
        `  ${label}: ${completed}/${applications.length} aplicaciones insertadas.`
      );
    }
  }
}

async function insertPhysicalAssets(client, assets) {
  console.log(`Insertando ${assets.length} equipos físicos de BEGROUP...`);

  for (let index = 0; index < assets.length; index += 1) {
    await insertAsset(client, assets[index]);

    const completed = index + 1;
    if (completed % 25 === 0 || completed === assets.length) {
      console.log(
        `  BEGROUP: ${completed}/${assets.length} equipos físicos insertados.`
      );
    }
  }
}

async function deleteBegroupData(client) {
  console.log("PASO 1 — Borrando datos existentes de BEGROUP...");

  await client.query(
    "DELETE FROM asset_photos WHERE company_id = $1",
    [BEGROUP_ID]
  );
  await client.query(
    "DELETE FROM asset_custom_fields WHERE company_id = $1",
    [BEGROUP_ID]
  );
  await client.query(
    "DELETE FROM maintenance_lines WHERE company_id = $1",
    [BEGROUP_ID]
  );
  await client.query(
    "DELETE FROM maintenance_records WHERE company_id = $1",
    [BEGROUP_ID]
  );
  await client.query(
    `DELETE FROM contract_assets
     WHERE contract_id IN (
       SELECT id
       FROM contracts
       WHERE company_id = $1
     )`,
    [BEGROUP_ID]
  );
  await client.query(
    "DELETE FROM contracts WHERE company_id = $1",
    [BEGROUP_ID]
  );

  const deletedLicenses = await client.query(
    "DELETE FROM licenses WHERE company_id = $1",
    [BEGROUP_ID]
  );
  const deletedAssets = await client.query(
    "DELETE FROM assets WHERE company_id = $1",
    [BEGROUP_ID]
  );

  console.log(`  Assets borrados: ${deletedAssets.rowCount}`);
  console.log(`  Licenses borradas: ${deletedLicenses.rowCount}`);
}

async function ensureSocketCompany(client) {
  console.log("PASO 2 — Creando o asegurando empresa Socket Studio...");

  const existing = await client.query(
    `SELECT id
     FROM companies
     WHERE ruc = $1
        OR LOWER(name) = LOWER($2)
     ORDER BY CASE WHEN ruc = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [SOCKET_RUC, SOCKET_NAME]
  );

  let socketId;

  if (existing.rowCount > 0) {
    socketId = existing.rows[0].id;
    console.log(`  Socket Studio ya existe: ${socketId}`);
  } else {
    const inserted = await client.query(
      `INSERT INTO companies (
         name,
         description,
         plan,
         max_users,
         max_assets,
         is_active,
         ruc
       )
       VALUES (
         $1,
         'Empresa Socket Studio',
         'pyme',
         10,
         500,
         TRUE,
         $2
       )
       RETURNING id`,
      [SOCKET_NAME, SOCKET_RUC]
    );

    socketId = inserted.rows[0].id;
    console.log(`  Socket Studio creada: ${socketId}`);
  }

  const existingLink = await client.query(
    `SELECT 1
     FROM user_companies
     WHERE user_id = $1
       AND company_id = $2
     LIMIT 1`,
    [KEVIN_USER_ID, socketId]
  );

  if (existingLink.rowCount === 0) {
    await client.query(
      `INSERT INTO user_companies (
         user_id,
         company_id,
         role
       )
       VALUES ($1, $2, 'manager_owner')`,
      [KEVIN_USER_ID, socketId]
    );
    console.log("  Usuario Kevin vinculado como manager_owner.");
  } else {
    console.log("  El usuario Kevin ya está vinculado a Socket Studio.");
  }

  // Idempotencia: si Socket ya tenía aplicaciones de una corrida previa, se
  // borran para no duplicarlas (los custom fields caen por ON DELETE CASCADE).
  const deletedSocketApps = await client.query(
    "DELETE FROM assets WHERE company_id = $1 AND type = 'application'",
    [socketId]
  );
  console.log(`  Aplicaciones previas de Socket borradas: ${deletedSocketApps.rowCount}`);

  return socketId;
}

async function printVerification(client, socketId) {
  console.log("PASO 5 — Verificando conteos finales...");

  const begroupAssets = await client.query(
    `SELECT type, COUNT(*)::integer AS total
     FROM assets
     WHERE company_id = $1
     GROUP BY type
     ORDER BY type`,
    [BEGROUP_ID]
  );

  const socketAssets = await client.query(
    `SELECT type, COUNT(*)::integer AS total
     FROM assets
     WHERE company_id = $1
     GROUP BY type
     ORDER BY type`,
    [socketId]
  );

  const begroupLicenses = await client.query(
    `SELECT COUNT(*)::integer AS total
     FROM licenses
     WHERE company_id = $1`,
    [BEGROUP_ID]
  );

  console.log("  BEGROUP assets por tipo:");
  if (begroupAssets.rows.length === 0) {
    console.log("    Sin assets.");
  } else {
    for (const row of begroupAssets.rows) {
      console.log(`    ${row.type}: ${row.total}`);
    }
  }

  console.log("  Socket Studio assets por tipo:");
  if (socketAssets.rows.length === 0) {
    console.log("    Sin assets.");
  } else {
    for (const row of socketAssets.rows) {
      console.log(`    ${row.type}: ${row.total}`);
    }
  }

  console.log(`  BEGROUP licenses: ${begroupLicenses.rows[0].total}`);
  console.log(`  SOCKET_ID: ${socketId}`);
  console.log("CARGA COMPLETA");
}

async function main() {
  let client;
  let transactionStarted = false;
  let failure = null;

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL no está definida en el archivo .env.");
    }

    const { socketApps, begroupApps, begroupAssets } = readCargaFile(
      process.argv[2]
    );

    console.log("Iniciando carga de datos...");
    console.log(`  Socket Studio apps: ${socketApps.length}`);
    console.log(`  BEGROUP apps: ${begroupApps.length}`);
    console.log(`  BEGROUP equipos físicos: ${begroupAssets.length}`);

    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    await deleteBegroupData(client);
    const socketId = await ensureSocketCompany(client);

    console.log("PASO 3 — Insertando aplicaciones...");
    await insertApplications(
      client,
      socketId,
      socketApps,
      "Socket Studio"
    );
    await insertApplications(
      client,
      BEGROUP_ID,
      begroupApps,
      "BEGROUP"
    );

    console.log("PASO 4 — Insertando equipos físicos...");
    await insertPhysicalAssets(client, begroupAssets);

    await client.query("COMMIT");
    transactionStarted = false;
    console.log("Transacción confirmada correctamente.");

    await printVerification(client, socketId);
  } catch (error) {
    failure = error;

    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
        console.error("Transacción revertida con ROLLBACK.");
      } catch (rollbackError) {
        console.error("También falló el ROLLBACK:", rollbackError);
      }
    }

    console.error("ERROR EN LA CARGA:", error);
  } finally {
    if (client) {
      client.release();
    }

    await pool.end();
  }

  if (failure) {
    process.exit(1);
  }
}

main();