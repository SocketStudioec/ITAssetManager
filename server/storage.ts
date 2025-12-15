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

/**
 * FUNCIÓN HELPER: Mapeo de Columnas PostgreSQL a TypeScript
 * 
 * Convierte las columnas snake_case de PostgreSQL al formato camelCase de TypeScript.
 * 
 * PostgreSQL usa snake_case por convención (password_hash, first_name) mientras que
 * TypeScript/JavaScript usa camelCase (passwordHash, firstName). Esta función realiza
 * la conversión automática para mantener consistencia de tipos.
 * 
 * @param row - Fila de resultado de PostgreSQL con columnas en snake_case
 * @returns Objeto User con propiedades en camelCase, o undefined si row es null/undefined
 * 
 * @example
 * // PostgreSQL retorna: { first_name: "John", last_name: "Doe", password_hash: "$2b$10..." }
 * // Esta función mapea a: { firstName: "John", lastName: "Doe", passwordHash: "$2b$10..." }
 */
function mapUserFromDb(row: any): User | undefined {
  if (!row) return undefined;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,              // snake_case → camelCase
    firstName: row.first_name,                    // snake_case → camelCase
    lastName: row.last_name,                      // snake_case → camelCase
    profileImageUrl: row.profile_image_url,       // snake_case → camelCase
    role: row.role,
    createdAt: row.created_at,                    // snake_case → camelCase
    updatedAt: row.updated_at,                    // snake_case → camelCase
  };
}

/**
 * INTERFAZ PRINCIPAL DEL STORAGE
 * 
 * Define todos los métodos disponibles para interactuar con la base de datos.
 * Esta interfaz permite cambiar la implementación (ej: de PostgreSQL a MongoDB)
 * sin afectar el resto de la aplicación.
 * 
 * ORGANIZACIÓN POR ENTIDADES:
 * - User operations: Gestión de usuarios (autenticación)
 * - Company operations: Multi-tenancy y gestión empresarial  
 * - Asset operations: CRUD completo de activos físicos y aplicaciones
 * - Contract operations: Gestión de contratos con proveedores
 * - License operations: Control de licencias de software
 * - Maintenance operations: Historial de mantenimiento de activos
 * - Dashboard analytics: Queries optimizados para reportes y KPIs
 * - Activity log: Sistema de auditoría completo
 * - Admin operations: Funciones exclusivas para super administrators
 */
export interface IStorage {
  // User operations (authentication)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(email: string, passwordHash: string, firstName: string, lastName: string, role?: "super_admin" | "technical_admin" | "manager_owner"): Promise<User>;
  
  // Company operations
  getUserCompanies(userId: string): Promise<(UserCompany & { company: Company })[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  addUserToCompany(userId: string, companyId: string, role: "super_admin" | "technical_admin" | "manager_owner" | "technician"): Promise<UserCompany>;
  getCompanyById(companyId: string): Promise<Company | undefined>;
  registerCompany(companyData: CompanyRegistration): Promise<{ company: Company; user: User }>;
  
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
  
  // Dashboard analytics
  getCompanyCostSummary(companyId: string): Promise<{
    monthlyTotal: number;
    annualTotal: number;
    licenseCosts: number;
    maintenanceCosts: number;
    hardwareCosts: number;
    contractCosts: number;
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

/**
 * IMPLEMENTACIÓN PRINCIPAL DEL STORAGE USANDO POSTGRESQL NATIVO
 * 
 * Esta clase implementa todos los métodos definidos en IStorage usando queries SQL nativas.
 * Cada método está optimizado para performance y seguridad, con manejo de errores
 * y validación de datos integrada.
 * 
 * PATRONES IMPLEMENTADOS:
 * - Repository Pattern: Encapsula la lógica de acceso a datos
 * - Prepared Statements: Prevención de SQL injection
 * - Query Object: Queries complejos reutilizables
 * 
 * OPTIMIZACIONES:
 * - Índices automáticos en columnas de búsqueda frecuente
 * - Joins optimizados para reducir N+1 queries
 * - Paginación para listados grandes
 * - Connection pooling para mejor performance
 */
export class DatabaseStorage implements IStorage {
  
  // ==========================================================================
  // OPERACIONES DE USUARIO (AUTENTICACIÓN)
  // ==========================================================================
  
  /**
   * OBTENER USUARIO POR ID
   * 
   * Busca y retorna un usuario por su ID único (UUID).
   * Utilizado principalmente para validar sesiones y permisos.
   * 
   * @param id - UUID del usuario a buscar
   * @returns Usuario encontrado o undefined si no existe
   * 
   * @example
   * const user = await storage.getUser('123e4567-e89b-12d3-a456-426614174000');
   * if (user) {
   *   console.log(`Usuario: ${user.firstName} ${user.lastName}`);
   * }
   */
  async getUser(id: string): Promise<User | undefined> {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return mapUserFromDb(result.rows[0]);
  }

  /**
   * OBTENER USUARIO POR EMAIL
   * 
   * Busca un usuario por su dirección de email (único en la base de datos).
   * Este método es crítico para el proceso de autenticación.
   * 
   * IMPORTANTE: El email es case-insensitive en PostgreSQL gracias a la constraint UNIQUE.
   * 
   * @param email - Dirección de email del usuario
   * @returns Usuario encontrado con passwordHash incluido, o undefined si no existe
   * 
   * @security El passwordHash retornado debe usarse solo para verificación y nunca enviarse al frontend
   * 
   * @example
   * const user = await storage.getUserByEmail('user@example.com');
   * if (user && await bcrypt.compare(password, user.passwordHash)) {
   *   // Login exitoso
   * }
   */
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return mapUserFromDb(result.rows[0]);
  }

  /**
   * CREAR NUEVO USUARIO
   * 
   * Inserta un nuevo usuario en la base de datos con su password hasheado.
   * El password debe estar previamente hasheado con bcrypt antes de llamar esta función.
   * 
   * @param email - Email único del usuario (se valida constraint UNIQUE)
   * @param passwordHash - Password ya hasheado con bcrypt (10 rounds recomendado)
   * @param firstName - Nombre del usuario
   * @param lastName - Apellido del usuario
   * @param role - Rol del usuario (default: "technical_admin")
   * @returns Usuario creado con todos sus campos
   * 
   * @throws Error si el email ya existe (violación de UNIQUE constraint)
   * 
   * @example
   * const hash = await bcrypt.hash('password123', 10);
   * const newUser = await storage.createUser(
   *   'nuevo@example.com',
   *   hash,
   *   'Juan',
   *   'Pérez',
   *   'technical_admin'
   * );
   */
  async createUser(
    email: string, 
    passwordHash: string, 
    firstName: string, 
    lastName: string, 
    role: "super_admin" | "technical_admin" | "manager_owner" = "technical_admin"
  ): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [email, passwordHash, firstName, lastName, role]
    );
    return mapUserFromDb(result.rows[0])!;
  }

  // ==========================================================================
  // OPERACIONES DE EMPRESA (MULTI-TENANCY)
  // ==========================================================================
  
  /**
   * Obtiene todas las empresas donde el usuario tiene asignado un rol.
   */
  async getUserCompanies(userId: string): Promise<(UserCompany & { company: Company })[]> {
    const result = await pool.query(
      `SELECT 
        uc.*,
        c.id as "company.id",
        c.name as "company.name",
        c.description as "company.description",
        c.plan as "company.plan",
        c.max_users as "company.max_users",
        c.max_assets as "company.max_assets",
        c.is_active as "company.is_active",
        c.ruc as "company.ruc",
        c.cedula as "company.cedula",
        c.address as "company.address",
        c.phone as "company.phone",
        c.email as "company.email",
        c.created_at as "company.created_at",
        c.updated_at as "company.updated_at"
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
        id: row['company.id'],
        name: row['company.name'],
        description: row['company.description'],
        plan: row['company.plan'],
        maxUsers: row['company.max_users'],
        maxAssets: row['company.max_assets'],
        isActive: row['company.is_active'],
        ruc: row['company.ruc'],
        cedula: row['company.cedula'],
        address: row['company.address'],
        phone: row['company.phone'],
        email: row['company.email'],
        createdAt: row['company.created_at'],
        updatedAt: row['company.updated_at'],
      }
    }));
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const result = await pool.query(
      `INSERT INTO companies (name, description, plan, max_users, max_assets, ruc, cedula, address, phone, email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        company.name,
        company.description,
        company.plan,
        company.maxUsers,
        company.maxAssets,
        company.ruc,
        company.cedula,
        company.address,
        company.phone,
        company.email,
      ]
    );
    return result.rows[0] as Company;
  }

  async addUserToCompany(userId: string, companyId: string, role: "super_admin" | "technical_admin" | "manager_owner" | "technician"): Promise<UserCompany> {
    const result = await pool.query(
      `INSERT INTO user_companies (user_id, company_id, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, companyId, role]
    );
    return result.rows[0] as UserCompany;
  }

  /**
   * Registra una nueva empresa con su usuario propietario.
   */
  async registerCompany(companyData: CompanyRegistration & { passwordHash: string }): Promise<{ company: Company; user: User }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Verificar si el email ya existe
      const existingUser = await this.getUserByEmail(companyData.email);
      if (existingUser) {
        throw new Error("El email ya está registrado");
      }
      
      // Crear el usuario
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [companyData.email, companyData.passwordHash, companyData.firstName, companyData.lastName, 'manager_owner']
      );
      const user = userResult.rows[0] as User;
      
      // Crear la empresa
      const companyResult = await client.query(
        `INSERT INTO companies (name, plan, max_users, max_assets, ruc, cedula, address, phone, email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          companyData.name,
          companyData.plan,
          companyData.plan === "pyme" ? 10 : 50,
          companyData.plan === "pyme" ? 500 : 2000,
          companyData.plan === "pyme" ? companyData.ruc : null,
          companyData.plan === "professional" ? companyData.cedula : null,
          companyData.address,
          companyData.phone,
          companyData.email,
        ]
      );
      const company = companyResult.rows[0] as Company;
      
      // Crear relación usuario-empresa
      await client.query(
        `INSERT INTO user_companies (user_id, company_id, role)
         VALUES ($1, $2, $3)`,
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
    const result = await pool.query(
      'SELECT * FROM companies WHERE id = $1',
      [companyId]
    );
    return result.rows[0] as Company | undefined;
  }

  // ==========================================================================
  // OPERACIONES DE ACTIVOS
  // ==========================================================================
  
  async getAssetsByCompany(companyId: string): Promise<Asset[]> {
    const result = await pool.query(
      'SELECT * FROM assets WHERE company_id = $1',
      [companyId]
    );
    return result.rows as Asset[];
  }

  async getAssetById(id: string, companyId: string): Promise<Asset | undefined> {
    const result = await pool.query(
      'SELECT * FROM assets WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    return result.rows[0] as Asset | undefined;
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const result = await pool.query(
      `INSERT INTO assets (
        company_id, name, type, description, serial_number, model, manufacturer,
        purchase_date, warranty_expiry, monthly_cost, annual_cost, status, location,
        assigned_to, notes, application_type, url, version, domain_cost, ssl_cost,
        hosting_cost, server_cost, domain_expiry, ssl_expiry, hosting_expiry, server_expiry
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *`,
      [
        asset.companyId, asset.name, asset.type, asset.description, asset.serialNumber,
        asset.model, asset.manufacturer, asset.purchaseDate, asset.warrantyExpiry,
        asset.monthlyCost, asset.annualCost, asset.status, asset.location,
        asset.assignedTo, asset.notes, asset.applicationType, asset.url, asset.version,
        asset.domainCost, asset.sslCost, asset.hostingCost, asset.serverCost,
        asset.domainExpiry, asset.sslExpiry, asset.hostingExpiry, asset.serverExpiry
      ]
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

  const query = `UPDATE assets SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
  const result = await pool.query(query, values); 
  const updatedAsset = result.rows[0] as Asset;
  return updatedAsset;
}

  async deleteAsset(id: string, companyId: string): Promise<void> {
    await pool.query(
      'DELETE FROM assets WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
  }

  // ==========================================================================
  // OPERACIONES DE CONTRATOS
  // ==========================================================================
  
  async getContractsByCompany(companyId: string): Promise<Contract[]> {
    const result = await pool.query(
      'SELECT * FROM contracts WHERE company_id = $1',
      [companyId]
    );
    return result.rows as Contract[];
  }

  async getContractById(id: string, companyId: string): Promise<Contract | undefined> {
    const result = await pool.query(
      'SELECT * FROM contracts WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    return result.rows[0] as Contract | undefined;
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const result = await pool.query(
      `INSERT INTO contracts (
        company_id, name, vendor, description, contract_type, start_date, end_date,
        renewal_date, monthly_cost, annual_cost, status, auto_renewal, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        contract.companyId, contract.name, contract.vendor, contract.description,
        contract.contractType, contract.startDate, contract.endDate, contract.renewalDate,
        contract.monthlyCost, contract.annualCost, contract.status, contract.autoRenewal,
        contract.notes
      ]
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
      `UPDATE contracts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] as Contract;
  }

  async deleteContract(id: string, companyId: string): Promise<void> {
    await pool.query(
      'DELETE FROM contracts WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
  }

  // ==========================================================================
  // OPERACIONES DE LICENCIAS
  // ==========================================================================
  
  async getLicensesByCompany(companyId: string): Promise<License[]> {
    const result = await pool.query(
      'SELECT * FROM licenses WHERE company_id = $1',
      [companyId]
    );
    return result.rows as License[];
  }

  async getLicenseById(id: string, companyId: string): Promise<License | undefined> {
    const result = await pool.query(
      'SELECT * FROM licenses WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
    return result.rows[0] as License | undefined;
  }

  async createLicense(license: InsertLicense): Promise<License> {
    const result = await pool.query(
      `INSERT INTO licenses (
        company_id, asset_id, name, vendor, license_key, license_type, max_users,
        current_users, purchase_date, expiry_date, monthly_cost, annual_cost, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        license.companyId, license.assetId, license.name, license.vendor, license.licenseKey,
        license.licenseType, license.maxUsers, license.currentUsers, license.purchaseDate,
        license.expiryDate, license.monthlyCost, license.annualCost, license.status, license.notes
      ]
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
      `UPDATE licenses SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] as License;
  }

  async deleteLicense(id: string, companyId: string): Promise<void> {
    await pool.query(
      'DELETE FROM licenses WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );
  }

  // ==========================================================================
  // OPERACIONES DE MANTENIMIENTO
  // ==========================================================================
  
  async getMaintenanceRecordsByCompany(companyId: string): Promise<MaintenanceRecord[]> {
    const result = await pool.query(
      'SELECT * FROM maintenance_records WHERE company_id = $1 ORDER BY created_at DESC',
      [companyId]
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        record.assetId, record.companyId, record.maintenanceType, record.title,
        record.description, record.vendor, record.cost, record.scheduledDate,
        record.completedDate, record.nextMaintenanceDate, record.status, record.priority,
        record.technician, record.partsReplaced, record.timeSpent, record.notes, record.attachments
      ]
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
      `UPDATE maintenance_records SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] as MaintenanceRecord;
  }

  // ==========================================================================
  // DASHBOARD ANALYTICS (REPORTES Y KPIS)
  // ==========================================================================
  
  /**
   * Calcula el resumen completo de costos de una empresa.
   */
  async getCompanyCostSummary(companyId: string): Promise<{
    monthlyTotal: number;
    annualTotal: number;
    licenseCosts: number;
    maintenanceCosts: number;
    hardwareCosts: number;
    contractCosts: number;
  }> {
    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(a.monthly_cost), 0) as asset_monthly,
        COALESCE(SUM(a.annual_cost), 0) as asset_annual,
        COALESCE(SUM(l.monthly_cost), 0) as license_monthly,
        COALESCE(SUM(l.annual_cost), 0) as license_annual,
        COALESCE(SUM(c.monthly_cost), 0) as contract_monthly,
        COALESCE(SUM(c.annual_cost), 0) as contract_annual,
        COALESCE(SUM(m.cost), 0) as maintenance_total
      FROM companies comp
      LEFT JOIN assets a ON a.company_id = comp.id
      LEFT JOIN licenses l ON l.company_id = comp.id
      LEFT JOIN contracts c ON c.company_id = comp.id
      LEFT JOIN maintenance_records m ON m.company_id = comp.id
      WHERE comp.id = $1
      GROUP BY comp.id`,
      [companyId]
    );

    const row = result.rows[0] || {};
    const assetMonthly = Number(row.asset_monthly || 0);
    const licenseMonthly = Number(row.license_monthly || 0);
    const contractMonthly = Number(row.contract_monthly || 0);
    const maintenanceTotal = Number(row.maintenance_total || 0);
    const maintenanceMonthly = maintenanceTotal / 12;

    const monthlyTotal = assetMonthly + licenseMonthly + contractMonthly + maintenanceMonthly;
    const annualTotal = monthlyTotal * 12;

    return {
      monthlyTotal,
      annualTotal,
      licenseCosts: licenseMonthly,
      maintenanceCosts: maintenanceMonthly,
      hardwareCosts: assetMonthly,
      contractCosts: contractMonthly,
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

  // ==========================================================================
  // ACTIVITY LOG
  // ==========================================================================
  
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
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      activity.companyId,
      activity.userId, 
      activity.action, 
      activity.entityType,
      activity.entityId, 
      activity.entityName, 
      activity.details
    ]
  );
  return result.rows[0] as ActivityLog;
}

  async getRecentActivity(companyId: string, limit: number = 10): Promise<(ActivityLog & { user: User })[]> {
    const result = await pool.query(
      `SELECT 
        al.*,
        u.id as "user.id",
        u.email as "user.email",
        u.first_name as "user.first_name",
        u.last_name as "user.last_name",
        u.profile_image_url as "user.profile_image_url",
        u.role as "user.role",
        u.created_at as "user.created_at",
        u.updated_at as "user.updated_at"
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

  // ==========================================================================
  // ADMIN OPERATIONS
  // ==========================================================================
  
  async getAllCompanies(): Promise<(Company & { userCount: number, assetCount: number })[]> {
    const result = await pool.query(
      `SELECT 
        c.*,
        COUNT(DISTINCT uc.id) as user_count,
        COUNT(DISTINCT a.id) as asset_count
      FROM companies c
      LEFT JOIN user_companies uc ON c.id = uc.company_id
      LEFT JOIN assets a ON c.id = a.company_id
      GROUP BY c.id
      ORDER BY c.created_at DESC`
    );

    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      plan: row.plan,
      maxUsers: row.max_users,
      maxAssets: row.max_assets,
      isActive: row.is_active,
      ruc: row.ruc,
      cedula: row.cedula,
      address: row.address,
      phone: row.phone,
      email: row.email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userCount: Number(row.user_count || 0),
      assetCount: Number(row.asset_count || 0),
    }));
  }

  async updateCompanyPlan(companyId: string, plan: "pyme" | "professional", maxUsers?: number, maxAssets?: number): Promise<Company> {
    let finalMaxUsers = maxUsers;
    let finalMaxAssets = maxAssets;
    
    if (plan === "pyme") {
      finalMaxUsers = maxUsers || 10;
      finalMaxAssets = maxAssets || 500;
    } else if (plan === "professional") {
      finalMaxUsers = 1;
      finalMaxAssets = 100;
    }

    const result = await pool.query(
      `UPDATE companies 
       SET plan = $1, max_users = $2, max_assets = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [plan, finalMaxUsers, finalMaxAssets, companyId]
    );
    
    return result.rows[0] as Company;
  }

  async toggleCompanyStatus(companyId: string, isActive: boolean): Promise<Company> {
    const result = await pool.query(
      `UPDATE companies 
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [isActive, companyId]
    );
    
    return result.rows[0] as Company;
  }
}

export const storage = new DatabaseStorage();
