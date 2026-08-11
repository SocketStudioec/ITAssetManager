/**
 * Tipos y agregaciones compartidas del informe quincenal.
 *
 * El CUERPO DEL CORREO muestra únicamente el resumen agrupado por proveedor
 * (quién nos presta cada servicio y cuánto cuesta al mes) y el PDF adjunto
 * lleva el detalle completo, también agrupado por proveedor.
 */

export interface ReportApplicationRow {
  name: string;
  purpose: string;
  provider: string;
  monthlyCost: number;
}

export interface ReportPhysicalAssetRow {
  name: string;
  assetCode: string;
  assignedTo: string;
  provider: string;
  monthlyDepreciation: number;
  maintenanceMonthly: number;
}

export interface BiweeklyData {
  applications: ReportApplicationRow[];
  physicalAssets: ReportPhysicalAssetRow[];
  totals: {
    applicationsMonthly: number;
    physicalMonthly: number;
    grandTotal: number;
  };
}

export interface ProviderSummaryRow {
  provider: string;
  items: number;
  servicesMonthly: number;
  physicalMonthly: number;
  totalMonthly: number;
  /** Porcentaje del gasto mensual total (0-100). */
  share: number;
}

export interface ProviderGroup<T> {
  provider: string;
  monthlyTotal: number;
  items: T[];
}

export const NO_PROVIDER_LABEL = "Sin proveedor asignado";

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function normalizeProvider(value: unknown): string {
  const text = String(value ?? "").trim();
  return text || NO_PROVIDER_LABEL;
}

function providerKey(provider: string): string {
  return provider.toLocaleLowerCase("es-EC");
}

/**
 * Mayor gasto primero; "Sin proveedor asignado" siempre al final.
 */
function compareByAmount(
  a: { provider: string; amount: number },
  b: { provider: string; amount: number }
): number {
  const aUnassigned = a.provider === NO_PROVIDER_LABEL;
  const bUnassigned = b.provider === NO_PROVIDER_LABEL;

  if (aUnassigned !== bUnassigned) {
    return aUnassigned ? 1 : -1;
  }

  if (b.amount !== a.amount) {
    return b.amount - a.amount;
  }

  return a.provider.localeCompare(b.provider, "es-EC");
}

/**
 * Agrupa filas por proveedor (sin distinguir mayúsculas) conservando el
 * nombre tal como se escribió la primera vez.
 */
export function groupByProvider<T>(
  items: T[],
  getMonthly: (item: T) => number
): ProviderGroup<T>[] {
  const groups = new Map<string, ProviderGroup<T>>();

  for (const item of items) {
    const provider = normalizeProvider(
      (item as { provider?: unknown }).provider
    );
    const key = providerKey(provider);
    const group = groups.get(key);

    if (group) {
      group.items.push(item);
      group.monthlyTotal = roundMoney(
        group.monthlyTotal + getMonthly(item)
      );
      continue;
    }

    groups.set(key, {
      provider,
      monthlyTotal: roundMoney(getMonthly(item)),
      items: [item],
    });
  }

  return Array.from(groups.values()).sort((a, b) =>
    compareByAmount(
      { provider: a.provider, amount: a.monthlyTotal },
      { provider: b.provider, amount: b.monthlyTotal }
    )
  );
}

export function applicationMonthly(row: ReportApplicationRow): number {
  return Number(row.monthlyCost) || 0;
}

export function physicalAssetMonthly(row: ReportPhysicalAssetRow): number {
  return (
    (Number(row.monthlyDepreciation) || 0) +
    (Number(row.maintenanceMonthly) || 0)
  );
}

/**
 * Resumen consolidado: una fila por proveedor con lo que cuesta al mes,
 * separando servicios (aplicaciones y licencias) de equipos físicos.
 */
export function buildProviderSummary(
  data: BiweeklyData
): ProviderSummaryRow[] {
  const rows = new Map<string, ProviderSummaryRow>();

  const upsert = (
    rawProvider: unknown,
    servicesMonthly: number,
    physicalMonthly: number
  ): void => {
    const provider = normalizeProvider(rawProvider);
    const key = providerKey(provider);
    const current =
      rows.get(key) ??
      {
        provider,
        items: 0,
        servicesMonthly: 0,
        physicalMonthly: 0,
        totalMonthly: 0,
        share: 0,
      };

    current.items += 1;
    current.servicesMonthly = roundMoney(
      current.servicesMonthly + servicesMonthly
    );
    current.physicalMonthly = roundMoney(
      current.physicalMonthly + physicalMonthly
    );
    current.totalMonthly = roundMoney(
      current.servicesMonthly + current.physicalMonthly
    );

    rows.set(key, current);
  };

  for (const application of data.applications) {
    upsert(application.provider, applicationMonthly(application), 0);
  }

  for (const asset of data.physicalAssets) {
    upsert(asset.provider, 0, physicalAssetMonthly(asset));
  }

  const grandTotal = Number(data.totals.grandTotal) || 0;

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      share:
        grandTotal > 0
          ? Math.round((row.totalMonthly / grandTotal) * 1000) / 10
          : 0,
    }))
    .sort((a, b) =>
      compareByAmount(
        { provider: a.provider, amount: a.totalMonthly },
        { provider: b.provider, amount: b.totalMonthly }
      )
    );
}
