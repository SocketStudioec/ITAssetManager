/**
 * CAPA DE ACCESO A DATOS — MÓDULO LOPDP
 *
 * Patrón Repository con SQL nativo (igual que storage.ts / storage-redesign.ts).
 * REGLA CRÍTICA: toda query filtra por company_id (aislamiento multi-tenant).
 */
import { pool } from "./db";
import {
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
  interpretAssessment,
  quantitativeRisk,
  riskGrade,
  riskLevel,
  titularRequestDueDate,
  CONTROL_CATALOG,
  VULNERABILITY_CATALOG,
  type ClassificationInput,
} from "./lopdp/engine";
import { buildGuide, unknownAnswers } from "./lopdp/education";
import { renderDocument, type DocumentContext } from "./lopdp/templates";
import { DP_DOC_LABELS, DP_REQUEST_TYPE_LABELS, type DpDocType } from "@shared/lopdp";

type Row = Record<string, any>;

function toCamel<T = any>(row: Row): T {
  if (!row || typeof row !== "object") return row as T;
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out as T;
}
const toCamelAll = <T = any>(rows: Row[]): T[] => rows.map((r) => toCamel<T>(r));

const num = (v: any): number => (v === null || v === undefined ? 0 : Number(v));

export class LopdpStorage {
  // ==========================================================================
  // GATE PREMIUM Y ESTADO
  // ==========================================================================

  async isEnabled(companyId: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT lopdp_enabled FROM companies WHERE id = $1`,
      [companyId],
    );
    return rows[0]?.lopdp_enabled === true;
  }

  async setEnabled(companyId: string, enabled: boolean): Promise<void> {
    await pool.query(
      `UPDATE companies
          SET lopdp_enabled = $2,
              lopdp_activated_at = CASE WHEN $2 THEN COALESCE(lopdp_activated_at, NOW()) ELSE lopdp_activated_at END,
              updated_at = NOW()
        WHERE id = $1`,
      [companyId, enabled],
    );
  }

  async getStatus(companyId: string) {
    const enabled = await this.isEnabled(companyId);
    const profile = await this.getProfile(companyId);

    const [assets, classified, scenarios, actions, requests, incidents, procedures] = await Promise.all([
      pool.query(
        `SELECT (SELECT COUNT(*) FROM assets WHERE company_id = $1)
              + (SELECT COUNT(*) FROM licenses WHERE company_id = $1)
              + (SELECT COUNT(*) FROM contracts WHERE company_id = $1) AS total`,
        [companyId],
      ),
      pool.query(`SELECT COUNT(*) AS total FROM dp_asset_classification WHERE company_id = $1`, [companyId]),
      pool.query(`SELECT COUNT(*) AS total FROM dp_risk_scenario WHERE company_id = $1`, [companyId]),
      pool.query(
        `SELECT COUNT(*) AS total FROM dp_action_item WHERE company_id = $1 AND status IN ('pending','in_progress')`,
        [companyId],
      ),
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status IN ('open','in_progress')) AS open,
                COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND due_date < NOW()) AS overdue
           FROM dp_titular_request WHERE company_id = $1`,
        [companyId],
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM dp_incident WHERE company_id = $1 AND status <> 'cerrado'`,
        [companyId],
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM dp_authority_procedure WHERE company_id = $1 AND status <> 'closed'`,
        [companyId],
      ),
    ]);

    return {
      enabled,
      profileCompleted: Boolean(profile?.wizardCompletedAt),
      totalAssets: num(assets.rows[0]?.total),
      classifiedAssets: num(classified.rows[0]?.total),
      scenarioCount: num(scenarios.rows[0]?.total),
      assessment: await this.getLatestAssessment(companyId),
      pendingActions: num(actions.rows[0]?.total),
      openRequests: num(requests.rows[0]?.open),
      overdueRequests: num(requests.rows[0]?.overdue),
      openIncidents: num(incidents.rows[0]?.total),
      openProcedures: num(procedures.rows[0]?.total),
    };
  }

  // ==========================================================================
  // PERFIL
  // ==========================================================================

  async getProfile(companyId: string): Promise<any | null> {
    const { rows } = await pool.query(
      `SELECT * FROM dp_company_profile WHERE company_id = $1`,
      [companyId],
    );
    return rows[0] ? toCamel(rows[0]) : null;
  }

  async upsertProfile(companyId: string, data: any): Promise<any> {
    const { rows } = await pool.query(
      `INSERT INTO dp_company_profile
         (company_id, sector, legal_rep_name, employee_count, annual_revenue_range,
          dpo_name, dpo_email, arco_channel, questionnaire, is_processor, wizard_completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10, CASE WHEN $11 THEN NOW() ELSE NULL END)
       ON CONFLICT (company_id) DO UPDATE SET
         sector = EXCLUDED.sector,
         legal_rep_name = EXCLUDED.legal_rep_name,
         employee_count = EXCLUDED.employee_count,
         annual_revenue_range = EXCLUDED.annual_revenue_range,
         dpo_name = EXCLUDED.dpo_name,
         dpo_email = EXCLUDED.dpo_email,
         arco_channel = EXCLUDED.arco_channel,
         questionnaire = EXCLUDED.questionnaire,
         is_processor = EXCLUDED.is_processor,
         wizard_completed_at = COALESCE(dp_company_profile.wizard_completed_at, EXCLUDED.wizard_completed_at),
         updated_at = NOW()
       RETURNING *`,
      [
        companyId,
        data.sector ?? "otro",
        data.legalRepName ?? null,
        data.employeeCount ?? null,
        data.annualRevenueRange ?? null,
        data.dpoName ?? null,
        data.dpoEmail ?? null,
        data.arcoChannel ?? null,
        JSON.stringify(data.questionnaire ?? {}),
        data.isProcessor ?? false,
        data.completed === true,
      ],
    );
    return toCamel(rows[0]);
  }

  // ==========================================================================
  // CLASIFICACIÓN DE ACTIVOS
  // ==========================================================================

  /**
   * Devuelve TODOS los activos de la empresa (equipos, aplicaciones, licencias y
   * contratos) con su clasificación si existe. Los no clasificados vienen con
   * `classification: null` — son los que restan progreso al módulo.
   */
  async getClassifications(companyId: string): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT a.id AS entity_id, 'asset' AS entity_kind, a.name AS entity_name,
              a.type::text AS entity_type, c.*
         FROM assets a
         LEFT JOIN dp_asset_classification c ON c.asset_id = a.id AND c.company_id = $1
        WHERE a.company_id = $1
       UNION ALL
       SELECT l.id, 'license', l.name, 'license', c.*
         FROM licenses l
         LEFT JOIN dp_asset_classification c ON c.license_id = l.id AND c.company_id = $1
        WHERE l.company_id = $1
       UNION ALL
       SELECT ct.id, 'contract', ct.name, 'contract', c.*
         FROM contracts ct
         LEFT JOIN dp_asset_classification c ON c.contract_id = ct.id AND c.company_id = $1
        WHERE ct.company_id = $1
        ORDER BY 2, 3`,
      [companyId],
    );

    return rows.map((r) => {
      const mapped = toCamel<any>(r);
      return {
        entityId: mapped.entityId,
        entityKind: mapped.entityKind,
        entityName: mapped.entityName,
        entityType: mapped.entityType,
        classified: Boolean(mapped.id),
        id: mapped.id ?? null,
        hasPersonalData: mapped.hasPersonalData ?? null,
        dataCategories: mapped.dataCategories ?? [],
        dataSubjects: mapped.dataSubjects ?? [],
        subjectCountRange: mapped.subjectCountRange ?? null,
        storageLocation: mapped.storageLocation ?? null,
        isProcessorAsset: mapped.isProcessorAsset ?? false,
        retentionPeriod: mapped.retentionPeriod ?? null,
        notes: mapped.notes ?? null,
        classifiedAt: mapped.classifiedAt ?? null,
      };
    });
  }

  async upsertClassification(companyId: string, userId: string, data: any): Promise<any> {
    const target = data.assetId
      ? { col: "asset_id", id: data.assetId, table: "assets" }
      : data.licenseId
        ? { col: "license_id", id: data.licenseId, table: "licenses" }
        : { col: "contract_id", id: data.contractId, table: "contracts" };

    if (!target.id) throw new Error("Se requiere assetId, licenseId o contractId");

    // Validación multi-tenant: la entidad debe pertenecer a la empresa.
    const owner = await pool.query(
      `SELECT 1 FROM ${target.table} WHERE id = $1 AND company_id = $2`,
      [target.id, companyId],
    );
    if (owner.rowCount === 0) throw new Error("La entidad no pertenece a la empresa");

    const { rows } = await pool.query(
      `INSERT INTO dp_asset_classification
         (company_id, ${target.col}, has_personal_data, data_categories, data_subjects,
          subject_count_range, storage_location, is_processor_asset, retention_period, notes,
          classified_by, classified_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
       ON CONFLICT (${target.col}) WHERE ${target.col} IS NOT NULL DO UPDATE SET
         has_personal_data = EXCLUDED.has_personal_data,
         data_categories = EXCLUDED.data_categories,
         data_subjects = EXCLUDED.data_subjects,
         subject_count_range = EXCLUDED.subject_count_range,
         storage_location = EXCLUDED.storage_location,
         is_processor_asset = EXCLUDED.is_processor_asset,
         retention_period = EXCLUDED.retention_period,
         notes = EXCLUDED.notes,
         classified_by = EXCLUDED.classified_by,
         classified_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [
        companyId,
        target.id,
        data.hasPersonalData === true,
        data.dataCategories ?? [],
        data.dataSubjects ?? [],
        data.subjectCountRange ?? null,
        data.storageLocation ?? null,
        data.isProcessorAsset === true,
        data.retentionPeriod ?? null,
        data.notes ?? null,
        userId,
      ],
    );
    return toCamel(rows[0]);
  }

  /** Clasificaciones en el formato que consume el motor. */
  private async getClassificationInputs(companyId: string): Promise<ClassificationInput[]> {
    const { rows } = await pool.query(
      `SELECT c.id, c.has_personal_data, c.data_categories, c.data_subjects,
              c.subject_count_range, c.storage_location, c.is_processor_asset,
              COALESCE(a.name, l.name, ct.name, '(sin nombre)') AS entity_name
         FROM dp_asset_classification c
         LEFT JOIN assets a ON a.id = c.asset_id
         LEFT JOIN licenses l ON l.id = c.license_id
         LEFT JOIN contracts ct ON ct.id = c.contract_id
        WHERE c.company_id = $1`,
      [companyId],
    );
    return rows.map((r) => ({
      id: r.id,
      entityName: r.entity_name,
      hasPersonalData: r.has_personal_data,
      dataCategories: r.data_categories ?? [],
      dataSubjects: r.data_subjects ?? [],
      subjectCountRange: r.subject_count_range,
      storageLocation: r.storage_location,
      isProcessorAsset: r.is_processor_asset,
    }));
  }

  // ==========================================================================
  // MOTOR: ejecutar las 5 etapas
  // ==========================================================================

  /**
   * Regenera escenarios, plan de acción y calificaciones.
   * Preserva los overrides manuales de P/I y el estado de las acciones ya
   * resueltas (no se pierde el trabajo del usuario al recalcular).
   */
  async runEngine(companyId: string, trigger = "manual"): Promise<any> {
    const profile = (await this.getProfile(companyId)) ?? { sector: "otro", questionnaire: {}, isProcessor: false };
    const questionnaire = profile.questionnaire ?? {};
    const classifications = await this.getClassificationInputs(companyId);

    const completedControls = await this.getCompletedControls(companyId);
    const highRisk = isHighRiskTreatment(classifications);
    const dpoRequired = isDpoRequired(classifications, questionnaire);

    // --- Etapas 2 y 3: escenarios ---
    const computed = computeScenarios(classifications, questionnaire, profile.sector, completedControls);

    const existing = await pool.query(
      `SELECT id, template_key, classification_id, probability_override, impact_override,
              override_rationale, status, frequency, ale, var90
         FROM dp_risk_scenario WHERE company_id = $1`,
      [companyId],
    );
    const overrides = new Map<string, Row>();
    for (const r of existing.rows) overrides.set(`${r.template_key}::${r.classification_id}`, r);

    await pool.query(`DELETE FROM dp_risk_scenario WHERE company_id = $1`, [companyId]);

    for (const s of computed) {
      const prev = overrides.get(`${s.templateKey}::${s.classificationId}`);
      const pOv = prev?.probability_override ?? null;
      const iOv = prev?.impact_override ?? null;
      const residualP = pOv ?? s.residualProbability;
      const residualI = iOv ?? s.residualImpact;

      await pool.query(
        `INSERT INTO dp_risk_scenario
           (company_id, template_key, classification_id, entity_name, title, dimension,
            threat_community, attack_vector, vulnerabilities, legal_basis,
            probability, impact, probability_override, impact_override,
            rationale, override_rationale, residual_probability, residual_impact, level,
            frequency, ale, var90, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [
          companyId, s.templateKey, s.classificationId, s.entityName, s.title, s.dimension,
          s.threatCommunity, s.attackVector, s.vulnerabilities, s.legalBasis,
          s.probability, s.impact, pOv, iOv,
          s.rationale, prev?.override_rationale ?? null,
          residualP, residualI, riskLevel(residualP, residualI),
          prev?.frequency ?? null, prev?.ale ?? null, prev?.var90 ?? null,
          prev?.status ?? "open",
        ],
      );
    }

    // --- Etapa 5: plan de acción (no duplica ni pisa lo ya resuelto) ---
    const plan = buildActionPlan(questionnaire, highRisk, dpoRequired, profile.isProcessor === true);
    for (const c of plan) {
      await pool.query(
        `INSERT INTO dp_action_item
           (company_id, control_key, category, title, description, legal_basis, effort,
            compliance_points, risk_reduction, priority, doc_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
         ON CONFLICT (company_id, control_key) WHERE procedure_id IS NULL
         DO UPDATE SET priority = EXCLUDED.priority, updated_at = NOW()`,
        [
          companyId, c.key, c.category, c.title, c.description, c.legalBasis, c.effort,
          c.compliancePoints, JSON.stringify(c.riskReduction), c.priority, c.docType ?? null,
        ],
      );
    }
    // Las acciones cuyo control ya no aplica (el usuario resolvió la vulnerabilidad
    // en el cuestionario) se cierran automáticamente.
    const planKeys = plan.map((c) => c.key);
    await pool.query(
      `UPDATE dp_action_item SET status = 'done', completed_at = COALESCE(completed_at, NOW()),
              resolution_type = COALESCE(resolution_type, 'implemented'), updated_at = NOW()
        WHERE company_id = $1 AND procedure_id IS NULL AND status IN ('pending','in_progress')
          AND NOT (control_key = ANY($2::text[]))`,
      [companyId, planKeys.length > 0 ? planKeys : [""]],
    );

    return this.recomputeAssessment(companyId, trigger);
  }

  private async getCompletedControls(companyId: string): Promise<string[]> {
    const { rows } = await pool.query(
      `SELECT control_key FROM dp_action_item WHERE company_id = $1 AND status = 'done'`,
      [companyId],
    );
    const fromActions = rows.map((r) => r.control_key);

    // Un control también se considera implementado si el cuestionario lo declara
    // (el usuario que ya tenía cifrado no debería tener que "completar la acción").
    const profile = await this.getProfile(companyId);
    const q = profile?.questionnaire ?? {};
    const fromQuestionnaire = CONTROL_CATALOG.filter((c) => {
      const def = VULNERABILITY_CATALOG.find((v) => v.key === c.key);
      return def && q[def.questionKey] === true;
    }).map((c) => c.key);

    return Array.from(new Set(fromActions.concat(fromQuestionnaire)));
  }

  /** Recalcula ambas calificaciones y guarda una foto SOLO si el valor cambió. */
  async recomputeAssessment(companyId: string, trigger = "manual"): Promise<any> {
    const profile = (await this.getProfile(companyId)) ?? { questionnaire: {}, annualRevenueRange: null };
    const classifications = await this.getClassificationInputs(companyId);
    const completedControls = await this.getCompletedControls(companyId);
    const highRisk = isHighRiskTreatment(classifications);
    const dpoRequired = isDpoRequired(classifications, profile.questionnaire ?? {});

    const scenarioRows = await pool.query(
      `SELECT residual_probability, residual_impact, level, status FROM dp_risk_scenario WHERE company_id = $1`,
      [companyId],
    );
    const scenarios = scenarioRows.rows.map((r) => ({
      residualProbability: r.residual_probability,
      residualImpact: r.residual_impact,
      level: r.level,
      status: r.status,
    }));

    const docRows = await pool.query(
      `SELECT DISTINCT ON (doc_type) doc_type, status
         FROM dp_document WHERE company_id = $1
        ORDER BY doc_type, version DESC, created_at DESC`,
      [companyId],
    );
    const documents: Record<string, any> = {};
    for (const d of docRows.rows) documents[d.doc_type] = d.status;

    const reqRows = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND due_date < NOW()) AS overdue,
              COUNT(*) FILTER (WHERE status IN ('open','in_progress')) AS open
         FROM dp_titular_request WHERE company_id = $1`,
      [companyId],
    );
    const overdueRequests = num(reqRows.rows[0]?.overdue);

    const { score: complianceScore, items } = computeComplianceScore({
      questionnaire: profile.questionnaire ?? {},
      completedControls,
      documents,
      highRisk,
      dpoRequired,
      overdueRequests,
    });

    const rScore = computeRiskScore(scenarios);
    const fine = estimateFine(items, highRisk, profile.annualRevenueRange ?? null);

    const totals = await pool.query(
      `SELECT (SELECT COUNT(*) FROM assets WHERE company_id = $1)
            + (SELECT COUNT(*) FROM licenses WHERE company_id = $1)
            + (SELECT COUNT(*) FROM contracts WHERE company_id = $1) AS total_assets,
             (SELECT COUNT(*) FROM dp_asset_classification WHERE company_id = $1) AS classified,
             (SELECT COUNT(*) FROM dp_action_item WHERE company_id = $1 AND status IN ('pending','in_progress')) AS pending`,
      [companyId],
    );

    const byLevel = { bajo: 0, medio: 0, alto: 0, muy_alto: 0 } as Record<string, number>;
    for (const s of scenarios) byLevel[s.level] = (byLevel[s.level] ?? 0) + 1;

    const breakdown = {
      compliance: items,
      scenarioCount: scenarios.length,
      scenariosByLevel: byLevel,
      classifiedAssets: num(totals.rows[0]?.classified),
      totalAssets: num(totals.rows[0]?.total_assets),
      pendingActions: num(totals.rows[0]?.pending),
      openRequests: num(reqRows.rows[0]?.open),
      overdueRequests,
      highRisk,
      dpoRequired,
    };

    const last = await this.getLatestAssessment(companyId);
    const changed =
      !last ||
      Math.abs(num(last.riskScore) - rScore) > 0.01 ||
      Math.abs(num(last.complianceScore) - complianceScore) > 0.01;

    if (!changed) {
      // Se actualiza el desglose de la foto vigente sin ensuciar el histórico.
      await pool.query(`UPDATE dp_assessment SET breakdown = $2::jsonb WHERE id = $1`, [
        last.id,
        JSON.stringify(breakdown),
      ]);
      return { ...last, breakdown };
    }

    const { rows } = await pool.query(
      `INSERT INTO dp_assessment
         (company_id, risk_score, risk_grade, compliance_score, compliance_grade,
          estimated_fine_min, estimated_fine_max, worst_infraction, breakdown, trigger)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
       RETURNING *`,
      [
        companyId, rScore, riskGrade(rScore), complianceScore, complianceGrade(complianceScore),
        Math.round(fine.min * 100) / 100, Math.round(fine.max * 100) / 100, fine.worst,
        JSON.stringify(breakdown), trigger,
      ],
    );
    return toCamel(rows[0]);
  }

  /**
   * Lectura accionable de la calificación vigente: qué significa, qué puntaje
   * hace falta para estar cubierto y qué hacer si se está por debajo.
   */
  async getInterpretation(companyId: string): Promise<any | null> {
    const assessment = await this.getLatestAssessment(companyId);
    if (!assessment) return null;

    const actions = await this.getActions(companyId);
    const pendingActions = actions
      .filter((a: any) => a.status === "pending" || a.status === "in_progress")
      .map((a: any) => ({
        title: a.title,
        legalBasis: a.legalBasis,
        effort: a.effort,
        compliancePoints: num(a.compliancePoints),
        priority: num(a.priority),
      }));

    const base = interpretAssessment({
      riskScore: num(assessment.riskScore),
      complianceScore: num(assessment.complianceScore),
      items: (assessment.breakdown?.compliance ?? []) as any[],
      pendingActions,
      estimatedFineMax: num(assessment.estimatedFineMax),
      worstInfraction: assessment.worstInfraction ?? null,
    });

    // Lo que el usuario respondió "No sé" no es un fallo suyo: es trabajo de
    // averiguación con un siguiente paso concreto.
    const profile = await this.getProfile(companyId);
    const toVerify = unknownAnswers(profile?.questionnaire ?? {}).map((q) => ({
      key: q.key,
      question: q.question,
      whatItMeans: q.whatItMeans,
      legalBasis: q.legalBasis,
    }));

    return { ...base, toVerify };
  }

  /** Cuestionario guiado adaptado al sector de la empresa. */
  async getGuide(companyId: string): Promise<any> {
    const profile = await this.getProfile(companyId);
    const guide = buildGuide((profile?.sector ?? "otro") as any);
    return {
      ...guide,
      sector: profile?.sector ?? null,
      answers: profile?.questionnaire ?? {},
      profileCompleted: Boolean(profile?.wizardCompletedAt),
    };
  }

  async getLatestAssessment(companyId: string): Promise<any | null> {
    const { rows } = await pool.query(
      `SELECT * FROM dp_assessment WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [companyId],
    );
    return rows[0] ? toCamel(rows[0]) : null;
  }

  async getAssessmentHistory(companyId: string, limit = 30): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT id, risk_score, risk_grade, compliance_score, compliance_grade, trigger, created_at
         FROM dp_assessment WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [companyId, limit],
    );
    return toCamelAll(rows).reverse();
  }

  // ==========================================================================
  // ESCENARIOS
  // ==========================================================================

  async getScenarios(companyId: string): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT * FROM dp_risk_scenario WHERE company_id = $1
        ORDER BY CASE level WHEN 'muy_alto' THEN 1 WHEN 'alto' THEN 2 WHEN 'medio' THEN 3 ELSE 4 END,
                 residual_impact DESC, residual_probability DESC`,
      [companyId],
    );
    return toCamelAll(rows);
  }

  async updateScenario(companyId: string, id: string, data: any): Promise<any> {
    const current = await pool.query(
      `SELECT * FROM dp_risk_scenario WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    if (current.rowCount === 0) throw new Error("Escenario no encontrado");
    const row = current.rows[0];

    const p = data.probabilityOverride ?? row.probability;
    const i = data.impactOverride ?? row.impact;

    let ale = row.ale;
    let var90 = row.var90;
    if (data.frequency && data.impactMin != null && data.impactLikely != null && data.impactMax != null) {
      const q = quantitativeRisk(data.frequency, data.impactMin, data.impactLikely, data.impactMax);
      ale = q.ale;
      var90 = q.var90;
    }

    const { rows } = await pool.query(
      `UPDATE dp_risk_scenario
          SET probability_override = $3, impact_override = $4, override_rationale = $5,
              residual_probability = $6, residual_impact = $7, level = $8,
              status = COALESCE($9, status), frequency = $10, ale = $11, var90 = $12, updated_at = NOW()
        WHERE id = $1 AND company_id = $2
        RETURNING *`,
      [
        id, companyId,
        data.probabilityOverride ?? null, data.impactOverride ?? null, data.overrideRationale,
        p, i, riskLevel(p, i), data.status ?? null,
        data.frequency ?? row.frequency, ale, var90,
      ],
    );
    await this.recomputeAssessment(companyId, "manual");
    return toCamel(rows[0]);
  }

  // ==========================================================================
  // PLAN DE ACCIÓN
  // ==========================================================================

  async getActions(companyId: string): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT * FROM dp_action_item WHERE company_id = $1
        ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'done' THEN 3 ELSE 4 END,
                 priority DESC`,
      [companyId],
    );
    return toCamelAll(rows);
  }

  async updateAction(companyId: string, id: string, data: any): Promise<any> {
    const evidence = data.evidenceNote
      ? JSON.stringify([{ note: data.evidenceNote, date: new Date().toISOString() }])
      : null;

    const { rows } = await pool.query(
      // $3 se usa a la vez en asignación y en comparación: sin el cast explícito
      // Postgres no puede deducir el tipo (text vs varchar) y falla con 42P08.
      `UPDATE dp_action_item
          SET status = $3::text,
              na_rationale = $4,
              assigned_to = COALESCE($5, assigned_to),
              due_date = COALESCE($6, due_date),
              resolution_type = CASE WHEN $3::text = 'done' THEN 'implemented'
                                     WHEN $3::text = 'not_applicable' THEN 'na'
                                     ELSE resolution_type END,
              completed_at = CASE WHEN $3::text = 'done' THEN COALESCE(completed_at, NOW()) ELSE NULL END,
              evidence = CASE WHEN $7::jsonb IS NOT NULL THEN evidence || $7::jsonb ELSE evidence END,
              updated_at = NOW()
        WHERE id = $1 AND company_id = $2
        RETURNING *`,
      [id, companyId, data.status, data.naRationale ?? null, data.assignedTo ?? null, data.dueDate ?? null, evidence],
    );
    if (rows.length === 0) throw new Error("Acción no encontrada");

    // Completar un control cambia el riesgo residual: hay que re-instanciar escenarios.
    await this.runEngineLight(companyId);
    return toCamel(rows[0]);
  }

  /** Recalcula escenarios y calificación sin regenerar el plan (evita recursión). */
  private async runEngineLight(companyId: string): Promise<void> {
    const profile = (await this.getProfile(companyId)) ?? { sector: "otro", questionnaire: {} };
    const classifications = await this.getClassificationInputs(companyId);
    const completedControls = await this.getCompletedControls(companyId);
    const computed = computeScenarios(classifications, profile.questionnaire ?? {}, profile.sector, completedControls);

    for (const s of computed) {
      await pool.query(
        `UPDATE dp_risk_scenario
            SET residual_probability = COALESCE(probability_override, $4),
                residual_impact = COALESCE(impact_override, $5),
                level = $6, rationale = $7, updated_at = NOW()
          WHERE company_id = $1 AND template_key = $2 AND classification_id = $3`,
        [
          companyId, s.templateKey, s.classificationId,
          s.residualProbability, s.residualImpact,
          riskLevel(s.residualProbability, s.residualImpact), s.rationale,
        ],
      );
    }
    await this.recomputeAssessment(companyId, "action_completed");
  }

  // ==========================================================================
  // DOCUMENTOS
  // ==========================================================================

  async getDocuments(companyId: string): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT id, company_id, doc_type, title, version, status, related_entity_id,
              published_at, created_at, updated_at, LEFT(content, 200) AS preview
         FROM dp_document WHERE company_id = $1
        ORDER BY created_at DESC`,
      [companyId],
    );
    return toCamelAll(rows);
  }

  async getDocument(companyId: string, id: string): Promise<any | null> {
    const { rows } = await pool.query(
      `SELECT * FROM dp_document WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return rows[0] ? toCamel(rows[0]) : null;
  }

  /** Reúne todo el contexto real de la empresa para renderizar plantillas. */
  async buildDocumentContext(companyId: string, related?: Record<string, any>): Promise<DocumentContext> {
    const [companyRes, profile, classRows, scenarios, assessment, actions] = await Promise.all([
      pool.query(`SELECT id, name, ruc, address, phone, email FROM companies WHERE id = $1`, [companyId]),
      this.getProfile(companyId),
      pool.query(
        `SELECT c.*, COALESCE(a.name, l.name, ct.name, '(sin nombre)') AS entity_name,
                CASE WHEN c.asset_id IS NOT NULL THEN 'activo'
                     WHEN c.license_id IS NOT NULL THEN 'licencia'
                     ELSE 'contrato' END AS entity_kind
           FROM dp_asset_classification c
           LEFT JOIN assets a ON a.id = c.asset_id
           LEFT JOIN licenses l ON l.id = c.license_id
           LEFT JOIN contracts ct ON ct.id = c.contract_id
          WHERE c.company_id = $1 AND c.has_personal_data = TRUE`,
        [companyId],
      ),
      this.getScenarios(companyId),
      this.getLatestAssessment(companyId),
      this.getActions(companyId),
    ]);

    const company = companyRes.rows[0] ?? { id: companyId, name: "Empresa", ruc: null, address: null, phone: null, email: null };

    return {
      company,
      profile: {
        sector: profile?.sector ?? "otro",
        legalRepName: profile?.legalRepName ?? null,
        dpoName: profile?.dpoName ?? null,
        dpoEmail: profile?.dpoEmail ?? null,
        arcoChannel: profile?.arcoChannel ?? null,
        isProcessor: profile?.isProcessor ?? false,
        questionnaire: profile?.questionnaire ?? {},
      },
      classifications: classRows.rows.map((r) => ({
        entityName: r.entity_name,
        entityKind: r.entity_kind,
        dataCategories: r.data_categories ?? [],
        dataSubjects: r.data_subjects ?? [],
        subjectCountRange: r.subject_count_range,
        storageLocation: r.storage_location,
        isProcessorAsset: r.is_processor_asset,
        retentionPeriod: r.retention_period,
      })),
      scenarios: scenarios.map((s: any) => ({
        title: s.title,
        entityName: s.entityName,
        dimension: s.dimension,
        level: s.level,
        probability: s.probability,
        impact: s.impact,
        residualProbability: s.residualProbability,
        residualImpact: s.residualImpact,
        rationale: s.rationale,
        legalBasis: s.legalBasis,
        threatCommunity: s.threatCommunity,
      })),
      assessment: assessment
        ? {
            riskScore: num(assessment.riskScore),
            riskGrade: assessment.riskGrade,
            complianceScore: num(assessment.complianceScore),
            complianceGrade: assessment.complianceGrade,
            estimatedFineMin: num(assessment.estimatedFineMin),
            estimatedFineMax: num(assessment.estimatedFineMax),
            worstInfraction: assessment.worstInfraction,
            breakdown: assessment.breakdown,
          }
        : null,
      actions: actions.map((a: any) => ({
        title: a.title,
        category: a.category,
        legalBasis: a.legalBasis,
        status: a.status,
        completedAt: a.completedAt,
      })),
      related,
      generatedAt: new Date(),
    };
  }

  async createDocument(
    companyId: string,
    userId: string,
    docType: DpDocType,
    relatedEntityId?: string | null,
  ): Promise<any> {
    const related = await this.buildRelatedContext(companyId, docType, relatedEntityId);
    const ctx = await this.buildDocumentContext(companyId, related);
    const content = renderDocument(docType, ctx);

    const versionRes = await pool.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM dp_document WHERE company_id = $1 AND doc_type = $2`,
      [companyId, docType],
    );

    const { rows } = await pool.query(
      `INSERT INTO dp_document
         (company_id, doc_type, title, version, content, variables, status, related_entity_id, generated_by)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'generated',$7,$8)
       RETURNING *`,
      [
        companyId, docType, DP_DOC_LABELS[docType] ?? docType,
        num(versionRes.rows[0]?.next) || 1, content,
        JSON.stringify({ company: ctx.company.name, generatedAt: ctx.generatedAt }),
        relatedEntityId ?? null, userId,
      ],
    );

    await this.recomputeAssessment(companyId, "manual");
    return toCamel(rows[0]);
  }

  /** Contexto adicional según el tipo de documento (titular, incidente, procedimiento…). */
  private async buildRelatedContext(
    companyId: string,
    docType: DpDocType,
    relatedEntityId?: string | null,
  ): Promise<Record<string, any>> {
    const related: Record<string, any> = {};

    if (docType === "titular_response" && relatedEntityId) {
      const { rows } = await pool.query(
        `SELECT * FROM dp_titular_request WHERE id = $1 AND company_id = $2`,
        [relatedEntityId, companyId],
      );
      if (rows[0]) {
        const r = toCamel<any>(rows[0]);
        related.titularName = r.titularName;
        related.requestType = r.requestType;
        related.requestTypeLabel = (DP_REQUEST_TYPE_LABELS as any)[r.requestType];
        related.receivedAt = r.receivedAt;
        related.dueDate = r.dueDate;
        related.resolution = r.resolution;
        related.resolutionRationale = r.resolutionRationale;
        if ((r.affectedAssetIds ?? []).length > 0) {
          const assets = await pool.query(
            `SELECT name FROM assets WHERE company_id = $1 AND id = ANY($2::text[])`,
            [companyId, r.affectedAssetIds],
          );
          related.affectedAssets = assets.rows.map((a) => `Se aplicó lo resuelto en: ${a.name}`);
        }
      }
    }

    if (docType === "spdp_notification" && relatedEntityId) {
      const { rows } = await pool.query(
        `SELECT * FROM dp_incident WHERE id = $1 AND company_id = $2`,
        [relatedEntityId, companyId],
      );
      if (rows[0]) Object.assign(related, toCamel<any>(rows[0]));
    }

    if ((docType === "descargos" || docType === "medidas_informe") && relatedEntityId) {
      const { rows } = await pool.query(
        `SELECT * FROM dp_authority_procedure WHERE id = $1 AND company_id = $2`,
        [relatedEntityId, companyId],
      );
      if (rows[0]) Object.assign(related, toCamel<any>(rows[0]));
    }

    if (docType === "dpa" && relatedEntityId) {
      const { rows } = await pool.query(
        `SELECT name, vendor FROM contracts WHERE id = $1 AND company_id = $2`,
        [relatedEntityId, companyId],
      );
      if (rows[0]) {
        related.providerName = rows[0].vendor || rows[0].name;
        related.purpose = rows[0].name;
      }
    }

    if (["expediente", "descargos", "trazabilidad", "certificado"].includes(docType)) {
      const docRows = await pool.query(
        `SELECT DISTINCT ON (doc_type) doc_type, status FROM dp_document
          WHERE company_id = $1 ORDER BY doc_type, version DESC`,
        [companyId],
      );
      related.documents = Object.fromEntries(docRows.rows.map((d) => [d.doc_type, d.status]));

      const stats = await pool.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE answered_at IS NOT NULL AND answered_at <= due_date) AS on_time,
                COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND due_date < NOW()) AS overdue
           FROM dp_titular_request WHERE company_id = $1`,
        [companyId],
      );
      related.requestStats = {
        total: num(stats.rows[0]?.total),
        onTime: num(stats.rows[0]?.on_time),
        overdue: num(stats.rows[0]?.overdue),
      };

      const inc = await pool.query(`SELECT COUNT(*) AS total FROM dp_incident WHERE company_id = $1`, [companyId]);
      related.incidentCount = num(inc.rows[0]?.total);

      if (docType === "trazabilidad") {
        const logs = await pool.query(
          `SELECT l.action, l.entity_type, l.entity_name, l.created_at, l.user_id,
                  u.first_name || ' ' || u.last_name AS user_name
             FROM activity_log l LEFT JOIN users u ON u.id = l.user_id
            WHERE l.company_id = $1 AND l.entity_type LIKE 'dp_%'
            ORDER BY l.created_at DESC LIMIT 200`,
          [companyId],
        );
        related.activityLog = toCamelAll(logs.rows);
      }
    }

    return related;
  }

  async updateDocument(companyId: string, id: string, data: any): Promise<any> {
    const { rows } = await pool.query(
      // Mismo caso que en updateAction: $5 necesita cast explícito.
      `UPDATE dp_document
          SET content = COALESCE($3, content),
              title = COALESCE($4, title),
              status = COALESCE($5::text, status),
              published_at = CASE WHEN $5::text = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
              updated_at = NOW()
        WHERE id = $1 AND company_id = $2
        RETURNING *`,
      [id, companyId, data.content ?? null, data.title ?? null, data.status ?? null],
    );
    if (rows.length === 0) throw new Error("Documento no encontrado");
    await this.recomputeAssessment(companyId, "manual");
    return toCamel(rows[0]);
  }

  async deleteDocument(companyId: string, id: string): Promise<void> {
    await pool.query(`DELETE FROM dp_document WHERE id = $1 AND company_id = $2`, [id, companyId]);
    await this.recomputeAssessment(companyId, "manual");
  }

  // ==========================================================================
  // MODO DEFENSA — SOLICITUDES DE TITULARES (art. 62)
  // ==========================================================================

  async getTitularRequests(companyId: string): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT * FROM dp_titular_request WHERE company_id = $1 ORDER BY due_date ASC`,
      [companyId],
    );
    return toCamelAll(rows).map((r: any) => ({
      ...r,
      daysLeft: businessDaysLeft(new Date(r.dueDate)),
      isOverdue: new Date(r.dueDate) < new Date() && ["open", "in_progress"].includes(r.status),
    }));
  }

  async createTitularRequest(companyId: string, data: any): Promise<any> {
    const receivedAt = new Date(data.receivedAt);
    const dueDate = titularRequestDueDate(receivedAt);

    const { rows } = await pool.query(
      `INSERT INTO dp_titular_request
         (company_id, request_type, titular_name, titular_contact, titular_id_number,
          channel, detail, received_at, due_date, affected_asset_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        companyId, data.requestType, data.titularName, data.titularContact ?? null,
        data.titularIdNumber ?? null, data.channel ?? null, data.detail ?? null,
        receivedAt, dueDate, data.affectedAssetIds ?? [],
      ],
    );
    await this.recomputeAssessment(companyId, "manual");
    return toCamel(rows[0]);
  }

  async updateTitularRequest(companyId: string, id: string, data: any): Promise<any> {
    const evidence = data.evidenceNote
      ? JSON.stringify([{ note: data.evidenceNote, date: new Date().toISOString() }])
      : null;
    const closing = ["answered", "executed", "denied"].includes(data.status ?? "");

    const { rows } = await pool.query(
      `UPDATE dp_titular_request
          SET status = COALESCE($3, status),
              resolution = COALESCE($4, resolution),
              resolution_rationale = COALESCE($5, resolution_rationale),
              affected_asset_ids = COALESCE($6, affected_asset_ids),
              evidence = CASE WHEN $7::jsonb IS NOT NULL THEN evidence || $7::jsonb ELSE evidence END,
              answered_at = CASE WHEN $8 THEN COALESCE(answered_at, NOW()) ELSE answered_at END,
              updated_at = NOW()
        WHERE id = $1 AND company_id = $2
        RETURNING *`,
      [
        id, companyId, data.status ?? null, data.resolution ?? null,
        data.resolutionRationale ?? null, data.affectedAssetIds ?? null, evidence, closing,
      ],
    );
    if (rows.length === 0) throw new Error("Solicitud no encontrada");
    await this.recomputeAssessment(companyId, "manual");
    return toCamel(rows[0]);
  }

  /** Dónde viven los datos de un titular: alimenta la respuesta al requerimiento. */
  async getDataLocations(companyId: string): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT c.id, c.data_categories, c.data_subjects, c.storage_location, c.is_processor_asset,
              COALESCE(a.id, l.id, ct.id) AS entity_id,
              COALESCE(a.name, l.name, ct.name) AS entity_name,
              CASE WHEN c.asset_id IS NOT NULL THEN 'asset'
                   WHEN c.license_id IS NOT NULL THEN 'license' ELSE 'contract' END AS entity_kind
         FROM dp_asset_classification c
         LEFT JOIN assets a ON a.id = c.asset_id
         LEFT JOIN licenses l ON l.id = c.license_id
         LEFT JOIN contracts ct ON ct.id = c.contract_id
        WHERE c.company_id = $1 AND c.has_personal_data = TRUE
        ORDER BY 7`,
      [companyId],
    );
    return toCamelAll(rows);
  }

  // ==========================================================================
  // MODO DEFENSA — INCIDENTES (art. 43: 72 horas)
  // ==========================================================================

  async getIncidents(companyId: string): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT * FROM dp_incident WHERE company_id = $1 ORDER BY detected_at DESC`,
      [companyId],
    );
    return toCamelAll(rows).map((r: any) => ({
      ...r,
      hoursLeft: Math.round((new Date(r.spdpDeadline).getTime() - Date.now()) / 36e5),
    }));
  }

  async createIncident(companyId: string, data: any): Promise<any> {
    const detectedAt = new Date(data.detectedAt);
    const { rows } = await pool.query(
      `INSERT INTO dp_incident
         (company_id, title, description, detected_at, dimensions, data_categories,
          subject_count_estimate, severity, spdp_deadline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        companyId, data.title, data.description ?? "", detectedAt,
        data.dimensions ?? [], data.dataCategories ?? [],
        data.subjectCountEstimate ?? null, data.severity ?? "media",
        incidentSpdpDeadline(detectedAt),
      ],
    );
    return toCamel(rows[0]);
  }

  async updateIncident(companyId: string, id: string, data: any): Promise<any> {
    const { rows } = await pool.query(
      `UPDATE dp_incident
          SET status = COALESCE($3, status),
              measures_taken = COALESCE($4, measures_taken),
              spdp_notified_at = COALESCE($5, spdp_notified_at),
              subjects_notified_at = COALESCE($6, subjects_notified_at),
              updated_at = NOW()
        WHERE id = $1 AND company_id = $2
        RETURNING *`,
      [id, companyId, data.status ?? null, data.measuresTaken ?? null,
       data.spdpNotifiedAt ?? null, data.subjectsNotifiedAt ?? null],
    );
    if (rows.length === 0) throw new Error("Incidente no encontrado");
    return toCamel(rows[0]);
  }

  // ==========================================================================
  // MODO DEFENSA — PROCEDIMIENTOS SPDP (arts. 63-66)
  // ==========================================================================

  async getProcedures(companyId: string): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT * FROM dp_authority_procedure WHERE company_id = $1 ORDER BY notified_at DESC`,
      [companyId],
    );
    return toCamelAll(rows).map((r: any) => ({
      ...r,
      daysLeft: r.deadline ? businessDaysLeft(new Date(r.deadline)) : null,
    }));
  }

  async createProcedure(companyId: string, data: any): Promise<any> {
    const { rows } = await pool.query(
      `INSERT INTO dp_authority_procedure
         (company_id, procedure_type, file_number, notified_at, deadline, description,
          corrective_measures, related_request_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        companyId, data.procedureType, data.fileNumber ?? null, new Date(data.notifiedAt),
        data.deadline ?? null, data.description ?? "", data.correctiveMeasures ?? null,
        data.relatedRequestId ?? null,
      ],
    );
    const proc = toCamel<any>(rows[0]);

    // Las medidas correctivas se materializan como acciones del plan con deadline
    // duro: cumplirlas a tiempo es lo que evita la sanción en infracciones graves
    // (art. 66.2 LOPDP).
    if (data.procedureType === "medida_correctiva" && data.correctiveMeasures) {
      const measures = String(data.correctiveMeasures)
        .split("\n")
        .map((m) => m.trim())
        .filter(Boolean);
      for (let idx = 0; idx < measures.length; idx++) {
        const m = measures[idx];
        await pool.query(
          `INSERT INTO dp_action_item
             (company_id, control_key, category, title, description, legal_basis, effort,
              compliance_points, risk_reduction, priority, procedure_id, due_date)
           VALUES ($1,$2,'juridica',$3,$4,'Arts. 65-66 LOPDP','dias',0,'{}'::jsonb,9999,$5,$6)`,
          [
            companyId,
            `MC-${proc.id.slice(0, 8)}-${idx + 1}`,
            `Medida correctiva SPDP: ${m.slice(0, 120)}`,
            `Medida dispuesta por la Superintendencia en el expediente ${data.fileNumber || "s/n"}. ` +
              `Cumplirla íntegra y oportunamente evita la sanción en infracciones graves (art. 66.2 LOPDP).`,
            proc.id,
            data.deadline ?? null,
          ],
        );
      }
    }
    return proc;
  }

  async updateProcedure(companyId: string, id: string, data: any): Promise<any> {
    const { rows } = await pool.query(
      `UPDATE dp_authority_procedure
          SET status = COALESCE($3, status),
              outcome = COALESCE($4, outcome),
              corrective_measures = COALESCE($5, corrective_measures),
              deadline = COALESCE($6, deadline),
              updated_at = NOW()
        WHERE id = $1 AND company_id = $2
        RETURNING *`,
      [id, companyId, data.status ?? null, data.outcome ?? null,
       data.correctiveMeasures ?? null, data.deadline ?? null],
    );
    if (rows.length === 0) throw new Error("Procedimiento no encontrado");
    return toCamel(rows[0]);
  }

  // ==========================================================================
  // TRAZABILIDAD
  // ==========================================================================

  /** Mapa de flujo: finalidad → datos → activos → ubicación → encargados. */
  async getTraceabilityMap(companyId: string): Promise<any> {
    const profile = await this.getProfile(companyId);
    const locations = await this.getDataLocations(companyId);
    const purposes = profile?.questionnaire?.purposes ?? [];

    const processors = locations.filter((l: any) => l.isProcessorAsset);
    const categories = Array.from(new Set(locations.flatMap((l: any) => l.dataCategories ?? [])));
    const subjects = Array.from(new Set(locations.flatMap((l: any) => l.dataSubjects ?? [])));

    return {
      purposes,
      categories,
      subjects,
      assets: locations,
      processors,
      foreignTransfer: locations.some((l: any) => l.storageLocation === "nube_ext"),
    };
  }

  async getTraceabilityLog(companyId: string, limit = 200): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT l.id, l.action, l.entity_type, l.entity_name, l.details, l.created_at,
              u.first_name || ' ' || u.last_name AS user_name
         FROM activity_log l
         LEFT JOIN users u ON u.id = l.user_id
        WHERE l.company_id = $1 AND l.entity_type LIKE 'dp_%'
        ORDER BY l.created_at DESC LIMIT $2`,
      [companyId, limit],
    );
    return toCamelAll(rows);
  }
}

export const lopdpStorage = new LopdpStorage();
