import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Edit2, Trash2, Key, Users, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLicenseSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Licenses() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [licenseToEdit, setLicenseToEdit] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [licenseToDelete, setLicenseToDelete] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);


  //Nuevos Estados 
  const [selectedDuration, setSelectedDuration] = useState<string>("");
  const [selectedEditDuration, setSelectedEditDuration] = useState<string>("");




  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/api/login";
    }
  }, [isAuthenticated, isLoading]);

  const { data: supportStatus } = useQuery({
    queryKey: ["/api/admin/support-status"],
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 10000,
  });

  const { data: userCompanies = [] } = useQuery({
    queryKey: ["/api/companies"],
    enabled: isAuthenticated && !supportStatus?.supportMode,
  });

  const companies = supportStatus?.supportMode
    ? [{ company: supportStatus.company }]
    : userCompanies;

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].company.id);
    }
  }, [companies, selectedCompanyId]);

  const { data: licenses = [], isLoading: isLicensesLoading, error: licensesError } = useQuery({
    queryKey: ["/api/licenses", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  // Form para crear
  const form = useForm({
    resolver: zodResolver(insertLicenseSchema),
    defaultValues: {
      companyId: "",
      name: "",
      vendor: "",
      licenseKey: "",
      licenseType: "",
      currentUsers: 0,
      maxUsers: 0,
      monthlyCost: 0,
      annualCost: 0,
      purchaseDate: null,
      expiryDate: null,
      status: "active",
      notes: ""
    }
  });

  // Form para editar
  const editForm = useForm({
    resolver: zodResolver(insertLicenseSchema),
    defaultValues: {
      companyId: "",
      name: "",
      vendor: "",
      licenseKey: "",
      licenseType: "",
      currentUsers: 0,
      maxUsers: 0,
      monthlyCost: 0,
      annualCost: 0,
      purchaseDate: null,
      expiryDate: null,
      status: "active",
      notes: ""
    }
  });

  useEffect(() => {
    if (selectedCompanyId) {
      form.setValue("companyId", selectedCompanyId);
    }
  }, [selectedCompanyId, form]);

  const createLicenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar en base de datos");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses", selectedCompanyId] });
      toast({ title: "¡Éxito!", description: "La Membresía se guardó correctamente." });
      setIsCreateModalOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar la Membresía.", variant: "destructive" });
    }
  });

  const updateLicenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/licenses/${licenseToEdit.id}/${selectedCompanyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses", selectedCompanyId] });
      toast({ title: "¡Éxito!", description: "La Membresía se actualizó correctamente." });
      setIsEditModalOpen(false);
      setLicenseToEdit(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la Membresía.", variant: "destructive" });
    }
  });

  const deleteLicenseMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      const res = await fetch(`/api/licenses/${licenseId}/${selectedCompanyId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error al eliminar");
      try {
        return await res.json();
      } catch {
        return {};
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/licenses"] });
      queryClient.refetchQueries({ queryKey: ["/api/licenses", selectedCompanyId] });
      toast({ title: "¡Éxito!", description: "La Membresía se eliminó correctamente." });
      setShowDeleteDialog(false);
      setLicenseToDelete(null);
    },
    onError: (error: any) => {
      console.error("Delete error:", error);
      toast({ title: "Error", description: error.message || "No se pudo eliminar la Membresía.", variant: "destructive" });
    }
  });

  const handleEdit = (license: any) => {
    setLicenseToEdit(license);
    editForm.reset({
      companyId: selectedCompanyId,
      name: license.name,
      vendor: license.vendor,
      licenseKey: license.license_key || license.licenseKey || "",
      licenseType: license.license_type || license.licenseType || "",
      currentUsers: Number(license.current_users ?? license.currentUsers ?? 0),
      maxUsers: Number(license.max_users ?? license.maxUsers ?? 0),
      monthlyCost: Number(license.monthly_cost || license.monthlyCost || 0),
      annualCost: Number(license.annual_cost || license.annualCost || 0),
      purchaseDate: license.purchase_date || license.purchaseDate || null,
      expiryDate: license.expiry_date || license.expiryDate || null,
      status: license.status,
      notes: license.notes || ""
    });
    setIsEditModalOpen(true);
  };

  const onSubmit = (data: any) => {
    createLicenseMutation.mutate(data);
  };

  useEffect(() => {
    if (licensesError && isUnauthorizedError(licensesError as Error)) {
      window.location.href = "/api/login";
    }
  }, [licensesError]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center"><Skeleton className="w-32 h-8" /></div>;
  }

  const filteredLicenses = licenses.filter((license: any) => {
    const type = license.license_type || license.licenseType || "";
    return license.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      license.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.toLowerCase().includes(searchTerm.toLowerCase());
  });


  const getStatusBadge = (status: string, expiryDate: string) => {
    if (!expiryDate) return <Badge className="bg-accent text-accent-foreground">Perpetua</Badge>;
    const daysUntilExpiry = Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry < 0) return <Badge className="bg-destructive text-destructive-foreground">Expirada</Badge>;
    if (daysUntilExpiry <= 7) return <Badge className="bg-chart-3 text-white">Por Vencer</Badge>;
    if (status === "active") return <Badge className="bg-accent text-accent-foreground">Activa</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return new Date(date.getTime() + Math.abs(date.getTimezoneOffset() * 60000)).toLocaleDateString('es-ES');
  };

  const calculateUsagePercentage = (current: number, max: number) => {
    if (!max || max === 0) return 0;
    return Math.min((current / max) * 100, 100);
  };


  //Nueva funcion en base a los estdos añadidos
  const calculateExpiryDate = (purchaseDate: string, duration: string): string => {
    const date = new Date(purchaseDate);
    switch (duration) {
      case "mensual": date.setMonth(date.getMonth() + 1); break;
      case "trimestral": date.setMonth(date.getMonth() + 3); break;
      case "semestral": date.setMonth(date.getMonth() + 6); break;
      case "anual": date.setFullYear(date.getFullYear() + 1); break;
    }
    return date.toISOString();
  }








  return (
    <div className="flex h-screen">
      <Sidebar selectedCompanyId={selectedCompanyId} onCompanyChange={setSelectedCompanyId} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Membresías" subtitle="Gestión y seguimiento de membresías" />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total de membresías</p>
                      <p className="text-2xl font-bold text-foreground">{isLicensesLoading ? "..." : licenses.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                      <Key className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Activas</p>
                      <p className="text-2xl font-bold text-foreground">{isLicensesLoading ? "..." : licenses.filter((l: any) => l.status === "active").length}</p>
                    </div>
                    <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
                      <Key className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Por Vencer</p>
                      <p className="text-2xl font-bold text-foreground">
                        {isLicensesLoading ? "..." : licenses.filter((l: any) => {
                          const expDate = l.expiry_date || l.expiryDate;
                          if (!expDate) return false;
                          const daysUntil = Math.ceil((new Date(expDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          return daysUntil <= 7 && daysUntil > 0;
                        }).length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-chart-3 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Costo Mensual</p>
                      <p className="text-2xl font-bold text-foreground">
                        ${isLicensesLoading ? "..." : licenses.reduce((sum: number, l: any) => sum + Number(l.monthly_cost || l.monthlyCost || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-chart-2 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de membresías</CardTitle>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Buscar membresías..."
                        className="pl-10 w-80"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nueva Membresía
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Uso</TableHead>
                        <TableHead>Compra</TableHead>
                        <TableHead>Expiración</TableHead>
                        <TableHead>Costo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLicensesLoading ? (
                        <TableRow><TableCell colSpan={9}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                      ) : filteredLicenses.length > 0 ? (
                        filteredLicenses.map((license: any) => {
                          const currentUsers = license.current_users ?? license.currentUsers ?? 0;
                          const maxUsers = license.max_users ?? license.maxUsers ?? 0;
                          const purchaseDate = license.purchase_date || license.purchaseDate;
                          const expiryDate = license.expiry_date || license.expiryDate;
                          const monthlyCost = license.monthly_cost || license.monthlyCost || 0;
                          const licenseType = license.license_type || license.licenseType || "N/A";

                          return (
                            <TableRow key={license.id}>
                              <TableCell className="font-medium">{license.name}</TableCell>
                              <TableCell>{license.vendor}</TableCell>
                              <TableCell><Badge variant="outline">{licenseType}</Badge></TableCell>
                              <TableCell>
                                <div className="space-y-1 w-24">
                                  <div className="flex justify-between text-xs">
                                    <span>{currentUsers}</span>
                                    <span>{maxUsers || "∞"}</span>
                                  </div>
                                  {(maxUsers > 0) && (
                                    <Progress value={calculateUsagePercentage(currentUsers, maxUsers)} className="h-2" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{formatDate(purchaseDate)}</TableCell>
                              <TableCell>{formatDate(expiryDate)}</TableCell>
                              <TableCell>${Number(monthlyCost).toLocaleString()}</TableCell>
                              <TableCell>{getStatusBadge(license.status, expiryDate)}</TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button variant="ghost" size="sm" onClick={() => handleEdit(license)}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setLicenseToDelete(license);
                                      setShowDeleteDialog(true);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8">
                            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Key className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron membresías</h3>
                            <p className="text-muted-foreground mb-6">Comienza agregando tu primera membresía.</p>
                            <Button onClick={() => setIsCreateModalOpen(true)}>
                              <Plus className="w-4 h-4 mr-2" />
                              Agregar Primera Membresía
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* MODAL CREAR */}
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Nueva membresía</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Nombre de la Membresía *</FormLabel>
                        <FormControl><Input placeholder="Ej. Microsoft 365" {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="vendor" render={({ field }) => (
                      <FormItem><FormLabel>Proveedor *</FormLabel>
                        <FormControl><Input placeholder="Ej. Microsoft" {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="licenseType" render={({ field }) => (
                      <FormItem><FormLabel>Tipo</FormLabel>
                        <FormControl><Input placeholder="Ej. SaaS, Perpetua..." {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="licenseKey" render={({ field }) => (
                      <FormItem><FormLabel>Clave (Key)</FormLabel>
                        <FormControl><Input placeholder="XXXX-XXXX-XXXX" {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="currentUsers" render={({ field }) => (
                      <FormItem><FormLabel>Usuarios Actuales</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} onFocus={(e) => e.target.select()} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="maxUsers" render={({ field }) => (
                      <FormItem><FormLabel>Límite de Usuarios</FormLabel>
                        <FormControl><Input type="number" placeholder="0 si es ilimitado" {...field} onChange={e => field.onChange(Number(e.target.value))} onFocus={(e) => e.target.select()} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    {/* <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de Compra</FormLabel>
                        <FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} /></FormControl>
                        <FormMessage /></FormItem>
                    )} /> */}


                    {/* Nuevo Form patra la fecha de expiracion */}
                    <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de Compra</FormLabel>
                        <FormControl>
                          <Input type="date"
                            value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""}
                            onChange={(e) => {
                              const iso = e.target.value ? new Date(e.target.value).toISOString() : null;
                              field.onChange(iso);
                              if (iso && selectedDuration) {
                                form.setValue("expiryDate", calculateExpiryDate(iso, selectedDuration));
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage /></FormItem>
                    )} />


                    <FormItem>
                      <FormLabel>Duración</FormLabel>
                      <Select onValueChange={(val) => {
                        setSelectedDuration(val);
                        const purchaseDate = form.getValues("purchaseDate");
                        if (purchaseDate) {
                          form.setValue("expiryDate", calculateExpiryDate(purchaseDate, val));
                        }
                      }} value={selectedDuration}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar duración..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensual">Mensual (1 mes)</SelectItem>
                          <SelectItem value="trimestral">Trimestral (3 meses)</SelectItem>
                          <SelectItem value="semestral">Semestral (6 meses)</SelectItem>
                          <SelectItem value="anual">Anual (12 meses)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>




                    <FormField control={form.control} name="expiryDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de Expiración</FormLabel>
                        <FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="monthlyCost" render={({ field }) => (
                      <FormItem><FormLabel>Costo Mensual ($)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} onFocus={(e) => e.target.select()} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="annualCost" render={({ field }) => (
                      <FormItem><FormLabel>Costo Anual ($)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} onFocus={(e) => e.target.select()} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem><FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="active">Activa</SelectItem>
                            <SelectItem value="inactive">Inactiva</SelectItem>
                            <SelectItem value="deprecated">Obsoleta</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem><FormLabel>Notas</FormLabel>
                        <FormControl><Input placeholder="Detalles adicionales..." {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end pt-4 space-x-2">
                    {/*}
                    <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
                   */}
                    <Button type="button" variant="outline" onClick={() => { setIsCreateModalOpen(false); setSelectedDuration(""); form.reset(); }}>Cancelar</Button>

                    <Button type="submit" disabled={createLicenseMutation.isPending}>
                      {createLicenseMutation.isPending ? "Guardando..." : "Guardar Membresía"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* MODAL EDITAR */}
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar Membresía</DialogTitle>
              </DialogHeader>
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit((data) => updateLicenseMutation.mutate(data))} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Nombre de la Membresía *</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="vendor" render={({ field }) => (
                      <FormItem><FormLabel>Proveedor *</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="licenseType" render={({ field }) => (
                      <FormItem><FormLabel>Tipo</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="licenseKey" render={({ field }) => (
                      <FormItem><FormLabel>Clave (Key)</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="currentUsers" render={({ field }) => (
                      <FormItem><FormLabel>Usuarios Actuales</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} onFocus={(e) => e.target.select()} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="maxUsers" render={({ field }) => (
                      <FormItem><FormLabel>Límite de Usuarios</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} onFocus={(e) => e.target.select()} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />

                    {/*
                    <FormField control={editForm.control} name="purchaseDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de Compra</FormLabel>
                        <FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} /></FormControl>
                        <FormMessage /></FormItem>
                    )} /> 
                     */}

                    <FormField control={editForm.control} name="purchaseDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de Compra</FormLabel>
                        <FormControl>
                          <Input type="date"
                            value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""}
                            onChange={(e) => {
                              const iso = e.target.value ? new Date(e.target.value).toISOString() : null;
                              field.onChange(iso);
                              if (iso && selectedEditDuration) {
                                editForm.setValue("expiryDate", calculateExpiryDate(iso, selectedEditDuration));
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage /></FormItem>
                    )} />

                    {/* Duración en editar */}
                    <FormItem>
                      <FormLabel>Duración</FormLabel>
                      <Select onValueChange={(val) => {
                        setSelectedEditDuration(val);
                        const purchaseDate = editForm.getValues("purchaseDate");
                        if (purchaseDate) {
                          editForm.setValue("expiryDate", calculateExpiryDate(purchaseDate, val));
                        }
                      }} value={selectedEditDuration}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar duración..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensual">Mensual (1 mes)</SelectItem>
                          <SelectItem value="trimestral">Trimestral (3 meses)</SelectItem>
                          <SelectItem value="semestral">Semestral (6 meses)</SelectItem>
                          <SelectItem value="anual">Anual (12 meses)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>







                    <FormField control={editForm.control} name="expiryDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de Expiración</FormLabel>
                        <FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="monthlyCost" render={({ field }) => (
                      <FormItem><FormLabel>Costo Mensual ($)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} onFocus={(e) => e.target.select()} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="annualCost" render={({ field }) => (
                      <FormItem><FormLabel>Costo Anual ($)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(Number(e.target.value))} onFocus={(e) => e.target.select()} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="status" render={({ field }) => (
                      <FormItem><FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="active">Activa</SelectItem>
                            <SelectItem value="inactive">Inactiva</SelectItem>
                            <SelectItem value="deprecated">Obsoleta</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="notes" render={({ field }) => (
                      <FormItem><FormLabel>Notas</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end pt-4 space-x-2">
                    {/*}
                    <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                   */}
                   <Button type="button" variant="outline" onClick={() => { setIsEditModalOpen(false); setSelectedEditDuration(""); }}>Cancelar</Button>
                    <Button type="submit" disabled={updateLicenseMutation.isPending}>
                      {updateLicenseMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {/* DIALOG ELIMINAR */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Confirmar Eliminación
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                ¿Estás seguro de que deseas eliminar esta Membresía <strong>{licenseToDelete?.name}</strong>? Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteLicenseMutation.mutate(licenseToDelete?.id)}
                  disabled={deleteLicenseMutation.isPending}
                >
                  {deleteLicenseMutation.isPending ? "Eliminando..." : "Eliminar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        </main>
      </div>
    </div>
  );
}