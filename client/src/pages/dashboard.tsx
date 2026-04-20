import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CostPieChart from "@/components/charts/cost-pie-chart";
import { getPlanDisplayName, getPlanLimits, getUsagePercentage } from "@/lib/planUtils";
import TrendLineChart from "@/components/charts/trend-line-chart";
import AddAssetModal from "@/components/modals/add-asset-modal";
import AddMaintenanceModal from "@/components/modals/add-maintenance-modal";
import {
  DollarSign,
  Calendar,
  Laptop,
  Server,
  Plus,
  FileText,
  CalendarPlus,
  TrendingUp,
  AlertTriangle,
  Download,
  Crown,
  CheckCircle2
} from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedAssetForMaintenance, setSelectedAssetForMaintenance] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [showAssetSelectionDialog, setShowAssetSelectionDialog] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al inicio de sesión...",
        variant: "destructive",
      });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: supportStatus } = useQuery<{ supportMode: boolean; company: any }>({
    queryKey: ["/api/admin/support-status"],
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 10000,
  });

  const { data: userCompanies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    enabled: isAuthenticated && !supportStatus?.supportMode,
  });

  const companies = supportStatus?.supportMode
    ? [{ company: supportStatus.company }]
    : userCompanies;

  const selectedCompany = Array.isArray(companies)
    ? companies.find((uc: any) => uc.company.id === selectedCompanyId)
    : undefined;

  useEffect(() => {
    if (Array.isArray(companies) && companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].company.id);
    }
  }, [companies, selectedCompanyId]);

  const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useQuery({
    queryKey: ["/api/dashboard", selectedCompanyId, "summary"],
    enabled: !!selectedCompanyId,
  });

  const { data: recentActivity = [], isLoading: isActivityLoading } = useQuery({
    queryKey: ["/api/dashboard", selectedCompanyId, "activity"],
    enabled: !!selectedCompanyId,
  });

  const { data: assetsList = [] } = useQuery({
    queryKey: ["/api/assets", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  const physicalAssets = (assetsList as any[]).filter((asset: any) => asset.type === "physical");

  // =========================================================================
  // CÁLCULOS DINÁMICOS
  // =========================================================================

  const assetsInMaintenance = physicalAssets.filter((asset: any) =>
    asset.status === "maintenance" || asset.status === "mantenimiento"
  ).length;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const newAppsThisMonth = (assetsList as any[]).filter((asset: any) => {
    if (asset.type !== "application") return false;
    const dateValue = asset.createdAt || asset.created_at;
    if (!dateValue) return false;
    const createdDate = new Date(dateValue);
    return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
  }).length;

  // =========================================================================

  const handleScheduleMaintenance = () => {
    if (physicalAssets.length === 0) {
      toast({
        title: "No hay activos físicos",
        description: "Primero debes agregar activos físicos para programar mantenimiento.",
        variant: "destructive",
      });
      return;
    }
    if (physicalAssets.length === 1) {
      const asset = physicalAssets[0];
      setSelectedAssetForMaintenance({ id: asset.id, name: asset.name });
      setShowMaintenanceModal(true);
    } else {
      setShowAssetSelectionDialog(true);
    }
  };

  const handleGenerateReport = () => {
    toast({ title: "Generando reporte...", description: "Preparando el archivo CSV con tus datos." });
    setTimeout(() => {
      const csvRows = [
        ["Metrica", "Valor"],
        ["Costo Mensual Real", costs.monthlyReal ?? costs.monthlyTotal ?? 0],
        ["Costo Anual Real", costs.annualReal ?? costs.annualTotal ?? 0],
        ["Costo Mensual Contable", costs.monthlyAccounting ?? 0],
        ["Costo Anual Contable", costs.annualAccounting ?? 0],
        ["Total Aplicaciones", assets.applications ?? 0],
        ["Equipos Fisicos", assets.physicalAssets ?? 0],
        ["Equipos en Mantenimiento", assetsInMaintenance ?? 0],
      ];
      const csvContent = csvRows.map(row => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Reporte_TI_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "¡Reporte listo!", description: "El archivo se ha descargado en tu equipo." });
    }, 1000);
  };

  const handleAssetSelection = () => {
    const selectedAsset = physicalAssets.find(asset => asset.id === selectedAssetId);
    if (selectedAsset) {
      setSelectedAssetForMaintenance({ id: selectedAsset.id, name: selectedAsset.name });
      setShowAssetSelectionDialog(false);
      setShowMaintenanceModal(true);
      setSelectedAssetId("");
    }
  };

  const getExpiringServices = () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const alerts: any[] = [];
    (assetsList as any[]).forEach((asset: any) => {
      if (asset.type !== 'application') return;
      const services = [
        { name: 'Dominio', date: asset.domainExpiry || asset.domain_expiry, app: asset.name },
        { name: 'SSL', date: asset.sslExpiry || asset.ssl_expiry, app: asset.name },
        { name: 'Hosting', date: asset.hostingExpiry || asset.hosting_expiry, app: asset.name },
        { name: 'Servidor', date: asset.serverExpiry || asset.server_expiry, app: asset.name },
      ];
      services.forEach(service => {
        if (!service.date) return;
        const expiryDate = new Date(service.date);
        if (expiryDate < now) {
          alerts.push({ type: 'expired', service: service.name, app: service.app, date: expiryDate, priority: 'high' });
        } else if (expiryDate <= thirtyDaysFromNow) {
          const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({ type: 'expiring', service: service.name, app: service.app, date: expiryDate, daysLeft, priority: daysLeft <= 7 ? 'high' : 'medium' });
        }
      });
    });
    return alerts.sort((a, b) => {
      if (a.type === 'expired' && b.type !== 'expired') return -1;
      if (a.type !== 'expired' && b.type === 'expired') return 1;
      return a.date.getTime() - b.date.getTime();
    });
  };

  const expiringServices = getExpiringServices();

  useEffect(() => {
    if (dashboardError && isUnauthorizedError(dashboardError as Error)) {
      toast({ title: "No autorizado", description: "Redirigiendo al inicio de sesión...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [dashboardError, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="w-32 h-8" />
      </div>
    );
  }

  const costs = (dashboardData as any)?.costs || {};
  const assets = (dashboardData as any)?.assets || {};

  // ── VALORES DE COSTO ───────────────────────────────────────────────────────
  // Fallback a campos originales por si hay caché del backend anterior
  const monthlyReal = costs.monthlyReal ?? costs.monthlyTotal ?? 0;
  const annualReal = costs.annualReal ?? costs.annualTotal ?? 0;
  const monthlyAccounting = costs.monthlyAccounting ?? 0;
  const annualAccounting = costs.annualAccounting ?? 0;

  // Helper de formato de moneda
  const fmt = (val: number) =>
    val.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen">
      <Sidebar selectedCompanyId={selectedCompanyId} onCompanyChange={setSelectedCompanyId} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Dashboard de Costos TI"
          subtitle="Resumen ejecutivo de activos y gastos"
          selectedCompanyId={selectedCompanyId}
        />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 space-y-6">

            {/* ================================================================
                TARJETAS DE RESUMEN — 4 tarjetas
                [Costo Mensual Real] [Costo Mensual Contable] [Aplicaciones] [Equipos]
                Tarjetas 1 y 2: valor mensual arriba, anual con label de color
                abajo en segunda línea (Opción 1 seleccionada)
            ================================================================ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* ── TARJETA 1: COSTO MENSUAL REAL ────────────────────────────
                  Fuente: monthly_cost  →  lo que realmente se paga cada mes
                  Anual:  monthlyReal × 12
              ─────────────────────────────────────────────────────────────── */}
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Costo Mensual Real</p>
                      <p className="text-3xl font-bold text-foreground mt-1" data-testid="text-monthly-real">
                        ${isDashboardLoading ? "..." : fmt(monthlyReal)}
                      </p>
                      {/* Línea divisoria más sutil y corta */}
                      <div className="w-12 h-px bg-border my-3"></div>
                      <p className="text-xs font-medium text-muted-foreground tracking-wide">Costo Anual Real</p>
                      <p className="text-2xl font-bold text-foreground mt-1" data-testid="text-annual-real">
                        ${isDashboardLoading ? "..." : fmt(annualReal)}
                      </p>
                    </div>
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "#E6F1FB" }}
                    >
                      <DollarSign className="w-6 h-6" style={{ color: "#185FA5" }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── TARJETA 2: COSTO MENSUAL CONTABLE ────────────────────────
                  Fuente: annual_cost ÷ 12  →  valor contable ingresado por usuario
                  Anual:  suma directa de annual_cost
              ─────────────────────────────────────────────────────────────── */}
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Costo Mensual Contable</p>
                      <p className="text-3xl font-bold text-foreground mt-1" data-testid="text-monthly-accounting">
                        ${isDashboardLoading ? "..." : fmt(monthlyAccounting)}
                      </p>
                      {/* Línea divisoria más sutil y corta */}
                      <div className="w-12 h-px bg-border my-3"></div>
                      <p className="text-xs font-medium text-muted-foreground tracking-wide">Costo Anual Contable</p>
                      <p className="text-2xl font-bold text-foreground mt-1" data-testid="text-annual-accounting">
                        ${isDashboardLoading ? "..." : fmt(annualAccounting)}
                      </p>
                    </div>
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "#E1F5EE" }}
                    >
                      <Calendar className="w-6 h-6" style={{ color: "#0F6E56" }} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── TARJETA 3: TOTAL APLICACIONES (sin cambios) ────────────── */}
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Total Aplicaciones</p>
                      <p className="text-3xl font-bold text-foreground mt-1" data-testid="text-applications-count">
                        {isDashboardLoading ? "..." : assets.applications || 0}
                      </p>
                      {/* Línea decorativa sutil para consistencia */}
                      <div className="w-12 h-px bg-border my-3"></div>
                      <div className="flex items-center gap-1">
                        <Plus className="w-3 h-3 text-accent" />
                        <p className="text-xs text-muted-foreground">
                          {newAppsThisMonth} nueva{newAppsThisMonth !== 1 ? 's' : ''} este mes
                        </p>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-chart-3 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Laptop className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── TARJETA 4: EQUIPOS FÍSICOS (sin cambios) ───────────────── */}
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">Equipos Físicos</p>
                      <p className="text-3xl font-bold text-foreground mt-1" data-testid="text-physical-assets-count">
                        {isDashboardLoading ? "..." : assets.physicalAssets || 0}
                      </p>
                      {/* Línea decorativa sutil para consistencia */}
                      <div className="w-12 h-px bg-border my-3"></div>
                      <div className={`flex items-center gap-1 ${assetsInMaintenance > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {assetsInMaintenance > 0
                          ? <AlertTriangle className="w-3 h-3" />
                          : <CheckCircle2 className="w-3 h-3 text-accent" />}
                        <p className="text-xs">
                          {assetsInMaintenance === 0
                            ? "Todos operativos"
                            : `${assetsInMaintenance} en mantenimiento`}
                        </p>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-chart-4 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Server className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* ── FIN TARJETAS ──────────────────────────────────────────────── */}

            {/* Plan Usage Card */}
            {selectedCompany && (
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Crown className="w-5 h-5 mr-2 text-yellow-500" />
                    Plan {getPlanDisplayName(selectedCompany.company.plan)}
                  </CardTitle>
                  <CardDescription>Uso actual vs límites del plan</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Activos Físicos</span>
                        <span>{assets.physicalAssets || 0} / {getPlanLimits(selectedCompany.company.plan).maxAssets}</span>
                      </div>
                      <Progress value={getUsagePercentage(selectedCompany.company.plan, "assets", assets.physicalAssets || 0)} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Aplicaciones</span>
                        <span>{assets.applications || 0} / {getPlanLimits(selectedCompany.company.plan).maxApplications}</span>
                      </div>
                      <Progress value={getUsagePercentage(selectedCompany.company.plan, "applications", assets.applications || 0)} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Contratos</span>
                        <span>{assets.contracts || 0} / {getPlanLimits(selectedCompany.company.plan).maxContracts}</span>
                      </div>
                      <Progress value={getUsagePercentage(selectedCompany.company.plan, "contracts", (dashboardData as any)?.contracts || 0)} className="h-2" />
                    </div>
                  </div>
                  {selectedCompany.company.plan === 'professional' && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        💡 Actualiza a PyME para más límites y funciones avanzadas como técnicos asignados
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Service Expiry Alerts */}
            {expiringServices.length > 0 && (
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center text-warning">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    Alertas de Servicios
                  </CardTitle>
                  <CardDescription>Servicios que expiran en los próximos 30 días</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {expiringServices.slice(0, 5).map((alert, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${alert.type === 'expired'
                          ? 'border-destructive bg-destructive/10'
                          : alert.priority === 'high'
                            ? 'border-warning bg-warning/10'
                            : 'border-yellow-500 bg-yellow-500/10'}`}
                        data-testid={`alert-${alert.type}-${index}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{alert.service} - {alert.app}</p>
                            <p className="text-xs text-muted-foreground">
                              {alert.type === 'expired'
                                ? `Expiró el ${alert.date.toLocaleDateString('es-ES')}`
                                : `Expira en ${alert.daysLeft} día${alert.daysLeft > 1 ? 's' : ''}`}
                            </p>
                          </div>
                          <Badge
                            variant={alert.type === 'expired' ? 'destructive' : 'secondary'}
                            className={alert.type === 'expired' ? '' : 'bg-warning text-warning-foreground'}
                          >
                            {alert.type === 'expired' ? 'EXPIRADO' : 'PRÓXIMO A VENCER'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {expiringServices.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        Y {expiringServices.length - 5} alerta{expiringServices.length - 5 > 1 ? 's' : ''} más...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Distribución de Costos Mensuales</CardTitle>
                    <Button variant="ghost" size="sm" data-testid="button-export-costs">
                      <Download className="w-4 h-4 mr-1" />
                      Exportar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <CostPieChart data={costs} loading={isDashboardLoading} />
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Tendencia de Costos (12 meses)</CardTitle>
                    <select
                      className="text-xs px-2 py-1 border border-border rounded text-foreground bg-background"
                      onChange={(e) => { }}
                    >
                      <option>Últimos 12 meses</option>
                      <option>Este año</option>
                      <option>Año anterior</option>
                    </select>
                  </div>
                </CardHeader>
                <CardContent>
                  <TrendLineChart companyId={selectedCompanyId} costs={costs} />
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="border-border">
                <CardHeader><CardTitle>Acciones Rápidas</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-between h-auto p-3"
                    onClick={() => setShowAddAssetModal(true)} data-testid="button-add-asset">
                    <div className="flex items-center">
                      <Plus className="w-4 h-4 text-accent mr-3" />
                      <span className="text-sm font-medium">Agregar Activo</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="w-full justify-between h-auto p-3"
                    onClick={handleGenerateReport} data-testid="button-generate-report">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-chart-3 mr-3" />
                      <span className="text-sm font-medium">Generar Reporte</span>
                    </div>
                  </Button>
                  <Button variant="outline" className="w-full justify-between h-auto p-3"
                    onClick={handleScheduleMaintenance} data-testid="button-schedule-maintenance">
                    <div className="flex items-center">
                      <CalendarPlus className="w-4 h-4 text-chart-2 mr-3" />
                      <span className="text-sm font-medium">Programar Mantenimiento</span>
                    </div>
                  </Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Actividad Reciente</CardTitle>
                    <Button variant="link" size="sm" className="text-primary h-auto p-0" data-testid="link-view-all-activity">
                      Ver todo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {isActivityLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-start space-x-3">
                          <Skeleton className="w-8 h-8 rounded-full" />
                          <div className="flex-1 space-y-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/4" />
                          </div>
                        </div>
                      ))
                    ) : (recentActivity as any[]).length > 0 ? (
                      (recentActivity as any[]).map((activity: any, index: number) => (
                        <div key={activity.id} className="flex items-start space-x-3" data-testid={`activity-${index}`}>
                          <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                            <Plus className="w-3 h-3 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">
                              <span className="font-medium">{activity.user?.firstName} {activity.user?.lastName}</span>
                              {" "}
                              {activity.action === "created" ? "agregó" :
                                activity.action === "updated" ? "actualizó" :
                                  activity.action === "deleted" ? "eliminó" : activity.action}
                              {" "}
                              <span className="font-medium">{activity.entityName}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(activity.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No hay actividad reciente</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        </main>
      </div>

      <AddAssetModal open={showAddAssetModal} onOpenChange={setShowAddAssetModal} companyId={selectedCompanyId} />

      <Dialog open={showAssetSelectionDialog} onOpenChange={setShowAssetSelectionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Activo</DialogTitle>
            <DialogDescription>
              Selecciona el activo físico para el cual deseas programar el mantenimiento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="asset-select">Activo</Label>
              <select
                id="asset-select"
                className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background text-foreground"
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
              >
                <option value="">Seleccionar activo...</option>
                {physicalAssets.map((asset: any) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} - {asset.model || "Sin modelo"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssetSelectionDialog(false)}>Cancelar</Button>
            <Button onClick={handleAssetSelection} disabled={!selectedAssetId}>Programar Mantenimiento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedAssetForMaintenance && (
        <AddMaintenanceModal
          open={showMaintenanceModal}
          onOpenChange={(open) => {
            setShowMaintenanceModal(open);
            if (!open) setSelectedAssetForMaintenance(null);
          }}
          assetId={selectedAssetForMaintenance.id}
          assetName={selectedAssetForMaintenance.name}
          companyId={selectedCompanyId}
        />
      )}
    </div>
  );
}