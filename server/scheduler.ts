/**
 * SCHEDULER DE NOTIFICACIONES POR EMAIL
 *
 * Corre dentro del mismo proceso Express (PM2 fork, 1 instancia). Cada cierto
 * tiempo recorre las empresas activas y, por cada vencimiento que entra en su
 * ventana de aviso (por defecto 1 día antes), envía un correo — una sola vez
 * por vencimiento, gracias al log de dedupe (notification_email_log).
 *
 * Diseño defensivo (ver reglas críticas de CLAUDE.md): NUNCA lanza. Cualquier
 * error se registra y el proceso sigue vivo. El dedupe por clave (que incluye
 * la fecha objetivo) hace que sea seguro correr el chequeo varias veces al día
 * o tras un reinicio: no se reenvía lo ya enviado.
 */
import { storage, type DueExpiration, type NotificationSettings } from "./storage";
import { sendEmail, parseRecipients, mailConfigured } from "./email";

// Cada cuánto se repite el chequeo. El dedupe hace inocuo repetir; 12h da margen
// aunque el proceso se reinicie a horas distintas.
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
// Primer chequeo poco después del arranque (deja que la DB esté lista).
const STARTUP_DELAY_MS = 30 * 1000;

let timer: NodeJS.Timeout | null = null;

/** Arranca el scheduler (idempotente). */
export function startNotificationScheduler(): void {
  if (timer) return;
  setTimeout(() => {
    void runNotificationCheck();
  }, STARTUP_DELAY_MS);
  timer = setInterval(() => {
    void runNotificationCheck();
  }, CHECK_INTERVAL_MS);
  // No mantener vivo el event loop solo por este timer.
  timer.unref?.();
  console.log("[scheduler] Notificaciones por email activadas (cada 12h).");
}

/**
 * Recorre todas las empresas y envía los avisos pendientes.
 * Exportada para poder dispararla manualmente si hiciera falta.
 */
export async function runNotificationCheck(): Promise<void> {
  if (!mailConfigured()) {
    console.warn("[scheduler] API de correo no configurada; se omite el chequeo.");
    return;
  }
  try {
    const companies = await storage.getCompaniesForNotifications();
    for (const company of companies) {
      try {
        await processCompany(company);
      } catch (err) {
        console.error(`[scheduler] Error en empresa ${company.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] Error recorriendo empresas:", err);
  }
}

/** Procesa una empresa: calcula pendientes, envía un correo y los marca. */
async function processCompany(company: {
  id: string;
  name: string;
  email: string | null;
}): Promise<void> {
  const settings = await storage.getNotificationSettings(company.id);
  if (!settings.emailEnabled) return;

  // Destinatarios: los configurados, con la empresa como respaldo.
  const recipients = parseRecipients(
    settings.recipientEmails || company.email || ""
  );
  if (recipients.length === 0) return;

  const due = await storage.getDueExpirations(company.id, settings);
  if (due.length === 0) return;

  // Solo lo que aún no se ha notificado.
  const pendientes: DueExpiration[] = [];
  for (const item of due) {
    const yaEnviado = await storage.wasNotificationEmailSent(company.id, item.key);
    if (!yaEnviado) pendientes.push(item);
  }
  if (pendientes.length === 0) return;

  const asunto = buildSubject(company.name, pendientes);
  const html = buildEmailHtml(company.name, pendientes, settings);

  const result = await sendEmail(recipients, asunto, html);
  if (result.ok) {
    for (const item of pendientes) {
      await storage.logNotificationEmail(company.id, item.key, recipients.join(", "));
    }
    console.log(
      `[scheduler] ${company.name}: ${pendientes.length} aviso(s) enviados a ${recipients.join(", ")}.`
    );
  } else {
    // No se marca como enviado: se reintenta en el próximo ciclo.
    console.warn(`[scheduler] ${company.name}: fallo el envío — ${result.message}`);
  }
}

function buildSubject(companyName: string, items: DueExpiration[]): string {
  if (items.length === 1) {
    const it = items[0];
    const cuando = it.daysLeft <= 0 ? "vence hoy" : `vence en ${it.daysLeft} día(s)`;
    return `Recordatorio: ${it.entityName} ${cuando} — ${companyName}`;
  }
  return `Recordatorio: ${items.length} vencimientos próximos — ${companyName}`;
}

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-EC", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Cuerpo HTML del correo de aviso. */
function buildEmailHtml(
  companyName: string,
  items: DueExpiration[],
  settings: NotificationSettings
): string {
  const filas = items
    .map((it) => {
      const cuando =
        it.daysLeft <= 0
          ? "<strong style=\"color:#b91c1c\">Hoy</strong>"
          : `En ${it.daysLeft} día(s)`;
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #eee">${esc(it.kindLabel)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee"><strong>${esc(it.entityName)}</strong></td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee">${esc(fmtFecha(it.date))}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eee">${cuando}</td>
        </tr>`;
    })
    .join("");

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
    <div style="background:#0f172a;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:18px">TechAssets Pro — Recordatorio de vencimientos</h2>
      <p style="margin:6px 0 0;font-size:13px;opacity:.85">${esc(companyName)}</p>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
      <p style="margin:0 0 16px">
        Los siguientes elementos están próximos a vencer (aviso configurado a
        <strong>${settings.daysBefore} día(s)</strong> de antelación):
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="text-align:left;background:#f8fafc">
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb">Tipo</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb">Nombre</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb">Fecha</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb">Vence</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#6b7280">
        Este es un correo automático de TechAssets Pro. Puedes ajustar o desactivar
        estos avisos en Configuración → Notificaciones.
      </p>
    </div>
  </div>`;
}
