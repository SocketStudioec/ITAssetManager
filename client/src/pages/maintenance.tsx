import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit2,
  Eye,
  Filter,
  Plus,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import AddMaintenanceModal from "@/components/modals/add-maintenance-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-accent text-accent-foreground">Completado</Badge>
      );
    case "in_progress":
      return <Badge className="bg-chart-3 text-white">En Progreso</Badge>;
    case "scheduled":
      return <Badge className="bg-chart-2 text-white">Programado</Badge>;
    case "cancelled":
      return <Badge variant="secondary">Cancelado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getMaintenanceTypeBadge(type: string) {
  switch (type) {
    case "preventive":
      return (
        <Badge className="bg-accent text-accent-foreground">Preventivo</Badge>
      );
    case "corrective":
      return <Badge className="bg-chart-3 text-white">Correctivo</Badge>;
    case "emergency":
      return (
        <Badge className="bg-destructive text-destructive-foreground">
          Emergencia
        </Badge>
      );
    case "upgrade":
      return <Badge variant="outline">Mejora</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

function formatDate(dateString?: string | null) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("es-ES");
}

function formatCurrency(value: unknown) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Maintenance() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const companies: any[] = supportStatus?.supportMode
    ? [{ company: supportStatus.company }]
    : userCompanies;

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(String(companies[0].company.id));
    }
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    setExpandedId(null);
  }, [selectedCompanyId]);

  const {
    data: maintenanceRecords = [],
    isLoading: isMaintenanceLoading,
    error: maintenanceError,
  } = useQuery<any[]>({
    queryKey: ["/api/maintenance", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (
      maintenanceError &&
      isUnauthorizedError(maintenanceError as Error)
    ) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al inicio de sesión...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [maintenanceError, toast]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  const normalizedSearchTerm = searchTerm.toLowerCase();
  const filteredRecords = maintenanceRecords.filter((record: any) => {
    const assetName =
      record.assetName ?? record.asset_name ?? record.asset?.name ?? "";

    return (
      String(record.description ?? "")
        .toLowerCase()
        .includes(normalizedSearchTerm) ||
      String(record.title ?? "").toLowerCase().includes(normalizedSearchTerm) ||
      String(record.vendor ?? "").toLowerCase().includes(normalizedSearchTerm) ||
      String(record.maintenanceType ?? "")
        .toLowerCase()
        .includes(normalizedSearchTerm) ||
      String(assetName).toLowerCase().includes(normalizedSearchTerm)
    );
  });

  const scheduledRecords = filteredRecords.filter(
    (record: any) => record.status === "scheduled",
  );
  const inProgressRecords = filteredRecords.filter(
    (record: any) => record.status === "in_progress",
  );
  const completedRecords = filteredRecords.filter(
    (record: any) => record.status === "completed",
  );

  const tableProps = {
    loading: isMaintenanceLoading,
    companyId: selectedCompanyId,
    expandedId,
    onExpandedChange: setExpandedId,
    onAdd: () => setShowAddModal(true),
  };

  return (
    <div className="flex h-screen">
      <Sidebar
        selectedCompanyId={selectedCompanyId}
        onCompanyChange={setSelectedCompanyId}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="Mantenimientos"
          subtitle="Historial y registro de mantenimientos de equipos"
        />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Registros
                      </p>
                      <p
                        className="text-2xl font-bold text-foreground tabular-nums"
                        data-testid="text-total-maintenance"
                      >
                        {isMaintenanceLoading
                          ? "..."
                          : maintenanceRecords.length}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
                      <Wrench className="h-6 w-6 text-primary-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Programados
                      </p>
                      <p
                        className="text-2xl font-bold text-foreground tabular-nums"
                        data-testid="text-scheduled-maintenance"
                      >
                        {isMaintenanceLoading
                          ? "..."
                          : scheduledRecords.length}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-2">
                      <Calendar className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        En Progreso
                      </p>
                      <p
                        className="text-2xl font-bold text-foreground tabular-nums"
                        data-testid="text-inprogress-maintenance"
                      >
                        {isMaintenanceLoading
                          ? "..."
                          : inProgressRecords.length}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-3">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Costo Total
                      </p>
                      <p
                        className="text-2xl font-bold text-foreground tabular-nums"
                        data-testid="text-maintenance-cost"
                      >
                        {isMaintenanceLoading
                          ? "$..."
                          : formatCurrency(
                              maintenanceRecords.reduce(
                                (sum: number, record: any) =>
                                  sum + Number(record.cost || 0),
                                0,
                              ),
                            )}
                      </p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border">
              <CardHeader>
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <CardTitle>Registros de Mantenimiento</CardTitle>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar mantenimientos..."
                        className="w-full pl-10 sm:w-80"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        data-testid="input-search-maintenance"
                      />
                    </div>
                    <Button variant="outline" data-testid="button-filters">
                      <Filter className="mr-2 h-4 w-4" />
                      Filtros
                    </Button>
                    <Button
                      onClick={() => setShowAddModal(true)}
                      disabled={!selectedCompanyId}
                      data-testid="button-add-maintenance"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Programar Mantenimiento
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger
                      value="all"
                      data-testid="tab-all-maintenance"
                    >
                      Todos
                    </TabsTrigger>
                    <TabsTrigger
                      value="scheduled"
                      data-testid="tab-scheduled-maintenance"
                    >
                      Programados
                    </TabsTrigger>
                    <TabsTrigger
                      value="in_progress"
                      data-testid="tab-inprogress-maintenance"
                    >
                      En Progreso
                    </TabsTrigger>
                    <TabsTrigger
                      value="completed"
                      data-testid="tab-completed-maintenance"
                    >
                      Completados
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="mt-4">
                    <MaintenanceTable
                      records={filteredRecords}
                      {...tableProps}
                    />
                  </TabsContent>

                  <TabsContent value="scheduled" className="mt-4">
                    <MaintenanceTable
                      records={scheduledRecords}
                      {...tableProps}
                    />
                  </TabsContent>

                  <TabsContent value="in_progress" className="mt-4">
                    <MaintenanceTable
                      records={inProgressRecords}
                      {...tableProps}
                    />
                  </TabsContent>

                  <TabsContent value="completed" className="mt-4">
                    <MaintenanceTable
                      records={completedRecords}
                      {...tableProps}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {selectedCompanyId && (
        <AddMaintenanceModal
          key={selectedCompanyId}
          open={showAddModal}
          onOpenChange={setShowAddModal}
          companyId={selectedCompanyId}
        />
      )}
    </div>
  );
}

interface MaintenanceTableProps {
  records: any[];
  loading: boolean;
  companyId: string;
  expandedId: string | null;
  onExpandedChange: (id: string | null) => void;
  onAdd: () => void;
}

function MaintenanceTable({
  records,
  loading,
  companyId,
  expandedId,
  onExpandedChange,
  onAdd,
}: MaintenanceTableProps) {
  const toggleRecord = (recordId: string | number) => {
    const normalizedId = String(recordId);
    onExpandedChange(expandedId === normalizedId ? null : normalizedId);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Descripción</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>Fecha Programada</TableHead>
            <TableHead>Fecha Completada</TableHead>
            <TableHead className="text-right">Costo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: 10 }).map((__, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : records.length > 0 ? (
            records.map((record: any) => {
              const recordId = String(record.id);
              const isExpanded = expandedId === recordId;
              const assetName =
                record.assetName ??
                record.asset_name ??
                record.asset?.name ??
                "—";

              return (
                <MaintenanceRecordRows
                  key={record.id}
                  record={record}
                  companyId={companyId}
                  assetName={assetName}
                  isExpanded={isExpanded}
                  onToggle={() => toggleRecord(record.id)}
                />
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                  <Wrench className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  No se encontraron registros
                </h3>
                <p className="mb-6 text-muted-foreground">
                  No hay registros de mantenimiento para mostrar.
                </p>
                <Button
                  onClick={onAdd}
                  disabled={!companyId}
                  data-testid="button-add-first-maintenance"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Programar Primer Mantenimiento
                </Button>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface MaintenanceRecordRowsProps {
  record: any;
  companyId: string;
  assetName: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function MaintenanceRecordRows({
  record,
  companyId,
  assetName,
  isExpanded,
  onToggle,
}: MaintenanceRecordRowsProps) {
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
        data-testid={`row-maintenance-${record.id}`}
      >
        <TableCell>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell
          className="max-w-[280px] font-medium"
          data-testid="text-maintenance-description"
        >
          <div className="truncate">{record.title || record.description}</div>
        </TableCell>
        <TableCell>{assetName}</TableCell>
        <TableCell>
          {getMaintenanceTypeBadge(record.maintenanceType)}
        </TableCell>
        <TableCell>{record.vendor || "N/A"}</TableCell>
        <TableCell>{formatDate(record.scheduledDate)}</TableCell>
        <TableCell>{formatDate(record.completedDate)}</TableCell>
        <TableCell className="text-right tabular-nums">
          {record.cost === null || record.cost === undefined
            ? "—"
            : formatCurrency(record.cost)}
        </TableCell>
        <TableCell>{getStatusBadge(record.status)}</TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ver mantenimiento"
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
              data-testid={`button-view-${record.id}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Editar mantenimiento"
              onClick={(event) => event.stopPropagation()}
              data-testid={`button-edit-${record.id}`}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Eliminar mantenimiento"
              className="text-destructive hover:text-destructive"
              onClick={(event) => event.stopPropagation()}
              data-testid={`button-delete-${record.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={10} className="bg-muted/30 p-0">
            <MaintenanceExpandedPanel
              record={record}
              companyId={companyId}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function MaintenanceExpandedPanel({
  record,
  companyId,
}: {
  record: any;
  companyId: string;
}) {
  const { data: lines = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/maintenance", companyId, record.id, "lines"],
    enabled: !!companyId && !!record.id,
  });

  const normalizedLines = Array.isArray(lines) ? lines : [];
  const lineTotal = (line: any) =>
    Number(line.quantity || 0) * Number(line.unitCost ?? line.unit_cost ?? 0);
  const total = normalizedLines.reduce(
    (sum: number, line: any) => sum + lineTotal(line),
    0,
  );

  return (
    <div className="space-y-4 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-sm font-medium">Descripción completa</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {record.description || "Sin descripción"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Técnico</p>
          <p className="text-sm text-muted-foreground">
            {record.technician || "No especificado"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Detalle de piezas y servicio</p>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : normalizedLines.length > 0 ? (
          <div className="overflow-x-auto rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Unitario</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {normalizedLines.map((line: any, index: number) => (
                  <TableRow key={line.id ?? index}>
                    <TableCell>{line.description}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(line.quantity || 0).toLocaleString("en-US")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(line.unitCost ?? line.unit_cost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(lineTotal(line))}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell colSpan={3} className="font-semibold">
                    TOTAL
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
            Sin detalle de piezas/servicio
          </p>
        )}
      </div>
    </div>
  );
}