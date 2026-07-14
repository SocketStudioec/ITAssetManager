"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("C:/Users/USUARIO/Desktop/Claude/ITasset/ITAssetManager/node_modules/xlsx");

const SOCKET =
  "C:/Users/USUARIO/Downloads/SocketGasto aplicaciones.xlsx";
const BEGROUP_APPS =
  "C:/Users/USUARIO/Downloads/Pagos Aplicaciones - 2026.xlsx";
const BEGROUP_ASSETS =
  "C:/Users/USUARIO/Downloads/Activos Fijos BE.xlsx";
const OUTPUT =
  "C:/Users/USUARIO/AppData/Local/Temp/claude/C--Users-USUARIO-Desktop-Claude-ITasset/00ef40dd-7e3b-45c0-a805-d7cfab5ced4b/scratchpad/carga.json";

function money(v) {
  if (typeof v === "number") {
    return Number.isFinite(v) ? v : 0;
  }

  const cleaned = String(v == null ? "" : v)
    .trim()
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "+") {
    return 0;
  }

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function readSheet(wb, name) {
  const ws = wb.Sheets[name];

  if (!ws) {
    throw new Error(`No se encontró la hoja "${name}".`);
  }

  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  });
}

function norm(s) {
  return String(s || "").trim();
}

function loadSocketApps() {
  const workbook = XLSX.readFile(SOCKET);
  const rows = readSheet(workbook, "Hoja 1");
  const socketApps = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const name = norm(row[0]);

    if (!name) {
      continue;
    }

    const monto = money(row[1]);
    const tipo = norm(row[2]);
    const frecuencia = norm(row[3]);
    const diaPago = norm(row[4]);

    let billingCycle = "monthly";
    let monthlyCost = monto;
    let annualCost = 0;

    if (frecuencia.toLowerCase() === "anual") {
      billingCycle = "annual";
      monthlyCost = 0;
      annualCost = monto;
    } else if (
      frecuencia.toLowerCase() === "quincenal" ||
      frecuencia.toLowerCase() === "quincena-mensual"
    ) {
      billingCycle = "monthly";
      monthlyCost = monto * 2;
    } else if (frecuencia.toLowerCase() === "mensual") {
      billingCycle = "monthly";
      monthlyCost = monto;
    }

    const purpose = `Gasto ${tipo || "recurrente"} · Frecuencia ${
      frecuencia || "-"
    } · Día de pago ${diaPago || "-"}`;

    socketApps.push({
      kind: "subscription",
      name,
      provider: name,
      billingCycle,
      monthlyCost,
      annualCost,
      purpose,
      paymentMethod: "other",
      renewalType: "manual",
    });
  }

  return socketApps;
}

function loadBegroupApps() {
  const workbook = XLSX.readFile(BEGROUP_APPS);
  const rows = readSheet(workbook, "2026");
  const appsByName = new Map();
  let lastApp = "";
  let skippedCancelled = 0;

  for (let rowIndex = 6; rowIndex < rows.length; rowIndex += 1) {
    const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
    const appCell = norm(row[0]);

    if (appCell) {
      lastApp = appCell;
    }

    const grupo = appCell || lastApp;
    const detalle = norm(row[1]);

    if (!grupo && !detalle) {
      continue;
    }

    const estado = norm(row[18]);

    if (!estado.toLowerCase().startsWith("vigente")) {
      if (estado.toLowerCase().startsWith("cancelado")) {
        skippedCancelled += 1;
      }
      continue;
    }

    // El nombre real de la app es la columna "Aplicación" (grupo). El "Detalle"
    // suele ser el plan/variante o el recurso concreto (servidor/dominio) y es
    // lo que distingue líneas separadas del mismo grupo (varios VPS, hostings,
    // dominios). Por eso se conserva en el nombre cuando aporta información.
    const detalleDistinto =
      detalle && detalle.toLowerCase() !== (grupo || "").toLowerCase();
    const name = grupo
      ? detalleDistinto
        ? `${grupo} — ${detalle}`
        : grupo
      : detalle;
    const provider = grupo || detalle;

    // Valor por cargo: último importe no-cero recorriendo Dic→Ene. Para apps
    // anuales/semestrales/trimestrales el importe del ciclo aparece en un solo
    // mes; para mensuales es el valor mensual.
    let charge = 0;

    for (let monthColumn = 13; monthColumn >= 2; monthColumn -= 1) {
      const monthValue = money(row[monthColumn]);

      if (monthValue !== 0) {
        charge = monthValue;
        break;
      }
    }

    const frecuencia = norm(row[16]);
    let billingCycle = "monthly";

    if (/mensual/i.test(frecuencia)) {
      billingCycle = "monthly";
    } else if (/anual/i.test(frecuencia)) {
      billingCycle = "annual";
    } else if (/trimestr/i.test(frecuencia)) {
      billingCycle = "quarterly";
    } else if (/semestr/i.test(frecuencia)) {
      billingCycle = "semiannual";
    } else if (/ocasional|una vez/i.test(frecuencia)) {
      billingCycle = "one_time";
    }

    const metodo = norm(row[15]);
    let paymentMethod = "other";

    if (/transferenc/i.test(metodo)) {
      paymentMethod = "transfer";
    } else if (/efectivo|cash/i.test(metodo)) {
      paymentMethod = "cash";
    } else if (/tc|tarjeta|master|visa|virtual/i.test(metodo)) {
      paymentMethod = "card";
    }

    const cardName = paymentMethod === "card" ? metodo : "";
    const renovacion = norm(row[17]);
    const area = norm(row[19]);
    const categoria = norm(row[20]);
    const empleadoEn = norm(row[21]);

    const purpose = [
      detalle,
      area && `Área: ${area}`,
      categoria && `Categoría: ${categoria}`,
      empleadoEn && `Uso: ${empleadoEn}`,
    ]
      .filter(Boolean)
      .join(" · ");

    // Mensual: el cargo es el valor mensual. Otros ciclos: el cargo es el
    // importe del ciclo y se guarda en annualCost; el informe lo normaliza a
    // mensual según billingCycle (annual/12, semiannual/6, quarterly/3).
    const monthlyCost = billingCycle === "monthly" ? charge : 0;
    const annualCost = billingCycle === "monthly" ? 0 : charge;

    const app = {
      kind: "subscription",
      name,
      provider,
      billingCycle,
      monthlyCost,
      annualCost,
      purpose,
      paymentMethod,
      cardName,
      renewalType: "manual",
      area,
      categoria,
    };

    // Dedupe por grupo+detalle: conserva líneas realmente distintas (p. ej.
    // varios VPS del mismo grupo) y solo colapsa repeticiones idénticas.
    const dedupeKey = `${(grupo || "").toLowerCase()}||${detalle.toLowerCase()}`;
    const existing = appsByName.get(dedupeKey);

    if (!existing || app.monthlyCost > existing.monthlyCost) {
      appsByName.set(dedupeKey, app);
    }

    void renovacion;
  }

  return {
    begroupApps: Array.from(appsByName.values()),
    skippedCancelled,
  };
}

function inferAssetCategory(name) {
  const normalizedName = norm(name).toLowerCase();

  if (/pantalla|monitor|televisor|tv/i.test(normalizedName)) {
    return "Monitores y pantallas";
  }

  if (/laptop|portátil|portatil|mac/i.test(normalizedName)) {
    return "Equipos de cómputo";
  }

  if (/cpu|computador|servidor|pc|nas/i.test(normalizedName)) {
    return "Equipos de cómputo";
  }

  if (/cámara|camara|nvr|dvr/i.test(normalizedName)) {
    return "Cámaras de seguridad";
  }

  if (/teclado|mouse|audífono|audifono|webcam/i.test(normalizedName)) {
    return "Periféricos";
  }

  if (/ups|regulador|batería|bateria/i.test(normalizedName)) {
    return "Energía y UPS";
  }

  if (/aire|acondicionado/i.test(normalizedName)) {
    return "Climatización";
  }

  if (/impresora|escáner|escaner/i.test(normalizedName)) {
    return "Impresoras y escáneres";
  }

  return "Otros equipos";
}

function loadBegroupAssets() {
  const workbook = XLSX.readFile(BEGROUP_ASSETS);
  const locationMap = {
    Tics: "Oficina TIC's",
    DataCenter: "Data Center",
    Aula: "Aula",
    Gerencia: "Gerencia",
    Administracion: "Administración",
  };
  const begroupAssets = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = readSheet(workbook, sheetName);
    const location = locationMap[sheetName] || sheetName;
    let lastPersonal = "";

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
      const personalCell = norm(row[0]);

      if (personalCell) {
        lastPersonal = personalCell;
      }

      const personal = personalCell || lastPersonal;
      const nombre = norm(row[1]);
      const caracteristica = norm(row[2]);

      if (!nombre) {
        continue;
      }

      begroupAssets.push({
        name: nombre,
        description: caracteristica,
        location,
        assignedTo: personal,
        category: inferAssetCategory(nombre),
      });
    }
  }

  return begroupAssets;
}

function sumMonthlyCost(apps) {
  return apps.reduce((total, app) => total + money(app.monthlyCost), 0);
}

function printFirstEntries(title, entries) {
  console.log(`\n${title} — primeras ${Math.min(5, entries.length)} entradas:`);

  if (entries.length === 0) {
    console.log("  (sin entradas)");
    return;
  }

  entries.slice(0, 5).forEach((entry, index) => {
    console.log(`  ${index + 1}. ${JSON.stringify(entry, null, 2)}`);
  });
}

function main() {
  console.log("Iniciando ETL de aplicaciones y activos...");

  const socketApps = loadSocketApps();
  const { begroupApps, skippedCancelled } = loadBegroupApps();
  const begroupAssets = loadBegroupAssets();

  const outputData = {
    socketApps,
    begroupApps,
    begroupAssets,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(outputData, null, 2), "utf8");

  const socketMonthlyTotal = sumMonthlyCost(socketApps);
  const begroupMonthlyTotal = sumMonthlyCost(begroupApps);
  const assetsByLocation = begroupAssets.reduce((counts, asset) => {
    counts[asset.location] = (counts[asset.location] || 0) + 1;
    return counts;
  }, {});

  console.log("\n================ RESUMEN ETL ================");
  console.log(`Socket aplicaciones: ${socketApps.length}`);
  console.log(
    `BEGROUP aplicaciones vigentes: ${begroupApps.length} (${skippedCancelled} canceladas omitidas; ${
      begroupApps.length + skippedCancelled
    } total vigentes/canceladas)`
  );
  console.log(`BEGROUP activos: ${begroupAssets.length}`);
  console.log("\nActivos por ubicación:");

  for (const [location, count] of Object.entries(assetsByLocation)) {
    console.log(`  - ${location}: ${count}`);
  }

  console.log("\nTotales mensuales de aplicaciones:");
  console.log(`  - Socket: $${socketMonthlyTotal.toFixed(2)}`);
  console.log(`  - BEGROUP: $${begroupMonthlyTotal.toFixed(2)}`);

  printFirstEntries("Socket aplicaciones", socketApps);
  printFirstEntries("BEGROUP aplicaciones", begroupApps);
  printFirstEntries("BEGROUP activos", begroupAssets);

  console.log(`\nJSON escrito correctamente en:\n${OUTPUT}`);
}

try {
  main();
} catch (error) {
  console.error("\nError durante la ejecución del ETL:");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
}