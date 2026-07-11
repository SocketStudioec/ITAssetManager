import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { insertCompanySchema } from "@shared/schema";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import NotificationSettings from "@/components/settings/notification-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Settings as SettingsIcon, 
  Building2, 
  Users, 
  Save, 
  Plus, 
  Edit2, 
  Trash2,
  Shield,
  Database
} from "lucide-react";
import { z } from "zod";

const companyFormSchema = insertCompanySchema.extend({
  id: z.string().optional(),
  plan: z.enum(["pyme", "professional"]).default("professional"),
});

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);

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

  const { data: userCompanies = [], isLoading: isCompaniesLoading, error: companiesError } = useQuery({
    queryKey: ["/api/companies"],
    enabled: isAuthenticated,
  });

  // Set default company when companies are loaded
  useEffect(() => {
    if (userCompanies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].company.id);
    }
  }, [userCompanies, selectedCompanyId]);

  useEffect(() => {
    if (companiesError && isUnauthorizedError(companiesError as Error)) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al inicio de sesión...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [companiesError, toast]);

  const selectedCompany = userCompanies.find((uc: any) => uc.company.id === selectedCompanyId);

  // Company form
  const companyForm = useForm<z.infer<typeof companyFormSchema>>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: "",
      description: "",
      plan: "professional" as const,
    },
  });

  // Set form values when company is selected
  useEffect(() => {
    if (selectedCompany) {
      companyForm.reset({
        id: selectedCompany.company.id,
        name: selectedCompany.company.name,
        description: selectedCompany.company.description || "",
        plan: selectedCompany.company.plan || "professional",
      });
    }
  }, [selectedCompany, companyForm]);

  const createCompanyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof companyFormSchema>) => {
      await apiRequest("POST", "/api/companies", data);
    },
    onSuccess: () => {
      toast({
        title: "Empresa creada",
        description: "La empresa se ha creado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setShowAddCompanyModal(false);
      companyForm.reset();
    },
    onError: (error) => {
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
      
      toast({
        title: "Error",
        description: "Error al crear la empresa. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof companyFormSchema>) => {
      await apiRequest("PUT", `/api/companies/${data.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Empresa actualizada",
        description: "Los datos de la empresa se han actualizado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
    onError: (error) => {
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
      
      toast({
        title: "Error",
        description: "Error al actualizar la empresa. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const onSubmitCompany = (data: z.infer<typeof companyFormSchema>) => {
    if (data.id) {
      updateCompanyMutation.mutate(data);
    } else {
      createCompanyMutation.mutate(data);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Badge className="bg-destructive text-destructive-foreground">Super Admin</Badge>;
      case "technical_admin":
        return <Badge className="bg-primary text-primary-foreground">Admin TI</Badge>;
      case "manager_owner":
        return <Badge className="bg-accent text-accent-foreground">Gerente</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="w-32 h-8" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar 
        selectedCompanyId={selectedCompanyId} 
        onCompanyChange={setSelectedCompanyId} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Configuración" 
          subtitle="Gestión de empresas y configuraciones del sistema" 
        />
        
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 space-y-6">
            {/* Settings Tabs */}
            <Tabs defaultValue="company" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="company" data-testid="tab-company-settings">Empresa</TabsTrigger>
                <TabsTrigger value="users" data-testid="tab-user-settings">Usuarios</TabsTrigger>
                <TabsTrigger value="notifications" data-testid="tab-notification-settings">Notificaciones</TabsTrigger>
                <TabsTrigger value="system" data-testid="tab-system-settings">Sistema</TabsTrigger>
              </TabsList>

              <TabsContent value="company" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Company Information */}
                  <div className="lg:col-span-2">
                    <Card className="border-border">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Building2 className="w-5 h-5 mr-2" />
                          Información de la Empresa
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Form {...companyForm}>
                          <form onSubmit={companyForm.handleSubmit(onSubmitCompany)} className="space-y-4">
                            <FormField
                              control={companyForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nombre de la Empresa</FormLabel>
                                  <FormControl>
                                    <Input 
                                      placeholder="Nombre de la empresa" 
                                      {...field} 
                                      data-testid="input-company-name"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={companyForm.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Descripción</FormLabel>
                                  <FormControl>
                                    <Textarea 
                                      placeholder="Descripción de la empresa" 
                                      {...field} 
                                      data-testid="input-company-description"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Breve descripción de la empresa o sector.
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <Button 
                              type="submit" 
                              disabled={updateCompanyMutation.isPending}
                              data-testid="button-save-company"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              {updateCompanyMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                          </form>
                        </Form>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Company Actions */}
                  <div>
                    <Card className="border-border">
                      <CardHeader>
                        <CardTitle>Acciones</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Dialog open={showAddCompanyModal} onOpenChange={setShowAddCompanyModal}>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full" data-testid="button-add-company">
                              <Plus className="w-4 h-4 mr-2" />
                              Nueva Empresa
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Crear Nueva Empresa</DialogTitle>
                              <DialogDescription>
                                Agrega una nueva empresa para gestionar sus activos TI por separado.
                              </DialogDescription>
                            </DialogHeader>
                            <Form {...companyForm}>
                              <form onSubmit={companyForm.handleSubmit((data) => {
                                createCompanyMutation.mutate({ ...data, id: undefined });
                              })} className="space-y-4">
                                <FormField
                                  control={companyForm.control}
                                  name="name"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Nombre</FormLabel>
                                      <FormControl>
                                        <Input 
                                          placeholder="Nombre de la nueva empresa" 
                                          {...field} 
                                          data-testid="input-new-company-name"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={companyForm.control}
                                  name="description"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Descripción</FormLabel>
                                      <FormControl>
                                        <Textarea 
                                          placeholder="Descripción opcional" 
                                          {...field} 
                                          data-testid="input-new-company-description"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={companyForm.control}
                                  name="plan"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Plan</FormLabel>
                                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                          <SelectTrigger data-testid="select-company-plan">
                                            <SelectValue placeholder="Seleccionar plan..." />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="professional">
                                            <div className="flex flex-col">
                                              <span className="font-medium">Profesional</span>
                                              <span className="text-xs text-muted-foreground">Para personas naturales (1 usuario, 100 activos)</span>
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="pyme">
                                            <div className="flex flex-col">
                                              <span className="font-medium">PyME</span>
                                              <span className="text-xs text-muted-foreground">Para pequeñas empresas (10+ usuarios, 500+ activos)</span>
                                            </div>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <div className="flex justify-end space-x-2">
                                  <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={() => setShowAddCompanyModal(false)}
                                    data-testid="button-cancel-company"
                                  >
                                    Cancelar
                                  </Button>
                                  <Button 
                                    type="submit" 
                                    disabled={createCompanyMutation.isPending}
                                    data-testid="button-create-company"
                                  >
                                    {createCompanyMutation.isPending ? "Creando..." : "Crear Empresa"}
                                  </Button>
                                </div>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>

                        <Separator />

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Mis Empresas</h4>
                          {isCompaniesLoading ? (
                            <Skeleton className="h-20 w-full" />
                          ) : (
                            userCompanies.map((uc: any) => (
                              <div key={uc.company.id} className="p-3 border border-border rounded-lg" data-testid={`company-item-${uc.company.id}`}>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-foreground">{uc.company.name}</p>
                                    <p className="text-xs text-muted-foreground">{getRoleBadge(uc.role)}</p>
                                  </div>
                                  <Button variant="ghost" size="sm" data-testid={`button-select-${uc.company.id}`}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="users" className="mt-6">
                <Card className="border-border">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center">
                        <Users className="w-5 h-5 mr-2" />
                        Gestión de Usuarios
                      </CardTitle>
                      <Button data-testid="button-invite-user">
                        <Plus className="w-4 h-4 mr-2" />
                        Invitar Usuario
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Última Actividad</TableHead>
                            <TableHead>Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow data-testid="row-current-user">
                            <TableCell className="font-medium">
                              {user?.firstName} {user?.lastName}
                            </TableCell>
                            <TableCell>{user?.email}</TableCell>
                            <TableCell>{getRoleBadge(user?.role || "technical_admin")}</TableCell>
                            <TableCell>
                              <Badge className="bg-accent text-accent-foreground">Activo</Badge>
                            </TableCell>
                            <TableCell>Ahora</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="ghost" size="sm" data-testid="button-edit-current-user">
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications" className="mt-6">
                {selectedCompanyId ? (
                  <NotificationSettings companyId={selectedCompanyId} />
                ) : (
                  <Card className="border-border">
                    <CardContent className="py-10 text-center text-muted-foreground">
                      Selecciona una empresa para configurar sus notificaciones.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="system" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Database className="w-5 h-5 mr-2" />
                        Información del Sistema
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Versión:</span>
                        <span className="font-medium">1.0.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base de Datos:</span>
                        <Badge className="bg-accent text-accent-foreground">PostgreSQL</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Última Actualización:</span>
                        <span className="font-medium">{new Date().toLocaleDateString('es-ES')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Respaldos:</span>
                        <Badge className="bg-accent text-accent-foreground">Automático</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Shield className="w-5 h-5 mr-2" />
                        Seguridad
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Autenticación:</span>
                        <Badge className="bg-accent text-accent-foreground">OpenID Connect</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Encriptación:</span>
                        <Badge className="bg-accent text-accent-foreground">TLS 1.3</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sesiones:</span>
                        <Badge className="bg-accent text-accent-foreground">Seguras</Badge>
                      </div>
                      <Button variant="outline" className="w-full" data-testid="button-security-audit">
                        Ejecutar Auditoría de Seguridad
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
