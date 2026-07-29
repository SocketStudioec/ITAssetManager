/**
 * DATOS DE LAS 5 EMPRESAS DEMO DEL MÓDULO LOPDP
 *
 * Perfiles objetivo del módulo: contador, médico, odontólogo, abogado y pyme
 * general. Todos los datos son SINTÉTICOS — ninguna persona o empresa real.
 *
 * Compartido por scripts/seed-lopdp-demo.ts (siembra con usuarios que pueden
 * iniciar sesión) y scripts/test-lopdp-integration.ts (pruebas end-to-end).
 */

export interface DemoCompanySpec {
  key: string;
  name: string;
  ruc: string;
  sector: string;
  revenue: string;
  isProcessor: boolean;
  legalRep: string;
  user: { email: string; firstName: string; lastName: string };
  assets: Array<{ name: string; type: string; model?: string }>;
  licenses: Array<{ name: string; vendor: string }>;
  contracts: Array<{ name: string; vendor: string; type: string }>;
  /** Lo que la empresa YA tiene implementado (lo demás es vulnerabilidad). */
  questionnaire: Record<string, any>;
  classify: Record<string, {
    categories: string[]; subjects: string[]; count: string; storage: string; processor?: boolean;
  }>;
}

export const DEMO_COMPANIES: DemoCompanySpec[] = [
  {
    key: "contador",
    name: "Estudio Contable Andrade & Asociados",
    ruc: "1791234567001",
    sector: "contable",
    revenue: "100k-500k",
    isProcessor: true,
    legalRep: "María Andrade Vélez",
    user: { email: "contador@demo-lopdp.ec", firstName: "María", lastName: "Andrade" },
    assets: [
      { name: "Laptop contabilidad principal", type: "physical", model: "Dell Latitude 5540" },
      { name: "Servidor de archivos tributarios", type: "physical", model: "HP ProLiant ML30" },
      { name: "Sistema contable de clientes", type: "application" },
      { name: "Portal de nómina de clientes", type: "application" },
      { name: "Impresora multifunción", type: "physical", model: "Epson L6270" },
    ],
    licenses: [
      { name: "Microsoft 365 Business", vendor: "Microsoft" },
      { name: "Sistema de facturación electrónica", vendor: "Bflash" },
    ],
    contracts: [
      { name: "Servicio de nube contable", vendor: "Contifico", type: "software" },
      { name: "Soporte informático externo", vendor: "TecnoSoporte Cía. Ltda.", type: "servicio" },
    ],
    questionnaire: {
      hasBackups: true, hasAntivirus: true, hasDeviceLock: true,
      treatmentIsCoreActivity: true,
      purposes: [
        { name: "Contabilidad y declaraciones tributarias de clientes", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Procesamiento de nómina por cuenta de clientes", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Facturación propia", basis: "Obligación legal (art. 7.4)" },
      ],
    },
    classify: {
      "Laptop contabilidad principal": { categories: ["identificativos", "financieros"], subjects: ["clientes"], count: "100-1000", storage: "local" },
      "Servidor de archivos tributarios": { categories: ["identificativos", "financieros", "laborales"], subjects: ["clientes", "terceros"], count: "1000-10000", storage: "local" },
      "Sistema contable de clientes": { categories: ["identificativos", "financieros"], subjects: ["clientes"], count: "1000-10000", storage: "nube_ext" },
      "Portal de nómina de clientes": { categories: ["identificativos", "laborales", "financieros"], subjects: ["terceros"], count: "1000-10000", storage: "nube_ext" },
      "Impresora multifunción": { categories: [], subjects: [], count: "<100", storage: "local" },
      "Microsoft 365 Business": { categories: ["identificativos", "contacto"], subjects: ["clientes", "empleados"], count: "100-1000", storage: "nube_ext" },
      "Sistema de facturación electrónica": { categories: ["identificativos", "financieros"], subjects: ["clientes"], count: "1000-10000", storage: "nube_ec" },
      "Servicio de nube contable": { categories: ["identificativos", "financieros"], subjects: ["clientes"], count: "1000-10000", storage: "nube_ext", processor: true },
      "Soporte informático externo": { categories: ["identificativos"], subjects: ["empleados"], count: "<100", storage: "local", processor: true },
    },
  },
  {
    key: "medico",
    name: "Centro Médico Vida Sana",
    ruc: "1792345678001",
    sector: "salud",
    revenue: "500k-1m",
    isProcessor: false,
    legalRep: "Dr. Carlos Jaramillo Ortiz",
    user: { email: "medico@demo-lopdp.ec", firstName: "Carlos", lastName: "Jaramillo" },
    assets: [
      { name: "Sistema de historias clínicas", type: "application" },
      { name: "Servidor de imágenes médicas", type: "physical", model: "Dell PowerEdge T350" },
      { name: "Laptop de consultorio 1", type: "physical", model: "Lenovo ThinkPad E14" },
      { name: "Laptop de consultorio 2", type: "physical", model: "Lenovo ThinkPad E14" },
      { name: "Equipo de rayos X digital", type: "physical", model: "Siemens Multix" },
      { name: "Portal de agendamiento de pacientes", type: "application" },
    ],
    licenses: [
      { name: "Software de laboratorio clínico", vendor: "LabSoft" },
      { name: "Antivirus corporativo", vendor: "ESET" },
    ],
    contracts: [
      { name: "Laboratorio externo de análisis", vendor: "Laboratorios NetLab", type: "servicio" },
      { name: "Hosting de historias clínicas", vendor: "AWS", type: "infraestructura" },
    ],
    questionnaire: {
      hasAntivirus: true, hasDeviceLock: true, hasBackups: true,
      clinicalRecordsDigital: true,
      purposes: [
        { name: "Atención médica e historia clínica", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Agendamiento y recordatorios de citas", basis: "Consentimiento del titular (art. 7.1)" },
        { name: "Facturación de servicios de salud", basis: "Obligación legal (art. 7.4)" },
      ],
    },
    classify: {
      "Sistema de historias clínicas": { categories: ["identificativos", "contacto", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "nube_ext" },
      "Servidor de imágenes médicas": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "local" },
      "Laptop de consultorio 1": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "local" },
      "Laptop de consultorio 2": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "local" },
      "Equipo de rayos X digital": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "local" },
      "Portal de agendamiento de pacientes": { categories: ["identificativos", "contacto"], subjects: ["pacientes"], count: ">10000", storage: "nube_ext" },
      "Software de laboratorio clínico": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "nube_ec" },
      "Antivirus corporativo": { categories: [], subjects: [], count: "<100", storage: "local" },
      "Laboratorio externo de análisis": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "nube_ec", processor: true },
      "Hosting de historias clínicas": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "nube_ext", processor: true },
    },
  },
  {
    key: "odontologo",
    name: "Clínica Odontológica Sonrisa",
    ruc: "1793456789001",
    sector: "odontologia",
    revenue: "100k-500k",
    isProcessor: false,
    legalRep: "Od. Paola Cevallos Muñoz",
    user: { email: "odontologo@demo-lopdp.ec", firstName: "Paola", lastName: "Cevallos" },
    assets: [
      { name: "Software de fichas odontológicas", type: "application" },
      { name: "Computador de recepción", type: "physical", model: "HP Pavilion" },
      { name: "Escáner intraoral", type: "physical", model: "3Shape TRIOS" },
      { name: "Radiografía panorámica digital", type: "physical", model: "Vatech PaX-i" },
    ],
    licenses: [{ name: "Software de diseño de sonrisa", vendor: "Exocad" }],
    contracts: [{ name: "Laboratorio dental externo", vendor: "Dental Lab Quito", type: "servicio" }],
    questionnaire: {
      hasDeviceLock: true,
      clinicalRecordsDigital: true,
      purposes: [
        { name: "Atención odontológica y ficha clínica", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Recordatorio de citas y controles", basis: "Consentimiento del titular (art. 7.1)" },
      ],
    },
    classify: {
      "Software de fichas odontológicas": { categories: ["identificativos", "contacto", "salud"], subjects: ["pacientes"], count: "1000-10000", storage: "local" },
      "Computador de recepción": { categories: ["identificativos", "contacto"], subjects: ["pacientes"], count: "1000-10000", storage: "local" },
      "Escáner intraoral": { categories: ["identificativos", "salud", "biometricos"], subjects: ["pacientes"], count: "100-1000", storage: "local" },
      "Radiografía panorámica digital": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "local" },
      "Software de diseño de sonrisa": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "nube_ext" },
      "Laboratorio dental externo": { categories: ["identificativos", "salud"], subjects: ["pacientes"], count: "100-1000", storage: "local", processor: true },
    },
  },
  {
    key: "abogado",
    name: "Estudio Jurídico Herrera & Peña",
    ruc: "1794567890001",
    sector: "legal",
    revenue: "100k-500k",
    isProcessor: false,
    legalRep: "Ab. Diego Herrera Salazar",
    user: { email: "abogado@demo-lopdp.ec", firstName: "Diego", lastName: "Herrera" },
    assets: [
      { name: "Gestor de expedientes de clientes", type: "application" },
      { name: "Servidor de documentos legales", type: "physical", model: "Synology DS923+" },
      { name: "Laptop socio principal", type: "physical", model: "MacBook Pro 14" },
      { name: "Laptop asociado", type: "physical", model: "Dell XPS 13" },
    ],
    licenses: [
      { name: "Base de datos jurídica", vendor: "Lexis" },
      { name: "Firma electrónica", vendor: "Security Data" },
    ],
    contracts: [{ name: "Almacenamiento en la nube", vendor: "Google Workspace", type: "software" }],
    questionnaire: {
      hasNda: true, hasDeviceLock: true, hasBackups: true, hasEncryption: true,
      filesDigitized: true,
      purposes: [
        { name: "Patrocinio y gestión de casos", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Facturación de honorarios", basis: "Obligación legal (art. 7.4)" },
      ],
    },
    classify: {
      "Gestor de expedientes de clientes": { categories: ["identificativos", "contacto", "otros_sensibles"], subjects: ["clientes"], count: "100-1000", storage: "local" },
      "Servidor de documentos legales": { categories: ["identificativos", "contacto", "financieros"], subjects: ["clientes"], count: "100-1000", storage: "local" },
      "Laptop socio principal": { categories: ["identificativos", "contacto"], subjects: ["clientes"], count: "100-1000", storage: "local" },
      "Laptop asociado": { categories: ["identificativos", "contacto"], subjects: ["clientes"], count: "100-1000", storage: "local" },
      "Base de datos jurídica": { categories: [], subjects: [], count: "<100", storage: "nube_ext" },
      "Firma electrónica": { categories: ["identificativos", "biometricos"], subjects: ["clientes"], count: "100-1000", storage: "nube_ec" },
      "Almacenamiento en la nube": { categories: ["identificativos", "contacto"], subjects: ["clientes"], count: "100-1000", storage: "nube_ext", processor: true },
    },
  },
  {
    key: "pyme",
    name: "Distribuidora Comercial El Roble",
    ruc: "1795678901001",
    sector: "otro",
    revenue: "500k-1m",
    isProcessor: false,
    legalRep: "Ing. Roberto Salgado Mora",
    user: { email: "pyme@demo-lopdp.ec", firstName: "Roberto", lastName: "Salgado" },
    assets: [
      { name: "Sistema de facturación y ventas", type: "application" },
      { name: "CRM de clientes", type: "application" },
      { name: "Servidor de la empresa", type: "physical", model: "Dell PowerEdge R350" },
      { name: "Laptop de gerencia", type: "physical", model: "HP EliteBook" },
      { name: "Computadores de bodega (5)", type: "physical", model: "Lenovo ThinkCentre" },
    ],
    licenses: [
      { name: "Microsoft 365", vendor: "Microsoft" },
      { name: "Sistema de nómina", vendor: "SmartNomina" },
    ],
    contracts: [
      { name: "Servicio contable externo", vendor: "Contadores Asociados", type: "servicio" },
      { name: "Plataforma de correo masivo", vendor: "Mailchimp", type: "marketing" },
    ],
    questionnaire: {
      hasBackups: true, hasAntivirus: true, hasDeviceLock: true, hasMfa: true,
      hasPrivacyPolicy: true, hasAccessControl: true,
      purposes: [
        { name: "Gestión de clientes y ventas", basis: "Ejecución de un contrato (art. 7.2)" },
        { name: "Gestión de nómina y talento humano", basis: "Obligación legal (art. 7.4)" },
        { name: "Comunicaciones comerciales", basis: "Consentimiento del titular (art. 7.1)" },
      ],
    },
    classify: {
      "Sistema de facturación y ventas": { categories: ["identificativos", "contacto", "financieros"], subjects: ["clientes"], count: ">10000", storage: "local" },
      "CRM de clientes": { categories: ["identificativos", "contacto"], subjects: ["clientes"], count: ">10000", storage: "nube_ext" },
      "Servidor de la empresa": { categories: ["identificativos", "laborales", "financieros"], subjects: ["empleados", "clientes"], count: ">10000", storage: "local" },
      "Laptop de gerencia": { categories: ["identificativos", "laborales"], subjects: ["empleados"], count: "<100", storage: "local" },
      "Computadores de bodega (5)": { categories: [], subjects: [], count: "<100", storage: "local" },
      "Microsoft 365": { categories: ["identificativos", "contacto"], subjects: ["empleados", "clientes"], count: "1000-10000", storage: "nube_ext" },
      "Sistema de nómina": { categories: ["identificativos", "laborales", "financieros"], subjects: ["empleados"], count: "<100", storage: "nube_ec" },
      "Servicio contable externo": { categories: ["identificativos", "laborales", "financieros"], subjects: ["empleados"], count: "<100", storage: "local", processor: true },
      "Plataforma de correo masivo": { categories: ["identificativos", "contacto"], subjects: ["clientes"], count: ">10000", storage: "nube_ext", processor: true },
    },
  },
];
