import type { Company } from "@shared/schema";

export type Plan = "pyme" | "professional";

export interface PlanLimits {
  maxUsers: number;
  maxAssets: number;
  maxApplications: number;
  maxContracts: number;
  maxLicenses: number;
  hasTechnicianRole: boolean;
  hasAdvancedReports: boolean;
  hasApiAccess: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  pyme: {
    maxUsers: 50,
    maxAssets: 1000,
    maxApplications: 200,
    maxContracts: 100,
    maxLicenses: 500,
    hasTechnicianRole: true,
    hasAdvancedReports: true,
    hasApiAccess: true,
  },
  professional: {
    maxUsers: 1,
    maxAssets: 100,
    maxApplications: 50,
    maxContracts: 25,
    maxLicenses: 100,
    hasTechnicianRole: false,
    hasAdvancedReports: false,
    hasApiAccess: false,
  },
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function canCreateMore<T extends string>(
  plan: Plan,
  type: T,
  currentCount: number
): boolean {
  const limits = getPlanLimits(plan);
  
  switch (type) {
    case "users":
      return currentCount < limits.maxUsers;
    case "assets":
      return currentCount < limits.maxAssets;
    case "applications":
      return currentCount < limits.maxApplications;
    case "contracts":
      return currentCount < limits.maxContracts;
    case "licenses":
      return currentCount < limits.maxLicenses;
    default:
      return true;
  }
}

export function getUsagePercentage(
  plan: Plan,
  type: string,
  currentCount: number
): number {
  const limits = getPlanLimits(plan);
  let maxCount = 0;
  
  switch (type) {
    case "users":
      maxCount = limits.maxUsers;
      break;
    case "assets":
      maxCount = limits.maxAssets;
      break;
    case "applications":
      maxCount = limits.maxApplications;
      break;
    case "contracts":
      maxCount = limits.maxContracts;
      break;
    case "licenses":
      maxCount = limits.maxLicenses;
      break;
    default:
      return 0;
  }
  
  return Math.round((currentCount / maxCount) * 100);
}

export function getPlanDisplayName(plan: Plan): string {
  switch (plan) {
    case "pyme":
      return "PyME";
    case "professional":
      return "Profesional";
    default:
      return plan;
  }
}

export function isPlanFeatureEnabled(plan: Plan, feature: string): boolean {
  const limits = getPlanLimits(plan);
  
  switch (feature) {
    case "technician_role":
      return limits.hasTechnicianRole;
    case "advanced_reports":
      return limits.hasAdvancedReports;
    case "api_access":
      return limits.hasApiAccess;
    default:
      return true;
  }
}