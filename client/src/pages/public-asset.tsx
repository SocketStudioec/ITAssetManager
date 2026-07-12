import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import {
  Ban,
  CircleCheck,
  CircleHelp,
  CircleMinus,
  SearchX,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PublicAssetCustomField {
  fieldName: string;
  fieldValue: string | null;
}

interface PublicAssetPhoto {
  filePath: string;
}

interface PublicAsset {
  assetCode: string;
  name: string;
  companyName?: string | null;
  categoryName?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  location?: string | null;
  locationName?: string | null;
  status?: string | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  warrantyExpiry?: string | null;
  warrantyExpiration?: string | null;
  warrantyExpirationDate?: string | null;
  customFields?: PublicAssetCustomField[];
  photos?: PublicAssetPhoto[];
}

interface StatusPresentation {
  label: string;
  icon: LucideIcon;
  className: string;
}

const statusPresentations: Record<string, StatusPresentation> = {
  active: {
    label: "Activo",
    icon: CircleCheck,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
  },
  maintenance: {
    label: "En mantenimiento",
    icon: Wrench,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  },
  inactive: {
    label: "Inactivo",
    icon: CircleMinus,
    className:
      "border-border bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  },
  deprecated: {
    label: "Obsoleto",
    icon: TriangleAlert,
    className:
      "border-orange-200 bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900",
  },
  disposed: {
    label: "Dado de baja",
    icon: Ban,
    className:
      "border-red-200 bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
  },
};

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function displayValue(value?: string | null) {
  return value?.trim() || "—";
}

function AssetStatusBadge({ status }: { status?: string | null }) {
  const normalizedStatus = status?.toLowerCase() || "";
  const presentation = statusPresentations[normalizedStatus] || {
    label: displayValue(status),
    icon: CircleHelp,
    className: "border-border bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  };
  const StatusIcon = presentation.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 whitespace-nowrap font-medium", presentation.className)}
    >
      <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
      {presentation.label}
    </Badge>
  );
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6" aria-label="Cargando activo">
        <div className="space-y-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function ErrorState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-border shadow-none">
        <CardContent className="flex flex-col items-center p-6 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Activo no encontrado
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            El código solicitado no existe o ya no está disponible públicamente.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function PublicAsset() {
  const [, params] = useRoute("/p/asset/:code");
  const code = params?.code || "";

  const {
    data: asset,
    isPending,
    isError,
  } = useQuery<PublicAsset>({
    queryKey: ["/api/public/asset", code],
    enabled: !!code,
  });

  if (isPending) {
    return <LoadingState />;
  }

  if (isError || !asset) {
    return <ErrorState />;
  }

  const customFields = asset.customFields || [];
  const photos = asset.photos || [];
  const subtitle = [asset.companyName, asset.categoryName].filter(Boolean).join(" · ");
  const warrantyDate =
    asset.warrantyUntil ||
    asset.warrantyExpiry ||
    asset.warrantyExpiration ||
    asset.warrantyExpirationDate;

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-3">
          <Badge variant="secondary" className="font-mono tabular-nums">
            {asset.assetCode}
          </Badge>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {asset.name}
            </h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </header>

        <Separator />

        <section aria-labelledby="asset-information">
          <h2 id="asset-information" className="sr-only">
            Información del activo
          </h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Fabricante</dt>
              <dd className="text-sm text-foreground">{displayValue(asset.manufacturer)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Modelo</dt>
              <dd className="text-sm text-foreground">{displayValue(asset.model)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Serie</dt>
              <dd className="break-all font-mono text-sm text-foreground">
                {displayValue(asset.serialNumber)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Ubicación</dt>
              <dd className="text-sm text-foreground">
                {displayValue(asset.locationName || asset.location)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Estado</dt>
              <dd>
                <AssetStatusBadge status={asset.status} />
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Fecha de compra</dt>
              <dd className="text-sm text-foreground">{formatDate(asset.purchaseDate)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Garantía hasta</dt>
              <dd className="text-sm text-foreground">{formatDate(warrantyDate)}</dd>
            </div>
          </dl>
        </section>

        {customFields.length > 0 && (
          <>
            <Separator />
            <section className="space-y-3" aria-labelledby="additional-information">
              <h2
                id="additional-information"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                Información adicional
              </h2>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {customFields.map((field, index) => (
                      <tr key={`${field.fieldName}-${index}`}>
                        <th
                          scope="row"
                          className="w-2/5 bg-muted/50 px-4 py-3 text-left font-medium text-foreground"
                        >
                          {field.fieldName}
                        </th>
                        <td className="break-words px-4 py-3 text-muted-foreground">
                          {displayValue(field.fieldValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {photos.length > 0 && (
          <>
            <Separator />
            <section className="space-y-3" aria-labelledby="asset-photos">
              <h2
                id="asset-photos"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                Fotos
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo, index) => (
                  <a
                    key={`${photo.filePath}-${index}`}
                    href={`/uploads/${photo.filePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={`Abrir foto ${index + 1} en una pestaña nueva`}
                  >
                    <img
                      src={`/uploads/${photo.filePath}`}
                      alt={`Foto ${index + 1} de ${asset.name}`}
                      loading="lazy"
                      className="aspect-square w-full rounded-lg border object-cover"
                    />
                  </a>
                ))}
              </div>
            </section>
          </>
        )}

        <Separator />

        <footer className="text-center text-sm text-muted-foreground">
          Información pública generada por TechAssets Pro
        </footer>
      </article>
    </main>
  );
}