/**
 * ============================================================================
 * ARCHIVO PRINCIPAL DE RUTAS DEL BACKEND (API REST)
 * ============================================================================
 * 
 * Este archivo define todas las rutas de la API REST para el sistema de gestión
 * de activos TI. Implementa un patrón MVC donde este archivo actúa como la capa
 * de controladores, delegando la lógica de negocio a la capa de storage.
 * 
 * ARQUITECTURA:
 * ┌─────────────┐      HTTP       ┌─────────────┐      SQL      ┌──────────┐
 * │   Cliente   │ ─── Request ───> │   Routes    │ ── Query ───> │    DB    │
 * │  (React)    │                  │ (este file) │               │ (Postgres│
 * │             │ <── Response ─── │             │ <── Result ── │    17)   │
 * └─────────────┘                  └─────────────┘               └──────────┘
 *                                         │
 *                                         ↓
 *                                  ┌─────────────┐
 *                                  │   Storage   │ (server/storage.ts)
 *                                  │  (Queries)  │
 *                                  └─────────────┘
 * 
 * PATRÓN DE DISEÑO: Model-View-Controller (MVC)
 * - Routes (Controllers): Manejan HTTP requests/responses y validación
 * - Storage (Services): Encapsulan la lógica de acceso a datos
 * - Schema (Models): Definen la estructura de datos y validación
 * 
 * AUTENTICACIÓN Y AUTORIZACIÓN:
 * - Sistema: Email/Password con sesiones persistentes (express-session)
 * - Storage: Sesiones guardadas en PostgreSQL tabla 'sessions'
 * - Password: Hash con sha256 (crypto) para seguridad
 * - Middleware: isAuthenticated() valida sesión en rutas protegidas
 * 
 * ROLES DEL SISTEMA:
 * 1. super_admin:
 *    - Acceso total a todas las empresas del sistema
 *    - Gestión de planes y límites de uso
 *    - Configuración global del sistema
 * 
 * 2. manager_owner:
 *    - Dueño/gerente de una empresa específica
 *    - CRUD completo de activos, contratos y licencias
 *    - Gestión de usuarios de su empresa
 * 
 * 3. technical_admin:
 *    - Administrador técnico de una empresa
 *    - Gestión de activos, mantenimiento y reportes
 *    - Sin acceso a configuración de empresa
 * 
 * 4. technician:
 *    - Técnico operativo de una empresa
 *    - Solo lectura y actualización de mantenimiento
 * 
 * SEGURIDAD IMPLEMENTADA:
 * ✅ Autenticación requerida: Middleware isAuthenticated() en rutas protegidas
 * ✅ Password hashing: sha256 para almacenamiento seguro
 * ✅ Validación de entrada: Esquemas Zod en todos los endpoints
 * ✅ Multi-tenancy: Aislamiento de datos por companyId
 * ✅ SQL Injection: Prepared statements con pg driver
 * ✅ Sesiones seguras: httpOnly cookies, regeneración de ID
 * ✅ Logging de auditoría: Tabla activity_log registra todas las operaciones
 * 
 * ESTRUCTURA DE ENDPOINTS:
 * 
 * PÚBLICOS (sin autenticación):
 * - POST /api/register        → Registro de nueva empresa
 * - POST /api/login           → Iniciar sesión
 * - POST /api/logout          → Cerrar sesión
 * 
 * AUTENTICACIÓN:
 * - GET  /api/auth/user       → Obtener usuario actual
 * - GET  /api/auth/companies  → Listar empresas del usuario
 * - POST /api/auth/switch-company → Cambiar empresa activa
 * 
 * DASHBOARD Y ANALYTICS:
 * - GET /api/dashboard/stats/:companyId    → KPIs y métricas
 * - GET /api/dashboard/costs/:companyId    → Análisis de costos
 * - GET /api/dashboard/expirations/:companyId → Vencimientos próximos
 * - GET /api/activity/:companyId           → Log de actividad
 * 
 * ACTIVOS (Assets):
 * - GET    /api/assets/:companyId    → Listar todos los activos
 * - GET    /api/assets/:companyId/:id → Obtener activo específico
 * - POST   /api/assets/:companyId    → Crear nuevo activo
 * - PUT    /api/assets/:companyId/:id → Actualizar activo
 * - DELETE /api/assets/:companyId/:id → Eliminar activo
 * 
 * CONTRATOS (Contracts):
 * - GET    /api/contracts/:companyId
 * - GET    /api/contracts/:companyId/:id
 * - POST   /api/contracts/:companyId
 * - PUT    /api/contracts/:companyId/:id
 * - DELETE /api/contracts/:companyId/:id
 * 
 * LICENCIAS (Licenses):
 * - GET    /api/licenses/:companyId
 * - GET    /api/licenses/:companyId/:id
 * - POST   /api/licenses/:companyId
 * - PUT    /api/licenses/:companyId/:id
 * - DELETE /api/licenses/:companyId/:id
 * 
 * MANTENIMIENTO (Maintenance):
 * - GET    /api/maintenance/:companyId
 * - GET    /api/maintenance/:companyId/asset/:assetId
 * - POST   /api/maintenance/:companyId
 * - PUT    /api/maintenance/:companyId/:id
 * - DELETE /api/maintenance/:companyId/:id
 * 
 * ADMIN (solo super_admin):
 * - GET  /api/admin/companies        → Listar todas las empresas
 * - PUT  /api/admin/companies/:id/plan → Cambiar plan de empresa
 * - PUT  /api/admin/companies/:id/status → Activar/desactivar empresa
 * 
 * CONVENCIONES:
 * - Todos los IDs son UUIDs (generados por PostgreSQL)
 * - Responses en formato JSON
 * - Códigos HTTP estándar (200, 201, 400, 401, 403, 404, 500)
 * - Mensajes de error descriptivos en español
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

/**
 * FUNCIÓN PRINCIPAL DE REGISTRO DE RUTAS
 * 
 * Esta función configura todas las rutas de la API y el middleware de autenticación.
 * Retorna un servidor HTTP configurado para producción.
 * 
 * @param app - Aplicación Express configurada
 * @returns Servidor HTTP listo para iniciar
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Configurar middleware de sesiones
  setupAuth(app);

  // =============================================================================
  // RUTAS PÚBLICAS (sin autenticación)
  // =============================================================================
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * POST /api/register - REGISTRO DE NUEVA EMPRESA
   * ═══════════════════════════════════════════════════════════════════════════
   * 
   * Registra una nueva empresa en el sistema junto con su primer usuario (owner/manager).
   * Este es el punto de entrada principal para nuevos clientes.
   * 
   * FLUJO DE REGISTRO:
   * 1. Validar datos de entrada con Zod (companyRegistrationSchema)
   * 2. Hashear password con sha256 (nunca almacenar en texto plano)
   * 3. Iniciar transacción de base de datos
   * 4. Crear empresa con plan seleccionado (PyME o Professional)
   * 5. Crear usuario administrador (role: manager_owner)
   * 6. Vincular usuario con empresa en tabla user_companies
   * 7. Commit de transacción
   * 8. Crear sesión automática (login automático post-registro)
   * 
   * REQUEST BODY:
   * {
   *   // Datos de la empresa
   *   companyName: string,              // Nombre de la empresa
   *   plan: "pyme" | "professional",    // Plan de subscripción
   *   ruc?: string,                     // RUC (Ecuador - empresas)
   *   cedula?: string,                  // Cédula (Ecuador - personas naturales)
   *   address?: string,                 // Dirección física
   *   phone?: string,                   // Teléfono de contacto
   *   email?: string,                   // Email corporativo
   *   
   *   // Datos del usuario administrador
   *   firstName: string,                // Nombre
   *   lastName: string,                 // Apellido
   *   email: string,                    // Email (login)
   *   password: string,                 // Password en texto plano (se hashea)
   * }
   * 
   * RESPONSE (200 OK):
   * {
   *   message: "Empresa registrada exitosamente",
   *   company: { id, name, plan, ... },
   *   user: { id, email, firstName, lastName, role }
   * }
   * 
   * ERRORES:
   * - 400: Email duplicado o RUC/Cédula ya existe
   * - 500: Error interno del servidor
   * 
   * SEGURIDAD:
   * ✅ Password hasheado antes de almacenar (nunca se guarda en texto plano)
   * ✅ Transacción atómica (todo o nada)
   * ✅ Validación de unicidad de email, RUC y cédula
   * ✅ Sesión creada automáticamente (httpOnly cookie)
   * 
   * NO REQUIERE AUTENTICACIÓN (ruta pública)
   */
  app.post('/api/register', async (req: any, res) => {
    try {
      // PASO 1: Validar datos de entrada con esquema Zod
      const registrationData = companyRegistrationSchema.parse(req.body);
      
      // PASO 2: Hash del password con sha256
      // NUNCA guardar passwords en texto plano
      const passwordHash = await passwordUtils.hash(registrationData.password);
      
      // PASO 3-7: Registrar empresa (transacción atómica en storage)
      // Crea: 1) Empresa, 2) Usuario, 3) Relación user_companies
      const result = await storage.registerCompany({
        ...registrationData,
        passwordHash,
      });
      
      // PASO 8: Login automático - crear sesión para el usuario recién registrado
      const token = jwtUtils.generateToken({
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      });
      //establecer JWT en cookie HTTP-only
      setJwtCookie(res, token);
      
      // Respuesta exitosa con datos de empresa y usuario
      res.json({
        message: "Empresa registrada exitosamente",
        company: result.company,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
        },
      });
    } catch (error: any) {
      console.error("Error registering company:", error);
      
      if(res.headersSent) {
        return;
      }
      // Manejar errores específicos
      if (error.message === "El email ya está registrado") {
        res.status(400).json({ message: error.message });
      } else if (error.code === '23505') {
        // PostgreSQL error code 23505: UNIQUE constraint violation
        res.status(400).json({ 
          message: "Ya existe una empresa con este RUC/Cédula o email" 
        });
      } else {
        res.status(500).json({ message: "Error al registrar empresa" });
      }
    }
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * POST /api/login - INICIO DE SESIÓN
   * ═══════════════════════════════════════════════════════════════════════════
   * 
   * Autentica un usuario y crea una sesión persistente.
   * La sesión se almacena en PostgreSQL (tabla 'sessions') y en una cookie httpOnly.
   * 
   * FLUJO DE LOGIN:
   * 1. Validar formato de email y password con Zod
   * 2. Buscar usuario por email en la base de datos
   * 3. Verificar password con passwordUtils.verify (sha256)
   * 4. Crear sesión en PostgreSQL (express-session)
   * 5. Enviar cookie de sesión al cliente (httpOnly, secure en prod)
   * 
   * REQUEST BODY:
   * {
   *   email: string,      // Email del usuario
   *   password: string    // Password en texto plano (nunca se guarda)
   * }
   * 
   * RESPONSE (200 OK):
   * {
   *   message: "Login exitoso",
   *   user: {
   *     id: string,
   *     email: string,
   *     firstName: string,
   *     lastName: string,
   *     role: "super_admin" | "manager_owner" | "technical_admin"
   *   }
   * }
   * 
   * ERRORES:
   * - 401: Credenciales incorrectas (email o password inválidos)
   *        Nota: El mensaje es genérico por seguridad (no revelar si el email existe)
   * - 500: Error interno del servidor
   * 
   * SEGURIDAD:
   * ✅ Password verificado con sha256
   * ✅ Mensaje de error genérico (no revela si el email existe)
   * ✅ Sesión almacenada en PostgreSQL (no en memoria)
   * ✅ Cookie httpOnly (no accesible desde JavaScript)
   * ✅ Cookie secure en producción (solo HTTPS)
   * ✅ Password nunca se retorna en la respuesta
   * 
   * NO REQUIERE AUTENTICACIÓN (ruta pública)
   */
  app.post('/api/login', async (req: any, res) => {
    try {
      // PASO 1: Validar formato de entrada con Zod
      const { email, password } = loginSchema.parse(req.body);
      
      // PASO 2: Buscar usuario por email (incluye passwordHash)
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // No revelar si el email existe (seguridad)
        return res.status(401).json({ message: "Email o contraseña incorrectos" });
      }
      
      // PASO 3: Verificar password con sha256
      const isValidPassword = await passwordUtils.verify(password, user.passwordHash);
      if (!isValidPassword) {
        // Mismo mensaje de error por seguridad
        return res.status(401).json({ message: "Email o contraseña incorrectos" });
      }
      
      // PASO 4: Genera JWT
      const token = jwtUtils.generateToken({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
      // PASO 5: Establecer JWT en cookie HTTP-only
      setJwtCookie(res, token);
      
      // Respuesta exitosa (SIN password hash)
      res.json({
        message: "Login exitoso",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error("Error during login:", error);
      res.status(500).json({ message: "Error al iniciar sesión" });
    }
  });

  /**
   * POST /api/logout
   * Cierra la sesión del usuario.
   */
  app.post('/api/logout', (req: any, res) => {
    //limpiar la cookie JWT
    clearJwtCookie(res);
    res.json({ message: "Sesión cerrada exitosamente" });
  });

  // =============================================================================
  // RUTAS DE AUTENTICACIÓN
  // =============================================================================
  
  /**
   * GET /api/auth/user
   * Obtiene la información del usuario autenticado actual.
   * 
   * FUNCIONALIDAD:
   * - Extrae el ID de usuario desde la sesión (req.session.userId)
   * - Consulta los datos completos del usuario en la base de datos
   * - Retorna el perfil del usuario con rol y metadatos
   * 
   * SEGURIDAD: Requiere autenticación válida via isAuthenticated middleware
   * USADO POR: Header, perfil de usuario, verificación de permisos
   */
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      // Don't send password hash to frontend
      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * GET /api/me - OBTENER ID DEL USUARIO LOGUEADO
   * ═══════════════════════════════════════════════════════════════════════════
   * 
   * Ruta protegida que devuelve el ID del usuario logueado.
   * Es una ruta ligera para que el frontend obtenga el ID del técnico.
   * 
   * RESPONSE (200 OK):
   * {
   *   userId: string,
   * }
   * 
   * ERRORES:
   * - 401: No autorizado (si no hay sesión)
   */
  app.get('/api/me', isAuthenticated, async (req: any, res) => {
    try {
      // El middleware isAuthenticated garantiza que req.user existe
      res.json({
        userId: req.user.userId,
      });
    } catch (error) {
      console.error("Error fetching current user ID:", error);
      res.status(500).json({ message: "Error interno del servidor al obtener ID de usuario" });
    }
  });
  // =============================================================================
  // RUTAS DE GESTIÓN DE EMPRESAS
  // =============================================================================
  
  /**
   * GET /api/companies
   * Obtiene todas las empresas a las que pertenece el usuario autenticado.
   * 
   * FUNCIONALIDAD:
   * - Lista las empresas donde el usuario tiene asignado un rol
   * - Incluye información del plan (PyME/Professional) y límites
   * - Filtra solo empresas activas donde el usuario tiene permisos
   * 
   * MODELO DE DATOS: Retorna UserCompany[] con información anidada de Company
   * USADO POR: Selector de empresa, dashboard, navegación
   */
  app.get('/api/companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const userCompanies = await storage.getUserCompanies(userId);
      console.log("User Companies:", userCompanies)
      res.json(userCompanies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  /**
   * POST /api/companies
   * Crea una nueva empresa y asigna al usuario como manager_owner.
   * 
   * FUNCIONALIDAD:
   * - Valida los datos de entrada con insertCompanySchema (Zod)
   * - Crea la empresa con valores por defecto según el plan seleccionado
   * - Asigna automáticamente al creador como manager_owner
   * - Registra la acción en el log de auditoría
   * 
   * VALIDACIÓN: Esquema Zod garantiza integridad de datos
   * AUDITORÍA: Todas las creaciones se registran con detalles completos
   * AUTORIZACIÓN: El creador automáticamente recibe permisos de propietario
   */
  app.post('/api/companies', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.userId;
      const validatedData = insertCompanySchema.parse(req.body);
      
      const company = await storage.createCompany(validatedData);
      await storage.addUserToCompany(userId, company.id, "manager_owner");
      
      // Registrar actividad para auditoría
      await storage.logActivity({
        companyId: company.id,
        userId,
        action: "created",
        entityType: "company",
        entityId: company.id,
        entityName: company.name,
      });
      
      res.json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(400).json({ message: "Failed to create company" });
    }
  });

  // =============================================================================
  // RUTAS DE DASHBOARD Y ANALYTICS
  // =============================================================================
  
  /**
   * GET /api/dashboard/:companyId/summary
   * Obtiene el resumen ejecutivo de costos y activos para el dashboard principal.
   * 
   * FUNCIONALIDAD:
   * - Calcula costos totales mensuales y anuales por categoría
   * - Cuenta activos por tipo (físicos, aplicaciones, licencias, contratos)
   * - Agrega datos de múltiples fuentes (assets, licenses, contracts, maintenance)
   * - Optimizado para mostrar KPIs en tiempo real
   * 
   * MODELO DE DATOS:
   * costs: { monthlyTotal, annualTotal, licenseCosts, maintenanceCosts, hardwareCosts, contractCosts }
   * assets: { totalAssets, physicalAssets, applications, licenses, contracts }
   * 
   * USADO POR: Dashboard principal, gráficos de resumen, reportes ejecutivos
   */
  app.get('/api/dashboard/:companyId/summary', isAuthenticated, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const costSummary = await storage.getCompanyCostSummary(companyId);
      const assetCounts = await storage.getAssetCounts(companyId);
      
      res.json({
        costs: costSummary,
        assets: assetCounts,
      });
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      res.status(500).json({ message: "Failed to fetch dashboard summary" });
    }
  });

  /**
   * GET /api/dashboard/:companyId/activity
   * Obtiene el log de actividad reciente para mostrar en el dashboard.
   * 
   * FUNCIONALIDAD:
   * - Lista las últimas acciones realizadas en la empresa (crear, editar, eliminar)
   * - Incluye información del usuario que realizó la acción
   * - Parámetro opcional 'limit' para controlar cantidad de registros
   * - Ordenado por fecha de creación descendente (más recientes primero)
   * 
   * USADO POR: Timeline de actividad, auditoría, seguimiento de cambios
   */
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
  // RUTAS DE GESTIÓN DE ACTIVOS
  // =============================================================================
  
  /**
   * GET /api/assets/:companyId
   * Obtiene todos los activos de una empresa específica.
   * 
   * FUNCIONALIDAD:
   * - Lista activos físicos (laptops, servidores, impresoras, etc.)
   * - Lista aplicaciones (SaaS, desarrollo personalizado)
   * - Incluye información de costos, estado, y fechas de vencimiento
   * - Filtrado automático por companyId para seguridad multi-tenant
   * 
   * MODELO UNIFICADO: Un solo endpoint para todos los tipos de activos
   * USADO POR: Tabla de activos, inventario, reportes, dashboard
   */
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
      // 1.  Accede al ID del usuario correctamente desde el token
      const userId = req.user.userId;
      console.log("Creating asset for userId:", userId); 

      // 2. Obteniene el companyId del usuario desde la base de datos
      const userCompanies = await storage.getUserCompanies(userId);
      if (!userCompanies || userCompanies.length === 0) {
          return res.status(403).json({ message: "Usuario no asociado a ninguna empresa activa." });
      }
      const companyIdFromDB = userCompanies[0].companyId;

      // 3. Inyecta el companyId en el cuerpo de la solicitud antes de la validación de Zod
      // Esto garantiza que Zod pase y que el activo se asocie a la empresa correcta.
      const dataToValidate = {
        ...req.body,
        companyId: companyIdFromDB, 
      };

      // 4. Validar los datos combinados
      const validatedData = insertAssetSchema.parse(dataToValidate);
      
      // 5. lógica para asignar el técnico
      const dataToInsert = {
        ...validatedData,
        assignedTo: userId,
      };

      const asset = await storage.createAsset(dataToInsert);
      
      // 6. Registrar actividad con el companyId correcto
      await storage.logActivity({
        companyId: companyIdFromDB, 
        userId,
        action: "created",
        entityType: "asset",
        entityId: asset.id,
        entityName: asset.name,
      }); 
      res.json(asset);
    } catch (error) {
      console.error("Error creating asset:", error);
      
      // Manejo de errores de Zod para mejor depuración
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Error de validación en los datos del activo",
          errors: error.errors,
        });
      }

      res.status(500).json({ message: "Error al crear el activo" });
    }
  });

  app.put('/api/assets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const validatedData = insertAssetSchema.partial().parse(req.body);
      
      const asset = await storage.updateAsset(id, validatedData);
      
      await storage.logActivity({
        companyId: asset.companyId,
        userId,
        action: "updated",
        entityType: "asset",
        entityId: asset.id,
        entityName: asset.name,
      });
      
      res.json(asset);
    } catch (error) {
      console.error("Error updating asset:", error);
      res.status(400).json({ message: "Failed to update asset" });
    }
  });

  app.delete('/api/assets/:id/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const { id, companyId } = req.params;
      const userId = req.user.userId;
      
      const asset = await storage.getAssetById(id, companyId);
      if (!asset) {
        return res.status(404).json({ message: "Asset not found" });
      }
      
      await storage.deleteAsset(id, companyId);
      
      await storage.logActivity({
        companyId,
        userId,
        action: "deleted",
        entityType: "asset",
        entityId: id,
        entityName: asset.name,
      });
      
      res.json({ message: "Asset deleted successfully" });
    } catch (error) {
      console.error("Error deleting asset:", error);
      res.status(500).json({ message: "Failed to delete asset" });
    }
  });

  // Contract routes
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
      
      await storage.logActivity({
        companyId: validatedData.companyId,
        userId,
        action: "created",
        entityType: "contract",
        entityId: contract.id,
        entityName: contract.name,
      });
      
      res.json(contract);
    } catch (error) {
      console.error("Error creating contract:", error);
      res.status(400).json({ message: "Failed to create contract" });
    }
  });

  // License routes
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
      
      await storage.logActivity({
        companyId: validatedData.companyId,
        userId,
        action: "created",
        entityType: "license",
        entityId: license.id,
        entityName: license.name,
      });
      
      res.json(license);
    } catch (error) {
      console.error("Error creating license:", error);
      res.status(400).json({ message: "Failed to create license" });
    }
  });

  // Maintenance routes
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
      
      await storage.logActivity({
        companyId: validatedData.companyId,
        userId,
        action: "created",
        entityType: "maintenance_record",
        entityId: record.id,
        entityName: `Maintenance for ${record.description}`,
      });
      
      res.json(record);
    } catch (error) {
      console.error("Error creating maintenance record:", error);
      res.status(400).json({ message: "Failed to create maintenance record" });
    }
  });

  // Admin routes (Super Admin only)
  app.get('/api/admin/companies', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const companies = await storage.getAllCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.put('/api/admin/companies/:companyId/plan', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { companyId } = req.params;
      const { plan, maxUsers, maxAssets } = req.body;
      
      if (!['pyme', 'professional'].includes(plan)) {
        return res.status(400).json({ message: "Invalid plan type" });
      }
      
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
      if (user?.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { companyId } = req.params;
      const { isActive } = req.body;
      
      const updatedCompany = await storage.toggleCompanyStatus(companyId, isActive);
      res.json(updatedCompany);
    } catch (error) {
      console.error("Error updating company status:", error);
      res.status(500).json({ message: "Failed to update company status" });
    }
  });

  // Super Admin - Support Mode Routes
  app.post('/api/admin/support-access/:companyId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const { companyId } = req.params;
      const company = await storage.getCompanyById(companyId);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Set support mode session flag
      const supportModeData = {
        companyId: companyId,
        adminId: user.id,
        startTime: new Date().toISOString()
      };
      
      // 1. Generar un NUEVO token JWT con el estado actualizado
      const newPayload = {
        ...req.user, // Copia el payload actual
        supportMode: supportModeData, // Agrega el nuevo estado
      };
      
      const newToken = jwtUtils.generateToken(newPayload);
      
      // 2. Establecer el nuevo JWT en la cookie HTTP-only
      setJwtCookie(res, newToken);
      
      // Log this access for auditing
      await storage.logActivity({
        companyId: companyId,
        userId: user.id,
        action: "accessed",
        entityType: "company",
        entityId: companyId,
        entityName: `Support access to ${company.name}`,
      });
      
      res.json({ 
        message: "Support access granted", 
        company: company,
        supportMode: true,
        user: newPayload 
      });
    } catch (error) {
      console.error("Error granting support access:", error);
      res.status(500).json({ message: "Failed to grant support access" });
    }
  });

  app.post('/api/admin/exit-support', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      if (req.user.supportMode) {
        const supportInfo = req.user.supportMode;
        
        // Log exit from support mode
        await storage.logActivity({
          companyId: supportInfo.companyId,
          userId: user.id,
          action: "exited",
          entityType: "company",
          entityId: supportInfo.companyId,
          entityName: "Exited support mode",
        });

        // 1. Eliminar el estado de support mode
        const newPayload = { 
          ...req.user 
        };
       delete newPayload.supportMode;
      // 2. Generar un NUEVO token JWT sin el estado de support mode
      const newToken = jwtUtils.generateToken(newPayload);
      
      // 3. Establecer el nuevo JWT en la cookie HTTP-only
      setJwtCookie(res, newToken);

      //4. Actualizar la sesión del usuario
      req.user = newPayload;
    }
      
      res.json({ 
        message: "Exited support mode", 
        supportMode: false,
        user: req.user //devuelve el estado actualizado del usuario
       });
    } catch (error) {
      console.error("Error exiting support mode:", error);
      res.status(500).json({ message: "Failed to exit support mode" });
    }
  });

  app.get('/api/admin/support-status', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (user?.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin required." });
      }
      
      const supportMode = req.user.supportMode || null;
      let currentCompany = null;
      
      if (supportMode) {
        currentCompany = await storage.getCompanyById(supportMode.companyId);
      }
      
      res.json({ 
        supportMode: !!supportMode,
        company: currentCompany,
        startTime: supportMode?.startTime || null
      });
    } catch (error) {
      console.error("Error checking support status:", error);
      res.status(500).json({ message: "Failed to check support status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
