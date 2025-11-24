import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AddAssetModal from "@/components/modals/add-asset-modal";
import { Plus, Search, Filter, Edit2, Trash2, Eye, ExternalLink, AlertTriangle, Calendar } from "lucide-react";

export default function Applications() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
  console.log("Aqui estoy modificando id", selectedCompanyId)

  const { data: assets = [], isLoading: isAssetsLoading, error: assetsError } = useQuery({
    queryKey: ["/api/assets", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (assetsError && isUnauthorizedError(assetsError as Error)) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al inicio de sesión...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [assetsError, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="w-32 h-8" />
      </div>
    );
  }

  // Filter application assets only
  const applications = assets.filter((asset: any) => asset.type === "application");
  
  // Filter by search term
  const filteredApplications = applications.filter((app: any) =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-accent text-accent-foreground">Activo</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactivo</Badge>;
      case "deprecated":
        return <Badge className="bg-chart-4 text-white">Obsoleto</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getExpiryWarning = (app: any) => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const expiries = [
      { name: 'Dominio', date: app.domainExpiry },
      { name: 'SSL', date: app.sslExpiry },
      { name: 'Hosting', date: app.hostingExpiry },
      { name: 'Servidor', date: app.serverExpiry }
    ].filter(item => item.date);
    
    const expired = expiries.filter(item => new Date(item.date) < now);
    const expiringSoon = expiries.filter(item => {
      const date = new Date(item.date);
      return date >= now && date <= thirtyDaysFromNow;
    });
    
    if (expired.length > 0) {
      return { type: 'expired', count: expired.length, items: expired };
    }
    if (expiringSoon.length > 0) {
      return { type: 'expiring', count: expiringSoon.length, items: expiringSoon };
    }
    return null;
  };

  return (
    <div className="flex h-screen">
      <Sidebar 
        selectedCompanyId={selectedCompanyId} 
        onCompanyChange={setSelectedCompanyId} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Aplicaciones" 
          subtitle="Gestión de software y aplicaciones"
          selectedCompanyId={selectedCompanyId}
        />
        
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6">
            {/* Actions Bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar aplicaciones..."
                    className="pl-10 w-80"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-search-applications"
                  />
                </div>
                <Button variant="outline" data-testid="button-filters">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros
                </Button>
              </div>
              <Button 
                onClick={() => setShowAddAssetModal(true)}
                data-testid="button-add-application"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Aplicación
              </Button>
            </div>

            {/* Applications Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isAssetsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-6">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2 mb-4" />
                      <Skeleton className="h-8 w-full mb-2" />
                      <Skeleton className="h-6 w-20" />
                    </CardContent>
                  </Card>
                ))
              ) : filteredApplications.length > 0 ? (
                filteredApplications.map((app: any) => (
                  <Card key={app.id} className={`border-border hover:shadow-md transition-shadow ${
                    getExpiryWarning(app)?.type === 'expired' ? 'border-destructive' :
                    getExpiryWarning(app)?.type === 'expiring' ? 'border-chart-4' : ''
                  }`} data-testid={`card-application-${app.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold text-foreground" data-testid="text-application-name">
                              {app.name}
                            </h3>
                            {getExpiryWarning(app) && (
                              <AlertTriangle className={`w-4 h-4 ${
                                getExpiryWarning(app)?.type === 'expired' ? 'text-destructive' : 'text-chart-4'
                              }`} title={`${getExpiryWarning(app)?.count} servicio(s) ${getExpiryWarning(app)?.type === 'expired' ? 'expirado(s)' : 'próximo(s) a expirar'}`} />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {app.description}
                          </p>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                          {getStatusBadge(app.status)}
                          {getExpiryWarning(app) && (
                            <Badge variant={getExpiryWarning(app)?.type === 'expired' ? 'destructive' : 'outline'} className="text-xs">
                              {getExpiryWarning(app)?.count} {getExpiryWarning(app)?.type === 'expired' ? 'Vencido' : 'Por vencer'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tipo:</span>
                          <span className="text-foreground font-medium">
                            {app.applicationType === 'saas' ? 'SaaS' : 'Desarrollo Propio'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Versión:</span>
                          <span className="text-foreground font-medium">{app.version || app.model || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Desarrollador:</span>
                          <span className="text-foreground font-medium">{app.manufacturer || "N/A"}</span>
                        </div>
                        {app.url && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">URL:</span>
                            <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs truncate max-w-32">
                              {app.url}
                            </a>
                          </div>
                        )}
                        <div className="border-t pt-2 mt-3">
                          <div className="text-xs text-muted-foreground mb-2">Costos Mensuales:</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Aplicación:</span>
                              <span className="text-foreground font-medium">
                                ${Number(app.monthlyCost || 0).toLocaleString()}
                              </span>
                            </div>
                            {(Number(app.domainCost) > 0 || Number(app.sslCost) > 0 || Number(app.hostingCost) > 0 || Number(app.serverCost) > 0) && (
                              <>
                                {Number(app.domainCost) > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center">
                                      Dominio
                                      {app.domainExpiry && new Date(app.domainExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                                        <AlertTriangle className="w-3 h-3 ml-1 text-chart-4" />
                                      )}
                                    </span>
                                    <div className="text-right">
                                      <div className="text-foreground font-medium">
                                        ${Number(app.domainCost).toLocaleString()}
                                      </div>
                                      {app.domainExpiry && (
                                        <div className={`text-xs ${
                                          new Date(app.domainExpiry) < new Date() ? 'text-destructive' :
                                          new Date(app.domainExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'text-chart-4' :
                                          'text-muted-foreground'
                                        }`}>
                                          {new Date(app.domainExpiry).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {Number(app.sslCost) > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center">
                                      SSL
                                      {app.sslExpiry && new Date(app.sslExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                                        <AlertTriangle className="w-3 h-3 ml-1 text-chart-4" />
                                      )}
                                    </span>
                                    <div className="text-right">
                                      <div className="text-foreground font-medium">
                                        ${Number(app.sslCost).toLocaleString()}
                                      </div>
                                      {app.sslExpiry && (
                                        <div className={`text-xs ${
                                          new Date(app.sslExpiry) < new Date() ? 'text-destructive' :
                                          new Date(app.sslExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'text-chart-4' :
                                          'text-muted-foreground'
                                        }`}>
                                          {new Date(app.sslExpiry).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {Number(app.hostingCost) > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center">
                                      Hosting
                                      {app.hostingExpiry && new Date(app.hostingExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                                        <AlertTriangle className="w-3 h-3 ml-1 text-chart-4" />
                                      )}
                                    </span>
                                    <div className="text-right">
                                      <div className="text-foreground font-medium">
                                        ${Number(app.hostingCost).toLocaleString()}
                                      </div>
                                      {app.hostingExpiry && (
                                        <div className={`text-xs ${
                                          new Date(app.hostingExpiry) < new Date() ? 'text-destructive' :
                                          new Date(app.hostingExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'text-chart-4' :
                                          'text-muted-foreground'
                                        }`}>
                                          {new Date(app.hostingExpiry).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {Number(app.serverCost) > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground flex items-center">
                                      Servidor
                                      {app.serverExpiry && new Date(app.serverExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                                        <AlertTriangle className="w-3 h-3 ml-1 text-chart-4" />
                                      )}
                                    </span>
                                    <div className="text-right">
                                      <div className="text-foreground font-medium">
                                        ${Number(app.serverCost).toLocaleString()}
                                      </div>
                                      {app.serverExpiry && (
                                        <div className={`text-xs ${
                                          new Date(app.serverExpiry) < new Date() ? 'text-destructive' :
                                          new Date(app.serverExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'text-chart-4' :
                                          'text-muted-foreground'
                                        }`}>
                                          {new Date(app.serverExpiry).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                            <div className="flex justify-between col-span-2 pt-1 border-t border-muted">
                              <span className="text-muted-foreground font-medium">Total:</span>
                              <span className="text-foreground font-bold">
                                ${(Number(app.monthlyCost || 0) + Number(app.domainCost || 0) + Number(app.sslCost || 0) + Number(app.hostingCost || 0) + Number(app.serverCost || 0)).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm" data-testid={`button-view-${app.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-edit-${app.id}`}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-access-${app.id}`}>
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" data-testid={`button-delete-${app.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full">
                  <Card className="border-border">
                    <CardContent className="p-12 text-center">
                      <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        No se encontraron aplicaciones
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        {searchTerm ? "No hay aplicaciones que coincidan con tu búsqueda." : "Comienza agregando tu primera aplicación."}
                      </p>
                      <Button 
                        onClick={() => setShowAddAssetModal(true)}
                        data-testid="button-add-first-application"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Primera Aplicación
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <AddAssetModal
        open={showAddAssetModal}
        onOpenChange={setShowAddAssetModal}
        companyId={selectedCompanyId}
      />
    </div>
  );
}
