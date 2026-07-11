/**
 * ENVÍO DE CORREOS — API de Socket Studio / begroupmail (AWS SES)
 *
 * Portado de la app de escritorio Bflash (app/services/correo.py). Hace un
 * POST con Basic Auth y body JSON:
 *   { to: [...], from: "...", subject: "...", html: "...", attachments: [...] }
 * Una respuesta 2xx = enviado.
 *
 * Configuración por variables de entorno (ver .env.example). Se dejan los
 * valores de begroupmail como default para que funcione sin configurar nada,
 * pero en producción conviene fijarlos en el .env y poder rotarlos sin tocar
 * código. NUNCA lanzar: siempre devolvemos { ok, message }.
 */

// URL y remitente no son secretos: se dejan como default. El usuario y la
// contraseña de la API SÍ son secretos y vienen SOLO del .env del servidor
// (mismo patrón que la app Bflash, que nunca los versiona en git).
const MAIL_API_URL =
  process.env.MAIL_API_URL || "https://api.begroupmail.com/api/email/send";
const MAIL_API_USER = process.env.MAIL_API_USER || "";
const MAIL_API_PASSWORD = process.env.MAIL_API_PASSWORD || "";
const MAIL_FROM =
  process.env.MAIL_FROM || "TechAssets Pro <info@begroupmail.com>";

const TIMEOUT_MS = 60_000;

export interface SendEmailResult {
  ok: boolean;
  message: string;
}

/** True si hay URL, usuario y contraseña para la API de correo. */
export function mailConfigured(): boolean {
  return Boolean(MAIL_API_URL && MAIL_API_USER && MAIL_API_PASSWORD);
}

/**
 * Parsea una cadena de destinatarios separados por coma, punto y coma,
 * espacios o saltos de línea, quedándose solo con los que parecen correos.
 */
export function parseRecipients(texto: string | null | undefined): string[] {
  const candidatos = (texto || "").split(/[,;\s]+/);
  const correos: string[] = [];
  for (const raw of candidatos) {
    const cand = raw.trim();
    if (cand && cand.includes("@") && cand.split("@").pop()!.includes(".")) {
      correos.push(cand);
    }
  }
  return correos;
}

/**
 * Envía un correo HTML. Devuelve { ok, message } y nunca lanza.
 */
export async function sendEmail(
  destinatarios: string[],
  asunto: string,
  html: string
): Promise<SendEmailResult> {
  if (!mailConfigured()) {
    return { ok: false, message: "La API de correo no está configurada (MAIL_API_*)." };
  }
  if (!destinatarios || destinatarios.length === 0) {
    return { ok: false, message: "No hay destinatarios válidos." };
  }

  const payload = {
    to: destinatarios,
    from: MAIL_FROM,
    subject: asunto,
    html,
    attachments: [] as unknown[],
  };

  const auth = Buffer.from(`${MAIL_API_USER}:${MAIL_API_PASSWORD}`).toString("base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(MAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (resp.ok) {
      return { ok: true, message: `Correo enviado a ${destinatarios.join(", ")}.` };
    }
    const body = await resp.text().catch(() => "");
    console.warn(`API correo HTTP ${resp.status}: ${body.slice(0, 300)}`);
    return {
      ok: false,
      message: `El servidor de correo respondió con error (${resp.status}).`,
    };
  } catch (err: any) {
    const detalle = err?.name === "AbortError" ? "timeout" : String(err?.message || err);
    console.warn(`Error de red enviando correo: ${detalle}`);
    return {
      ok: false,
      message: "No se pudo conectar con el servidor de correo.",
    };
  } finally {
    clearTimeout(timer);
  }
}
