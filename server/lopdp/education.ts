/**
 * CONTENIDO DIDÁCTICO DEL MÓDULO LOPDP
 *
 * Premisa de diseño: quien compra TechAssets Pro sabe de sus activos, NO de la
 * Ley Orgánica de Protección de Datos Personales. El cuestionario no puede
 * preguntar "¿tiene usted base legal para el tratamiento?" a alguien que nunca
 * escuchó ese término.
 *
 * Cada pregunta se plantea en lenguaje cotidiano y trae consigo:
 *   - qué significa el concepto,
 *   - un ejemplo del sector del usuario,
 *   - qué pasa si no lo tiene,
 *   - y la idea que se lleva aprendida.
 *
 * Además, "No sé" es una respuesta VÁLIDA y de primera clase: obligar a elegir
 * entre sí y no produce respuestas falsas, y una calificación construida sobre
 * respuestas falsas no sirve para defenderse ante la autoridad.
 */
import type { DpSector } from "@shared/lopdp";

export type GuidedAnswer = true | false | "unknown";

export interface GuidedQuestion {
  key: string;
  /** La pregunta, en lenguaje de todos los días. */
  question: string;
  /** Qué significa el concepto detrás de la pregunta. */
  whatItMeans: string;
  /** Ejemplo concreto, por sector. `default` cuando no hay uno específico. */
  examples: Partial<Record<DpSector | "default", string>>;
  /** Qué pasa si la respuesta es no. */
  ifYouDont: string;
  legalBasis: string;
  /** La idea que el usuario se lleva aprendida al responder. */
  takeaway: string;
}

export interface GuidedStep {
  key: string;
  title: string;
  /** Introducción que se lee ANTES de las preguntas del bloque. */
  intro: string;
  /** Por qué este bloque importa, en una frase. */
  whyItMatters: string;
  questions: GuidedQuestion[];
}

// ============================================================================
// LO PRIMERO: ¿de qué va todo esto?
// ============================================================================

export const WELCOME = {
  title: "Antes de empezar: qué es esto y por qué te aplica",
  paragraphs: [
    "Si guardas el nombre, la cédula, el teléfono o la historia clínica de alguien, estás tratando " +
      "**datos personales**. En Ecuador eso lo regula la Ley Orgánica de Protección de Datos Personales " +
      "(LOPDP), y aplica a cualquier empresa sin importar su tamaño: desde un consultorio de una persona " +
      "hasta una corporación.",
    "La ley no te pide ser abogado. Te pide tres cosas: **saber qué datos tienes**, **cuidarlos** y " +
      "**poder demostrarlo**. Este módulo hace las dos primeras contigo y genera la evidencia de la tercera.",
    "Vamos a hacerte preguntas sencillas sobre cómo trabajas hoy. No hay respuestas incorrectas: si algo " +
      "no lo tienes, aparecerá en tu plan de acción. Y si no sabes, responde **No sé** — es la respuesta " +
      "más útil que puedes dar, porque te diremos exactamente cómo averiguarlo.",
  ],
  glossary: [
    {
      term: "Dato personal",
      definition: "Cualquier información que permita identificar a una persona: nombre, cédula, correo, teléfono, foto, huella.",
    },
    {
      term: "Dato sensible",
      definition:
        "Los que pueden causar discriminación si se filtran: salud, huellas y rostro (biométricos), origen étnico, " +
        "creencias, vida sexual. La ley los protege con reglas más estrictas y tú probablemente manejas algunos.",
    },
    {
      term: "Titular",
      definition: "La persona dueña de los datos: tu cliente, tu paciente, tu empleado. Los datos son suyos, tú solo los custodias.",
    },
    {
      term: "Responsable del tratamiento",
      definition: "Tú, si decides para qué se usan los datos. Es tu rol por defecto y el que trae las obligaciones.",
    },
    {
      term: "Encargado del tratamiento",
      definition:
        "Un tercero que trata datos por cuenta tuya: tu proveedor de nube, tu contador externo, el laboratorio. " +
        "Necesitas un contrato con cada uno.",
    },
    {
      term: "Superintendencia (SPDP)",
      definition: "La autoridad que vigila el cumplimiento, atiende denuncias de tus clientes y aplica las sanciones.",
    },
  ],
};

// ============================================================================
// LOS BLOQUES DE PREGUNTAS
// ============================================================================

export const GUIDED_STEPS: GuidedStep[] = [
  // --------------------------------------------------------------------------
  {
    key: "legitimidad",
    title: "Para qué usas los datos",
    intro:
      "La ley parte de una idea simple: no puedes usar los datos de una persona “porque sí”. Siempre tiene que " +
      "haber una razón que la ley acepte. A esa razón se le llama **base legal**, y hay cuatro que cubren casi " +
      "todos los casos de una pyme: que la persona te dio permiso (consentimiento), que necesitas los datos para " +
      "cumplir un contrato con ella, que una ley te obliga a guardarlos, o que tienes un interés legítimo " +
      "razonable.",
    whyItMatters:
      "Usar datos sin una de esas razones es tratamiento ilegítimo: la autoridad puede ordenarte que dejes de " +
      "usarlos y que los borres.",
    questions: [
      {
        key: "hasLegalBasis",
        question: "¿Sabrías explicar por qué la ley te permite usar los datos de tus clientes?",
        whatItMeans:
          "Se trata de tener claro, para cada uso que le das a los datos, cuál de las cuatro razones te ampara. " +
          "No hace falta un documento sofisticado: hace falta tenerlo pensado y escrito.",
        examples: {
          odontologia:
            "Guardas la ficha de un paciente porque la necesitas para atenderlo (contrato) y porque la ley de salud " +
            "te obliga a conservarla. Pero mandarle publicidad de blanqueamiento ya necesita su permiso expreso.",
          salud:
            "La historia clínica se justifica por la atención médica y por obligación legal. El recordatorio de citas " +
            "por WhatsApp, en cambio, necesita el consentimiento del paciente.",
          contable:
            "Guardas el RUC y los datos de tu cliente porque tienes un contrato de servicios con él, y las " +
            "declaraciones porque el SRI te obliga a conservarlas.",
          legal:
            "Los datos del expediente se justifican por el contrato de patrocinio con tu cliente y por tu deber " +
            "profesional.",
          default:
            "Guardas los datos de facturación de un cliente porque tienes un contrato con él y porque el SRI te " +
            "obliga a emitir la factura.",
        },
        ifYouDont:
          "Es infracción grave. Además, sin base legal definida no puedes generar bien ningún otro documento: todo " +
          "lo demás se construye encima de esto.",
        legalBasis: "Art. 7 LOPDP",
        takeaway:
          "Aprendiste que todo uso de datos necesita una razón legal, y que las cuatro más comunes son: " +
          "consentimiento, contrato, obligación legal e interés legítimo.",
      },
      {
        key: "hasConsent",
        question: "Cuando le pides datos a alguien, ¿le haces firmar o aceptar algo?",
        whatItMeans:
          "Cuando tu razón para usar los datos es el permiso de la persona, ese permiso debe quedar registrado: " +
          "firmado en papel, aceptado en un formulario o marcado en tu sistema. Y debe poder retirarse con la " +
          "misma facilidad con que se dio.",
        examples: {
          odontologia:
            "El consentimiento informado que firma el paciente antes de un tratamiento debería incluir también una " +
            "cláusula sobre el manejo de sus datos y sus fotos clínicas.",
          salud:
            "El consentimiento informado del paciente debe cubrir además el tratamiento de sus datos de salud, que " +
            "son datos sensibles.",
          contable:
            "Cuando un cliente nuevo te entrega sus claves del SRI y los datos de sus empleados, ahí debería haber " +
            "una autorización escrita.",
          default: "Una casilla en tu formulario web que diga qué haces con los datos y que la persona debe marcar.",
        },
        ifYouDont:
          "Tratar datos sensibles (salud, huellas, rostro) sin consentimiento explícito es infracción MUY GRAVE, " +
          "la categoría más alta de la ley.",
        legalBasis: "Art. 8 LOPDP",
        takeaway:
          "Aprendiste que el consentimiento debe ser libre, informado, específico y revocable — y que si no queda " +
          "registrado, para la ley es como si no existiera.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  {
    key: "transparencia",
    title: "Qué le cuentas a tus clientes",
    intro:
      "Las personas tienen derecho a saber qué haces con sus datos y a pedirte que se los muestres, los corrijas " +
      "o los borres. A esos derechos se les llama **ARCO-PL** (acceso, rectificación, cancelación, oposición, " +
      "portabilidad y limitación). No necesitas memorizar la sigla: necesitas un correo donde te los puedan pedir " +
      "y responder a tiempo.",
    whyItMatters:
      "Si un cliente te escribe pidiendo sus datos y no le respondes en 10 días hábiles, puede denunciarte ante la " +
      "Superintendencia. Así empiezan la mayoría de los procedimientos contra pymes.",
    questions: [
      {
        key: "hasPrivacyPolicy",
        question: "¿Tienes escrito en algún lado qué haces con los datos de tus clientes?",
        whatItMeans:
          "Es la llamada **política de privacidad** o aviso de privacidad: un texto que explica qué datos pides, " +
          "para qué, cuánto tiempo los guardas y cómo la persona puede ejercer sus derechos. Debe estar visible, " +
          "no archivado en una carpeta.",
        examples: {
          odontologia: "Un cartel en recepción y un texto en tu página web o en tu perfil de redes.",
          salud: "Un aviso visible en recepción y entregado junto al consentimiento informado.",
          default: "Una página en tu sitio web, o una hoja que entregas al cliente cuando lo registras.",
        },
        ifYouDont: "No mantener disponibles políticas de protección de datos es infracción leve expresa (art. 67.3).",
        legalBasis: "Arts. 10 y 11 LOPDP",
        takeaway:
          "Aprendiste que la transparencia es una obligación: si la persona no puede saber qué haces con sus " +
          "datos, estás incumpliendo aunque los cuides bien.",
      },
      {
        key: "hasArcoChannel",
        question: "Si un cliente te pide hoy “bórrame de tu sistema”, ¿sabes por dónde te llegaría y quién lo atiende?",
        whatItMeans:
          "Necesitas un canal claro (un correo basta) y alguien responsable de responder. La ley te da **10 días " +
          "término** —días hábiles— para contestar, aceptando o negando de forma motivada.",
        examples: {
          default: "Un correo tipo datos@tuempresa.com publicado en tu política, que alguien revise de verdad.",
        },
        ifYouDont:
          "No tramitar o negar sin motivo una solicitud es infracción leve, y habilita al cliente a reclamar " +
          "directamente ante la Superintendencia (art. 64).",
        legalBasis: "Arts. 12 a 22 y 62 LOPDP",
        takeaway:
          "Aprendiste que tienes 10 días hábiles para responder a un cliente que reclama sus datos, y que el reloj " +
          "corre desde que la solicitud llega, no desde que la lees.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  {
    key: "inventario",
    title: "Saber qué tienes y quién lo toca",
    intro:
      "La Superintendencia no empieza pidiéndote seguridad informática: empieza pidiéndote el **Registro de " +
      "Actividades de Tratamiento (RAT)**, que es el inventario de qué datos manejas, para qué, dónde viven y " +
      "quién los toca. Buena noticia: como ya tienes tus activos cargados en el sistema, el módulo lo arma solo " +
      "cuando clasificas tus equipos.",
    whyItMatters: "Sin RAT no puedes demostrar nada de lo demás. Es la base de todo el expediente.",
    questions: [
      {
        key: "hasRat",
        question: "¿Tienes una lista de qué datos personales manejas y en qué sistemas están?",
        whatItMeans:
          "El RAT. Debe decir qué datos tratas, con qué finalidad, en qué equipos o programas viven, quién accede " +
          "y cuánto tiempo los conservas. Se revisa cada 6 meses.",
        examples: {
          odontologia:
            "Fichas de pacientes en el software de consultorio, radiografías en el computador de rayos X, huellas " +
            "en el reloj biométrico, imágenes en el grabador de cámaras.",
          contable:
            "Datos tributarios en tu sistema contable, nóminas de clientes en el portal, respaldos en el servidor.",
          default: "Clientes en el sistema de facturación, empleados en la nómina, visitantes en las cámaras.",
        },
        ifYouDont: "Es lo primero que te van a pedir. Sin esto no hay expediente que presentar.",
        legalBasis: "Art. 37 LOPDP",
        takeaway:
          "Aprendiste que el RAT es el documento base del cumplimiento, y que se construye desde tu inventario de " +
          "activos — no desde cero.",
      },
      {
        key: "hasDpaContracts",
        question: "¿Algún proveedor externo puede ver los datos de tus clientes? ¿Firmaste algo con él?",
        whatItMeans:
          "Si tu contador externo, tu soporte técnico, tu laboratorio o tu proveedor de nube pueden ver datos de " +
          "tus clientes, la ley los llama **encargados del tratamiento** y exige un contrato que los obligue a " +
          "protegerlos.",
        examples: {
          odontologia: "El laboratorio dental que recibe los datos del paciente, o el técnico que da soporte al software.",
          contable: "El proveedor de tu sistema contable en la nube, que aloja los datos de todos tus clientes.",
          salud: "El laboratorio de análisis, o el proveedor que aloja las historias clínicas.",
          default: "Tu proveedor de correo en la nube, tu contador externo, la empresa que monitorea tus cámaras.",
        },
        ifYouDont:
          "Sin contrato, respondes tú por lo que haga el proveedor. Si él filtra los datos, la multa te llega a ti.",
        legalBasis: "Art. 28 LOPDP",
        takeaway:
          "Aprendiste que subcontratar el trabajo no subcontrata la responsabilidad: sigues respondiendo por los " +
          "datos de tus clientes.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  {
    key: "seguridad",
    title: "Cómo cuidas los datos en la práctica",
    intro:
      "Aquí la ley no exige tecnología cara: exige medidas **proporcionales al riesgo**. Si manejas datos de " +
      "salud o huellas, se te exige más que a una tienda de barrio. Estas cuatro medidas son las que la autoridad " +
      "revisa primero después de una fuga.",
    whyItMatters:
      "No implementar medidas técnicas y organizativas es infracción GRAVE expresa (art. 68.1). Es lo primero que " +
      "se audita cuando algo sale mal.",
    questions: [
      {
        key: "hasBackups",
        question: "¿Tienes copias de seguridad y alguna vez probaste que se pueden restaurar?",
        whatItMeans:
          "Un respaldo que nunca probaste no es un respaldo: es una suposición. La prueba de restauración es lo " +
          "que convierte una fuga en un incidente temporal en vez de una pérdida definitiva.",
        examples: {
          default: "Copia automática diaria a un disco externo o a la nube, y una prueba de restauración cada tanto.",
        },
        ifYouDont:
          "Un ransomware que cifre tus sistemas te deja sin acceso a los datos de tus clientes, y eso también es " +
          "una vulneración que debes notificar en 72 horas.",
        legalBasis: "Art. 37 LOPDP",
        takeaway: "Aprendiste que la disponibilidad de los datos también es protección de datos, no solo el secreto.",
      },
      {
        key: "hasEncryption",
        question: "¿Los computadores donde guardas datos están cifrados?",
        whatItMeans:
          "Cifrar significa que si alguien roba el equipo o el disco, no puede leer nada sin la clave. En Windows " +
          "se llama BitLocker y en Mac, FileVault: suele ser cuestión de activarlo.",
        examples: {
          odontologia: "El computador de recepción con las fichas de todos tus pacientes.",
          default: "La laptop que sacas de la oficina con la base de clientes dentro.",
        },
        ifYouDont:
          "El robo de un equipo sin cifrar es una fuga de datos notificable. Con cifrado, el impacto sobre los " +
          "titulares baja drásticamente y la autoridad lo valora.",
        legalBasis: "Arts. 37 a 39 LOPDP",
        takeaway:
          "Aprendiste que el cifrado es la medida que más reduce el impacto de un robo, y que suele estar incluida " +
          "en el sistema operativo que ya pagaste.",
      },
      {
        key: "hasMfa",
        question: "¿Para entrar al correo o a tus sistemas hace falta algo más que la contraseña?",
        whatItMeans:
          "La verificación en dos pasos (MFA) pide un código adicional del celular. Corta la mayoría de los " +
          "ataques, porque robar la contraseña deja de ser suficiente.",
        examples: { default: "El código que te llega al celular al entrar al correo desde un equipo nuevo." },
        ifYouDont: "La causa más común de fuga de datos en pymes es una contraseña robada por correo falso (phishing).",
        legalBasis: "Art. 37 LOPDP",
        takeaway:
          "Aprendiste que esta es la medida con mejor relación protección/esfuerzo: se activa en minutos y es gratis.",
      },
      {
        key: "hasAccessControl",
        question: "¿Cada persona de tu equipo ve solo lo que necesita para su trabajo?",
        whatItMeans:
          "Se llama **principio de mínimo privilegio**. La recepcionista no necesita ver la contabilidad, y el " +
          "contador no necesita ver las historias clínicas.",
        examples: {
          odontologia: "Recepción agenda citas, pero no debería abrir las radiografías ni las notas clínicas.",
          contable: "El asistente que digita facturas no necesita acceso a las claves del SRI de todos los clientes.",
          default: "Usuarios distintos con permisos distintos, en vez de una sola clave que todos comparten.",
        },
        ifYouDont:
          "Los accesos indebidos internos son de los incidentes más frecuentes, y sin registros no puedes ni saber " +
          "quién vio qué.",
        legalBasis: "Art. 38 LOPDP; ISO/IEC 27002 cl. 5.15",
        takeaway:
          "Aprendiste que compartir una sola clave entre todos es una vulnerabilidad organizacional, no una " +
          "comodidad.",
      },
      {
        key: "hasDeviceLock",
        question: "¿Los equipos se bloquean solos y piden contraseña?",
        whatItMeans: "Bloqueo automático tras unos minutos de inactividad, y contraseña para desbloquear.",
        examples: { default: "El computador de recepción que queda abierto mientras nadie lo atiende." },
        ifYouDont: "Cualquiera que pase por ahí puede ver o copiar datos sin dejar rastro.",
        legalBasis: "Art. 37 LOPDP",
        takeaway: "Aprendiste que la seguridad física del puesto de trabajo cuenta tanto como la informática.",
      },
      {
        key: "hasAntivirus",
        question: "¿Tienes antivirus y el sistema operativo actualizado?",
        whatItMeans: "Protección contra programas maliciosos y parches de seguridad al día.",
        examples: { default: "Windows Update activado y un antivirus con licencia vigente." },
        ifYouDont: "Los equipos sin actualizar son la puerta de entrada más común del ransomware.",
        legalBasis: "Art. 37 LOPDP",
        takeaway: "Aprendiste que un equipo desactualizado es una vulnerabilidad técnica documentable en tu contra.",
      },
      {
        key: "hasAuditLogs",
        question: "¿Puedes saber quién abrió o modificó un dato, y cuándo?",
        whatItMeans:
          "Los **registros de auditoría** (logs) guardan quién hizo qué. Son la evidencia con la que demuestras " +
          "trazabilidad ante la autoridad, y la única forma de investigar un acceso indebido.",
        examples: {
          odontologia: "Saber qué usuario abrió la ficha de un paciente que después se quejó de una filtración.",
          default: "El historial de accesos de tu sistema o de tu servidor de archivos.",
        },
        ifYouDont: "Sin registros no puedes investigar un incidente ni demostrar que no fuiste tú.",
        legalBasis: "Art. 39 LOPDP",
        takeaway: "Aprendiste que la trazabilidad es prueba: sin logs, tu palabra es todo lo que tienes.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  {
    key: "organizacion",
    title: "Tu equipo y tus procesos",
    intro:
      "La mayoría de las fugas no empiezan por un hacker: empiezan por alguien del equipo que reenvía un archivo " +
      "sin pensar. Por eso la ley trata la capacitación como una medida de seguridad, no como un extra.",
    whyItMatters:
      "La negligencia por falta de capacitación NO te exime de responsabilidad: al contrario, la autoridad la lee " +
      "como una vulnerabilidad tuya.",
    questions: [
      {
        key: "hasTraining",
        question: "¿Le explicaste a tu equipo, en el último año, cómo deben manejar los datos de los clientes?",
        whatItMeans:
          "Una charla corta documentada basta: qué se puede compartir, qué no, y qué hacer si sospechan de un " +
          "correo falso. Debe repetirse al menos una vez al año.",
        examples: {
          odontologia: "Que el equipo sepa que no puede publicar fotos de pacientes sin permiso escrito, ni siquiera sin el rostro.",
          contable: "Que el equipo no envíe declaraciones de un cliente por WhatsApp personal.",
          default: "Una reunión de media hora con lista de asistentes firmada.",
        },
        ifYouDont: "Es la vulnerabilidad organizacional más citada en los análisis de riesgo.",
        legalBasis: "Art. 49 LOPDP",
        takeaway: "Aprendiste que capacitar es una medida de seguridad exigible, y que hay que dejar constancia de ella.",
      },
      {
        key: "hasNda",
        question: "¿Tu personal firmó algún compromiso de confidencialidad?",
        whatItMeans:
          "Un acuerdo donde se comprometen a no divulgar la información que manejan. El deber sigue vigente " +
          "después de que se van de la empresa.",
        examples: { default: "Una cláusula en el contrato de trabajo, o un anexo firmado." },
        ifYouDont: "Sin compromiso escrito es más difícil exigir responsabilidad a un ex empleado que filtró datos.",
        legalBasis: "Art. 38 LOPDP",
        takeaway: "Aprendiste que el deber de secreto no termina cuando termina el contrato de trabajo.",
      },
      {
        key: "hasSecurityPolicy",
        question: "¿Tienes reglas escritas de cómo se usan los equipos y las claves?",
        whatItMeans:
          "Un documento corto: no compartir contraseñas, no instalar programas sin autorización, cerrar sesión al " +
          "salir, no sacar datos en USB sin permiso.",
        examples: { default: "Dos páginas que todo el equipo lee y firma al entrar." },
        ifYouDont: "Sin reglas escritas no puedes exigir su cumplimiento ni sancionar el incumplimiento.",
        legalBasis: "Arts. 37 a 39 LOPDP",
        takeaway: "Aprendiste que una política corta que se cumple vale más que un manual extenso que nadie lee.",
      },
      {
        key: "hasBreachProtocol",
        question: "Si mañana te hackean, ¿sabes a quién avisar y en cuánto tiempo?",
        whatItMeans:
          "Tienes **72 horas** desde que te enteras para notificar a la Superintendencia, y debes avisar también a " +
          "las personas afectadas. El protocolo es el plan escrito de esos pasos.",
        examples: { default: "Una hoja con: a quién llamo, qué desconecto, qué anoto, a quién notifico." },
        ifYouDont: "Sin protocolo, esas 72 horas se te van improvisando — y el plazo no se detiene.",
        legalBasis: "Arts. 43 a 46 LOPDP",
        takeaway:
          "Aprendiste que ante una fuga el reloj corre desde que te enteras, y que improvisar en ese momento sale caro.",
      },
    ],
  },

  // --------------------------------------------------------------------------
  {
    key: "responsabilidad",
    title: "Quién responde por esto",
    intro:
      "Algunas empresas están obligadas a nombrar un **Delegado de Protección de Datos (DPD)**: la persona " +
      "responsable ante la Superintendencia. Es obligatorio si tratas datos sensibles a gran escala o si tratar " +
      "datos es tu actividad principal. Si no es tu caso, igual conviene que alguien tenga el tema asignado.",
    whyItMatters: "Cuando la autoridad escribe, escribe a alguien. Si no hay nadie designado, escribe al representante legal.",
    questions: [
      {
        key: "hasDpo",
        question: "¿Hay alguien en tu empresa encargado del tema de datos personales?",
        whatItMeans:
          "Puede ser un empleado, tú mismo o un externo. Si estás obligado a tenerlo, además debe registrarse ante " +
          "la Superintendencia.",
        examples: {
          salud: "En consultorios con historias clínicas de miles de pacientes suele ser obligatorio.",
          odontologia: "Si manejas fichas y radiografías de miles de pacientes, probablemente te corresponde.",
          default: "Al menos alguien que sepa que el tema existe y sea el punto de contacto.",
        },
        ifYouDont: "Su ausencia, cuando es obligatorio, agrava cualquier otro incumplimiento.",
        legalBasis: "Arts. 47 a 49 LOPDP; Res. SPDP-SPD-2025-0028-R",
        takeaway: "Aprendiste que la responsabilidad debe tener nombre y apellido, no quedar repartida entre todos.",
      },
      {
        key: "hasEipdp",
        question: "¿Alguna vez analizaste por escrito los riesgos de manejar los datos que manejas?",
        whatItMeans:
          "Se llama **Evaluación de Impacto (EIPDP)** y es obligatoria antes de tratar datos de alto riesgo: salud, " +
          "huellas o rostro, menores de edad, o datos alojados fuera del país. El módulo la genera por ti con los " +
          "escenarios que calcula.",
        examples: {
          odontologia: "Si tienes un lector de huella o un escáner intraoral, estás tratando datos biométricos: te aplica.",
          salud: "Cualquier consultorio con historias clínicas digitales entra en este supuesto.",
          default: "Si tienes cámaras que graban rostros o un reloj biométrico, te aplica.",
        },
        ifYouDont: "No hacerla cuando era necesaria es infracción grave expresa (art. 68.5).",
        legalBasis: "Arts. 40 a 42 LOPDP",
        takeaway:
          "Aprendiste que las huellas y los rostros son datos sensibles, y que usarlos obliga a analizar los " +
          "riesgos ANTES, no después.",
      },
    ],
  },
];

/** Todas las claves de preguntas guiadas, en orden. */
export const GUIDED_QUESTION_KEYS = GUIDED_STEPS.flatMap((s) => s.questions.map((q) => q.key));

/** Devuelve el ejemplo del sector, con reserva al genérico. */
export function exampleFor(q: GuidedQuestion, sector: DpSector): string {
  return q.examples[sector] ?? q.examples.default ?? "";
}

/**
 * Preguntas respondidas "No sé": no son un fallo del usuario, son trabajo
 * pendiente concreto. Se convierten en acciones de averiguación.
 */
export function unknownAnswers(questionnaire: Record<string, any>): GuidedQuestion[] {
  const all = GUIDED_STEPS.flatMap((s) => s.questions);
  return all.filter((q) => questionnaire[q.key] === "unknown");
}

/** Construye el cuestionario guiado adaptado al sector de la empresa. */
export function buildGuide(sector: DpSector) {
  return {
    welcome: WELCOME,
    steps: GUIDED_STEPS.map((step) => ({
      key: step.key,
      title: step.title,
      intro: step.intro,
      whyItMatters: step.whyItMatters,
      questions: step.questions.map((q) => ({
        key: q.key,
        question: q.question,
        whatItMeans: q.whatItMeans,
        example: exampleFor(q, sector),
        ifYouDont: q.ifYouDont,
        legalBasis: q.legalBasis,
        takeaway: q.takeaway,
      })),
    })),
  };
}
