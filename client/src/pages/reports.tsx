import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CostPieChart from "@/components/charts/cost-pie-chart";
import TrendLineChart from "@/components/charts/trend-line-chart";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Download, 
  FileText, 
  PieChart, 
  BarChart3, 
  TrendingUp,
  Calendar,
  DollarSign,
  Package
} from "lucide-react";

// LIBRERÍAS DE EXPORTACIÓN (Nuevas)
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Reports() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [reportPeriod, setReportPeriod] = useState("monthly");

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al inicio de sesión...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Check if we're in support mode
  const { data: supportStatus } = useQuery({
    queryKey: ["/api/admin/support-status"],
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 10000,
  });

  const { data: userCompanies = [] } = useQuery({
    queryKey: ["/api/companies"],
    enabled: isAuthenticated && !supportStatus?.supportMode,
  });

  // Use support company or user companies
  const companies = supportStatus?.supportMode 
    ? [{ company: supportStatus.company }] 
    : userCompanies;

  // Set default company when companies are loaded
  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].company.id);
    }
  }, [companies, selectedCompanyId]);

  const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useQuery({
    queryKey: ["/api/dashboard", selectedCompanyId, "summary"],
    enabled: !!selectedCompanyId,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ["/api/assets", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["/api/contracts", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ["/api/licenses", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (dashboardError && isUnauthorizedError(dashboardError as Error)) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al inicio de sesión...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [dashboardError, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="w-32 h-8" />
      </div>
    );
  }

  const costs = dashboardData?.costs || {};
  const assetCounts = dashboardData?.assets || {};

  // Asset summary by category
  const assetsByCategory = [
    {
      category: "Equipos Físicos",
      count: assets.filter((a: any) => a.type === "physical").length,
      cost: assets.filter((a: any) => a.type === "physical").reduce((sum: number, a: any) => sum + Number(a.monthly_cost || 0), 0),
      status: "Activo"
    },
    {
      category: "Aplicaciones",
      count: assets.filter((a: any) => a.type === "application").length,
      cost: assets.filter((a: any) => a.type === "application").reduce((sum: number, a: any) => sum + Number(a.monthly_cost || 0), 0),
      status: "Activo"
    },
    {
      category: "Licencias",
      count: licenses.length,
      cost: licenses.reduce((sum: number, l: any) => sum + Number(l.monthly_cost || 0), 0),
      status: "Activo"
    },
    {
      category: "Contratos",
      count: contracts.length,
      cost: contracts.reduce((sum: number, c: any) => sum + Number(c.monthly_cost || 0), 0),
      status: "Activo"
    }
  ];

  // ==========================================
  // NUEVA LÓGICA DE EXPORTACIÓN (PDF y Excel)
  // ==========================================
  const handleExportReport = (type: string) => {
    toast({
      title: "Generando reporte...",
      description: `Preparando archivo ${type === 'Excel' || type === 'detailed' ? 'Excel' : 'PDF'}. Por favor espera.`,
    });

    try {
      const fechaActual = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');

      if (type === "Excel" || type === "detailed") {
        // --- CREAR EXCEL ---
        const wb = XLSX.utils.book_new();

        // Pestaña 1: Resumen
        const dataResumen = assetsByCategory.map(item => ({
          Categoría: item.category,
          Cantidad: item.count,
          "Costo Mensual": `$${item.cost}`,
          "Costo Anual Estimado": `$${item.cost * 12}`,
          Estado: item.status
        }));
        const wsResumen = XLSX.utils.json_to_sheet(dataResumen);
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen General");

        // Si es el reporte detallado, añadimos pestañas extra con los datos crudos
        if (type === "detailed") {
           // Creamos una hoja extra para los contratos
           const dataContratos = contracts.map((c: any) => ({
             Nombre: c.name, Proveedor: c.vendor, Tipo: c.contractType, Costo: c.monthlyCost, Estado: c.status
           }));
           if(dataContratos.length > 0) {
             XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataContratos), "Contratos Detalle");
           }
        }

        // Forzar Descarga
        XLSX.writeFile(wb, `Reporte_Costos_TI_${fechaActual}.xlsx`);

      } else {
        // --- CREAR PDF --- (Aplica para "PDF", "summary" o "forecast")
        const doc = new jsPDF();
        
        // Título del documento
        doc.setFontSize(18);
        doc.text(`Reporte de Activos y Costos TI`, 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Fecha de generación: ${fechaActual}`, 14, 30);
        doc.text(`Período analizado: ${reportPeriod === "monthly" ? "Mensual" : reportPeriod === "quarterly" ? "Trimestral" : "Anual"}`, 14, 36);

        // Columnas y Filas para la tabla
        const tableColumn = ["Categoría", "Cantidad", "Costo Mensual", "Costo Anual Estimado", "Estado"];
        const tableRows = assetsByCategory.map(item => [
          item.category,
          item.count,
          `$${item.cost.toLocaleString()}`,
          `$${(item.cost * 12).toLocaleString()}`,
          item.status
        ]);

        // Dibujar tabla
        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 45,
          theme: 'grid',
          headStyles: { fillColor: [15, 23, 42] } // Color oscuro para que combine con shadcn
        });

        // Forzar Descarga
        doc.save(`Reporte_Ejecutivo_TI_${fechaActual}.pdf`);
      }

      toast({
        title: "¡Reporte Exportado!",
        description: "El archivo se ha descargado correctamente en tu equipo.",
      });

    } catch (error) {
      console.error(error);
      toast({
        title: "Error de Exportación",
        description: "Hubo un problema al generar el archivo.",
        variant: "destructive"
      });
    }
  };
  // ==========================================

  return (
    <div className="flex h-screen">
      <Sidebar 
        selectedCompanyId={selectedCompanyId} 
        onCompanyChange={setSelectedCompanyId} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Reportes y Análisis" 
          subtitle="Informes detallados de costos y activos" 
        />
        
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 space-y-6">
            {/* Report Controls */}
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Configuración de Reportes</CardTitle>
                  <div className="flex items-center space-x-4">
                    <Select value={reportPeriod} onValueChange={setReportPeriod}>
                      <SelectTrigger className="w-48" data-testid="select-report-period">
                        <SelectValue placeholder="Seleccionar período" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensual</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="annual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => handleExportReport("PDF")} data-testid="button-export-pdf">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar PDF
                    </Button>
                    <Button variant="outline" onClick={() => handleExportReport("Excel")} data-testid="button-export-excel">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Activos</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-total-assets-report">
                        {isDashboardLoading ? "..." : (assetCounts.totalAssets || 0) + (assetCounts.licenses || 0) + (assetCounts.contracts || 0)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Costo Total {reportPeriod === "monthly" ? "Mensual" : reportPeriod === "quarterly" ? "Trimestral" : "Anual"}</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-total-cost-report">
                        ${isDashboardLoading ? "..." : (reportPeriod === "quarterly" ? (costs.monthlyTotal * 3) : reportPeriod === "annual" ? costs.annualTotal : costs.monthlyTotal)?.toLocaleString() || "0"}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-chart-2 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Promedio por Activo</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-average-cost-report">
                        ${isDashboardLoading ? "..." : Math.round((costs.monthlyTotal || 0) / Math.max((assetCounts.totalAssets || 0) + (assetCounts.licenses || 0) + (assetCounts.contracts || 0), 1)).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-chart-3 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Último Reporte</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-last-report">
                        {/* Nuevo formato: Ej. "05 Mar 2026" */}
                        {new Date().toLocaleDateString('es-ES', { 
                          day: '2-digit', 
                          month: 'short', 
                          year: 'numeric' 
                        }).replace('.', '')}
                      </p>
                      {/* Agregamos la hora en formato pequeño debajo */}
                      <p className="text-xs text-muted-foreground mt-1">
                        Generado hoy a las {new Date().toLocaleTimeString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-chart-4 rounded-lg flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Report Tabs */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" data-testid="tab-overview">Resumen</TabsTrigger>
                <TabsTrigger value="costs" data-testid="tab-costs">Análisis de Costos</TabsTrigger>
                <TabsTrigger value="assets" data-testid="tab-assets">Inventario de Activos</TabsTrigger>
                <TabsTrigger value="trends" data-testid="tab-trends">Tendencias</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle>Distribución de Costos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CostPieChart data={costs} loading={isDashboardLoading} />
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle>Resumen por Categoría</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {assetsByCategory.map((category, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg" data-testid={`category-summary-${index}`}>
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                                <Package className="w-5 h-5 text-primary-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{category.category}</p>
                                <p className="text-sm text-muted-foreground">{category.count} elementos</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-foreground">${category.cost.toLocaleString()}/mes</p>
                              <Badge className="bg-accent text-accent-foreground">{category.status}</Badge>
                            </div>
                          </div>  
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="costs" className="mt-6">
                <div className="space-y-6">
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle>Análisis Detallado de Costos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <CostPieChart data={costs} loading={isDashboardLoading} />
                        <TrendLineChart companyId={selectedCompanyId} costs={costs} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="assets" className="mt-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Inventario Detallado de Activos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Cantidad</TableHead>
                            <TableHead>Costo Mensual</TableHead>
                            <TableHead>Costo Anual</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>% del Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assetsByCategory.map((category, index) => {
                            const percentage = ((category.cost / (costs.monthlyTotal || 1)) * 100).toFixed(1);
                            return (
                              <TableRow key={index} data-testid={`asset-category-row-${index}`}>
                                <TableCell className="font-medium">{category.category}</TableCell>
                                <TableCell>{category.count}</TableCell>
                                <TableCell>${category.cost.toLocaleString()}</TableCell>
                                <TableCell>${(category.cost * 12).toLocaleString()}</TableCell>
                                <TableCell>
                                  <Badge className="bg-accent text-accent-foreground">{category.status}</Badge>
                                </TableCell>
                                <TableCell>{percentage}%</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trends" className="mt-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Análisis de Tendencias</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-96">
                      <TrendLineChart companyId={selectedCompanyId} costs={costs} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Quick Report Actions */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Acciones Rápidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-auto p-4" onClick={() => handleExportReport("summary")} data-testid="button-export-summary">
                    <div className="flex flex-col items-center space-y-2">
                      <FileText className="w-8 h-8 text-primary" />
                      <div className="text-center">
                        <p className="font-medium">Reporte Ejecutivo</p>
                        <p className="text-sm text-muted-foreground">Resumen para gerencia</p>
                      </div>
                    </div>
                  </Button>

                  <Button variant="outline" className="h-auto p-4" onClick={() => handleExportReport("detailed")} data-testid="button-export-detailed">
                    <div className="flex flex-col items-center space-y-2">
                      <PieChart className="w-8 h-8 text-chart-2" />
                      <div className="text-center">
                        <p className="font-medium">Análisis Detallado</p>
                        <p className="text-sm text-muted-foreground">Reporte técnico completo en Excel</p>
                      </div>
                    </div>
                  </Button>

                  <Button variant="outline" className="h-auto p-4" onClick={() => handleExportReport("forecast")} data-testid="button-export-forecast">
                    <div className="flex flex-col items-center space-y-2">
                      <BarChart3 className="w-8 h-8 text-chart-3" />
                      <div className="text-center">
                        <p className="font-medium">Proyección de Costos</p>
                        <p className="text-sm text-muted-foreground">Análisis predictivo en PDF</p>
                      </div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}