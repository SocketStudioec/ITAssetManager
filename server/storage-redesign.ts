import { customAlphabet } from "nanoid";
import { pool } from "./db";
import {
  computeDepreciation,
  normalizeToMonthly,
} from "./depreciation";

type DatabaseRow = Record<string, unknown>;

interface AssetPhotoInput {
  filePath: string;
  originalName: string;
}

interface CustomFieldInput {
  fieldName: string;
  fieldValue: string;
}

interface MaintenanceLineInput {
  description: string;
  quantity: number;
  unitCost: number;
}

interface ReportApplication {
  name: string;
  purpose: string;
  monthlyCost: number;
}

interface ReportPhysicalAsset {
  name: string;
  assetCode: string;
  monthlyDepreciation: number;
  maintenanceMonthly: number;
}

interface ManualRenewal {
  key: string;
  name: string;
  kind: "license" | "application";
  date: string;
  daysLeft: number;
  purpose: string;
}

const DEFAULT_CATEGORIES = [
  { name: "Equipos de cómputo", depreciationYears: 3 },
  { name: "Servidores y redes", depreciationYears: 3 },
  { name: "Impresoras y escáneres", depreciationYears: 3 },
  { name: "Cámaras de seguridad", depreciationYears: 10 },
  { name: "Biométricos y control de acceso", depreciationYears: 10 },
  { name: "Telefonía y comunicaciones", depreciationYears: 10 },
  { name: "Vehículos", depreciationYears: 5 },
] as const;

const generateCodePart = customAlphabet(
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  8
);

function mapRowToCamel<T = Record<string, unknown>>(row: DatabaseRow): T {
  const mapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_match, character: string) =>
      character.toUpperCase()
    );
    mapped[camelKey] = value;
  }

  return mapped as T;
}

function mapRowsToCamel<T = Record<string, unknown>>(
  rows: DatabaseRow[]
): T[] {
  return rows.map((row) => mapRowToCamel<T>(row));
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validateCompanyId(companyId: string): void {
  if (!companyId?.trim()) {
    throw new Error("La empresa es obligatoria.");
  }
}

function validatePositiveYears(depreciationYears: number): void {
  if (
    !Number.isInteger(depreciationYears) ||
    depreciationYears <= 0
  ) {
    throw new Error(
      "Los años de depreciación deben ser un número entero mayor que cero."
    );
  }
}

function normalizeDateOnly(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value ?? "").slice(0, 10);
}

export const redesignStorage = {
  /**
   * Obtiene las categorías de la empresa y crea las predeterminadas si no hay ninguna.
   */
  async getCategories(companyId: string): Promise<Record<string, unknown>[]> {
    validateCompanyId(companyId);

    const current = await pool.query(
      `SELECT id, company_id, name, depreciation_years, created_at
       FROM asset_categories
       WHERE company_id = $1
       ORDER BY LOWER(name), name`,
      [companyId]
    );

    if (current.rows.length > 0) {
      return mapRowsToCamel(current.rows);
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const category of DEFAULT_CATEGORIES) {
        const existing = await client.query(
          `SELECT id
           FROM asset_categories
           WHERE company_id = $1
             AND LOWER(name) = LOWER($2)
           LIMIT 1`,
          [companyId, category.name]
        );

        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO asset_categories
               (company_id, name, depreciation_years)
             VALUES ($1, $2, $3)`,
            [companyId, category.name, category.depreciationYears]
          );
        }
      }

      const seeded = await client.query(
        `SELECT id, company_id, name, depreciation_years, created_at
         FROM asset_categories
         WHERE company_id = $1
         ORDER BY LOWER(name), name`,
        [companyId]
      );

      await client.query("COMMIT");
      return mapRowsToCamel(seeded.rows);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(
        `No se pudieron crear las categorías predeterminadas: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      client.release();
    }
  },

  /**
   * Crea una categoría o devuelve la categoría homónima existente.
   */
  async createCategory(
    companyId: string,
    name: string,
    depreciationYears: number
  ): Promise<Record<string, unknown>> {
    validateCompanyId(companyId);
    const normalizedName = name?.trim();

    if (!normalizedName) {
      throw new Error("El nombre de la categoría no puede estar vacío.");
    }

    validatePositiveYears(depreciationYears);

    const existing = await pool.query(
      `SELECT id, company_id, name, depreciation_years, created_at
       FROM asset_categories
       WHERE company_id = $1
         AND LOWER(name) = LOWER($2)
       LIMIT 1`,
      [companyId, normalizedName]
    );

    if (existing.rows[0]) {
      return mapRowToCamel(existing.rows[0]);
    }

    try {
      const inserted = await pool.query(
        `INSERT INTO asset_categories
           (company_id, name, depreciation_years)
         VALUES ($1, $2, $3)
         RETURNING id, company_id, name, depreciation_years, created_at`,
        [companyId, normalizedName, depreciationYears]
      );

      return mapRowToCamel(inserted.rows[0]);
    } catch (error) {
      const databaseError = error as { code?: string };

      if (databaseError.code === "23505") {
        const concurrent = await pool.query(
          `SELECT id, company_id, name, depreciation_years, created_at
           FROM asset_categories
           WHERE company_id = $1
             AND LOWER(name) = LOWER($2)
           LIMIT 1`,
          [companyId, normalizedName]
        );

        if (concurrent.rows[0]) {
          return mapRowToCamel(concurrent.rows[0]);
        }
      }

      throw new Error(
        `No se pudo crear la categoría: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },

  /**
   * Actualiza una categoría perteneciente a la empresa.
   */
  async updateCategory(
    companyId: string,
    categoryId: string,
    name: string,
    depreciationYears: number
  ): Promise<Record<string, unknown>> {
    validateCompanyId(companyId);
    const normalizedName = name?.trim();

    if (!normalizedName) {
      throw new Error("El nombre de la categoría no puede estar vacío.");
    }

    validatePositiveYears(depreciationYears);

    const duplicate = await pool.query(
      `SELECT id
       FROM asset_categories
       WHERE company_id = $1
         AND LOWER(name) = LOWER($2)
         AND id <> $3
       LIMIT 1`,
      [companyId, normalizedName, categoryId]
    );

    if (duplicate.rows.length > 0) {
      throw new Error("Ya existe una categoría con ese nombre.");
    }

    const updated = await pool.query(
      `UPDATE asset_categories
       SET name = $3,
           depreciation_years = $4
       WHERE company_id = $1
         AND id = $2
       RETURNING id, company_id, name, depreciation_years, created_at`,
      [companyId, categoryId, normalizedName, depreciationYears]
    );

    if (!updated.rows[0]) {
      throw new Error("La categoría no existe o no pertenece a la empresa.");
    }

    return mapRowToCamel(updated.rows[0]);
  },

  /**
   * Elimina una categoría únicamente cuando no está asignada a activos.
   */
  async deleteCategory(
    companyId: string,
    categoryId: string
  ): Promise<boolean> {
    validateCompanyId(companyId);

    const category = await pool.query(
      `SELECT id
       FROM asset_categories
       WHERE company_id = $1
         AND id = $2`,
      [companyId, categoryId]
    );

    if (!category.rows[0]) {
      throw new Error("La categoría no existe o no pertenece a la empresa.");
    }

    const assets = await pool.query(
      `SELECT COUNT(*)::INTEGER AS total
       FROM assets
       WHERE company_id = $1
         AND category_id = $2`,
      [companyId, categoryId]
    );

    if (toNumber(assets.rows[0]?.total) > 0) {
      throw new Error(
        "No se puede eliminar la categoría porque tiene activos asignados."
      );
    }

    const deleted = await pool.query(
      `DELETE FROM asset_categories
       WHERE company_id = $1
         AND id = $2
       RETURNING id`,
      [companyId, categoryId]
    );

    return deleted.rows.length > 0;
  },

  /**
   * Genera un código AST globalmente único, sin caracteres ambiguos.
   */
  async generateAssetCode(companyId: string): Promise<string> {
    validateCompanyId(companyId);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const assetCode = `AST-${generateCodePart()}`;
      const existing = await pool.query(
        `SELECT id
         FROM assets
         WHERE asset_code = $1
         LIMIT 1`,
        [assetCode]
      );

      if (existing.rows.length === 0) {
        return assetCode;
      }
    }

    throw new Error(
      "No se pudo generar un código único para el activo después de 5 intentos."
    );
  },

  /**
   * Agrega varias fotos a un activo perteneciente a la empresa.
   */
  async addAssetPhotos(
    companyId: string,
    assetId: string,
    files: AssetPhotoInput[]
  ): Promise<Record<string, unknown>[]> {
    validateCompanyId(companyId);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const asset = await client.query(
        `SELECT id
         FROM assets
         WHERE company_id = $1
           AND id = $2
         FOR UPDATE`,
        [companyId, assetId]
      );

      if (!asset.rows[0]) {
        throw new Error("El activo no existe o no pertenece a la empresa.");
      }

      const insertedRows: DatabaseRow[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];

        if (!file.filePath?.trim()) {
          throw new Error("La ruta de cada foto es obligatoria.");
        }

        const inserted = await client.query(
          `INSERT INTO asset_photos
             (company_id, asset_id, file_path, original_name, sort_order)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, company_id, asset_id, file_path, original_name,
                     sort_order, created_at`,
          [
            companyId,
            assetId,
            file.filePath.trim(),
            file.originalName?.trim() || null,
            index,
          ]
        );

        insertedRows.push(inserted.rows[0]);
      }

      await client.query("COMMIT");
      return mapRowsToCamel(insertedRows);
    } catch (error) {
      await client.query("ROLLBACK");

      if (error instanceof Error) {
        throw error;
      }

      throw new Error("No se pudieron guardar las fotos del activo.");
    } finally {
      client.release();
    }
  },

  /**
   * Obtiene las fotos de un activo de la empresa.
   */
  async getAssetPhotos(
    companyId: string,
    assetId: string
  ): Promise<Record<string, unknown>[]> {
    validateCompanyId(companyId);

    const photos = await pool.query(
      `SELECT id, company_id, asset_id, file_path, original_name,
              sort_order, created_at
       FROM asset_photos
       WHERE company_id = $1
         AND asset_id = $2
       ORDER BY sort_order, created_at, id`,
      [companyId, assetId]
    );

    return mapRowsToCamel(photos.rows);
  },

  /**
   * Elimina una foto y devuelve su ruta física relativa.
   */
  async deleteAssetPhoto(
    companyId: string,
    photoId: string
  ): Promise<string | null> {
    validateCompanyId(companyId);

    const deleted = await pool.query(
      `DELETE FROM asset_photos
       WHERE company_id = $1
         AND id = $2
       RETURNING file_path`,
      [companyId, photoId]
    );

    return deleted.rows[0]?.file_path
      ? String(deleted.rows[0].file_path)
      : null;
  },

  /**
   * Reemplaza en transacción todos los campos personalizados de un activo.
   */
  async replaceCustomFields(
    companyId: string,
    assetId: string,
    fields: CustomFieldInput[]
  ): Promise<Record<string, unknown>[]> {
    validateCompanyId(companyId);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const asset = await client.query(
        `SELECT id
         FROM assets
         WHERE company_id = $1
           AND id = $2
         FOR UPDATE`,
        [companyId, assetId]
      );

      if (!asset.rows[0]) {
        throw new Error("El activo no existe o no pertenece a la empresa.");
      }

      await client.query(
        `DELETE FROM asset_custom_fields
         WHERE company_id = $1
           AND asset_id = $2`,
        [companyId, assetId]
      );

      const insertedRows: DatabaseRow[] = [];

      for (let index = 0; index < fields.length; index += 1) {
        const field = fields[index];
        const fieldName = field.fieldName?.trim();

        if (!fieldName) {
          throw new Error(
            `El nombre del campo personalizado ${index + 1} está vacío.`
          );
        }

        const inserted = await client.query(
          `INSERT INTO asset_custom_fields
             (company_id, asset_id, field_name, field_value, sort_order)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, company_id, asset_id, field_name, field_value,
                     sort_order, created_at`,
          [
            companyId,
            assetId,
            fieldName,
            field.fieldValue ?? "",
            index,
          ]
        );

        insertedRows.push(inserted.rows[0]);
      }

      await client.query("COMMIT");
      return mapRowsToCamel(insertedRows);
    } catch (error) {
      await client.query("ROLLBACK");

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        "No se pudieron reemplazar los campos personalizados."
      );
    } finally {
      client.release();
    }
  },

  /**
   * Obtiene los campos personalizados de un activo.
   */
  async getCustomFields(
    companyId: string,
    assetId: string
  ): Promise<Record<string, unknown>[]> {
    validateCompanyId(companyId);

    const fields = await pool.query(
      `SELECT id, company_id, asset_id, field_name, field_value,
              sort_order, created_at
       FROM asset_custom_fields
       WHERE company_id = $1
         AND asset_id = $2
       ORDER BY sort_order, created_at, id`,
      [companyId, assetId]
    );

    return mapRowsToCamel(fields.rows);
  },

  /**
   * Reemplaza las líneas de detalle de un mantenimiento.
   */
  async replaceMaintenanceLines(
    companyId: string,
    maintenanceId: string,
    lines: MaintenanceLineInput[]
  ): Promise<Record<string, unknown>[]> {
    validateCompanyId(companyId);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const maintenance = await client.query(
        `SELECT id
         FROM maintenance_records
         WHERE company_id = $1
           AND id = $2
         FOR UPDATE`,
        [companyId, maintenanceId]
      );

      if (!maintenance.rows[0]) {
        throw new Error(
          "El mantenimiento no existe o no pertenece a la empresa."
        );
      }

      await client.query(
        `DELETE FROM maintenance_lines
         WHERE company_id = $1
           AND maintenance_id = $2`,
        [companyId, maintenanceId]
      );

      const insertedRows: DatabaseRow[] = [];

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const description = line.description?.trim();
        const quantity = toNumber(line.quantity);
        const unitCost = toNumber(line.unitCost);

        if (!description) {
          throw new Error(
            `La descripción de la línea ${index + 1} está vacía.`
          );
        }

        if (quantity <= 0) {
          throw new Error(
            `La cantidad de la línea ${index + 1} debe ser mayor que cero.`
          );
        }

        if (unitCost < 0) {
          throw new Error(
            `El costo unitario de la línea ${index + 1} no puede ser negativo.`
          );
        }

        const total = roundMoney(quantity * unitCost);
        const inserted = await client.query(
          `INSERT INTO maintenance_lines
             (company_id, maintenance_id, description, quantity,
              unit_cost, total, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, company_id, maintenance_id, description, quantity,
                     unit_cost, total, sort_order, created_at`,
          [
            companyId,
            maintenanceId,
            description,
            quantity,
            unitCost,
            total,
            index,
          ]
        );

        insertedRows.push(inserted.rows[0]);
      }

      await client.query("COMMIT");
      return mapRowsToCamel(insertedRows);
    } catch (error) {
      await client.query("ROLLBACK");

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        "No se pudieron reemplazar las líneas de mantenimiento."
      );
    } finally {
      client.release();
    }
  },

  /**
   * Obtiene las líneas de un mantenimiento de la empresa.
   */
  async getMaintenanceLines(
    companyId: string,
    maintenanceId: string
  ): Promise<Record<string, unknown>[]> {
    validateCompanyId(companyId);

    const lines = await pool.query(
      `SELECT id, company_id, maintenance_id, description, quantity,
              unit_cost, total, sort_order, created_at
       FROM maintenance_lines
       WHERE company_id = $1
         AND maintenance_id = $2
       ORDER BY sort_order, created_at, id`,
      [companyId, maintenanceId]
    );

    return mapRowsToCamel(lines.rows);
  },

  /**
   * Suma el costo principal y las líneas de todos los mantenimientos del activo.
   */
  async getMaintenanceCostByAsset(
    companyId: string,
    assetId: string
  ): Promise<{ totalMaintenance: number }> {
    validateCompanyId(companyId);

    const result = await pool.query(
      `SELECT
         a.id,
         COALESCE((
           SELECT SUM(COALESCE(mr.cost, 0))
           FROM maintenance_records mr
           WHERE mr.company_id = $1
             AND mr.asset_id = a.id
         ), 0) +
         COALESCE((
           SELECT SUM(COALESCE(ml.total, 0))
           FROM maintenance_lines ml
           JOIN maintenance_records mr
             ON mr.id = ml.maintenance_id
            AND mr.company_id = $1
           WHERE ml.company_id = $1
             AND mr.asset_id = a.id
         ), 0) AS total_maintenance
       FROM assets a
       WHERE a.company_id = $1
         AND a.id = $2`,
      [companyId, assetId]
    );

    if (!result.rows[0]) {
      throw new Error("El activo no existe o no pertenece a la empresa.");
    }

    return {
      totalMaintenance: roundMoney(
        toNumber(result.rows[0].total_maintenance)
      ),
    };
  },

  /**
   * Obtiene la vista pública y no financiera de un activo mediante su código.
   */
  async getPublicAssetByCode(
    assetCode: string
  ): Promise<Record<string, unknown> | null> {
    const normalizedCode = assetCode?.trim().toUpperCase();

    if (!normalizedCode) {
      throw new Error("El código del activo es obligatorio.");
    }

    const assetResult = await pool.query(
      `SELECT
         a.id,
         a.company_id,
         a.name,
         a.asset_code,
         ac.name AS category_name,
         a.manufacturer,
         a.model,
         a.serial_number,
         a.location,
         a.status,
         a.purchase_date,
         a.warranty_expiry,
         c.name AS company_name
       FROM assets a
       JOIN companies c
         ON c.id = a.company_id
       LEFT JOIN asset_categories ac
         ON ac.id = a.category_id
        AND ac.company_id = a.company_id
       WHERE UPPER(a.asset_code) = $1
       LIMIT 1`,
      [normalizedCode]
    );

    if (!assetResult.rows[0]) {
      return null;
    }

    const asset = assetResult.rows[0];
    const companyId = String(asset.company_id);
    const assetId = String(asset.id);

    const [photosResult, fieldsResult] = await Promise.all([
      pool.query(
        `SELECT file_path, original_name
         FROM asset_photos
         WHERE company_id = $1
           AND asset_id = $2
         ORDER BY sort_order, created_at, id`,
        [companyId, assetId]
      ),
      pool.query(
        `SELECT field_name, field_value
         FROM asset_custom_fields
         WHERE company_id = $1
           AND asset_id = $2
         ORDER BY sort_order, created_at, id`,
        [companyId, assetId]
      ),
    ]);

    return {
      name: asset.name,
      assetCode: asset.asset_code,
      categoryName: asset.category_name,
      manufacturer: asset.manufacturer,
      model: asset.model,
      serialNumber: asset.serial_number,
      location: asset.location,
      status: asset.status,
      purchaseDate: asset.purchase_date,
      warrantyExpiry: asset.warranty_expiry,
      companyName: asset.company_name,
      photos: mapRowsToCamel(photosResult.rows),
      customFields: mapRowsToCamel(fieldsResult.rows),
    };
  },

  /**
   * Construye los costos mensuales de aplicaciones y activos físicos.
   */
  async getBiweeklyReportData(companyId: string): Promise<{
    applications: ReportApplication[];
    physicalAssets: ReportPhysicalAsset[];
    totals: {
      applicationsMonthly: number;
      physicalMonthly: number;
      grandTotal: number;
    };
  }> {
    validateCompanyId(companyId);

    const [
      applicationAssetsResult,
      licensesResult,
      physicalAssetsResult,
      maintenanceResult,
    ] = await Promise.all([
      pool.query(
        `SELECT name, purpose, monthly_cost, annual_cost, billing_cycle
         FROM assets
         WHERE company_id = $1
           AND type = 'application'
           AND status = 'active'
         ORDER BY LOWER(name), name`,
        [companyId]
      ),
      pool.query(
        `SELECT name, purpose, monthly_cost, annual_cost, billing_cycle
         FROM licenses
         WHERE company_id = $1
           AND status = 'active'
         ORDER BY LOWER(name), name`,
        [companyId]
      ),
      pool.query(
        `SELECT
           a.id,
           a.name,
           a.asset_code,
           a.purchase_cost,
           a.residual_value,
           a.purchase_date,
           COALESCE(a.depreciation_years, ac.depreciation_years, 3)
             AS depreciation_years
         FROM assets a
         LEFT JOIN asset_categories ac
           ON ac.id = a.category_id
          AND ac.company_id = $1
         WHERE a.company_id = $1
           AND a.type = 'physical'
           AND a.status = 'active'
           AND COALESCE(a.purchase_cost, 0) > 0
         ORDER BY LOWER(a.name), a.name`,
        [companyId]
      ),
      pool.query(
        `WITH line_totals AS (
           SELECT
             ml.maintenance_id,
             SUM(COALESCE(ml.total, 0)) AS lines_total
           FROM maintenance_lines ml
           WHERE ml.company_id = $1
           GROUP BY ml.maintenance_id
         )
         SELECT
           mr.asset_id,
           SUM(
             COALESCE(mr.cost, 0) +
             COALESCE(lt.lines_total, 0)
           ) AS maintenance_total
         FROM maintenance_records mr
         LEFT JOIN line_totals lt
           ON lt.maintenance_id = mr.id
         WHERE mr.company_id = $1
           AND COALESCE(mr.completed_date, mr.scheduled_date, mr.created_at)
               >= CURRENT_DATE - INTERVAL '12 months'
         GROUP BY mr.asset_id`,
        [companyId]
      ),
    ]);

    const applications: ReportApplication[] = [
      ...applicationAssetsResult.rows,
      ...licensesResult.rows,
    ].map((row) => {
      const monthlyCost = toNumber(row.monthly_cost);
      const annualCost = toNumber(row.annual_cost);
      const normalized =
        monthlyCost > 0
          ? monthlyCost
          : normalizeToMonthly(
              annualCost,
              row.billing_cycle ? String(row.billing_cycle) : null
            );

      return {
        name: String(row.name ?? ""),
        purpose: String(row.purpose ?? ""),
        monthlyCost: roundMoney(normalized),
      };
    });

    const maintenanceByAsset = new Map<string, number>();
    for (const row of maintenanceResult.rows) {
      maintenanceByAsset.set(
        String(row.asset_id),
        toNumber(row.maintenance_total)
      );
    }

    const physicalAssets: ReportPhysicalAsset[] =
      physicalAssetsResult.rows.map((row) => {
        const depreciation = computeDepreciation({
          purchaseCost: toNumber(row.purchase_cost),
          residualValue: toNumber(row.residual_value),
          depreciationYears: toNumber(row.depreciation_years) || 3,
          purchaseDate:
            row.purchase_date instanceof Date ||
            typeof row.purchase_date === "string"
              ? row.purchase_date
              : null,
        });
        const maintenanceTotal =
          maintenanceByAsset.get(String(row.id)) ?? 0;

        return {
          name: String(row.name ?? ""),
          assetCode: String(row.asset_code ?? ""),
          monthlyDepreciation: depreciation.fullyDepreciated
            ? 0
            : depreciation.monthlyDepreciation,
          maintenanceMonthly: roundMoney(maintenanceTotal / 12),
        };
      });

    const applicationsMonthly = roundMoney(
      applications.reduce((total, item) => total + item.monthlyCost, 0)
    );
    const physicalMonthly = roundMoney(
      physicalAssets.reduce(
        (total, item) =>
          total + item.monthlyDepreciation + item.maintenanceMonthly,
        0
      )
    );

    return {
      applications,
      physicalAssets,
      totals: {
        applicationsMonthly,
        physicalMonthly,
        grandTotal: roundMoney(
          applicationsMonthly + physicalMonthly
        ),
      },
    };
  },

  /**
   * Obtiene la configuración del informe quincenal de la empresa.
   */
  async getReportSettings(companyId: string): Promise<{
    enabled: boolean;
    emails: string;
  }> {
    validateCompanyId(companyId);

    const settings = await pool.query(
      `SELECT
         biweekly_report_enabled,
         COALESCE(
           NULLIF(TRIM(report_recipient_emails), ''),
           recipient_emails,
           ''
         ) AS emails
       FROM company_notification_settings
       WHERE company_id = $1
       LIMIT 1`,
      [companyId]
    );

    if (!settings.rows[0]) {
      return {
        enabled: true,
        emails: "",
      };
    }

    return {
      enabled: settings.rows[0].biweekly_report_enabled !== false,
      emails: String(settings.rows[0].emails ?? ""),
    };
  },

  /**
   * Lista empresas activas que tienen habilitado el informe quincenal.
   */
  async getCompaniesForBiweeklyReport(): Promise<
    Record<string, unknown>[]
  > {
    const companies = await pool.query(
      `SELECT
         c.id,
         c.name,
         COALESCE(
           NULLIF(TRIM(cns.report_recipient_emails), ''),
           cns.recipient_emails,
           ''
         ) AS report_recipient_emails
       FROM companies c
       LEFT JOIN company_notification_settings cns
         ON cns.company_id = c.id
       WHERE c.is_active = TRUE
         AND COALESCE(cns.biweekly_report_enabled, TRUE) = TRUE
       ORDER BY LOWER(c.name), c.name`
    );

    return mapRowsToCamel(companies.rows);
  },

  /**
   * Comprueba si una clave de informe ya fue registrada para la empresa.
   */
  async wasReportSent(
    companyId: string,
    key: string
  ): Promise<boolean> {
    validateCompanyId(companyId);

    if (!key?.trim()) {
      throw new Error("La clave del informe es obligatoria.");
    }

    const result = await pool.query(
      `SELECT 1
       FROM notification_email_log
       WHERE company_id = $1
         AND notification_key = $2
       LIMIT 1`,
      [companyId, key.trim()]
    );

    return result.rows.length > 0;
  },

  /**
   * Registra el envío de un informe para evitar envíos duplicados.
   */
  async logReportSent(
    companyId: string,
    key: string,
    recipients: string | string[]
  ): Promise<Record<string, unknown>> {
    validateCompanyId(companyId);

    if (!key?.trim()) {
      throw new Error("La clave del informe es obligatoria.");
    }

    const recipientsText = Array.isArray(recipients)
      ? recipients.join(", ")
      : recipients;

    const existing = await pool.query(
      `SELECT id, company_id, notification_key, recipients, sent_at
       FROM notification_email_log
       WHERE company_id = $1
         AND notification_key = $2
       LIMIT 1`,
      [companyId, key.trim()]
    );

    if (existing.rows[0]) {
      return mapRowToCamel(existing.rows[0]);
    }

    try {
      const inserted = await pool.query(
        `INSERT INTO notification_email_log
           (company_id, notification_key, recipients, sent_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, company_id, notification_key, recipients, sent_at`,
        [companyId, key.trim(), recipientsText ?? ""]
      );

      return mapRowToCamel(inserted.rows[0]);
    } catch (error) {
      const databaseError = error as { code?: string };

      if (databaseError.code === "23505") {
        const concurrent = await pool.query(
          `SELECT id, company_id, notification_key, recipients, sent_at
           FROM notification_email_log
           WHERE company_id = $1
             AND notification_key = $2
           LIMIT 1`,
          [companyId, key.trim()]
        );

        if (concurrent.rows[0]) {
          return mapRowToCamel(concurrent.rows[0]);
        }
      }

      throw new Error(
        `No se pudo registrar el envío del informe: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },

  /**
   * Obtiene renovaciones manuales próximas de licencias y aplicaciones.
   */
  async getManualRenewalsDue(
    companyId: string,
    daysAhead = 3
  ): Promise<ManualRenewal[]> {
    validateCompanyId(companyId);

    if (!Number.isInteger(daysAhead) || daysAhead < 0) {
      throw new Error(
        "Los días de anticipación deben ser un entero mayor o igual que cero."
      );
    }

    const renewals = await pool.query(
      `SELECT
         id,
         name,
         'license'::TEXT AS kind,
         TO_CHAR(expiry_date::DATE, 'YYYY-MM-DD') AS renewal_day,
         (expiry_date::DATE - CURRENT_DATE)::INTEGER AS days_left,
         COALESCE(purpose, '') AS purpose
       FROM licenses
       WHERE company_id = $1
         AND renewal_type = 'manual'
         AND status = 'active'
         AND expiry_date::DATE BETWEEN CURRENT_DATE
                                   AND CURRENT_DATE + $2::INTEGER
       UNION ALL
       SELECT
         id,
         name,
         'application'::TEXT AS kind,
         TO_CHAR(renewal_date::DATE, 'YYYY-MM-DD') AS renewal_day,
         (renewal_date::DATE - CURRENT_DATE)::INTEGER AS days_left,
         COALESCE(purpose, '') AS purpose
       FROM assets
       WHERE company_id = $1
         AND type = 'application'
         AND renewal_type = 'manual'
         AND status = 'active'
         AND renewal_date::DATE BETWEEN CURRENT_DATE
                                    AND CURRENT_DATE + $2::INTEGER
       ORDER BY renewal_day, name`,
      [companyId, daysAhead]
    );

    return renewals.rows.map((row) => {
      const date = normalizeDateOnly(row.renewal_day);
      const kind =
        row.kind === "license" ? "license" : "application";

      return {
        key: `manual-renewal:${String(row.id)}:${date}`,
        name: String(row.name ?? ""),
        kind,
        date,
        daysLeft: toNumber(row.days_left),
        purpose: String(row.purpose ?? ""),
      };
    });
  },
};