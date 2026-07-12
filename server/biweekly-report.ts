import { redesignStorage } from "./storage-redesign";
import { storage } from "./storage";
import {
  sendEmail,
  parseRecipients,
  mailConfigured,
  type EmailAttachment,
} from "./email";
import { ECUADOR_DEPRECIATION_NOTE } from "./depreciation";
import { buildBiweeklyReportPdf } from "./report-pdf";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 45 * 1000;

let schedulerTimer: NodeJS.Timeout | null = null;
let startupTimer: NodeJS.Timeout | null = null;

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );

  return date.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dateKey(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function buildEmptyRow(columns: number): string {
  return `
    <tr>
      <td colspan="${columns}" style="padding:14px 12px;border-bottom:1px solid #eee;color:#6b7280;text-align:center">
        No hay registros activos para esta sección.
      </td>
    </tr>`;
}

function appendPdfWarning(html: string): string {
  return `${html}
  <p style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:12px auto;color:#b45309;font-size:12px;text-align:center">
    No se pudo generar el PDF adjunto en esta ocasion
  </p>`;
}

export function isBiweeklyReportDay(date: Date): boolean {
  const day = date.getDate();

  if (day === 15 || day === 30) {
    return true;
  }

  if (date.getMonth() !== 1) {
    return false;
  }

  const lastDayOfFebruary = new Date(
    date.getFullYear(),
    2,
    0
  ).getDate();

  return day === lastDayOfFebruary;
}

export function buildBiweeklyReportHtml(
  companyName: string,
  data: Awaited<
    ReturnType<typeof redesignStorage.getBiweeklyReportData>
  >
): string {
  const applicationRows =
    data.applications.length > 0
      ? data.applications
          .map(
            (application) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee"><strong>${esc(application.name)}</strong></td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${formatMoney(application.monthlyCost)}</td>
        </tr>`
          )
          .join("")
      : buildEmptyRow(2);

  const physicalRows =
    data.physicalAssets.length > 0
      ? data.physicalAssets
          .map(
            (asset) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee"><strong>${esc(asset.name)}</strong></td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${formatMoney(Number(asset.monthlyDepreciation) + Number(asset.maintenanceMonthly))}</td>
        </tr>`
          )
          .join("")
      : buildEmptyRow(2);

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
    <div style="background:#0f172a;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:18px">Informe quincenal de gasto en tecnologia</h2>
      <p style="margin:6px 0 0;font-size:13px;opacity:.85">${esc(companyName)}</p>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
      <h3 style="margin:0 0 12px;font-size:16px;color:#0f172a">Aplicaciones y licencias</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
        <thead>
          <tr style="text-align:left;background:#f8fafc">
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb">Nombre</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;text-align:right">Valor mensual</th>
          </tr>
        </thead>
        <tbody>
          ${applicationRows}
          <tr style="background:#f8fafc">
            <td style="padding:10px 12px;border-top:2px solid #e5e7eb"><strong>Subtotal aplicaciones y licencias</strong></td>
            <td style="padding:10px 12px;border-top:2px solid #e5e7eb;text-align:right;white-space:nowrap"><strong>${formatMoney(data.totals.applicationsMonthly)}</strong></td>
          </tr>
        </tbody>
      </table>

      <h3 style="margin:0 0 12px;font-size:16px;color:#0f172a">Equipos fisicos</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
        <thead>
          <tr style="text-align:left;background:#f8fafc">
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb">Equipo</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;text-align:right">Valor mensual</th>
          </tr>
        </thead>
        <tbody>
          ${physicalRows}
          <tr style="background:#f8fafc">
            <td style="padding:10px 12px;border-top:2px solid #e5e7eb"><strong>Subtotal equipos fisicos</strong></td>
            <td style="padding:10px 12px;border-top:2px solid #e5e7eb;text-align:right;white-space:nowrap"><strong>${formatMoney(data.totals.physicalMonthly)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:18px 20px;text-align:center">
        <div style="font-size:13px;color:#1e3a8a;margin-bottom:6px">Gasto mensual total en tecnologia</div>
        <div style="font-size:24px;font-weight:700;color:#0f172a">${formatMoney(data.totals.grandTotal)}</div>
      </div>

      <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#475569">
        El detalle completo (motivos, codigos, depreciacion, mantenimientos y responsables) va en el PDF adjunto.
      </p>
      <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#6b7280">
        ${esc(ECUADOR_DEPRECIATION_NOTE)}
      </p>
      <p style="margin:10px 0 0;font-size:12px;color:#6b7280">
        Este es un correo automático de TechAssets Pro.
      </p>
    </div>
  </div>`;
}

function buildManualRenewalsHtml(
  companyName: string,
  renewals: Awaited<
    ReturnType<typeof redesignStorage.getManualRenewalsDue>
  >
): string {
  const rows = renewals
    .map(
      (renewal) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee"><strong>${esc(renewal.name)}</strong></td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee">${renewal.kind === "license" ? "Licencia" : "Aplicacion"}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee">${esc(formatDate(renewal.date))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">${esc(renewal.daysLeft)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee">${esc(renewal.purpose)}</td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
    <div style="background:#0f172a;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:18px">TechAssets Pro — Renovaciones manuales proximas</h2>
      <p style="margin:6px 0 0;font-size:13px;opacity:.85">${esc(companyName)}</p>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;margin-bottom:18px;color:#9a3412">
        <strong>Accion requerida:</strong> estas renovaciones NO son automáticas y deben gestionarse manualmente antes de su vencimiento, por ejemplo certificados SSL, dominios o licencias con clave.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="text-align:left;background:#f8fafc">
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb">Nombre</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb">Tipo</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb">Fecha</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;text-align:center">Dias restantes</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb">Motivo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#6b7280">
        Este es un correo automático de TechAssets Pro.
      </p>
    </div>
  </div>`;
}

async function getCompanyName(companyId: string): Promise<string> {
  const storageApi = storage as unknown as {
    getCompany?: (
      id: string
    ) => Promise<{ name?: string } | null | undefined>;
  };

  if (typeof storageApi.getCompany === "function") {
    const company = await storageApi.getCompany(companyId);
    if (company?.name) {
      return String(company.name);
    }
  }

  const companies =
    await redesignStorage.getCompaniesForBiweeklyReport();
  const company = companies.find(
    (item) => String(item.id) === companyId
  );

  return company?.name ? String(company.name) : "Empresa";
}

export async function runBiweeklyReportCheck(
  now = new Date()
): Promise<void> {
  try {
    if (!mailConfigured() || !isBiweeklyReportDay(now)) {
      return;
    }

    const companies =
      await redesignStorage.getCompaniesForBiweeklyReport();
    const key = `biweekly-report:${dateKey(now)}`;

    for (const company of companies) {
      const companyId = String(company.id ?? "");
      const companyName = String(company.name ?? "Empresa");

      try {
        if (await redesignStorage.wasReportSent(companyId, key)) {
          continue;
        }

        const recipients = parseRecipients(
          String(company.reportRecipientEmails ?? "")
        );

        if (recipients.length === 0) {
          continue;
        }

        const data =
          await redesignStorage.getBiweeklyReportData(companyId);
        let html = buildBiweeklyReportHtml(companyName, data);
        let attachments: EmailAttachment[] = [];

        try {
          const pdfBuffer = await buildBiweeklyReportPdf(
            companyName,
            data
          );
          attachments = [
            {
              filename: `informe-tecnologia-${dateKey(now)}.pdf`,
              contentBase64: pdfBuffer.toString("base64"),
              contentType: "application/pdf",
            },
          ];
        } catch (error) {
          console.error(
            `[biweekly] ${companyName}: no se pudo generar el PDF adjunto:`,
            error
          );
          html = appendPdfWarning(html);
        }

        const result = await sendEmail(
          recipients,
          `Informe quincenal de tecnologia — ${companyName}`,
          html,
          attachments
        );

        if (result.ok) {
          await redesignStorage.logReportSent(
            companyId,
            key,
            recipients
          );
          console.log(
            `[biweekly] ${companyName}: informe enviado a ${recipients.join(", ")}.`
          );
        } else {
          console.error(
            `[biweekly] ${companyName}: no se pudo enviar el informe — ${result.message}`
          );
        }
      } catch (error) {
        console.error(
          `[biweekly] Error procesando empresa ${companyId}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error(
      "[biweekly] Error global generando informes quincenales:",
      error
    );
  }
}

export async function sendBiweeklyReportNow(
  companyId: string,
  overrideEmails?: string
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!mailConfigured()) {
      return {
        ok: false,
        message:
          "La API de correo no está configurada (MAIL_API_*).",
      };
    }

    const settings =
      await redesignStorage.getReportSettings(companyId);
    const recipients = parseRecipients(
      overrideEmails !== undefined
        ? overrideEmails
        : settings.emails
    );

    if (recipients.length === 0) {
      return {
        ok: false,
        message: "No hay destinatarios válidos para el informe.",
      };
    }

    const [companyName, data] = await Promise.all([
      getCompanyName(companyId),
      redesignStorage.getBiweeklyReportData(companyId),
    ]);

    let html = buildBiweeklyReportHtml(companyName, data);
    let attachments: EmailAttachment[] = [];

    try {
      const pdfBuffer = await buildBiweeklyReportPdf(
        companyName,
        data
      );
      attachments = [
        {
          filename: `informe-tecnologia-${dateKey(new Date())}.pdf`,
          contentBase64: pdfBuffer.toString("base64"),
          contentType: "application/pdf",
        },
      ];
    } catch (error) {
      console.error(
        `[biweekly] No se pudo generar el PDF adjunto para ${companyId}:`,
        error
      );
      html = appendPdfWarning(html);
    }

    return await sendEmail(
      recipients,
      `Informe quincenal de tecnologia — ${companyName}`,
      html,
      attachments
    );
  } catch (error) {
    console.error(
      `[biweekly] Error enviando informe manual para ${companyId}:`,
      error
    );

    return {
      ok: false,
      message: `No se pudo generar el informe: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export async function runManualRenewalReminders(): Promise<void> {
  try {
    if (!mailConfigured()) {
      return;
    }

    const companies =
      await storage.getCompaniesForNotifications();

    for (const company of companies) {
      try {
        const settings =
          await storage.getNotificationSettings(company.id);

        if (!settings.emailEnabled) {
          continue;
        }

        const recipients = parseRecipients(
          settings.recipientEmails || company.email || ""
        );

        if (recipients.length === 0) {
          continue;
        }

        const renewals =
          await redesignStorage.getManualRenewalsDue(company.id, 3);
        const pending: typeof renewals = [];

        for (const renewal of renewals) {
          const alreadySent =
            await redesignStorage.wasReportSent(
              company.id,
              renewal.key
            );

          if (!alreadySent) {
            pending.push(renewal);
          }
        }

        if (pending.length === 0) {
          continue;
        }

        const result = await sendEmail(
          recipients,
          "Renovaciones manuales proximas",
          buildManualRenewalsHtml(company.name, pending)
        );

        if (result.ok) {
          for (const renewal of pending) {
            await redesignStorage.logReportSent(
              company.id,
              renewal.key,
              recipients
            );
          }

          console.log(
            `[biweekly] ${company.name}: ${pending.length} renovación(es) manual(es) notificadas.`
          );
        } else {
          console.error(
            `[biweekly] ${company.name}: no se pudieron enviar renovaciones manuales — ${result.message}`
          );
        }
      } catch (error) {
        console.error(
          `[biweekly] Error procesando renovaciones de ${company.id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error(
      "[biweekly] Error global revisando renovaciones manuales:",
      error
    );
  }
}

export function startBiweeklyScheduler(): void {
  if (schedulerTimer || startupTimer) {
    return;
  }

  startupTimer = setTimeout(() => {
    startupTimer = null;
    void runBiweeklyReportCheck();
    void runManualRenewalReminders();
  }, STARTUP_DELAY_MS);
  startupTimer.unref?.();

  schedulerTimer = setInterval(() => {
    void runBiweeklyReportCheck();
    void runManualRenewalReminders();
  }, CHECK_INTERVAL_MS);
  schedulerTimer.unref?.();

  console.log(
    "[biweekly] Informes quincenales y renovaciones manuales activados (cada 6h)."
  );
}