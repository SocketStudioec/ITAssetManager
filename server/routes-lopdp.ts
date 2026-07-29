/**
 * RUTAS DEL MÓDULO DE DATOS PERSONALES (LOPDP)
 *
 * Todas las rutas exigen:
 *  1. Autenticación (isAuthenticated)
 *  2. Pertenencia del usuario a la empresa (aislamiento multi-tenant)
 *  3. Módulo premium activo para la empresa (excepto GET /status, que responde
 *     {enabled:false} para que el frontend pinte el paywall)
 *
 * Toda escritura queda en activity_log con entity_type 'dp_*' — es la base de
 * la trazabilidad que se entrega a la Superintendencia.
 */
import type { Express, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "./auth";
import { storage } from "./storage";
import { lopdpStorage } from "./storage-lopdp";
import { pool } from "./db";
import {
  dpActionUpdateSchema,
  dpClassificationSchema,
  dpDocumentCreateSchema,
  dpDocumentUpdateSchema,
  dpIncidentSchema,
  dpIncidentUpdateSchema,
  dpProcedureSchema,
  dpProcedureUpdateSchema,
  dpProfileSchema,
  dpScenarioOverrideSchema,
  dpTitularRequestSchema,
  dpTitularRequestUpdateSchema,
  DP_DOC_LABELS,
  type DpDocType,
} from "@shared/lopdp";
import { CATALOG_DOC_TYPES } from "./lopdp/templates";

type AuthedRequest = any;

/** Verifica que el usuario pertenezca a la empresa (o sea super_admin). */
async function userBelongsToCompany(userId: string, companyId: string): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (user?.role === "super_admin") return true;
  const { rows } = await pool.query(
    `SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2`,
    [userId, companyId],
  );
  return rows.length > 0;
}

/** Guardia común: pertenencia + módulo premium activo. */
async function guard(req: AuthedRequest, res: Response): Promise<string | null> {
  const companyId = req.params.companyId;
  const userId = req.user?.userId;

  if (!companyId || !userId) {
    res.status(400).json({ message: "Solicitud inválida" });
    return null;
  }
  if (!(await userBelongsToCompany(userId, companyId))) {
    res.status(403).json({ message: "No tienes acceso a esta empresa" });
    return null;
  }
  if (!(await lopdpStorage.isEnabled(companyId))) {
    res.status(402).json({
      message: "El módulo de Datos Personales no está activo para esta empresa",
      code: "LOPDP_NOT_ENABLED",
    });
    return null;
  }
  return userId;
}

function handleError(res: Response, error: unknown, context: string) {
  console.error(`[LOPDP] ${context}:`, error);
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Datos inválidos", errors: error.errors });
  }
  const message = error instanceof Error ? error.message : "Error inesperado";
  return res.status(500).json({ message });
}

/** Registro de auditoría — alimenta el informe de trazabilidad. */
async function log(
  companyId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  entityName?: string | null,
  details?: string | null,
) {
  try {
    await storage.logActivity({
      companyId,
      userId,
      action,
      entityType,
      entityId: entityId ?? null,
      entityName: entityName ?? null,
      details: details ?? null,
    } as any);
  } catch (error) {
    // La auditoría nunca debe tumbar la operación principal.
    console.error("[LOPDP] no se pudo registrar la actividad:", error);
  }
}

export function registerLopdpRoutes(app: Express): void {
  // ==========================================================================
  // ESTADO Y GATE PREMIUM
  // ==========================================================================

  app.get("/api/dp/:companyId/status", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const { companyId } = req.params;
      const userId = req.user?.userId;
      if (!(await userBelongsToCompany(userId, companyId))) {
        return res.status(403).json({ message: "No tienes acceso a esta empresa" });
      }
      const status = await lopdpStorage.getStatus(companyId);
      res.json(status);
    } catch (error) {
      handleError(res, error, "status");
    }
  });

  /** Activación/desactivación del módulo premium (solo super_admin). */
  app.put("/api/admin/companies/:companyId/lopdp", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== "super_admin") {
        return res.status(403).json({ message: "Acceso denegado. Requiere super admin." });
      }
      const { companyId } = req.params;
      const enabled = req.body?.enabled === true;
      await lopdpStorage.setEnabled(companyId, enabled);
      await log(companyId, req.user.userId, enabled ? "enabled" : "disabled", "dp_module", companyId, "Módulo LOPDP");
      res.json({ success: true, enabled });
    } catch (error) {
      handleError(res, error, "toggle módulo");
    }
  });

  // ==========================================================================
  // PERFIL DE LA EMPRESA
  // ==========================================================================

  app.get("/api/dp/:companyId/profile", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getProfile(req.params.companyId));
    } catch (error) {
      handleError(res, error, "get profile");
    }
  });

  app.put("/api/dp/:companyId/profile", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId } = req.params;
      const data = dpProfileSchema.parse(req.body);
      const profile = await lopdpStorage.upsertProfile(companyId, data);
      await log(companyId, userId, "updated", "dp_profile", profile.id, "Perfil LOPDP");
      // Guardar el perfil cambia las vulnerabilidades declaradas → recalcular todo.
      const assessment = await lopdpStorage.runEngine(companyId, "wizard");
      res.json({ profile, assessment });
    } catch (error) {
      handleError(res, error, "put profile");
    }
  });

  // ==========================================================================
  // CLASIFICACIÓN DE ACTIVOS
  // ==========================================================================

  app.get("/api/dp/:companyId/classifications", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getClassifications(req.params.companyId));
    } catch (error) {
      handleError(res, error, "get classifications");
    }
  });

  app.put("/api/dp/:companyId/classifications", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId } = req.params;
      const data = dpClassificationSchema.parse(req.body);
      const saved = await lopdpStorage.upsertClassification(companyId, userId, data);
      await log(companyId, userId, "classified", "dp_classification", saved.id,
        `Clasificación de datos personales`);
      res.json(saved);
    } catch (error) {
      handleError(res, error, "put classification");
    }
  });

  // ==========================================================================
  // MOTOR DE RIESGOS
  // ==========================================================================

  app.post("/api/dp/:companyId/engine/run", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId } = req.params;
      const assessment = await lopdpStorage.runEngine(companyId, "manual");
      await log(companyId, userId, "executed", "dp_engine", null, "Motor de riesgos LOPDP",
        `Riesgo ${assessment.riskScore} (${assessment.riskGrade}), cumplimiento ${assessment.complianceScore} (${assessment.complianceGrade})`);
      res.json(assessment);
    } catch (error) {
      handleError(res, error, "run engine");
    }
  });

  app.get("/api/dp/:companyId/scenarios", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getScenarios(req.params.companyId));
    } catch (error) {
      handleError(res, error, "get scenarios");
    }
  });

  app.put("/api/dp/:companyId/scenarios/:id", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId, id } = req.params;
      const data = dpScenarioOverrideSchema.parse(req.body);
      const scenario = await lopdpStorage.updateScenario(companyId, id, data);
      await log(companyId, userId, "updated", "dp_scenario", id, scenario.title, data.overrideRationale);
      res.json(scenario);
    } catch (error) {
      handleError(res, error, "put scenario");
    }
  });

  // ==========================================================================
  // CALIFICACIONES
  // ==========================================================================

  app.get("/api/dp/:companyId/assessment", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const current = await lopdpStorage.getLatestAssessment(req.params.companyId);
      res.json(current ?? null);
    } catch (error) {
      handleError(res, error, "get assessment");
    }
  });

  /**
   * Lectura de la calificación: qué significa, qué puntaje se necesita para no
   * tener problemas y qué hacer si se está por debajo.
   */
  app.get("/api/dp/:companyId/interpretation", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getInterpretation(req.params.companyId));
    } catch (error) {
      handleError(res, error, "get interpretation");
    }
  });

  /**
   * Cuestionario guiado: enseña los conceptos mientras se responde, con
   * ejemplos del sector de la empresa. No exige conocer la ley.
   */
  app.get("/api/dp/:companyId/guide", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getGuide(req.params.companyId));
    } catch (error) {
      handleError(res, error, "get guide");
    }
  });

  app.get("/api/dp/:companyId/assessment/history", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getAssessmentHistory(req.params.companyId));
    } catch (error) {
      handleError(res, error, "get history");
    }
  });

  // ==========================================================================
  // PLAN DE ACCIÓN
  // ==========================================================================

  app.get("/api/dp/:companyId/actions", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getActions(req.params.companyId));
    } catch (error) {
      handleError(res, error, "get actions");
    }
  });

  app.put("/api/dp/:companyId/actions/:id", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId, id } = req.params;
      const data = dpActionUpdateSchema.parse(req.body);

      const before = await lopdpStorage.getLatestAssessment(companyId);
      const action = await lopdpStorage.updateAction(companyId, id, data);
      const after = await lopdpStorage.getLatestAssessment(companyId);

      await log(companyId, userId, data.status === "done" ? "completed" : "updated",
        "dp_action", id, action.title, data.naRationale ?? null);

      res.json({
        action,
        assessment: after,
        // Delta para la animación de progreso en la UI (motor de enganche).
        delta: {
          compliance: Number(after?.complianceScore ?? 0) - Number(before?.complianceScore ?? 0),
          risk: Number(after?.riskScore ?? 0) - Number(before?.riskScore ?? 0),
        },
      });
    } catch (error) {
      handleError(res, error, "put action");
    }
  });

  // ==========================================================================
  // DOCUMENTOS LEGALES
  // ==========================================================================

  app.get("/api/dp/:companyId/documents", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const documents = await lopdpStorage.getDocuments(req.params.companyId);
      res.json({
        documents,
        catalog: CATALOG_DOC_TYPES.map((t) => ({ docType: t, label: DP_DOC_LABELS[t] })),
      });
    } catch (error) {
      handleError(res, error, "get documents");
    }
  });

  app.get("/api/dp/:companyId/documents/:id", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const doc = await lopdpStorage.getDocument(req.params.companyId, req.params.id);
      if (!doc) return res.status(404).json({ message: "Documento no encontrado" });
      res.json(doc);
    } catch (error) {
      handleError(res, error, "get document");
    }
  });

  app.post("/api/dp/:companyId/documents", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId } = req.params;
      const data = dpDocumentCreateSchema.parse(req.body);
      const doc = await lopdpStorage.createDocument(
        companyId, userId, data.docType as DpDocType, data.relatedEntityId ?? null,
      );
      await log(companyId, userId, "generated", "dp_document", doc.id, doc.title);
      res.json(doc);
    } catch (error) {
      handleError(res, error, "create document");
    }
  });

  app.put("/api/dp/:companyId/documents/:id", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId, id } = req.params;
      const data = dpDocumentUpdateSchema.parse(req.body);
      const doc = await lopdpStorage.updateDocument(companyId, id, data);
      await log(companyId, userId, data.status === "published" ? "published" : "updated",
        "dp_document", id, doc.title);
      const assessment = await lopdpStorage.getLatestAssessment(companyId);
      res.json({ document: doc, assessment });
    } catch (error) {
      handleError(res, error, "update document");
    }
  });

  app.delete("/api/dp/:companyId/documents/:id", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId, id } = req.params;
      await lopdpStorage.deleteDocument(companyId, id);
      await log(companyId, userId, "deleted", "dp_document", id, "Documento LOPDP");
      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "delete document");
    }
  });

  /** Descarga en Markdown (abre en cualquier editor y se convierte a PDF/DOCX). */
  app.get("/api/dp/:companyId/documents/:id/download", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const doc = await lopdpStorage.getDocument(req.params.companyId, req.params.id);
      if (!doc) return res.status(404).json({ message: "Documento no encontrado" });

      const safeName = String(doc.title).replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "").replace(/\s+/g, "-");
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}-v${doc.version}.md"`);
      res.send(doc.content);
    } catch (error) {
      handleError(res, error, "download document");
    }
  });

  // ==========================================================================
  // MODO DEFENSA — SOLICITUDES DE TITULARES (art. 62: 10 días término)
  // ==========================================================================

  app.get("/api/dp/:companyId/titular-requests", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getTitularRequests(req.params.companyId));
    } catch (error) {
      handleError(res, error, "get requests");
    }
  });

  app.post("/api/dp/:companyId/titular-requests", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId } = req.params;
      const data = dpTitularRequestSchema.parse(req.body);
      const request = await lopdpStorage.createTitularRequest(companyId, data);
      await log(companyId, userId, "created", "dp_titular_request", request.id,
        `Solicitud de ${request.titularName}`,
        `Vence el ${new Date(request.dueDate).toISOString().slice(0, 10)} (10 días término, art. 62 LOPDP)`);
      res.json(request);
    } catch (error) {
      handleError(res, error, "create request");
    }
  });

  app.put("/api/dp/:companyId/titular-requests/:id", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId, id } = req.params;
      const data = dpTitularRequestUpdateSchema.parse(req.body);
      const request = await lopdpStorage.updateTitularRequest(companyId, id, data);
      await log(companyId, userId, "updated", "dp_titular_request", id,
        `Solicitud de ${request.titularName}`, data.resolutionRationale ?? null);
      res.json(request);
    } catch (error) {
      handleError(res, error, "update request");
    }
  });

  /** Dónde viven los datos: alimenta la localización para responder al titular. */
  app.get("/api/dp/:companyId/data-locations", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getDataLocations(req.params.companyId));
    } catch (error) {
      handleError(res, error, "get data locations");
    }
  });

  // ==========================================================================
  // MODO DEFENSA — INCIDENTES (art. 43: 72 horas)
  // ==========================================================================

  app.get("/api/dp/:companyId/incidents", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getIncidents(req.params.companyId));
    } catch (error) {
      handleError(res, error, "get incidents");
    }
  });

  app.post("/api/dp/:companyId/incidents", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId } = req.params;
      const data = dpIncidentSchema.parse(req.body);
      const incident = await lopdpStorage.createIncident(companyId, data);
      await log(companyId, userId, "created", "dp_incident", incident.id, incident.title,
        `Plazo SPDP (72h): ${new Date(incident.spdpDeadline).toISOString()}`);
      res.json(incident);
    } catch (error) {
      handleError(res, error, "create incident");
    }
  });

  app.put("/api/dp/:companyId/incidents/:id", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId, id } = req.params;
      const data = dpIncidentUpdateSchema.parse(req.body);
      const incident = await lopdpStorage.updateIncident(companyId, id, data);
      await log(companyId, userId, "updated", "dp_incident", id, incident.title);
      res.json(incident);
    } catch (error) {
      handleError(res, error, "update incident");
    }
  });

  // ==========================================================================
  // MODO DEFENSA — PROCEDIMIENTOS SPDP (arts. 63-66)
  // ==========================================================================

  app.get("/api/dp/:companyId/procedures", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getProcedures(req.params.companyId));
    } catch (error) {
      handleError(res, error, "get procedures");
    }
  });

  app.post("/api/dp/:companyId/procedures", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId } = req.params;
      const data = dpProcedureSchema.parse(req.body);
      const procedure = await lopdpStorage.createProcedure(companyId, data);
      await log(companyId, userId, "created", "dp_procedure", procedure.id,
        `Procedimiento ${procedure.procedureType} ${procedure.fileNumber ?? ""}`.trim());
      res.json(procedure);
    } catch (error) {
      handleError(res, error, "create procedure");
    }
  });

  app.put("/api/dp/:companyId/procedures/:id", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId, id } = req.params;
      const data = dpProcedureUpdateSchema.parse(req.body);
      const procedure = await lopdpStorage.updateProcedure(companyId, id, data);
      await log(companyId, userId, "updated", "dp_procedure", id, procedure.fileNumber ?? "Procedimiento SPDP");
      res.json(procedure);
    } catch (error) {
      handleError(res, error, "update procedure");
    }
  });

  // ==========================================================================
  // TRAZABILIDAD Y EXPEDIENTE
  // ==========================================================================

  app.get("/api/dp/:companyId/traceability/map", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      res.json(await lopdpStorage.getTraceabilityMap(req.params.companyId));
    } catch (error) {
      handleError(res, error, "traceability map");
    }
  });

  app.get("/api/dp/:companyId/traceability/log", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const limit = Math.min(Number(req.query.limit) || 200, 1000);
      res.json(await lopdpStorage.getTraceabilityLog(req.params.companyId, limit));
    } catch (error) {
      handleError(res, error, "traceability log");
    }
  });

  /** Expediente de cumplimiento: el botón del "Modo Defensa". */
  app.post("/api/dp/:companyId/compliance-package", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId } = req.params;
      const doc = await lopdpStorage.createDocument(companyId, userId, "expediente", req.body?.procedureId ?? null);
      await log(companyId, userId, "generated", "dp_document", doc.id, "Expediente de cumplimiento");
      res.json(doc);
    } catch (error) {
      handleError(res, error, "compliance package");
    }
  });

  /** Certificado de cumplimiento (autodeclarativo, vigencia 6 meses). */
  app.post("/api/dp/:companyId/certificate", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = await guard(req, res);
      if (!userId) return;
      const { companyId } = req.params;
      const doc = await lopdpStorage.createDocument(companyId, userId, "certificado", null);
      await log(companyId, userId, "generated", "dp_document", doc.id, "Certificado de cumplimiento");
      res.json(doc);
    } catch (error) {
      handleError(res, error, "certificate");
    }
  });
}
