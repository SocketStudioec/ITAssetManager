import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import AddAssetModal from "@/components/modals/add-asset-modal";
import EditAssetModal from "@/components/modals/edit-asset-modal";
import { Plus, Search, Filter, Edit2, Trash2, Eye, Wrench, Calendar, AlertTriangle } from "lucide-react";

export default function PhysicalAssets() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssetForMaintenance, setSelectedAssetForMaintenance] = useState<string | null>(null);
  
  // Estados para edición y eliminación
  const [selectedAssetForEdit, setSelectedAssetForEdit] = useState<any>(null);
  const [assetToDelete, setAssetToDelete] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Get maintenance records for selected asset
  const { data: maintenanceRecords = [], isLoading: isMaintenanceLoading } = useQuery<any[]>({
    queryKey: ["/api/maintenance/asset", selectedAssetForMaintenance, selectedCompanyId],
    enabled: !!selectedAssetForMaintenance && !!selectedCompanyId,
  });

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

  // Use support company or user companies
  const companies = supportStatus?.supportMode 
    ? [{ company: supportStatus.company }] 
    : userCompanies;

  // Set default company when companies are loaded
  useEffect(() => {
    if (Array.isArray(companies) && companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].company.id);
    }
  }, [companies, selectedCompanyId]);

  const { data: assets = [], isLoading: isAssetsLoading, error: assetsError } = useQuery<any[]>({
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

  // Mutation para eliminar activo
  const deleteAssetMutation = useMutation({
    mutationFn: async ({ assetId, companyId }: { assetId: string; companyId: string }) => {
      const response = await apiRequest("DELETE", `/api/assets/${assetId}/${companyId}`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Activo eliminado",
        description: "El activo se ha eliminado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setShowDeleteDialog(false);
      setAssetToDelete(null);
    },
    onError: (error: any) => {
      console.error("Error deleting asset:", error);
      
      if (isUnauthorizedError(error as Error)) {
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
      
      const errorMessage = error.response?.data?.message || error.message || "Error al eliminar el activo.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Manejar confirmación de eliminación
  const handleDeleteConfirm = () => {
    if (assetToDelete) {
      deleteAssetMutation.mutate({
        assetId: assetToDelete.id,
        companyId: selectedCompanyId,
      });
    }
  };

  // Abrir diálogo de eliminación
  const openDeleteDialog = (asset: any) => {
    setAssetToDelete(asset);
    setShowDeleteDialog(true);
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="w-32 h-8" />
      </div>
    );
  }

  // Filter physical assets only
  const physicalAssets = Array.isArray(assets) ? assets.filter((asset: any) => asset.type === "physical") : [];
  
  // Filter by search term
  const filteredAssets = physicalAssets.filter((asset: any) =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.model?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-accent text-accent-foreground">Activo</Badge>;
      case "maintenance":
        return <Badge className="bg-chart-3 text-white">Mantenimiento</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactivo</Badge>;
      case "deprecated":
        return <Badge className="bg-chart-4 text-white">Obsoleto</Badge>;
      case "disposed":
        return <Badge className="bg-chart-4 text-white">Desechado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar 
        selectedCompanyId={selectedCompanyId} 
        onCompanyChange={setSelectedCompanyId} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Activos Físicos" 
          subtitle="Gestión de equipos y hardware"
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
                    placeholder="Buscar activos físicos..."
                    className="pl-10 w-80"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-search-assets"
                  />
                </div>
                <Button variant="outline" data-testid="button-filters">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtros
                </Button>
              </div>
              <Button 
                onClick={() => setShowAddAssetModal(true)}
                disabled={!selectedCompanyId}
                data-testid="button-add-physical-asset"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Activo
              </Button>
            </div>

            {/* Assets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {isAssetsLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-6">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2 mb-4" />
                      <Skeleton className="h-8 w-full mb-2" />
                      <Skeleton className="h-6 w-20" />
                    </CardContent>
                  </Card>
                ))
              ) : filteredAssets.length > 0 ? (
                filteredAssets.map((asset: any) => (
                  <Card key={asset.id} className="border-border hover:shadow-md transition-shadow" data-testid={`card-asset-${asset.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-1" data-testid="text-asset-name">
                            {asset.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {asset.manufacturer} {asset.model}
                          </p>
                        </div>
                        {getStatusBadge(asset.status)}
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Serial:</span>
                          <span className="text-foreground font-medium">{asset.serial_number || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ubicación:</span>
                          <span className="text-foreground font-medium">{asset.location || "N/A"}</span>
                        </div>
                        {asset.assignedTo && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Asignado a:</span>
                            <span className="text-foreground font-medium">{asset.assignedTo}</span>
                          </div>
                        )}
                        {asset.warrantyExpiry && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Garantía:</span>
                            <span className={`font-medium ${
                              new Date(asset.warrantyExpiry) < new Date() 
                                ? 'text-destructive' 
                                : new Date(asset.warrantyExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                                  ? 'text-chart-4' 
                                  : 'text-foreground'
                            }`}>
                              {new Date(asset.warrantyExpiry).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Costo Mensual:</span>
                          <span className="text-foreground font-medium">
                            ${Number(asset.monthly_cost || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center">
                            <Wrench className="w-3 h-3 mr-1" />
                            Último Mantenimiento
                          </span>
                          <span className="text-foreground font-medium">
                            {/* Esta información vendrá del historial de mantenimientos */}
                            Hace 2 meses
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="sm" data-testid={`button-view-${asset.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setSelectedAssetForEdit(asset)}
                              data-testid={`button-edit-${asset.id}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setSelectedAssetForMaintenance(asset.id)}
                              data-testid={`button-maintenance-${asset.id}`}
                            >
                              <Calendar className="w-4 h-4" />
                            </Button>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:text-destructive" 
                            onClick={() => openDeleteDialog(asset)}
                            data-testid={`button-delete-${asset.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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
                        No se encontraron activos físicos
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        {searchTerm ? "No hay activos que coincidan con tu búsqueda." : "Comienza agregando tu primer activo físico."}
                      </p>
                      <Button 
                        onClick={() => setShowAddAssetModal(true)}
                        data-testid="button-add-first-asset"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Primer Activo
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modal para agregar activo */}
      <AddAssetModal
        open={showAddAssetModal}
        onOpenChange={setShowAddAssetModal}
        companyId={selectedCompanyId}
        key={selectedCompanyId}
      />

      {/* Modal para editar activo */}
      {selectedAssetForEdit && (
        <EditAssetModal
          open={!!selectedAssetForEdit}
          onOpenChange={(open) => !open && setSelectedAssetForEdit(null)}
          asset={selectedAssetForEdit}
          companyId={selectedCompanyId}
        />
      )}

      {/* Diálogo de confirmación para eliminar */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar Eliminación
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el activo <strong>{assetToDelete?.name}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteAssetMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteAssetMutation.isPending}
            >
              {deleteAssetMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance History Modal */}
      <Dialog 
        open={!!selectedAssetForMaintenance} 
        onOpenChange={() => setSelectedAssetForMaintenance(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Historial de Mantenimientos</DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-4">
              {isMaintenanceLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-1/3 mb-2" />
                      <Skeleton className="h-3 w-full mb-2" />
                      <Skeleton className="h-3 w-2/3" />
                    </CardContent>
                  </Card>
                ))
              ) : Array.isArray(maintenanceRecords) && maintenanceRecords.length > 0 ? (
                maintenanceRecords.map((record: any) => (
                  <Card key={record.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{record.title || record.description}</h4>
                        <Badge>{record.maintenanceType}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{record.description}</p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8">
                  <Wrench className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No hay registros de mantenimiento</p>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline">Agregar Mantenimiento</Button>
            <Button onClick={() => setSelectedAssetForMaintenance(null)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
