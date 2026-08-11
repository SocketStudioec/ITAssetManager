import PDFDocument from "pdfkit";
import { ECUADOR_DEPRECIATION_NOTE } from "./depreciation";
import {
  applicationMonthly,
  buildProviderSummary,
  groupByProvider,
  physicalAssetMonthly,
  type BiweeklyData,
  type ReportApplicationRow,
  type ReportPhysicalAssetRow,
} from "./report-summary";

export type { BiweeklyData };

const COLORS = {
  heading: "#0f172a",
  text: "#334155",
  line: "#e2e8f0",
  tableHeader: "#f1f5f9",
  providerBand: "#e2e8f0",
  alternateRow: "#f8fafc",
  footer: "#64748b",
  white: "#ffffff",
};

const PAGE_MARGIN = 50;
const CONTENT_BOTTOM_MARGIN = 90;
const CONTENT_WIDTH = 495;

interface Column {
  label: string;
  width: number;
  align?: "left" | "right";
  /** Las columnas numéricas no envuelven texto. */
  numeric?: boolean;
}

const SUMMARY_COLUMNS: Column[] = [
  { label: "Proveedor", width: 160 },
  { label: "Items", width: 40, align: "right", numeric: true },
  { label: "Servicios", width: 85, align: "right", numeric: true },
  { label: "Equipos", width: 85, align: "right", numeric: true },
  { label: "Total mensual", width: 75, align: "right", numeric: true },
  { label: "% total", width: 50, align: "right", numeric: true },
];

const APPLICATION_COLUMNS: Column[] = [
  { label: "Nombre", width: 160 },
  { label: "Motivo", width: 235 },
  { label: "Valor mensual", width: 100, align: "right", numeric: true },
];

const PHYSICAL_COLUMNS: Column[] = [
  { label: "Equipo", width: 150 },
  { label: "Codigo", width: 80 },
  { label: "Responsable", width: 110 },
  { label: "Dep. mensual", width: 77, align: "right", numeric: true },
  { label: "Mant. mensual", width: 78, align: "right", numeric: true },
];

function formatMoney(value: unknown): string {
  const number = Number(value);

  return `$${(Number.isFinite(number) ? number : 0).toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function formatPercent(value: unknown): string {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "";
  }

  return `${number.toFixed(1)}%`;
}

function normalizeText(value: unknown, fallback = "—"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export async function buildBiweeklyReportPdf(
  companyName: string,
  data: BiweeklyData
): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: {
        top: PAGE_MARGIN,
        right: PAGE_MARGIN,
        bottom: PAGE_MARGIN,
        left: PAGE_MARGIN,
      },
      info: {
        Title: "Informe quincenal de gasto en tecnologia",
        Author: "TechAssets Pro",
        Subject: companyName,
      },
    });

    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentBottom = (): number =>
      doc.page.height - CONTENT_BOTTOM_MARGIN;

    const drawFooter = (): void => {
      const previousX = doc.x;
      const previousY = doc.y;
      const footerWidth = doc.page.width - PAGE_MARGIN * 2;

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(COLORS.footer)
        .text(
          ECUADOR_DEPRECIATION_NOTE,
          PAGE_MARGIN,
          doc.page.height - 62,
          {
            width: footerWidth,
            height: 28,
            align: "left",
            lineGap: 1,
          }
        );

      doc.text(
        "Generado por TechAssets Pro — techassets.socket-studio.com",
        PAGE_MARGIN,
        doc.page.height - 27,
        {
          width: footerWidth,
          height: 10,
          align: "center",
          lineBreak: false,
        }
      );

      doc.x = previousX;
      doc.y = previousY;
    };

    doc.on("pageAdded", drawFooter);

    const ensureSpace = (requiredHeight: number): void => {
      if (doc.y + requiredHeight > contentBottom()) {
        doc.addPage();
      }
    };

    const totalWidth = (columns: Column[]): number =>
      columns.reduce((total, column) => total + column.width, 0);

    const drawSectionTitle = (title: string, subtitle?: string): void => {
      ensureSpace(subtitle ? 48 : 34);

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(COLORS.heading)
        .text(title, PAGE_MARGIN, doc.y, { width: CONTENT_WIDTH });

      if (subtitle) {
        doc
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor(COLORS.footer)
          .text(subtitle, PAGE_MARGIN, doc.y + 2, {
            width: CONTENT_WIDTH,
          });
      }

      doc.moveDown(0.55);
      doc.x = PAGE_MARGIN;
    };

    const drawTableHeader = (columns: Column[]): void => {
      const x = PAGE_MARGIN;
      const y = doc.y;
      const height = 26;
      const width = totalWidth(columns);

      doc.rect(x, y, width, height).fill(COLORS.tableHeader);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.heading);

      let currentX = x;

      for (const column of columns) {
        doc.text(column.label, currentX + 6, y + 8, {
          width: column.width - 12,
          height: 12,
          align: column.align ?? "left",
          lineBreak: false,
        });
        currentX += column.width;
      }

      doc
        .moveTo(x, y + height)
        .lineTo(x + width, y + height)
        .lineWidth(0.5)
        .strokeColor(COLORS.line)
        .stroke();

      doc.y = y + height;
      doc.x = PAGE_MARGIN;
    };

    /** Fila de datos con alto dinámico según el texto que envuelve. */
    const drawRow = (
      columns: Column[],
      values: string[],
      options: {
        striped?: boolean;
        repeatHeader?: () => void;
        fontSize?: number;
      } = {}
    ): void => {
      const fontSize = options.fontSize ?? 9;
      const width = totalWidth(columns);

      doc.font("Helvetica").fontSize(fontSize);

      let rowHeight = 26;

      columns.forEach((column, index) => {
        if (column.numeric) {
          return;
        }

        const height = doc.heightOfString(values[index] ?? "", {
          width: column.width - 12,
          lineGap: 1,
        });

        rowHeight = Math.max(rowHeight, height + 12);
      });

      if (doc.y + rowHeight > contentBottom()) {
        doc.addPage();
        options.repeatHeader?.();
      }

      const x = PAGE_MARGIN;
      const y = doc.y;

      if (options.striped) {
        doc.rect(x, y, width, rowHeight).fill(COLORS.alternateRow);
      }

      doc.font("Helvetica").fontSize(fontSize).fillColor(COLORS.text);

      let currentX = x;

      columns.forEach((column, index) => {
        doc.text(values[index] ?? "", currentX + 6, y + 6, {
          width: column.width - 12,
          height: rowHeight - 10,
          align: column.align ?? "left",
          lineGap: 1,
          lineBreak: !column.numeric,
        });
        currentX += column.width;
      });

      doc
        .moveTo(x, y + rowHeight)
        .lineTo(x + width, y + rowHeight)
        .lineWidth(0.5)
        .strokeColor(COLORS.line)
        .stroke();

      doc.y = y + rowHeight;
      doc.x = PAGE_MARGIN;
    };

    /** Banda que abre el bloque de un proveedor dentro del detalle. */
    const drawProviderBand = (
      columns: Column[],
      provider: string,
      monthlyTotal: number,
      itemsLabel: string,
      repeatHeader: () => void
    ): void => {
      const width = totalWidth(columns);
      const height = 24;

      if (doc.y + height + 26 > contentBottom()) {
        doc.addPage();
        repeatHeader();
      }

      const x = PAGE_MARGIN;
      const y = doc.y;

      doc.rect(x, y, width, height).fill(COLORS.providerBand);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.heading)
        .text(normalizeText(provider), x + 7, y + 7, {
          width: width - 200,
          height: 12,
          lineBreak: false,
        })
        .font("Helvetica")
        .fontSize(8)
        .fillColor(COLORS.text)
        .text(itemsLabel, x + width - 190, y + 8, {
          width: 85,
          height: 11,
          align: "right",
          lineBreak: false,
        })
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.heading)
        .text(`${formatMoney(monthlyTotal)} / mes`, x + width - 100, y + 7, {
          width: 93,
          height: 12,
          align: "right",
          lineBreak: false,
        });

      doc.y = y + height;
      doc.x = PAGE_MARGIN;
    };

    const drawSubtotal = (
      columns: Column[],
      label: string,
      value: unknown,
      repeatHeader: () => void
    ): void => {
      const width = totalWidth(columns);
      const height = 28;

      if (doc.y + height > contentBottom()) {
        doc.addPage();
        repeatHeader();
      }

      const x = PAGE_MARGIN;
      const y = doc.y;

      doc.rect(x, y, width, height).fill(COLORS.tableHeader);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(COLORS.heading)
        .text(label, x + 7, y + 8, {
          width: width - 120,
          height: 12,
          lineBreak: false,
        })
        .text(formatMoney(value), x + width - 105, y + 8, {
          width: 98,
          height: 12,
          align: "right",
          lineBreak: false,
        });

      doc.y = y + height;
      doc.x = PAGE_MARGIN;
    };

    const drawEmptyRow = (columns: Column[]): void => {
      const width = totalWidth(columns);
      const height = 30;

      ensureSpace(height);

      const y = doc.y;

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLORS.footer)
        .text(
          "No hay registros activos para esta seccion.",
          PAGE_MARGIN + 6,
          y + 9,
          {
            width: width - 12,
            height: 12,
            align: "center",
            lineBreak: false,
          }
        );

      doc
        .moveTo(PAGE_MARGIN, y + height)
        .lineTo(PAGE_MARGIN + width, y + height)
        .lineWidth(0.5)
        .strokeColor(COLORS.line)
        .stroke();

      doc.y = y + height;
      doc.x = PAGE_MARGIN;
    };

    try {
      const pageWidth = doc.page.width;
      const providers = buildProviderSummary(data);

      doc.rect(0, 0, pageWidth, 70).fill(COLORS.heading);
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(COLORS.white)
        .text("TechAssets Pro", PAGE_MARGIN, 18, {
          width: 250,
          height: 20,
          lineBreak: false,
        })
        .font("Helvetica")
        .fontSize(11)
        .text("Informe quincenal de gasto en tecnologia", PAGE_MARGIN, 42, {
          width: 300,
          height: 15,
          lineBreak: false,
        })
        .fontSize(9)
        .text(new Date().toLocaleDateString("es-EC"), pageWidth - 215, 26, {
          width: 165,
          height: 14,
          align: "right",
          lineBreak: false,
        });

      doc.y = 92;
      doc.x = PAGE_MARGIN;

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(COLORS.heading)
        .text(normalizeText(companyName, "Empresa"), PAGE_MARGIN, doc.y, {
          width: CONTENT_WIDTH,
        });

      doc.moveDown(0.55);
      doc
        .moveTo(PAGE_MARGIN, doc.y)
        .lineTo(pageWidth - PAGE_MARGIN, doc.y)
        .lineWidth(0.7)
        .strokeColor(COLORS.line)
        .stroke();
      doc.y += 18;

      drawFooter();

      // ----------------------------------------------------------------
      // 1. Resumen por proveedor (mismo que va en el cuerpo del correo)
      // ----------------------------------------------------------------
      const repeatSummaryHeader = (): void =>
        drawTableHeader(SUMMARY_COLUMNS);

      drawSectionTitle(
        "Resumen por proveedor",
        "Gasto mensual consolidado de cada proveedor que nos presta servicio."
      );
      repeatSummaryHeader();

      if (providers.length === 0) {
        drawEmptyRow(SUMMARY_COLUMNS);
      } else {
        providers.forEach((row, index) => {
          drawRow(
            SUMMARY_COLUMNS,
            [
              normalizeText(row.provider),
              String(row.items),
              row.servicesMonthly > 0
                ? formatMoney(row.servicesMonthly)
                : "—",
              row.physicalMonthly > 0
                ? formatMoney(row.physicalMonthly)
                : "—",
              formatMoney(row.totalMonthly),
              formatPercent(row.share) || "—",
            ],
            {
              striped: index % 2 === 1,
              repeatHeader: repeatSummaryHeader,
              fontSize: 8.5,
            }
          );
        });
      }

      drawSubtotal(
        SUMMARY_COLUMNS,
        "Gasto mensual total en tecnologia",
        data.totals.grandTotal,
        repeatSummaryHeader
      );

      // ----------------------------------------------------------------
      // 2. Detalle de aplicaciones y licencias, agrupado por proveedor
      // ----------------------------------------------------------------
      const repeatApplicationHeader = (): void =>
        drawTableHeader(APPLICATION_COLUMNS);

      doc.y += 26;
      drawSectionTitle(
        "Detalle: aplicaciones y licencias",
        "Cada servicio contratado con su proveedor y motivo."
      );
      repeatApplicationHeader();

      const applicationGroups = groupByProvider<ReportApplicationRow>(
        data.applications,
        applicationMonthly
      );

      if (applicationGroups.length === 0) {
        drawEmptyRow(APPLICATION_COLUMNS);
      } else {
        for (const group of applicationGroups) {
          drawProviderBand(
            APPLICATION_COLUMNS,
            group.provider,
            group.monthlyTotal,
            `${group.items.length} ${
              group.items.length === 1 ? "servicio" : "servicios"
            }`,
            repeatApplicationHeader
          );

          group.items.forEach((application, index) => {
            drawRow(
              APPLICATION_COLUMNS,
              [
                normalizeText(application.name),
                normalizeText(application.purpose),
                formatMoney(application.monthlyCost),
              ],
              {
                striped: index % 2 === 1,
                repeatHeader: repeatApplicationHeader,
              }
            );
          });
        }
      }

      drawSubtotal(
        APPLICATION_COLUMNS,
        "Subtotal aplicaciones y licencias",
        data.totals.applicationsMonthly,
        repeatApplicationHeader
      );

      // ----------------------------------------------------------------
      // 3. Detalle de equipos fisicos, agrupado por proveedor / marca
      // ----------------------------------------------------------------
      const repeatPhysicalHeader = (): void =>
        drawTableHeader(PHYSICAL_COLUMNS);

      doc.y += 26;
      drawSectionTitle(
        "Detalle: equipos fisicos",
        "Depreciacion mensual y mantenimientos prorrateados por proveedor o marca."
      );
      repeatPhysicalHeader();

      const physicalGroups = groupByProvider<ReportPhysicalAssetRow>(
        data.physicalAssets,
        physicalAssetMonthly
      );

      if (physicalGroups.length === 0) {
        drawEmptyRow(PHYSICAL_COLUMNS);
      } else {
        for (const group of physicalGroups) {
          drawProviderBand(
            PHYSICAL_COLUMNS,
            group.provider,
            group.monthlyTotal,
            `${group.items.length} ${
              group.items.length === 1 ? "equipo" : "equipos"
            }`,
            repeatPhysicalHeader
          );

          group.items.forEach((asset, index) => {
            drawRow(
              PHYSICAL_COLUMNS,
              [
                normalizeText(asset.name),
                normalizeText(asset.assetCode),
                normalizeText(asset.assignedTo),
                formatMoney(asset.monthlyDepreciation),
                formatMoney(asset.maintenanceMonthly),
              ],
              {
                striped: index % 2 === 1,
                repeatHeader: repeatPhysicalHeader,
                fontSize: 8.5,
              }
            );
          });
        }
      }

      drawSubtotal(
        PHYSICAL_COLUMNS,
        "Subtotal equipos fisicos",
        data.totals.physicalMonthly,
        repeatPhysicalHeader
      );

      // ----------------------------------------------------------------
      // 4. Total general
      // ----------------------------------------------------------------
      const totalBlockHeight = 72;
      doc.y += 26;
      ensureSpace(totalBlockHeight);

      const totalX = PAGE_MARGIN;
      const totalY = doc.y;
      const totalBlockWidth = doc.page.width - PAGE_MARGIN * 2;

      doc
        .roundedRect(totalX, totalY, totalBlockWidth, totalBlockHeight, 8)
        .fill(COLORS.heading);

      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(COLORS.white)
        .text(
          "Gasto mensual total en tecnologia",
          totalX + 18,
          totalY + 16,
          {
            width: totalBlockWidth - 36,
            height: 15,
            align: "center",
            lineBreak: false,
          }
        )
        .font("Helvetica-Bold")
        .fontSize(20)
        .text(
          formatMoney(data.totals.grandTotal),
          totalX + 18,
          totalY + 37,
          {
            width: totalBlockWidth - 36,
            height: 24,
            align: "center",
            lineBreak: false,
          }
        );

      doc.y = totalY + totalBlockHeight;
      doc.end();
    } catch (error) {
      reject(error);
      doc.end();
    }
  });
}
