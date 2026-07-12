import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface AddMaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  preselectedAssetId?: string | null;
}

interface MaintenanceLine {
  id: string;
  description: string;
  quantity: string;
  unitCost: string;
}

interface FormErrors {
  assetId?: string;
  maintenanceType?: string;
  title?: string;
  description?: string;
}

const createLine = (): MaintenanceLine => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: "1",
  unitCost: "0",
});

const initialFormState = {
  assetId: "",
  maintenanceType: "",
  title: "",
  description: "",
  vendor: "",
  technician: "",
  scheduledDate: "",
  completedDate: "",
  status: "scheduled",
  priority: "medium",
  notes: "",
};

function dateToIso(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toISOString();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

export default function AddMaintenanceModal({
  open,
  onOpenChange,
  companyId,
  preselectedAssetId,
}: AddMaintenanceModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(initialFormState);
  const [lines, setLines] = useState<MaintenanceLine[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: assetsData = [], isLoading: isAssetsLoading } = useQuery<any[]>({
    queryKey: ["/api/assets", companyId],
    enabled: open && !!companyId,
  });

  const physicalAssets = useMemo(
    () =>
      (Array.isArray(assetsData) ? assetsData : []).filter(
        (asset: any) => (asset.type ?? asset.assetType) === "physical",
      ),
    [assetsData],
  );

  useEffect(() => {
    if (!open) return;

    setForm({
      ...initialFormState,
      assetId: preselectedAssetId ? String(preselectedAssetId) : "",
    });
    setLines([]);
    setErrors({});
    setIsSubmitting(false);
  }, [open, preselectedAssetId, companyId]);

  const validLines = useMemo(
    () =>
      lines
        .map((line) => ({
          description: line.description.trim(),
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost),
        }))
        .filter(
          (line) =>
            line.description.length > 0 &&
            Number.isFinite(line.quantity) &&
            line.quantity > 0 &&
            Number.isFinite(line.unitCost) &&
            line.unitCost >= 0,
        ),
    [lines],
  );

  const totalCost = useMemo(
    () =>
      validLines.reduce(
        (total, line) => total + line.quantity * line.unitCost,
        0,
      ),
    [validLines],
  );

  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field in errors) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!form.assetId) nextErrors.assetId = "Selecciona un activo.";
    if (!form.maintenanceType) {
      nextErrors.maintenanceType = "Selecciona el tipo de mantenimiento.";
    }
    if (!form.title.trim()) nextErrors.title = "Ingresa un título.";
    if (!form.description.trim()) {
      nextErrors.description = "Ingresa el detalle técnico.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const updateLine = (
    id: string,
    field: keyof Omit<MaintenanceLine, "id">,
    value: string,
  ) => {
    setLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, [field]: value } : line,
      ),
    );
  };

  const removeLine = (id: string) => {
    setLines((current) => current.filter((line) => line.id !== id));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const response = await apiRequest("POST", "/api/maintenance", {
        companyId,
        assetId: form.assetId,
        maintenanceType: form.maintenanceType,
        title: form.title.trim(),
        description: form.description.trim(),
        vendor: form.vendor.trim(),
        technician: form.technician.trim(),
        scheduledDate: dateToIso(form.scheduledDate),
        completedDate: dateToIso(form.completedDate),
        status: form.status,
        priority: form.priority,
        notes: form.notes.trim(),
        cost: totalCost,
      });

      const record = await response.json();

      if (validLines.length > 0) {
        try {
          await apiRequest(
            "PUT",
            `/api/maintenance/${companyId}/${record.id}/lines`,
            { lines: validLines },
          );
        } catch (lineError) {
          toast({
            title: "Advertencia",
            description: `El mantenimiento se guardo pero fallo el detalle: ${getErrorMessage(lineError)}`,
          });
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/assets"] }),
      ]);

      toast({
        title: "Mantenimiento registrado",
        description: "El mantenimiento se guardó correctamente.",
      });

      setForm(initialFormState);
      setLines([]);
      setErrors({});
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "No se pudo registrar",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar mantenimiento</DialogTitle>
          <DialogDescription>
            Registra el trabajo realizado, sus responsables y el costo asociado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="maintenance-asset">Activo*</Label>
            <Select
              value={form.assetId}
              onValueChange={(value) => setField("assetId", value)}
              disabled={isAssetsLoading || physicalAssets.length === 0}
            >
              <SelectTrigger
                id="maintenance-asset"
                className={errors.assetId ? "border-destructive" : undefined}
              >
                <SelectValue
                  placeholder={
                    isAssetsLoading
                      ? "Cargando activos..."
                      : "Selecciona un activo"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {physicalAssets.map((asset: any) => (
                  <SelectItem key={asset.id} value={String(asset.id)}>
                    {asset.name} — {asset.assetCode || asset.serialNumber || ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.assetId && (
              <p className="text-sm text-destructive">{errors.assetId}</p>
            )}
            {!isAssetsLoading && physicalAssets.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay equipos físicos disponibles.{" "}
                <Link
                  href="/assets"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Primero crea un equipo
                </Link>
                .
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-type">Tipo de mantenimiento*</Label>
            <Select
              value={form.maintenanceType}
              onValueChange={(value) => setField("maintenanceType", value)}
            >
              <SelectTrigger
                id="maintenance-type"
                className={
                  errors.maintenanceType ? "border-destructive" : undefined
                }
              >
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preventive">Preventivo</SelectItem>
                <SelectItem value="corrective">Correctivo</SelectItem>
                <SelectItem value="emergency">Emergencia</SelectItem>
                <SelectItem value="upgrade">Mejora</SelectItem>
              </SelectContent>
            </Select>
            {errors.maintenanceType && (
              <p className="text-sm text-destructive">
                {errors.maintenanceType}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-title">Título*</Label>
            <Input
              id="maintenance-title"
              value={form.title}
              onChange={(event) => setField("title", event.target.value)}
              onBlur={validate}
              className={errors.title ? "border-destructive" : undefined}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-description">Detalle técnico*</Label>
            <Textarea
              id="maintenance-description"
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
              onBlur={validate}
              className={`min-h-[100px] ${
                errors.description ? "border-destructive" : ""
              }`}
            />
            <p className="text-sm text-muted-foreground">
              Qué se hizo / qué se encontró
            </p>
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maintenance-vendor">Proveedor</Label>
              <Input
                id="maintenance-vendor"
                value={form.vendor}
                onChange={(event) => setField("vendor", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenance-technician">Técnico</Label>
              <Input
                id="maintenance-technician"
                value={form.technician}
                onChange={(event) => setField("technician", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maintenance-scheduled-date">
                Fecha programada
              </Label>
              <Input
                id="maintenance-scheduled-date"
                type="date"
                value={form.scheduledDate}
                onChange={(event) =>
                  setField("scheduledDate", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenance-completed-date">
                Fecha completada
              </Label>
              <Input
                id="maintenance-completed-date"
                type="date"
                value={form.completedDate}
                onChange={(event) =>
                  setField("completedDate", event.target.value)
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maintenance-status">Estado</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setField("status", value)}
              >
                <SelectTrigger id="maintenance-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Programado</SelectItem>
                  <SelectItem value="in_progress">En progreso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenance-priority">Prioridad</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setField("priority", value)}
              >
                <SelectTrigger id="maintenance-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">
                Detalle de piezas y servicio
              </h3>
              <p className="text-sm text-muted-foreground">
                Agrega las piezas, materiales o servicios facturados.
              </p>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[minmax(0,1fr)_80px_112px_104px_40px] gap-2 border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                  <span>Descripción</span>
                  <span>Cantidad</span>
                  <span>Costo unit. $</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>

                {lines.map((line) => {
                  const quantity = Number(line.quantity);
                  const unitCost = Number(line.unitCost);
                  const lineTotal =
                    Number.isFinite(quantity) && Number.isFinite(unitCost)
                      ? quantity * unitCost
                      : 0;

                  return (
                    <div
                      key={line.id}
                      className="grid grid-cols-[minmax(0,1fr)_80px_112px_104px_40px] items-center gap-2 border-b px-3 py-2 last:border-b-0"
                    >
                      <Input
                        aria-label="Descripción de la línea"
                        value={line.description}
                        onChange={(event) =>
                          updateLine(
                            line.id,
                            "description",
                            event.target.value,
                          )
                        }
                      />
                      <Input
                        aria-label="Cantidad"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.id, "quantity", event.target.value)
                        }
                      />
                      <Input
                        aria-label="Costo unitario"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitCost}
                        onChange={(event) =>
                          updateLine(line.id, "unitCost", event.target.value)
                        }
                      />
                      <span className="text-right text-sm tabular-nums">
                        $
                        {lineTotal.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar línea"
                        onClick={() => removeLine(line.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}

                {lines.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No se han agregado líneas.
                  </div>
                )}

                <div className="flex items-center justify-between border-t bg-muted/40 px-3 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setLines((current) => [...current, createLine()])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar línea
                  </Button>
                  <div className="text-right">
                    <span className="mr-3 text-sm font-medium">TOTAL</span>
                    <span className="font-semibold tabular-nums">
                      $
                      {totalCost.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="space-y-2">
            <Label htmlFor="maintenance-notes">Notas</Label>
            <Textarea
              id="maintenance-notes"
              rows={2}
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
            />
          </div>

          <DialogFooter className="sticky bottom-0 -mx-6 border-t bg-background px-6 pb-1 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || physicalAssets.length === 0}
              data-testid="button-submit-maintenance"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Registrar mantenimiento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}