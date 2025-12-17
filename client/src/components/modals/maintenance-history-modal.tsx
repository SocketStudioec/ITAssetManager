import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Wrench } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface MaintenanceHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string | null;
  assetName?: string;
  companyId: string;
}

export default function MaintenanceHistoryModal({
  open,
  onOpenChange,
  assetId,
  assetName,
  companyId,
}: MaintenanceHistoryModalProps) {
  // Get maintenance records for selected asset
  const { data: maintenanceRecords = [], isLoading: isMaintenanceLoading } = useQuery<any[]>({
    queryKey: ["/api/maintenance/asset", assetId, companyId],
    enabled: !!assetId && !!companyId && open,
  });

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

  const getMaintenanceStatusBadge = (status: string) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Historial de Mantenimientos</DialogTitle>
          <DialogDescription>
            {assetName 
              ? `Todos los mantenimientos registrados para ${assetName}` 
              : "Todos los mantenimientos registrados para este activo"
            }
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
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
                <Card key={record.id} className="border-border hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground mb-1">
                          {record.title || record.description}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {record.description}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {getMaintenanceTypeBadge(record.maintenanceType)}
                        {getMaintenanceStatusBadge(record.status)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {record.scheduled_date && (
                        <div>
                          <span className="text-muted-foreground">Programado:</span>
                          <span className="ml-2 text-foreground font-medium">
                            {format(new Date(record.scheduled_date), "PPP", { locale: es })}
                          </span>
                        </div>
                      )}
                      {record.completed_date && (
                        <div>
                          <span className="text-muted-foreground">Completado:</span>
                          <span className="ml-2 text-foreground font-medium">
                            {format(new Date(record.completed_date), "PPP", { locale: es })}
                          </span>
                        </div>
                      )}
                      {record.vendor && (
                        <div>
                          <span className="text-muted-foreground">Proveedor:</span>
                          <span className="ml-2 text-foreground font-medium">{record.vendor}</span>
                        </div>
                      )}
                      {record.technician && (
                        <div>
                          <span className="text-muted-foreground">Técnico:</span>
                          <span className="ml-2 text-foreground font-medium">{record.technician}</span>
                        </div>
                      )}
                      {record.cost > 0 && (
                        <div>
                          <span className="text-muted-foreground">Costo:</span>
                          <span className="ml-2 text-foreground font-medium">
                            ${Number(record.cost).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {record.time_spent && (
                        <div>
                          <span className="text-muted-foreground">Tiempo:</span>
                          <span className="ml-2 text-foreground font-medium">
                            {record.time_spent} horas
                          </span>
                        </div>
                      )}
                    </div>

                    {record.parts_replaced && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Partes Reemplazadas:</p>
                        <p className="text-sm text-foreground">{record.parts_replaced}</p>
                      </div>
                    )}

                    {record.notes && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Notas:</p>
                        <p className="text-sm text-foreground">{record.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wrench className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No hay registros de mantenimiento
                </h3>
                <p className="text-muted-foreground mb-6">
                  Este activo no tiene mantenimientos registrados aún.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <DialogFooter className="border-t pt-4">
          <Button onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}