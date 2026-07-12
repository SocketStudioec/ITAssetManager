export interface DepreciationInput {
  purchaseCost: number;
  residualValue: number;
  depreciationYears: number;
  purchaseDate: Date | string | null;
}

export interface DepreciationScheduleItem {
  year: number;
  annualDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

export interface DepreciationResult {
  monthlyDepreciation: number;
  annualDepreciation: number;
  monthsElapsed: number;
  accumulatedDepreciation: number;
  bookValue: number;
  fullyDepreciated: boolean;
  schedule: DepreciationScheduleItem[];
}

export const ECUADOR_DEPRECIATION_NOTE =
  "Depreciacion en linea recta segun Reglamento LRTI Art. 28 (Ecuador): equipos de computo 3 anios (33%), maquinaria/equipos/muebles 10 anios (10%), vehiculos 5 anios (20%).";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function getElapsedMonths(purchaseDate: Date | string | null): number {
  if (purchaseDate === null) {
    return 0;
  }

  const parsedDate =
    purchaseDate instanceof Date
      ? new Date(purchaseDate.getTime())
      : new Date(purchaseDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return 0;
  }

  const now = new Date();
  if (parsedDate.getTime() > now.getTime()) {
    return 0;
  }

  let months =
    (now.getFullYear() - parsedDate.getFullYear()) * 12 +
    now.getMonth() -
    parsedDate.getMonth();

  if (
    now.getDate() < parsedDate.getDate() ||
    (now.getDate() === parsedDate.getDate() &&
      (now.getHours() < parsedDate.getHours() ||
        (now.getHours() === parsedDate.getHours() &&
          now.getMinutes() < parsedDate.getMinutes())))
  ) {
    months -= 1;
  }

  return Math.max(0, months);
}

/**
 * Calcula la depreciación por línea recta y su proyección anual.
 */
export function computeDepreciation(
  input: DepreciationInput
): DepreciationResult {
  const purchaseCost = Math.max(0, normalizeNumber(input.purchaseCost));
  const residualValue = Math.max(0, normalizeNumber(input.residualValue));
  const depreciationYears = Math.max(
    0,
    Math.trunc(normalizeNumber(input.depreciationYears))
  );
  const totalMonths = depreciationYears * 12;
  const depreciableAmount = Math.max(0, purchaseCost - residualValue);
  const rawMonthlyDepreciation =
    totalMonths > 0 ? depreciableAmount / totalMonths : 0;
  const rawAnnualDepreciation =
    depreciationYears > 0 ? depreciableAmount / depreciationYears : 0;
  const elapsedMonths = Math.min(
    getElapsedMonths(input.purchaseDate),
    totalMonths
  );
  const rawAccumulatedDepreciation = Math.min(
    depreciableAmount,
    rawMonthlyDepreciation * elapsedMonths
  );
  const accumulatedDepreciation = roundMoney(
    rawAccumulatedDepreciation
  );
  const bookValue = roundMoney(
    Math.max(residualValue, purchaseCost - rawAccumulatedDepreciation)
  );
  const fullyDepreciated =
    depreciableAmount === 0 ||
    (totalMonths > 0 &&
      rawAccumulatedDepreciation >= depreciableAmount - Number.EPSILON);

  const schedule: DepreciationScheduleItem[] = [];
  let scheduledAccumulated = 0;

  for (let year = 1; year <= depreciationYears; year += 1) {
    const previousAccumulated = scheduledAccumulated;
    scheduledAccumulated =
      year === depreciationYears
        ? depreciableAmount
        : Math.min(depreciableAmount, rawAnnualDepreciation * year);

    schedule.push({
      year,
      annualDepreciation: roundMoney(
        scheduledAccumulated - previousAccumulated
      ),
      accumulatedDepreciation: roundMoney(scheduledAccumulated),
      bookValue: roundMoney(
        Math.max(residualValue, purchaseCost - scheduledAccumulated)
      ),
    });
  }

  return {
    monthlyDepreciation: roundMoney(rawMonthlyDepreciation),
    annualDepreciation: roundMoney(rawAnnualDepreciation),
    monthsElapsed: elapsedMonths,
    accumulatedDepreciation,
    bookValue,
    fullyDepreciated,
    schedule,
  };
}

/**
 * Convierte un importe de su ciclo de facturación a un valor mensual.
 */
export function normalizeToMonthly(
  amount: number,
  billingCycle: string | null
): number {
  const normalizedAmount = normalizeNumber(amount);

  switch (billingCycle?.trim().toLowerCase()) {
    case "monthly":
      return normalizedAmount;
    case "quarterly":
      return normalizedAmount / 3;
    case "semiannual":
      return normalizedAmount / 6;
    case "annual":
      return normalizedAmount / 12;
    case "one_time":
      return 0;
    default:
      return normalizedAmount;
  }
}