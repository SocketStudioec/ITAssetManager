import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import {
  ExternalLink,
  ImageOff,
  Images,
  Loader2,
  Pencil,
  Plus,
  Printer,
  TrendingDown,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AssetDetailModalProps {
  asset: any;
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (asset: any) => void;
  categories: any[];
}

const currencyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const statusConfig: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  active: {
    label: "Activo",
    badgeClass:
      "border-transparent bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-950/40 dark:text-green-300 dark:ring-green-400/20",
    dotClass: "bg-green-500",
  },
  maintenance: {
    label: "Mantenimiento",
    badgeClass:
      "border-transparent bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-400/20",
    dotClass: "bg-amber-500",
  },
  inactive: {
    label: "Inactivo",
    badgeClass:
      "border-transparent bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    dotClass: "bg-muted-foreground",
  },
  deprecated: {
    label: "Obsoleto",
    badgeClass:
      "border-transparent bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-400/20",
    dotClass: "bg-orange-500",
  },
  disposed: {
    label: "Dado de baja",
    badgeClass:
      "border-transparent bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-400/20",
    dotClass: "bg-red-500",
  },
};

function getAssetCode(asset: any) {
  return asset?.assetCode || asset?.asset_code || asset?.code || "—";
}

function getCategoryId(asset: any) {
  return asset?.categoryId || asset?.category_id || "";
}

function getPurchaseCost(asset: any) {
  return Number(asset?.purchaseCost ?? asset?.purchase_cost ?? 0);
}

function getResidualValue(asset: any) {
  return Number(asset?.residualValue ?? asset?.residual_value ?? 0);
}

function getDepreciationYears(asset: any) {
  return asset?.depreciationYears ?? asset?.depreciation_years;
}

function formatCurrency(value: unknown) {
  const numericValue = Number(value);
  return currencyFormatter.format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatDate(value: unknown) {
  if (!value) {
    return "—";
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return dateFormatter.format(date);
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return String(
      objectValue.name
        ?? objectValue.fullName
        ?? objectValue.full_name
        ?? objectValue.email
        ?? "—",
    );
  }

  return String(value);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeArray(value: any): any[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.photos)) {
    return value.photos;
  }

  if (Array.isArray(value?.customFields)) {
    return value.customFields;
  }

  return [];
}

export default function AssetDetailModal({
  asset,
  companyId,
  open,
  onOpenChange,
  onEdit,
  categories,
}: AssetDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [depreciationOpen, setDepreciationOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const assetId = asset?.id ? String(asset.id) : "";
  const assetCode = getAssetCode(asset);
  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/p/asset/${encodeURIComponent(assetCode)}`
      : "";

  const customFieldsQuery = useQuery<any>({
    queryKey: ["/api/assets", companyId, assetId, "custom-fields"],
    enabled: open && !!companyId && !!assetId,
  });

  const photosQuery = useQuery<any>({
    queryKey: ["/api/assets", companyId, assetId, "photos"],
    enabled: galleryOpen && !!companyId && !!assetId,
  });

  const depreciationQuery = useQuery<any>({
    queryKey: ["/api/assets", companyId, assetId, "depreciation"],
    enabled: depreciationOpen && !!companyId && !!assetId,
  });

  const photos = normalizeArray(photosQuery.data);
  const customFields = normalizeArray(customFieldsQuery.data);

  useEffect(() => {
    if (!open) {
      setGalleryOpen(false);
      setDepreciationOpen(false);
    }
  }, [open]);

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      return apiRequest(
        "DELETE",
        `/api/asset-photos/${companyId}/${photoId}`,
      );
    },
    onSuccess: () => {
      toast({
        title: "Foto eliminada",
        description: "La foto se eliminó correctamente.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/assets", companyId, assetId, "photos"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "No se pudo eliminar la foto",
        description: error.message || "Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  if (!asset) {
    return null;
  }

  const category = (Array.isArray(categories) ? categories : []).find(
    (item: any) => String(item.id) === String(getCategoryId(asset)),
  );

  const categoryName = category?.name || "Sin categoría";
  const manufacturerModel = [asset.manufacturer, asset.model]
    .filter(Boolean)
    .join(" ");
  const subtitle = `${manufacturerModel || "Sin marca o modelo"} · ${categoryName}`;
  const depreciationYears =
    getDepreciationYears(asset)
    ?? category?.depreciationYears
    ?? category?.depreciation_years;
  const status = statusConfig[asset.status] || {
    label: asset.status || "Sin estado",
    badgeClass:
      "border-transparent bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    dotClass: "bg-muted-foreground",
  };

  const warrantyExpiry =
    asset.warrantyExpiry ?? asset.warranty_expiry ?? null;
  const warrantyDate = warrantyExpiry ? new Date(warrantyExpiry) : null;
  const now = new Date();
  const thirtyDaysFromNow = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  );

  let warrantyClassName = "tabular-nums";

  if (warrantyDate && !Number.isNaN(warrantyDate.getTime())) {
    if (warrantyDate.getTime() < now.getTime()) {
      warrantyClassName += " font-medium text-destructive";
    } else if (warrantyDate.getTime() <= thirtyDaysFromNow.getTime()) {
      warrantyClassName += " font-medium text-amber-700 dark:text-amber-300";
    }
  }

  const assignedTo =
    asset.assignedToName
    ?? asset.assigned_to_name
    ?? asset.assignedUserName
    ?? asset.assigned_user_name
    ?? asset.assignedTo
    ?? asset.assigned_to;

  const companyName =
    asset.companyName
    ?? asset.company_name
    ?? asset.company?.name
    ?? "TechAssets Pro";

  const informationRows = [
    {
      label: "Serie",
      value: displayValue(asset.serialNumber ?? asset.serial_number),
    },
    {
      label: "Ubicación",
      value: displayValue(asset.location),
    },
    {
      label: "Asignado a",
      value: displayValue(assignedTo),
    },
    {
      label: "Fecha de compra",
      value: formatDate(asset.purchaseDate ?? asset.purchase_date),
      className: "tabular-nums",
    },
    {
      label: "Garantía hasta",
      value: formatDate(warrantyExpiry),
      className: warrantyClassName,
    },
    {
      label: "Costo de compra",
      value: formatCurrency(getPurchaseCost(asset)),
      className: "font-medium tabular-nums",
    },
    {
      label: "Valor residual",
      value: formatCurrency(getResidualValue(asset)),
      className: "tabular-nums",
    },
    {
      label: "Años de depreciación",
      value:
        depreciationYears !== null
        && depreciationYears !== undefined
        && depreciationYears !== ""
          ? String(depreciationYears)
          : "—",
      className: "tabular-nums",
    },
  ];

  const handlePrintQr = () => {
    const dataUrl = canvasRef.current?.toDataURL("image/png");
    const win = window.open("", "_blank", "width=420,height=520");

    if (!dataUrl || !win) {
      toast({
        title: "No se pudo abrir la impresión",
        description:
          "El navegador bloqueó la ventana emergente. Habilita los popups e intenta nuevamente.",
        variant: "destructive",
      });
      return;
    }

    win.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>QR ${escapeHtml(assetCode)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 32px;
              color: #111827;
              background: #ffffff;
              font-family: Arial, sans-serif;
              text-align: center;
            }
            h1 {
              margin: 0 0 24px;
              font-size: 22px;
              font-weight: 600;
            }
            img {
              display: block;
              width: 260px;
              height: 260px;
              margin: 0 auto 20px;
            }
            .code {
              margin-bottom: 12px;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 24px;
              font-weight: 700;
            }
            .company {
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(asset.name || "Equipo físico")}</h1>
          <img src="${dataUrl}" alt="Código QR de ${escapeHtml(assetCode)}" />
          <div class="code">${escapeHtml(assetCode)}</div>
          <div class="company">${escapeHtml(companyName)}</div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleUploadPhotos = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    const formData = new FormData();

    files.forEach((file) => {
      formData.append("photos", file);
    });

    setIsUploading(true);

    try {
      const response = await fetch(
        `/api/assets/${companyId}/${assetId}/photos`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        },
      );

      if (!response.ok) {
        const message = (await response.text()) || response.statusText;
        throw new Error(message);
      }

      toast({
        title: files.length === 1 ? "Foto agregada" : "Fotos agregadas",
        description: `${files.length} ${
          files.length === 1 ? "foto se subió" : "fotos se subieron"
        } correctamente.`,
      });

      await queryClient.invalidateQueries({
        queryKey: ["/api/assets", companyId, assetId, "photos"],
      });
    } catch (error) {
      toast({
        title: "No se pudieron subir las fotos",
        description:
          error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const depreciation = depreciationQuery.data || {};
  const purchaseCost = Number(
    depreciation.purchaseCost
      ?? depreciation.purchase_cost
      ?? getPurchaseCost(asset),
  );
  const schedule = normalizeArray(
    depreciation.schedule ?? depreciation.projection,
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader className="space-y-3 pr-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="font-mono font-normal"
              >
                {assetCode}
              </Badge>
              <Badge variant="outline" className={status.badgeClass}>
                <span
                  className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status.dotClass}`}
                  aria-hidden="true"
                />
                {status.label}
              </Badge>
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                {asset.name || "Equipo sin nombre"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {subtitle}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="space-y-4">
              <h3 className="text-sm font-medium">
                Información del equipo
              </h3>

              <dl className="divide-y rounded-lg border px-4">
                {informationRows.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 py-3 text-sm"
                  >
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd
                      className={`break-words text-right ${row.className || ""}`}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {customFields.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">
                    Información adicional
                  </h3>
                  <dl className="divide-y rounded-lg border px-4">
                    {customFields.map((field: any, index: number) => (
                      <div
                        key={field.id || `${field.fieldName}-${index}`}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 py-3 text-sm"
                      >
                        <dt className="text-muted-foreground">
                          {field.fieldName
                            ?? field.field_name
                            ?? field.name
                            ?? "Campo"}
                        </dt>
                        <dd className="break-words text-right">
                          {displayValue(
                            field.fieldValue
                              ?? field.field_value
                              ?? field.value,
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-medium">Código QR</h3>

              <div className="flex flex-col items-center rounded-lg border p-6 text-center">
                <QRCodeCanvas
                  ref={canvasRef}
                  value={publicUrl}
                  size={180}
                  includeMargin
                />
                <div className="mt-3 font-mono text-sm">{assetCode}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Escanea para ver la ficha pública
                </p>

                <div className="mt-5 grid w-full gap-2">
                  <Button variant="outline" onClick={handlePrintQr}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir QR
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(publicUrl, "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir ficha pública
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-12"
              onClick={() => setGalleryOpen(true)}
            >
              <Images className="mr-2 h-4 w-4" />
              Abrir galería
              {photosQuery.isFetched && (
                <span className="ml-1 tabular-nums">({photos.length})</span>
              )}
            </Button>
            <Button
              variant="outline"
              className="h-12"
              onClick={() => setDepreciationOpen(true)}
            >
              <TrendingDown className="mr-2 h-4 w-4" />
              Ver depreciación
            </Button>
          </div>

          <DialogFooter className="border-t pt-4 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => onEdit(asset)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar equipo
            </Button>
            <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Galería del equipo</DialogTitle>
            <DialogDescription>
              Fotografías registradas para {asset.name || assetCode}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {photosQuery.isLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="aspect-square w-full rounded-lg"
                  />
                ))}
              </div>
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo: any) => {
                  const photoId = String(photo.id);
                  const photoUrl = `/uploads/${
                    photo.filePath ?? photo.file_path ?? ""
                  }`;
                  const isDeleting =
                    deletePhotoMutation.isPending
                    && deletePhotoMutation.variables === photoId;

                  return (
                    <div key={photoId} className="group relative">
                      <button
                        type="button"
                        className="block aspect-square w-full cursor-pointer overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        onClick={() => window.open(photoUrl, "_blank")}
                        aria-label={`Abrir foto de ${asset.name || "equipo"}`}
                      >
                        <img
                          src={photoUrl}
                          alt={photo.description || `Foto de ${asset.name || "equipo"}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-10 w-10 bg-background/80 opacity-100 backdrop-blur-sm hover:bg-background md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                        aria-label="Eliminar foto"
                        disabled={isDeleting}
                        onClick={() => deletePhotoMutation.mutate(photoId)}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
                <ImageOff className="mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="font-medium">No hay fotos registradas</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Agrega fotografías para documentar el estado del equipo.
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*"
              onChange={handleUploadPhotos}
            />
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full border-dashed"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {isUploading ? "Subiendo fotos..." : "Agregar fotos"}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setGalleryOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={depreciationOpen} onOpenChange={setDepreciationOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Depreciación del equipo</DialogTitle>
            <DialogDescription>
              Cálculo contable y proyección anual de {asset.name || assetCode}.
            </DialogDescription>
          </DialogHeader>

          {depreciationQuery.isLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-3 rounded-lg border p-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            </div>
          ) : !Number.isFinite(purchaseCost) || purchaseCost === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
              <TrendingDown className="mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-medium">
                No se puede calcular la depreciación
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Registra el costo de compra para calcular la depreciación.
              </p>
            </div>
          ) : depreciationQuery.isError ? (
            <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed px-6 text-center">
              <p className="text-sm text-muted-foreground">
                No se pudo cargar la información de depreciación.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">
                    Depreciación mensual
                  </p>
                  <p className="mt-2 text-xl font-semibold tabular-nums">
                    {formatCurrency(
                      depreciation.monthlyDepreciation
                        ?? depreciation.monthly_depreciation,
                    )}
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">
                    Valor en libros
                  </p>
                  <p className="mt-2 text-xl font-semibold tabular-nums">
                    {formatCurrency(
                      depreciation.bookValue ?? depreciation.book_value,
                    )}
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">
                    Gasto mensual total
                  </p>
                  <p className="mt-2 text-xl font-semibold text-primary tabular-nums">
                    {formatCurrency(
                      depreciation.monthlyCostTotal
                        ?? depreciation.monthly_cost_total,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    depreciación + mantenimientos
                  </p>
                </div>
              </div>

              {(depreciation.fullyDepreciated
                ?? depreciation.fully_depreciated) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  Este activo ya está totalmente depreciado.
                </div>
              )}

              <section className="space-y-3">
                <h3 className="text-sm font-medium">Proyección anual</h3>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Año</TableHead>
                        <TableHead className="text-right">
                          Depreciación anual
                        </TableHead>
                        <TableHead className="text-right">
                          Acumulada
                        </TableHead>
                        <TableHead className="text-right">
                          Valor en libros
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.length > 0 ? (
                        schedule.map((row: any, index: number) => (
                          <TableRow key={row.year ?? row.ano ?? index}>
                            <TableCell className="tabular-nums">
                              {row.year ?? row.ano ?? index + 1}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(
                                row.annualDepreciation
                                  ?? row.annual_depreciation
                                  ?? row.depreciation,
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(
                                row.accumulatedDepreciation
                                  ?? row.accumulated_depreciation
                                  ?? row.accumulated,
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(
                                row.bookValue ?? row.book_value,
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="h-24 text-center text-muted-foreground"
                          >
                            No hay una proyección disponible.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <div className="flex items-center justify-between gap-4 border-t pt-4 text-sm">
                <span className="text-muted-foreground">
                  Mantenimientos de los últimos 12 meses
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(depreciation.maintenance)}
                </span>
              </div>

              {depreciation.note && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {depreciation.note}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setDepreciationOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}