import { z } from "zod";

// ============================================================================
// TYPE DEFINITIONS (sin Drizzle ORM)
// ============================================================================

// Enums como tipos TypeScript
export type UserRole = "super_admin" | "technical_admin" | "manager_owner";
export type AssetStatus = "active" | "inactive" | "maintenance" | "deprecated" | "disposed";
export type AssetType = "physical" | "application" | "license" | "contract";
export type ApplicationType = "saas" | "custom_development";
export type MaintenanceType = "preventive" | "corrective" | "emergency" | "upgrade";
export type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type ContractStatus = "active" | "expired" | "pending_renewal" | "cancelled";
export type CompanyPlan = "pyme" | "professional";

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Company {
  id: string;
  name: string;
  description: string | null;
  plan: CompanyPlan;
  maxUsers: number;
  maxAssets: number;
  isActive: boolean;
  ruc: string | null;
  cedula: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCompany {
  id: string;
  userId: string;
  companyId: string;
  role: UserRole;
  createdAt: Date;
}

export interface Asset {
  id: string;
  companyId: string;
  name: string;
  type: AssetType;
  description: string | null;
  serialNumber: string | null;
  model: string | null;
  manufacturer: string | null;
  purchaseDate: Date | null;
  warrantyExpiry: Date | null;
  monthlyCost: number;
  annualCost: number;
  status: AssetStatus;
  location: string | null;
  assignedTo: string | null;
  notes: string | null;
  applicationType: ApplicationType | null;
  url: string | null;
  version: string | null;
  domainCost: number;
  sslCost: number;
  hostingCost: number;
  serverCost: number;
  domainExpiry: Date | null;
  sslExpiry: Date | null;
  hostingExpiry: Date | null;
  serverExpiry: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contract {
  id: string;
  companyId: string;
  name: string;
  vendor: string;
  description: string | null;
  contractType: string;
  startDate: Date;
  endDate: Date;
  renewalDate: Date | null;
  monthlyCost: number;
  annualCost: number;
  status: ContractStatus;
  autoRenewal: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface License {
  id: string;
  companyId: string;
  assetId: string | null;
  name: string;
  vendor: string;
  licenseKey: string | null;
  licenseType: string | null;
  maxUsers: number | null;
  currentUsers: number;
  purchaseDate: Date | null;
  expiryDate: Date | null;
  monthlyCost: number;
  annualCost: number;
  status: AssetStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceRecord {
  id: string;
  assetId: string;
  companyId: string;
  maintenanceType: MaintenanceType;
  title: string;
  description: string;
  vendor: string | null;
  cost: number;
  scheduledDate: Date | null;
  completedDate: Date | null;
  nextMaintenanceDate: Date | null;
  status: MaintenanceStatus;
  priority: string;
  technician: string | null;
  partsReplaced: string | null;
  timeSpent: number | null;
  notes: string | null;
  attachments: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityLog {
  id: string;
  companyId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  details: string | null;
  createdAt: Date;
}

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// User schemas
export const insertUserSchema = z.object({
  email: z.string().email("Email inválido"),
  passwordHash: z.string(),
  firstName: z.string().min(1, "Nombre es requerido"),
  lastName: z.string().min(1, "Apellido es requerido"),
  profileImageUrl: z.string().optional().nullable(),
  role: z.enum(["super_admin", "technical_admin", "manager_owner"]).optional(),
});

// Company schemas
export const insertCompanySchema = z.object({
  name: z.string().min(1, "Nombre es requerido"),
  description: z.string().optional().nullable(),
  plan: z.enum(["pyme", "professional"]),
  maxUsers: z.number().optional(),
  maxAssets: z.number().optional(),
  isActive: z.boolean().optional(),
  ruc: z.string().optional().nullable(),
  cedula: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
});

// Asset schemas
export const insertAssetSchema = z.object({
  companyId: z.string(),
  name: z.string().min(1, "Nombre es requerido"),
  type: z.enum(["physical", "application", "license", "contract"]),
  description: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  purchaseDate: z.date().optional().nullable(),
  warrantyExpiry: z.date().optional().nullable(),
  monthlyCost: z.number().optional(),
  annualCost: z.number().optional(),
  status: z.enum(["active", "inactive", "maintenance", "deprecated", "disposed"]).optional(),
  location: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  applicationType: z.enum(["saas", "custom_development"]).optional().nullable(),
  url: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  domainCost: z.number().optional(),
  sslCost: z.number().optional(),
  hostingCost: z.number().optional(),
  serverCost: z.number().optional(),
  domainExpiry: z.date().optional().nullable(),
  sslExpiry: z.date().optional().nullable(),
  hostingExpiry: z.date().optional().nullable(),
  serverExpiry: z.date().optional().nullable(),
});

// Contract schemas
export const insertContractSchema = z.object({
  companyId: z.string(),
  name: z.string().min(1, "Nombre es requerido"),
  vendor: z.string().min(1, "Proveedor es requerido"),
  description: z.string().optional().nullable(),
  contractType: z.string().min(1, "Tipo de contrato es requerido"),
  startDate: z.date(),
  endDate: z.date(),
  renewalDate: z.date().optional().nullable(),
  monthlyCost: z.number().optional(),
  annualCost: z.number().optional(),
  status: z.enum(["active", "expired", "pending_renewal", "cancelled"]).optional(),
  autoRenewal: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

// License schemas
export const insertLicenseSchema = z.object({
  companyId: z.string(),
  assetId: z.string().optional().nullable(),
  name: z.string().min(1, "Nombre es requerido"),
  vendor: z.string().min(1, "Proveedor es requerido"),
  licenseKey: z.string().optional().nullable(),
  licenseType: z.string().optional().nullable(),
  maxUsers: z.number().optional().nullable(),
  currentUsers: z.number().optional(),
  purchaseDate: z.string().datetime().optional().nullable(),
  expiryDate: z.date().optional().nullable(),
  monthlyCost: z.number().optional(),
  annualCost: z.number().optional(),
  status: z.enum(["active", "inactive", "maintenance", "deprecated", "disposed"]).optional(),
  notes: z.string().optional().nullable(),
});

// Maintenance record schemas
export const insertMaintenanceRecordSchema = z.object({
  assetId: z.string(),
  companyId: z.string(),
  maintenanceType: z.enum(["preventive", "corrective", "emergency", "upgrade"]),
  title: z.string().min(1, "Título es requerido"),
  description: z.string().min(1, "Descripción es requerida"),
  vendor: z.string().optional().nullable(),
  cost: z.number().optional(),
  scheduledDate: z.date().optional().nullable(),
  completedDate: z.date().optional().nullable(),
  nextMaintenanceDate: z.date().optional().nullable(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.string().optional(),
  technician: z.string().optional().nullable(),
  partsReplaced: z.string().optional().nullable(),
  timeSpent: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  attachments: z.array(z.string()).optional().nullable(),
});

// Registration schema for new companies
export const companyRegistrationSchema = z.object({
  name: z.string().min(1, "Nombre es requerido"),
  plan: z.enum(["pyme", "professional"]),
  ruc: z.string().optional().refine((val) => !val || (/^\d{13}$/.test(val)), {
    message: "El RUC debe tener 13 dígitos numéricos",
  }),
  cedula: z.string().optional().refine((val) => !val || (/^\d{10}$/.test(val)), {
    message: "La Cédula debe tener 10 dígitos numéricos",
  }),
  address: z.string().min(1, "Dirección es requerida"),
  phone: z.string().min(1, "Celular es requerido"),
  email: z.string().email("Email inválido"),
  firstName: z.string().min(1, "Nombre es requerido"),
  lastName: z.string().min(1, "Apellido es requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"]
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña es requerida"),
});

// ============================================================================
// EXPORT TYPES FROM ZOD SCHEMAS
// ============================================================================

export type UpsertUser = z.infer<typeof insertUserSchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type InsertLicense = z.infer<typeof insertLicenseSchema>;
export type InsertMaintenanceRecord = z.infer<typeof insertMaintenanceRecordSchema>;
export type CompanyRegistration = z.infer<typeof companyRegistrationSchema>;

// Compatibility exports (no longer used but kept for reference)
export const users = {} as any;
export const companies = {} as any;
export const assets = {} as any;
export const contracts = {} as any;
export const licenses = {} as any;
export const maintenanceRecords = {} as any;
export const activityLog = {} as any;
export const userCompanies = {} as any;
