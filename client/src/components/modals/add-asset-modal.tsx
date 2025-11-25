import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { useAuthData } from "@/hooks/useAuthData";

const formSchema = insertAssetSchema.extend({
  companyId: z.string().min(1, "Company ID is required"),
});

interface AddAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

export default function AddAssetModal({ open, onOpenChange, companyId }: AddAssetModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { userId: loggedInUserId, isLoading: isAuthLoading } = useAuthData();
  console.log("Aqui estoy dentro del modal", companyId)

  // Get technicians for assignment
 // const { data: technicians = [] } = useQuery({
   // queryKey: ["/api/technicians", companyId],
    //enabled: !!companyId,
  //});

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyId: companyId || "",
      name: "",
      type: "physical",
      description: "",
      serialNumber: "",
      model: "",
      manufacturer: "",
      monthlyCost: 0,
      annualCost: 0,
      status: "active",
      location: "",
      assignedTo: loggedInUserId,
      notes: "",
      applicationType: "saas",
      url: "",
      version: "",
      domainCost: 0,
      sslCost: 0,
      hostingCost: 0,
      serverCost: 0,
      domainExpiry: undefined,
      sslExpiry: undefined,
      hostingExpiry: undefined,
      serverExpiry: undefined,
    },
  });

  useEffect(() => {
    form.setValue("companyId", companyId || "");
  }, [companyId, form]);

  const selectedType = form.watch("type");

  const createAssetMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      // Asegurarse de que el companyId esté en los datos enviados
      const dataWithCompanyId = {
        ...data,
        companyId: companyId, // Usar el prop companyId que está actualizado
      };
      const response = await apiRequest("POST", `/api/assets`, dataWithCompanyId);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Activo creado",
        description: "El activo se ha creado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      console.error("Error creating asset:", error);
      
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
      
      // Mostrar mensaje de error más específico si está disponible
      const errorMessage = error.response?.data?.message || error.message || "Error al crear el activo. Inténtalo de nuevo.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log("Formulario enviado:", data);
    createAssetMutation.mutate(data);
  };

  // Función para manejar el cierre del modal
  const handleClose = () => {
    if (!createAssetMutation.isPending) {
      form.reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Activo</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, (errors)=>{
            console.error("Errores de validación del formulario:", errors);
          })} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Activo</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value === "application") {
                        // Limpiar campos de "physical" que podrían ser requeridos
                        form.setValue("serialNumber", "");
                        form.setValue("model", "");
                        form.setValue("manufacturer", "");
                        form.setValue("assignedTo", "");
                        form.setValue("location", "");
                      } else if (value === "physical") {
                        // Limpiar campos de "application" que podrían ser requeridos
                        form.setValue("applicationType", "saas"); // Valor por defecto//
                        form.setValue("url", "");
                        form.setValue("version", "");
                        form.setValue("domainCost", 0);
                        form.setValue("sslCost", 0);
                        form.setValue("hostingCost", 0);
                        form.setValue("serverCost", 0);
                        form.setValue("domainExpiry", undefined);
                        form.setValue("sslExpiry", undefined);
                        form.setValue("hostingExpiry", undefined);
                        form.setValue("serverExpiry", undefined);
                      }
                    }} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-asset-type">
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
                    <Input 
                      placeholder="Nombre del activo" 
                      {...field} 
                      data-testid="input-asset-name"
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
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Descripción del activo" 
                      {...field} 
                      data-testid="input-asset-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo oculto para assignedTechnicianId
            <input 
              type="hidden" 
              {...form.register("assignedTo")} 
              value={loggedInUserId || ""} 
            /> */}
            
            {/* Mostrar el nombre del técnico asignado
            <div className="space-y-2">
              <FormLabel>Técnico Asignado</FormLabel>
              <div className="p-2 border rounded-md bg-gray-100 text-sm font-medium">
                {isAuthLoading ? "Cargando usuario..." : (loggedInUserId ? "Usuario Logueado (Asignación Automática)" : "Error al obtener usuario")}
              </div>
            </div> */}

            {/* Application-specific fields */}
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
                          <SelectTrigger data-testid="select-application-type">
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
                          <Input 
                            placeholder="https://..." 
                            {...field} 
                            data-testid="input-application-url"
                          />
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
                          <Input 
                            placeholder="v1.0.0" 
                            {...field} 
                            data-testid="input-application-version"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                              {...field} onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} 
                              data-testid="input-domain-cost"
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
                              data-testid="input-domain-expiry"
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
                              {...field} onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              data-testid="input-ssl-cost"
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
                              data-testid="input-ssl-expiry"
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
                              {...field} onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} 
                              data-testid="input-hosting-cost"
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
                              data-testid="input-hosting-expiry"
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
                              {...field} onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              data-testid="input-server-cost"
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
                              data-testid="input-server-expiry"
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthlyCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {selectedType === "application" ? "Costo Mensual (App)" : "Costo Mensual"}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        placeholder="0.00" 
                        {...field} onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))}
                        data-testid="input-monthly-cost"
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
                    <FormLabel>
                      {selectedType === "application" ? "Costo Anual (App)" : "Costo Anual"}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        step="0.01"
                        placeholder="0.00" 
                        {...field} onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} 
                        data-testid="input-annual-cost"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                disabled={createAssetMutation.isPending}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createAssetMutation.isPending}
                data-testid="button-save-asset"
              >
                {createAssetMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}