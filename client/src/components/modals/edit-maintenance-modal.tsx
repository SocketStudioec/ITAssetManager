import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface EditMaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maintenance: any;
  companyId: string;
}

export default function EditMaintenanceModal({
  open,
  onOpenChange,
  maintenance,
  companyId,
}: EditMaintenanceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    maintenanceType: "preventive" as "preventive" | "corrective" | "emergency" | "upgrade",
    status: "scheduled" as "scheduled" | "in_progress" | "completed" | "cancelled",
    priority: "medium",
    vendor: "",
    technician: "",
    cost: "",
    timeSpent: "",
    scheduledDate: undefined as Date | undefined,
    completedDate: undefined as Date | undefined,
    nextMaintenanceDate: undefined as Date | undefined,
    partsReplaced: "",
    notes: "",
  });

  // Cargar datos del mantenimiento cuando el modal se abre
  useEffect(() => {
    if (maintenance && open) {      
      setFormData({
        title: maintenance.title || "",
        description: maintenance.description || "",
        maintenanceType: maintenance.maintenance_type || "preventive",
        status: maintenance.status || "scheduled",
        priority: maintenance.priority || "medium",
        vendor: maintenance.vendor || "",
        technician: maintenance.technician || "",
        cost: maintenance.cost?.toString() || "",
        timeSpent: maintenance.time_spent?.toString() || "",
        scheduledDate: maintenance.scheduled_date ? new Date(maintenance.scheduled_date) : undefined,
        completedDate: maintenance.completed_date ? new Date(maintenance.completed_date) : undefined,
        nextMaintenanceDate: maintenance.next_maintenance_date ? new Date(maintenance.next_maintenance_date) : undefined,
        partsReplaced: maintenance.parts_replaced || "",
        notes: maintenance.notes || "",
      });
    }
  }, [maintenance, open]);

  const updateMaintenanceMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        const response = await apiRequest("PUT", `/api/maintenance/${maintenance.id}/${companyId}`, data);
        return response;
      } catch (error) {
        console.error("Error en la petición:", error);
        throw error;
      }
    },
    onSuccess: (data) => {      
      toast({
        title: "Mantenimiento actualizado",
        description: "El registro de mantenimiento se ha actualizado exitosamente.",
      });
      
      // Invalidar queries para refrescar datos
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance/asset"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Mutation onError ejecutado:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      toast({
        title: "Error al actualizar",
        description: error.response?.data?.message || error.message || "No se pudo actualizar el registro de mantenimiento.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validaciones básicas
    if (!maintenance?.id) {
      console.error("Error: maintenance.id no existe");
      toast({
        title: "Error",
        description: "ID de mantenimiento no encontrado",
        variant: "destructive",
      });
      return;
    }

    if (!companyId) {
      console.error("Error: companyId no existe");
      toast({
        title: "Error", 
        description: "ID de empresa no encontrado",
        variant: "destructive",
      });
      return;
    }

    // Convertir a snake_case para el backend
    const payload = {
      title: formData.title,
      description: formData.description,
      maintenanceType: formData.maintenanceType,
      status: formData.status,
      priority: formData.priority,
      vendor: formData.vendor || null,
      technician: formData.technician || null,
      cost: formData.cost ? parseFloat(formData.cost) : 0,
      timeSpent: formData.timeSpent ? parseFloat(formData.timeSpent) : null,
      scheduledDate: formData.scheduledDate || null,
      completedDate: formData.completedDate || null,
      nextMaintenanceDate: formData.nextMaintenanceDate || null,
      partsReplaced: formData.partsReplaced || null,
      notes: formData.notes || null,
    };
    updateMaintenanceMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Mantenimiento</DialogTitle>
          <DialogDescription>
            Actualizar información del registro de mantenimiento
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Título */}
            <div className="col-span-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Mantenimiento preventivo trimestral"
                required
              />
            </div>

            {/* Descripción */}
            <div className="col-span-2">
              <Label htmlFor="description">Descripción *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción detallada del mantenimiento"
                rows={3}
                required
              />
            </div>

            {/* Tipo de Mantenimiento */}
            <div>
              <Label htmlFor="maintenanceType">Tipo de Mantenimiento *</Label>
              <Select
                value={formData.maintenanceType}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, maintenanceType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preventive">Preventivo</SelectItem>
                  <SelectItem value="corrective">Correctivo</SelectItem>
                  <SelectItem value="emergency">Emergencia</SelectItem>
                  <SelectItem value="upgrade">Actualización</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Estado */}
            <div>
              <Label htmlFor="status">Estado *</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Programado</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prioridad */}
            <div>
              <Label htmlFor="priority">Prioridad</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Costo */}
            <div>
              <Label htmlFor="cost">Costo ($)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Proveedor */}
            <div>
              <Label htmlFor="vendor">Proveedor</Label>
              <Input
                id="vendor"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="Nombre del proveedor"
              />
            </div>

            {/* Técnico */}
            <div>
              <Label htmlFor="technician">Técnico</Label>
              <Input
                id="technician"
                disabled
                value={formData.technician}
                onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                placeholder="Nombre del técnico"
              />
            </div>

            {/* Fecha Programada */}
            <div>
              <Label>Fecha Programada</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.scheduledDate
                      ? format(formData.scheduledDate, "PPP", { locale: es })
                      : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.scheduledDate}
                    onSelect={(date) =>
                      setFormData({ ...formData, scheduledDate: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Fecha Completada */}
            <div>
              <Label>Fecha Completada</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.completedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.completedDate
                      ? format(formData.completedDate, "PPP", { locale: es })
                      : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.completedDate}
                    onSelect={(date) =>
                      setFormData({ ...formData, completedDate: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Próximo Mantenimiento */}
            <div>
              <Label>Próximo Mantenimiento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.nextMaintenanceDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.nextMaintenanceDate
                      ? format(formData.nextMaintenanceDate, "PPP", { locale: es })
                      : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.nextMaintenanceDate}
                    onSelect={(date) =>
                      setFormData({ ...formData, nextMaintenanceDate: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Tiempo Empleado */}
            <div>
              <Label htmlFor="timeSpent">Tiempo Empleado (horas)</Label>
              <Input
                id="timeSpent"
                type="number"
                step="0.5"
                value={formData.timeSpent}
                onChange={(e) => setFormData({ ...formData, timeSpent: e.target.value })}
                placeholder="0.0"
              />
            </div>

            {/* Partes Reemplazadas */}
            <div className="col-span-2">
              <Label htmlFor="partsReplaced">Partes Reemplazadas</Label>
              <Textarea
                id="partsReplaced"
                value={formData.partsReplaced}
                onChange={(e) =>
                  setFormData({ ...formData, partsReplaced: e.target.value })
                }
                placeholder="Lista de partes reemplazadas durante el mantenimiento"
                rows={2}
              />
            </div>

            {/* Notas */}
            <div className="col-span-2">
              <Label htmlFor="notes">Notas Adicionales</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales sobre el mantenimiento"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMaintenanceMutation.isPending}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={updateMaintenanceMutation.isPending}
              data-testid="button-save-maintenance"
            >
              {updateMaintenanceMutation.isPending ? "Actualizando..." : "Actualizar Mantenimiento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}