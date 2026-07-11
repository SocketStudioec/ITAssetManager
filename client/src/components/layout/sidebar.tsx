import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Server,
  BarChart3,
  Monitor,
  FileText,
  Key,
  Wrench,
  PieChart,
  Settings,
  ChevronDown,
  Crown,
  Boxes,
} from "lucide-react";

interface SidebarProps {
  selectedCompanyId: string;
  onCompanyChange: (companyId: string) => void;
  showAdminPanel?: boolean;
}

/**
 * Arquitectura de navegación (ver ANALISIS-UX.md):
 * - Dashboard
 * - ACTIVOS IT (módulo padre, colapsable)
 *     Equipos físicos / Licencias y suscripciones / Contratos / Mantenimientos
 * - Reportes
 * - Configuración
 * - Administración (solo super_admin)
 */
const assetChildren = [
  { path: "/assets", icon: Monitor, label: "Equipos físicos" },
  { path: "/subscriptions", icon: Key, label: "Licencias y suscripciones" },
  { path: "/contracts", icon: FileText, label: "Contratos" },
  { path: "/maintenance", icon: Wrench, label: "Mantenimientos" },
];

// Rutas antiguas que viven dentro del grupo Activos IT (redirigen a /subscriptions)
const legacyAssetPaths = ["/applications", "/licenses"];

export default function Sidebar({ selectedCompanyId, onCompanyChange, showAdminPanel }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  const isAssetSection =
    assetChildren.some((c) => c.path === location) || legacyAssetPaths.includes(location);
  const [assetsOpen, setAssetsOpen] = useState(true);

  // Check if we're in support mode
  const { data: supportStatus } = useQuery({
    queryKey: ["/api/admin/support-status"],
    enabled: user?.role === 'super_admin',
    retry: false,
    refetchInterval: 10000,
  });

  const { data: userCompanies = [] } = useQuery({
    queryKey: ["/api/companies"],
    enabled: !(supportStatus as any)?.supportMode,
  });

  // Use support company or user companies
  const companies: any[] = (supportStatus as any)?.supportMode
    ? [{ company: (supportStatus as any).company }]
    : (userCompanies as any[]);

  const isAdmin = user?.role === 'super_admin';
  const selectedCompany = companies.find((uc: any) => uc.company.id === selectedCompanyId);

  const navButtonClass = (isActive: boolean) =>
    cn(
      "w-full justify-start",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Server className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">TechAssets Pro</h1>
        </div>

        {/* Company Selector - Hide in admin panel */}
        {!showAdminPanel && (
          <Select value={selectedCompanyId} onValueChange={onCompanyChange}>
            <SelectTrigger className="w-full" data-testid="select-company">
              <SelectValue placeholder="Seleccionar empresa">
                {selectedCompany?.company.name || "Seleccionar empresa"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {companies.map((uc: any) => (
                <SelectItem key={uc.company.id} value={uc.company.id} data-testid={`option-company-${uc.company.id}`}>
                  {uc.company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Admin Panel Indicator */}
        {showAdminPanel && (
          <div className="flex items-center space-x-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <Crown className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Panel de Admin</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {/* Dashboard */}
        <Link href="/">
          <Button
            variant={location === "/" ? "default" : "ghost"}
            className={navButtonClass(location === "/")}
            data-testid="nav-dashboard"
          >
            <BarChart3 className="w-5 h-5 mr-3" />
            Dashboard
          </Button>
        </Link>

        {/* Módulo padre: ACTIVOS IT */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setAssetsOpen((open) => !open)}
            className={cn(
              "w-full flex items-center justify-between rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
              isAssetSection ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            aria-expanded={assetsOpen}
            data-testid="nav-group-activos-it"
          >
            <span className="flex items-center">
              <Boxes className="w-4 h-4 mr-2" />
              Activos IT
            </span>
            <ChevronDown
              className={cn("w-4 h-4 transition-transform duration-200", assetsOpen ? "rotate-0" : "-rotate-90")}
            />
          </button>

          {assetsOpen && (
            <div className="mt-1 space-y-1 border-l border-border ml-4 pl-2">
              {assetChildren.map((item) => {
                const isActive =
                  location === item.path ||
                  (item.path === "/subscriptions" && legacyAssetPaths.includes(location));
                const Icon = item.icon;
                return (
                  <Link key={item.path} href={item.path}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={cn(navButtonClass(isActive), "h-9")}
                      data-testid={`nav-${item.path.replace('/', '')}`}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Reportes */}
        <div className="pt-2">
          <Link href="/reports">
            <Button
              variant={location === "/reports" ? "default" : "ghost"}
              className={navButtonClass(location === "/reports")}
              data-testid="nav-reports"
            >
              <PieChart className="w-5 h-5 mr-3" />
              Reportes
            </Button>
          </Link>
        </div>

        {/* Configuración */}
        <Link href="/settings">
          <Button
            variant={location === "/settings" ? "default" : "ghost"}
            className={navButtonClass(location === "/settings")}
            data-testid="nav-settings"
          >
            <Settings className="w-5 h-5 mr-3" />
            Configuración
          </Button>
        </Link>

        {/* Administración (solo super_admin) */}
        {isAdmin && !showAdminPanel && (
          <Link href="/admin">
            <Button
              variant={location === "/admin" ? "default" : "ghost"}
              className={navButtonClass(location === "/admin")}
              data-testid="nav-admin"
            >
              <Crown className="w-5 h-5 mr-3" />
              Administración
            </Button>
          </Link>
        )}
      </nav>
    </aside>
  );
}
