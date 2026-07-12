import * as XLSX from "xlsx";

const ASSET_HEADERS = [
  "Nombre*",
  "Categoria",
  "Marca",
  "Modelo",
  "Serie",
  "Ubicacion",
  "Asignado a",
  "Fecha compra (YYYY-MM-DD)",
  "Costo compra",
  "Valor residual",
  "Anios depreciacion",
  "Garantia hasta (YYYY-MM-DD)",
  "Notas",
];

const APPLICATION_HEADERS = [
  "Tipo* (suscripcion/licencia)",
  "Nombre*",
  "Proveedor*",
  "Ciclo (monthly/quarterly/semiannual/annual/one_time)",
  "Costo",
  "Motivo",
  "Metodo de pago (card/transfer/cash/other)",
  "Nombre tarjeta",
  "Banco",
  "Renovacion (automatic/manual)",
  "Vence (YYYY-MM-DD)",
  "Licencia key",
  "Notas",
];

type ExcelRow = unknown[];

export interface ParsedAssetRow {
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  location: string;
  assignedTo: string;
  purchaseDate: string | null;
  purchaseCost: number;
  residualValue: number;
  depreciationYears: number | null;
  warrantyExpiry: string | null;
  notes: string;
}

export interface ParsedApplicationRow {
  kind: "subscription" | "license";
  name: string;
  vendor: string;
  billingCycle: string;
  cost: number;
  purpose: string;
  paymentMethod: string;
  cardName: string;
  bankName: string;
  renewalType: string;
  expiryDate: string | null;
  licenseKey: string;
  notes: string;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*/g, "")
    .replace(/\([^)]*\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function text(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function isEmptyRow(row: ExcelRow): boolean {
  return row.every((value) => text(value) === "");
}

function buildHeaderMap(headerRow: ExcelRow): Map<string, number> {
  const headerMap = new Map<string, number>();

  headerRow.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (normalized && !headerMap.has(normalized)) {
      headerMap.set(normalized, index);
    }
  });

  return headerMap;
}

function getColumn(
  row: ExcelRow,
  headerMap: Map<string, number>,
  ...names: string[]
): unknown {
  for (const name of names) {
    const index = headerMap.get(normalizeHeader(name));
    if (index !== undefined) {
      return row[index];
    }
  }

  return "";
}

function parseMoney(
  value: unknown,
  label: string,
  messages: string[]
): number {
  if (text(value) === "") {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(text(value));

  if (!Number.isFinite(parsed) || parsed < 0) {
    messages.push(`${label} debe ser un número mayor o igual que cero.`);
    return 0;
  }

  return parsed;
}

function formatDateParts(
  year: number,
  month: number,
  day: number
): string | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function parseExcelDate(
  value: unknown,
  label: string,
  messages: string[]
): string | null {
  if (value === null || value === undefined || text(value) === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (parsed) {
      const formatted = formatDateParts(parsed.y, parsed.m, parsed.d);
      if (formatted) {
        return formatted;
      }
    }

    messages.push(`${label} no contiene una fecha válida.`);
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateParts(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate()
    );
  }

  const raw = text(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

  if (match) {
    const formatted = formatDateParts(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );

    if (formatted) {
      return formatted;
    }
  }

  messages.push(`${label} debe tener el formato YYYY-MM-DD.`);
  return null;
}

function attachExcelRowNumber<T extends object>(
  parsed: T,
  rowNumber: number
): T {
  Object.defineProperty(parsed, "__rowNumber", {
    value: rowNumber,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return parsed;
}

function workbookToRows(buffer: Buffer): ExcelRow[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: true,
    cellDates: false,
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  return XLSX.utils.sheet_to_json<ExcelRow>(
    workbook.Sheets[firstSheetName],
    {
      header: 1,
      raw: true,
      defval: "",
      blankrows: false,
    }
  );
}

function addInstructionsSheet(
  workbook: XLSX.WorkBook,
  rows: Array<[string, string]>
): void {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Columna", "Instrucción"],
    ...rows,
  ]);
  sheet["!cols"] = [{ wch: 42 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Instrucciones");
}

export function buildAssetsTemplate(): Buffer {
  const workbook = XLSX.utils.book_new();
  const equipmentSheet = XLSX.utils.aoa_to_sheet([
    ASSET_HEADERS,
    [
      "Laptop Dell Latitude 5440",
      "Equipos de cómputo",
      "Dell",
      "Latitude 5440",
      "DL5440-EC-2025-001",
      "Quito - Oficina principal",
      "María Andrade",
      "2025-01-15",
      1299.99,
      100,
      3,
      "2028-01-15",
      "Equipo asignado al área financiera.",
    ],
  ]);

  equipmentSheet["!cols"] = ASSET_HEADERS.map((header) => ({
    wch: Math.max(16, header.length + 2),
  }));
  XLSX.utils.book_append_sheet(workbook, equipmentSheet, "Equipos");

  addInstructionsSheet(workbook, [
    ["General", "La primera fila contiene los encabezados. No la elimine. * = obligatorio."],
    ["Nombre*", "Nombre descriptivo del equipo. Es obligatorio."],
    ["Categoria", "Categoría contable o funcional. Si no existe, se creará."],
    ["Marca", "Fabricante o marca del equipo."],
    ["Modelo", "Modelo comercial del equipo."],
    ["Serie", "Número de serie del fabricante."],
    ["Ubicacion", "Sede, oficina o lugar donde se encuentra el equipo."],
    ["Asignado a", "Persona o área responsable del equipo."],
    ["Fecha compra (YYYY-MM-DD)", "Fecha de compra, por ejemplo 2025-01-15."],
    ["Costo compra", "Costo de adquisición, numérico y mayor o igual que cero."],
    ["Valor residual", "Valor residual esperado, numérico y mayor o igual que cero."],
    ["Anios depreciacion", "Número entero de años mayor que cero. Puede dejarse vacío."],
    ["Garantia hasta (YYYY-MM-DD)", "Fecha de fin de garantía, por ejemplo 2028-01-15."],
    ["Notas", "Observaciones adicionales sobre el equipo."],
  ]);

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}

export function buildApplicationsTemplate(): Buffer {
  const workbook = XLSX.utils.book_new();
  const applicationsSheet = XLSX.utils.aoa_to_sheet([
    APPLICATION_HEADERS,
    [
      "suscripcion",
      "Microsoft 365 Business Standard",
      "Microsoft",
      "monthly",
      12.5,
      "Correo corporativo y herramientas de oficina",
      "card",
      "Visa corporativa",
      "Banco Pichincha",
      "automatic",
      "2026-12-31",
      "",
      "Suscripción para el equipo administrativo.",
    ],
    [
      "licencia",
      "Certificado SSL Wildcard",
      "DigiCert",
      "annual",
      349,
      "Protección de dominios corporativos",
      "transfer",
      "",
      "Banco Guayaquil",
      "manual",
      "2026-09-30",
      "SSL-WILDCARD-EC-2026",
      "La renovación debe gestionarse manualmente.",
    ],
  ]);

  applicationsSheet["!cols"] = APPLICATION_HEADERS.map((header) => ({
    wch: Math.max(18, header.length + 2),
  }));
  XLSX.utils.book_append_sheet(
    workbook,
    applicationsSheet,
    "Aplicaciones"
  );

  addInstructionsSheet(workbook, [
    ["General", "La primera fila contiene los encabezados. No la elimine. * = obligatorio."],
    ["Tipo* (suscripcion/licencia)", "Use suscripcion para aplicaciones o licencia para claves y certificados."],
    ["Nombre*", "Nombre de la aplicación, suscripción o licencia. Es obligatorio."],
    ["Proveedor*", "Empresa que suministra el servicio o licencia. Es obligatorio."],
    ["Ciclo (monthly/quarterly/semiannual/annual/one_time)", "Ciclo de cobro. Si se deja vacío se usará monthly."],
    ["Costo", "Costo correspondiente al ciclo indicado, mayor o igual que cero."],
    ["Motivo", "Objetivo o necesidad empresarial que cubre."],
    ["Metodo de pago (card/transfer/cash/other)", "Método utilizado para el pago."],
    ["Nombre tarjeta", "Nombre o alias de la tarjeta, cuando aplique."],
    ["Banco", "Banco asociado al pago, cuando aplique."],
    ["Renovacion (automatic/manual)", "Tipo de renovación. Si se deja vacío se usará manual."],
    ["Vence (YYYY-MM-DD)", "Fecha de vencimiento o próxima renovación."],
    ["Licencia key", "Clave de licencia, cuando aplique."],
    ["Notas", "Observaciones adicionales."],
  ]);

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}

export function parseAssetsExcel(buffer: Buffer): {
  rows: ParsedAssetRow[];
  errors: Array<{ row: number; message: string }>;
} {
  const parsedRows: ParsedAssetRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  try {
    const excelRows = workbookToRows(buffer);

    if (excelRows.length === 0) {
      return {
        rows: [],
        errors: [{ row: 1, message: "El archivo no contiene hojas o filas." }],
      };
    }

    const headerMap = buildHeaderMap(excelRows[0]);

    if (!headerMap.has(normalizeHeader("Nombre"))) {
      return {
        rows: [],
        errors: [{
          row: 1,
          message: 'No se encontró la columna obligatoria "Nombre*".',
        }],
      };
    }

    for (let index = 1; index < excelRows.length; index += 1) {
      const excelRow = excelRows[index];

      if (isEmptyRow(excelRow)) {
        continue;
      }

      const rowNumber = index + 1;
      const messages: string[] = [];
      const name = text(getColumn(excelRow, headerMap, "Nombre"));

      if (!name) {
        messages.push("Nombre es obligatorio.");
      }

      const purchaseDate = parseExcelDate(
        getColumn(excelRow, headerMap, "Fecha compra"),
        "Fecha compra",
        messages
      );
      const warrantyExpiry = parseExcelDate(
        getColumn(excelRow, headerMap, "Garantia hasta"),
        "Garantia hasta",
        messages
      );
      const purchaseCost = parseMoney(
        getColumn(excelRow, headerMap, "Costo compra"),
        "Costo compra",
        messages
      );
      const residualValue = parseMoney(
        getColumn(excelRow, headerMap, "Valor residual"),
        "Valor residual",
        messages
      );

      const yearsValue = getColumn(
        excelRow,
        headerMap,
        "Anios depreciacion"
      );
      let depreciationYears: number | null = null;

      if (text(yearsValue) !== "") {
        const parsedYears =
          typeof yearsValue === "number"
            ? yearsValue
            : Number(text(yearsValue));

        if (
          !Number.isFinite(parsedYears) ||
          !Number.isInteger(parsedYears) ||
          parsedYears <= 0
        ) {
          messages.push(
            "Anios depreciacion debe ser un entero mayor que cero o estar vacío."
          );
        } else {
          depreciationYears = parsedYears;
        }
      }

      if (messages.length > 0) {
        errors.push({
          row: rowNumber,
          message: messages.join(" "),
        });
        continue;
      }

      parsedRows.push(
        attachExcelRowNumber(
          {
            name,
            category: text(
              getColumn(excelRow, headerMap, "Categoria")
            ),
            manufacturer: text(
              getColumn(excelRow, headerMap, "Marca")
            ),
            model: text(getColumn(excelRow, headerMap, "Modelo")),
            serialNumber: text(
              getColumn(excelRow, headerMap, "Serie")
            ),
            location: text(
              getColumn(excelRow, headerMap, "Ubicacion")
            ),
            assignedTo: text(
              getColumn(excelRow, headerMap, "Asignado a")
            ),
            purchaseDate,
            purchaseCost,
            residualValue,
            depreciationYears,
            warrantyExpiry,
            notes: text(getColumn(excelRow, headerMap, "Notas")),
          },
          rowNumber
        )
      );
    }
  } catch (error) {
    errors.push({
      row: 1,
      message: `No se pudo leer el archivo Excel: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }

  return { rows: parsedRows, errors };
}

export function parseApplicationsExcel(buffer: Buffer): {
  rows: ParsedApplicationRow[];
  errors: Array<{ row: number; message: string }>;
} {
  const parsedRows: ParsedApplicationRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  try {
    const excelRows = workbookToRows(buffer);

    if (excelRows.length === 0) {
      return {
        rows: [],
        errors: [{ row: 1, message: "El archivo no contiene hojas o filas." }],
      };
    }

    const headerMap = buildHeaderMap(excelRows[0]);
    const missingHeaders: string[] = [];

    for (const requiredHeader of ["Tipo", "Nombre", "Proveedor"]) {
      if (!headerMap.has(normalizeHeader(requiredHeader))) {
        missingHeaders.push(requiredHeader);
      }
    }

    if (missingHeaders.length > 0) {
      return {
        rows: [],
        errors: [{
          row: 1,
          message: `Faltan columnas obligatorias: ${missingHeaders.join(", ")}.`,
        }],
      };
    }

    const validBillingCycles = new Set([
      "monthly",
      "quarterly",
      "semiannual",
      "annual",
      "one_time",
    ]);
    const validRenewalTypes = new Set(["automatic", "manual"]);

    for (let index = 1; index < excelRows.length; index += 1) {
      const excelRow = excelRows[index];

      if (isEmptyRow(excelRow)) {
        continue;
      }

      const rowNumber = index + 1;
      const messages: string[] = [];
      const rawKind = text(
        getColumn(excelRow, headerMap, "Tipo")
      ).toLowerCase();
      let kind: "subscription" | "license" | null = null;

      if (["suscripcion", "subscription", "app"].includes(rawKind)) {
        kind = "subscription";
      } else if (["licencia", "license", "key"].includes(rawKind)) {
        kind = "license";
      } else {
        messages.push(
          'Tipo debe ser "suscripcion" o "licencia".'
        );
      }

      const name = text(getColumn(excelRow, headerMap, "Nombre"));
      const vendor = text(
        getColumn(excelRow, headerMap, "Proveedor")
      );

      if (!name) {
        messages.push("Nombre es obligatorio.");
      }

      if (!vendor) {
        messages.push("Proveedor es obligatorio.");
      }

      const billingCycle =
        text(getColumn(excelRow, headerMap, "Ciclo")).toLowerCase() ||
        "monthly";

      if (!validBillingCycles.has(billingCycle)) {
        messages.push(
          "Ciclo debe ser monthly, quarterly, semiannual, annual o one_time."
        );
      }

      const renewalType =
        text(
          getColumn(excelRow, headerMap, "Renovacion")
        ).toLowerCase() || "manual";

      if (!validRenewalTypes.has(renewalType)) {
        messages.push(
          "Renovacion debe ser automatic o manual."
        );
      }

      const cost = parseMoney(
        getColumn(excelRow, headerMap, "Costo"),
        "Costo",
        messages
      );
      const expiryDate = parseExcelDate(
        getColumn(excelRow, headerMap, "Vence"),
        "Vence",
        messages
      );

      if (messages.length > 0 || kind === null) {
        errors.push({
          row: rowNumber,
          message: messages.join(" "),
        });
        continue;
      }

      parsedRows.push(
        attachExcelRowNumber(
          {
            kind,
            name,
            vendor,
            billingCycle,
            cost,
            purpose: text(
              getColumn(excelRow, headerMap, "Motivo")
            ),
            paymentMethod: text(
              getColumn(excelRow, headerMap, "Metodo de pago")
            ),
            cardName: text(
              getColumn(excelRow, headerMap, "Nombre tarjeta")
            ),
            bankName: text(
              getColumn(excelRow, headerMap, "Banco")
            ),
            renewalType,
            expiryDate,
            licenseKey: text(
              getColumn(excelRow, headerMap, "Licencia key")
            ),
            notes: text(getColumn(excelRow, headerMap, "Notas")),
          },
          rowNumber
        )
      );
    }
  } catch (error) {
    errors.push({
      row: 1,
      message: `No se pudo leer el archivo Excel: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }

  return { rows: parsedRows, errors };
}