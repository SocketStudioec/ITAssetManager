import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
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
  BellRing,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
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
 *     Equipos físicos / Aplicaciones / Contratos / Mantenimientos
 * - Reportes
 * - Configuración
 * - Administración (solo super_admin)
 */
const assetChildren = [
  { path: "/assets", icon: Monitor, label: "Equipos físicos" },
  { path: "/subscriptions", icon: Key, label: "Aplicaciones" },
  { path: "/contracts", icon: FileText, label: "Contratos" },
  { path: "/maintenance", icon: Wrench, label: "Mantenimientos" },
];

// Rutas antiguas que viven dentro del grupo Activos IT (redirigen a /subscriptions)
const legacyAssetPaths = ["/applications", "/licenses"];

function getInitials(name?: string) {
  if (!name) {
    return "—";
  }

  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "—";
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export default function Sidebar({ selectedCompanyId, onCompanyChange, showAdminPanel }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("ta-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });

  const isAssetSection =
    assetChildren.some((child) => child.path === location) || legacyAssetPaths.includes(location);
  const [assetsOpen, setAssetsOpen] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem("ta-sidebar-collapsed", collapsed ? "1" : "0");
    } catch {
      // El sidebar sigue funcionando aunque el navegador bloquee localStorage.
    }
  }, [collapsed]);

  // Check if we're in support mode
  const { data: supportStatus } = useQuery({
    queryKey: ["/api/admin/support-status"],
    enabled: user?.role === "super_admin",
    retry: false,
    refetchInterval: 10000,
  });

  const { data: userCompanies = [] } = useQuery({
    queryKey: ["/api/companies"],
    enabled: !(supportStatus as any)?.supportMode,
  });

  // Conteo de vencimientos para el badge del menú
  const { data: unreadData } = useQuery<any>({
    queryKey: ["/api/notifications/unread-count", selectedCompanyId],
    enabled: !!selectedCompanyId,
    refetchInterval: 5 * 60 * 1000,
  });
  const expirationCount = unreadData?.count || 0;

  // Use support company or user companies
  const companies: any[] = (supportStatus as any)?.supportMode
    ? [{ company: (supportStatus as any).company }]
    : (userCompanies as any[]);

  const isAdmin = user?.role === "super_admin";
  const selectedCompany = companies.find((userCompany: any) => userCompany.company.id === selectedCompanyId);
  const selectedCompanyName = selectedCompany?.company.name || "Seleccionar empresa";

  const navButtonClass = (isActive: boolean) =>
    cn(
      "relative h-10 w-full cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
      collapsed ? "justify-center px-0" : "justify-start px-3",
      isActive
        ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const renderNavItem = ({
    path,
    icon: Icon,
    label,
    isActive,
    testId,
    expirationBadge = false,
    smallIcon = false,
  }: {
    path: string;
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    testId: string;
    expirationBadge?: boolean;
    smallIcon?: boolean;
  }) => {
    const item = (
      <Button
        asChild
        variant="ghost"
        className={navButtonClass(isActive)}
        data-testid={testId}
      >
        <Link href={path}>
          <span className={cn("relative shrink-0", collapsed ? "flex items-center justify-center" : "")}>
            <Icon className={smallIcon ? "h-4 w-4" : "h-5 w-5"} />
            {collapsed && expirationBadge && expirationCount > 0 && (
              <span
                className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card"
                aria-label={`${expirationCount} vencimientos pendientes`}
              />
            )}
          </span>

          {!collapsed && (
            <>
              <span className="ml-3 flex-1 truncate text-left">{label}</span>
              {expirationBadge && expirationCount > 0 && (
                <Badge className="ml-auto h-5 min-w-5 bg-destructive px-1 text-xs text-destructive-foreground">
                  {expirationCount > 9 ? "9+" : expirationCount}
                </Badge>
              )}
            </>
          )}
        </Link>
      </Button>
    );

    if (!collapsed) {
      return item;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className={cn("border-b border-border", collapsed ? "p-2" : "p-4")}>
          <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "mb-4 justify-between gap-2")}>
            <div className={cn("flex min-w-0 items-center", !collapsed && "gap-2")}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
                <Server className="h-5 w-5 text-primary-foreground" />
              </div>
              {!collapsed && (
                <h1 className="truncate text-lg font-semibold text-foreground">TechAssets Pro</h1>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 cursor-pointer text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setCollapsed((current) => !current)}
              aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </Button>
          </div>

          {!showAdminPanel && !collapsed && (
            <Select value={selectedCompanyId} onValueChange={onCompanyChange}>
              <SelectTrigger
                className="w-full cursor-pointer focus:ring-2 focus:ring-ring"
                data-testid="select-company"
              >
                <SelectValue placeholder="Seleccionar empresa">
                  {selectedCompanyName}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {companies.map((userCompany: any) => (
                  <SelectItem
                    key={userCompany.company.id}
                    value={userCompany.company.id}
                    data-testid={`option-company-${userCompany.company.id}`}
                  >
                    {userCompany.company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!showAdminPanel && collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground"
                  data-testid="select-company"
                  aria-label={selectedCompanyName}
                >
                  {getInitials(selectedCompanyName)}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{selectedCompanyName}</TooltipContent>
            </Tooltip>
          )}

          {showAdminPanel && !collapsed && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-2">
              <Crown className="h-4 w-4 text-foreground" />
              <span className="text-sm font-medium text-foreground">Panel de Admin</span>
            </div>
          )}

          {showAdminPanel && collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted"
                  aria-label="Panel de Admin"
                >
                  <Crown className="h-5 w-5 text-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Panel de Admin</TooltipContent>
            </Tooltip>
          )}
        </div>

        <nav className={cn("flex-1 overflow-y-auto space-y-1", collapsed ? "p-2" : "p-4")}>
          {renderNavItem({
            path: "/",
            icon: BarChart3,
            label: "Dashboard",
            isActive: location === "/",
            testId: "nav-dashboard",
          })}

          {renderNavItem({
            path: "/expirations",
            icon: BellRing,
            label: "Vencimientos",
            isActive: location === "/expirations",
            testId: "nav-expirations",
            expirationBadge: true,
          })}

          {collapsed ? (
            <div className="space-y-1 py-2">
              <div className="py-1" data-testid="nav-group-activos-it">
                <Separator />
              </div>

              {assetChildren.map((item) => {
                const isActive =
                  location === item.path ||
                  (item.path === "/subscriptions" && legacyAssetPaths.includes(location));

                return (
                  <div key={item.path}>
                    {renderNavItem({
                      path: item.path,
                      icon: item.icon,
                      label: item.label,
                      isActive,
                      testId: `nav-${item.path.replace("/", "")}`,
                    })}
                  </div>
                );
              })}

              <div className="pt-1">
                <Separator />
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setAssetsOpen((open) => !open)}
                className={cn(
                  "flex h-10 w-full cursor-pointer items-center justify-between rounded-md px-3 text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  isAssetSection
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-expanded={assetsOpen}
                data-testid="nav-group-activos-it"
              >
                <span className="flex items-center">
                  <Boxes className="mr-2 h-4 w-4" />
                  Activos IT
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    assetsOpen ? "rotate-0" : "-rotate-90",
                  )}
                />
              </button>

              {assetsOpen && (
                <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
                  {assetChildren.map((item) => {
                    const isActive =
                      location === item.path ||
                      (item.path === "/subscriptions" && legacyAssetPaths.includes(location));

                    return (
                      <div key={item.path}>
                        {renderNavItem({
                          path: item.path,
                          icon: item.icon,
                          label: item.label,
                          isActive,
                          testId: `nav-${item.path.replace("/", "")}`,
                          smallIcon: true,
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className={collapsed ? "" : "pt-2"}>
            {renderNavItem({
              path: "/reports",
              icon: PieChart,
              label: "Reportes",
              isActive: location === "/reports",
              testId: "nav-reports",
            })}
          </div>

          {renderNavItem({
            path: "/settings",
            icon: Settings,
            label: "Configuración",
            isActive: location === "/settings",
            testId: "nav-settings",
          })}

          {isAdmin && !showAdminPanel &&
            renderNavItem({
              path: "/admin",
              icon: Crown,
              label: "Administración",
              isActive: location === "/admin",
              testId: "nav-admin",
            })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}