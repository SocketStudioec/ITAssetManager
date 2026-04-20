/**
 * ============================================================================
 * ARCHIVO PRINCIPAL DE RUTAS DEL BACKEND (API REST)
 * ============================================================================
 */

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, passwordUtils, jwtUtils, setJwtCookie, clearJwtCookie } from "./auth";
import {
  insertAssetSchema,
  insertContractSchema,
  insertLicenseSchema,
  insertMaintenanceRecordSchema,
  insertCompanySchema,
  companyRegistrationSchema,
  loginSchema,
} from "@shared/schema";
import { z } from "zod";
import { pool } from "./db";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // =============================================================================
  // RUTAS PÚBLICAS
  // =============================================================================

  app.post('/api/register', async (req: any, res) => {
    try {
      const registrationData = companyRegistrationSchema.parse(req.body);
      const passwordHash = await passwordUtils.hash(registrationData.password);
      const result = await storage.registerCompany({ ...registrationData, passwordHash });
      const token = jwtUtils.generateToken({
        id: result.user.id, email: result.user.email,
        firstName: result.user.firstName, lastName: result.user.lastName, role: result.user.role,
      });
      setJwtCookie(res, token);
      res.json({
        message: "Empresa registrada exitosamente",
        company: result.company,
        user: { id: result.user.id, email: result.user.email, firstName: result.user.firstName, lastName: result.user.lastName, role: result.user.role },
      });
    } catch (error: any) {
      console.error("Error registering company:", error);
      if (res.headersSent) return;
      if (error.message === "El email ya está registrado") {
        res.status(400).json({ message: error.message });
      } else if (error.code === '23505') {
        res.status(400).json({ message: "Ya existe una empresa con este RUC/Cédula o email" });
      } else {
        res.status(500).json({ message: "Error al registrar empresa" });
      }
    }
  });

  app.post('/api/login', async (req: any, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "Email o contraseña incorrectos" });
      const isValidPassword = await passwordUtils.verify(password, user.passwordHash);
      if (!isValidPassword) return res.status(401).json({ message: "Email o contraseña incorrectos" });
      const token = jwtUtils.generateToken({
        id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role,
      });
      setJwtCookie(res, token);
      res.json({
        message: "Login exitoso",
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      });
    } catch (error: any) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Error al iniciar sesión" });
    }
  });

  app.post('/api/logout', (req: any, res) => {
    clearJwtCookie(res);
    res.json({ message: "Sesión cerrada exitosamente" });
  });

  // =============================================================================
  // RUTAS DE AUTENTICACIÓN
  // =============================================================================

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get('/api/me', isAuthenticated, async (req: any, res) => {
    try {
      res.json({ userId: req.user.userId });
    } catch (error) {
      console.error("Error fetching current user ID:", error);
      res.status(500).json({ message: "Error interno del servidor al obtener ID de usuario" });
    }
  });

  // =============================================================================
  // RUTAS DE EMPRESAS
  // =============================================================================

  app.get('/api/companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const userCompanies = await storage.getUserCompanies(userId);
      res.json(userCompanies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.post('/api/companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      await storage.addUserToCompany(userId, company.id, "manager_owner");
      await storage.logActivity({ companyId: company.id, userId, action: "created", entityType: "company", entityId: company.id, entityName: company.name });
      res.json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(400).json({ message: "Failed to create company" });
    }
  });

  app.put('/api/companies/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const validatedData = insertCompanySchema.partial().parse(req.body);
      const updatedCompany = await storage.updateCompany(id, validatedData);
      await storage.logActivity({ companyId: id, userId, action: "updated", entityType: "company", entityId: id, entityName: updatedCompany.name });
      res.json(updatedCompany);
    } catch (error) {
      console.error("Error al actualizar la empresa:", error);
      res.status(400).json({ message: "Error al actualizar los datos de la empresa" });
    }
  });

  // =============================================================================
  // RUTAS DE DASHBOARD
  // =============================================================================

  app.get('/api/dashboard/:companyId/summary', isAuthenticated, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const costSummary = await storage.getCompanyCostSummary(companyId);
      const assetCounts = await storage.getAssetCounts(companyId);
      res.json({ costs: costSummary, assets: assetCounts });
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      res.status(500).json({ message: "Failed to fetch dashboard summary" });
    }
  });

  app.get('/api/dashboard/:companyId/activity', isAuthenticated, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const activity = await storage.getRecentActivity(companyId, limit);
      res.json(activity);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  // =============================================================================
  // RUTAS DE ACTIVOS
  // =============================================================================

  app.get('/api/assets/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const assets = await storage.getAssetsByCompany(companyId);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching assets:", error);
      res.status(500).json({ message: "Failed to fetch assets" });
    }
  });

  app.post('/api/assets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const companyIdToUse = req.body.companyId;
      if (!companyIdToUse) return res.status(400).json({ message: "companyId es requerido en el cuerpo de la solicitud." });
      const dataToValidate = { ...req.body, companyId: companyIdToUse };
      const validatedData = insertAssetSchema.parse(dataToValidate);
      const dataToInsert = { ...validatedData, assignedTo: userId };
      const asset = await storage.createAsset(dataToInsert);
      await storage.logActivity({ companyId: companyIdToUse, userId, action: "created", entityType: "asset", entityId: asset.id, entityName: asset.name });
      res.json(asset);
    } catch (error) {
      console.error("Error creating asset:", error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Error de validación en los datos del activo", errors: error.errors });
      res.status(500).json({ message: "Error al crear el activo" });
    }
  });

  app.put('/api/assets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      if (!req.body.companyId) return res.status(400).json({ message: "companyId es requerido para actualizar el activo" });
      const companyId = req.body.companyId;
      const dataToValidate = {
        ...req.body,
        serialNumber: req.body.serial_number, monthlyCost: req.body.monthly_cost, annualCost: req.body.annual_cost,
        assignedTo: req.body.assigned_to, applicationType: req.body.application_type, domainCost: req.body.domain_cost,
        sslCost: req.body.ssl_cost, hostingCost: req.body.hosting_cost, serverCost: req.body.server_cost,
        domainExpiry: req.body.domain_expiry, sslExpiry: req.body.ssl_expiry, hostingExpiry: req.body.hosting_expiry, serverExpiry: req.body.server_expiry,
      };
      const updateAssetSchema = insertAssetSchema.partial().extend({ companyId: z.string().min(1) });
      const validatedData = updateAssetSchema.parse(dataToValidate);
      const existingAsset = await storage.getAssetById(id, companyId);
      if (!existingAsset) return res.status(404).json({ message: "Activo no encontrado" });
      const dataForDb = {
        company_id: validatedData.companyId, name: validatedData.name, type: validatedData.type,
        description: validatedData.description, serial_number: validatedData.serialNumber, model: validatedData.model,
        manufacturer: validatedData.manufacturer, purchase_date: validatedData.purchaseDate, warranty_expiry: validatedData.warrantyExpiry,
        monthly_cost: validatedData.monthlyCost, annual_cost: validatedData.annualCost, status: validatedData.status,
        location: validatedData.location, assigned_to: validatedData.assignedTo, notes: validatedData.notes,
        application_type: validatedData.applicationType, url: validatedData.url, version: validatedData.version,
        domain_cost: validatedData.domainCost, ssl_cost: validatedData.sslCost, hosting_cost: validatedData.hostingCost,
        server_cost: validatedData.serverCost, domain_expiry: validatedData.domainExpiry, ssl_expiry: validatedData.sslExpiry,
        hosting_expiry: validatedData.hostingExpiry, server_expiry: validatedData.serverExpiry,
      };
      const asset = await storage.updateAsset(id, dataForDb);
      await storage.logActivity({ companyId, userId, action: "updated", entityType: "asset", entityId: asset.id, entityName: asset.name });
      res.json(asset);
    } catch (error) {
      console.error("Error actualizando activo:", error);
      if (error instanceof z.ZodError) return res.status(400).json({ message: "Error de validación en los datos", errors: error.errors });
      res.status(400).json({ message: "Error al actualizar el activo", error: error instanceof Error ? error.message : "Error desconocido" });
    }
  });

  app.delete('/api/assets/:id/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { id, companyId } = req.params;
      const userId = req.user.userId;
      const asset = await storage.getAssetById(id, companyId);
      if (!asset) return res.status(404).json({ message: "Asset not found" });
      await storage.deleteAsset(id, companyId);
      await storage.logActivity({ companyId, userId, action: "deleted", entityType: "asset", entityId: id, entityName: asset.name });
      res.json({ message: "Asset deleted successfully" });
    } catch (error) {
      console.error("Error deleting asset:", error);
      res.status(500).json({ message: "Failed to delete asset" });
    }
  });

  // =============================================================================
  // RUTAS DE CONTRATOS
  // =============================================================================

  app.get('/api/contracts/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const contracts = await storage.getContractsByCompany(companyId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.post('/api/contracts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const validatedData = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(validatedData);
      await storage.logActivity({ companyId: validatedData.companyId, userId, action: "created", entityType: "contract", entityId: contract.id, entityName: contract.name });
      res.json(contract);
    } catch (error) {
      console.error("Error creating contract:", error);
      res.status(400).json({ message: "Failed to create contract" });
    }
  });

  app.put('/api/contracts/:id/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { id, companyId } = req.params;
      const userId = req.user.userId;
      const existingContract = await storage.getContractById(id, companyId);
      if (!existingContract) return res.status(404).json({ message: "Contrato no encontrado" });
      const validatedData = insertContractSchema.partial().parse(req.body);
      const contract = await storage.updateContract(id, validatedData);
      await storage.logActivity({ companyId, userId, action: "updated", entityType: "contract", entityId: id, entityName: contract.name });
      res.json(contract);
    } catch (error) {
      console.error("Error updating contract:", error);
      res.status(500).json({ message: "Failed to update contract" });
    }
  });

  app.delete('/api/contracts/:id/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { id, companyId } = req.params;
      const userId = req.user.userId;
      const contract = await storage.getContractById(id, companyId);
      if (!contract) return res.status(404).json({ message: "Contrato no encontrado" });
      await storage.deleteContract(id, companyId);
      await storage.logActivity({ companyId, userId, action: "deleted", entityType: "contract", entityId: id, entityName: contract.name });
      res.json({ message: "Contrato eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting contract:", error);
      res.status(500).json({ message: "Failed to delete contract" });
    }
  });

  // =============================================================================
  // RUTAS DE LICENCIAS
  // =============================================================================

  app.put('/api/licenses/:id/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { id, companyId } = req.params;
      const userId = req.user.userId;
      const existingLicense = await storage.getLicenseById(id, companyId);
      if (!existingLicense) return res.status(404).json({ message: "Licencia no encontrada" });
      const validatedData = insertLicenseSchema.partial().parse(req.body);
      const license = await storage.updateLicense(id, validatedData);
      await storage.logActivity({ companyId, userId, action: "updated", entityType: "license", entityId: id, entityName: license.name });
      res.json(license);
    } catch (error) {
      console.error("Error updating license:", error);
      res.status(500).json({ message: "Failed to update license" });
    }
  });

  app.delete('/api/licenses/:id/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { id, companyId } = req.params;
      const userId = req.user.userId;
      const license = await storage.getLicenseById(id, companyId);
      if (!license) return res.status(404).json({ message: "Licencia no encontrada" });
      await storage.deleteLicense(id, companyId);
      await storage.logActivity({ companyId, userId, action: "deleted", entityType: "license", entityId: id, entityName: license.name });
      res.json({ message: "Licencia eliminada exitosamente" });
    } catch (error) {
      console.error("Error deleting license:", error);
      res.status(500).json({ message: "Failed to delete license" });
    }
  });

  app.get('/api/licenses/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const licenses = await storage.getLicensesByCompany(companyId);
      res.json(licenses);
    } catch (error) {
      console.error("Error fetching licenses:", error);
      res.status(500).json({ message: "Failed to fetch licenses" });
    }
  });

  app.post('/api/licenses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const validatedData = insertLicenseSchema.parse(req.body);
      const license = await storage.createLicense(validatedData);
      await storage.logActivity({ companyId: validatedData.companyId, userId, action: "created", entityType: "license", entityId: license.id, entityName: license.name });
      res.json(license);
    } catch (error) {
      console.error("Error creating license:", error);
      res.status(400).json({ message: "Failed to create license" });
    }
  });

  // =============================================================================
  // RUTAS DE MANTENIMIENTO
  // =============================================================================

  app.get('/api/maintenance/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const records = await storage.getMaintenanceRecordsByCompany(companyId);
      res.json(records);
    } catch (error) {
      console.error("Error fetching maintenance records:", error);
      res.status(500).json({ message: "Failed to fetch maintenance records" });
    }
  });

  app.get('/api/maintenance/asset/:assetId/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { assetId, companyId } = req.params;
      const records = await storage.getMaintenanceRecordsByAsset(assetId, companyId);
      res.json(records);
    } catch (error) {
      console.error("Error fetching asset maintenance records:", error);
      res.status(500).json({ message: "Failed to fetch asset maintenance records" });
    }
  });

  app.post('/api/maintenance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const validatedData = insertMaintenanceRecordSchema.parse(req.body);
      const record = await storage.createMaintenanceRecord(validatedData);
      // Si el mantenimiento está en progreso, cambiar el activo a "maintenance"
      if (validatedData.status === "in_progress") {
        await storage.updateAsset(validatedData.assetId, { status: "maintenance" });
      }
      await storage.logActivity({ companyId: validatedData.companyId, userId, action: "created", entityType: "maintenance_record", entityId: record.id, entityName: `Maintenance for ${record.description}` });
      res.json(record);
    } catch (error) {
      console.error("Error creating maintenance record:", error);
      res.status(400).json({ message: "Failed to create maintenance record" });
    }
  });

  app.put('/api/maintenance/:id/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { id, companyId } = req.params;
      const userId = req.user.userId;
      const existingRecord = await storage.getMaintenanceRecordById(id, companyId);
      if (!existingRecord) return res.status(404).json({ message: "Registro de mantenimiento no encontrado" });
      const updateData: any = {};
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.priority !== undefined) updateData.priority = req.body.priority;
      if (req.body.vendor !== undefined) updateData.vendor = req.body.vendor;
      if (req.body.technician !== undefined) updateData.technician = req.body.technician;
      if (req.body.cost !== undefined) updateData.cost = req.body.cost;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      if (req.body.maintenanceType !== undefined) updateData.maintenanceType = req.body.maintenanceType;
      if (req.body.timeSpent !== undefined) updateData.timeSpent = req.body.timeSpent;
      if (req.body.scheduledDate !== undefined) updateData.scheduledDate = req.body.scheduledDate;
      if (req.body.completedDate !== undefined) updateData.completedDate = req.body.completedDate;
      if (req.body.nextMaintenanceDate !== undefined) updateData.nextMaintenanceDate = req.body.nextMaintenanceDate;
      if (req.body.partsReplaced !== undefined) updateData.partsReplaced = req.body.partsReplaced;
      const updatedRecord = await storage.updateMaintenanceRecord(id, updateData);
      // Si el mantenimiento se completó o canceló, volver el activo a "active"
      if (req.body.status === "completed" || req.body.status === "cancelled") {
        const assetId = (existingRecord as any).asset_id || (existingRecord as any).assetId;
        if (assetId) await storage.updateAsset(assetId, { status: "active" } as any);
      }
      await storage.logActivity({ companyId, userId, action: "updated", entityType: "maintenance_record", entityId: id, entityName: `Maintenance: ${updatedRecord.title || updatedRecord.description}` });
      res.json(updatedRecord);
    } catch (error) {
      res.status(500).json({ message: "Failed to update maintenance record", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.delete('/api/maintenance/:id/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { id, companyId } = req.params;
      const userId = req.user.userId;
      const existingRecord = await storage.getMaintenanceRecordById(id, companyId);
      if (!existingRecord) return res.status(404).json({ message: "Registro de mantenimiento no encontrado" });
      await storage.deleteMaintenanceRecord(id, companyId);
      storage.logActivity({ companyId, userId, action: "deleted", entityType: "maintenance_record", entityId: id, entityName: `Maintenance: ${existingRecord.description}` }).catch(err => console.error('Error logging activity:', err));
      return res.json({ message: "Registro de mantenimiento eliminado exitosamente", deleted: true, id });
    } catch (error) {
      console.error('Error deleting maintenance record:', error);
      return res.status(500).json({ message: "Error al eliminar el registro de mantenimiento", error: error instanceof Error ? error.message : "Error desconocido" });
    }
  });

  app.all('/api/maintenance/*', (req: any, res) => {
    res.status(404).json({ message: "Ruta de mantenimiento no encontrada" });
  });

  // =============================================================================
  // RUTAS DE ADMIN (solo super_admin)
  // =============================================================================

  app.get('/api/admin/companies', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') return res.status(403).json({ message: "Access denied. Super admin required." });
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // GET - Obtener todos los usuarios del sistema (solo super_admin)
  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') return res.status(403).json({ message: "Access denied. Super admin required." });
      // Consulta todos los usuarios sin exponer el password hash
      const result = await pool.query(
        'SELECT id, email, first_name, last_name, role, created_at FROM users ORDER BY created_at DESC'
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put('/api/admin/companies/:companyId/plan', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') return res.status(403).json({ message: "Access denied. Super admin required." });
      const { companyId } = req.params;
      const { plan, maxUsers, maxAssets } = req.body;
      if (!['pyme', 'professional'].includes(plan)) return res.status(400).json({ message: "Invalid plan type" });
      const updatedCompany = await storage.updateCompanyPlan(companyId, plan, maxUsers, maxAssets);
      res.json(updatedCompany);
    } catch (error) {
      console.error("Error updating company plan:", error);
      res.status(500).json({ message: "Failed to update company plan" });
    }
  });

  app.put('/api/admin/companies/:companyId/status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') return res.status(403).json({ message: "Access denied. Super admin required." });
      const { companyId } = req.params;
      const { isActive } = req.body;
      const updatedCompany = await storage.toggleCompanyStatus(companyId, isActive);
      res.json(updatedCompany);
    } catch (error) {
      console.error("Error updating company status:", error);
      res.status(500).json({ message: "Failed to update company status" });
    }
  });

  app.post('/api/admin/support-access/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') return res.status(403).json({ message: "Access denied. Super admin required." });
      const { companyId } = req.params;
      const company = await storage.getCompanyById(companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const supportModeData = { companyId, adminId: user.id, startTime: new Date().toISOString() };
      const newPayload = { ...req.user, supportMode: supportModeData };
      const newToken = jwtUtils.generateToken(newPayload);
      setJwtCookie(res, newToken);
      await storage.logActivity({ companyId, userId: user.id, action: "accessed", entityType: "company", entityId: companyId, entityName: `Support access to ${company.name}` });
      res.json({ message: "Support access granted", company, supportMode: true, user: newPayload });
    } catch (error) {
      console.error("Error granting support access:", error);
      res.status(500).json({ message: "Failed to grant support access" });
    }
  });

  app.post('/api/admin/exit-support', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') return res.status(403).json({ message: "Access denied. Super admin required." });
      if (req.user.supportMode) {
        const supportInfo = req.user.supportMode;
        await storage.logActivity({ companyId: supportInfo.companyId, userId: user.id, action: "exited", entityType: "company", entityId: supportInfo.companyId, entityName: "Exited support mode" });
        const newPayload = { ...req.user };
        delete newPayload.supportMode;
        const newToken = jwtUtils.generateToken(newPayload);
        setJwtCookie(res, newToken);
        req.user = newPayload;
      }
      res.json({ message: "Exited support mode", supportMode: false, user: req.user });
    } catch (error) {
      console.error("Error exiting support mode:", error);
      res.status(500).json({ message: "Failed to exit support mode" });
    }
  });

  app.get('/api/admin/support-status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') return res.status(403).json({ message: "Access denied. Super admin required." });
      const supportMode = req.user.supportMode || null;
      let currentCompany = null;
      if (supportMode) currentCompany = await storage.getCompanyById(supportMode.companyId);
      res.json({ supportMode: !!supportMode, company: currentCompany, startTime: supportMode?.startTime || null });
    } catch (error) {
      console.error("Error checking support status:", error);
      res.status(500).json({ message: "Failed to check support status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}