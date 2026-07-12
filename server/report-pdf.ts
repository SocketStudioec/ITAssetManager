import PDFDocument from "pdfkit";
import { ECUADOR_DEPRECIATION_NOTE } from "./depreciation";

export interface BiweeklyData {
  applications: {
    name: string;
    purpose: string;
    monthlyCost: number;
  }[];
  physicalAssets: {
    name: string;
    assetCode: string;
    assignedTo: string;
    monthlyDepreciation: number;
    maintenanceMonthly: number;
  }[];
  totals: {
    applicationsMonthly: number;
    physicalMonthly: number;
    grandTotal: number;
  };
}

const COLORS = {
  heading: "#0f172a",
  text: "#334155",
  line: "#e2e8f0",
  tableHeader: "#f1f5f9",
  alternateRow: "#f8fafc",
  footer: "#64748b",
  white: "#ffffff",
};

const PAGE_MARGIN = 50;
const CONTENT_BOTTOM_MARGIN = 90;

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

    const drawSectionTitle = (title: string): void => {
      ensureSpace(34);

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(COLORS.heading)
        .text(title, PAGE_MARGIN, doc.y, {
          width: doc.page.width - PAGE_MARGIN * 2,
        });

      doc.moveDown(0.55);
    };

    const drawApplicationsHeader = (): void => {
      const x = PAGE_MARGIN;
      const y = doc.y;
      const height = 26;
      const widths = [150, 220, 90];

      doc
        .rect(x, y, widths.reduce((total, width) => total + width, 0), height)
        .fill(COLORS.tableHeader);

      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(COLORS.heading)
        .text("Nombre", x + 6, y + 8, {
          width: widths[0] - 12,
          height: 12,
          lineBreak: false,
        })
        .text("Motivo", x + widths[0] + 6, y + 8, {
          width: widths[1] - 12,
          height: 12,
          lineBreak: false,
        })
        .text(
          "Valor mensual",
          x + widths[0] + widths[1] + 6,
          y + 8,
          {
            width: widths[2] - 12,
            height: 12,
            align: "right",
            lineBreak: false,
          }
        );

      doc
        .moveTo(x, y + height)
        .lineTo(x + widths.reduce((total, width) => total + width, 0), y + height)
        .lineWidth(0.5)
        .strokeColor(COLORS.line)
        .stroke();

      doc.y = y + height;
      doc.x = PAGE_MARGIN;
    };

    const drawPhysicalAssetsHeader = (): void => {
      const x = PAGE_MARGIN;
      const y = doc.y;
      const height = 28;
      const widths = [150, 75, 110, 70, 70];

      doc
        .rect(x, y, widths.reduce((total, width) => total + width, 0), height)
        .fill(COLORS.tableHeader);

      let currentX = x;
      const headers = [
        { text: "Equipo", width: widths[0], align: "left" as const },
        { text: "Codigo", width: widths[1], align: "left" as const },
        { text: "Responsable", width: widths[2], align: "left" as const },
        { text: "Dep. mensual", width: widths[3], align: "right" as const },
        { text: "Mant. mensual", width: widths[4], align: "right" as const },
      ];

      doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.heading);

      for (const header of headers) {
        doc.text(header.text, currentX + 5, y + 8, {
          width: header.width - 10,
          height: 14,
          align: header.align,
          lineBreak: false,
        });
        currentX += header.width;
      }

      doc
        .moveTo(x, y + height)
        .lineTo(x + widths.reduce((total, width) => total + width, 0), y + height)
        .lineWidth(0.5)
        .strokeColor(COLORS.line)
        .stroke();

      doc.y = y + height;
      doc.x = PAGE_MARGIN;
    };

    const drawSubtotal = (
      label: string,
      value: unknown,
      width: number,
      repeatHeader: () => void
    ): void => {
      const height = 28;

      if (doc.y + height > contentBottom()) {
        doc.addPage();
        drawFooter();
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

    try {
      const pageWidth = doc.page.width;

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
          width: pageWidth - PAGE_MARGIN * 2,
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

      drawSectionTitle("Aplicaciones y licencias");
      drawApplicationsHeader();

      if (data.applications.length === 0) {
        const rowHeight = 30;

        if (doc.y + rowHeight > contentBottom()) {
          doc.addPage();
          drawApplicationsHeader();
        }

        const rowY = doc.y;
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(COLORS.footer)
          .text("No hay registros activos para esta sección.", PAGE_MARGIN + 6, rowY + 9, {
            width: 448,
            height: 12,
            align: "center",
            lineBreak: false,
          });

        doc
          .moveTo(PAGE_MARGIN, rowY + rowHeight)
          .lineTo(PAGE_MARGIN + 460, rowY + rowHeight)
          .lineWidth(0.5)
          .strokeColor(COLORS.line)
          .stroke();

        doc.y = rowY + rowHeight;
      } else {
        data.applications.forEach((application, index) => {
          const widths = [150, 220, 90];
          const name = normalizeText(application.name);
          const purpose = normalizeText(application.purpose);

          doc.font("Helvetica").fontSize(9);
          const nameHeight = doc.heightOfString(name, {
            width: widths[0] - 12,
            lineGap: 1,
          });
          const purposeHeight = doc.heightOfString(purpose, {
            width: widths[1] - 12,
            lineGap: 1,
          });
          const rowHeight = Math.max(26, nameHeight + 12, purposeHeight + 12);

          if (doc.y + rowHeight > contentBottom()) {
            doc.addPage();
            drawApplicationsHeader();
          }

          const x = PAGE_MARGIN;
          const y = doc.y;

          if (index % 2 === 1) {
            doc.rect(x, y, 460, rowHeight).fill(COLORS.alternateRow);
          }

          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(COLORS.text)
            .text(name, x + 6, y + 6, {
              width: widths[0] - 12,
              height: rowHeight - 12,
              lineGap: 1,
            })
            .text(purpose, x + widths[0] + 6, y + 6, {
              width: widths[1] - 12,
              height: rowHeight - 12,
              lineGap: 1,
            })
            .text(
              formatMoney(application.monthlyCost),
              x + widths[0] + widths[1] + 6,
              y + 7,
              {
                width: widths[2] - 12,
                height: rowHeight - 12,
                align: "right",
                lineBreak: false,
              }
            );

          doc
            .moveTo(x, y + rowHeight)
            .lineTo(x + 460, y + rowHeight)
            .lineWidth(0.5)
            .strokeColor(COLORS.line)
            .stroke();

          doc.y = y + rowHeight;
          doc.x = PAGE_MARGIN;
        });
      }

      drawSubtotal(
        "Subtotal aplicaciones y licencias",
        data.totals.applicationsMonthly,
        460,
        drawApplicationsHeader
      );

      doc.y += 24;
      drawSectionTitle("Equipos fisicos");
      drawPhysicalAssetsHeader();

      if (data.physicalAssets.length === 0) {
        const rowHeight = 30;

        if (doc.y + rowHeight > contentBottom()) {
          doc.addPage();
          drawPhysicalAssetsHeader();
        }

        const rowY = doc.y;
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(COLORS.footer)
          .text("No hay registros activos para esta sección.", PAGE_MARGIN + 6, rowY + 9, {
            width: 463,
            height: 12,
            align: "center",
            lineBreak: false,
          });

        doc
          .moveTo(PAGE_MARGIN, rowY + rowHeight)
          .lineTo(PAGE_MARGIN + 475, rowY + rowHeight)
          .lineWidth(0.5)
          .strokeColor(COLORS.line)
          .stroke();

        doc.y = rowY + rowHeight;
      } else {
        data.physicalAssets.forEach((asset, index) => {
          const widths = [150, 75, 110, 70, 70];
          const name = normalizeText(asset.name);
          const assetCode = normalizeText(asset.assetCode);
          const assignedTo = normalizeText(asset.assignedTo);

          doc.font("Helvetica").fontSize(9);
          const nameHeight = doc.heightOfString(name, {
            width: widths[0] - 10,
            lineGap: 1,
          });
          const assignedHeight = doc.heightOfString(assignedTo, {
            width: widths[2] - 10,
            lineGap: 1,
          });
          const rowHeight = Math.max(28, nameHeight + 12, assignedHeight + 12);

          if (doc.y + rowHeight > contentBottom()) {
            doc.addPage();
            drawPhysicalAssetsHeader();
          }

          const x = PAGE_MARGIN;
          const y = doc.y;

          if (index % 2 === 1) {
            doc.rect(x, y, 475, rowHeight).fill(COLORS.alternateRow);
          }

          let currentX = x;

          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(COLORS.text)
            .text(name, currentX + 5, y + 6, {
              width: widths[0] - 10,
              height: rowHeight - 12,
              lineGap: 1,
            });

          currentX += widths[0];

          doc.fontSize(8).text(assetCode, currentX + 5, y + 7, {
            width: widths[1] - 10,
            height: rowHeight - 12,
            lineGap: 1,
          });

          currentX += widths[1];

          doc.fontSize(8.5).text(assignedTo, currentX + 5, y + 6, {
            width: widths[2] - 10,
            height: rowHeight - 12,
            lineGap: 1,
          });

          currentX += widths[2];

          doc.fontSize(8).text(
            formatMoney(asset.monthlyDepreciation),
            currentX + 4,
            y + 7,
            {
              width: widths[3] - 8,
              height: rowHeight - 12,
              align: "right",
              lineBreak: false,
            }
          );

          currentX += widths[3];

          doc.text(
            formatMoney(asset.maintenanceMonthly),
            currentX + 4,
            y + 7,
            {
              width: widths[4] - 8,
              height: rowHeight - 12,
              align: "right",
              lineBreak: false,
            }
          );

          doc
            .moveTo(x, y + rowHeight)
            .lineTo(x + 475, y + rowHeight)
            .lineWidth(0.5)
            .strokeColor(COLORS.line)
            .stroke();

          doc.y = y + rowHeight;
          doc.x = PAGE_MARGIN;
        });
      }

      drawSubtotal(
        "Subtotal equipos fisicos",
        data.totals.physicalMonthly,
        475,
        drawPhysicalAssetsHeader
      );

      const totalBlockHeight = 72;
      doc.y += 26;
      ensureSpace(totalBlockHeight);

      const totalX = PAGE_MARGIN;
      const totalY = doc.y;
      const totalWidth = doc.page.width - PAGE_MARGIN * 2;

      doc
        .roundedRect(totalX, totalY, totalWidth, totalBlockHeight, 8)
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
            width: totalWidth - 36,
            height: 15,
            align: "center",
            lineBreak: false,
          }
        )
        .font("Helvetica-Bold")
        .fontSize(20)
        .text(formatMoney(data.totals.grandTotal), totalX + 18, totalY + 37, {
          width: totalWidth - 36,
          height: 24,
          align: "center",
          lineBreak: false,
        });

      doc.y = totalY + totalBlockHeight;
      doc.end();
    } catch (error) {
      reject(error);
      doc.end();
    }
  });
}