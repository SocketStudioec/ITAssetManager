import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Laptop,
  Monitor,
  Network,
  Printer,
  Server,
  Smartphone,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface AddPhysicalAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

type Step = 1 | 2 | 3;

interface CreatePhysicalAssetPayload {
  companyId: string;
  type: "physical";
  name: string;
  description: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  location: string;
  assignedTo: string;
  status: string;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  monthlyCost: number;
  notes: string;
}

const categories = [
  {
    label: "Laptop",
    icon: Laptop,
    testId: "category-laptop",
  },
  {
    label: "Computador de escritorio",
    icon: Monitor,
    testId: "category-desktop",
  },
  {
    label: "Servidor",
    icon: Server,
    testId: "category-server",
  },
  {
    label: "Impresora",
    icon: Printer,
    testId: "category-printer",
  },
  {
    label: "Equipo de red",
    icon: Network,
    testId: "category-network",
  },
  {
    label: "Móvil/Tablet",
    icon: Smartphone,
    testId: "category-mobile",
  },
];

const statusLabels: Record<string, string> = {
  active: "Activo",
  maintenance: "En mantenimiento",
  inactive: "Inactivo",
  deprecated: "Obsoleto",
};

function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const responseError = error as {
      response?: {
        data?: {
          message?: string;
        };
      };
      message?: string;
    };

    return (
      responseError.response?.data?.message ||
      responseError.message ||
      "Ocurrió un error al registrar el equipo."
    );
  }

  return "Ocurrió un error al registrar el equipo.";
}

export default function AddPhysicalAssetModal({
  open,
  onOpenChange,
  companyId,
}: AddPhysicalAssetModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [location, setLocation] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [status, setStatus] = useState("active");
  const [purchaseDate, setPurchaseDate] = useState(getToday());
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [monthlyCost, setMonthlyCost] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setStep(1);
    setCategory("");
    setName("");
    setManufacturer("");
    setModel("");
    setSerialNumber("");
    setLocation("");
    setAssignedTo("");
    setStatus("active");
    setPurchaseDate(getToday());
    setWarrantyExpiry("");
    setMonthlyCost("");
    setNotes("");
  };

  const createAssetMutation = useMutation({
    mutationFn: async (payload: CreatePhysicalAssetPayload) => {
      return apiRequest("POST", "/api/assets", payload);
    },
    onSuccess: (_response, payload) => {
      toast({
        title: "Equipo registrado",
        description: `${payload.name} se agregó a tus equipos.`,
      });

      queryClient.invalidateQueries({
        queryKey: ["/api/assets", companyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/assets"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard"],
      });

      resetForm();
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "No pudimos guardar el equipo",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const handleSave = () => {
    if (!companyId || !category.trim() || !name.trim()) {
      return;
    }

    createAssetMutation.mutate({
      companyId,
      type: "physical",
      name: name.trim(),
      description: category.trim() || "",
      manufacturer: manufacturer.trim(),
      model: model.trim(),
      serialNumber: serialNumber.trim(),
      location: location.trim(),
      assignedTo: assignedTo.trim(),
      status,
      purchaseDate: purchaseDate
        ? new Date(purchaseDate).toISOString()
        : null,
      warrantyExpiry: warrantyExpiry
        ? new Date(warrantyExpiry).toISOString()
        : null,
      monthlyCost: Number(monthlyCost) || 0,
      notes: notes.trim(),
    });
  };

  const handleNext = () => {
    if (step === 1 && category.trim() && name.trim()) {
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      return;
    }

    if (step === 3) {
      setStep(2);
    }
  };

  const summaryDetails = [
    {
      label: "Ubicación",
      value: location.trim(),
    },
    {
      label: "Responsable",
      value: assignedTo.trim(),
    },
    {
      label: "Fabricante y modelo",
      value: [manufacturer.trim(), model.trim()].filter(Boolean).join(" "),
    },
    {
      label: "Estado",
      value: statusLabels[status] || status,
    },
  ].filter((detail) => detail.value);

  const namePlaceholder = category
    ? `Ej: ${category} de gerencia`
    : "Ej: Laptop de gerencia, Servidor principal";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar equipo físico</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
              {[
                { number: 1, label: "Identificación" },
                { number: 2, label: "Ubicación" },
                { number: 3, label: "Compra" },
              ].map((item) => (
                <div
                  key={item.number}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                    step === item.number
                      ? "bg-primary/10 font-medium text-primary"
                      : step > item.number
                        ? "text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                      step === item.number &&
                        "border-primary bg-primary text-primary-foreground",
                      step > item.number &&
                        "border-primary bg-primary/10 text-primary",
                    )}
                  >
                    {item.number}
                  </span>
                  <span className="hidden sm:inline">
                    {item.number} {item.label}
                  </span>
                  <span className="sm:hidden">{item.label}</span>
                </div>
              ))}
            </div>
            <Progress value={(step / 3) * 100} />
          </div>

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold">¿Qué equipo es?</h3>
                <p className="text-sm text-muted-foreground">
                  Elige la categoría que mejor lo representa.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {categories.map((item) => {
                  const Icon = item.icon;
                  const selected = category === item.label;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setCategory(item.label)}
                      className={cn(
                        "flex min-h-28 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-3 text-center text-sm font-medium transition-colors hover:border-primary/60 hover:bg-accent",
                        selected &&
                          "border-primary bg-primary/5 ring-2 ring-primary",
                      )}
                      aria-pressed={selected}
                      data-testid={item.testId}
                    >
                      <Icon
                        className={cn(
                          "h-8 w-8 text-muted-foreground transition-colors",
                          selected && "text-primary",
                        )}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label htmlFor="physical-asset-name">Nombre*</Label>
                <Input
                  id="physical-asset-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={namePlaceholder}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Ponle un nombre fácil de reconocer después.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold">
                  ¿Dónde está y quién lo usa?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Todo esto es opcional. Puedes completarlo después.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="physical-asset-location">Ubicación</Label>
                  <Input
                    id="physical-asset-location"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Ej: Oficina Quito, Bodega"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="physical-asset-assigned-to">
                    Responsable/asignado a
                  </Label>
                  <Input
                    id="physical-asset-assigned-to"
                    value={assignedTo}
                    onChange={(event) => setAssignedTo(event.target.value)}
                    placeholder="Nombre de la persona"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="physical-asset-manufacturer">
                    Fabricante
                  </Label>
                  <Input
                    id="physical-asset-manufacturer"
                    value={manufacturer}
                    onChange={(event) => setManufacturer(event.target.value)}
                    placeholder="Ej: HP, Dell, Lenovo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="physical-asset-model">Modelo</Label>
                  <Input
                    id="physical-asset-model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="Ej: Latitude 5520"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="physical-asset-serial-number">
                    Número de serie
                  </Label>
                  <Input
                    id="physical-asset-serial-number"
                    value={serialNumber}
                    onChange={(event) => setSerialNumber(event.target.value)}
                    placeholder="Ej: SN-123456"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="physical-asset-status">Estado</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="physical-asset-status">
                      <SelectValue placeholder="Selecciona un estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="maintenance">
                        En mantenimiento
                      </SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                      <SelectItem value="deprecated">Obsoleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold">Compra y garantía</h3>
                <p className="text-sm text-muted-foreground">
                  Estos datos son opcionales. Ya estás listo para registrar el
                  equipo.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="physical-asset-purchase-date">
                    Fecha de compra
                  </Label>
                  <Input
                    id="physical-asset-purchase-date"
                    type="date"
                    value={purchaseDate}
                    onChange={(event) => setPurchaseDate(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="physical-asset-warranty-expiry">
                    Vencimiento de garantía
                  </Label>
                  <Input
                    id="physical-asset-warranty-expiry"
                    type="date"
                    value={warrantyExpiry}
                    onChange={(event) => setWarrantyExpiry(event.target.value)}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="physical-asset-monthly-cost">
                    Costo mensual si aplica
                  </Label>
                  <Input
                    id="physical-asset-monthly-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={monthlyCost}
                    onChange={(event) => setMonthlyCost(event.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo si pagas una cuota recurrente por este equipo.
                  </p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="physical-asset-notes">Notas</Label>
                  <Textarea
                    id="physical-asset-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Información adicional sobre el equipo"
                    rows={3}
                  />
                </div>
              </div>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="space-y-4 p-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Resumen
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{category}</Badge>
                      <p className="text-lg font-semibold">{name}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    {summaryDetails.map((detail) => (
                      <div
                        key={detail.label}
                        className="flex min-w-0 items-start justify-between gap-3 rounded-md bg-background/70 px-3 py-2 sm:block"
                      >
                        <span className="text-muted-foreground">
                          {detail.label}
                        </span>
                        <p className="truncate font-medium">{detail.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <div>
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={createAssetMutation.isPending}
                  data-testid="button-physical-asset-back"
                >
                  Atrás
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step === 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(3)}
                  disabled={createAssetMutation.isPending}
                  data-testid="button-physical-asset-skip-location"
                >
                  Omitir
                </Button>
              )}

              {step === 3 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSave}
                  disabled={createAssetMutation.isPending}
                  data-testid="button-physical-asset-skip-purchase"
                >
                  Omitir
                </Button>
              )}

              {step < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={
                    createAssetMutation.isPending ||
                    (step === 1 && (!category.trim() || !name.trim()))
                  }
                  data-testid="button-physical-asset-next"
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={
                    createAssetMutation.isPending ||
                    !companyId ||
                    !category.trim() ||
                    !name.trim()
                  }
                  data-testid="button-save-physical-asset"
                >
                  {createAssetMutation.isPending
                    ? "Guardando..."
                    : "Guardar equipo"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}