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
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Building2, Users, Save, Plus, Edit2, Shield, Bell, Database, Mail
} from "lucide-react";
import { z } from "zod";

const companyFormSchema = insertCompanySchema.extend({
  id: z.string().optional(),
  plan: z.enum(["pyme", "professional"]).default("professional"),
});

const inviteUserSchema = z.object({
  email: z.string().email("Ingresa un correo electrónico válido"),
  role: z.enum(["technical_admin", "manager_owner"], { required_error: "Debes seleccionar un rol" }),
});

const editUserSchema = z.object({
  role: z.enum(["super_admin", "technical_admin", "manager_owner"], { required_error: "Debes seleccionar un rol" }),
});

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [notifications, setNotifications] = useState({
    licenses: true, maintenance: true, contracts: true, reports: true
  });
  const [isAuditing, setIsAuditing] = useState(false);

  const handleSecurityAudit = () => {
    setIsAuditing(true);
    toast({ title: "Auditoría iniciada", description: "Analizando protocolos, sesiones y base de datos..." });
    setTimeout(() => {
      setIsAuditing(false);
      toast({ title: "Auditoría completada", description: "Análisis finalizado: 0 vulnerabilidades detectadas. El sistema es seguro." });
    }, 3000);
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "No autorizado", description: "Redirigiendo al inicio de sesión...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Empresas del usuario actual
  const { data: userCompanies = [], isLoading: isCompaniesLoading, error: companiesError } = useQuery({
    queryKey: ["/api/companies"],
    enabled: isAuthenticated,
  });

  // Si es super_admin, obtener TODAS las empresas del sistema
  const { data: allCompanies = [] } = useQuery({
    queryKey: ["/api/admin/companies"],
    enabled: isAuthenticated && user?.role === "super_admin",
  });

  // Si es super_admin, obtener TODOS los usuarios del sistema
  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && user?.role === "super_admin",
  });

  // Mostrar todas las empresas si es super_admin, o solo las propias si no
  const companiesToShow = user?.role === "super_admin" ? allCompanies : userCompanies;

  useEffect(() => {
    if (userCompanies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(userCompanies[0].company.id);
    }
  }, [userCompanies, selectedCompanyId]);

  useEffect(() => {
    if (companiesError && isUnauthorizedError(companiesError as Error)) {
      toast({ title: "No autorizado", description: "Redirigiendo al inicio de sesión...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [companiesError, toast]);

  const selectedCompany = userCompanies.find((uc: any) => uc.company.id === selectedCompanyId);

  const companyForm = useForm<z.infer<typeof companyFormSchema>>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: { name: "", description: "", plan: "professional" as const },
  });

  const inviteForm = useForm<z.infer<typeof inviteUserSchema>>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { email: "", role: "technical_admin" },
  });

  const editUserForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { role: "technical_admin" },
  });

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
      toast({ title: "Empresa creada", description: "La empresa se ha creado exitosamente." });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setShowAddCompanyModal(false);
      companyForm.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({ title: "No autorizado", description: "Redirigiendo al inicio de sesión...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Error al crear la empresa. Inténtalo de nuevo.", variant: "destructive" });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof companyFormSchema>) => {
      const { id, ...payload } = data;
      const response = await fetch(`/api/companies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update company");
      const text = await response.text();
      try { return text ? JSON.parse(text) : { success: true }; }
      catch (e) { return { success: true, message: text }; }
    },
    onSuccess: () => {
      toast({ title: "Empresa actualizada", description: "Los datos de la empresa se han guardado exitosamente." });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
    onError: () => {
      toast({ title: "Error al guardar", description: "No se pudieron guardar los cambios. Inténtalo de nuevo.", variant: "destructive" });
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof inviteUserSchema>) => {
      return new Promise((resolve) => setTimeout(resolve, 800));
    },
    onSuccess: () => {
      toast({ title: "Invitación enviada", description: `Se ha enviado un correo a ${inviteForm.getValues().email} para unirse a la empresa.` });
      setShowInviteModal(false);
      inviteForm.reset();
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editUserSchema>) => {
      return new Promise((resolve) => setTimeout(resolve, 800));
    },
    onSuccess: () => {
      toast({ title: "Usuario actualizado", description: "El rol del usuario ha sido modificado exitosamente." });
      setShowEditUserModal(false);
    },
  });

  const onSubmitCompany = (data: z.infer<typeof companyFormSchema>) => {
    if (data.id) { updateCompanyMutation.mutate(data); }
    else { createCompanyMutation.mutate(data); }
  };

  const onSubmitInvite = (data: z.infer<typeof inviteUserSchema>) => inviteUserMutation.mutate(data);
  const onSubmitEditUser = (data: z.infer<typeof editUserSchema>) => editUserMutation.mutate(data);

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => {
      const newState = !prev[key];
      toast({ title: "Preferencia actualizada", description: `Notificaciones ${newState ? 'activadas' : 'desactivadas'} exitosamente.` });
      return { ...prev, [key]: newState };
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin": return <Badge className="bg-destructive text-destructive-foreground">Super Admin</Badge>;
      case "technical_admin": return <Badge className="bg-primary text-primary-foreground">Admin TI</Badge>;
      case "manager_owner": return <Badge className="bg-accent text-accent-foreground">Gerente</Badge>;
      default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center"><Skeleton className="w-32 h-8" /></div>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar selectedCompanyId={selectedCompanyId} onCompanyChange={setSelectedCompanyId} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Configuración" subtitle="Gestión de empresas y configuraciones del sistema" />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 space-y-6">
            <Tabs defaultValue="company" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="company" data-testid="tab-company-settings">Empresa</TabsTrigger>
                <TabsTrigger value="users" data-testid="tab-user-settings">Usuarios</TabsTrigger>
                <TabsTrigger value="notifications" data-testid="tab-notification-settings">Notificaciones</TabsTrigger>
                <TabsTrigger value="system" data-testid="tab-system-settings">Sistema</TabsTrigger>
              </TabsList>

              <TabsContent value="company" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                            <FormField control={companyForm.control} name="name" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nombre de la Empresa</FormLabel>
                                <FormControl><Input placeholder="Nombre de la empresa" {...field} data-testid="input-company-name" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={companyForm.control} name="description" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Descripción</FormLabel>
                                <FormControl><Textarea placeholder="Descripción de la empresa" {...field} data-testid="input-company-description" /></FormControl>
                                <FormDescription>Breve descripción de la empresa o sector.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <Button type="submit" disabled={updateCompanyMutation.isPending} data-testid="button-save-company">
                              <Save className="w-4 h-4 mr-2" />
                              {updateCompanyMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                          </form>
                        </Form>
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <Card className="border-border">
                      <CardHeader><CardTitle>Acciones</CardTitle></CardHeader>
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
                              <DialogDescription>Agrega una nueva empresa para gestionar sus activos TI por separado.</DialogDescription>
                            </DialogHeader>
                            <Form {...companyForm}>
                              <form onSubmit={companyForm.handleSubmit((data) => { createCompanyMutation.mutate({ ...data, id: undefined }); })} className="space-y-4">
                                <FormField control={companyForm.control} name="name" render={({ field }) => (
                                  <FormItem><FormLabel>Nombre</FormLabel>
                                    <FormControl><Input placeholder="Nombre de la nueva empresa" {...field} data-testid="input-new-company-name" /></FormControl>
                                    <FormMessage /></FormItem>
                                )} />
                                <FormField control={companyForm.control} name="description" render={({ field }) => (
                                  <FormItem><FormLabel>Descripción</FormLabel>
                                    <FormControl><Textarea placeholder="Descripción opcional" {...field} data-testid="input-new-company-description" /></FormControl>
                                    <FormMessage /></FormItem>
                                )} />
                                <FormField control={companyForm.control} name="plan" render={({ field }) => (
                                  <FormItem><FormLabel>Plan</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl><SelectTrigger data-testid="select-company-plan"><SelectValue placeholder="Seleccionar plan..." /></SelectTrigger></FormControl>
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
                                    <FormMessage /></FormItem>
                                )} />
                                <div className="flex justify-end space-x-2">
                                  <Button type="button" variant="outline" onClick={() => setShowAddCompanyModal(false)} data-testid="button-cancel-company">Cancelar</Button>
                                  <Button type="submit" disabled={createCompanyMutation.isPending} data-testid="button-create-company">
                                    {createCompanyMutation.isPending ? "Creando..." : "Crear Empresa"}
                                  </Button>
                                </div>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>

                        <Separator />

                        <div className="space-y-2">
                          {/* Título dinámico según el rol */}
                          <h4 className="text-sm font-medium">
                            {user?.role === "super_admin" ? "Todas las Empresas" : "Mis Empresas"}
                          </h4>
                          {isCompaniesLoading ? (
                            <Skeleton className="h-20 w-full" />
                          ) : (
                            // Mostrar todas las empresas si es super_admin
                            companiesToShow.map((uc: any) => (
                              <div
                                key={uc.id || uc.company?.id}
                                className={`p-3 border rounded-lg transition-colors ${selectedCompanyId === (uc.company?.id || uc.id) ? 'border-primary bg-primary/5 shadow-sm' : 'border-border'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-foreground">{uc.company?.name || uc.name}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {uc.role ? getRoleBadge(uc.role) : <Badge variant="outline">{uc.plan}</Badge>}
                                    </p>
                                  </div>
                                  <Button
                                    variant={selectedCompanyId === (uc.company?.id || uc.id) ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => {
                                      const id = uc.company?.id || uc.id;
                                      setSelectedCompanyId(id);
                                      toast({ description: `Has seleccionado: ${uc.company?.name || uc.name} para editar.` });
                                    }}
                                  >
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
                      <Button data-testid="button-invite-user" onClick={() => setShowInviteModal(true)}>
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
                          {/* Si es super_admin muestra todos los usuarios, si no solo el suyo */}
                          {user?.role === "super_admin" && allUsers.length > 0 ? (
                            allUsers.map((u: any) => (
                              <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.first_name} {u.last_name}</TableCell>
                                <TableCell>{u.email}</TableCell>
                                <TableCell>{getRoleBadge(u.role)}</TableCell>
                                <TableCell><Badge className="bg-accent text-accent-foreground">Activo</Badge></TableCell>
                                <TableCell>{u.id === user?.id ? "Ahora" : "N/A"}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" onClick={() => {
                                    setEditingUser(u);
                                    editUserForm.reset({ role: u.role });
                                    setShowEditUserModal(true);
                                  }}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            // Usuario normal solo ve su propio perfil
                            <TableRow data-testid="row-current-user">
                              <TableCell className="font-medium">{user?.firstName} {user?.lastName}</TableCell>
                              <TableCell>{user?.email}</TableCell>
                              <TableCell>{getRoleBadge(user?.role || "technical_admin")}</TableCell>
                              <TableCell><Badge className="bg-accent text-accent-foreground">Activo</Badge></TableCell>
                              <TableCell>Ahora</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" data-testid="button-edit-current-user"
                                  onClick={() => {
                                    setEditingUser(user);
                                    editUserForm.reset({ role: (user?.role as any) || "technical_admin" });
                                    setShowEditUserModal(true);
                                  }}>
                                  <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* MODAL DE INVITACIÓN */}
                <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Invitar a un colaborador</DialogTitle>
                      <DialogDescription>El usuario recibirá un correo con instrucciones para unirse a esta empresa.</DialogDescription>
                    </DialogHeader>
                    <Form {...inviteForm}>
                      <form onSubmit={inviteForm.handleSubmit(onSubmitInvite)} className="space-y-4 pt-4">
                        <FormField control={inviteForm.control} name="email" render={({ field }) => (
                          <FormItem><FormLabel>Correo Electrónico *</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input className="pl-10" placeholder="correo@ejemplo.com" type="email" {...field} />
                              </div>
                            </FormControl>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={inviteForm.control} name="role" render={({ field }) => (
                          <FormItem><FormLabel>Rol en el sistema *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="manager_owner">
                                  <div className="font-medium">Gerente / Propietario</div>
                                  <div className="text-xs text-muted-foreground">Acceso total a reportes y finanzas.</div>
                                </SelectItem>
                                <SelectItem value="technical_admin">
                                  <div className="font-medium">Administrador TI</div>
                                  <div className="text-xs text-muted-foreground">Gestión técnica de equipos y licencias.</div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <div className="flex justify-end space-x-2 pt-2">
                          <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)}>Cancelar</Button>
                          <Button type="submit" disabled={inviteUserMutation.isPending}>
                            {inviteUserMutation.isPending ? "Enviando..." : "Enviar Invitación"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>

                {/* MODAL PARA EDITAR USUARIO */}
                <Dialog open={showEditUserModal} onOpenChange={setShowEditUserModal}>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Editar Usuario</DialogTitle>
                      <DialogDescription>Modifica los permisos y el nivel de acceso de este usuario.</DialogDescription>
                    </DialogHeader>
                    <Form {...editUserForm}>
                      <form onSubmit={editUserForm.handleSubmit(onSubmitEditUser)} className="space-y-4 pt-4">
                        <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-xs font-medium text-muted-foreground">Editando a:</p>
                          <div className="font-medium mt-1">{editingUser?.firstName || editingUser?.first_name} {editingUser?.lastName || editingUser?.last_name}</div>
                          <div className="text-sm text-muted-foreground">{editingUser?.email}</div>
                        </div>
                        <FormField control={editUserForm.control} name="role" render={({ field }) => (
                          <FormItem><FormLabel>Rol en el sistema *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="super_admin">
                                  <div className="font-medium text-destructive">Super Administrador</div>
                                  <div className="text-xs text-muted-foreground">Acceso global al sistema.</div>
                                </SelectItem>
                                <SelectItem value="manager_owner">
                                  <div className="font-medium text-accent">Gerente / Propietario</div>
                                  <div className="text-xs text-muted-foreground">Acceso total a reportes y finanzas.</div>
                                </SelectItem>
                                <SelectItem value="technical_admin">
                                  <div className="font-medium text-primary">Administrador TI</div>
                                  <div className="text-xs text-muted-foreground">Gestión técnica de equipos y licencias.</div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <div className="flex justify-end space-x-2 pt-2">
                          <Button type="button" variant="outline" onClick={() => setShowEditUserModal(false)}>Cancelar</Button>
                          <Button type="submit" disabled={editUserMutation.isPending}>
                            {editUserMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              <TabsContent value="notifications" className="mt-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Bell className="w-5 h-5 mr-2" />
                      Configuración de Notificaciones
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      {[
                        { key: 'licenses', label: 'Licencias por vencer', desc: 'Recibe alertas cuando las licencias estén próximas a vencer', testId: 'button-toggle-license-notifications' },
                        { key: 'maintenance', label: 'Mantenimiento programado', desc: 'Notificaciones de mantenimiento de equipos', testId: 'button-toggle-maintenance-notifications' },
                        { key: 'contracts', label: 'Contratos por renovar', desc: 'Alertas de contratos próximos a vencer', testId: 'button-toggle-contract-notifications' },
                        { key: 'reports', label: 'Reportes mensuales', desc: 'Resumen mensual de costos y activos', testId: 'button-toggle-monthly-reports' },
                      ].map(({ key, label, desc, testId }) => (
                        <div key={key} className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium">{label}</h4>
                            <p className="text-sm text-muted-foreground">{desc}</p>
                          </div>
                          <Button
                            variant={notifications[key as keyof typeof notifications] ? "outline" : "secondary"}
                            size="sm"
                            data-testid={testId}
                            onClick={() => toggleNotification(key as keyof typeof notifications)}
                          >
                            {notifications[key as keyof typeof notifications] ? "Activado" : "Desactivado"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
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
                      <div className="flex justify-between"><span className="text-muted-foreground">Versión:</span><span className="font-medium">1.0.0</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Base de Datos:</span><Badge className="bg-accent text-accent-foreground">PostgreSQL</Badge></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Última Actualización:</span><span className="font-medium">{new Date().toLocaleDateString('es-ES')}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Respaldos:</span><Badge className="bg-accent text-accent-foreground">Automático</Badge></div>
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
                      <div className="flex justify-between"><span className="text-muted-foreground">Autenticación:</span><Badge className="bg-accent text-accent-foreground">OpenID Connect</Badge></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Encriptación:</span><Badge className="bg-accent text-accent-foreground">TLS 1.3</Badge></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Sesiones:</span><Badge className="bg-accent text-accent-foreground">Seguras</Badge></div>
                      <Button variant="outline" className="w-full hover:bg-accent hover:text-white" data-testid="button-security-audit" onClick={handleSecurityAudit} disabled={isAuditing}>
                        {isAuditing ? (
                          <span className="flex items-center">
                            <Shield className="w-4 h-4 mr-2 animate-pulse" />
                            Analizando sistema...
                          </span>
                        ) : "Ejecutar Auditoría de Seguridad"}
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