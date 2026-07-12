import type { Express, Request, Response } from "express";
import multer from "multer";
import { isAuthenticated } from "./auth";
import { redesignStorage } from "./storage-redesign";
import { storage } from "./storage";
import {
  assetPhotoUpload,
  contractFileUpload,
  deleteUploadedFile,
} from "./uploads";
import {
  buildApplicationsTemplate,
  buildAssetsTemplate,
  parseApplicationsExcel,
  parseAssetsExcel,
  type ParsedApplicationRow,
  type ParsedAssetRow,
} from "./excel";
import { sendBiweeklyReportNow } from "./biweekly-report";
import {
  computeDepreciation,
  ECUADOR_DEPRECIATION_NOTE,
} from "./depreciation";
import { pool } from "./db";

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
    userId?: string;
  };
};

type ImportedRow = {
  __rowNumber?: number;
};

type StorageApi = typeof storage & {
  checkAssetLimit?: (
    companyId: string
  ) => Promise<
    | boolean
    | void
    | {
        allowed?: boolean;
        canCreate?: boolean;
        message?: string;
      }
  >;
};

function getUserId(request: Request): string {
  // El JWT de auth.ts guarda el id del usuario como `userId` (ver routes.ts).
  const user = (request as AuthenticatedRequest).user;
  return String(user?.userId ?? user?.id ?? "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function excelRowNumber(
  row: ParsedAssetRow | ParsedApplicationRow,
  fallback: number
): number {
  return (row as typeof row & ImportedRow).__rowNumber ?? fallback;
}

async function validateAssetLimit(companyId: string): Promise<void> {
  const storageApi = storage as StorageApi;

  if (typeof storageApi.checkAssetLimit !== "function") {
    return;
  }

  const result = await storageApi.checkAssetLimit(companyId);

  if (result === false) {
    throw new Error(
      "La empresa alcanzó el límite de activos permitido."
    );
  }

  if (
    result &&
    typeof result === "object" &&
    (result.allowed === false || result.canCreate === false)
  ) {
    throw new Error(
      result.message ||
        "La empresa alcanzó el límite de activos permitido."
    );
  }
}

export function registerRedesignRoutes(app: Express): void {
  app.get(
    "/api/public/asset/:code",
    async (req: Request, res: Response) => {
      try {
        const asset = await redesignStorage.getPublicAssetByCode(
          req.params.code
        );

        if (!asset) {
          res.status(404).json({
            message: "Activo no encontrado",
          });
          return;
        }

        res.json(asset);
      } catch (error) {
        console.error(
          "[routes-redesign] Error obteniendo activo público:",
          error
        );
        res.status(500).json({
          message: "No se pudo obtener el activo.",
        });
      }
    }
  );

  app.get(
    "/api/categories/:companyId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const categories = await redesignStorage.getCategories(
          req.params.companyId
        );
        res.json(categories);
      } catch (error) {
        console.error(
          "[routes-redesign] Error obteniendo categorías:",
          error
        );
        res.status(500).json({
          message: "No se pudieron obtener las categorías.",
        });
      }
    }
  );

  app.post(
    "/api/categories/:companyId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const name = String(req.body?.name ?? "").trim();
        const depreciationYears = Number(
          req.body?.depreciationYears ?? 3
        );

        const category = await redesignStorage.createCategory(
          req.params.companyId,
          name,
          depreciationYears
        );

        await storage.logActivity({
          companyId: req.params.companyId,
          userId: getUserId(req),
          action: "created",
          entityType: "asset_category",
          entityId: String(category.id ?? ""),
          entityName: String(category.name ?? name),
        });

        res.status(201).json(category);
      } catch (error) {
        console.error(
          "[routes-redesign] Error creando categoría:",
          error
        );
        res.status(400).json({
          message: errorMessage(error),
        });
      }
    }
  );

  app.put(
    "/api/categories/:companyId/:categoryId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const category = await redesignStorage.updateCategory(
          req.params.companyId,
          req.params.categoryId,
          String(req.body?.name ?? "").trim(),
          Number(req.body?.depreciationYears ?? 3)
        );

        res.json(category);
      } catch (error) {
        console.error(
          "[routes-redesign] Error actualizando categoría:",
          error
        );
        res.status(400).json({
          message: errorMessage(error),
        });
      }
    }
  );

  app.delete(
    "/api/categories/:companyId/:categoryId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        await redesignStorage.deleteCategory(
          req.params.companyId,
          req.params.categoryId
        );

        res.json({ success: true });
      } catch (error) {
        console.error(
          "[routes-redesign] Error eliminando categoría:",
          error
        );
        res.status(400).json({
          message: errorMessage(error),
        });
      }
    }
  );

  app.get(
    "/api/asset-code/:companyId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const assetCode =
          await redesignStorage.generateAssetCode(
            req.params.companyId
          );
        res.json({ assetCode });
      } catch (error) {
        console.error(
          "[routes-redesign] Error generando código de activo:",
          error
        );
        res.status(500).json({
          message: "No se pudo generar el código del activo.",
        });
      }
    }
  );

  app.post(
    "/api/assets/:companyId/:assetId/photos",
    isAuthenticated,
    assetPhotoUpload.array("photos", 10),
    async (req: Request, res: Response) => {
      const files = (req.files ?? []) as Express.Multer.File[];
      const uploadedPaths = files.map(
        (file) => `assets/${file.filename}`
      );

      try {
        const photos = await redesignStorage.addAssetPhotos(
          req.params.companyId,
          req.params.assetId,
          files.map((file) => ({
            filePath: `assets/${file.filename}`,
            originalName: file.originalname,
          }))
        );

        res.status(201).json(photos);
      } catch (error) {
        for (const filePath of uploadedPaths) {
          deleteUploadedFile(filePath);
        }

        console.error(
          "[routes-redesign] Error guardando fotos:",
          error
        );
        res.status(400).json({
          message: errorMessage(error),
        });
      }
    }
  );

  app.get(
    "/api/assets/:companyId/:assetId/photos",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const photos = await redesignStorage.getAssetPhotos(
          req.params.companyId,
          req.params.assetId
        );
        res.json(photos);
      } catch (error) {
        console.error(
          "[routes-redesign] Error obteniendo fotos:",
          error
        );
        res.status(500).json({
          message: "No se pudieron obtener las fotos.",
        });
      }
    }
  );

  app.delete(
    "/api/asset-photos/:companyId/:photoId",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const filePath = await redesignStorage.deleteAssetPhoto(
          req.params.companyId,
          req.params.photoId
        );

        if (!filePath) {
          res.status(404).json({
            message: "Foto no encontrada",
          });
          return;
        }

        deleteUploadedFile(filePath);
        res.json({ success: true });
      } catch (error) {
        console.error(
          "[routes-redesign] Error eliminando foto:",
          error
        );
        res.status(500).json({
          message: "No se pudo eliminar la foto.",
        });
      }
    }
  );

  app.put(
    "/api/assets/:companyId/:assetId/custom-fields",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        if (!Array.isArray(req.body?.fields)) {
          res.status(400).json({
            message: "fields debe ser un arreglo.",
          });
          return;
        }

        const fields = req.body.fields.map(
          (field: Record<string, unknown>) => ({
            fieldName: String(field?.fieldName ?? ""),
            fieldValue: String(field?.fieldValue ?? ""),
          })
        );

        const result =
          await redesignStorage.replaceCustomFields(
            req.params.companyId,
            req.params.assetId,
            fields
          );

        res.json(result);
      } catch (error) {
        console.error(
          "[routes-redesign] Error guardando campos personalizados:",
          error
        );
        res.status(400).json({
          message: errorMessage(error),
        });
      }
    }
  );

  app.get(
    "/api/assets/:companyId/:assetId/custom-fields",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const fields = await redesignStorage.getCustomFields(
          req.params.companyId,
          req.params.assetId
        );
        res.json(fields);
      } catch (error) {
        console.error(
          "[routes-redesign] Error obteniendo campos personalizados:",
          error
        );
        res.status(500).json({
          message:
            "No se pudieron obtener los campos personalizados.",
        });
      }
    }
  );

  app.get(
    "/api/assets/:companyId/:assetId/depreciation",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const result = await pool.query(
          `SELECT
             a.purchase_cost,
             a.residual_value,
             a.purchase_date,
             a.name,
             a.asset_code,
             COALESCE(
               a.depreciation_years,
               ac.depreciation_years,
               3
             ) AS depreciation_years
           FROM assets a
           LEFT JOIN asset_categories ac
             ON ac.id = a.category_id
            AND ac.company_id = a.company_id
           WHERE a.id = $1
             AND a.company_id = $2`,
          [req.params.assetId, req.params.companyId]
        );

        if (!result.rows[0]) {
          res.status(404).json({
            message: "Activo no encontrado",
          });
          return;
        }

        const asset = result.rows[0];
        const purchaseCost = Number(asset.purchase_cost) || 0;
        const residualValue = Number(asset.residual_value) || 0;
        const depreciationYears =
          Number(asset.depreciation_years) || 3;
        const depreciation = computeDepreciation({
          purchaseCost,
          residualValue,
          depreciationYears,
          purchaseDate: asset.purchase_date ?? null,
        });
        const maintenance =
          await redesignStorage.getMaintenanceCostByAsset(
            req.params.companyId,
            req.params.assetId
          );
        const monthlyMaintenance = roundMoney(
          maintenance.totalMaintenance / 12
        );

        res.json({
          assetName: String(asset.name ?? ""),
          assetCode: String(asset.asset_code ?? ""),
          purchaseCost,
          residualValue,
          depreciationYears,
          ...depreciation,
          maintenance: maintenance.totalMaintenance,
          monthlyCostTotal: roundMoney(
            depreciation.monthlyDepreciation +
              monthlyMaintenance
          ),
          note: ECUADOR_DEPRECIATION_NOTE,
        });
      } catch (error) {
        console.error(
          "[routes-redesign] Error calculando depreciación:",
          error
        );
        res.status(500).json({
          message: "No se pudo calcular la depreciación.",
        });
      }
    }
  );

  app.put(
    "/api/maintenance/:companyId/:maintenanceId/lines",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        if (!Array.isArray(req.body?.lines)) {
          res.status(400).json({
            message: "lines debe ser un arreglo.",
          });
          return;
        }

        const lines = req.body.lines.map(
          (line: Record<string, unknown>) => ({
            description: String(line?.description ?? ""),
            quantity: Number(line?.quantity),
            unitCost: Number(line?.unitCost),
          })
        );

        const result =
          await redesignStorage.replaceMaintenanceLines(
            req.params.companyId,
            req.params.maintenanceId,
            lines
          );

        res.json(result);
      } catch (error) {
        console.error(
          "[routes-redesign] Error guardando líneas de mantenimiento:",
          error
        );
        res.status(400).json({
          message: errorMessage(error),
        });
      }
    }
  );

  app.get(
    "/api/maintenance/:companyId/:maintenanceId/lines",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const lines =
          await redesignStorage.getMaintenanceLines(
            req.params.companyId,
            req.params.maintenanceId
          );
        res.json(lines);
      } catch (error) {
        console.error(
          "[routes-redesign] Error obteniendo líneas de mantenimiento:",
          error
        );
        res.status(500).json({
          message:
            "No se pudieron obtener las líneas de mantenimiento.",
        });
      }
    }
  );

  app.get(
    "/api/excel/assets-template",
    isAuthenticated,
    (_req: Request, res: Response) => {
      try {
        res.setHeader("Content-Type", XLSX_CONTENT_TYPE);
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="plantilla-equipos.xlsx"'
        );
        res.send(buildAssetsTemplate());
      } catch (error) {
        console.error(
          "[routes-redesign] Error creando plantilla de equipos:",
          error
        );
        res.status(500).json({
          message: "No se pudo crear la plantilla de equipos.",
        });
      }
    }
  );

  app.get(
    "/api/excel/applications-template",
    isAuthenticated,
    (_req: Request, res: Response) => {
      try {
        res.setHeader("Content-Type", XLSX_CONTENT_TYPE);
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="plantilla-aplicaciones.xlsx"'
        );
        res.send(buildApplicationsTemplate());
      } catch (error) {
        console.error(
          "[routes-redesign] Error creando plantilla de aplicaciones:",
          error
        );
        res.status(500).json({
          message:
            "No se pudo crear la plantilla de aplicaciones.",
        });
      }
    }
  );

  app.post(
    "/api/excel/assets-import/:companyId",
    isAuthenticated,
    excelUpload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({
            message: "Debe adjuntar un archivo Excel en el campo file.",
          });
          return;
        }

        const parsed = parseAssetsExcel(req.file.buffer);
        const errors = [...parsed.errors];
        let created = 0;
        let categories =
          await redesignStorage.getCategories(
            req.params.companyId
          );

        for (let index = 0; index < parsed.rows.length; index += 1) {
          const row = parsed.rows[index];
          const rowNumber = excelRowNumber(row, index + 2);

          try {
            await validateAssetLimit(req.params.companyId);

            let categoryId: string | null = null;

            if (row.category) {
              let category = categories.find(
                (item) =>
                  String(item.name ?? "").toLocaleLowerCase("es") ===
                  row.category.toLocaleLowerCase("es")
              );

              if (!category) {
                category =
                  await redesignStorage.createCategory(
                    req.params.companyId,
                    row.category,
                    row.depreciationYears || 3
                  );
                categories = [...categories, category];
              }

              categoryId = String(category.id);
            }

            const assetCode =
              await redesignStorage.generateAssetCode(
                req.params.companyId
              );

            await storage.createAsset({
              companyId: req.params.companyId,
              name: row.name,
              type: "physical",
              manufacturer: row.manufacturer,
              model: row.model,
              serialNumber: row.serialNumber,
              location: row.location,
              assignedTo: row.assignedTo,
              purchaseDate: row.purchaseDate,
              warrantyExpiry: row.warrantyExpiry,
              notes: row.notes,
              categoryId,
              assetCode,
              purchaseCost: row.purchaseCost,
              residualValue: row.residualValue,
              depreciationYears: row.depreciationYears,
              status: "active",
            });

            created += 1;
          } catch (error) {
            errors.push({
              row: rowNumber,
              message: errorMessage(error),
            });
          }
        }

        try {
          await storage.logActivity({
            companyId: req.params.companyId,
            userId: getUserId(req),
            action: "imported",
            entityType: "asset",
            details: `Importados ${created} equipos desde Excel`,
          });
        } catch (error) {
          console.error(
            "[routes-redesign] Error registrando actividad de importación:",
            error
          );
        }

        res.json({ created, errors });
      } catch (error) {
        console.error(
          "[routes-redesign] Error importando equipos:",
          error
        );
        res.status(400).json({
          message: errorMessage(error),
        });
      }
    }
  );

  app.post(
    "/api/excel/applications-import/:companyId",
    isAuthenticated,
    excelUpload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          res.status(400).json({
            message: "Debe adjuntar un archivo Excel en el campo file.",
          });
          return;
        }

        const parsed = parseApplicationsExcel(req.file.buffer);
        const errors = [...parsed.errors];
        let created = 0;

        for (let index = 0; index < parsed.rows.length; index += 1) {
          const row = parsed.rows[index];
          const rowNumber = excelRowNumber(row, index + 2);

          try {
            await validateAssetLimit(req.params.companyId);

            const monthlyCost =
              row.billingCycle === "monthly"
                ? row.cost
                : row.billingCycle === "quarterly"
                  ? roundMoney(row.cost / 3)
                  : row.billingCycle === "semiannual"
                    ? roundMoney(row.cost / 6)
                    : 0;
            const annualCost =
              row.billingCycle === "annual" ? row.cost : 0;

            if (row.kind === "license") {
              await storage.createLicense({
                companyId: req.params.companyId,
                name: row.name,
                vendor: row.vendor,
                licenseKey: row.licenseKey,
                expiryDate: row.expiryDate,
                billingCycle: row.billingCycle,
                monthlyCost:
                  row.billingCycle === "monthly"
                    ? row.cost
                    : 0,
                annualCost,
                purpose: row.purpose,
                paymentMethod: row.paymentMethod,
                cardName: row.cardName,
                bankName: row.bankName,
                renewalType: row.renewalType,
                notes: row.notes,
                status: "active",
              });
            } else {
              await storage.createAsset({
                companyId: req.params.companyId,
                name: row.name,
                type: "application",
                provider: row.vendor,
                manufacturer: row.vendor,
                billingCycle: row.billingCycle,
                monthlyCost,
                annualCost,
                purpose: row.purpose,
                paymentMethod: row.paymentMethod,
                cardName: row.cardName,
                bankName: row.bankName,
                renewalType: row.renewalType,
                renewalDate: row.expiryDate,
                notes: row.notes,
                status: "active",
              });
            }

            created += 1;
          } catch (error) {
            errors.push({
              row: rowNumber,
              message: errorMessage(error),
            });
          }
        }

        res.json({ created, errors });
      } catch (error) {
        console.error(
          "[routes-redesign] Error importando aplicaciones:",
          error
        );
        res.status(400).json({
          message: errorMessage(error),
        });
      }
    }
  );

  app.post(
    "/api/reports/biweekly/:companyId/test",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const emails =
          typeof req.body?.emails === "string"
            ? req.body.emails
            : undefined;
        const result = await sendBiweeklyReportNow(
          req.params.companyId,
          emails
        );

        res.status(result.ok ? 200 : 500).json(result);
      } catch (error) {
        console.error(
          "[routes-redesign] Error enviando informe de prueba:",
          error
        );
        res.status(500).json({
          ok: false,
          message: "No se pudo enviar el informe de prueba.",
        });
      }
    }
  );

  app.post(
    "/api/contracts/:companyId/:contractId/file",
    isAuthenticated,
    contractFileUpload.single("file"),
    async (req: Request, res: Response) => {
      if (!req.file) {
        res.status(400).json({
          message: "Debe adjuntar un archivo en el campo file.",
        });
        return;
      }

      const contractFile = `contracts/${req.file.filename}`;

      try {
        const result = await pool.query(
          `WITH previous AS MATERIALIZED (
             SELECT contract_file
             FROM contracts
             WHERE id = $2
               AND company_id = $3
           ),
           updated AS (
             UPDATE contracts
             SET contract_file = $1,
                 updated_at = NOW()
             WHERE id = $2
               AND company_id = $3
             RETURNING contract_file
           )
           SELECT
             updated.contract_file,
             previous.contract_file AS previous_contract_file
           FROM updated
           LEFT JOIN previous ON TRUE`,
          [
            contractFile,
            req.params.contractId,
            req.params.companyId,
          ]
        );

        if (!result.rows[0]) {
          deleteUploadedFile(contractFile);
          res.status(404).json({
            message: "Contrato no encontrado",
          });
          return;
        }

        const previousContractFile =
          result.rows[0].previous_contract_file;

        if (
          previousContractFile &&
          String(previousContractFile) !== contractFile
        ) {
          deleteUploadedFile(String(previousContractFile));
        }

        res.json({
          contractFile: String(result.rows[0].contract_file),
        });
      } catch (error) {
        deleteUploadedFile(contractFile);
        console.error(
          "[routes-redesign] Error guardando archivo de contrato:",
          error
        );
        res.status(500).json({
          message:
            "No se pudo guardar el archivo del contrato.",
        });
      }
    }
  );

  app.put(
    "/api/contracts/:companyId/:contractId/support-contacts",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        if (!Array.isArray(req.body?.contacts)) {
          res.status(400).json({
            message: "contacts debe ser un arreglo.",
          });
          return;
        }

        const contacts = req.body.contacts.map(
          (contact: Record<string, unknown>, index: number) => {
            const name = String(contact?.name ?? "").trim();

            if (!name) {
              throw new Error(
                `El nombre del contacto ${index + 1} es obligatorio.`
              );
            }

            return {
              name,
              phone: String(contact?.phone ?? "").trim(),
              email: String(contact?.email ?? "").trim(),
            };
          }
        );

        const result = await pool.query(
          `UPDATE contracts
           SET support_contacts = $1::jsonb,
               updated_at = NOW()
           WHERE id = $2
             AND company_id = $3
           RETURNING support_contacts`,
          [
            JSON.stringify(contacts),
            req.params.contractId,
            req.params.companyId,
          ]
        );

        if (!result.rows[0]) {
          res.status(404).json({
            message: "Contrato no encontrado",
          });
          return;
        }

        res.json({
          supportContacts: result.rows[0].support_contacts,
        });
      } catch (error) {
        console.error(
          "[routes-redesign] Error guardando contactos de soporte:",
          error
        );

        if (
          error instanceof Error &&
          error.message.includes("contacto")
        ) {
          res.status(400).json({
            message: error.message,
          });
          return;
        }

        res.status(500).json({
          message:
            "No se pudieron guardar los contactos de soporte.",
        });
      }
    }
  );
}