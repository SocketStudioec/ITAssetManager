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
import { Plus, Search, Filter, Edit2, Trash2, Calendar, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContractSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Contracts() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [contractToEdit, setContractToEdit] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  const { data: contracts = [], isLoading: isContractsLoading, error: contractsError } = useQuery({
    queryKey: ["/api/contracts", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  // Form para crear
  const form = useForm({
    resolver: zodResolver(insertContractSchema),
    defaultValues: {
      companyId: "",
      name: "",
      vendor: "",
      description: "",
      contractType: "",
      startDate: null as any,
      endDate: null as any,
      renewalDate: null as any,
      monthlyCost: 0,
      annualCost: 0,
      status: "active",
      autoRenewal: false,
      notes: ""
    }
  });

  // Form para editar
  const editForm = useForm({
    resolver: zodResolver(insertContractSchema),
    defaultValues: {
      companyId: "",
      name: "",
      vendor: "",
      description: "",
      contractType: "",
      startDate: null as any,
      endDate: null as any,
      renewalDate: null as any,
      monthlyCost: 0,
      annualCost: 0,
      status: "active",
      autoRenewal: false,
      notes: ""
    }
  });

  useEffect(() => {
    if (selectedCompanyId) {
      form.setValue("companyId", selectedCompanyId);
    }
  }, [selectedCompanyId, form]);

  const createContractMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar en base de datos");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedCompanyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }); // ← agregar esto
      toast({ title: "¡Éxito!", description: "El contrato se guardó correctamente." });
      setIsCreateModalOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar el contrato.", variant: "destructive" });
    }
  });

  const updateContractMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/contracts/${contractToEdit.id}/${selectedCompanyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedCompanyId] });
      toast({ title: "¡Éxito!", description: "El contrato se actualizó correctamente." });
      setIsEditModalOpen(false);
      setContractToEdit(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el contrato.", variant: "destructive" });
    }
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const res = await fetch(`/api/contracts/${contractId}/${selectedCompanyId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error al eliminar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", selectedCompanyId] });
      toast({ title: "¡Éxito!", description: "El contrato se eliminó correctamente." });
      setShowDeleteDialog(false);
      setContractToDelete(null);
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar el contrato.", variant: "destructive" });
    }
  });

  const handleEdit = (contract: any) => {
    setContractToEdit(contract);
    editForm.reset({
      companyId: selectedCompanyId,
      name: contract.name,
      vendor: contract.vendor,
      description: contract.description || "",
      contractType: contract.contract_type || contract.contractType || "",
      startDate: contract.start_date || contract.startDate,
      endDate: contract.end_date || contract.endDate,
      renewalDate: contract.renewal_date || contract.renewalDate || null,
      monthlyCost: Number(contract.monthly_cost || contract.monthlyCost || 0),
      annualCost: Number(contract.annual_cost || contract.annualCost || 0),
      status: contract.status,
      autoRenewal: contract.auto_renewal || contract.autoRenewal || false,
      notes: contract.notes || ""
    });
    setIsEditModalOpen(true);
  };

  const onSubmit = (data: any) => {
    createContractMutation.mutate(data);
  };

  useEffect(() => {
    if (contractsError && isUnauthorizedError(contractsError as Error)) {
      window.location.href = "/api/login";
    }
  }, [contractsError]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center"><Skeleton className="w-32 h-8" /></div>;
  }

  const filteredContracts = contracts.filter((contract: any) => {
    const type = contract.contract_type || contract.contractType || "";
    return contract.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contract.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getStatusBadge = (status: string, endDateStr: string) => {
    if (!endDateStr) return <Badge variant="outline">{status}</Badge>;
    const daysUntilExpiry = Math.ceil((new Date(endDateStr).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (status === "expired" || daysUntilExpiry < 0) return <Badge className="bg-destructive text-destructive-foreground">Expirado</Badge>;
    if (status === "cancelled") return <Badge variant="secondary">Cancelado</Badge>;
    if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) return <Badge className="bg-chart-3 text-white">Por Vencer</Badge>;
    if (status === "active") return <Badge className="bg-accent text-accent-foreground">Activo</Badge>;
    if (status === "pending_renewal") return <Badge className="bg-chart-4 text-white">Pendiente Renovación</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return new Date(date.getTime() + Math.abs(date.getTimezoneOffset() * 60000)).toLocaleDateString('es-ES');
  };

  return (
    <div className="flex h-screen">
      <Sidebar selectedCompanyId={selectedCompanyId} onCompanyChange={setSelectedCompanyId} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Contratos TI" subtitle="Gestión de contratos y acuerdos de servicios" />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Contratos</p>
                      <p className="text-2xl font-bold text-foreground">{isContractsLoading ? "..." : contracts.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Activos</p>
                      <p className="text-2xl font-bold text-foreground">{isContractsLoading ? "..." : contracts.filter((c: any) => c.status === "active").length}</p>
                    </div>
                    <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
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
                        {isContractsLoading ? "..." : contracts.filter((c: any) => {
                          const endD = c.end_date || c.endDate;
                          if (!endD) return false;
                          const daysUntil = Math.ceil((new Date(endD).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          return daysUntil <= 30 && daysUntil > 0;
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
                        ${isContractsLoading ? "..." : contracts.reduce((sum: number, c: any) => sum + Number(c.monthly_cost || c.monthlyCost || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-chart-2 rounded-lg flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Lista de Contratos</CardTitle>
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Buscar contratos..."
                        className="pl-10 w-80"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Button onClick={() => setIsCreateModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nuevo Contrato
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
                        <TableHead>Fecha Inicio</TableHead>
                        <TableHead>Fecha Fin</TableHead>
                        <TableHead>Costo Mensual</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isContractsLoading ? (
                        <TableRow><TableCell colSpan={8}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                      ) : filteredContracts.length > 0 ? (
                        filteredContracts.map((contract: any) => {
                          const type = contract.contract_type || contract.contractType || "N/A";
                          const startD = contract.start_date || contract.startDate;
                          const endD = contract.end_date || contract.endDate;
                          const cost = contract.monthly_cost || contract.monthlyCost || 0;

                          return (
                            <TableRow key={contract.id}>
                              <TableCell className="font-medium">{contract.name}</TableCell>
                              <TableCell>{contract.vendor}</TableCell>
                              <TableCell><Badge variant="outline">{type}</Badge></TableCell>
                              <TableCell>{formatDate(startD)}</TableCell>
                              <TableCell>{formatDate(endD)}</TableCell>
                              <TableCell>${Number(cost).toLocaleString()}</TableCell>
                              <TableCell>{getStatusBadge(contract.status, endD)}</TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button variant="ghost" size="sm" onClick={() => handleEdit(contract)}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setContractToDelete(contract);
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
                          <TableCell colSpan={8} className="text-center py-8">
                            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Calendar className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron contratos</h3>
                            <p className="text-muted-foreground mb-6">Comienza agregando tu primer contrato.</p>
                            <Button onClick={() => setIsCreateModalOpen(true)}>
                              <Plus className="w-4 h-4 mr-2" />
                              Agregar Primer Contrato
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
                <DialogTitle>Crear Nuevo Contrato</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Nombre del Contrato *</FormLabel>
                        <FormControl><Input placeholder="Ej. Soporte AWS" {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="vendor" render={({ field }) => (
                      <FormItem><FormLabel>Proveedor *</FormLabel>
                        <FormControl><Input placeholder="Ej. Amazon" {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="contractType" render={({ field }) => (
                      <FormItem><FormLabel>Tipo de Contrato *</FormLabel>
                        <FormControl><Input placeholder="Soporte, Hosting..." {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem><FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="pending_renewal">Pendiente de Renovación</SelectItem>
                            <SelectItem value="expired">Expirado</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="startDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de Inicio *</FormLabel>
                        <FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="endDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de Fin *</FormLabel>
                        <FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="renewalDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de Renovación</FormLabel>
                        <FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="autoRenewal" render={({ field }) => (
                      <FormItem><FormLabel>¿Renovación Automática?</FormLabel>
                        <Select onValueChange={(val) => field.onChange(val === "true")} defaultValue={field.value ? "true" : "false"}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="true">Sí</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
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
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem className="col-span-2"><FormLabel>Descripción</FormLabel>
                        <FormControl><Input placeholder="Breve resumen..." {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem className="col-span-2"><FormLabel>Notas Internas</FormLabel>
                        <FormControl><Input placeholder="Observaciones..." {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end pt-4 space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createContractMutation.isPending}>
                      {createContractMutation.isPending ? "Guardando..." : "Guardar Contrato"}
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
                <DialogTitle>Editar Contrato</DialogTitle>
              </DialogHeader>
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit((data) => updateContractMutation.mutate(data))} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={editForm.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Nombre del Contrato *</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="vendor" render={({ field }) => (
                      <FormItem><FormLabel>Proveedor *</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="contractType" render={({ field }) => (
                      <FormItem><FormLabel>Tipo de Contrato *</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="status" render={({ field }) => (
                      <FormItem><FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="pending_renewal">Pendiente de Renovación</SelectItem>
                            <SelectItem value="expired">Expirado</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="startDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de Inicio *</FormLabel>
                        <FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="endDate" render={({ field }) => (
                      <FormItem><FormLabel>Fecha de Fin *</FormLabel>
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
                    <FormField control={editForm.control} name="description" render={({ field }) => (
                      <FormItem className="col-span-2"><FormLabel>Descripción</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                    <FormField control={editForm.control} name="notes" render={({ field }) => (
                      <FormItem className="col-span-2"><FormLabel>Notas</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                        <FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end pt-4 space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={updateContractMutation.isPending}>
                      {updateContractMutation.isPending ? "Guardando..." : "Guardar Cambios"}
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
                ¿Estás seguro de que deseas eliminar el contrato <strong>{contractToDelete?.name}</strong>? Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteContractMutation.mutate(contractToDelete?.id)}
                  disabled={deleteContractMutation.isPending}
                >
                  {deleteContractMutation.isPending ? "Eliminando..." : "Eliminar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        </main>
      </div>
    </div>
  );
}