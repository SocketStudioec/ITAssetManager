import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { usePersistedCompany } from "@/hooks/usePersistedCompany";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AddPhysicalAssetModal from "@/components/modals/add-physical-asset-modal";
import EditAssetModal from "@/components/modals/edit-asset-modal";
import AssetDetailModal from "@/components/modals/asset-detail-modal";
import ImportExcelModal from "@/components/modals/import-excel-modal";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Edit2,
  Eye,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  PackageOpen,
  Plus,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";

type SortKey = "name" | "depreciation";
type SortDirection = "asc" | "desc";

const statusOptions = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activo" },
  { value: "maintenance", label: "Mantenimiento" },
  { value: "inactive", label: "Inactivo" },
  { value: "deprecated", label: "Obsoleto" },
  { value: "disposed", label: "Dado de baja" },
];

const currencyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function getAssetCode(asset: any) {
  return asset.assetCode || asset.asset_code || asset.code || "—";
}

function getAssetSerial(asset: any) {
  return asset.serialNumber || asset.serial_number || "";
}

function getCategoryId(asset: any) {
  return asset.categoryId || asset.category_id || "";
}

function getWarrantyExpiry(asset: any) {
  return asset.warrantyExpiry || asset.warranty_expiry || null;
}

function getDepreciationYears(asset: any) {
  return asset.depreciationYears ?? asset.depreciation_years;
}

function getPurchaseCost(asset: any) {
  return Number(asset.purchaseCost ?? asset.purchase_cost ?? 0);
}

function getResidualValue(asset: any) {
  return Number(asset.residualValue ?? asset.residual_value ?? 0);
}

export default function PhysicalAssets() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCompanyId, setSelectedCompanyId] = usePersistedCompany();
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedAssetForMaintenance, setSelectedAssetForMaintenance] = useState<string | null>(null);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<any>(null);
  const [selectedAssetForEdit, setSelectedAssetForEdit] = useState<any>(null);
  const [assetToDelete, setAssetToDelete] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: maintenanceRecords = [], isLoading: isMaintenanceLoading } = useQuery<any[]>({
    queryKey: ["/api/maintenance/asset", selectedAssetForMaintenance, selectedCompanyId],
    enabled: !!selectedAssetForMaintenance && !!selectedCompanyId,
  });

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

  const { data: supportStatus } = useQuery<{ supportMode: boolean; company: any }>({
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
    if (Array.isArray(companies) && companies.length > 0 &&
        !companies.some((uc: any) => uc.company.id === selectedCompanyId)) {
      setSelectedCompanyId(companies[0].company.id);
    }
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    setSelectedCategoryId("all");
    setSelectedStatus("all");
    setSearchTerm("");
  }, [selectedCompanyId]);

  const {
    data: assets = [],
    isLoading: isAssetsLoading,
    error: assetsError,
  } = useQuery<any[]>({
    queryKey: ["/api/assets", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (assetsError && isUnauthorizedError(assetsError as Error)) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al inicio de sesión...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [assetsError, toast]);

  const categoryMap = useMemo(() => {
    return new Map(
      (Array.isArray(categories) ? categories : []).map((category: any) => [
        String(category.id),
        category,
      ]),
    );
  }, [categories]);

  const calculateMonthlyDepreciation = (asset: any) => {
    const purchaseCost = getPurchaseCost(asset);

    if (!Number.isFinite(purchaseCost) || purchaseCost === 0) {
      return null;
    }

    const residualValue = getResidualValue(asset);
    const category = categoryMap.get(String(getCategoryId(asset)));
    const years = Number(
      getDepreciationYears(asset)
      ?? category?.depreciationYears
      ?? category?.depreciation_years
      ?? 3,
    );

    if (!Number.isFinite(years) || years <= 0) {
      return null;
    }

    const monthlyDepreciation = (purchaseCost - (Number.isFinite(residualValue) ? residualValue : 0)) / (years * 12);
    return Number.isFinite(monthlyDepreciation) ? monthlyDepreciation : null;
  };

  const physicalAssets = useMemo(
    () => (Array.isArray(assets) ? assets.filter((asset: any) => asset.type === "physical") : []),
    [assets],
  );

  const filteredAssets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("es");

    return physicalAssets
      .filter((asset: any) => {
        const searchableValues = [
          asset.name,
          asset.manufacturer,
          asset.model,
          getAssetSerial(asset),
          getAssetCode(asset),
        ];

        const matchesSearch = !normalizedSearch || searchableValues.some((value) =>
          String(value || "").toLocaleLowerCase("es").includes(normalizedSearch),
        );
        const matchesCategory = selectedCategoryId === "all"
          || String(getCategoryId(asset)) === selectedCategoryId;
        const matchesStatus = selectedStatus === "all" || asset.status === selectedStatus;

        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((first: any, second: any) => {
        let comparison = 0;

        if (sortKey === "name") {
          comparison = String(first.name || "").localeCompare(
            String(second.name || ""),
            "es",
            { sensitivity: "base" },
          );
        } else {
          comparison = (calculateMonthlyDepreciation(first) ?? -1)
            - (calculateMonthlyDepreciation(second) ?? -1);
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
  }, [
    physicalAssets,
    searchTerm,
    selectedCategoryId,
    selectedStatus,
    sortKey,
    sortDirection,
    categoryMap,
  ]);

  const deleteAssetMutation = useMutation({
    mutationFn: async ({ assetId, companyId }: { assetId: string; companyId: string }) => {
      return apiRequest("DELETE", `/api/assets/${assetId}/${companyId}`);
    },
    onSuccess: () => {
      toast({
        title: "Activo eliminado",
        description: "El activo se ha eliminado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setShowDeleteDialog(false);
      setAssetToDelete(null);
    },
    onError: (error: any) => {
      console.error("Error deleting asset:", error);

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

      const errorMessage = error.response?.data?.message
        || error.message
        || "Error al eliminar el activo.";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleDeleteConfirm = () => {
    if (assetToDelete) {
      deleteAssetMutation.mutate({
        assetId: assetToDelete.id,
        companyId: selectedCompanyId,
      });
    }
  };

  const openDeleteDialog = (asset: any) => {
    setAssetToDelete(asset);
    setShowDeleteDialog(true);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  const getAriaSort = (key: SortKey): "ascending" | "descending" | "none" => {
    if (sortKey !== key) {
      return "none";
    }

    return sortDirection === "asc" ? "ascending" : "descending";
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }

    return sortDirection === "asc"
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
      active: {
        label: "Activo",
        badgeClass: "border-transparent bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-400/20",
        dotClass: "bg-green-500",
      },
      maintenance: {
        label: "Mantenimiento",
        badgeClass: "border-transparent bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/20",
        dotClass: "bg-amber-500",
      },
      inactive: {
        label: "Inactivo",
        badgeClass: "border-transparent bg-muted text-muted-foreground ring-1 ring-inset ring-border",
        dotClass: "bg-muted-foreground",
      },
      deprecated: {
        label: "Obsoleto",
        badgeClass: "border-transparent bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-400/20",
        dotClass: "bg-orange-500",
      },
      disposed: {
        label: "Dado de baja",
        badgeClass: "border-transparent bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-400/20",
        dotClass: "bg-red-500",
      },
    };

    const config = statusConfig[status] || {
      label: status || "Sin estado",
      badgeClass: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
      dotClass: "bg-muted-foreground",
    };

    return (
      <Badge variant="outline" className={config.badgeClass}>
        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${config.dotClass}`} aria-hidden="true" />
        {config.label}
      </Badge>
    );
  };

  const renderWarranty = (asset: any) => {
    const warrantyExpiry = getWarrantyExpiry(asset);

    if (!warrantyExpiry) {
      return <span className="text-muted-foreground">—</span>;
    }

    const expiryDate = new Date(warrantyExpiry);

    if (Number.isNaN(expiryDate.getTime())) {
      return <span className="text-muted-foreground">—</span>;
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let className = "tabular-nums";

    if (expiryDate.getTime() < now.getTime()) {
      className += " text-destructive";
    } else if (expiryDate.getTime() <= thirtyDaysFromNow.getTime()) {
      className += " text-amber-700 dark:text-amber-300";
    }

    return <span className={className}>{dateFormatter.format(expiryDate)}</span>;
  };

  const hasActiveFilters = searchTerm.trim().length > 0
    || selectedCategoryId !== "all"
    || selectedStatus !== "all";

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        selectedCompanyId={selectedCompanyId}
        onCompanyChange={setSelectedCompanyId}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="Equipos físicos"
          subtitle="Inventario de hardware y equipos"
          selectedCompanyId={selectedCompanyId}
        />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="space-y-6 p-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
                <div className="relative min-w-64 flex-1 xl:max-w-sm">
                  <Search
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    placeholder="Buscar por nombre, marca, modelo, serie o código AST"
                    aria-label="Buscar equipos"
                    className="h-10 pl-10"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    data-testid="input-search-assets"
                  />
                </div>

                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger className="h-10 w-full sm:w-52" aria-label="Filtrar por categoría">
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {(Array.isArray(categories) ? categories : []).map((category: any) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-10 w-full sm:w-48" aria-label="Filtrar por estado">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowImportModal(true)}
                  disabled={!selectedCompanyId}
                  data-testid="button-import-excel"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Importar Excel
                </Button>
                <Button
                  onClick={() => setShowAddAssetModal(true)}
                  disabled={!selectedCompanyId}
                  data-testid="button-add-physical-asset"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar equipo
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-muted-foreground" aria-live="polite">
                {isAssetsLoading ? "Cargando equipos..." : `${filteredAssets.length} equipos`}
              </div>

              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Código</TableHead>
                      <TableHead aria-sort={getAriaSort("name")}>
                        <Button
                          variant="ghost"
                          className="-ml-3 h-10 px-3 font-medium"
                          onClick={() => handleSort("name")}
                        >
                          Equipo
                          {renderSortIcon("name")}
                        </Button>
                      </TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right" aria-sort={getAriaSort("depreciation")}>
                        <Button
                          variant="ghost"
                          className="-mr-3 ml-auto h-10 px-3 font-medium"
                          onClick={() => handleSort("depreciation")}
                        >
                          Dep. mensual
                          {renderSortIcon("depreciation")}
                        </Button>
                      </TableHead>
                      <TableHead>Garantía</TableHead>
                      <TableHead className="w-14">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isAssetsLoading ? (
                      Array.from({ length: 6 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                          <TableCell>
                            <Skeleton className="mb-2 h-4 w-36" />
                            <Skeleton className="h-3 w-28" />
                          </TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                          <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-10 w-10" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredAssets.length > 0 ? (
                      filteredAssets.map((asset: any) => {
                        const category = categoryMap.get(String(getCategoryId(asset)));
                        const monthlyDepreciation = calculateMonthlyDepreciation(asset);
                        const manufacturerModel = [asset.manufacturer, asset.model]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <TableRow
                            key={asset.id}
                            tabIndex={0}
                            className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                            onClick={() => setSelectedAssetForDetail(asset)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedAssetForDetail(asset);
                              }
                            }}
                            data-testid={`row-asset-${asset.id}`}
                          >
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs font-normal">
                                {getAssetCode(asset)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{asset.name || "Sin nombre"}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {manufacturerModel || "Sin marca o modelo"}
                              </div>
                            </TableCell>
                            <TableCell>{category?.name || "—"}</TableCell>
                            <TableCell>{asset.location || "—"}</TableCell>
                            <TableCell>{getStatusBadge(asset.status)}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {monthlyDepreciation === null
                                ? <span className="text-muted-foreground">—</span>
                                : currencyFormatter.format(monthlyDepreciation)}
                            </TableCell>
                            <TableCell>{renderWarranty(asset)}</TableCell>
                            <TableCell
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10"
                                    aria-label={`Acciones de ${asset.name || "equipo"}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onSelect={() => setSelectedAssetForDetail(asset)}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    Ver detalle
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onSelect={() => setSelectedAssetForEdit(asset)}
                                    data-testid={`button-edit-${asset.id}`}
                                  >
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onSelect={() => setSelectedAssetForMaintenance(asset.id)}
                                    data-testid={`button-maintenance-${asset.id}`}
                                  >
                                    <Calendar className="mr-2 h-4 w-4" />
                                    Mantenimientos
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="cursor-pointer text-destructive focus:text-destructive"
                                    onSelect={() => openDeleteDialog(asset)}
                                    data-testid={`button-delete-${asset.id}`}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-72">
                          <div className="flex flex-col items-center justify-center px-6 text-center">
                            {hasActiveFilters ? (
                              <>
                                <Search className="mb-4 h-10 w-10 text-muted-foreground" />
                                <h3 className="font-medium">No se encontraron equipos</h3>
                                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                  No hay equipos que coincidan con los filtros seleccionados.
                                </p>
                              </>
                            ) : (
                              <>
                                <PackageOpen className="mb-4 h-10 w-10 text-muted-foreground" />
                                <h3 className="font-medium">Aún no hay equipos físicos</h3>
                                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                  Agrega el primer equipo para comenzar a gestionar el inventario.
                                </p>
                                <Button
                                  className="mt-4"
                                  onClick={() => setShowAddAssetModal(true)}
                                  disabled={!selectedCompanyId}
                                  data-testid="button-add-first-asset"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Agregar primer equipo
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </main>
      </div>

      <AddPhysicalAssetModal
        open={showAddAssetModal}
        onOpenChange={setShowAddAssetModal}
        companyId={selectedCompanyId}
        key={selectedCompanyId}
      />

      <ImportExcelModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        companyId={selectedCompanyId}
        kind="assets"
      />

      {selectedAssetForDetail && (
        <AssetDetailModal
          asset={selectedAssetForDetail}
          companyId={selectedCompanyId}
          open={!!selectedAssetForDetail}
          onOpenChange={(open) => !open && setSelectedAssetForDetail(null)}
          onEdit={(asset) => {
            setSelectedAssetForDetail(null);
            setSelectedAssetForEdit(asset);
          }}
          categories={categories}
        />
      )}

      {selectedAssetForEdit && (
        <EditAssetModal
          open={!!selectedAssetForEdit}
          onOpenChange={(open) => !open && setSelectedAssetForEdit(null)}
          asset={selectedAssetForEdit}
          companyId={selectedCompanyId}
        />
      )}

      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open && !deleteAssetMutation.isPending) {
            setAssetToDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar eliminación
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el activo{" "}
              <strong>{assetToDelete?.name}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteAssetMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteAssetMutation.isPending}
            >
              {deleteAssetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleteAssetMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedAssetForMaintenance}
        onOpenChange={() => setSelectedAssetForMaintenance(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl">
          <DialogHeader>
            <DialogTitle>Historial de Mantenimientos</DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-4">
              {isMaintenanceLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <Card key={index} className="border-border">
                    <CardContent className="p-4">
                      <Skeleton className="mb-2 h-4 w-1/3" />
                      <Skeleton className="mb-2 h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </CardContent>
                  </Card>
                ))
              ) : Array.isArray(maintenanceRecords) && maintenanceRecords.length > 0 ? (
                maintenanceRecords.map((record: any) => (
                  <Card key={record.id} className="border-border">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="font-medium">{record.title || record.description}</h4>
                        <Badge>{record.maintenanceType}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{record.description}</p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="py-8 text-center">
                  <Wrench className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">No hay registros de mantenimiento</p>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-between border-t pt-4">
            <Button variant="outline">Agregar Mantenimiento</Button>
            <Button onClick={() => setSelectedAssetForMaintenance(null)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}