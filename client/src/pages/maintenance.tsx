import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import EditMaintenanceModal from "@/components/modals/edit-maintenance-modal";
import AddMaintenanceModal from "@/components/modals/add-maintenance-modal";
import { Plus, Search, Filter, Edit2, Trash2, Wrench, Calendar, CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function Maintenance() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMaintenanceForEdit, setSelectedMaintenanceForEdit] = useState<any>(null);
  const [maintenanceToDelete, setMaintenanceToDelete] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedAssetForMaintenance, setSelectedAssetForMaintenance] = useState<{
    id: string;
    name: string;
  } | null>(null);
  
  // Estado para el diálogo de selección de activo
  const [showAssetSelectionDialog, setShowAssetSelectionDialog] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");

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

  // Query para obtener los assets (necesario para el modal)
  const { data: assetsList = [] } = useQuery({
    queryKey: ["/api/assets", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  // Filter physical assets for maintenance
  const physicalAssets = (assetsList as any[]).filter((asset: any) => asset.type === "physical");

  // Function to handle maintenance scheduling
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
      // Si solo hay un activo, seleccionarlo automáticamente
      const asset = physicalAssets[0];
      setSelectedAssetForMaintenance({
        id: asset.id,
        name: asset.name
      });
      setShowMaintenanceModal(true);
    } else {
      // Si hay múltiples activos, mostrar diálogo de selección
      setShowAssetSelectionDialog(true);
    }
  };

  // Handle asset selection for maintenance
  const handleAssetSelection = () => {
    const selectedAsset = physicalAssets.find(asset => asset.id === selectedAssetId);
    if (selectedAsset) {
      setSelectedAssetForMaintenance({
        id: selectedAsset.id,
        name: selectedAsset.name
      });
      setShowAssetSelectionDialog(false);
      setShowMaintenanceModal(true);
      setSelectedAssetId(""); 
    }
  };

  const { data: maintenanceRecords = [], isLoading: isMaintenanceLoading, error: maintenanceError } = useQuery<any[]>({
    queryKey: ["/api/maintenance", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (maintenanceError && isUnauthorizedError(maintenanceError as Error)) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al inicio de sesión...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [maintenanceError, toast]);

  // Mutation para eliminar mantenimiento
  const deleteMaintenanceMutation = useMutation({
    mutationFn: async ({ maintenanceId, companyId }: { maintenanceId: string; companyId: string }) => {
      return await apiRequest("DELETE", `/api/maintenance/${maintenanceId}/${companyId}`);
    },
    onSuccess: () => {
      toast({
        title: "Mantenimiento eliminado",
        description: "El registro de mantenimiento se ha eliminado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      setShowDeleteDialog(false);
      setMaintenanceToDelete(null);
    },
    onError: (error: any) => {
      console.error("Error deleting maintenance:", error);
      
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
      
      const errorMessage = error.response?.data?.message || error.message || "Error al eliminar el mantenimiento.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Manejar confirmación de eliminación
  const handleDeleteConfirm = () => {
    if (maintenanceToDelete) {
      deleteMaintenanceMutation.mutate({
        maintenanceId: maintenanceToDelete.id,
        companyId: selectedCompanyId,
      });
    }
  };

  // Abrir diálogo de eliminación
  const openDeleteDialog = (maintenance: any) => {
    setMaintenanceToDelete(maintenance);
    setShowDeleteDialog(true);
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="w-32 h-8" />
      </div>
    );
  }

  // Filter by search term
  const filteredRecords = Array.isArray(maintenanceRecords) ? maintenanceRecords.filter((record: any) =>
    record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.maintenance_type.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const scheduledRecords = filteredRecords.filter((r: any) => r.status === "scheduled");
  const inProgressRecords = filteredRecords.filter((r: any) => r.status === "in_progress");
  const completedRecords = filteredRecords.filter((r: any) => r.status === "completed");

  return (
    <div className="flex h-screen">
      <Sidebar 
        selectedCompanyId={selectedCompanyId} 
        onCompanyChange={setSelectedCompanyId} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Mantenimiento de Equipos" 
          subtitle="Programación y seguimiento de mantenimientos"
          selectedCompanyId={selectedCompanyId}
        />
        
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Registros</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-total-maintenance">
                        {isMaintenanceLoading ? "..." : Array.isArray(maintenanceRecords) ? maintenanceRecords.length : 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                      <Wrench className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Programados</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-scheduled-maintenance">
                        {isMaintenanceLoading ? "..." : scheduledRecords.length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-chart-2 rounded-lg flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">En Progreso</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-inprogress-maintenance">
                        {isMaintenanceLoading ? "..." : inProgressRecords.length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-chart-3 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Costo Total</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-maintenance-cost">
                        ${isMaintenanceLoading ? "..." : Array.isArray(maintenanceRecords) ? maintenanceRecords.reduce((sum: number, r: any) => sum + Number(r.cost || 0), 0).toLocaleString() : "0"}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions Bar */}
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Registros de Mantenimiento</CardTitle>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Buscar mantenimientos..."
                        className="pl-10 w-80"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        data-testid="input-search-maintenance"
                      />
                    </div>
                    <Button variant="outline" data-testid="button-filters">
                      <Filter className="w-4 h-4 mr-2" />
                      Filtros
                    </Button>
                    <Button 
                      onClick={handleScheduleMaintenance}
                      data-testid="button-add-maintenance"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Programar Mantenimiento
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Maintenance Tabs */}
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all" data-testid="tab-all-maintenance">Todos</TabsTrigger>
                    <TabsTrigger value="scheduled" data-testid="tab-scheduled-maintenance">Programados</TabsTrigger>
                    <TabsTrigger value="in_progress" data-testid="tab-inprogress-maintenance">En Progreso</TabsTrigger>
                    <TabsTrigger value="completed" data-testid="tab-completed-maintenance">Completados</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="all" className="mt-4">
                    <MaintenanceTable 
                      records={filteredRecords} 
                      loading={isMaintenanceLoading}
                      onEdit={setSelectedMaintenanceForEdit}
                      onDelete={openDeleteDialog}
                    />
                  </TabsContent>
                  
                  <TabsContent value="scheduled" className="mt-4">
                    <MaintenanceTable 
                      records={scheduledRecords} 
                      loading={isMaintenanceLoading}
                      onEdit={setSelectedMaintenanceForEdit}
                      onDelete={openDeleteDialog}
                    />
                  </TabsContent>
                  
                  <TabsContent value="in_progress" className="mt-4">
                    <MaintenanceTable 
                      records={inProgressRecords} 
                      loading={isMaintenanceLoading}
                      onEdit={setSelectedMaintenanceForEdit}
                      onDelete={openDeleteDialog}
                    />
                  </TabsContent>
                  
                  <TabsContent value="completed" className="mt-4">
                    <MaintenanceTable 
                      records={completedRecords} 
                      loading={isMaintenanceLoading}
                      onEdit={setSelectedMaintenanceForEdit}
                      onDelete={openDeleteDialog}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Modal para editar mantenimiento */}
      {selectedMaintenanceForEdit && (
        <EditMaintenanceModal
          open={!!selectedMaintenanceForEdit}
          onOpenChange={(open) => !open && setSelectedMaintenanceForEdit(null)}
          maintenance={selectedMaintenanceForEdit}
          companyId={selectedCompanyId}
        />
      )}

      {/*Diálogo de selección de activo */}
      <Dialog open={showAssetSelectionDialog} onOpenChange={setShowAssetSelectionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Activo</DialogTitle>
            <DialogDescription>
              Selecciona el activo físico para el cual desea programar el mantenimiento.
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
            <Button
              variant="outline"
              onClick={() => setShowAssetSelectionDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAssetSelection}
              disabled={!selectedAssetId}
            >
              Programar Mantenimiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*Modal para agregar mantenimiento */}
      {selectedAssetForMaintenance && (
        <AddMaintenanceModal
          open={showMaintenanceModal}
          onOpenChange={(open) => {
            setShowMaintenanceModal(open);
            if (!open) {
              setSelectedAssetForMaintenance(null);
            }
          }}
          assetId={selectedAssetForMaintenance.id}
          assetName={selectedAssetForMaintenance.name}
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
              ¿Estás seguro de que deseas eliminar este registro de mantenimiento?
              <br />
              <strong>{maintenanceToDelete?.description}</strong>
              <br />
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteMaintenanceMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMaintenanceMutation.isPending}
            >
              {deleteMaintenanceMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MaintenanceTableProps {
  records: any[];
  loading: boolean;
  onEdit: (maintenance: any) => void;
  onDelete: (maintenance: any) => void;
}

function MaintenanceTable({ records, loading, onEdit, onDelete }: MaintenanceTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-accent text-accent-foreground">Completado</Badge>;
      case "in_progress":
        return <Badge className="bg-chart-3 text-white">En Progreso</Badge>;
      case "scheduled":
        return <Badge className="bg-chart-2 text-white">Programado</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMaintenanceTypeBadge = (type: string) => {
    switch (type) {
      case "preventive":
        return <Badge className="bg-accent text-accent-foreground">Preventivo</Badge>;
      case "corrective":
        return <Badge className="bg-chart-3 text-white">Correctivo</Badge>;
      case "emergency":
        return <Badge className="bg-destructive text-destructive-foreground">Emergencia</Badge>;
      case "upgrade":
        return <Badge className="bg-chart-2 text-white">Actualización</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descripción</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Fecha Programada</TableHead>
            <TableHead>Fecha Completada</TableHead>
            <TableHead>Costo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : records.length > 0 ? (
            records.map((record: any) => (
              <TableRow key={record.id} data-testid={`row-maintenance-${record.id}`}>
                <TableCell className="font-medium" data-testid="text-maintenance-description">
                  {record.description}
                </TableCell>
                <TableCell>
                  {getMaintenanceTypeBadge(record.maintenance_type)}
                </TableCell>
                <TableCell>{record.vendor || "N/A"}</TableCell>
                <TableCell>{formatDate(record.scheduled_date)}</TableCell>
                <TableCell>{formatDate(record.completed_date)}</TableCell>
                <TableCell>${Number(record.cost || 0).toLocaleString()}</TableCell>
                <TableCell>
                  {getStatusBadge(record.status)}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onEdit(record)}
                      data-testid={`button-edit-${record.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:text-destructive" 
                      onClick={() => onDelete(record)}
                      data-testid={`button-delete-${record.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wrench className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No se encontraron registros
                </h3>
                <p className="text-muted-foreground mb-6">
                  No hay registros de mantenimiento para mostrar.
                </p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
