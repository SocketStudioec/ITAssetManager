import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAssetSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { z } from "zod";

// Crear schema para edición que incluya todos los campos
const editAssetSchema = insertAssetSchema.extend({
  companyId: z.string().min(1, "Company ID is required"),
});

interface EditAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: any;
  companyId: string;
}

interface Category {
  id: string | number;
  name: string;
  depreciationYears?: number | null;
  depreciation_years?: number | null;
}

function normalizeCategories(
  response: Category[] | { categories?: Category[] } | undefined,
) {
  if (Array.isArray(response)) {
    return response;
  }
  return response?.categories ?? [];
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getCycleDivisor(cycle: string | null | undefined) {
  switch (cycle) {
    case "quarterly":
      return 3;
    case "semiannual":
      return 6;
    case "annual":
      return 12;
    default:
      return 1;
  }
}

// El costo por ciclo (lo que realmente paga cada vez) se reconstruye a partir
// de monthly_cost/annual_cost + billing_cycle guardados, igual que al crear.
function getCostPerCycle(asset: any) {
  const billingCycle = asset?.billing_cycle || "monthly";
  const monthlyCost = Number(asset?.monthly_cost || 0);
  const annualCost = Number(asset?.annual_cost || 0);

  if (billingCycle === "annual") {
    return annualCost || monthlyCost * 12;
  }

  return roundCurrency(monthlyCost * getCycleDivisor(billingCycle));
}

export default function EditAssetModal({ open, onOpenChange, asset, companyId }: EditAssetModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [costInput, setCostInput] = useState("0");

  const form = useForm<z.infer<typeof editAssetSchema>>({
    resolver: zodResolver(editAssetSchema),
    defaultValues: {
      companyId: companyId || "",
      name: "",
      type: "physical" as const,
      description: "",
      serialNumber: "",
      model: "",
      manufacturer: "",
      monthlyCost: undefined,
      annualCost: undefined,
      status: "active" as const,
      location: "",
      assignedTo: "",
      notes: "",
      applicationType: "saas" as const,
      url: "",
      version: "",
      categoryId: "",
      purchaseCost: undefined,
      residualValue: undefined,
      depreciationYears: undefined,
      warrantyExpiry: undefined,
      billingCycle: "monthly" as const,
      provider: "",
      paymentMethod: "transfer",
      cardName: "",
      bankName: "",
      purpose: "",
      renewalType: "manual" as const,
      renewalDate: undefined,
    },
  });

  const selectedType = form.watch("type");
  const billingCycle = form.watch("billingCycle");
  const paymentMethod = form.watch("paymentMethod");
  const renewalType = form.watch("renewalType");

  const categoriesQuery = useQuery<Category[] | { categories?: Category[] }>({
    queryKey: ["/api/categories", companyId],
    enabled: open && selectedType === "physical" && Boolean(companyId),
  });
  const categories = normalizeCategories(categoriesQuery.data);

  // Cargar datos del activo cuando se abre el modal
  useEffect(() => {
    if (open && asset) {
      form.reset({
        companyId: companyId,
        name: asset.name || "",
        type: asset.type || "physical",
        description: asset.description || "",
        serialNumber: asset.serial_number || "",
        model: asset.model || "",
        manufacturer: asset.manufacturer || "",
        monthlyCost: asset.monthly_cost ? Number(asset.monthly_cost) : undefined,
        annualCost: asset.annual_cost ? Number(asset.annual_cost) : undefined,
        status: asset.status || "active",
        location: asset.location || "",
        assignedTo: asset.assigned_to || "",
        notes: asset.notes || "",
        applicationType: asset.application_type || "saas",
        url: asset.url || "",
        version: asset.version || "",
        categoryId: asset.category_id ? String(asset.category_id) : "",
        purchaseCost: asset.purchase_cost ? Number(asset.purchase_cost) : undefined,
        residualValue: asset.residual_value ? Number(asset.residual_value) : undefined,
        depreciationYears: asset.depreciation_years ? Number(asset.depreciation_years) : undefined,
        warrantyExpiry: asset.warranty_expiry ? new Date(asset.warranty_expiry) : undefined,
        billingCycle: asset.billing_cycle || "monthly",
        provider: asset.provider || asset.manufacturer || "",
        paymentMethod: asset.payment_method || "transfer",
        cardName: asset.card_name || "",
        bankName: asset.bank_name || "",
        purpose: asset.purpose || "",
        renewalType: asset.renewal_type || "manual",
        renewalDate: asset.renewal_date ? new Date(asset.renewal_date) : undefined,
      });
      setCostInput(String(getCostPerCycle(asset) || ""));
    }
  }, [open, asset, companyId, form]);

  const purchaseCostWatch = Number(form.watch("purchaseCost")) || 0;
  const residualValueWatch = Number(form.watch("residualValue")) || 0;
  const depreciationYearsWatch = Number(form.watch("depreciationYears"));
  const monthlyDepreciation =
    purchaseCostWatch > 0 &&
    Number.isInteger(depreciationYearsWatch) &&
    depreciationYearsWatch > 0
      ? Math.max(purchaseCostWatch - residualValueWatch, 0) / (depreciationYearsWatch * 12)
      : null;

  const costInputNumber = Number(costInput) || 0;
  const monthlyEquivalent = roundCurrency(costInputNumber / getCycleDivisor(billingCycle));

  const updateAssetMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editAssetSchema>) => {
      if (!data.companyId) {
        throw new Error("El ID de la compañía es obligatorio.");
      }

      const transformedData = {
        companyId: data.companyId,
        name: data.name,
        type: data.type,
        description: data.description,
        serial_number: data.serialNumber || null,
        model: data.model || null,
        manufacturer: data.manufacturer || null,
        monthly_cost: data.monthlyCost,
        annual_cost: data.annualCost,
        status: data.status,
        location: data.location || null,
        assigned_to: data.assignedTo || null,
        notes: data.notes || null,
        application_type: data.applicationType || null,
        url: data.url || null,
        version: data.version || null,
        category_id: data.categoryId || null,
        purchase_cost: data.purchaseCost,
        residual_value: data.residualValue,
        depreciation_years: data.depreciationYears,
        warranty_expiry: data.warrantyExpiry || null,
        billing_cycle: data.type === "application" ? data.billingCycle : null,
        provider: data.type === "application" ? data.provider || null : null,
        payment_method: data.type === "application" ? data.paymentMethod || null : null,
        card_name: data.type === "application" && data.paymentMethod === "card" ? data.cardName || null : null,
        bank_name: data.type === "application" && data.paymentMethod === "card" ? data.bankName || null : null,
        purpose: data.type === "application" ? data.purpose || null : null,
        renewal_type: data.type === "application" ? data.renewalType || null : null,
        renewal_date: data.type === "application" ? data.renewalDate || null : null,
      };

      const response = await apiRequest("PUT", `/api/assets/${asset.id}`, transformedData);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Activo actualizado",
        description: "El activo se ha actualizado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Error updating asset:", error);

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

      const errorMessage = error.response?.data?.message || error.message || "Error al actualizar el activo.";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof editAssetSchema>) => {
    if (data.type === "application") {
      const divisor = getCycleDivisor(data.billingCycle);
      data.monthlyCost = roundCurrency(costInputNumber / divisor);
      data.annualCost = data.billingCycle === "annual" ? roundCurrency(costInputNumber) : 0;
    }

    updateAssetMutation.mutate(data);
  };

  const handleClose = () => {
    if (!updateAssetMutation.isPending) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Activo: {asset?.name}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Activo</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={true}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="physical">Equipo Físico</SelectItem>
                      <SelectItem value="application">Aplicación</SelectItem>
                      <SelectItem value="license">Licencia</SelectItem>
                      <SelectItem value="contract">Contrato</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del activo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descripción del activo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campos para equipos físicos */}
            {selectedType === "physical" && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de Serie</FormLabel>
                        <FormControl>
                          <Input placeholder="SN-123456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fabricante</FormLabel>
                        <FormControl>
                          <Input placeholder="Dell, HP, Lenovo..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo</FormLabel>
                        <FormControl>
                          <Input placeholder="Latitude 5520" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ubicación</FormLabel>
                        <FormControl>
                          <Input placeholder="Oficina, Bodega..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={String(category.id)} value={String(category.id)}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="warrantyExpiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Garantía hasta</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />
                <h5 className="font-medium text-sm text-muted-foreground">Compra y depreciación</h5>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="purchaseCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Costo de compra $</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value === undefined ? "" : field.value}
                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="residualValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor residual $</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            value={field.value === undefined ? "" : field.value}
                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="depreciationYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Años de depreciación</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            {...field}
                            value={field.value === undefined || field.value === null ? "" : field.value}
                            onChange={(e) => field.onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {monthlyDepreciation !== null && (
                  <p className="text-sm text-muted-foreground">
                    Depreciación mensual estimada: <span className="font-medium text-foreground">${monthlyDepreciation.toFixed(2)}</span>
                  </p>
                )}
              </div>
            )}

            {/* Campos para aplicaciones (suscripciones) — igual al flujo de "Agregar" */}
            {selectedType === "application" && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium text-sm">Configuración de Aplicación</h4>

                <FormField
                  control={form.control}
                  name="applicationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Aplicación</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="saas">SaaS (Software como Servicio)</SelectItem>
                          <SelectItem value="custom_development">Desarrollo Propio</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proveedor</FormLabel>
                        <FormControl>
                          <Input placeholder="Microsoft" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de la Aplicación</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />
                <h5 className="font-medium text-sm text-muted-foreground">Recurrencia y costo</h5>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="billingCycle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciclo de facturación</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? "monthly"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar ciclo..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">Mensual</SelectItem>
                            <SelectItem value="quarterly">Trimestral</SelectItem>
                            <SelectItem value="semiannual">Semestral</SelectItem>
                            <SelectItem value="annual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel>Costo del ciclo $</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={costInput}
                        onChange={(e) => setCostInput(e.target.value)}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      Equivale a ${monthlyEquivalent.toFixed(2)} mensuales
                    </p>
                  </FormItem>
                </div>

                <FormField
                  control={form.control}
                  name="renewalDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de próxima renovación</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />
                <h5 className="font-medium text-sm text-muted-foreground">Forma de pago y motivo</h5>

                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de pago</FormLabel>
                      <Select value={field.value ?? "transfer"} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar método..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="card">Tarjeta</SelectItem>
                          <SelectItem value="transfer">Transferencia</SelectItem>
                          <SelectItem value="cash">Efectivo</SelectItem>
                          <SelectItem value="other">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {paymentMethod === "card" && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cardName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de la tarjeta</FormLabel>
                          <FormControl>
                            <Input placeholder="Visa empresarial" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banco</FormLabel>
                          <FormControl>
                            <Input placeholder="Banco Pichincha" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>¿Por qué la empresa paga esto?</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-[90px] resize-y"
                          placeholder="Describe el motivo de negocio"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="renewalType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Renovación</FormLabel>
                      <FormControl>
                        <RadioGroup
                          className="flex min-h-10 flex-wrap items-center gap-6"
                          value={field.value ?? "manual"}
                          onValueChange={field.onChange}
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="automatic" id="edit-renewal-automatic" />
                            <label className="cursor-pointer text-sm font-medium" htmlFor="edit-renewal-automatic">
                              Automática
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="manual" id="edit-renewal-manual" />
                            <label className="cursor-pointer text-sm font-medium" htmlFor="edit-renewal-manual">
                              Manual
                            </label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="maintenance">En Mantenimiento</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                      <SelectItem value="deprecated">Obsoleto</SelectItem>
                      <SelectItem value="disposed">Desechado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Los equipos físicos usan costo de compra + depreciación (arriba);
                aplicaciones calculan el mensual/anual desde el costo del ciclo. */}
            {selectedType !== "physical" && selectedType !== "application" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="monthlyCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Mensual</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          value={field.value === undefined ? "" : field.value}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="annualCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Anual</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                          value={field.value === undefined ? "" : field.value}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormLabel>Asignado a</FormLabel>
                  <FormControl>
                    <Input placeholder="Usuario asignado" {...field}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notas adicionales..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={updateAssetMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateAssetMutation.isPending}
              >
                {updateAssetMutation.isPending ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
