import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  BellRing,
  Cloud,
  KeyRound,
  Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const billingCycles = [
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "one_time",
] as const;

const formSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  provider: z.string().trim().min(1, "El proveedor es obligatorio"),
  url: z.string(),
  description: z.string(),
  billingCycle: z.enum(billingCycles),
  cost: z
    .number({
      required_error: "El costo es obligatorio",
      invalid_type_error: "Ingresa un costo válido",
    })
    .min(0, "El costo debe ser mayor o igual a 0"),
  renewalDate: z.string(),
  licenseKey: z.string(),
  licenseType: z.string(),
  maxUsers: z
    .number({
      invalid_type_error: "Ingresa una cantidad válida",
    })
    .int("Debe ser un número entero")
    .min(1, "Debe ser al menos 1")
    .optional(),
  purchaseDate: z.string(),
  expiryDate: z.string(),
  notes: z.string(),
  paymentMethod: z.enum(["card", "transfer", "cash", "other"]),
  cardName: z.string(),
  bankName: z.string(),
  purpose: z
    .string()
    .trim()
    .min(1, "El motivo de la suscripción es obligatorio"),
  renewalType: z.enum(["automatic", "manual"]),
});

type FormValues = z.infer<typeof formSchema>;
type AssetKind = "subscription" | "license";

interface AddAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

interface PaymentSectionProps {
  form: UseFormReturn<FormValues>;
}

const getDefaultValues = (): FormValues => ({
  name: "",
  provider: "",
  url: "",
  description: "",
  billingCycle: "monthly",
  cost: 0,
  renewalDate: "",
  licenseKey: "",
  licenseType: "",
  maxUsers: undefined,
  purchaseDate: "",
  expiryDate: "",
  notes: "",
  paymentMethod: "transfer",
  cardName: "",
  bankName: "",
  purpose: "",
  renewalType: "manual",
});

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getCycleDivisor(cycle: FormValues["billingCycle"]) {
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

function PaymentSection({ form }: PaymentSectionProps) {
  const paymentMethod = form.watch("paymentMethod");
  const renewalType = form.watch("renewalType");

  return (
    <section className="space-y-4">
      <Separator />
      <h3 className="text-sm font-medium">Forma de pago y motivo</h3>

      <FormField
        control={form.control}
        name="paymentMethod"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Método de pago</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="cardName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre de la tarjeta</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Visa empresarial Kevin"
                    autoComplete="off"
                    {...field}
                  />
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
                  <Input
                    placeholder="Banco Pichincha"
                    autoComplete="organization"
                    {...field}
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
        name="purpose"
        render={({ field }) => (
          <FormItem>
            <FormLabel>¿Por qué la empresa paga esto? *</FormLabel>
            <FormControl>
              <Textarea
                className="min-h-[110px] resize-y"
                placeholder="Describe el motivo de negocio"
                {...field}
              />
            </FormControl>
            <p className="text-sm text-muted-foreground">
              Explica el motivo de negocio: para qué se usa, quién la usa, qué
              pasaría si se cancela.
            </p>
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
                value={field.value}
                onValueChange={field.onChange}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="automatic" id="renewal-automatic" />
                  <label
                    className="cursor-pointer text-sm font-medium"
                    htmlFor="renewal-automatic"
                  >
                    Automática
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manual" id="renewal-manual" />
                  <label
                    className="cursor-pointer text-sm font-medium"
                    htmlFor="renewal-manual"
                  >
                    Manual
                  </label>
                </div>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {renewalType === "manual" && (
        <div
          className="flex gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
          role="status"
        >
          <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Te enviaremos un correo 2-3 días antes del vencimiento para que
            gestiones la renovación (ej. certificados SSL).
          </p>
        </div>
      )}
    </section>
  );
}

export default function AddAssetModal({
  open,
  onOpenChange,
  companyId,
}: AddAssetModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assetKind, setAssetKind] = useState<AssetKind | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(),
    mode: "onBlur",
  });

  const billingCycle = form.watch("billingCycle");
  const cost = form.watch("cost");
  const renewalDate = form.watch("renewalDate");
  const renewalType = form.watch("renewalType");

  const resetModal = () => {
    form.reset(getDefaultValues());
    setAssetKind(null);
  };

  useEffect(() => {
    if (open) {
      resetModal();
    }
  }, [open, companyId]);

  const createMutation = useMutation({
    mutationFn: async ({
      kind,
      data,
    }: {
      kind: AssetKind;
      data: FormValues;
    }) => {
      if (!companyId) {
        throw new Error("El ID de la compañía es obligatorio.");
      }

      const commonFields = {
        paymentMethod: data.paymentMethod,
        cardName: data.paymentMethod === "card" ? data.cardName.trim() : "",
        bankName: data.paymentMethod === "card" ? data.bankName.trim() : "",
        purpose: data.purpose.trim(),
        renewalType: data.renewalType,
      };

      if (kind === "subscription") {
        const divisor = getCycleDivisor(data.billingCycle);
        const monthlyCost =
          data.billingCycle === "monthly"
            ? roundCurrency(data.cost)
            : roundCurrency(data.cost / divisor);

        return apiRequest("POST", "/api/assets", {
          companyId,
          name: data.name.trim(),
          type: "application",
          provider: data.provider.trim(),
          manufacturer: data.provider.trim(),
          url: data.url.trim(),
          description: data.description.trim(),
          billingCycle: data.billingCycle,
          monthlyCost,
          annualCost:
            data.billingCycle === "annual" ? roundCurrency(data.cost) : 0,
          renewalDate: data.renewalDate || null,
          status: "active",
          ...commonFields,
        });
      }

      let monthlyCost = 0;
      let annualCost = 0;

      if (data.billingCycle === "monthly") {
        monthlyCost = roundCurrency(data.cost);
      } else if (data.billingCycle === "quarterly") {
        monthlyCost = roundCurrency(data.cost / 3);
      } else if (data.billingCycle === "semiannual") {
        monthlyCost = roundCurrency(data.cost / 6);
      } else if (data.billingCycle === "annual") {
        annualCost = roundCurrency(data.cost);
      }

      return apiRequest("POST", `/api/licenses/${companyId}`, {
        companyId,
        name: data.name.trim(),
        vendor: data.provider.trim(),
        licenseKey: data.licenseKey.trim(),
        licenseType: data.licenseType.trim(),
        maxUsers: data.maxUsers,
        purchaseDate: data.purchaseDate || null,
        expiryDate: data.expiryDate || null,
        billingCycle: data.billingCycle,
        monthlyCost,
        annualCost,
        notes: data.notes.trim(),
        ...commonFields,
      });
    },
    onSuccess: (_response, variables) => {
      toast({
        title:
          variables.kind === "subscription"
            ? "Suscripción agregada"
            : "Licencia agregada",
        description:
          variables.kind === "subscription"
            ? "La suscripción se agregó correctamente."
            : "La licencia se agregó correctamente.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });

      resetModal();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "No se pudo guardar",
        description: error.message || "Ocurrió un error. Inténtalo nuevamente.",
        variant: "destructive",
      });
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && createMutation.isPending) {
      return;
    }

    if (!nextOpen) {
      resetModal();
    }

    onOpenChange(nextOpen);
  };

  const chooseKind = (kind: AssetKind) => {
    form.reset({
      ...getDefaultValues(),
      billingCycle: kind === "subscription" ? "monthly" : "one_time",
    });
    setAssetKind(kind);
  };

  const handleBack = () => {
    if (createMutation.isPending) {
      return;
    }

    form.clearErrors();
    setAssetKind(null);
  };

  const onSubmit = (data: FormValues) => {
    if (!assetKind) {
      return;
    }

    createMutation.mutate({ kind: assetKind, data });
  };

  const monthlyEquivalent = roundCurrency(
    (Number.isFinite(cost) ? cost : 0) / getCycleDivisor(billingCycle),
  );

  const isSubscription = assetKind === "subscription";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>
            {assetKind ? "Agregar aplicación" : "¿Qué deseas agregar?"}
          </DialogTitle>
          <DialogDescription>
            {assetKind
              ? "Completa los datos para registrar el gasto y gestionar su renovación."
              : "Selecciona el tipo de aplicación que deseas registrar."}
          </DialogDescription>
        </DialogHeader>

        {!assetKind ? (
          <>
            <div className="overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  className="min-h-48 cursor-pointer rounded-lg border bg-background p-5 text-left transition-colors hover:border-primary hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => chooseKind("subscription")}
                >
                  <span className="mb-4 flex size-11 items-center justify-center rounded-md bg-muted text-foreground">
                    <Cloud className="size-5" aria-hidden="true" />
                  </span>
                  <span className="block text-base font-semibold">
                    Suscripción de aplicación
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    SaaS, apps y servicios que se pagan de forma recurrente
                    (Microsoft 365, Canva, hosting...)
                  </span>
                </button>

                <button
                  type="button"
                  className="min-h-48 cursor-pointer rounded-lg border bg-background p-5 text-left transition-colors hover:border-primary hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => chooseKind("license")}
                >
                  <span className="mb-4 flex size-11 items-center justify-center rounded-md bg-muted text-foreground">
                    <KeyRound className="size-5" aria-hidden="true" />
                  </span>
                  <span className="block text-base font-semibold">
                    Licencia con clave (key)
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    Licencias compradas con clave de activación (Windows,
                    antivirus, SSL...)
                  </span>
                </button>
              </div>
            </div>

            <div className="flex justify-end border-t bg-background px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <Form {...form}>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className="-ml-3"
                    onClick={handleBack}
                    disabled={createMutation.isPending}
                  >
                    <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                    Atrás
                  </Button>

                  <Badge variant="secondary" className="gap-2">
                    {isSubscription ? (
                      <Cloud className="size-3.5" aria-hidden="true" />
                    ) : (
                      <KeyRound className="size-3.5" aria-hidden="true" />
                    )}
                    {isSubscription
                      ? "Suscripción de aplicación"
                      : "Licencia con clave"}
                  </Badge>
                </div>

                {isSubscription ? (
                  <>
                    <section className="space-y-4">
                      <h3 className="text-sm font-medium">
                        Información de la aplicación
                      </h3>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Microsoft 365"
                                  autoComplete="off"
                                  data-testid="input-asset-name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="provider"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Proveedor *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Microsoft"
                                  autoComplete="organization"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL</FormLabel>
                            <FormControl>
                              <Input
                                type="url"
                                placeholder="https://..."
                                data-testid="input-application-url"
                                {...field}
                              />
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
                            <FormLabel>Descripción breve</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={2}
                                className="resize-y"
                                placeholder="Describe brevemente la aplicación"
                                data-testid="input-asset-description"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </section>

                    <section className="space-y-4">
                      <Separator />
                      <h3 className="text-sm font-medium">
                        Recurrencia y costo
                      </h3>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="billingCycle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ciclo de facturación *</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar ciclo..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="monthly">
                                    Mensual
                                  </SelectItem>
                                  <SelectItem value="quarterly">
                                    Trimestral
                                  </SelectItem>
                                  <SelectItem value="semiannual">
                                    Semestral
                                  </SelectItem>
                                  <SelectItem value="annual">Anual</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="cost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Costo del ciclo $ *</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  inputMode="decimal"
                                  placeholder="0.00"
                                  data-testid="input-monthly-cost"
                                  value={field.value ?? ""}
                                  onBlur={field.onBlur}
                                  onChange={(event) =>
                                    field.onChange(
                                      event.target.value === ""
                                        ? 0
                                        : event.target.valueAsNumber,
                                    )
                                  }
                                />
                              </FormControl>
                              <p className="text-sm text-muted-foreground tabular-nums">
                                Equivale a ${monthlyEquivalent.toFixed(2)}{" "}
                                mensuales
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="renewalDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Fecha de próxima renovación
                            </FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            {renewalType === "manual" && !renewalDate && (
                              <p className="text-sm text-amber-700">
                                Sin fecha de renovación no podremos avisarte.
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </section>
                  </>
                ) : (
                  <section className="space-y-4">
                    <h3 className="text-sm font-medium">
                      Información de la licencia
                    </h3>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Windows 11 Pro"
                                autoComplete="off"
                                data-testid="input-asset-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="provider"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Proveedor *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Microsoft"
                                autoComplete="organization"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="licenseKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clave de licencia</FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-20 resize-y font-mono"
                              placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                              autoComplete="off"
                              spellCheck={false}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="licenseType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de licencia</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Empresa, individual, perpetua..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="maxUsers"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Usuarios máximos</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                placeholder="1"
                                value={field.value ?? ""}
                                onBlur={field.onBlur}
                                onChange={(event) =>
                                  field.onChange(
                                    event.target.value === ""
                                      ? undefined
                                      : event.target.valueAsNumber,
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="purchaseDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha de compra</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="expiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha de vencimiento</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="billingCycle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ciclo *</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar ciclo..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="monthly">Mensual</SelectItem>
                                <SelectItem value="quarterly">
                                  Trimestral
                                </SelectItem>
                                <SelectItem value="semiannual">
                                  Semestral
                                </SelectItem>
                                <SelectItem value="annual">Anual</SelectItem>
                                <SelectItem value="one_time">
                                  Pago único
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="cost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Costo $ *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={field.value ?? ""}
                                onBlur={field.onBlur}
                                onChange={(event) =>
                                  field.onChange(
                                    event.target.value === ""
                                      ? 0
                                      : event.target.valueAsNumber,
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notas</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={3}
                              className="resize-y"
                              placeholder="Notas adicionales..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </section>
                )}

                <PaymentSection form={form} />
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t bg-background px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={createMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-save-asset"
                >
                  {createMutation.isPending && (
                    <Loader2
                      className="mr-2 size-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {createMutation.isPending
                    ? "Guardando..."
                    : isSubscription
                      ? "Agregar suscripción"
                      : "Agregar licencia"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}