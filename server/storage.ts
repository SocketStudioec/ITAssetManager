/**
 * CAPA DE ACCESO A DATOS (DATA ACCESS LAYER)
 * 
 * Este archivo implementa el patrón Repository para toda la lógica de acceso a datos.
 * Contiene la interfaz IStorage y su implementación DatabaseStorage que actúa como
 * una capa de abstracción entre las rutas (controladores) y la base de datos.
 * 
 * ARQUITECTURA DEL STORAGE:
 * - Interface IStorage: Define el contrato para todas las operaciones de datos
 * - DatabaseStorage: Implementación usando queries SQL nativas con PostgreSQL
 * - Operaciones CRUD: Create, Read, Update, Delete para todas las entidades
 * - Queries avanzados: Analytics, dashboards, búsquedas complejas
 * - Transacciones: Para operaciones que requieren consistencia
 * 
 * BENEFICIOS:
 * - Separación de responsabilidades (SRP - Single Responsibility Principle)
 * - Fácil testing con implementaciones mock
 * - Reutilización de queries complejos
 * - Type safety con TypeScript
 * - Centralización de lógica de negocio relacionada con datos
 * 
 * SEGURIDAD:
 * - Todas las queries incluyen filtros por companyId (multi-tenancy)
 * - Validación de permisos a nivel de datos
 * - Prevención de SQL injection via prepared statements
 * - Logging automático de todas las operaciones críticas
 */

import {
  type User,
  type UpsertUser,
  type Company,
  type InsertCompany,
  type Asset,
  type InsertAsset,
  type Contract,
  type InsertContract,
  type License,
  type InsertLicense,
  type MaintenanceRecord,
  type InsertMaintenanceRecord,
  type ActivityLog,
  type UserCompany,
  type CompanyRegistration,
} from "@shared/schema";
import { pool } from "./db";

function mapUserFromDb(row: any): User | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    firstName: row.first_name,
    lastName: row.last_name,
    profileImageUrl: row.profile_image_url,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(email: string, passwordHash: string, firstName: string, lastName: string, role?: "super_admin" | "technical_admin" | "manager_owner"): Promise<User>;

  // Company operations
  getUserCompanies(userId: string): Promise<(UserCompany & { company: Company })[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  addUserToCompany(userId: string, companyId: string, role: "super_admin" | "technical_admin" | "manager_owner" | "technician"): Promise<UserCompany>;
  getCompanyById(companyId: string): Promise<Company | undefined>;
  registerCompany(companyData: CompanyRegistration): Promise<{ company: Company; user: User }>;
  updateCompany(id: string, companyData: Partial<InsertCompany>): Promise<Company>;

  // Admin operations
  getAllCompanies(): Promise<(Company & { userCount: number, assetCount: number })[]>;
  updateCompanyPlan(companyId: string, plan: "pyme" | "professional", maxUsers?: number, maxAssets?: number): Promise<Company>;
  toggleCompanyStatus(companyId: string, isActive: boolean): Promise<Company>;

  // Asset operations
  getAssetsByCompany(companyId: string): Promise<Asset[]>;
  getAssetById(id: string, companyId: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: string, asset: Partial<InsertAsset>): Promise<Asset>;
  deleteAsset(id: string, companyId: string): Promise<void>;

  // Contract operations
  getContractsByCompany(companyId: string): Promise<Contract[]>;
  getContractById(id: string, companyId: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract>;
  deleteContract(id: string, companyId: string): Promise<void>;

  // License operations
  getLicensesByCompany(companyId: string): Promise<License[]>;
  getLicenseById(id: string, companyId: string): Promise<License | undefined>;
  createLicense(license: InsertLicense): Promise<License>;
  updateLicense(id: string, license: Partial<InsertLicense>): Promise<License>;
  deleteLicense(id: string, companyId: string): Promise<void>;

  // Maintenance operations
  getMaintenanceRecordsByCompany(companyId: string): Promise<MaintenanceRecord[]>;
  getMaintenanceRecordsByAsset(assetId: string, companyId: string): Promise<MaintenanceRecord[]>;
  createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord>;
  updateMaintenanceRecord(id: string, record: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord>;
  getMaintenanceRecordById(id: string, companyId: string): Promise<MaintenanceRecord | undefined>;
  deleteMaintenanceRecord(id: string, companyId: string): Promise<void>;

  // ── DASHBOARD ANALYTICS ──────────────────────────────────────────────────
  // Retorna costos separados en: real (monthly_cost) y contable (annual_cost)
  getCompanyCostSummary(companyId: string): Promise<{
    // Campos originales (se mantienen para no romper componentes existentes)
    monthlyTotal: number;
    annualTotal: number;
    licenseCosts: number;
    maintenanceCosts: number;
    hardwareCosts: number;
    applicationCosts: number;
    contractCosts: number;
    // Campos nuevos: separación contable vs real
    monthlyReal: number;
    annualReal: number;
    monthlyAccounting: number;
    annualAccounting: number;
  }>;

  getAssetCounts(companyId: string): Promise<{
    totalAssets: number;
    physicalAssets: number;
    applications: number;
    licenses: number;
    contracts: number;
  }>;

  // Activity log
  logActivity(activity: {
    companyId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    entityName?: string;
    details?: string;
  }): Promise<ActivityLog>;

  getRecentActivity(companyId: string, limit?: number): Promise<(ActivityLog & { user: User })[]>;
}

export class DatabaseStorage implements IStorage {

  async getUser(id: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return mapUserFromDb(result.rows[0]);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return mapUserFromDb(result.rows[0]);
  }

  async createUser(email: string, passwordHash: string, firstName: string, lastName: string, role: "super_admin" | "technical_admin" | "manager_owner" = "technical_admin"): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [email, passwordHash, firstName, lastName, role]
    );
    return mapUserFromDb(result.rows[0])!;
  }

  async getUserCompanies(userId: string): Promise<(UserCompany & { company: Company })[]> {
    const result = await pool.query(
      `SELECT 
        uc.*,
        c.id as "company.id", c.name as "company.name", c.description as "company.description",
        c.plan as "company.plan", c.max_users as "company.max_users", c.max_assets as "company.max_assets",
        c.is_active as "company.is_active", c.ruc as "company.ruc", c.cedula as "company.cedula",
        c.address as "company.address", c.phone as "company.phone", c.email as "company.email",
        c.created_at as "company.created_at", c.updated_at as "company.updated_at"
      FROM user_companies uc
      LEFT JOIN companies c ON uc.company_id = c.id
      WHERE uc.user_id = $1`,
      [userId]
    );
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      companyId: row.company_id,
      role: row.role,
      createdAt: row.created_at,
      company: {
        id: row['company.id'], name: row['company.name'], description: row['company.description'],
        plan: row['company.plan'], maxUsers: row['company.max_users'], maxAssets: row['company.max_assets'],
        isActive: row['company.is_active'], ruc: row['company.ruc'], cedula: row['company.cedula'],
        address: row['company.address'], phone: row['company.phone'], email: row['company.email'],
        createdAt: row['company.created_at'], updatedAt: row['company.updated_at'],
      }
    }));
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const result = await pool.query(
      `INSERT INTO companies (name, description, plan, max_users, max_assets, ruc, cedula, address, phone, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [company.name, company.description, company.plan, company.maxUsers, company.maxAssets,
      company.ruc, company.cedula, company.address, company.phone, company.email]
    );
    return result.rows[0] as Company;
  }

  async addUserToCompany(userId: string, companyId: string, role: "super_admin" | "technical_admin" | "manager_owner" | "technician"): Promise<UserCompany> {
    const result = await pool.query(
      `INSERT INTO user_companies (user_id, company_id, role) VALUES ($1, $2, $3) RETURNING *`,
      [userId, companyId, role]
    );
    return result.rows[0] as UserCompany;
  }

  async updateCompany(id: string, companyData: Partial<InsertCompany>): Promise<Company> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    Object.entries(companyData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    if (fields.length === 0) throw new Error("No hay campos para actualizar");
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values
    );
    return result.rows[0] as Company;
  }

  async registerCompany(companyData: CompanyRegistration & { passwordHash: string }): Promise<{ company: Company; user: User }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existingUser = await this.getUserByEmail(companyData.email);
      if (existingUser) throw new Error("El email ya está registrado");
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [companyData.email, companyData.passwordHash, companyData.firstName, companyData.lastName, 'manager_owner']
      );
      const user = userResult.rows[0] as User;
      const companyResult = await client.query(
        `INSERT INTO companies (name, plan, max_users, max_assets, ruc, cedula, address, phone, email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [companyData.name, companyData.plan,
        companyData.plan === "pyme" ? 10 : 50,
        companyData.plan === "pyme" ? 500 : 2000,
        companyData.plan === "pyme" ? companyData.ruc : null,
        companyData.plan === "professional" ? companyData.cedula : null,
        companyData.address, companyData.phone, companyData.email]
      );
      const company = companyResult.rows[0] as Company;
      await client.query(
        `INSERT INTO user_companies (user_id, company_id, role) VALUES ($1, $2, $3)`,
        [user.id, company.id, 'manager_owner']
      );
      await client.query('COMMIT');
      return { company, user };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getCompanyById(companyId: string): Promise<Company | undefined> {
    const result = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
    return result.rows[0] as Company | undefined;
  }

  async getAssetsByCompany(companyId: string): Promise<Asset[]> {
    const result = await pool.query('SELECT * FROM assets WHERE company_id = $1', [companyId]);
    return result.rows as Asset[];
  }

  async getAssetById(id: string, companyId: string): Promise<Asset | undefined> {
    const result = await pool.query('SELECT * FROM assets WHERE id = $1 AND company_id = $2', [id, companyId]);
    return result.rows[0] as Asset | undefined;
  }



  /* async createAsset(asset: InsertAsset): Promise<Asset> {
     const result = await pool.query(
       `INSERT INTO assets (
         company_id, name, type, description, serial_number, model, manufacturer,
         purchase_date, warranty_expiry, monthly_cost, annual_cost, status, location,
         assigned_to, notes, application_type, url, version, domain_cost, ssl_cost,
         hosting_cost, server_cost, domain_expiry, ssl_expiry, hosting_expiry, server_expiry
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       RETURNING *`,
       [asset.companyId, asset.name, asset.type, asset.description, asset.serialNumber,
       asset.model, asset.manufacturer, asset.purchaseDate, asset.warrantyExpiry,
       asset.monthlyCost, asset.annualCost, asset.status, asset.location,
       asset.assignedTo, asset.notes, asset.applicationType, asset.url, asset.version,
       asset.domainCost, asset.sslCost, asset.hostingCost, asset.serverCost,
       asset.domainExpiry, asset.sslExpiry, asset.hostingExpiry, asset.serverExpiry]
     );
     return result.rows[0] as Asset;
   }*/

  async createAsset(asset: InsertAsset): Promise<Asset> {
    // 1. Aqui se gnera el código único para los AF
   
let assetCode = null;
if (asset.type === 'physical') {
  const yearStr = new Date().getFullYear().toString();
  const maxResult = await pool.query(
    `SELECT asset_code FROM assets 
     WHERE asset_code LIKE 'AF-${yearStr}-%' 
     ORDER BY asset_code DESC LIMIT 1`
  );
  let nextNum = 1;
  if (maxResult.rows.length > 0) {
    const lastCode = maxResult.rows[0].asset_code;
    const lastNum = parseInt(lastCode.split('-')[2]);
    nextNum = lastNum + 1;
  }
  assetCode = `AF-${yearStr}-${String(nextNum).padStart(5, '0')}`;
}
    // 2. Insertamos en el código
    const result = await pool.query(
      `INSERT INTO assets (
      company_id, name, type, description, serial_number, model, manufacturer,
      purchase_date, warranty_expiry, monthly_cost, annual_cost, status, location,
      assigned_to, notes, application_type, url, version, domain_cost, ssl_cost,
      hosting_cost, server_cost, domain_expiry, ssl_expiry, hosting_expiry, server_expiry,
      asset_code
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
    RETURNING *`,
      [asset.companyId, asset.name, asset.type, asset.description, asset.serialNumber,
      asset.model, asset.manufacturer, asset.purchaseDate, asset.warrantyExpiry,
      asset.monthlyCost, asset.annualCost, asset.status, asset.location,
      asset.assignedTo, asset.notes, asset.applicationType, asset.url, asset.version,
      asset.domainCost, asset.sslCost, asset.hostingCost, asset.serverCost,
      asset.domainExpiry, asset.sslExpiry, asset.hostingExpiry, asset.serverExpiry,
        assetCode]
    );
    return result.rows[0] as Asset;
  }


  async updateAsset(id: string, asset: Partial<InsertAsset>): Promise<Asset> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    Object.entries(asset).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE assets SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values
    );
    return result.rows[0] as Asset;
  }

  async deleteAsset(id: string, companyId: string): Promise<void> {
    await pool.query('DELETE FROM assets WHERE id = $1 AND company_id = $2', [id, companyId]);
  }

  async getContractsByCompany(companyId: string): Promise<Contract[]> {
    const result = await pool.query('SELECT * FROM contracts WHERE company_id = $1', [companyId]);
    return result.rows as Contract[];
  }

  async getContractById(id: string, companyId: string): Promise<Contract | undefined> {
    const result = await pool.query('SELECT * FROM contracts WHERE id = $1 AND company_id = $2', [id, companyId]);
    return result.rows[0] as Contract | undefined;
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const result = await pool.query(
      `INSERT INTO contracts (
        company_id, name, vendor, description, contract_type, start_date, end_date,
        renewal_date, monthly_cost, annual_cost, status, auto_renewal, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [contract.companyId, contract.name, contract.vendor, contract.description,
      contract.contractType, contract.startDate, contract.endDate, contract.renewalDate,
      contract.monthlyCost, contract.annualCost, contract.status, contract.autoRenewal, contract.notes]
    );
    return result.rows[0] as Contract;
  }

  async updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    Object.entries(contract).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE contracts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values
    );
    return result.rows[0] as Contract;
  }

  async deleteContract(id: string, companyId: string): Promise<void> {
    await pool.query('DELETE FROM contracts WHERE id = $1 AND company_id = $2', [id, companyId]);
  }

  async getLicensesByCompany(companyId: string): Promise<License[]> {
    const result = await pool.query('SELECT * FROM licenses WHERE company_id = $1', [companyId]);
    return result.rows as License[];
  }

  async getLicenseById(id: string, companyId: string): Promise<License | undefined> {
    const result = await pool.query('SELECT * FROM licenses WHERE id = $1 AND company_id = $2', [id, companyId]);
    return result.rows[0] as License | undefined;
  }

  async createLicense(license: InsertLicense): Promise<License> {
    const result = await pool.query(
      `INSERT INTO licenses (
        company_id, asset_id, name, vendor, license_key, license_type, max_users,
        current_users, purchase_date, expiry_date, monthly_cost, annual_cost, status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [license.companyId, license.assetId, license.name, license.vendor, license.licenseKey,
      license.licenseType, license.maxUsers, license.currentUsers, license.purchaseDate,
      license.expiryDate, license.monthlyCost, license.annualCost, license.status, license.notes]
    );
    return result.rows[0] as License;
  }

  async updateLicense(id: string, license: Partial<InsertLicense>): Promise<License> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    Object.entries(license).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE licenses SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values
    );
    return result.rows[0] as License;
  }

  async deleteLicense(id: string, companyId: string): Promise<void> {
    await pool.query('DELETE FROM licenses WHERE id = $1 AND company_id = $2', [id, companyId]);
  }

  async getMaintenanceRecordsByCompany(companyId: string): Promise<MaintenanceRecord[]> {
    const result = await pool.query(
      'SELECT * FROM maintenance_records WHERE company_id = $1 ORDER BY created_at DESC', [companyId]
    );
    return result.rows as MaintenanceRecord[];
  }

  async getMaintenanceRecordsByAsset(assetId: string, companyId: string): Promise<MaintenanceRecord[]> {
    const result = await pool.query(
      'SELECT * FROM maintenance_records WHERE asset_id = $1 AND company_id = $2 ORDER BY created_at DESC',
      [assetId, companyId]
    );
    return result.rows as MaintenanceRecord[];
  }

  async createMaintenanceRecord(record: InsertMaintenanceRecord): Promise<MaintenanceRecord> {
    const result = await pool.query(
      `INSERT INTO maintenance_records (
        asset_id, company_id, maintenance_type, title, description, vendor, cost,
        scheduled_date, completed_date, next_maintenance_date, status, priority,
        technician, parts_replaced, time_spent, notes, attachments
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [record.assetId, record.companyId, record.maintenanceType, record.title,
      record.description, record.vendor, record.cost, record.scheduledDate,
      record.completedDate, record.nextMaintenanceDate, record.status, record.priority,
      record.technician, record.partsReplaced, record.timeSpent, record.notes, record.attachments]
    );
    return result.rows[0] as MaintenanceRecord;
  }

  async updateMaintenanceRecord(id: string, record: Partial<InsertMaintenanceRecord>): Promise<MaintenanceRecord> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    Object.entries(record).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await pool.query(
      `UPDATE maintenance_records SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`, values
    );
    return result.rows[0] as MaintenanceRecord;
  }

  async getMaintenanceRecordById(id: string, companyId: string): Promise<MaintenanceRecord | undefined> {
    const result = await pool.query(
      'SELECT * FROM maintenance_records WHERE id = $1 AND company_id = $2', [id, companyId]
    );
    return result.rows[0] as MaintenanceRecord | undefined;
  }

  async deleteMaintenanceRecord(id: string, companyId: string): Promise<void> {
    const result = await pool.query(
      'DELETE FROM maintenance_records WHERE id = $1 AND company_id = $2', [id, companyId]
    );
    if (result.rowCount === 0) {
      throw new Error("No se pudo eliminar el registro - no existe o no pertenece a la empresa");
    }
  }

  // ==========================================================================
  // DASHBOARD ANALYTICS
  // ==========================================================================

  /**
   * Calcula el resumen de costos separando Hardware de Aplicaciones.
   * 
   * ── LÓGICA DE COSTOS ──────────────────────────────────────────────────────
   * Costo Real     → viene de monthly_cost  (lo que realmente se paga al mes)
   * Costo Contable → viene de annual_cost   (valor contable anual ingresado
   *                  manualmente, puede diferir del real por depreciación, etc.)
   * ─────────────────────────────────────────────────────────────────────────
   */
  async getCompanyCostSummary(companyId: string): Promise<{
    // Campos originales (se mantienen para no romper componentes existentes)
    monthlyTotal: number;
    annualTotal: number;
    licenseCosts: number;
    maintenanceCosts: number;
    hardwareCosts: number;
    applicationCosts: number;
    contractCosts: number;
    // ── Campos nuevos: separación contable vs real ──
    monthlyReal: number;       // = monthlyTotal (alias explícito)
    annualReal: number;        // = monthlyReal × 12
    monthlyAccounting: number; // = suma de annual_cost ÷ 12
    annualAccounting: number;  // = suma de annual_cost directa
  }> {
    const result = await pool.query(
      `SELECT 
        -- ── COSTO REAL (monthly_cost) ──────────────────────────────────────
        (SELECT COALESCE(SUM(monthly_cost), 0) FROM assets WHERE company_id = $1 AND type = 'physical') as hardware_monthly,
        (SELECT COALESCE(SUM(monthly_cost), 0) FROM assets WHERE company_id = $1 AND type = 'application') as application_monthly,
        (SELECT COALESCE(SUM(monthly_cost), 0) FROM licenses WHERE company_id = $1) as license_monthly,
        (SELECT COALESCE(SUM(monthly_cost), 0) FROM contracts WHERE company_id = $1) as contract_monthly,

        -- ── COSTO CONTABLE (annual_cost) ───────────────────────────────────
        (SELECT COALESCE(SUM(annual_cost), 0) FROM assets WHERE company_id = $1 AND type = 'physical') as hardware_annual,
        (SELECT COALESCE(SUM(annual_cost), 0) FROM assets WHERE company_id = $1 AND type = 'application') as application_annual,
        (SELECT COALESCE(SUM(annual_cost), 0) FROM licenses WHERE company_id = $1) as license_annual,
        (SELECT COALESCE(SUM(annual_cost), 0) FROM contracts WHERE company_id = $1) as contract_annual,

        -- ── MANTENIMIENTO (costo del mes actual) ──────────────────────────
        (SELECT COALESCE(SUM(cost), 0) FROM maintenance_records 
          WHERE company_id = $1
          AND EXTRACT(MONTH FROM scheduled_date) = EXTRACT(MONTH FROM NOW())
          AND EXTRACT(YEAR FROM scheduled_date) = EXTRACT(YEAR FROM NOW())
        ) as maintenance_total`,
      [companyId]
    );

    const row = result.rows[0] || {};

    // ── VALORES REALES (monthly_cost) ─────────────────────────────────────
    const hardwareMonthly = Number(row.hardware_monthly || 0);
    const applicationMonthly = Number(row.application_monthly || 0);
    const licenseMonthly = Number(row.license_monthly || 0);
    const contractMonthly = Number(row.contract_monthly || 0);
    const maintenanceMonthly = Number(row.maintenance_total || 0);

    // ── VALORES CONTABLES (annual_cost) ───────────────────────────────────
    const hardwareAnnual = Number(row.hardware_annual || 0);
    const applicationAnnual = Number(row.application_annual || 0);
    const licenseAnnual = Number(row.license_annual || 0);
    const contractAnnual = Number(row.contract_annual || 0);

    // ── COSTO MENSUAL REAL ────────────────────────────────────────────────
    // Suma de todos los monthly_cost registrados
    const monthlyTotal = hardwareMonthly + applicationMonthly + licenseMonthly + contractMonthly + maintenanceMonthly;

    // ── COSTO ANUAL REAL ──────────────────────────────────────────────────
    // Costo mensual real × 12 meses
    const annualTotal = monthlyTotal * 12;

    // ── COSTO ANUAL CONTABLE ──────────────────────────────────────────────
    // Suma directa de los annual_cost ingresados manualmente
    const annualAccounting = hardwareAnnual + applicationAnnual + licenseAnnual + contractAnnual;

    // ── COSTO MENSUAL CONTABLE ────────────────────────────────────────────
    // Costo anual contable ÷ 12 meses
    const monthlyAccounting = annualAccounting / 12;

    return {
      // --- Campos originales (no se eliminan para no romper nada) ----------
      monthlyTotal,                        // Costo mensual real total
      annualTotal,                         // Costo anual real (monthlyTotal × 12)
      licenseCosts: licenseMonthly,
      maintenanceCosts: maintenanceMonthly,
      hardwareCosts: hardwareMonthly,
      applicationCosts: applicationMonthly,
      contractCosts: contractMonthly,

      // --- Campos nuevos: separación contable vs real ----------------------
      monthlyReal: monthlyTotal,     // Alias explícito de monthlyTotal
      annualReal: annualTotal,      // Alias explícito de annualTotal
      monthlyAccounting,                   // annual_cost total ÷ 12
      annualAccounting,                    // Suma directa de annual_cost
    };
  }

  async getAssetCounts(companyId: string): Promise<{
    totalAssets: number;
    physicalAssets: number;
    applications: number;
    licenses: number;
    contracts: number;
  }> {
    const result = await pool.query(
      `SELECT 
        COUNT(CASE WHEN a.type = 'physical' THEN 1 END) as physical_count,
        COUNT(CASE WHEN a.type = 'application' THEN 1 END) as application_count,
        COUNT(a.id) as total_assets,
        (SELECT COUNT(*) FROM licenses WHERE company_id = $1) as license_count,
        (SELECT COUNT(*) FROM contracts WHERE company_id = $1) as contract_count
      FROM assets a
      WHERE a.company_id = $1`,
      [companyId]
    );
    const row = result.rows[0] || {};
    return {
      totalAssets: Number(row.total_assets || 0),
      physicalAssets: Number(row.physical_count || 0),
      applications: Number(row.application_count || 0),
      licenses: Number(row.license_count || 0),
      contracts: Number(row.contract_count || 0),
    };
  }

  async logActivity(activity: {
    companyId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    entityName?: string;
    details?: string;
  }): Promise<ActivityLog> {
    if (!activity.companyId) {
      throw new Error(`companyId es requerido para logActivity. Recibido: ${activity.companyId}`);
    }
    const result = await pool.query(
      `INSERT INTO activity_log (company_id, user_id, action, entity_type, entity_id, entity_name, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [activity.companyId, activity.userId, activity.action, activity.entityType,
      activity.entityId, activity.entityName, activity.details]
    );
    return result.rows[0] as ActivityLog;
  }

  async getRecentActivity(companyId: string, limit: number = 10): Promise<(ActivityLog & { user: User })[]> {
    const result = await pool.query(
      `SELECT 
        al.*,
        u.id as "user.id", u.email as "user.email",
        u.first_name as "user.first_name", u.last_name as "user.last_name",
        u.profile_image_url as "user.profile_image_url", u.role as "user.role",
        u.created_at as "user.created_at", u.updated_at as "user.updated_at"
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.company_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2`,
      [companyId, limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      companyId: row.company_id,
      userId: row.user_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityName: row.entity_name,
      details: row.details,
      createdAt: row.created_at,
      user: {
        id: row['user.id'],
        email: row['user.email'],
        passwordHash: '',
        firstName: row['user.first_name'],
        lastName: row['user.last_name'],
        profileImageUrl: row['user.profile_image_url'],
        role: row['user.role'],
        createdAt: row['user.created_at'],
        updatedAt: row['user.updated_at'],
      }
    }));
  }

  async getAllCompanies(): Promise<(Company & { userCount: number, assetCount: number })[]> {
    const result = await pool.query(
      `SELECT c.*, COUNT(DISTINCT uc.id) as user_count, COUNT(DISTINCT a.id) as asset_count
      FROM companies c
      LEFT JOIN user_companies uc ON c.id = uc.company_id
      LEFT JOIN assets a ON c.id = a.company_id
      GROUP BY c.id ORDER BY c.created_at DESC`
    );
    return result.rows.map(row => ({
      id: row.id, name: row.name, description: row.description, plan: row.plan,
      maxUsers: row.max_users, maxAssets: row.max_assets, isActive: row.is_active,
      ruc: row.ruc, cedula: row.cedula, address: row.address, phone: row.phone,
      email: row.email, createdAt: row.created_at, updatedAt: row.updated_at,
      userCount: Number(row.user_count || 0),
      assetCount: Number(row.asset_count || 0),
    }));
  }

  async updateCompanyPlan(companyId: string, plan: "pyme" | "professional", maxUsers?: number, maxAssets?: number): Promise<Company> {
    const finalMaxUsers = plan === "pyme" ? (maxUsers || 10) : 1;
    const finalMaxAssets = plan === "pyme" ? (maxAssets || 500) : 100;
    const result = await pool.query(
      `UPDATE companies SET plan = $1, max_users = $2, max_assets = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [plan, finalMaxUsers, finalMaxAssets, companyId]
    );
    return result.rows[0] as Company;
  }

  async toggleCompanyStatus(companyId: string, isActive: boolean): Promise<Company> {
    const result = await pool.query(
      `UPDATE companies SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [isActive, companyId]
    );
    return result.rows[0] as Company;
  }
}

export const storage = new DatabaseStorage();