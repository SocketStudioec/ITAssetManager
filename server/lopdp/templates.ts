/**
 * PLANTILLAS DE DOCUMENTOS LEGALES LOPDP
 *
 * Generación DETERMINISTA por merge de variables. Deliberadamente sin IA
 * generativa para el articulado: los artículos citados van escritos aquí, de
 * modo que ningún documento pueda inventar normativa (alucinación normativa =
 * riesgo legal directo para el cliente).
 *
 * Todos los documentos llevan el DISCLAIMER obligatorio: son plantillas de
 * apoyo, no asesoría legal.
 */
import type { DpDocType } from "@shared/lopdp";
import { DP_CATEGORY_LABELS, DP_SUBJECT_LABELS } from "@shared/lopdp";

export const LEGAL_DISCLAIMER =
  "> **Aviso legal.** Este documento fue generado como plantilla de apoyo al cumplimiento de la " +
  "Ley Orgánica de Protección de Datos Personales del Ecuador a partir de la información registrada " +
  "por la empresa. **No constituye asesoría legal.** Debe ser revisado y adaptado por un profesional " +
  "del derecho antes de firmarlo, publicarlo o presentarlo ante terceros o ante la Superintendencia " +
  "de Protección de Datos Personales.";

export interface DocumentContext {
  company: {
    id: string;
    name: string;
    ruc: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  profile: {
    sector: string;
    legalRepName: string | null;
    dpoName: string | null;
    dpoEmail: string | null;
    arcoChannel: string | null;
    isProcessor: boolean;
    questionnaire: Record<string, any>;
  };
  classifications: Array<{
    entityName: string;
    entityKind: string;
    dataCategories: string[];
    dataSubjects: string[];
    subjectCountRange: string | null;
    storageLocation: string | null;
    isProcessorAsset: boolean;
    retentionPeriod: string | null;
  }>;
  scenarios: Array<{
    title: string;
    entityName: string;
    dimension: string;
    level: string;
    probability: number;
    impact: number;
    residualProbability: number;
    residualImpact: number;
    rationale: string;
    legalBasis: string | null;
    threatCommunity: string | null;
  }>;
  assessment: {
    riskScore: number;
    riskGrade: string;
    complianceScore: number;
    complianceGrade: string;
    estimatedFineMin: number;
    estimatedFineMax: number;
    worstInfraction: string | null;
    breakdown: any;
  } | null;
  actions: Array<{
    title: string;
    category: string;
    legalBasis: string | null;
    status: string;
    completedAt: Date | null;
  }>;
  /** Entidad relacionada (proveedor, titular, incidente) según el tipo de documento. */
  related?: Record<string, any>;
  generatedAt: Date;
}

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(d);

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

const catLabel = (c: string) => (DP_CATEGORY_LABELS as any)[c] ?? c;
const subLabel = (s: string) => (DP_SUBJECT_LABELS as any)[s] ?? s;

const STORAGE_LABEL: Record<string, string> = {
  local: "Servidores o archivos propios (Ecuador)",
  nube_ec: "Nube con alojamiento en Ecuador",
  nube_ext: "Nube con alojamiento en el exterior",
};

/** Encabezado común a todos los documentos. */
function header(title: string, ctx: DocumentContext): string {
  return [
    `# ${title}`,
    "",
    `**Responsable del tratamiento:** ${ctx.company.name}`,
    ctx.company.ruc ? `**RUC:** ${ctx.company.ruc}` : null,
    ctx.company.address ? `**Dirección:** ${ctx.company.address}` : null,
    ctx.profile.legalRepName ? `**Representante legal:** ${ctx.profile.legalRepName}` : null,
    ctx.profile.dpoName ? `**Delegado de Protección de Datos:** ${ctx.profile.dpoName}` : null,
    `**Fecha de emisión:** ${fmtDate(ctx.generatedAt)}`,
    "",
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Finalidades declaradas en el cuestionario, con su base legal. */
function purposesTable(ctx: DocumentContext): string {
  const purposes: Array<{ name: string; basis: string }> = ctx.profile.questionnaire?.purposes ?? [];
  if (purposes.length === 0) {
    return "_No se han declarado finalidades de tratamiento en el perfil de la empresa._\n";
  }
  const rows = purposes
    .map((p) => `| ${p.name} | ${p.basis || "Por definir"} |`)
    .join("\n");
  return `| Finalidad del tratamiento | Base legal (art. 7 LOPDP) |\n|---|---|\n${rows}\n`;
}

function categoriesSummary(ctx: DocumentContext): string {
  const cats = new Set<string>();
  const subs = new Set<string>();
  for (const c of ctx.classifications) {
    c.dataCategories.forEach((x) => cats.add(x));
    c.dataSubjects.forEach((x) => subs.add(x));
  }
  return [
    `**Categorías de datos tratadas:** ${Array.from(cats).map(catLabel).join(", ") || "no declaradas"}`,
    "",
    `**Categorías de titulares:** ${Array.from(subs).map(subLabel).join(", ") || "no declaradas"}`,
    "",
  ].join("\n");
}

// ============================================================================
// PLANTILLAS
// ============================================================================

function privacyPolicy(ctx: DocumentContext): string {
  const arco = ctx.profile.arcoChannel || ctx.company.email || "[definir canal de contacto]";
  return `${header("Política de Protección de Datos Personales", ctx)}
${LEGAL_DISCLAIMER}

## 1. Objeto y ámbito

${ctx.company.name} (en adelante, "el Responsable") adopta la presente Política en cumplimiento de la
Ley Orgánica de Protección de Datos Personales (LOPDP), su Reglamento General y la normativa emitida
por la Superintendencia de Protección de Datos Personales (SPDP). Esta Política aplica a todo
tratamiento de datos personales realizado por el Responsable, su personal y sus encargados.

## 2. Principios (art. 10 LOPDP)

El Responsable trata los datos personales conforme a los principios de juridicidad, lealtad,
transparencia, finalidad, pertinencia y minimización, proporcionalidad del tratamiento,
confidencialidad, calidad y exactitud, conservación, seguridad de datos personales,
responsabilidad proactiva y demostrada, independencia del control e interoperabilidad.

## 3. Datos que tratamos

${categoriesSummary(ctx)}

## 4. Finalidades y base legal (art. 7 LOPDP)

${purposesTable(ctx)}

El tratamiento solo se realiza cuando concurre al menos una de las bases previstas en el artículo 7
de la LOPDP: consentimiento del titular, ejecución de un contrato, cumplimiento de una obligación
legal, protección de intereses vitales, interés público o interés legítimo del responsable.

## 5. Consentimiento (art. 8 LOPDP)

Cuando la base legal sea el consentimiento, este será libre, específico, informado e inequívoco.
El titular puede revocarlo en cualquier momento, con la misma facilidad con que lo otorgó, sin que
ello afecte la licitud del tratamiento previo a la revocatoria.

## 6. Datos sensibles (art. 25 LOPDP)

${
  ctx.classifications.some((c) =>
    c.dataCategories.some((x) => ["salud", "biometricos", "menores", "otros_sensibles"].includes(x)),
  )
    ? "El Responsable trata categorías especiales de datos personales. Estos datos cuentan con medidas " +
      "de seguridad reforzadas, acceso restringido al personal estrictamente necesario y consentimiento " +
      "explícito del titular cuando esa es la base legal aplicable."
    : "El Responsable no trata, de manera habitual, categorías especiales de datos personales. De hacerlo, " +
      "aplicará las garantías reforzadas del artículo 25 de la LOPDP."
}

## 7. Conservación

Los datos se conservan únicamente durante el tiempo necesario para cumplir la finalidad que motivó su
recolección y durante los plazos de retención legal aplicables (tributarios, laborales, societarios o
profesionales). Cumplidos esos plazos, se procede a su eliminación segura o anonimización.

## 8. Destinatarios y encargados (art. 28 LOPDP)

${
  ctx.classifications.filter((c) => c.isProcessorAsset).length > 0
    ? `El Responsable comparte datos con los siguientes encargados del tratamiento, con quienes mantiene o
gestiona el contrato exigido por el artículo 28 de la LOPDP:\n\n${ctx.classifications
        .filter((c) => c.isProcessorAsset)
        .map((c) => `- ${c.entityName}`)
        .join("\n")}`
    : "El Responsable no comparte datos personales con encargados del tratamiento externos. De incorporarlos, suscribirá previamente el contrato de encargo exigido por el artículo 28 de la LOPDP."
}

## 9. Transferencias internacionales

${
  ctx.classifications.some((c) => c.storageLocation === "nube_ext")
    ? "Parte de la información se aloja en servicios en la nube ubicados fuera del Ecuador. El Responsable " +
      "verifica que dichas transferencias cumplan los artículos 55 a 61 de la LOPDP (nivel adecuado de " +
      "protección o garantías contractuales suficientes)."
    : "El Responsable no realiza transferencias internacionales de datos personales."
}

## 10. Derechos de los titulares (arts. 12 a 22 LOPDP)

El titular tiene derecho a información, acceso, rectificación y actualización, eliminación, oposición,
portabilidad, suspensión del tratamiento, a no ser objeto de decisiones automatizadas y a consultar el
Registro Nacional de Protección de Datos Personales.

**Canal de ejercicio de derechos:** ${arco}

Conforme al artículo 62 de la LOPDP, el Responsable contestará el requerimiento en el término de
**diez (10) días**. Si el titular no recibe respuesta o esta es negativa, puede presentar reclamo
administrativo ante la Superintendencia de Protección de Datos Personales.

## 11. Seguridad (arts. 37 a 39 LOPDP)

El Responsable aplica medidas técnicas, organizativas y jurídicas apropiadas al riesgo, evaluadas
mediante una gestión de riesgos conforme a la Guía de Gestión de Riesgos e Impacto de la SPDP.

## 12. Vulneraciones de seguridad (arts. 43 a 46 LOPDP)

Ante una vulneración de la seguridad de datos personales, el Responsable notificará a la SPDP dentro
de las **72 horas** siguientes a su conocimiento y comunicará a los titulares afectados sin dilación
indebida cuando exista riesgo para sus derechos y libertades.

## 13. Vigencia

Esta Política rige desde su publicación y será revisada al menos una vez al año o cuando cambien las
actividades de tratamiento.
`;
}

function termsAndConditions(ctx: DocumentContext): string {
  return `${header("Términos y Condiciones de Uso", ctx)}
${LEGAL_DISCLAIMER}

## 1. Aceptación

El acceso y uso de los servicios prestados por ${ctx.company.name} implica la aceptación plena de estos
Términos y Condiciones y de la Política de Protección de Datos Personales del Responsable.

## 2. Descripción del servicio

${ctx.profile.questionnaire?.serviceDescription || "[Describir los servicios que presta la empresa]"}

## 3. Obligaciones del usuario

El usuario se obliga a proporcionar información veraz, exacta y actualizada; a utilizar los servicios
conforme a la ley y a estos términos; y a mantener la confidencialidad de sus credenciales de acceso
cuando el servicio las contemple.

## 4. Tratamiento de datos personales

Los datos personales facilitados serán tratados conforme a la Política de Protección de Datos
Personales de ${ctx.company.name}, elaborada de acuerdo con la Ley Orgánica de Protección de Datos
Personales del Ecuador. El usuario puede ejercer sus derechos de acceso, rectificación, eliminación,
oposición, portabilidad y limitación del tratamiento en:
**${ctx.profile.arcoChannel || ctx.company.email || "[canal de contacto]"}**.

## 5. Propiedad intelectual

Los contenidos, marcas y materiales puestos a disposición del usuario son propiedad de
${ctx.company.name} o de sus licenciantes, y no se transfieren por el uso del servicio.

## 6. Responsabilidad

${ctx.company.name} responde por la prestación del servicio en los términos pactados. No responde por
fallas atribuibles a caso fortuito, fuerza mayor o a terceros ajenos a su control, sin perjuicio de
sus obligaciones legales en materia de protección de datos personales.

## 7. Modificaciones

${ctx.company.name} podrá modificar estos Términos, notificando a los usuarios con antelación
razonable a través de los canales habituales de comunicación.

## 8. Ley aplicable y jurisdicción

Estos Términos se rigen por la legislación de la República del Ecuador. Las controversias se someterán
a los jueces competentes del domicilio del Responsable, sin perjuicio de los derechos que la ley
reconoce a los consumidores y a los titulares de datos personales.
`;
}

function dpaContract(ctx: DocumentContext): string {
  const provider = ctx.related?.providerName || "[NOMBRE DEL PROVEEDOR]";
  return `${header("Contrato de Encargo del Tratamiento de Datos Personales", ctx)}
${LEGAL_DISCLAIMER}

**Responsable del tratamiento:** ${ctx.company.name}${ctx.company.ruc ? ` (RUC ${ctx.company.ruc})` : ""}
**Encargado del tratamiento:** ${provider}

Las partes suscriben el presente contrato de encargo en cumplimiento del **artículo 28 de la Ley
Orgánica de Protección de Datos Personales**, que exige que todo tratamiento por cuenta del
responsable se rija por un contrato que vincule al encargado.

## Primera — Objeto

El Encargado tratará datos personales por cuenta del Responsable, únicamente para prestar los
servicios contratados y conforme a las instrucciones documentadas de este último.

## Segunda — Alcance del tratamiento

- **Finalidad:** ${ctx.related?.purpose || "prestación de los servicios contratados"}
- **Categorías de datos:** ${
    Array.from(new Set(ctx.classifications.flatMap((c) => c.dataCategories))).map(catLabel).join(", ") || "las necesarias para el servicio"
  }
- **Categorías de titulares:** ${
    Array.from(new Set(ctx.classifications.flatMap((c) => c.dataSubjects))).map(subLabel).join(", ") || "las necesarias para el servicio"
  }
- **Duración:** mientras se mantenga vigente la relación contractual principal.

## Tercera — Obligaciones del Encargado

1. Tratar los datos únicamente siguiendo instrucciones documentadas del Responsable, incluso en materia
   de transferencias internacionales.
2. Garantizar que las personas autorizadas para tratar los datos se comprometan a la confidencialidad,
   deber que subsiste tras finalizar la relación.
3. Aplicar las medidas técnicas y organizativas apropiadas conforme a los artículos 37 a 39 de la LOPDP,
   incluyendo, según el riesgo: cifrado, control de accesos, respaldos, registros de auditoría y
   capacidad de restaurar la disponibilidad de los datos.
4. **No subcontratar** total ni parcialmente el tratamiento sin autorización previa y por escrito del
   Responsable. El subencargado quedará sujeto a las mismas obligaciones.
5. Asistir al Responsable en la atención de los derechos de los titulares (arts. 12 a 22 LOPDP) dentro
   de plazos que permitan cumplir el término de diez (10) días del artículo 62.
6. **Notificar al Responsable, sin dilación indebida y en un máximo de veinticuatro (24) horas**, toda
   vulneración de la seguridad de los datos, para permitirle cumplir el plazo de 72 horas del art. 43.
7. Poner a disposición del Responsable la información necesaria para demostrar el cumplimiento y
   permitir auditorías o inspecciones.
8. A elección del Responsable, **devolver o eliminar** de forma segura todos los datos personales al
   finalizar la prestación, salvo obligación legal de conservarlos, certificando dicha eliminación.
9. **Prohibición expresa de reidentificación** de datos anonimizados y de uso de los datos para
   finalidades propias o distintas de las instruidas.

## Cuarta — Obligaciones del Responsable

Entregar instrucciones lícitas y documentadas, informar al Encargado de las finalidades y bases
legales aplicables y supervisar el cumplimiento del presente contrato.

## Quinta — Responsabilidad

El incumplimiento de este contrato por parte del Encargado lo constituye en responsable del
tratamiento respecto de los tratamientos realizados fuera de las instrucciones recibidas, conforme al
artículo 28 de la LOPDP, sin perjuicio de las sanciones administrativas y la responsabilidad civil que
correspondan.

## Sexta — Vigencia

Este contrato entra en vigor a la firma y permanece vigente mientras el Encargado trate datos por
cuenta del Responsable.

<br><br>

| Por el Responsable | Por el Encargado |
|---|---|
| ${ctx.profile.legalRepName || "_____________________"} | _____________________ |
| ${ctx.company.name} | ${provider} |
| C.C./RUC: ${ctx.company.ruc || "____________"} | C.C./RUC: ____________ |
`;
}

function dpaAsProcessor(ctx: DocumentContext): string {
  return `${header("Anexo de Protección de Datos — Actuación como Encargado", ctx)}
${LEGAL_DISCLAIMER}

${ctx.company.name} presta servicios que implican el tratamiento de datos personales **por cuenta de
sus clientes**. En esos tratamientos, el cliente actúa como **responsable** y ${ctx.company.name} como
**encargado del tratamiento**, en los términos del artículo 28 de la LOPDP.

## 1. Instrucciones documentadas

${ctx.company.name} tratará los datos personales del cliente exclusivamente para prestar los servicios
contratados (${ctx.related?.purpose || "servicios profesionales contratados"}) y conforme a las
instrucciones que el cliente imparta por escrito.

## 2. Confidencialidad

El personal de ${ctx.company.name} está sujeto a deber de confidencialidad sobre la información del
cliente, obligación que subsiste indefinidamente tras la terminación de la relación contractual y del
vínculo laboral.

## 3. Medidas de seguridad

${ctx.company.name} aplica las medidas técnicas y organizativas apropiadas al riesgo conforme a los
artículos 37 a 39 de la LOPDP, evaluadas mediante gestión de riesgos documentada.

## 4. Subencargados

${ctx.company.name} no subcontratará el tratamiento sin autorización previa y por escrito del cliente.

## 5. Asistencia al responsable

${ctx.company.name} asistirá al cliente en la atención de solicitudes de titulares y en las
evaluaciones de impacto que este deba realizar, y le notificará cualquier vulneración de seguridad
dentro de las 24 horas siguientes a su conocimiento.

## 6. Devolución o eliminación

Al término de la relación, ${ctx.company.name} devolverá o eliminará de forma segura los datos
personales del cliente, salvo los que deba conservar por obligación legal (por ejemplo, respaldos
tributarios o expedientes profesionales), informando de dicha circunstancia.
`;
}

function consentForm(ctx: DocumentContext, health: boolean): string {
  const title = health
    ? "Consentimiento Informado y Autorización de Tratamiento de Datos de Salud"
    : "Formulario de Consentimiento para el Tratamiento de Datos Personales";
  return `${header(title, ctx)}
${LEGAL_DISCLAIMER}

**Titular de los datos**

- Nombres y apellidos: _______________________________________
- Documento de identidad: ____________________________________
- Contacto (correo / teléfono): ______________________________
${health ? "- Representante legal (si el titular es menor de edad): ______________________\n" : ""}
## 1. Responsable del tratamiento

${ctx.company.name}${ctx.company.ruc ? `, RUC ${ctx.company.ruc}` : ""}${
    ctx.company.address ? `, con domicilio en ${ctx.company.address}` : ""
  }. Contacto para protección de datos: ${ctx.profile.arcoChannel || ctx.company.email || "[canal de contacto]"}.

## 2. Finalidad del tratamiento

${
  health
    ? "Prestación de servicios de salud, elaboración y conservación de la historia clínica, seguimiento " +
      "del tratamiento, facturación y cumplimiento de obligaciones legales sanitarias y tributarias."
    : ctx.profile.questionnaire?.consentPurpose ||
      "Prestación de los servicios contratados, facturación, comunicación con el titular y cumplimiento de obligaciones legales."
}

## 3. Datos que se recolectan

${
  health
    ? "Datos identificativos y de contacto, y **datos de salud** (antecedentes, diagnósticos, tratamientos, " +
      "resultados de exámenes), que constituyen **categoría especial de datos** conforme al artículo 25 de la LOPDP."
    : `Datos identificativos y de contacto${
        ctx.classifications.some((c) => c.dataCategories.includes("financieros"))
          ? ", y datos financieros o tributarios necesarios para la facturación"
          : ""
      }.`
}

## 4. Carácter del consentimiento

De acuerdo con el artículo 8 de la LOPDP, este consentimiento es **libre, específico, informado e
inequívoco**${health ? " y **explícito**, por tratarse de datos sensibles" : ""}. El titular puede
**revocarlo en cualquier momento** con la misma facilidad con que lo otorgó, sin que ello afecte la
licitud del tratamiento anterior a la revocatoria ni la conservación exigida por ley.

## 5. Conservación

Los datos se conservarán mientras dure la relación${
    health ? " asistencial y durante los plazos legales de conservación de la historia clínica" : " contractual y durante los plazos de retención legal aplicables"
  }.

## 6. Derechos del titular

Acceso, rectificación, actualización, eliminación, oposición, portabilidad, limitación del tratamiento
y a no ser objeto de decisiones automatizadas (arts. 12 a 22 LOPDP). Ejercicio en:
**${ctx.profile.arcoChannel || ctx.company.email || "[canal de contacto]"}**. Respuesta en el término de
diez (10) días (art. 62 LOPDP).

## 7. Declaración

Declaro que he sido informado/a en lenguaje claro sobre el tratamiento descrito y **otorgo mi
consentimiento** para el mismo.

<br>

| Firma del titular | Fecha |
|---|---|
| _____________________ | ____ / ____ / ________ |
`;
}

function ratDocument(ctx: DocumentContext): string {
  const purposes: Array<{ name: string; basis: string }> = ctx.profile.questionnaire?.purposes ?? [];
  const withData = ctx.classifications.filter((c) => c.dataCategories.length > 0);

  const rows =
    purposes.length > 0
      ? purposes
          .map((p, idx) => {
            const cats = Array.from(new Set(withData.flatMap((c) => c.dataCategories))).map(catLabel).join(", ");
            const subs = Array.from(new Set(withData.flatMap((c) => c.dataSubjects))).map(subLabel).join(", ");
            const assets = withData.map((c) => c.entityName).join("; ") || "no declarados";
            return `### Actividad ${idx + 1} — ${p.name}

| Campo | Contenido |
|---|---|
| Finalidad | ${p.name} |
| Base legal (art. 7) | ${p.basis || "por definir"} |
| Categorías de datos | ${cats || "no declaradas"} |
| Categorías de titulares | ${subs || "no declaradas"} |
| Activos / sistemas donde residen | ${assets} |
| Encargados con acceso | ${withData.filter((c) => c.isProcessorAsset).map((c) => c.entityName).join("; ") || "ninguno declarado"} |
| Ubicación del almacenamiento | ${Array.from(new Set(withData.map((c) => STORAGE_LABEL[c.storageLocation ?? ""] ?? "no declarada"))).join("; ")} |
| Plazo de conservación | ${withData.map((c) => c.retentionPeriod).find(Boolean) || "según plazos legales aplicables"} |
| Transferencias internacionales | ${withData.some((c) => c.storageLocation === "nube_ext") ? "Sí — verificar arts. 55-61 LOPDP" : "No"} |
| Medidas de seguridad | Ver Declaración de Aplicabilidad de controles |
`;
          })
          .join("\n")
      : "_No se han declarado finalidades de tratamiento. Complete el cuestionario del módulo para generar el registro completo._\n";

  return `${header("Registro de Actividades de Tratamiento (RAT)", ctx)}
${LEGAL_DISCLAIMER}

Registro elaborado conforme al **artículo 37 de la Ley Orgánica de Protección de Datos Personales**.
Debe mantenerse actualizado y revisarse al menos cada seis (6) meses.

**Delegado de Protección de Datos:** ${ctx.profile.dpoName || "no designado"}${
    ctx.profile.dpoEmail ? ` (${ctx.profile.dpoEmail})` : ""
  }

## Inventario de activos que soportan el tratamiento

| Activo / sistema | Tipo | Categorías de datos | Titulares | Volumen | Ubicación | ¿Encargado? |
|---|---|---|---|---|---|---|
${
  withData
    .map(
      (c) =>
        `| ${c.entityName} | ${c.entityKind} | ${c.dataCategories.map(catLabel).join(", ")} | ${c.dataSubjects
          .map(subLabel)
          .join(", ")} | ${c.subjectCountRange || "n/d"} | ${STORAGE_LABEL[c.storageLocation ?? ""] ?? "n/d"} | ${
          c.isProcessorAsset ? "Sí" : "No"
        } |`,
    )
    .join("\n") || "| _Sin activos clasificados_ | | | | | | |"
}

## Actividades de tratamiento

${rows}
`;
}

function arcoProcedure(ctx: DocumentContext): string {
  const channel = ctx.profile.arcoChannel || ctx.company.email || "[canal de contacto]";
  return `${header("Procedimiento de Atención de Derechos ARCO-PL", ctx)}
${LEGAL_DISCLAIMER}

## 1. Objeto

Establecer el procedimiento interno de ${ctx.company.name} para atender los requerimientos de los
titulares de datos personales, conforme a los artículos 12 a 22 y 62 de la LOPDP.

## 2. Canal de recepción

**${channel}**

El canal es gratuito y está disponible por medios físicos y digitales. Toda solicitud recibida por
cualquier vía (correo, formulario, ventanilla, teléfono) debe registrarse el mismo día.

## 3. Plazo legal

Conforme al **artículo 62 de la LOPDP**, el Responsable cuenta con el término de **diez (10) días**
para contestar afirmativa o negativamente, notificar y ejecutar lo que corresponda. El término se
cuenta en días hábiles.

**Consecuencia del incumplimiento:** si no se contesta o se niega el requerimiento, el titular puede
presentar reclamo administrativo ante la SPDP (art. 64) y ejercer acciones civiles, penales o
constitucionales. No tramitar o negar injustificadamente es **infracción leve** (art. 67.1).

## 4. Derechos atendidos

| Derecho | Base legal | Qué debe hacer el Responsable |
|---|---|---|
| Información | Art. 12 | Informar finalidades, destinatarios y plazos |
| Acceso | Art. 13 | Entregar copia de los datos tratados y su origen |
| Rectificación y actualización | Art. 14 | Corregir datos inexactos o incompletos |
| Eliminación | Art. 15 | Suprimir los datos cuando proceda y comunicarlo a los encargados |
| Oposición | Art. 16 | Cesar el tratamiento salvo motivos legítimos imperiosos |
| Portabilidad | Art. 17 | Entregar los datos en formato estructurado de uso común |
| Suspensión / limitación | Art. 18 | Limitar el tratamiento mientras se resuelve |
| No decisiones automatizadas | Art. 20 | Garantizar intervención humana |

## 5. Etapas del procedimiento

1. **Registro** (día 0): identificar al solicitante, tipo de derecho y fecha de recepción. Se inicia el
   cómputo de los diez días término.
2. **Verificación de identidad**: solicitar documento de identidad para evitar entregar datos a terceros.
3. **Localización de los datos**: identificar en qué sistemas y activos residen los datos del titular y
   qué encargados los tratan.
4. **Análisis y decisión**: determinar si el derecho procede total o parcialmente. Toda negativa debe ser
   **motivada** y notificada.
5. **Ejecución**: aplicar el cambio (rectificar, eliminar, limitar) en todos los sistemas y comunicarlo a
   los encargados.
6. **Notificación al titular** dentro del plazo, dejando constancia del medio y la fecha.
7. **Archivo de evidencia**: conservar la solicitud, la respuesta y la constancia de ejecución como prueba
   de cumplimiento ante la autoridad.

## 6. Responsable del procedimiento

${ctx.profile.dpoName || ctx.profile.legalRepName || "[designar responsable interno]"}${
    ctx.profile.dpoEmail ? ` — ${ctx.profile.dpoEmail}` : ""
  }
`;
}

function breachProtocol(ctx: DocumentContext): string {
  return `${header("Protocolo de Respuesta a Vulneraciones de la Seguridad de Datos Personales", ctx)}
${LEGAL_DISCLAIMER}

## 1. Marco legal

Artículos 43 a 46 de la LOPDP. El Responsable debe notificar a la Superintendencia de Protección de
Datos Personales **dentro de las 72 horas** siguientes al conocimiento de la vulneración, y comunicarla
a los titulares afectados **sin dilación indebida** cuando exista riesgo para sus derechos.

## 2. Qué se considera vulneración

Toda violación de la seguridad que ocasione la destrucción, pérdida, alteración, comunicación o acceso
no autorizado a datos personales. Se clasifica en tres dimensiones:

- **Confidencialidad:** acceso o divulgación no autorizada (suele ser irreversible).
- **Integridad:** alteración no autorizada de los datos.
- **Disponibilidad:** pérdida de acceso, temporal o definitiva.

## 3. Etapas

### Etapa 1 — Contención (primeras horas)
Aislar los sistemas afectados, revocar credenciales comprometidas, preservar evidencias y registros.
**No borrar logs.** Designar responsable del incidente.

### Etapa 2 — Evaluación (primeras 24 horas)
Determinar: qué datos se vieron afectados, cuántos titulares, qué dimensión se vulneró, si hay datos
sensibles o grupos vulnerables involucrados, y qué consecuencias probables enfrentan los titulares.

### Etapa 3 — Notificación a la SPDP (dentro de 72 horas)
Contenido mínimo: naturaleza de la vulneración, categorías y número aproximado de titulares y registros
afectados, datos de contacto del Delegado o responsable, consecuencias probables y medidas adoptadas o
propuestas para mitigar los efectos.

### Etapa 4 — Comunicación a los titulares
En lenguaje claro y sencillo, cuando exista riesgo para sus derechos y libertades: qué ocurrió, qué
datos se vieron afectados, qué medidas tomó el Responsable y qué recomendaciones debe seguir el titular.

### Etapa 5 — Informe final y mejora
Documentar causa raíz, cronología, medidas correctivas implementadas y actualización de la gestión de
riesgos. Este informe es la evidencia de responsabilidad proactiva ante la autoridad.

## 4. Contactos

| Rol | Nombre | Contacto |
|---|---|---|
| Delegado / responsable de datos | ${ctx.profile.dpoName || "[designar]"} | ${ctx.profile.dpoEmail || "[correo]"} |
| Representante legal | ${ctx.profile.legalRepName || "[designar]"} | ${ctx.company.email || "[correo]"} |
| Soporte técnico | [designar] | [contacto] |
`;
}

function eipdpDocument(ctx: DocumentContext): string {
  const high = ctx.scenarios.filter((s) => s.level === "muy_alto" || s.level === "alto");
  return `${header("Evaluación de Impacto del Tratamiento de Datos Personales (EIPDP)", ctx)}
${LEGAL_DISCLAIMER}

Evaluación realizada conforme a los **artículos 40 a 42 de la LOPDP** y a la **Guía de Gestión de
Riesgos e Impacto de la SPDP** (Res. SPDP-SPD-2025-0003-R), que exige tratar la evaluación como una
gestión de riesgos y no como una lista de chequeo.

## 1. Criterios de evaluación (etapa de contexto)

Los criterios de impacto sobre derechos y libertades consideran: (a) tratamiento de categorías
especiales de datos (art. 25), (b) vulnerabilidad de grupos especiales de titulares (art. 40.2),
(c) cantidad de titulares afectados, (d) naturaleza de la vulneración (confidencialidad, integridad o
disponibilidad) y (e) volumen de datos por titular. La probabilidad se estima siempre en un lapso
determinado: **un (1) año**.

## 2. Descripción de los tratamientos

${purposesTable(ctx)}
${categoriesSummary(ctx)}

## 3. Activos de los que dependen los datos

| Activo / sistema | Categorías | Titulares | Volumen | Ubicación |
|---|---|---|---|---|
${
  ctx.classifications
    .filter((c) => c.dataCategories.length > 0)
    .map(
      (c) =>
        `| ${c.entityName} | ${c.dataCategories.map(catLabel).join(", ")} | ${c.dataSubjects
          .map(subLabel)
          .join(", ")} | ${c.subjectCountRange || "n/d"} | ${STORAGE_LABEL[c.storageLocation ?? ""] ?? "n/d"} |`,
    )
    .join("\n") || "| _Sin activos clasificados_ | | | | |"
}

## 4. Necesidad y proporcionalidad

El Responsable declara tratar únicamente los datos pertinentes y limitados a lo necesario para las
finalidades declaradas, conforme al principio de pertinencia y minimización (art. 10.e LOPDP).

## 5. Escenarios de riesgo evaluados

${
  ctx.scenarios.length === 0
    ? "_No hay escenarios evaluados. Ejecute el motor de riesgos del módulo._"
    : ctx.scenarios
        .map(
          (s) => `### ${s.title} — ${s.entityName}

- **Dimensión afectada:** ${s.dimension === "C" ? "Confidencialidad" : s.dimension === "I" ? "Integridad" : "Disponibilidad"}
- **Comunidad de amenaza:** ${s.threatCommunity || "n/d"}
- **Probabilidad:** ${s.residualProbability}/5 · **Impacto:** ${s.residualImpact}/5 · **Nivel:** ${s.level.replace("_", " ")}
- **Base legal relacionada:** ${s.legalBasis || "n/d"}
- **Justificación (rationale):** ${s.rationale}
`,
        )
        .join("\n")
}

## 6. Resultado de la evaluación

${
  ctx.assessment
    ? `- **Calificación de riesgo:** ${ctx.assessment.riskScore} / 100 (nivel ${ctx.assessment.riskGrade}) — menor es mejor
- **Calificación de cumplimiento LOPDP:** ${ctx.assessment.complianceScore} / 100 (nivel ${ctx.assessment.complianceGrade})
- **Escenarios de riesgo alto o muy alto:** ${high.length}`
    : "_Sin evaluación registrada._"
}

## 7. Medidas de tratamiento del riesgo

${
  ctx.actions.length === 0
    ? "_Sin acciones registradas._"
    : ctx.actions
        .map(
          (a) =>
            `- **${a.title}** (${a.category}) — ${a.legalBasis || ""} — estado: ${
              a.status === "done" ? `implementada${a.completedAt ? ` el ${fmtDate(new Date(a.completedAt))}` : ""}` : "pendiente"
            }`,
        )
        .join("\n")
}

## 8. Conclusión

${
  high.length > 0
    ? `El tratamiento presenta **${high.length} escenario(s) de riesgo alto o muy alto** que requieren medidas ` +
      "de mitigación prioritarias. El Responsable se compromete a implementar las medidas listadas y a " +
      "reevaluar el riesgo residual tras su implementación."
    : "Los escenarios evaluados se encuentran en niveles aceptables tras la aplicación de los controles " +
      "implementados. El Responsable mantendrá el monitoreo periódico conforme a la Guía SPDP."
}
`;
}

function soaDocument(ctx: DocumentContext): string {
  return `${header("Declaración de Aplicabilidad de Controles", ctx)}
${LEGAL_DISCLAIMER}

Declaración elaborada conforme a la **Guía SPDP §5.2** (taxonomías de controles) y a la estructura de
la norma ISO/IEC 27701, vinculando cada control con el artículo de la LOPDP que satisface.

| Control | ¿Aplica? | Descripción | Estado | Base legal |
|---|---|---|---|---|
${
  ctx.actions
    .map(
      (a) =>
        `| ${a.title} | Sí | ${a.category} | ${
          a.status === "done" ? "Implementado" : a.status === "not_applicable" ? "No aplica" : "Pendiente"
        } | ${a.legalBasis || "n/d"} |`,
    )
    .join("\n") || "| _Sin controles registrados_ | | | | |"
}

**Nota metodológica:** los controles no constituyen un catálogo genérico. Cada uno responde a
vulnerabilidades concretas identificadas en la etapa de identificación de riesgos de esta empresa.
`;
}

function diagnosticoDocument(ctx: DocumentContext): string {
  const a = ctx.assessment;
  return `${header("Informe de Diagnóstico de Protección de Datos Personales", ctx)}
${LEGAL_DISCLAIMER}

## 1. Alcance

Diagnóstico del estado de cumplimiento de ${ctx.company.name} frente a la Ley Orgánica de Protección de
Datos Personales, elaborado sobre el inventario de activos registrado y el cuestionario de la empresa,
aplicando la metodología de la Guía de Gestión de Riesgos e Impacto de la SPDP.

## 2. Resultado

${
  a
    ? `| Indicador | Resultado |
|---|---|
| Calificación de riesgo (menor es mejor) | **${a.riskScore} / 100 — nivel ${a.riskGrade}** |
| Calificación de cumplimiento LOPDP | **${a.complianceScore} / 100 — nivel ${a.complianceGrade}** |
| Infracción más grave detectada | ${a.worstInfraction ? a.worstInfraction.replace("_", " ") : "ninguna"} |
| Exposición económica estimada | ${fmtMoney(a.estimatedFineMin)} – ${fmtMoney(a.estimatedFineMax)} |

_La exposición económica es una estimación referencial calculada sobre el rango de facturación
declarado y los porcentajes de los artículos 80 a 83 de la LOPDP (0,1 % a 1 % de la facturación anual).
No constituye una liquidación de sanción._`
    : "_Sin evaluación registrada._"
}

## 3. Inventario clasificado

Se analizaron **${ctx.classifications.length}** activos, de los cuales
**${ctx.classifications.filter((c) => c.dataCategories.length > 0).length}** tratan datos personales.

## 4. Estado de las obligaciones legales

${
  a?.breakdown?.compliance
    ? `| Obligación | Base legal | Puntos | Estado |
|---|---|---|---|
${a.breakdown.compliance
  .map(
    (i: any) =>
      `| ${i.label} | ${i.legalBasis} | ${i.earned} / ${i.weight} | ${
        i.satisfied ? "Cumple" : i.partial ? "Parcial" : "No cumple"
      } |`,
  )
  .join("\n")}`
    : "_Sin desglose disponible._"
}

## 5. Principales riesgos identificados

${
  ctx.scenarios
    .slice(0, 10)
    .map(
      (s, i) =>
        `${i + 1}. **${s.title}** (${s.entityName}) — nivel ${s.level.replace("_", " ")}, probabilidad ${
          s.residualProbability
        }/5, impacto ${s.residualImpact}/5. ${s.legalBasis || ""}`,
    )
    .join("\n") || "_Sin escenarios registrados._"
}

## 6. Recomendaciones prioritarias

${
  ctx.actions
    .filter((x) => x.status !== "done")
    .slice(0, 10)
    .map((x, i) => `${i + 1}. ${x.title} — ${x.legalBasis || ""}`)
    .join("\n") || "_Sin acciones pendientes._"
}
`;
}

function riesgosDocument(ctx: DocumentContext): string {
  const byLevel = (lvl: string) => ctx.scenarios.filter((s) => s.level === lvl).length;
  return `${header("Informe de Gestión de Riesgos de Protección de Datos Personales", ctx)}
${LEGAL_DISCLAIMER}

Informe elaborado siguiendo las cinco etapas de la **Guía de Gestión de Riesgos e Impacto de la SPDP**:
establecimiento del contexto, identificación, análisis, evaluación y tratamiento de riesgos.

## 1. Establecimiento del contexto

Criterios de impacto sobre derechos y libertades: categorías especiales de datos (art. 25),
grupos vulnerables (art. 40.2), cantidad de titulares, naturaleza de la vulneración (C/I/D) y volumen
de datos. Escala de 1 a 5 en ambas dimensiones. Probabilidad estimada en un lapso de un (1) año.

## 2. Identificación

Se identificaron **${ctx.classifications.filter((c) => c.dataCategories.length > 0).length}** activos con
datos personales y **${ctx.scenarios.length}** escenarios de riesgo, clasificados por dimensión de
seguridad afectada.

## 3. Análisis y evaluación

| Nivel | Escenarios |
|---|---|
| Muy alto | ${byLevel("muy_alto")} |
| Alto | ${byLevel("alto")} |
| Medio | ${byLevel("medio")} |
| Bajo | ${byLevel("bajo")} |

### Detalle de escenarios

| Escenario | Activo | Dim. | P | I | Nivel | Justificación |
|---|---|---|---|---|---|---|
${
  ctx.scenarios
    .map(
      (s) =>
        `| ${s.title} | ${s.entityName} | ${s.dimension} | ${s.residualProbability} | ${s.residualImpact} | ${s.level.replace(
          "_",
          " ",
        )} | ${s.rationale.replace(/\|/g, "/")} |`,
    )
    .join("\n") || "| _Sin escenarios_ | | | | | | |"
}

**Nota metodológica:** conforme a la Guía SPDP, la matriz probabilidad × impacto se utiliza como
instrumento de representación y no de calibración. Ambas dimensiones se mantienen visibles junto con
su justificación, porque multiplicarlas puede ofuscar el impacto real cuando lo que se protege son
derechos y no activos.

## 4. Tratamiento de riesgos

${
  ctx.actions
    .map(
      (a) =>
        `- **${a.title}** (${a.category}) — ${a.legalBasis || ""} — ${
          a.status === "done" ? "implementado" : a.status === "not_applicable" ? "no aplica" : "pendiente"
        }`,
    )
    .join("\n") || "_Sin controles registrados._"
}

Estrategias disponibles conforme a la Guía: aceptar, modificar (mitigar), transferir o evitar el riesgo.

## 5. Riesgo residual

${
  ctx.assessment
    ? `Calificación de riesgo residual: **${ctx.assessment.riskScore} / 100 (nivel ${ctx.assessment.riskGrade})**.
El Responsable reconoce que siempre existirá un riesgo residual y se compromete a reducirlo al máximo
posible mediante monitoreo periódico y revisión de la efectividad de los controles.`
    : "_Sin evaluación registrada._"
}
`;
}

function titularResponse(ctx: DocumentContext): string {
  const r = ctx.related || {};
  const granted = r.resolution !== "negada";
  return `${header("Respuesta a Requerimiento de Titular de Datos Personales", ctx)}
${LEGAL_DISCLAIMER}

**Titular:** ${r.titularName || "[nombre]"}
**Tipo de requerimiento:** ${r.requestTypeLabel || r.requestType || "[tipo]"}
**Fecha de recepción:** ${r.receivedAt ? fmtDate(new Date(r.receivedAt)) : "[fecha]"}
**Fecha límite legal (10 días término, art. 62 LOPDP):** ${r.dueDate ? fmtDate(new Date(r.dueDate)) : "[fecha]"}

---

Estimado/a ${r.titularName || "titular"}:

En atención a su requerimiento presentado el ${r.receivedAt ? fmtDate(new Date(r.receivedAt)) : "[fecha]"},
y dentro del término de diez (10) días previsto en el artículo 62 de la Ley Orgánica de Protección de
Datos Personales, ${ctx.company.name} le informa lo siguiente:

## Resolución

**${granted ? (r.resolution === "parcial" ? "Su solicitud ha sido atendida parcialmente." : "Su solicitud ha sido atendida favorablemente.") : "Su solicitud ha sido denegada."}**

## Motivación

${
  r.resolutionRationale ||
  (granted
    ? "Se ha verificado su identidad y se ha ejecutado lo solicitado en todos los sistemas donde constan sus datos personales."
    : "[La negativa debe motivarse expresamente. Negar injustificadamente un requerimiento constituye infracción leve conforme al artículo 67.1 de la LOPDP.]")
}

${
  granted
    ? `## Acciones ejecutadas

${
  (r.affectedAssets || []).length > 0
    ? (r.affectedAssets as string[]).map((a) => `- ${a}`).join("\n")
    : "- Se aplicó lo resuelto en los sistemas que contienen sus datos personales."
}
`
    : ""
}

## Recursos

Si no está de acuerdo con esta respuesta, puede presentar un reclamo administrativo ante la
**Superintendencia de Protección de Datos Personales**, conforme al artículo 64 de la LOPDP, sin
perjuicio de las acciones civiles, penales o constitucionales que considere pertinentes.

Atentamente,

**${ctx.profile.dpoName || ctx.profile.legalRepName || "[Responsable]"}**
${ctx.company.name}
${ctx.profile.arcoChannel || ctx.company.email || ""}
`;
}

function spdpNotification(ctx: DocumentContext): string {
  const i = ctx.related || {};
  return `${header("Notificación de Vulneración de Seguridad de Datos Personales a la SPDP", ctx)}
${LEGAL_DISCLAIMER}

**Señor/a Superintendente de Protección de Datos Personales**
Presente.-

De conformidad con el **artículo 43 de la Ley Orgánica de Protección de Datos Personales**,
${ctx.company.name}${ctx.company.ruc ? `, con RUC ${ctx.company.ruc},` : ""} notifica la siguiente
vulneración de la seguridad de datos personales, dentro del plazo de setenta y dos (72) horas
contadas desde su conocimiento.

## 1. Naturaleza de la vulneración

**${i.title || "[título del incidente]"}**

${i.description || "[Descripción de los hechos]"}

- **Fecha y hora de detección:** ${i.detectedAt ? new Date(i.detectedAt).toLocaleString("es-EC") : "[fecha]"}
- **Dimensiones afectadas:** ${
    (i.dimensions || [])
      .map((d: string) => (d === "C" ? "Confidencialidad" : d === "I" ? "Integridad" : "Disponibilidad"))
      .join(", ") || "[dimensiones]"
  }

## 2. Categorías y número aproximado de afectados

- **Categorías de datos comprometidas:** ${(i.dataCategories || []).map(catLabel).join(", ") || "[categorías]"}
- **Número aproximado de titulares afectados:** ${i.subjectCountEstimate ?? "[cantidad]"}

## 3. Datos de contacto

**${ctx.profile.dpoName || ctx.profile.legalRepName || "[responsable]"}**${
    ctx.profile.dpoEmail ? ` — ${ctx.profile.dpoEmail}` : ""
  }${ctx.company.phone ? ` — ${ctx.company.phone}` : ""}

## 4. Consecuencias probables

${i.consequences || "Se evalúan los posibles efectos sobre los derechos y libertades de los titulares afectados, incluyendo el riesgo de uso indebido de la información comprometida."}

## 5. Medidas adoptadas o propuestas

${i.measuresTaken || "[Detallar medidas de contención, mitigación y prevención adoptadas]"}

Atentamente,

**${ctx.profile.legalRepName || "[Representante legal]"}**
${ctx.company.name}
`;
}

function descargosDocument(ctx: DocumentContext): string {
  const p = ctx.related || {};
  const doneActions = ctx.actions.filter((a) => a.status === "done");
  return `${header("Escrito de Descargos ante la Superintendencia de Protección de Datos Personales", ctx)}
${LEGAL_DISCLAIMER}
>
> **Importante:** este es un BORRADOR construido con la evidencia registrada en el sistema. Debe ser
> revisado, completado y firmado por un abogado antes de su presentación.

**Expediente:** ${p.fileNumber || "[número de expediente]"}
**Fecha de notificación:** ${p.notifiedAt ? fmtDate(new Date(p.notifiedAt)) : "[fecha]"}

**Señor/a Superintendente:**

${ctx.profile.legalRepName || "[Representante legal]"}, en calidad de representante legal de
${ctx.company.name}${ctx.company.ruc ? `, RUC ${ctx.company.ruc}` : ""}, dentro del procedimiento de
referencia, comparezco y expongo:

## I. Antecedentes

${p.description || "[Descripción del requerimiento o imputación notificada por la autoridad]"}

## II. Fundamentos de hecho — Responsabilidad proactiva demostrada

Mi representada ha implementado un sistema de gestión de protección de datos personales conforme a la
metodología de la Guía de Gestión de Riesgos e Impacto de la SPDP, cuya evidencia documental se detalla:

### 1. Gestión de riesgos documentada

${
  ctx.assessment
    ? `Se realizó una gestión de riesgos con identificación de **${ctx.scenarios.length} escenarios**,
análisis de probabilidad e impacto con justificación (rationale) de cada valor de entrada, y evaluación
de riesgo residual. Calificación vigente de cumplimiento: **${ctx.assessment.complianceScore}/100
(nivel ${ctx.assessment.complianceGrade})**.`
    : "[Adjuntar informe de gestión de riesgos]"
}

### 2. Documentación de cumplimiento

${
  Object.keys(ctx.related?.documents || {}).length > 0
    ? Object.entries(ctx.related!.documents as Record<string, string>)
        .map(([type, status]) => `- ${type}: ${status}`)
        .join("\n")
    : "[Listar documentos: política, RAT, contratos de encargo, consentimientos]"
}

### 3. Medidas implementadas

${
  doneActions.length > 0
    ? doneActions
        .map(
          (a) =>
            `- **${a.title}** — ${a.legalBasis || ""}${
              a.completedAt ? ` (implementada el ${fmtDate(new Date(a.completedAt))})` : ""
            }`,
        )
        .join("\n")
    : "[Detallar medidas técnicas y organizativas implementadas]"
}

### 4. Atención de derechos de titulares

${
  ctx.related?.requestStats
    ? `Se registran **${ctx.related.requestStats.total}** requerimientos de titulares, de los cuales
**${ctx.related.requestStats.onTime}** fueron atendidos dentro del término legal de diez (10) días
del artículo 62 de la LOPDP.`
    : "[Adjuntar registro de solicitudes de titulares y tiempos de respuesta]"
}

## III. Fundamentos de derecho

1. El artículo 10 de la LOPDP consagra el principio de **responsabilidad proactiva y demostrada**. Mi
   representada acredita el cumplimiento con evidencia documental fechada y trazable.
2. Conforme al **artículo 66.2 de la LOPDP**, tratándose de presuntas infracciones graves, la autoridad
   aplica **en primera instancia medidas correctivas**, y la sanción procede únicamente si estas se
   cumplen de forma tardía, parcial o defectuosa. Mi representada manifiesta su total disposición a
   cumplir íntegra y oportunamente las medidas correctivas que se dispongan.
3. La gestión de riesgos implementada satisface la exigencia del **artículo 68.4** de utilizar
   metodologías de análisis y gestión de riesgos adaptadas a la naturaleza de los datos tratados.

## IV. Petición

Solicito se tenga por presentado este escrito de descargos con la documentación adjunta, se valore la
responsabilidad proactiva demostrada y, de disponerse medidas correctivas, se conceda un plazo
razonable para su implementación.

Atentamente,

**${ctx.profile.legalRepName || "[Representante legal]"}**
${ctx.company.name}
`;
}

function trazabilidadDocument(ctx: DocumentContext): string {
  const withData = ctx.classifications.filter((c) => c.dataCategories.length > 0);
  return `${header("Informe de Trazabilidad del Tratamiento de Datos Personales", ctx)}
${LEGAL_DISCLAIMER}

Informe que documenta el flujo completo de los datos personales tratados por ${ctx.company.name}:
desde su finalidad hasta su eliminación, incluyendo dónde residen y quién accede a ellos.

## 1. Mapa de flujo de datos

| Finalidad | Categorías de datos | Activos donde residen | Ubicación | Encargados con acceso | Conservación |
|---|---|---|---|---|---|
${
  (ctx.profile.questionnaire?.purposes || []).length > 0
    ? (ctx.profile.questionnaire.purposes as Array<{ name: string }>)
        .map(
          (p) =>
            `| ${p.name} | ${Array.from(new Set(withData.flatMap((c) => c.dataCategories))).map(catLabel).join(", ")} | ${withData
              .map((c) => c.entityName)
              .join("; ")} | ${Array.from(new Set(withData.map((c) => STORAGE_LABEL[c.storageLocation ?? ""] ?? "n/d"))).join(
              "; ",
            )} | ${withData.filter((c) => c.isProcessorAsset).map((c) => c.entityName).join("; ") || "ninguno"} | ${
              withData.map((c) => c.retentionPeriod).find(Boolean) || "plazos legales aplicables"
            } |`,
        )
        .join("\n")
    : "| _Sin finalidades declaradas_ | | | | | |"
}

## 2. Detalle por activo

${
  withData
    .map(
      (c) => `### ${c.entityName}

- **Tipo de activo:** ${c.entityKind}
- **Categorías de datos:** ${c.dataCategories.map(catLabel).join(", ")}
- **Titulares:** ${c.dataSubjects.map(subLabel).join(", ")}
- **Volumen aproximado:** ${c.subjectCountRange || "no declarado"}
- **Ubicación del almacenamiento:** ${STORAGE_LABEL[c.storageLocation ?? ""] ?? "no declarada"}
- **¿Interviene un encargado?** ${c.isProcessorAsset ? "Sí — requiere contrato art. 28 LOPDP" : "No"}
- **Plazo de conservación:** ${c.retentionPeriod || "según plazos legales aplicables"}
`,
    )
    .join("\n") || "_Sin activos con datos personales clasificados._"
}

## 3. Registro de eventos

${
  (ctx.related?.activityLog || []).length > 0
    ? `| Fecha | Usuario | Acción | Entidad |
|---|---|---|---|
${(ctx.related!.activityLog as any[])
  .map(
    (l) =>
      `| ${new Date(l.createdAt).toLocaleString("es-EC")} | ${l.userName || l.userId} | ${l.action} | ${
        l.entityName || l.entityType
      } |`,
  )
  .join("\n")}`
    : "_Sin eventos registrados en el período consultado._"
}
`;
}

function expedienteDocument(ctx: DocumentContext): string {
  const docs: Record<string, string> = ctx.related?.documents || {};
  const item = (label: string, present: boolean, detail: string) =>
    `| ${label} | ${present ? "✔ Disponible" : "**✘ NO DISPONIBLE**"} | ${detail} |`;

  const stats = ctx.related?.requestStats || { total: 0, onTime: 0, overdue: 0 };
  const incidents = ctx.related?.incidentCount ?? 0;

  return `${header("Expediente de Cumplimiento LOPDP", ctx)}
${LEGAL_DISCLAIMER}

Índice del expediente de cumplimiento de ${ctx.company.name}, preparado para atender requerimientos de
la Superintendencia de Protección de Datos Personales (actuaciones previas, art. 63; requerimientos de
información; o procedimientos administrativos).

**Fecha de corte:** ${fmtDate(ctx.generatedAt)}

## Índice de contenidos

| # | Contenido | Estado | Detalle |
|---|---|---|---|
${[
  item(
    "1. Identificación del responsable",
    Boolean(ctx.company.ruc && ctx.profile.legalRepName),
    `${ctx.company.name}${ctx.company.ruc ? ` — RUC ${ctx.company.ruc}` : " — falta RUC"}${
      ctx.profile.legalRepName ? `, rep. legal ${ctx.profile.legalRepName}` : ", falta representante legal"
    }`,
  ),
  item("2. Registro de Actividades de Tratamiento (art. 37)", Boolean(docs.rat), docs.rat ? `estado: ${docs.rat}` : "generar el RAT en el módulo"),
  item("3. Política de protección de datos (arts. 10-11)", Boolean(docs.privacy_policy), docs.privacy_policy ? `estado: ${docs.privacy_policy}` : "generar y publicar la política"),
  item(
    "4. Bases legales y consentimientos (arts. 7-8)",
    Boolean(docs.consent || docs.consent_health),
    docs.consent || docs.consent_health ? "formularios de consentimiento generados" : "generar formularios de consentimiento",
  ),
  item("5. Contratos de encargo (art. 28)", Boolean(docs.dpa), docs.dpa ? `estado: ${docs.dpa}` : "generar contratos con los proveedores que acceden a datos"),
  item(
    "6. Gestión de riesgos y EIPDP (arts. 40-42, 68.4)",
    Boolean(docs.riesgos || docs.eipdp),
    ctx.scenarios.length > 0 ? `${ctx.scenarios.length} escenarios evaluados` : "ejecutar el motor de riesgos",
  ),
  item("7. Declaración de aplicabilidad de controles", Boolean(docs.soa), docs.soa ? `estado: ${docs.soa}` : "generar la declaración de aplicabilidad"),
  item(
    "8. Registro de solicitudes de titulares (art. 62)",
    stats.total > 0,
    `${stats.total} solicitudes; ${stats.onTime} atendidas en plazo; ${stats.overdue} vencidas`,
  ),
  item("9. Registro de incidentes y notificaciones (art. 43)", true, `${incidents} incidente(s) registrado(s)`),
  item(
    "10. Evidencia de capacitación (art. 49)",
    ctx.actions.some((a) => a.title.includes("Capacitar") && a.status === "done"),
    ctx.actions.some((a) => a.title.includes("Capacitar") && a.status === "done") ? "capacitación registrada" : "registrar la capacitación del personal",
  ),
  item(
    "11. Histórico de calificaciones",
    Boolean(ctx.assessment),
    ctx.assessment
      ? `riesgo ${ctx.assessment.riskScore}/100 (${ctx.assessment.riskGrade}); cumplimiento ${ctx.assessment.complianceScore}/100 (${ctx.assessment.complianceGrade})`
      : "ejecutar la evaluación",
  ),
  item("12. Bitácora de trazabilidad", Boolean(docs.trazabilidad), docs.trazabilidad ? `estado: ${docs.trazabilidad}` : "generar el informe de trazabilidad"),
].join("\n")}

## Nota sobre los faltantes

Los elementos marcados como **NO DISPONIBLE** no se completan con contenido genérico de forma
deliberada: un expediente con faltantes identificados y un plan de remediación es defendible ante la
autoridad; uno inflado con documentación aparente no lo es y agrava la situación.

## Estado general

${
  ctx.assessment
    ? `Calificación de cumplimiento vigente: **${ctx.assessment.complianceScore}/100 (nivel ${ctx.assessment.complianceGrade})**.`
    : "Sin evaluación registrada."
}
`;
}

function certificadoDocument(ctx: DocumentContext): string {
  const a = ctx.assessment;
  const validUntil = new Date(ctx.generatedAt);
  validUntil.setUTCMonth(validUntil.getUTCMonth() + 6);

  return `${header("Certificado de Cumplimiento en Protección de Datos Personales", ctx)}

> **Naturaleza de este certificado.** Se trata de una **evaluación autodeclarativa** realizada con la
> metodología de la Guía de Gestión de Riesgos e Impacto de la Superintendencia de Protección de Datos
> Personales, sobre la información registrada por la propia empresa.
> **No constituye una certificación oficial** en los términos del artículo 54 de la LOPDP, que
> corresponde emitir a las entidades de certificación acreditadas.

## Resultado de la evaluación

${
  a
    ? `| Indicador | Resultado |
|---|---|
| Calificación de cumplimiento LOPDP | **${a.complianceScore} / 100 — nivel ${a.complianceGrade}** |
| Calificación de riesgo (menor es mejor) | **${a.riskScore} / 100 — nivel ${a.riskGrade}** |
| Escenarios de riesgo evaluados | ${ctx.scenarios.length} |
| Activos con datos personales inventariados | ${ctx.classifications.filter((c) => c.dataCategories.length > 0).length} |

### Obligaciones verificadas

${
  a.breakdown?.compliance
    ? a.breakdown.compliance
        .map((i: any) => `- ${i.satisfied ? "✔" : i.partial ? "◐" : "✘"} ${i.label} (${i.legalBasis})`)
        .join("\n")
    : ""
}`
    : "_Sin evaluación registrada._"
}

## Vigencia

Emitido el **${fmtDate(ctx.generatedAt)}**, válido hasta el **${fmtDate(validUntil)}** (6 meses),
sujeto a que no cambien las actividades de tratamiento ni el inventario de activos de la empresa.

---

_Generado por TechAssets Pro — módulo de Protección de Datos Personales._
`;
}

function medidasInforme(ctx: DocumentContext): string {
  const p = ctx.related || {};
  const measures = ctx.actions.filter((a) => a.status === "done");
  return `${header("Informe de Cumplimiento de Medidas Correctivas", ctx)}
${LEGAL_DISCLAIMER}

**Expediente:** ${p.fileNumber || "[número]"}
**Medidas dispuestas por la SPDP:** ${p.correctiveMeasures || "[detallar]"}
**Fecha de notificación:** ${p.notifiedAt ? fmtDate(new Date(p.notifiedAt)) : "[fecha]"}
**Plazo otorgado:** ${p.deadline ? fmtDate(new Date(p.deadline)) : "[fecha]"}

## Medidas implementadas

${
  measures.length > 0
    ? measures
        .map(
          (m, i) =>
            `${i + 1}. **${m.title}** — ${m.legalBasis || ""}${
              m.completedAt ? ` — implementada el ${fmtDate(new Date(m.completedAt))}` : ""
            }`,
        )
        .join("\n")
    : "_Sin medidas registradas como implementadas._"
}

## Estado de cumplimiento

${
  ctx.assessment
    ? `Calificación de cumplimiento tras las medidas: **${ctx.assessment.complianceScore}/100
(nivel ${ctx.assessment.complianceGrade})**. Calificación de riesgo residual: **${ctx.assessment.riskScore}/100**.`
    : "_Sin evaluación registrada._"
}

## Declaración

${ctx.company.name} declara haber cumplido las medidas correctivas dispuestas dentro del plazo
otorgado, conforme al artículo 66 de la LOPDP, y adjunta la evidencia documental correspondiente.

Atentamente,

**${ctx.profile.legalRepName || "[Representante legal]"}**
${ctx.company.name}
`;
}

// ============================================================================
// DESPACHADOR
// ============================================================================

export function renderDocument(docType: DpDocType, ctx: DocumentContext): string {
  switch (docType) {
    case "privacy_policy": return privacyPolicy(ctx);
    case "tyc": return termsAndConditions(ctx);
    case "dpa": return dpaContract(ctx);
    case "dpa_processor": return dpaAsProcessor(ctx);
    case "consent": return consentForm(ctx, false);
    case "consent_health": return consentForm(ctx, true);
    case "rat": return ratDocument(ctx);
    case "arco": return arcoProcedure(ctx);
    case "breach_protocol": return breachProtocol(ctx);
    case "eipdp": return eipdpDocument(ctx);
    case "soa": return soaDocument(ctx);
    case "diagnostico": return diagnosticoDocument(ctx);
    case "riesgos": return riesgosDocument(ctx);
    case "titular_response": return titularResponse(ctx);
    case "spdp_notification": return spdpNotification(ctx);
    case "descargos": return descargosDocument(ctx);
    case "medidas_informe": return medidasInforme(ctx);
    case "trazabilidad": return trazabilidadDocument(ctx);
    case "expediente": return expedienteDocument(ctx);
    case "certificado": return certificadoDocument(ctx);
    default:
      return `${header("Documento", ctx)}\n${LEGAL_DISCLAIMER}\n\n_Tipo de documento no reconocido._`;
  }
}

/** Documentos que el usuario puede generar desde el catálogo (los demás nacen de un flujo). */
export const CATALOG_DOC_TYPES: DpDocType[] = [
  "privacy_policy",
  "tyc",
  "rat",
  "arco",
  "consent",
  "consent_health",
  "dpa",
  "dpa_processor",
  "breach_protocol",
  "eipdp",
  "soa",
  "diagnostico",
  "riesgos",
  "trazabilidad",
  "certificado",
];
