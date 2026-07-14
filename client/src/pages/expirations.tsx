import { useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePersistedCompany } from "@/hooks/usePersistedCompany";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CalendarClock,
  CalendarCheck,
  Clock,
  ArrowRight,
  X,
  Search,
  DollarSign,
  ShieldCheck,
} from "lucide-react";

type ExpirationItem = {
  key: string;
  source:
    | "license"
    | "domain"
    | "ssl"
    | "hosting"
    | "server"
    | "contract"
    | "contract_renewal"
    | "warranty"
    | string;
  kindLabel: string;
  entityId: string;
  entityName: string;
  date: string;
  daysLeft: number;
  severity: "expired" | "critical" | "warning";
  monthlyCost: number | string | null;
  dismissed: boolean;
};

const severitySections: Array<{
  severity: ExpirationItem["severity"];
  title: string;
  description: string;
  iconClassName: string;
  containerClassName: string;
}> = [
  {
    severity: "expired",
    title: "Vencidos",
    description: "Requieren atención inmediata",
    iconClassName: "text-red-600",
    containerClassName: "bg-red-50 dark:bg-red-950/30",
  },
  {
    severity: "critical",
    title: "Urgente (7 días)",
    description: "Vencen durante los próximos 7 días",
    iconClassName: "text-orange-600",
    containerClassName: "bg-orange-50 dark:bg-orange-950/30",
  },
  {
    severity: "warning",
    title: "Próximos (30 días)",
    description: "Planifica estas renovaciones",
    iconClassName: "text-yellow-600",
    containerClassName: "bg-yellow-50 dark:bg-yellow-950/30",
  },
];

const getDestination = (source: string) => {
  if (
    source === "license" ||
    source === "domain" ||
    source === "ssl" ||
    source === "hosting" ||
    source === "server"
  ) {
    return "/subscriptions";
  }

  if (source === "contract" || source === "contract_renewal") {
    return "/contracts";
  }

  if (source === "warranty") {
    return "/assets";
  }

  return "/assets";
};

const formatDate = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return date.toLocaleDateString("es-ES");
};

const formatDaysLeft = (daysLeft: number) => {
  if (daysLeft < 0) {
    const elapsedDays = Math.abs(daysLeft);
    return `Venció hace ${elapsedDays} ${
      elapsedDays === 1 ? "día" : "días"
    }`;
  }

  if (daysLeft === 0) {
    return "Vence hoy";
  }

  return `Vence en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`;
};

const formatMonthlyCost = (value: number) =>
  `$${value.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getSeverityIcon = (severity: ExpirationItem["severity"]) => {
  if (severity === "expired") {
    return <AlertTriangle className="h-5 w-5 text-red-600" />;
  }

  if (severity === "critical") {
    return <Clock className="h-5 w-5 text-orange-600" />;
  }

  return <CalendarClock className="h-5 w-5 text-yellow-600" />;
};

export default function Expirations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuth();

  const [selectedCompanyId, setSelectedCompanyId] = usePersistedCompany();
  const [days, setDays] = useState(30);
  const [showDismissed, setShowDismissed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      toast({
        title: "No autorizado",
        description: "Redirigiendo al inicio de sesión...",
        variant: "destructive",
      });

      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isAuthLoading, toast]);

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
    const firstCompanyId = companies[0]?.company?.id;
    const isMember = companies.some((uc: any) => uc.company?.id === selectedCompanyId);

    if (firstCompanyId && !isMember) {
      setSelectedCompanyId(String(firstCompanyId));
    }
  }, [companies, selectedCompanyId]);

  const {
    data: expirationItems = [],
    isLoading: isExpirationsLoading,
  } = useQuery<ExpirationItem[]>({
    queryKey: ["/api/notifications", selectedCompanyId, days],
    queryFn: async () => {
      const response = await fetch(
        `/api/notifications/${selectedCompanyId}?days=${days}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("error");
      }

      return response.json();
    },
    enabled: !!selectedCompanyId,
  });

  const dismissMutation = useMutation({
    mutationFn: async (item: ExpirationItem) =>
      apiRequest(
        "POST",
        `/api/notifications/${selectedCompanyId}/dismiss`,
        {
          key: item.key,
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "/api/notifications",
            selectedCompanyId,
            days,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "/api/notifications/unread-count",
            selectedCompanyId,
          ],
        }),
      ]);

      toast({
        title: "Alerta descartada",
        description: "El vencimiento fue marcado como descartado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "No se pudo descartar la alerta",
        description:
          error.message || "Intenta nuevamente en unos momentos.",
        variant: "destructive",
      });
    },
  });

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const visibleItems = expirationItems.filter((item) => {
    if (item.dismissed && !showDismissed) {
      return false;
    }

    if (!normalizedSearchTerm) {
      return true;
    }

    const entityName = String(item.entityName || "").toLowerCase();
    const kindLabel = String(item.kindLabel || "").toLowerCase();

    return (
      entityName.includes(normalizedSearchTerm) ||
      kindLabel.includes(normalizedSearchTerm)
    );
  });

  const expiredCount = expirationItems.filter(
    (item) => item.daysLeft < 0,
  ).length;
  const thisWeekCount = expirationItems.filter(
    (item) => item.daysLeft >= 0 && item.daysLeft <= 7,
  ).length;
  const thisMonthCount = expirationItems.filter(
    (item) => item.daysLeft >= 0 && item.daysLeft <= 30,
  ).length;
  const monthlyCostAtRisk = expirationItems.reduce((total, item) => {
    if (item.dismissed || item.daysLeft > 30) {
      return total;
    }

    const monthlyCost = Number(item.monthlyCost || 0);
    return total + (Number.isFinite(monthlyCost) ? monthlyCost : 0);
  }, 0);

  if (isAuthLoading || !isAuthenticated) {
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
          title="Vencimientos"
          subtitle="Todo lo que está por vencer en tu empresa"
          selectedCompanyId={selectedCompanyId}
        />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 space-y-6">
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {[7, 30, 90].map((windowDays) => (
                      <Button
                        key={windowDays}
                        variant={
                          days === windowDays ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setDays(windowDays)}
                        data-testid={`button-window-${windowDays}`}
                      >
                        {windowDays} días
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show-dismissed"
                      checked={showDismissed}
                      onCheckedChange={setShowDismissed}
                      data-testid="switch-show-dismissed"
                    />
                    <Label
                      htmlFor="show-dismissed"
                      className="cursor-pointer font-normal"
                    >
                      Mostrar descartados
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Vencidos
                      </p>
                      {isExpirationsLoading ? (
                        <Skeleton className="mt-2 h-8 w-16" />
                      ) : (
                        <p
                          className="text-2xl font-bold text-foreground"
                          data-testid="text-expired-count"
                        >
                          {expiredCount}
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
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
                        Esta semana
                      </p>
                      {isExpirationsLoading ? (
                        <Skeleton className="mt-2 h-8 w-16" />
                      ) : (
                        <p
                          className="text-2xl font-bold text-foreground"
                          data-testid="text-this-week-count"
                        >
                          {thisWeekCount}
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Este mes
                      </p>
                      {isExpirationsLoading ? (
                        <Skeleton className="mt-2 h-8 w-16" />
                      ) : (
                        <p
                          className="text-2xl font-bold text-foreground"
                          data-testid="text-this-month-count"
                        >
                          {thisMonthCount}
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
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
                        Costo mensual en riesgo
                      </p>
                      {isExpirationsLoading ? (
                        <Skeleton className="mt-2 h-8 w-28" />
                      ) : (
                        <p
                          className="text-2xl font-bold text-foreground"
                          data-testid="text-monthly-cost-at-risk"
                        >
                          {formatMonthlyCost(monthlyCostAtRisk)}
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
                  <div>
                    <CardTitle>Próximos vencimientos</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Licencias, contratos, garantías e infraestructura
                      por renovar.
                    </p>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre o tipo..."
                      className="pl-10 lg:w-80"
                      value={searchTerm}
                      onChange={(event) =>
                        setSearchTerm(event.target.value)
                      }
                      data-testid="input-search-expirations"
                    />
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {isExpirationsLoading ? (
                  <div className="space-y-6">
                    {Array.from({ length: 3 }).map((_, sectionIndex) => (
                      <div key={sectionIndex} className="space-y-3">
                        <Skeleton className="h-6 w-48" />
                        {Array.from({ length: 2 }).map((__, rowIndex) => (
                          <Skeleton
                            key={rowIndex}
                            className="h-24 w-full"
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : visibleItems.length === 0 ? (
                  <div
                    className="py-16 text-center"
                    data-testid="empty-expirations"
                  >
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-950/40 rounded-full flex items-center justify-center mx-auto mb-5">
                      {searchTerm ? (
                        <Search className="w-10 h-10 text-muted-foreground" />
                      ) : (
                        <CalendarCheck className="w-10 h-10 text-green-600" />
                      )}
                    </div>
                    <h3 className="mb-2 text-xl font-semibold text-foreground">
                      {searchTerm
                        ? "No se encontraron vencimientos"
                        : "Todo al día"}
                    </h3>
                    <p className="mx-auto max-w-xl text-muted-foreground">
                      {searchTerm
                        ? "No hay vencimientos que coincidan con tu búsqueda."
                        : `No tienes vencimientos en los próximos ${days} días. Te avisaremos cuando algo esté por vencer.`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {severitySections.map((section, sectionIndex) => {
                      const sectionItems = visibleItems.filter(
                        (item) => item.severity === section.severity,
                      );

                      if (sectionItems.length === 0) {
                        return null;
                      }

                      return (
                        <section
                          key={section.severity}
                          data-testid={`section-${section.severity}`}
                        >
                          {sectionIndex > 0 && (
                            <Separator className="mb-6" />
                          )}

                          <div className="mb-4 flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-lg ${section.containerClassName}`}
                            >
                              {section.severity === "expired" ? (
                                <AlertTriangle
                                  className={`h-5 w-5 ${section.iconClassName}`}
                                />
                              ) : section.severity === "critical" ? (
                                <Clock
                                  className={`h-5 w-5 ${section.iconClassName}`}
                                />
                              ) : (
                                <ShieldCheck
                                  className={`h-5 w-5 ${section.iconClassName}`}
                                />
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">
                                {section.title}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {section.description}
                              </p>
                            </div>
                            <Badge variant="secondary" className="ml-auto">
                              {sectionItems.length}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            {sectionItems.map((item) => {
                              const monthlyCost = Number(
                                item.monthlyCost || 0,
                              );
                              const hasMonthlyCost =
                                Number.isFinite(monthlyCost) &&
                                monthlyCost > 0;

                              return (
                                <div
                                  key={item.key}
                                  className={`flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between ${
                                    item.dismissed ? "opacity-60" : ""
                                  }`}
                                  data-testid={`row-expiration-${item.key}`}
                                >
                                  <div className="flex min-w-0 gap-3">
                                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                                      {getSeverityIcon(item.severity)}
                                    </div>

                                    <div className="min-w-0 space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">
                                          {item.kindLabel}
                                        </Badge>
                                        {item.dismissed && (
                                          <Badge variant="secondary">
                                            Descartado
                                          </Badge>
                                        )}
                                      </div>

                                      <p className="font-semibold text-foreground break-words">
                                        {item.entityName}
                                      </p>

                                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                        <span>{formatDate(item.date)}</span>
                                        <span
                                          className={
                                            item.severity === "expired"
                                              ? "font-medium text-red-600"
                                              : item.severity === "critical"
                                                ? "font-medium text-orange-600"
                                                : "font-medium text-yellow-700 dark:text-yellow-500"
                                          }
                                        >
                                          {formatDaysLeft(item.daysLeft)}
                                        </span>
                                        {hasMonthlyCost && (
                                          <span className="font-medium text-foreground">
                                            {formatMonthlyCost(monthlyCost)}
                                            /mes
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setLocation(
                                          getDestination(item.source),
                                        )
                                      }
                                      data-testid={`button-view-${item.key}`}
                                    >
                                      Ver
                                      <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>

                                    {item.dismissed ? (
                                      <span className="px-2 text-sm text-muted-foreground">
                                        Descartado
                                      </span>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          dismissMutation.mutate(item)
                                        }
                                        disabled={
                                          dismissMutation.isPending
                                        }
                                        data-testid={`button-dismiss-${item.key}`}
                                      >
                                        <X className="mr-2 h-4 w-4" />
                                        Descartar
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}