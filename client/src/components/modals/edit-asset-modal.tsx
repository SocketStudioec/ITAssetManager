import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

export default function EditAssetModal({ open, onOpenChange, asset, companyId }: EditAssetModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      domainCost: undefined,
      sslCost: undefined,
      hostingCost: undefined,
      serverCost: undefined,
      domainExpiry: undefined,
      sslExpiry: undefined,
      hostingExpiry: undefined,
      serverExpiry: undefined,
    },
  });

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
        domainCost: asset.domain_cost ? Number(asset.domain_cost) : undefined,
        sslCost: asset.ssl_cost ? Number(asset.ssl_cost) : undefined,
        hostingCost: asset.hosting_cost ? Number(asset.hosting_cost) : undefined,
        serverCost: asset.server_cost ? Number(asset.server_cost) : undefined,
        domainExpiry: asset.domain_expiry ? new Date(asset.domain_expiry) : undefined,
        sslExpiry: asset.ssl_expiry ? new Date(asset.ssl_expiry) : undefined,
        hostingExpiry: asset.hosting_expiry ? new Date(asset.hosting_expiry) : undefined,
        serverExpiry: asset.server_expiry ? new Date(asset.server_expiry) : undefined,
      });
    }
  }, [open, asset, companyId, form]);

  const selectedType = form.watch("type");

  const updateAssetMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editAssetSchema>) => {
      if (!data.companyId) {
        throw new Error("El ID de la compañía es obligatorio.");
      }

      console.log('Datos del formulario para actualizar:', data);

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
        domain_cost: data.domainCost,
        ssl_cost: data.sslCost,
        hosting_cost: data.hostingCost,
        server_cost: data.serverCost,
        domain_expiry: data.domainExpiry || null,
        ssl_expiry: data.sslExpiry || null,
        hosting_expiry: data.hostingExpiry || null,
        server_expiry: data.serverExpiry || null,
      };

      console.log('Datos transformados:', transformedData);

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
      console.error("Error response:", error.response?.data);

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
    console.log('Datos del formulario:', data);
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
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value !== "application") {
                        form.setValue("applicationType", "saas" as const);
                        form.setValue("url", "");
                        form.setValue("version", "");
                        form.setValue("domainCost", undefined);
                        form.setValue("sslCost", undefined);
                        form.setValue("hostingCost", undefined);
                        form.setValue("serverCost", undefined);
                        form.setValue("domainExpiry", undefined);
                        form.setValue("sslExpiry", undefined);
                        form.setValue("hostingExpiry", undefined);
                        form.setValue("serverExpiry", undefined);
                      }
                      if (value !== "physical") {
                        form.setValue("serialNumber", "");
                        form.setValue("model", "");
                        form.setValue("manufacturer", "");
                        form.setValue("location", "");
                      }
                    }}
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

            {/* Código del activo - solo lectura */}
            {asset?.asset_code && (
              <div className="flex flex-col space-y-1">
                <label className="text-sm font-medium">Código del Activo</label>
                <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-sm font-mono font-semibold text-primary">
                  {asset.asset_code}
                </div>
                <p className="text-xs text-muted-foreground">El código se genera automáticamente y no puede modificarse.</p>
              </div>
            )}

            

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
              </div>
            )}

            {/* Campos para aplicaciones */}
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

                  <FormField
                    control={form.control}
                    name="version"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Versión</FormLabel>
                        <FormControl>
                          <Input placeholder="v1.0.0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Costos de infraestructura para aplicaciones */}
                <div className="space-y-4">
                  <h5 className="font-medium text-sm text-muted-foreground">Costos de Infraestructura (Mensual)</h5>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-muted-foreground font-medium">Servicio</div>
                    <div className="text-muted-foreground font-medium">Costo Mensual</div>
                    <div className="text-muted-foreground font-medium">Fecha de Caducidad</div>

                    {/* Dominio */}
                    <div className="flex items-center">Dominio</div>
                    <FormField
                      control={form.control}
                      name="domainCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              value={field.value === undefined ? '' : field.value}
                              onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="domainExpiry"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* SSL */}
                    <div className="flex items-center">SSL</div>
                    <FormField
                      control={form.control}
                      name="sslCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              value={field.value === undefined ? '' : field.value}
                              onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sslExpiry"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Hosting */}
                    <div className="flex items-center">Hosting</div>
                    <FormField
                      control={form.control}
                      name="hostingCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              value={field.value === undefined ? '' : field.value}
                              onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hostingExpiry"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Servidores */}
                    <div className="flex items-center">Servidores</div>
                    <FormField
                      control={form.control}
                      name="serverCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              value={field.value === undefined ? '' : field.value}
                              onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="serverExpiry"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                              className="h-8"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
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

            <div className="grid grid-cols-2 gap-4">
              {/* COSTOS MENSUALES/ANUALES  */}
              <FormField
                control={form.control}
                name="monthlyCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo Contable</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value === undefined ? '' : field.value}
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
                    <FormLabel>Costo Real</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        value={field.value === undefined ? '' : field.value}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormLabel>Asignado a</FormLabel>
                  <FormControl>
                    <Input placeholder="Usuario asignado" {...field} />
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