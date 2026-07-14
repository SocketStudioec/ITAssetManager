import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import AddAssetModal from "@/components/modals/add-asset-modal";
import ImportExcelModal from "@/components/modals/import-excel-modal";
import { usePersistedCompany } from "@/hooks/usePersistedCompany";
import EditAssetModal from "@/components/modals/edit-asset-modal";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CalendarClock,
  DollarSign,
  Edit2,
  FileSpreadsheet,
  Key,
  Laptop,
  Plus,
  Search,
  Trash2,
  WalletCards,
} from "lucide-react";

type LicenseFormState = {
  name: string;
  vendor: string;
  billingCycle: "monthly" | "annual" | "one_time";
  cost: string;
  expiryDate: string;
  assetId: string;
  licenseKey: string;
  licenseType: string;
  maxUsers: string;
  notes: string;
  paymentMethod: "card" | "transfer" | "cash" | "other";
  cardName: string;
  bankName: string;
  purpose: string;
  renewalType: "automatic" | "manual";
};

type UnifiedItem = {
  source: "app" | "license";
  id: string;
  name: string;
  provider: string;
  typeLabel: string;
  recurrence: string;
  monthlyCost: number;
  expiryDate: string | null;
  original: any;
};

const EMPTY_LICENSE_FORM: LicenseFormState = {
  name: "",
  vendor: "",
  billingCycle: "monthly",
  cost: "",
  expiryDate: "",
  assetId: "none",
  licenseKey: "",
  licenseType: "",
  maxUsers: "",
  notes: "",
  paymentMethod: "transfer",
  cardName: "",
  bankName: "",
  purpose: "",
  renewalType: "manual",
};

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function getDaysUntilExpiry(date: string | null | undefined) {
  if (!date) return null;

  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return null;

  return Math.ceil((timestamp - Date.now()) / DAY_IN_MS);
}

function getNearestAppExpiry(app: any): string | null {
  const dates = [
    app.domainExpiry,
    app.sslExpiry,
    app.hostingExpiry,
    app.serverExpiry,
  ].filter((date): date is string => {
    if (!date) return false;
    return !Number.isNaN(new Date(date).getTime());
  });

  if (dates.length === 0) return null;

  return dates.reduce((nearest, current) =>
    new Date(current).getTime() < new Date(nearest).getTime()
      ? current
      : nearest
  );
}

function getLicenseMonthlyCost(license: any) {
  const monthlyCost = Number(license.monthlyCost || 0);

  if (
    license.billingCycle === "annual" &&
    monthlyCost === 0 &&
    Number(license.annualCost || 0) > 0
  ) {
    return Number(license.annualCost) / 12;
  }

  return monthlyCost;
}

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: string | null | undefined) {
  if (!date) return "—";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleDateString("es-ES");
}

function formatDateInput(date: string | null | undefined) {
  if (!date) return "";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStatusBadge(expiryDate: string | null) {
  const daysUntilExpiry = getDaysUntilExpiry(expiryDate);

  if (daysUntilExpiry !== null && daysUntilExpiry < 0) {
    return (
      <Badge className="bg-destructive text-destructive-foreground">
        Expirada
      </Badge>
    );
  }

  if (
    daysUntilExpiry !== null &&
    daysUntilExpiry >= 0 &&
    daysUntilExpiry <= 30
  ) {
    return <Badge className="bg-chart-3 text-white">Por vencer</Badge>;
  }

  return (
    <Badge className="bg-accent text-accent-foreground">
      Activa
    </Badge>
  );
}

export default function Subscriptions() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCompanyId, setSelectedCompanyId] = usePersistedCompany();
  const [searchTerm, setSearchTerm] = useState("");

  const [showAddSelector, setShowAddSelector] = useState(false);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedAssetForEdit, setSelectedAssetForEdit] = useState<any>(null);

  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState<any>(null);
  const [licenseForm, setLicenseForm] =
    useState<LicenseFormState>(EMPTY_LICENSE_FORM);

  const [itemToDelete, setItemToDelete] = useState<{
    source: "app" | "license";
    item: any;
  } | null>(null);

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
    if (
      Array.isArray(companies) &&
      companies.length > 0 &&
      !companies.some((uc: any) => uc.company.id === selectedCompanyId)
    ) {
      setSelectedCompanyId(companies[0].company.id);
    }
  }, [companies, selectedCompanyId]);

  const {
    data: assets = [],
    isLoading: isAssetsLoading,
    error: assetsError,
  } = useQuery<any[]>({
    queryKey: ["/api/assets", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  const {
    data: licenses = [],
    isLoading: isLicensesLoading,
    error: licensesError,
  } = useQuery<any[]>({
    queryKey: ["/api/licenses", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    const error = assetsError || licensesError;

    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al inicio de sesión...",
        variant: "destructive",
      });

      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [assetsError, licensesError, toast]);

  const applications = Array.isArray(assets)
    ? assets.filter((asset: any) => asset.type === "application")
    : [];

  const invalidateSubscriptionQueries = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/licenses", selectedCompanyId],
    });
    queryClient.invalidateQueries({
      queryKey: ["/api/assets", selectedCompanyId],
    });
  };

  const saveLicenseMutation = useMutation({
    mutationFn: async ({
      licenseId,
      data,
    }: {
      licenseId?: string;
      data: Record<string, unknown>;
    }) => {
      if (licenseId) {
        return apiRequest("PUT", `/api/licenses/${licenseId}`, data);
      }

      return apiRequest("POST", "/api/licenses", data);
    },
    onSuccess: () => {
      invalidateSubscriptionQueries();

      toast({
        title: editingLicense ? "Licencia actualizada" : "Licencia registrada",
        description: editingLicense
          ? "La licencia se actualizó correctamente."
          : "La licencia se registró correctamente.",
      });

      setShowLicenseModal(false);
      setEditingLicense(null);
      setLicenseForm(EMPTY_LICENSE_FORM);
    },
    onError: (error: any) => {
      toast({
        title: "No se pudo guardar la licencia",
        description:
          error?.response?.data?.message ||
          error?.message ||
          "Revisa los datos e inténtalo nuevamente.",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({
      source,
      id,
    }: {
      source: "app" | "license";
      id: string;
    }) => {
      const endpoint =
        source === "app"
          ? `/api/assets/${id}/${selectedCompanyId}`
          : `/api/licenses/${id}/${selectedCompanyId}`;

      return apiRequest("DELETE", endpoint);
    },
    onSuccess: (_, variables) => {
      invalidateSubscriptionQueries();

      toast({
        title:
          variables.source === "app"
            ? "Aplicación eliminada"
            : "Licencia eliminada",
        description:
          variables.source === "app"
            ? "La aplicación se eliminó correctamente."
            : "La licencia se eliminó correctamente.",
      });

      setItemToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "No se pudo eliminar",
        description:
          error?.response?.data?.message ||
          error?.message ||
          "Inténtalo nuevamente.",
        variant: "destructive",
      });
    },
  });

  const openNewLicenseModal = () => {
    setEditingLicense(null);
    setLicenseForm(EMPTY_LICENSE_FORM);
    setShowLicenseModal(true);
  };

  const openEditLicenseModal = (license: any) => {
    let cost = "";

    if (license.billingCycle === "monthly") {
      cost = String(license.monthlyCost || "");
    } else {
      cost = String(license.annualCost || "");
    }

    setEditingLicense(license);
    setLicenseForm({
      name: license.name || "",
      vendor: license.vendor || "",
      billingCycle: license.billingCycle || "monthly",
      cost,
      expiryDate: formatDateInput(license.expiryDate),
      assetId: license.assetId ? String(license.assetId) : "none",
      licenseKey: license.licenseKey || "",
      licenseType: license.licenseType || "",
      maxUsers:
        license.maxUsers === null || license.maxUsers === undefined
          ? ""
          : String(license.maxUsers),
      notes: license.notes || "",
      paymentMethod: license.paymentMethod || "transfer",
      cardName: license.cardName || "",
      bankName: license.bankName || "",
      purpose: license.purpose || "",
      renewalType: license.renewalType || "manual",
    });
    setShowLicenseModal(true);
  };

  const handleLicenseModalChange = (open: boolean) => {
    setShowLicenseModal(open);

    if (!open) {
      setEditingLicense(null);
      setLicenseForm(EMPTY_LICENSE_FORM);
    }
  };

  const handleLicenseSubmit = () => {
    const name = licenseForm.name.trim();
    const vendor = licenseForm.vendor.trim();

    if (!name || !vendor) {
      toast({
        title: "Completa los campos obligatorios",
        description: "El nombre y el proveedor son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    const cost = Number(licenseForm.cost || 0);

    if (Number.isNaN(cost) || cost < 0) {
      toast({
        title: "Costo inválido",
        description: "Ingresa un costo igual o mayor a cero.",
        variant: "destructive",
      });
      return;
    }

    const monthlyCost =
      licenseForm.billingCycle === "monthly" ? cost : 0;
    const annualCost =
      licenseForm.billingCycle === "annual" ||
      licenseForm.billingCycle === "one_time"
        ? cost
        : 0;

    const data = {
      companyId: selectedCompanyId,
      name,
      vendor,
      billingCycle: licenseForm.billingCycle,
      monthlyCost,
      annualCost,
      expiryDate:
        licenseForm.billingCycle !== "one_time" &&
        licenseForm.expiryDate
          ? new Date(licenseForm.expiryDate).toISOString()
          : null,
      assetId:
        licenseForm.assetId === "none"
          ? null
          : licenseForm.assetId,
      licenseKey: licenseForm.licenseKey.trim() || null,
      licenseType: licenseForm.licenseType.trim() || null,
      maxUsers: licenseForm.maxUsers
        ? Number(licenseForm.maxUsers)
        : null,
      notes: licenseForm.notes.trim() || null,
      paymentMethod: licenseForm.paymentMethod,
      cardName:
        licenseForm.paymentMethod === "card"
          ? licenseForm.cardName.trim() || null
          : null,
      bankName:
        licenseForm.paymentMethod === "card"
          ? licenseForm.bankName.trim() || null
          : null,
      purpose: licenseForm.purpose.trim() || null,
      renewalType: licenseForm.renewalType,
    };

    saveLicenseMutation.mutate({
      licenseId: editingLicense?.id,
      data,
    });
  };

  const unifiedItems: UnifiedItem[] = [
    ...applications.map((app: any) => ({
      source: "app" as const,
      id: String(app.id),
      name: app.name || "",
      provider: app.manufacturer || app.vendor || "—",
      typeLabel:
        app.applicationType === "custom_development"
          ? "Desarrollo"
          : "App SaaS",
      recurrence:
        Number(app.monthlyCost || 0) > 0
          ? "Mensual"
          : Number(app.annualCost || 0) > 0
            ? "Anual"
            : "—",
      monthlyCost: Number(app.monthlyCost || 0),
      expiryDate: getNearestAppExpiry(app),
      original: app,
    })),
    ...licenses.map((license: any) => ({
      source: "license" as const,
      id: String(license.id),
      name: license.name || "",
      provider: license.vendor || "—",
      typeLabel: "Licencia",
      recurrence:
        license.billingCycle === "annual"
          ? "Anual"
          : license.billingCycle === "one_time"
            ? "Pago único"
            : "Mensual",
      monthlyCost: getLicenseMonthlyCost(license),
      expiryDate: license.expiryDate || null,
      original: license,
    })),
  ].sort((first, second) =>
    first.name.localeCompare(second.name, "es", {
      sensitivity: "base",
    })
  );

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase("es");

  const filteredItems = unifiedItems.filter((item) => {
    if (!normalizedSearch) return true;

    return (
      item.name.toLocaleLowerCase("es").includes(normalizedSearch) ||
      item.provider.toLocaleLowerCase("es").includes(normalizedSearch)
    );
  });

  const monthlyCost =
    applications.reduce(
      (sum: number, app: any) =>
        sum + Number(app.monthlyCost || 0),
      0
    ) +
    licenses.reduce(
      (sum: number, license: any) =>
        sum + getLicenseMonthlyCost(license),
      0
    );

  const expiringSoonCount = unifiedItems.filter((item) => {
    const daysUntilExpiry = getDaysUntilExpiry(item.expiryDate);
    return (
      daysUntilExpiry !== null &&
      daysUntilExpiry >= 0 &&
      daysUntilExpiry <= 30
    );
  }).length;

  const isDataLoading = isAssetsLoading || isLicensesLoading;

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
          title="Aplicaciones"
          subtitle="Suscripciones de aplicaciones y licencias de software"
        />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Apps y licencias
                      </p>
                      <p
                        className="text-2xl font-bold text-foreground"
                        data-testid="text-total-subscriptions"
                      >
                        {isDataLoading
                          ? "..."
                          : applications.length + licenses.length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                      <WalletCards className="w-6 h-6 text-primary-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Costo mensual
                      </p>
                      <p
                        className="text-2xl font-bold text-foreground"
                        data-testid="text-monthly-cost"
                      >
                        {isDataLoading
                          ? "$..."
                          : `$${formatCurrency(monthlyCost)}`}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-chart-2 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Por vencer (30 días)
                      </p>
                      <p
                        className="text-2xl font-bold text-foreground"
                        data-testid="text-expiring-subscriptions"
                      >
                        {isDataLoading ? "..." : expiringSoonCount}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-chart-3 rounded-lg flex items-center justify-center">
                      <CalendarClock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Costo anual proyectado
                      </p>
                      <p
                        className="text-2xl font-bold text-foreground"
                        data-testid="text-annual-projected-cost"
                      >
                        {isDataLoading
                          ? "$..."
                          : `$${formatCurrency(monthlyCost * 12)}`}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-accent-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle>Aplicaciones</CardTitle>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nombre o proveedor..."
                        className="pl-10 sm:w-80"
                        value={searchTerm}
                        onChange={(event) =>
                          setSearchTerm(event.target.value)
                        }
                        data-testid="input-search-subscriptions"
                      />
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => setShowImportModal(true)}
                      disabled={!selectedCompanyId}
                      data-testid="button-import-applications"
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Importar Excel
                    </Button>
                    <Button
                      onClick={() => setShowAddAssetModal(true)}
                      disabled={!selectedCompanyId}
                      data-testid="button-add-subscription"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar
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
                        <TableHead>Recurrencia</TableHead>
                        <TableHead>Costo mensual</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">
                          Acciones
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {isDataLoading ? (
                        Array.from({ length: 5 }).map((_, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {Array.from({ length: 8 }).map(
                              (_, cellIndex) => (
                                <TableCell key={cellIndex}>
                                  <Skeleton className="h-4 w-full" />
                                </TableCell>
                              )
                            )}
                          </TableRow>
                        ))
                      ) : filteredItems.length > 0 ? (
                        filteredItems.map((item) => (
                          <TableRow
                            key={`${item.source}-${item.id}`}
                            data-testid={`row-${item.source}-${item.id}`}
                          >
                            <TableCell className="font-medium">
                              {item.name}
                            </TableCell>
                            <TableCell>{item.provider}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {item.typeLabel}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.recurrence}</TableCell>
                            <TableCell>
                              ${formatCurrency(item.monthlyCost)}
                            </TableCell>
                            <TableCell>
                              {formatDate(item.expiryDate)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(item.expiryDate)}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (item.source === "app") {
                                      setSelectedAssetForEdit(item.original);
                                    } else {
                                      openEditLicenseModal(item.original);
                                    }
                                  }}
                                  aria-label={`Editar ${item.name}`}
                                  data-testid={`button-edit-${item.source}-${item.id}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() =>
                                    setItemToDelete({
                                      source: item.source,
                                      item: item.original,
                                    })
                                  }
                                  aria-label={`Eliminar ${item.name}`}
                                  data-testid={`button-delete-${item.source}-${item.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow data-testid="row-empty-subscriptions">
                          <TableCell
                            colSpan={8}
                            className="py-12 text-center"
                          >
                            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <WalletCards className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                              {searchTerm
                                ? "No encontramos coincidencias"
                                : "Aún no hay apps ni licencias"}
                            </h3>
                            <p className="text-muted-foreground mb-6">
                              {searchTerm
                                ? "Prueba con otro nombre o proveedor."
                                : "Registra una suscripción SaaS o una licencia con clave para comenzar."}
                            </p>
                            <Button
                              onClick={() => setShowAddAssetModal(true)}
                              disabled={!selectedCompanyId}
                              data-testid="button-add-first-subscription"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Registrar la primera
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
        </main>
      </div>

      <Dialog
        open={showAddSelector}
        onOpenChange={setShowAddSelector}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>¿Qué deseas agregar?</DialogTitle>
            <DialogDescription>
              Selecciona la opción que mejor describe el software.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 md:grid-cols-2">
            <button
              type="button"
              className="group rounded-lg border border-border p-6 text-left transition-colors hover:border-primary hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => {
                setShowAddSelector(false);
                setShowAddAssetModal(true);
              }}
              data-testid="button-select-app-subscription"
            >
              <div className="w-12 h-12 mb-4 rounded-lg bg-primary/10 flex items-center justify-center">
                <Laptop className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                App o suscripción SaaS
              </h3>
              <p className="text-sm text-muted-foreground">
                Software al que te suscribes: CRM, hosting, Office 365...
              </p>
            </button>

            <button
              type="button"
              className="group rounded-lg border border-border p-6 text-left transition-colors hover:border-primary hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => {
                setShowAddSelector(false);
                openNewLicenseModal();
              }}
              data-testid="button-select-key-license"
            >
              <div className="w-12 h-12 mb-4 rounded-lg bg-primary/10 flex items-center justify-center">
                <Key className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Licencia con clave
              </h3>
              <p className="text-sm text-muted-foreground">
                Licencias compradas con clave de activación
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AddAssetModal
        open={showAddAssetModal}
        onOpenChange={setShowAddAssetModal}
        companyId={selectedCompanyId}
        key={selectedCompanyId}
      />

      {/* Carga masiva desde Excel (plantilla + import) */}
      <ImportExcelModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        companyId={selectedCompanyId}
        kind="applications"
      />

      {selectedAssetForEdit && (
        <EditAssetModal
          open={!!selectedAssetForEdit}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedAssetForEdit(null);
              invalidateSubscriptionQueries();
            }
          }}
          asset={selectedAssetForEdit}
          companyId={selectedCompanyId}
        />
      )}

      <Dialog
        open={showLicenseModal}
        onOpenChange={handleLicenseModalChange}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLicense
                ? "Editar licencia"
                : "Registrar licencia"}
            </DialogTitle>
            <DialogDescription>
              Solo el nombre y proveedor son obligatorios. Podrás
              completar el resto después.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="license-name">Nombre*</Label>
              <Input
                id="license-name"
                value={licenseForm.name}
                onChange={(event) =>
                  setLicenseForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Ej. Microsoft Office 365"
                data-testid="input-license-name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="license-vendor">Proveedor*</Label>
              <Input
                id="license-vendor"
                value={licenseForm.vendor}
                onChange={(event) =>
                  setLicenseForm((current) => ({
                    ...current,
                    vendor: event.target.value,
                  }))
                }
                placeholder="Ej. Microsoft"
                data-testid="input-license-vendor"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Recurrencia</Label>
                <Select
                  value={licenseForm.billingCycle}
                  onValueChange={(
                    value: "monthly" | "annual" | "one_time"
                  ) =>
                    setLicenseForm((current) => ({
                      ...current,
                      billingCycle: value,
                      expiryDate:
                        value === "one_time"
                          ? ""
                          : current.expiryDate,
                    }))
                  }
                >
                  <SelectTrigger data-testid="select-license-billing-cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">
                      Mensual
                    </SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                    <SelectItem value="one_time">
                      Pago único
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="license-cost">Costo</Label>
                <Input
                  id="license-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={licenseForm.cost}
                  onChange={(event) =>
                    setLicenseForm((current) => ({
                      ...current,
                      cost: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                  data-testid="input-license-cost"
                />
              </div>
            </div>

            {licenseForm.billingCycle !== "one_time" && (
              <div className="grid gap-2">
                <Label htmlFor="license-expiry-date">
                  Fecha de vencimiento
                </Label>
                <Input
                  id="license-expiry-date"
                  type="date"
                  value={licenseForm.expiryDate}
                  onChange={(event) =>
                    setLicenseForm((current) => ({
                      ...current,
                      expiryDate: event.target.value,
                    }))
                  }
                  data-testid="input-license-expiry-date"
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label>Vincular a una app</Label>
              <Select
                value={licenseForm.assetId}
                onValueChange={(value) =>
                  setLicenseForm((current) => ({
                    ...current,
                    assetId: value,
                  }))
                }
              >
                <SelectTrigger data-testid="select-license-asset">
                  <SelectValue placeholder="Ninguna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna</SelectItem>
                  {applications.map((app: any) => (
                    <SelectItem
                      key={app.id}
                      value={String(app.id)}
                    >
                      {app.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="license-key">
                Clave de licencia
              </Label>
              <Textarea
                id="license-key"
                value={licenseForm.licenseKey}
                onChange={(event) =>
                  setLicenseForm((current) => ({
                    ...current,
                    licenseKey: event.target.value,
                  }))
                }
                placeholder="Ingresa la clave de activación"
                data-testid="textarea-license-key"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="license-type">Tipo de licencia</Label>
                <Input
                  id="license-type"
                  value={licenseForm.licenseType}
                  onChange={(event) =>
                    setLicenseForm((current) => ({
                      ...current,
                      licenseType: event.target.value,
                    }))
                  }
                  placeholder="Empresa, individual, perpetua..."
                  data-testid="input-license-type"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="license-max-users">
                  Usuarios máximos
                </Label>
                <Input
                  id="license-max-users"
                  type="number"
                  min="0"
                  step="1"
                  value={licenseForm.maxUsers}
                  onChange={(event) =>
                    setLicenseForm((current) => ({
                      ...current,
                      maxUsers: event.target.value,
                    }))
                  }
                  placeholder="Ej. 25"
                  data-testid="input-license-max-users"
                />
              </div>
            </div>

            <Separator />
            <h3 className="text-sm font-medium">Forma de pago y motivo</h3>

            <div className="grid gap-2">
              <Label>Método de pago</Label>
              <Select
                value={licenseForm.paymentMethod}
                onValueChange={(
                  value: "card" | "transfer" | "cash" | "other"
                ) =>
                  setLicenseForm((current) => ({
                    ...current,
                    paymentMethod: value,
                  }))
                }
              >
                <SelectTrigger data-testid="select-license-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {licenseForm.paymentMethod === "card" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="license-card-name">Nombre de la tarjeta</Label>
                  <Input
                    id="license-card-name"
                    value={licenseForm.cardName}
                    onChange={(event) =>
                      setLicenseForm((current) => ({
                        ...current,
                        cardName: event.target.value,
                      }))
                    }
                    placeholder="Visa empresarial"
                    data-testid="input-license-card-name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="license-bank-name">Banco</Label>
                  <Input
                    id="license-bank-name"
                    value={licenseForm.bankName}
                    onChange={(event) =>
                      setLicenseForm((current) => ({
                        ...current,
                        bankName: event.target.value,
                      }))
                    }
                    placeholder="Banco Pichincha"
                    data-testid="input-license-bank-name"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="license-purpose">
                ¿Por qué la empresa paga esto?
              </Label>
              <Textarea
                id="license-purpose"
                value={licenseForm.purpose}
                onChange={(event) =>
                  setLicenseForm((current) => ({
                    ...current,
                    purpose: event.target.value,
                  }))
                }
                placeholder="Describe el motivo de negocio"
                data-testid="textarea-license-purpose"
              />
            </div>

            <div className="grid gap-2">
              <Label>Renovación</Label>
              <RadioGroup
                className="flex min-h-10 flex-wrap items-center gap-6"
                value={licenseForm.renewalType}
                onValueChange={(value: "automatic" | "manual") =>
                  setLicenseForm((current) => ({
                    ...current,
                    renewalType: value,
                  }))
                }
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="automatic" id="license-renewal-automatic" />
                  <label className="cursor-pointer text-sm font-medium" htmlFor="license-renewal-automatic">
                    Automática
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manual" id="license-renewal-manual" />
                  <label className="cursor-pointer text-sm font-medium" htmlFor="license-renewal-manual">
                    Manual
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="license-notes">Notas</Label>
              <Textarea
                id="license-notes"
                value={licenseForm.notes}
                onChange={(event) =>
                  setLicenseForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Información adicional sobre la licencia"
                data-testid="textarea-license-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleLicenseModalChange(false)}
              disabled={saveLicenseMutation.isPending}
              data-testid="button-cancel-license"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleLicenseSubmit}
              disabled={
                saveLicenseMutation.isPending ||
                !selectedCompanyId
              }
              data-testid="button-save-license"
            >
              {saveLicenseMutation.isPending
                ? "Guardando..."
                : editingLicense
                  ? "Guardar cambios"
                  : "Registrar licencia"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!itemToDelete}
        onOpenChange={(open) => {
          if (!open && !deleteItemMutation.isPending) {
            setItemToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar eliminación
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar{" "}
              <strong>{itemToDelete?.item?.name}</strong>? Esta acción
              no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteItemMutation.isPending}
              data-testid="button-cancel-delete"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteItemMutation.isPending}
              onClick={(event) => {
                event.preventDefault();

                if (itemToDelete) {
                  deleteItemMutation.mutate({
                    source: itemToDelete.source,
                    id: String(itemToDelete.item.id),
                  });
                }
              }}
              data-testid="button-confirm-delete"
            >
              {deleteItemMutation.isPending
                ? "Eliminando..."
                : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}