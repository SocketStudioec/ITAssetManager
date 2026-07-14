import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import ContractExtrasModal from "@/components/modals/contract-extras-modal";
import { usePersistedCompany } from "@/hooks/usePersistedCompany";
import {
  AlertTriangle,
  Calendar,
  DollarSign,
  Edit2,
  FileText,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

type ContractFormState = {
  name: string;
  vendor: string;
  contractType: string;
  description: string;
  startDate: string;
  endDate: string;
  renewalDate: string;
  monthlyCost: string;
  autoRenewal: boolean;
  notes: string;
  assetIds: string[];
};

const contractTypeLabels: Record<string, string> = {
  maintenance: "Mantenimiento",
  support: "Soporte",
  service: "Servicio",
  lease: "Arrendamiento",
  hosting: "Hosting",
  other: "Otro",
};

const getTodayInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getEmptyForm = (): ContractFormState => ({
  name: "",
  vendor: "",
  contractType: "",
  description: "",
  startDate: getTodayInputValue(),
  endDate: "",
  renewalDate: "",
  monthlyCost: "",
  autoRenewal: false,
  notes: "",
  assetIds: [],
});

const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  return value.slice(0, 10);
};

const getDaysUntil = (dateValue?: string | null) => {
  if (!dateValue) return null;

  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  const targetDay = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  const currentDay = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return Math.round((targetDay - currentDay) / (1000 * 60 * 60 * 24));
};

const isContractExpiring = (contract: any) => {
  const endDays = getDaysUntil(contract.endDate);
  const renewalDays = getDaysUntil(contract.renewalDate);

  return (
    (endDays !== null && endDays > 0 && endDays <= 30) ||
    (renewalDays !== null && renewalDays > 0 && renewalDays <= 30)
  );
};

const isContractExpired = (contract: any) => {
  const endDays = getDaysUntil(contract.endDate);
  return contract.status === "expired" || (endDays !== null && endDays < 0);
};

const formatDate = (dateValue?: string | null) => {
  if (!dateValue) return "—";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("es-ES", {
    timeZone: "UTC",
  });
};

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export default function Contracts() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = usePersistedCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [assetSearchTerm, setAssetSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [contractToDelete, setContractToDelete] = useState<any>(null);
  // Rediseño 2026-07: modal de documento del contrato + contactos de soporte
  const [contractForExtras, setContractForExtras] = useState<any>(null);
  const [form, setForm] = useState<ContractFormState>(getEmptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: supportStatus } = useQuery<any>({
    queryKey: ["/api/admin/support-status"],
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 10000,
  });

  const { data: userCompanies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    enabled: isAuthenticated && !supportStatus?.supportMode,
  });

  const companies = supportStatus?.supportMode
    ? [{ company: supportStatus.company }]
    : userCompanies;

  useEffect(() => {
    if (companies.length > 0 && !companies.some((uc: any) => uc.company.id === selectedCompanyId)) {
      setSelectedCompanyId(companies[0].company.id);
    }
  }, [companies, selectedCompanyId]);

  const {
    data: contracts = [],
    isLoading: isContractsLoading,
    error: contractsError,
  } = useQuery<any[]>({
    queryKey: ["/api/contracts", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  const {
    data: assets = [],
    isLoading: isAssetsLoading,
  } = useQuery<any[]>({
    queryKey: ["/api/assets", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (contractsError && isUnauthorizedError(contractsError as Error)) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al inicio de sesión...",
        variant: "destructive",
      });

      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [contractsError, toast]);

  const resetForm = () => {
    setForm(getEmptyForm());
    setFormErrors({});
    setAssetSearchTerm("");
    setEditingContract(null);
  };

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);

    if (!open) {
      resetForm();
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (contract: any) => {
    setEditingContract(contract);
    setForm({
      name: contract.name || "",
      vendor: contract.vendor || "",
      contractType: contract.contractType || "",
      description: contract.description || "",
      startDate: toDateInputValue(contract.startDate),
      endDate: toDateInputValue(contract.endDate),
      renewalDate: toDateInputValue(contract.renewalDate),
      monthlyCost:
        contract.monthlyCost === null || contract.monthlyCost === undefined
          ? ""
          : String(contract.monthlyCost),
      autoRenewal: Boolean(contract.autoRenewal),
      notes: contract.notes || "",
      assetIds: Array.isArray(contract.linkedAssets)
        ? contract.linkedAssets.map((asset: any) => String(asset.id))
        : [],
    });
    setFormErrors({});
    setAssetSearchTerm("");
    setIsDialogOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors.name = "Ingresa el nombre del contrato.";
    }

    if (!form.vendor.trim()) {
      errors.vendor = "Ingresa el proveedor.";
    }

    if (!form.contractType) {
      errors.contractType = "Selecciona el tipo de contrato.";
    }

    if (!form.startDate) {
      errors.startDate = "Selecciona la fecha de inicio.";
    }

    if (!form.endDate) {
      errors.endDate = "Selecciona la fecha de fin.";
    }

    if (
      form.startDate &&
      form.endDate &&
      new Date(form.endDate).getTime() < new Date(form.startDate).getTime()
    ) {
      errors.endDate =
        "La fecha de fin debe ser igual o posterior a la fecha de inicio.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        companyId: selectedCompanyId,
        name: form.name.trim(),
        vendor: form.vendor.trim(),
        contractType: form.contractType,
        description: form.description.trim(),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        renewalDate: form.renewalDate
          ? new Date(form.renewalDate).toISOString()
          : null,
        monthlyCost: Number(form.monthlyCost || 0),
        autoRenewal: form.autoRenewal,
        notes: form.notes.trim(),
        assetIds: form.assetIds,
      };

      if (editingContract) {
        return apiRequest("PUT", `/api/contracts/${editingContract.id}`, body);
      }

      return apiRequest("POST", "/api/contracts", body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/contracts", selectedCompanyId],
      });

      toast({
        title: editingContract ? "Contrato actualizado" : "Contrato registrado",
        description: editingContract
          ? "Los cambios se guardaron correctamente."
          : "El contrato se registró correctamente.",
      });

      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "No se pudo guardar el contrato",
        description:
          error.message ||
          "Revisa la información e intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (contract: any) =>
      apiRequest(
        "DELETE",
        `/api/contracts/${contract.id}/${selectedCompanyId}`,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/contracts", selectedCompanyId],
      });

      toast({
        title: "Contrato eliminado",
        description: "El contrato se eliminó correctamente.",
      });

      setContractToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "No se pudo eliminar el contrato",
        description:
          error.message ||
          "Intenta nuevamente en unos momentos.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!validateForm()) return;
    saveMutation.mutate();
  };

  const handleAssetChange = (assetId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      assetIds: checked
        ? Array.from(new Set([...current.assetIds, assetId]))
        : current.assetIds.filter((id) => id !== assetId),
    }));
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredContracts = contracts.filter((contract: any) => {
    const name = String(contract.name || "").toLowerCase();
    const vendor = String(contract.vendor || "").toLowerCase();

    return (
      name.includes(normalizedSearchTerm) ||
      vendor.includes(normalizedSearchTerm)
    );
  });

  const normalizedAssetSearch = assetSearchTerm.trim().toLowerCase();
  const filteredAssets = assets.filter((asset: any) =>
    String(asset.name || "")
      .toLowerCase()
      .includes(normalizedAssetSearch),
  );
  const physicalAssets = filteredAssets.filter(
    (asset: any) => asset.type === "physical",
  );
  const applicationAssets = filteredAssets.filter(
    (asset: any) => asset.type === "application",
  );

  const activeContracts = contracts.filter(
    (contract: any) => contract.status === "active",
  ).length;
  const expiringContracts = contracts.filter(isContractExpiring).length;
  const totalMonthlyCost = contracts.reduce(
    (total: number, contract: any) =>
      total + Number(contract.monthlyCost || 0),
    0,
  );

  const getStatusBadge = (contract: any) => {
    if (contract.status === "cancelled") {
      return (
        <Badge
          variant="secondary"
          data-testid={`badge-status-${contract.id}`}
        >
          Cancelado
        </Badge>
      );
    }

    if (isContractExpired(contract)) {
      return (
        <Badge
          className="bg-destructive text-destructive-foreground"
          data-testid={`badge-status-${contract.id}`}
        >
          Vencido
        </Badge>
      );
    }

    if (isContractExpiring(contract)) {
      return (
        <Badge
          className="bg-yellow-500 text-white hover:bg-yellow-500"
          data-testid={`badge-status-${contract.id}`}
        >
          Por vencer
        </Badge>
      );
    }

    if (contract.status === "pending_renewal") {
      return (
        <Badge
          className="bg-blue-600 text-white hover:bg-blue-600"
          data-testid={`badge-status-${contract.id}`}
        >
          Por renovar
        </Badge>
      );
    }

    if (contract.status === "active") {
      return (
        <Badge
          className="bg-green-600 text-white hover:bg-green-600"
          data-testid={`badge-status-${contract.id}`}
        >
          Activo
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        data-testid={`badge-status-${contract.id}`}
      >
        {contract.status || "Sin estado"}
      </Badge>
    );
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
          title="Contratos"
          subtitle="Contratos de servicios vinculados a tus activos"
        />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total contratos
                      </p>
                      {isContractsLoading ? (
                        <Skeleton className="mt-2 h-8 w-16" />
                      ) : (
                        <p
                          className="text-2xl font-bold text-foreground"
                          data-testid="text-total-contracts"
                        >
                          {contracts.length}
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Activos
                      </p>
                      {isContractsLoading ? (
                        <Skeleton className="mt-2 h-8 w-16" />
                      ) : (
                        <p
                          className="text-2xl font-bold text-foreground"
                          data-testid="text-active-contracts"
                        >
                          {activeContracts}
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Por vencer
                      </p>
                      {isContractsLoading ? (
                        <Skeleton className="mt-2 h-8 w-16" />
                      ) : (
                        <p
                          className="text-2xl font-bold text-foreground"
                          data-testid="text-expiring-contracts"
                        >
                          {expiringContracts}
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Costo mensual total
                      </p>
                      {isContractsLoading ? (
                        <Skeleton className="mt-2 h-8 w-28" />
                      ) : (
                        <p
                          className="text-2xl font-bold text-foreground"
                          data-testid="text-monthly-cost"
                        >
                          {formatCurrency(totalMonthlyCost)}
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle>Lista de contratos</CardTitle>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre o proveedor..."
                        className="pl-10 sm:w-80"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        data-testid="input-search-contracts"
                      />
                    </div>

                    <Button
                      onClick={openCreateDialog}
                      disabled={!selectedCompanyId}
                      data-testid="button-add-contract"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nuevo contrato
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
                        <TableHead>Vigencia</TableHead>
                        <TableHead>Activos cubiertos</TableHead>
                        <TableHead>Costo mensual</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {isContractsLoading ? (
                        Array.from({ length: 5 }).map((_, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {Array.from({ length: 8 }).map(
                              (_, columnIndex) => (
                                <TableCell key={columnIndex}>
                                  <Skeleton className="h-4 w-full min-w-16" />
                                </TableCell>
                              ),
                            )}
                          </TableRow>
                        ))
                      ) : filteredContracts.length > 0 ? (
                        filteredContracts.map((contract: any) => {
                          const linkedAssets = Array.isArray(
                            contract.linkedAssets,
                          )
                            ? contract.linkedAssets
                            : [];
                          const visibleAssets = linkedAssets.slice(0, 3);
                          const hiddenAssets = linkedAssets.length - 3;

                          return (
                            <TableRow
                              key={contract.id}
                              data-testid={`row-contract-${contract.id}`}
                            >
                              <TableCell
                                className="font-medium"
                                data-testid={`text-contract-name-${contract.id}`}
                              >
                                {contract.name}
                              </TableCell>
                              <TableCell>{contract.vendor}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {contractTypeLabels[contract.contractType] ||
                                    contract.contractType ||
                                    "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatDate(contract.startDate)} -{" "}
                                {formatDate(contract.endDate)}
                              </TableCell>
                              <TableCell>
                                {linkedAssets.length > 0 ? (
                                  <div className="flex min-w-48 flex-wrap gap-1">
                                    {visibleAssets.map((asset: any) => (
                                      <Badge
                                        key={asset.id}
                                        variant="outline"
                                        className="max-w-40 truncate"
                                        title={asset.name}
                                      >
                                        {asset.name}
                                      </Badge>
                                    ))}
                                    {hiddenAssets > 0 && (
                                      <Badge variant="outline">
                                        +{hiddenAssets}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatCurrency(contract.monthlyCost)}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(contract)}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setContractForExtras(contract)}
                                    aria-label={`Soporte y documento de ${contract.name}`}
                                    data-testid={`button-extras-${contract.id}`}
                                  >
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditDialog(contract)}
                                    aria-label={`Editar ${contract.name}`}
                                    data-testid={`button-edit-${contract.id}`}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() =>
                                      setContractToDelete(contract)
                                    }
                                    aria-label={`Eliminar ${contract.name}`}
                                    data-testid={`button-delete-${contract.id}`}
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
                          <TableCell colSpan={8} className="py-12 text-center">
                            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-foreground">
                              {searchTerm
                                ? "No se encontraron contratos"
                                : "Aún no tienes contratos registrados"}
                            </h3>
                            <p className="mb-6 text-muted-foreground">
                              {searchTerm
                                ? "No hay contratos que coincidan con tu búsqueda."
                                : "Registra tus contratos y vincúlalos con los activos que cubren."}
                            </p>
                            {!searchTerm && (
                              <Button
                                onClick={openCreateDialog}
                                disabled={!selectedCompanyId}
                                data-testid="button-add-first-contract"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Registrar el primero
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContract ? "Editar contrato" : "Registrar contrato"}
            </DialogTitle>
            <DialogDescription>
              Completa la información del servicio y selecciona los activos que
              cubre.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">Qué contrataste</h3>
                <p className="text-sm text-muted-foreground">
                  Identifica el servicio y la empresa que lo provee.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contract-name">Nombre *</Label>
                  <Input
                    id="contract-name"
                    placeholder="Ej: Soporte de servidores 2026"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    aria-invalid={Boolean(formErrors.name)}
                    data-testid="input-contract-name"
                  />
                  {formErrors.name && (
                    <p
                      className="text-sm text-destructive"
                      data-testid="error-contract-name"
                    >
                      {formErrors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contract-vendor">Proveedor *</Label>
                  <Input
                    id="contract-vendor"
                    placeholder="Ej: Tech Services Ecuador"
                    value={form.vendor}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        vendor: event.target.value,
                      }))
                    }
                    aria-invalid={Boolean(formErrors.vendor)}
                    data-testid="input-contract-vendor"
                  />
                  {formErrors.vendor && (
                    <p
                      className="text-sm text-destructive"
                      data-testid="error-contract-vendor"
                    >
                      {formErrors.vendor}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-type">Tipo *</Label>
                <Select
                  value={form.contractType}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      contractType: value,
                    }))
                  }
                >
                  <SelectTrigger
                    id="contract-type"
                    aria-invalid={Boolean(formErrors.contractType)}
                    data-testid="select-contract-type"
                  >
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">
                      Mantenimiento
                    </SelectItem>
                    <SelectItem value="support">Soporte</SelectItem>
                    <SelectItem value="service">Servicio</SelectItem>
                    <SelectItem value="lease">Arrendamiento</SelectItem>
                    <SelectItem value="hosting">Hosting</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.contractType && (
                  <p
                    className="text-sm text-destructive"
                    data-testid="error-contract-type"
                  >
                    {formErrors.contractType}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-description">Descripción</Label>
                <Textarea
                  id="contract-description"
                  placeholder="Describe brevemente el alcance del contrato."
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  data-testid="textarea-contract-description"
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">Vigencia y costo</h3>
                <p className="text-sm text-muted-foreground">
                  Define las fechas importantes y el costo mensual.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="contract-start-date">Fecha inicio *</Label>
                  <Input
                    id="contract-start-date"
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                    aria-invalid={Boolean(formErrors.startDate)}
                    data-testid="input-contract-start-date"
                  />
                  {formErrors.startDate && (
                    <p
                      className="text-sm text-destructive"
                      data-testid="error-contract-start-date"
                    >
                      {formErrors.startDate}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contract-end-date">Fecha fin *</Label>
                  <Input
                    id="contract-end-date"
                    type="date"
                    value={form.endDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                    aria-invalid={Boolean(formErrors.endDate)}
                    data-testid="input-contract-end-date"
                  />
                  {formErrors.endDate && (
                    <p
                      className="text-sm text-destructive"
                      data-testid="error-contract-end-date"
                    >
                      {formErrors.endDate}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contract-renewal-date">
                    Fecha de renovación
                  </Label>
                  <Input
                    id="contract-renewal-date"
                    type="date"
                    value={form.renewalDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        renewalDate: event.target.value,
                      }))
                    }
                    data-testid="input-contract-renewal-date"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="contract-auto-renewal"
                  checked={form.autoRenewal}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      autoRenewal: checked === true,
                    }))
                  }
                  data-testid="checkbox-contract-auto-renewal"
                />
                <Label
                  htmlFor="contract-auto-renewal"
                  className="font-normal cursor-pointer"
                >
                  Se renueva automáticamente
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-monthly-cost">Costo mensual</Label>
                <Input
                  id="contract-monthly-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.monthlyCost}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      monthlyCost: event.target.value,
                    }))
                  }
                  data-testid="input-contract-monthly-cost"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-notes">Notas</Label>
                <Textarea
                  id="contract-notes"
                  placeholder="Condiciones, contactos o información adicional."
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  data-testid="textarea-contract-notes"
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <div>
                <h3 className="font-semibold">
                  Activos cubiertos (opcional)
                </h3>
                <p className="text-sm text-muted-foreground">
                  Vincula los equipos o apps que cubre este contrato.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar equipos o apps..."
                  className="pl-10"
                  value={assetSearchTerm}
                  onChange={(event) =>
                    setAssetSearchTerm(event.target.value)
                  }
                  data-testid="input-search-contract-assets"
                />
              </div>

              <div
                className="max-h-48 overflow-y-auto rounded-md border p-3"
                data-testid="list-contract-assets"
              >
                {isAssetsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-5 w-full" />
                    ))}
                  </div>
                ) : physicalAssets.length === 0 &&
                  applicationAssets.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {assetSearchTerm
                      ? "No hay activos que coincidan con la búsqueda."
                      : "No hay equipos físicos ni aplicaciones disponibles."}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {physicalAssets.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Equipos físicos
                        </p>
                        {physicalAssets.map((asset: any) => {
                          const assetId = String(asset.id);

                          return (
                            <div
                              key={assetId}
                              className="flex items-center space-x-2 rounded-sm px-1 py-1"
                            >
                              <Checkbox
                                id={`contract-asset-${assetId}`}
                                checked={form.assetIds.includes(assetId)}
                                onCheckedChange={(checked) =>
                                  handleAssetChange(
                                    assetId,
                                    checked === true,
                                  )
                                }
                                data-testid={`checkbox-contract-asset-${assetId}`}
                              />
                              <Label
                                htmlFor={`contract-asset-${assetId}`}
                                className="flex-1 cursor-pointer font-normal"
                              >
                                {asset.name}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {physicalAssets.length > 0 &&
                      applicationAssets.length > 0 && <Separator />}

                    {applicationAssets.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Apps y suscripciones
                        </p>
                        {applicationAssets.map((asset: any) => {
                          const assetId = String(asset.id);

                          return (
                            <div
                              key={assetId}
                              className="flex items-center space-x-2 rounded-sm px-1 py-1"
                            >
                              <Checkbox
                                id={`contract-asset-${assetId}`}
                                checked={form.assetIds.includes(assetId)}
                                onCheckedChange={(checked) =>
                                  handleAssetChange(
                                    assetId,
                                    checked === true,
                                  )
                                }
                                data-testid={`checkbox-contract-asset-${assetId}`}
                              />
                              <Label
                                htmlFor={`contract-asset-${assetId}`}
                                className="flex-1 cursor-pointer font-normal"
                              >
                                {asset.name}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {form.assetIds.length > 0 && (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="text-selected-assets-count"
                >
                  {form.assetIds.length}{" "}
                  {form.assetIds.length === 1
                    ? "activo seleccionado"
                    : "activos seleccionados"}
                </p>
              )}
            </section>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogChange(false)}
              disabled={saveMutation.isPending}
              data-testid="button-cancel-contract"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saveMutation.isPending || !selectedCompanyId}
              data-testid="button-save-contract"
            >
              {saveMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingContract ? "Guardar cambios" : "Registrar contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(contractToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setContractToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              data-testid="button-cancel-delete-contract"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();

                if (contractToDelete) {
                  deleteMutation.mutate(contractToDelete);
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-contract"
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Documento del contrato + contactos de soporte */}
      <ContractExtrasModal
        contract={contractForExtras}
        companyId={selectedCompanyId}
        open={!!contractForExtras}
        onOpenChange={(open: boolean) => {
          if (!open) setContractForExtras(null);
        }}
      />
    </div>
  );
}