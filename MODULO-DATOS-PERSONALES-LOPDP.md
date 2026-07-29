# Módulo Premium "Datos Personales (LOPDP)" — Análisis, Flujo e Instrucciones de Desarrollo

> **Documento de especificación para Opus 5.** Contiene: (1) análisis del material normativo del
> curso DPD, (2) el flujo funcional completo del módulo, (3) el modelo de scoring, (4) el modelo de
> datos y API, (5) los principios de neuroventa aplicados a la UI, y (6) el orden de implementación.
> Leer junto con [CLAUDE.md](CLAUDE.md) — sus reglas críticas aplican a todo lo que se construya aquí.
>
> Elaborado: 2026-07-28. Fuente normativa: material del curso de certificación DPD
> (LOPDP, RGLOPDP, Reglamento del DPD, Guía SPDP de Gestión de Riesgos e Impacto v1,
> ISO/IEC 27001/27002:2022, casos prácticos resueltos).

---

## 1. Resumen ejecutivo

TechAssets Pro ya sabe **qué activos tiene una empresa** (equipos, aplicaciones, licencias,
contratos). El módulo Datos Personales convierte ese inventario en un **sistema de cumplimiento
LOPDP automatizado**: clasifica qué datos personales viven en cada activo, corre la metodología
oficial de gestión de riesgos de la SPDP (5 etapas), entrega **dos calificaciones** (Riesgo y
Cumplimiento LOPDP), un **plan de acción priorizado** y **genera los documentos legales**
(política de privacidad, términos y condiciones, contratos de encargo, consentimientos, RAT,
protocolo de incidentes). Cada acción completada **sube la calificación en tiempo real** — ese es
el motor de enganche del producto.

- **Público objetivo**: pymes de servicios profesionales de Ecuador — contadores, médicos,
  odontólogos, abogados — y pymes generales. Todos son **responsables del tratamiento** bajo la
  LOPDP y la mayoría ni lo sabe.
- **Modelo comercial**: módulo **premium** (feature gate por empresa). El plan actual
  (pyme/professional) se mantiene; el módulo se activa con un flag adicional.
- **Dolor que ataca** (base legal real, usar en el copy): multas de **0.1 % a 1 % de la facturación
  anual** (arts. 80–83 LOPDP), obligación de notificar vulneraciones a la SPDP **en 72 horas**
  (art. 43), respuesta a requerimientos directos de titulares en **10 días término** (art. 62,
  verificado en el texto de la ley), y EIPDP obligatoria
  para tratamientos de alto riesgo como **datos de salud** (art. 42) — es decir, todo médico y
  odontólogo está en el segmento de máxima obligación.

---

## 2. Análisis del material normativo (qué dice y qué usamos)

### 2.1 Marco legal aplicable

| Norma | Qué regula | Qué usa el módulo |
|---|---|---|
| **LOPDP** (RO Sup. 459, 26/05/2021) | Ley marco: principios (art. 10), legitimidad del tratamiento (art. 7), consentimiento (art. 8), datos sensibles (art. 25), derechos ARCO-PL (arts. 12–22), encargados (art. 28), RAT (art. 37), seguridad (arts. 37–39), EIPDP (arts. 40–42), vulneraciones (arts. 43–46), DPD (arts. 47–49), sanciones (arts. 80–83) | Checklist de cumplimiento, generación de documentos, textos legales citados en informes |
| **RGLOPDP** (RO Sup. 435, 13/11/2023) | Desarrollo reglamentario: procedimientos de consulta EIPDP (arts. 31–34), registros, plazos | Detalle de procedimientos en el plan de acción |
| **Reglamento del DPD** (Res. SPDP-SPD-2025-0028-R) | Cuándo es obligatorio designar DPD, registro ante SPDP, funciones | Pregunta del cuestionario "¿debes designar DPD?" + acción del plan |
| **Guía SPDP de Gestión de Riesgos e Impacto v1** (Res. SPDP-SPD-2025-0003-R) | **La metodología oficial de 5 etapas** que el módulo automatiza | Motor de riesgos completo (ver 2.2) |
| **ISO/IEC 27001/27002:2022, 27701** | Taxonomía de controles técnicos y organizacionales | Catálogo de controles del plan de acción + declaración de aplicabilidad |

### 2.2 La metodología SPDP de 5 etapas (núcleo del motor de riesgos)

La Guía SPDP exige que la gestión de riesgos NO sea una lista de chequeo sino un proceso con
**rationales justificados** (todo valor de entrada debe tener un razonamiento documentado). Las 5
etapas, tal como las implementará el módulo:

1. **Establecimiento del contexto** — definir criterios de evaluación de impacto y probabilidad.
   Los 5 factores oficiales de impacto sobre derechos y libertades:
   (a) tratamiento de **categorías especiales/datos sensibles** (art. 25),
   (b) **grupos vulnerables** de titulares (menores, pacientes, adultos mayores — art. 40.2),
   (c) **cantidad de titulares** afectados,
   (d) **naturaleza de la infracción** (confidencialidad suele ser irreversible; integridad y
   disponibilidad son recuperables con backups),
   (e) **volumen de datos** por titular.
   La probabilidad SIEMPRE se estima en un lapso determinado (usamos 1 año).
2. **Identificación** — activos → tipos de datos → amenazas (comunidades: cibercriminales,
   empleados con/sin privilegios, el propio responsable cuando trata sin base legal; naturales:
   incendio, inundación) → vulnerabilidades en 3 planos: **jurídicas** (sin base legal, sin RAT,
   sin contratos de encargo, sin canal ARCO), **organizacionales** (sin políticas, sin
   capacitación, exceso de privilegios) y **técnicas** (sin cifrado, sin backups, software
   desactualizado) → **escenarios de riesgo** clasificados por dimensión C-I-D
   (confidencialidad / integridad / disponibilidad), cada dimensión en modelo independiente.
3. **Análisis** — cualitativo por defecto (escalas calibradas con rationale obligatorio);
   cuantitativo opcional para quien tenga datos: frecuencia anual λ, impacto con distribución
   triangular (mín, más probable, máx), **ALE = λ × E(impacto)** y VaR 90 % (el caso práctico del
   curso usa exactamente esto: ransomware λ=1.2, triangular 10k/25k/50k → ALE ≈ $34 000,
   VaR90 ≈ $65 000).
4. **Evaluación (EIPDP)** — comparar niveles vs. criterios; **matriz probabilidad × impacto con
   mapa de calor** solo como representación (no como cálculo: la guía advierte no combinar P×I a
   ciegas y mantener visibles ambas dimensiones + rationale). La EIPDP es obligatoria para alto
   riesgo (datos de salud, biométricos, menores, perfilamiento, transferencias internacionales) y
   la guía recomienda hacerla **por defecto** en todo tratamiento. Contenido mínimo de la EIPDP
   (checklist oficial de la guía): criterios, descripción de procesos, tipos de datos, activos de
   los que dependen los datos, escenarios, mecanismos ARCO, perfil de amenazas, vulnerabilidades
   en 3 planos, análisis P/I, calibración por grupos vulnerables, evaluación por escenario,
   medidas de tratamiento.
5. **Tratamiento** — 4 estrategias (aceptar / mitigar / transferir / evitar) + **declaración de
   aplicabilidad** estilo ISO 27701 mapeando cada control al artículo LOPDP que satisface, con
   responsable asignado. Controles en 3 categorías (prevención / detección / respuesta). Evitar
   condiciones frágiles (un solo control por escenario → exigir mínimo 2 en escenarios altos).
   Métrica de venta interna: **ROSI = (reducción de pérdida − costo del control) / costo**.

### 2.3 El plan de trabajo del curso (plantilla de fases del flujo)

El Excel "PLANIFICACIÓN DE PROTECCIÓN DE DATOS PERSONALES" del curso define los entregables
documentales por etapa, que el módulo replica como **artefactos generados automáticamente**:
diagnóstico inicial (formularios responsable/encargado), acta de responsables, acta de
tratamientos, criterios de evaluación (etapa 1); informes de activos, amenazas, vulnerabilidades
y escenarios (etapa 2); informe de criterios P/I e informe de escenarios simulados (etapa 3);
informe de evaluación de impacto (etapa 4); informes de estrategias, controles y riesgo residual
(etapa 5).

### 2.4 Sanciones y urgencias (combustible del copy)

- Infracciones **leves** (incumplir información mínima), **graves** (falta de seguridad, no
  respetar derechos ARCO, falta de base legal, sin contratos de encargo) y **muy graves** (datos
  sensibles sin consentimiento, ausencia de EIPDP, reidentificación deliberada).
- Multas **0.1 %–1 % de la facturación anual** + posible suspensión del tratamiento +
  responsabilidad civil.
- Deadlines legales duros: **72 h** para notificar vulneración a la SPDP, **15 días hábiles**
  para responder derechos ARCO-PL, revisión **semestral** del RAT, capacitación **anual**.

---

## 3. Avatares y ángulo comercial (neuroventa aplicada)

| Avatar | Datos que maneja | Riesgo dominante | Gancho de venta |
|---|---|---|---|
| **Contador / estudio contable** | Datos tributarios y financieros de clientes y de empleados de clientes (rol de **encargado**) | Confidencialidad fiscal; sin contratos de encargo con sus clientes | "Tus clientes te confían su información tributaria. ¿Tienes el contrato que la ley te exige para tratarla?" |
| **Médico / odontólogo / clínica** | Historias clínicas = **datos sensibles** (art. 25); pacientes = grupo vulnerable | EIPDP **obligatoria**; consentimiento explícito; infracción muy grave si hay fuga | "Una historia clínica filtrada es una infracción MUY GRAVE. Multa de hasta el 1 % de tu facturación anual." |
| **Abogado / estudio jurídico** | Expedientes, datos judiciales, secreto profesional | Confidencialidad irreversible; acceso indebido | "El secreto profesional ahora también es una obligación de seguridad de datos con multa." |
| **Pyme general** | Clientes, empleados, nómina, marketing | Base legal de comunicaciones; encargados tecnológicos sin contrato | "Tu base de clientes en Excel también está regulada. Descubre tu nivel de riesgo en 15 minutos." |

Principios de neuroventa que el módulo debe encarnar (no solo en la landing — en el producto):

1. **Reciprocidad**: el diagnóstico inicial y la calificación se entregan GRATIS (o en trial);
   el plan de acción detallado y los documentos legales son premium.
2. **Aversión a la pérdida**: la calificación inicial se presenta como exposición actual
   ("Tu empresa está en riesgo ALTO: multa potencial estimada $X"), no como nota académica.
3. **Compromiso y progreso**: cada acción completada sube la calificación visiblemente
   (barra de progreso + delta "+4 pts"). Micro-compromisos: clasificar 1 activo → ver 1 riesgo →
   generar 1 documento.
4. **Autoridad**: citar siempre el artículo LOPDP y la metodología oficial SPDP en cada
   recomendación ("Exigido por art. 28 LOPDP").
5. **Prueba social / advocacy**: sello "Empresa Protegida — Nivel A" descargable/compartible
   cuando la calificación supera 85 (con fecha de vigencia → renovación = retención).
6. **CTA específicos**: nunca "Continuar"; siempre "Ver mi nivel de riesgo ahora",
   "Generar mi política de privacidad", "Subir mi calificación a B".

---

## 4. Las dos calificaciones (motor de scoring)

Ambas se muestran juntas en el dashboard del módulo. Son deterministas, recalculables en
cualquier momento, y cada número es explicable (rationale visible — requisito de la guía SPDP).

### 4.1 Calificación de Riesgo (0–100, menos es mejor) → letra E…A

Mide la **exposición residual** agregada de los escenarios de riesgo activos.

```
Por cada escenario s (por activo × dimensión C/I/D):
  impacto_base(s)   = 1..5   según tipo de datos del activo (ver tabla)
  ajustes de impacto:
    +1 si hay datos sensibles (cap 5)
    +1 si hay grupos vulnerables (cap 5)
    +1 si titulares > 1000 (cap 5)
  probabilidad(s)   = 1..5   según vulnerabilidades presentes (plantilla sectorial,
                             ajustada por respuestas del cuestionario de controles)
  mitigacion(s)     = Σ reducción de los controles COMPLETADOS que aplican al escenario
                      (cada control define si reduce P, I o ambos, y cuánto: 0.5 o 1 punto)
  P_res = max(1, probabilidad − mitigación_P)
  I_res = max(1, impacto − mitigación_I)
  nivel(s) = celda de la matriz 5×5 (Bajo/Medio/Alto/Muy Alto) usando P_res e I_res

Score de riesgo = 100 × Σ peso(s) × norm(P_res × I_res) / Σ peso(s)
  peso(s): Muy Alto=4, Alto=3, Medio=2, Bajo=1 (los riesgos altos dominan el promedio)
  norm(x) = (x − 1) / 24        // P×I ∈ [1,25] → [0,1]

Letra: A ≤ 20 · B ≤ 40 · C ≤ 60 · D ≤ 80 · E > 80
```

Tabla de impacto base por tipo de datos (del activo con datos de mayor categoría):

| Tipo de datos en el activo | Impacto base |
|---|---|
| Solo datos identificativos/contacto | 2 |
| + datos laborales/académicos | 3 |
| + datos financieros/crediticios/tributarios | 4 |
| Datos sensibles (salud, biométricos, ideología, vida sexual, etnia) o de menores | 5 |

**Importante (regla de la guía)**: la matriz P×I es representación; en la UI cada escenario
muestra SIEMPRE su P y su I por separado con su rationale ("Probabilidad 4/5: sin backup
verificado y sin MFA — vulnerabilidades técnicas T-03, T-07"). Nunca ocultar las dimensiones
detrás del número compuesto.

### 4.2 Calificación de Cumplimiento LOPDP (0–100, más es mejor) → letra E…A

Mide la **madurez jurídico-organizacional** frente a las obligaciones de la ley. Checklist
ponderado; cada ítem se satisface con evidencia (documento generado + confirmación, o respuesta
verificada del cuestionario):

| Obligación | Base legal | Peso |
|---|---|---|
| Base legal identificada para cada tratamiento | art. 7 | 12 |
| Registro de Actividades de Tratamiento (RAT) generado y actualizado (< 6 meses) | art. 37 | 12 |
| Política de protección de datos / aviso de privacidad publicado | arts. 10, 11 | 10 |
| Consentimientos implementados donde la base legal es consentimiento | art. 8 | 10 |
| Contratos de encargo firmados con TODOS los encargados detectados | art. 28 | 12 |
| Procedimiento + canal ARCO-PL operativo (correo/formulario, responsable, plazo 10 días término — art. 62) | arts. 12–22, 62 | 10 |
| EIPDP realizada (solo si aplica alto riesgo; si no aplica, los 10 pts se redistribuyen pro rata) | arts. 40–42 | 10 |
| Protocolo de respuesta a vulneraciones (72 h) documentado | arts. 43–46 | 8 |
| Medidas técnicas mínimas confirmadas (cifrado, backups, control de accesos, MFA) | arts. 37–39 | 8 |
| DPD designado y registrado (solo si obligatorio; si no, pts redistribuidos) | arts. 47–49 | 4 |
| Capacitación del personal (< 12 meses) | art. 49 | 4 |

Letra: A ≥ 90 · B ≥ 75 · C ≥ 55 · D ≥ 35 · E < 35.

**Reglas anti-inflación**: un documento generado pero no marcado "publicado/firmado" da el 50 %
del puntaje del ítem. La UI lo dice explícito: "Generaste el contrato de encargo (+6). Márcalo
como firmado para ganar los otros +6."

### 4.3 Multa potencial estimada (número de impacto para neuroventa)

`multa_estimada = facturación_anual_declarada × (0.1 % si peor infracción detectada es leve,
0.5 % si grave, 1 % si muy grave)`. Se muestra como rango con disclaimer. Si el usuario no
declara facturación, usar rangos referenciales por tamaño de empresa. Este número es el ancla
emocional del diagnóstico ("aversión a la pérdida"), siempre con la cita legal (arts. 80–83).

---

## 5. Flujo funcional del módulo (7 fases)

### Fase 0 — Puerta premium y activación

- Nuevo grupo del sidebar: **"Datos personales"** (ya estaba planeado en CLAUDE.md), con badge
  "Premium". Para empresas sin el módulo: página de venta interna (paywall) con neurocopy:
  headline de pérdida ("¿Sabes cuánto te costaría una fuga de datos? La ley ya te obliga."),
  3 bullets de dolor con artículos, CTA "Descubrir mi nivel de riesgo ahora", y el diagnóstico
  exprés gratis como anzuelo de reciprocidad.
- Activación: columna/flag por empresa (`lopdp_enabled`), gestionable desde `/admin` por el
  super_admin (igual que hoy se cambian planes).

### Fase 1 — Ingesta y clasificación de activos (el diferencial del producto)

El módulo **no pide inventario: ya lo tiene**. Presenta la lista de activos existentes
(equipos físicos, aplicaciones, licencias, contratos de la empresa) y pide clasificar cada uno
con un mini-formulario de 5 preguntas (chips, no texto libre; < 30 s por activo):

1. ¿Este activo almacena o procesa datos personales? (Sí/No — si No, queda fuera y suma
   progreso igual)
2. ¿Qué categorías? (identificativos/contacto · laborales · financieros-tributarios ·
   salud/biométricos · menores de edad · otros sensibles)
3. ¿De quiénes? (clientes/pacientes · empleados · proveedores · terceros)
4. ¿Cuántos titulares aproximadamente? (<100 · 100–1 000 · 1 000–10 000 · >10 000)
5. ¿Dónde viven los datos? (solo local · nube Ecuador · nube extranjero → dispara pregunta de
   transferencia internacional)

Automatismos que reducen fricción (compromiso por micro-pasos):
- Pre-clasificación sugerida por heurística de nombre/tipo (ej.: activo "Sistema de historias
  clínicas" → sugerir salud/sensibles; una licencia "Microsoft 365" → nube extranjero). El
  usuario solo confirma o corrige.
- Los **contratos** con proveedores se marcan como posibles **encargados del tratamiento**
  (art. 28): "¿Este proveedor accede a datos personales por cuenta tuya?" → alimenta la lista de
  contratos de encargo pendientes.
- Barra de progreso "Activos clasificados 7/12" + score parcial visible desde el primer activo.

### Fase 2 — Perfil LOPDP de la empresa (cuestionario adaptativo)

Un wizard de ~20 preguntas, ramificado por **sector** (primera pregunta: contable · salud ·
legal · odontológico · otro). Bloques:

1. **Identidad del responsable**: razón social, RUC (ya están en `companies`), representante
   legal, actividad, nº de empleados, facturación anual aproximada (opcional, para la multa
   estimada).
2. **Tratamientos**: ¿para qué usa los datos? (facturación, historia clínica, nómina, marketing,
   contabilidad de terceros…) — cada finalidad seleccionada se convierte en una fila del RAT.
3. **Base legal por finalidad**: consentimiento / contrato / obligación legal / interés
   legítimo (con explicación en lenguaje simple de cada una).
4. **Estado actual de cumplimiento**: ¿tiene política de privacidad? ¿consentimientos firmados?
   ¿contratos con proveedores? ¿canal para que un cliente pida sus datos? ¿DPD designado?
   ¿capacitó al personal? ¿tuvo algún incidente?
5. **Controles técnicos**: backups (¿probados?), cifrado, MFA, antivirus, control de accesos por
   rol, equipos con clave, servidor propio o nube.
6. **Sector-específicas**: salud → ¿historias físicas o digitales?, ¿consentimiento informado
   incluye tratamiento de datos?; contable → ¿procesa datos por cuenta de clientes?
   (→ rol de encargado: genera el contrato espejo); legal → ¿expedientes digitalizados?, etc.

Cada respuesta lleva `rationale` implícito (queda guardada como evidencia del criterio — así el
informe cumple la exigencia de la guía SPDP de justificar todo valor de entrada).

### Fase 3 — Motor de riesgos (automático, las 5 etapas SPDP)

Con activos clasificados + perfil, el motor genera **escenarios de riesgo** cruzando:

```
escenario = activo con datos personales × dimensión (C, I, D) × plantilla sectorial
```

Plantillas sectoriales (seed data del sistema, editables): cada una define amenaza típica,
comunidad de amenaza, vector, vulnerabilidades que la habilitan y controles que la mitigan.
Ejemplos mínimos del seed (basados en los casos del curso):

| Escenario tipo | Dim. | Amenaza | Vulnerabilidades que suben P |
|---|---|---|---|
| Fuga de base de clientes/pacientes | C | Cibercriminal (phishing/troyano) | Sin MFA, sin capacitación, contraseñas débiles |
| Ransomware cifra sistemas | D | Cibercriminal | Sin backup probado, software desactualizado |
| Acceso indebido interno | C | Empleado con privilegios | Sin control de accesos por rol, sin logs |
| Pérdida/robo de equipo | C/D | Robo físico | Disco sin cifrar, sin clave |
| Error humano expone datos | C | Empleado sin capacitación | Sin políticas, sin capacitación |
| Tratamiento sin base legal | C | El propio responsable | Sin consentimientos, sin política publicada |
| Encargado sin contrato filtra datos | C | Proveedor tecnológico | Contratos sin cláusulas art. 28 |
| Incendio/desastre destruye archivo físico | D | Amenaza natural | Sin digitalización, sin copia |

Cada escenario se instancia con P (1–5) e I (1–5) calculados según §4.1, con su rationale
autogenerado (qué vulnerabilidades y qué características de los datos justifican cada valor).
El usuario experto puede sobreescribir P/I manualmente (guardando su propio rationale) — así el
módulo sirve también a DPDs profesionales (como Kevin) que quieran calibrar.

Opcional (pestaña "Análisis cuantitativo", para usuarios avanzados): por escenario, ingresar
λ (frecuencia/año) y triangular (mín, probable, máx) → el sistema calcula ALE y VaR90
(Monte Carlo simple de 10 000 iteraciones en el backend, o aproximación por percentil de la
triangular — suficiente y sin dependencias).

### Fase 4 — Diagnóstico y calificaciones iniciales (el "momento espejo")

Pantalla de resultados con jerarquía neuro (primero la emoción, después el detalle):

1. **Las dos letras grandes** (Riesgo y Cumplimiento) con color semáforo + multa potencial
   estimada.
2. **Top 5 riesgos** (tarjetas: escenario, P/I visibles, rationale, artículo LOPDP violado).
3. **Mapa de calor 5×5** (representación, clic en celda → escenarios).
4. **Gap analysis LOPDP**: la checklist de §4.2 en rojo/amarillo/verde.
5. CTA único y grande: **"Ver mi plan de acción → subir a calificación B"**.
6. Botón secundario: descargar **Informe de Diagnóstico** (PDF; ver §7 documentos).

### Fase 5 — Plan de acción priorizado (el loop de retención)

Lista de acciones ordenada por `impacto_en_score / esfuerzo`, en 3 carriles (jurídicas ·
organizacionales · técnicas), cada una con:

- Qué hacer, por qué (artículo LOPDP + escenario que mitiga), esfuerzo estimado
  (minutos/horas/días), **cuántos puntos suma** ("+6 Cumplimiento, −4 Riesgo"),
- Tipo de resolución: **[Generar documento]** (va a Fase 6) · **[Marcar implementado]**
  (con fecha y responsable — queda en activity_log) · **[No aplica]** (con justificación,
  requerida — rationale).
- Deadline sugerido cuando hay plazo legal (RAT semestral, capacitación anual).

Al completar cualquier acción: recálculo inmediato de ambos scores + animación del delta +
siguiente acción sugerida (compromiso encadenado). Hito visual al cruzar cada letra
("🎉 Subiste a C. La mayoría de pymes ecuatorianas está en D o E." — prueba social).

### Fase 6 — Generación de documentos legales

Catálogo de documentos (plantillas parametrizadas por sector, rellenadas con datos reales de la
empresa + activos + respuestas del wizard; redacción final vía el helper de IA ya existente en
la app):

| Documento | Base legal | Variables clave |
|---|---|---|
| **Política de protección de datos / aviso de privacidad** (web + interna) | arts. 10, 11 | Finalidades, bases legales, plazos de conservación, canal ARCO |
| **Términos y condiciones** (sitio/app del cliente) | — | Servicios, responsabilidades, remisión a política |
| **Contrato de encargo de tratamiento** (responsable → proveedor) | art. 28 | Encargado (desde contratos detectados), finalidades, medidas exigidas, prohibición de subencargo sin permiso, auditoría |
| **Contrato/anexo como encargado** (el usuario ES encargado: contadores) | art. 28 | Cliente responsable, instrucciones documentadas |
| **Formulario de consentimiento** (genérico + informado de salud) | arts. 8, 25 | Finalidad específica, revocabilidad, datos sensibles |
| **RAT — Registro de Actividades de Tratamiento** | art. 37 | Generado 100 % desde datos: una fila por finalidad × categoría × activos que la soportan |
| **Procedimiento de atención de derechos ARCO-PL** + plantillas de respuesta | arts. 12–22, 62 | Canal, responsable, plazo 10 días término |
| **Protocolo de respuesta a vulneraciones** + plantilla de notificación a SPDP (72 h) y a titulares | arts. 43–46 | Contactos, criterios de gravedad |
| **Informe EIPDP** (si aplica alto riesgo) | arts. 40–42 | Contenido oficial de la guía (checklist §2.2.4) |
| **Declaración de aplicabilidad** (controles ↔ art. LOPDP ↔ responsable) | Guía SPDP | Desde el plan de acción |
| **Informe de Diagnóstico** y **Informe de Gestión de Riesgos** (PDF ejecutivo) | Guía SPDP | Scores, mapa de calor, escenarios, rationales |

Reglas de generación:
- Flujo: elegir documento → previsualizar con variables resaltadas → editar en la app (rich
  text simple) → marcar estado (`borrador` → `generado` → `publicado/firmado`) → descargar
  (PDF/DOCX). El estado alimenta el score (§4.2).
- Versionado: cada regeneración crea versión nueva; las anteriores quedan en histórico.
- **Disclaimer obligatorio en cada documento y en la UI de esta fase**: "Documento generado como
  plantilla de apoyo al cumplimiento. No constituye asesoría legal; revísalo con un profesional
  del derecho antes de firmarlo/publicarlo." (Esto es innegociable — riesgo reputacional y
  legal del producto.)

### Fase 7 — Monitoreo continuo (por qué renuevan la suscripción)

- **Recordatorios legales** integrados al sistema de vencimientos existente (`/expirations` +
  emails): revisión semestral del RAT, capacitación anual, revisión anual de contratos de
  encargo, vigencia del sello.
- **Deriva del score**: si el RAT supera 6 meses sin revisión, el ítem baja a 50 % y el score
  cae → notificación "Tu calificación bajó a B−. Revisa tu RAT (15 min) para recuperarla."
  (aversión a la pérdida como motor de re-engagement).
- **Nuevo activo creado** → aparece como "sin clasificar" y descuenta progreso hasta
  clasificarse (hook en el CRUD de assets).
- **Registro de incidentes**: mini-formulario de vulneración con cronómetro de 72 h visible,
  guía paso a paso (contención → evaluación → notificación SPDP → titulares → informe final) y
  generación de la notificación.
- **Sello "Empresa Protegida"** (badge PNG/enlace verificable con nivel y fecha) al alcanzar
  A/B en Cumplimiento — advocacy: el cliente lo pone en su web/consultorio y hace marketing
  del producto.

---

## 6. Diseño técnico

### 6.1 Modelo de datos (nuevas tablas — añadir a `schema.sql`, snake_case, con `GRANT ... TO techassets_user`)

```sql
-- Perfil LOPDP de la empresa (1:1 companies)
dp_company_profile (
  id, company_id UNIQUE NOT NULL,          -- aislamiento multi-tenant SIEMPRE
  sector,                                   -- 'contable'|'salud'|'odontologia'|'legal'|'otro'
  legal_rep_name, employee_count, annual_revenue_range,
  questionnaire JSONB NOT NULL DEFAULT '{}',-- respuestas del wizard (versionado por key)
  is_processor BOOLEAN DEFAULT false,       -- ¿actúa como encargado? (contadores)
  wizard_completed_at, created_at, updated_at
)

-- Clasificación de datos por activo (1:1 assets; también aplica a licencias vía license_id)
dp_asset_classification (
  id, company_id NOT NULL, asset_id NULL, license_id NULL, contract_id NULL,
  has_personal_data BOOLEAN NOT NULL,
  data_categories TEXT[] NOT NULL DEFAULT '{}',  -- 'identificativos','financieros','salud',...
  data_subjects TEXT[] NOT NULL DEFAULT '{}',    -- 'clientes','empleados',...
  subject_count_range,                            -- '<100'|'100-1000'|'1000-10000'|'>10000'
  storage_location,                               -- 'local'|'nube_ec'|'nube_ext'
  is_processor_asset BOOLEAN DEFAULT false,       -- proveedor = encargado (contratos)
  classified_by, classified_at, created_at, updated_at
)

-- Plantillas de escenarios (seed global, sector-aware; company_id NULL = plantilla del sistema)
dp_scenario_template (
  id, company_id NULL, sector NULL, name, dimension,            -- 'C'|'I'|'D'
  threat_community, threat_description, attack_vector,
  vulnerability_keys TEXT[] NOT NULL,      -- claves que suben P si están presentes
  control_keys TEXT[] NOT NULL             -- claves de controles que mitigan
)

-- Escenarios instanciados por empresa
dp_risk_scenario (
  id, company_id NOT NULL, template_id, classification_id,
  probability SMALLINT NOT NULL, impact SMALLINT NOT NULL,       -- 1..5 calculados
  probability_override SMALLINT NULL, impact_override SMALLINT NULL,
  rationale TEXT NOT NULL,                 -- autogenerado; editable
  override_rationale TEXT NULL,
  residual_probability SMALLINT, residual_impact SMALLINT,       -- tras controles completados
  level,                                    -- 'bajo'|'medio'|'alto'|'muy_alto' (residual)
  ale NUMERIC NULL, var90 NUMERIC NULL,     -- análisis cuantitativo opcional
  status DEFAULT 'open',                    -- 'open'|'accepted'|'transferred'|'avoided'
  created_at, updated_at
)

-- Fotos del score (histórico para la gráfica de evolución)
dp_assessment (
  id, company_id NOT NULL,
  risk_score NUMERIC NOT NULL, risk_grade,             -- 'A'..'E'
  compliance_score NUMERIC NOT NULL, compliance_grade,
  estimated_fine_min NUMERIC, estimated_fine_max NUMERIC,
  breakdown JSONB NOT NULL,               -- detalle por ítem/escenario para explicar el número
  trigger,                                 -- 'wizard'|'action_completed'|'scheduled'|'manual'
  created_at
)

-- Plan de acción
dp_action_item (
  id, company_id NOT NULL, scenario_id NULL,
  category,                                -- 'juridica'|'organizacional'|'tecnica'
  control_key, title, description, legal_basis,       -- 'art_28_lopdp'
  effort,                                  -- 'minutos'|'horas'|'dias'
  compliance_points NUMERIC, risk_reduction JSONB,    -- {p:-1} | {i:-1} ...
  status DEFAULT 'pending',                -- 'pending'|'in_progress'|'done'|'not_applicable'
  resolution_type NULL,                    -- 'document'|'implemented'|'na'
  document_id NULL, na_rationale NULL,
  due_date NULL, assigned_to NULL, completed_at NULL, created_at, updated_at
)

-- Documentos generados
dp_document (
  id, company_id NOT NULL, doc_type NOT NULL,   -- 'privacy_policy'|'tyc'|'dpa'|'dpa_processor'|
                                                -- 'consent'|'consent_health'|'rat'|'arco'|
                                                -- 'breach_protocol'|'eipdp'|'soa'|'diagnostico'|'riesgos'
  title, version INT NOT NULL DEFAULT 1,
  content TEXT NOT NULL,                        -- markdown/HTML editado
  variables JSONB,                              -- snapshot de variables usadas
  status DEFAULT 'draft',                       -- 'draft'|'generated'|'published'
  generated_by_ai BOOLEAN DEFAULT true,
  created_at, updated_at
)

-- Incidentes / vulneraciones
dp_incident (
  id, company_id NOT NULL, title, description,
  detected_at NOT NULL, dimensions TEXT[],      -- C/I/D afectadas
  data_categories TEXT[], subject_count_estimate,
  severity, status DEFAULT 'contention',        -- 'contention'|'assessment'|'notified_spdp'|
                                                -- 'notified_subjects'|'closed'
  spdp_deadline TIMESTAMPTZ,                    -- detected_at + 72h (mostrar cronómetro)
  spdp_notified_at NULL, subjects_notified_at NULL,
  final_report_document_id NULL, created_at, updated_at
)
```

Feature gate: `ALTER TABLE companies ADD COLUMN lopdp_enabled BOOLEAN DEFAULT false;`
(+ opcional `lopdp_activated_at`). Toda tabla nueva lleva índice por `company_id` y GRANT.

### 6.2 API (patrón existente: rutas en `server/routes.ts`, datos en `server/storage.ts` con `mapRowsToCamel`, validación Zod en `shared/schema.ts`)

```
GET    /api/dp/:companyId/status                  -- gate + progreso de fases (drive del wizard)
GET/PUT /api/dp/:companyId/profile                -- perfil + cuestionario
GET    /api/dp/:companyId/classifications         -- activos con/sin clasificar (join assets)
PUT    /api/dp/:companyId/classifications/:id     -- clasificar activo
POST   /api/dp/:companyId/engine/run              -- (re)generar escenarios + assessment
GET    /api/dp/:companyId/scenarios               -- lista con P/I/rationale/nivel
PUT    /api/dp/:companyId/scenarios/:id           -- override P/I (exige rationale)
GET    /api/dp/:companyId/assessment              -- scores actuales + breakdown
GET    /api/dp/:companyId/assessment/history      -- evolución (gráfica)
GET    /api/dp/:companyId/actions                 -- plan priorizado
PUT    /api/dp/:companyId/actions/:id             -- completar / no-aplica / asignar
GET    /api/dp/:companyId/documents               -- catálogo + estados
POST   /api/dp/:companyId/documents               -- generar (tipo + IA)
PUT    /api/dp/:companyId/documents/:id           -- editar / cambiar estado / nueva versión
GET    /api/dp/:companyId/documents/:id/download  -- PDF/DOCX
POST   /api/dp/:companyId/incidents               -- registrar vulneración (arranca 72h)
PUT    /api/dp/:companyId/incidents/:id           -- avanzar protocolo
```

Middleware: todas exigen `isAuthenticated` + pertenencia a la empresa + `lopdp_enabled`
(excepto `GET status`, que responde `{enabled:false}` para pintar el paywall). Toda escritura
registra en `activity_log` (obligatorio `companyId`). El recálculo de score corre tras cada
mutación relevante y guarda `dp_assessment` **solo si cambió** el valor (no llenar la tabla).

### 6.3 Generación con IA

Reutilizar el helper de IA existente de la app (proveedor configurable por env, hoy OpenAI).
Patrón: plantilla base por `doc_type` + sector (archivos en `server/dp/templates/`) → prompt con
variables estructuradas (empresa, finalidades, activos, bases legales) → el modelo redacta
solo las secciones variables, NUNCA los artículos citados (van hardcodeados en la plantilla
para evitar alucinación normativa). Validar longitud y presencia del disclaimer antes de
guardar. Fallback sin IA: la plantilla se rellena con merge simple de variables (el módulo
nunca se bloquea si el proveedor de IA falla).

### 6.4 Frontend (client/src)

- Sidebar: grupo **"Datos personales"** con ítems: Panel LOPDP (`/lopdp`), Clasificación
  (`/lopdp/clasificacion`), Riesgos (`/lopdp/riesgos`), Plan de acción (`/lopdp/plan`),
  Documentos (`/lopdp/documentos`), Incidentes (`/lopdp/incidentes`). Badge "Premium" si
  `!lopdp_enabled`.
- Páginas nuevas en `pages/lopdp/`; componentes del wizard en `components/lopdp/`.
- Reusar shadcn/ui existente; tablas > tarjetas (preferencia de Kevin) salvo el dashboard de
  scores; gráfica de evolución con Recharts (line) y mapa de calor con grid CSS simple (no
  meter librería nueva).
- Tipar los `useQuery` de las páginas nuevas (no repetir la deuda técnica).

---

## 7. Instrucciones de implementación para Opus 5

**Antes de escribir código**: leer [CLAUDE.md](CLAUDE.md) completo. Reglas que más aplican
aquí: nunca `import.meta.dirname`; migración SQL con GRANT a `techassets_user`; todo SELECT por
`mapRowsToCamel`; todo filtrado por `companyId`; `npm run build` + arranque de `dist/index.js`
verificados antes de entregar; migración se aplica manualmente en psql (no drizzle).

Implementar en **6 entregas verificables** (cada una debe compilar, arrancar y ser usable; la
entrega 6 "Modo Defensa" está detallada en §8.6):

1. **Cimientos** — migración `004_lopdp.sql` (todas las tablas de §6.1 + flag + GRANTs + índices),
   tipos y Zod en `shared/schema.ts`, storage + rutas de profile/status/classifications, gate
   premium en `/admin`, sidebar con grupo nuevo y paywall. *Criterio de aceptación: una empresa
   activada puede completar el perfil y clasificar activos; una no activada ve el paywall.*
2. **Motor de riesgos** — seed de `dp_scenario_template` (mínimo las 8 filas de §5-Fase 3 × las
   variantes sectoriales), `engine/run` que instancia escenarios y calcula P/I/rationale y el
   assessment (§4), páginas Riesgos + Panel con las dos letras, mapa de calor, top riesgos y
   multa estimada. *Aceptación: clasificar activos y correr el motor produce scores explicables
   y reproducibles (misma entrada → mismo score).*
3. **Plan de acción** — generación de acciones desde los gaps (checklist §4.2 + controles de los
   escenarios), página Plan con carriles, completar/no-aplica, recálculo en vivo con delta
   animado, hitos por letra. *Aceptación: completar una acción sube el score y queda en
   activity_log y en dp_assessment.history.*
4. **Documentos** — plantillas por tipo y sector, generación con el helper IA + fallback,
   editor, versionado, estados, descarga PDF (server-side, sin dependencia pesada nueva si es
   posible), RAT autogenerado desde datos, disclaimer en todo. *Aceptación: generar política de
   privacidad + contrato de encargo + RAT con datos reales de la empresa; marcar publicado
   afecta el score.*
5. **Monitoreo** — incidentes con cronómetro 72 h, integración con vencimientos/emails
   existentes (revisión RAT semestral, capacitación anual), hook "activo nuevo sin clasificar",
   deriva del score, sello Empresa Protegida, **solicitudes de titulares con cronómetro de
   10 días término y vista de trazabilidad** (§8.1, §8.3). *Aceptación: crear un activo nuevo
   baja el progreso; un incidente muestra la cuenta regresiva y genera la notificación SPDP;
   una solicitud de titular calcula su vencimiento en días hábiles.*
6. **Modo Defensa** — procedimientos SPDP, medidas correctivas como acciones con deadline duro,
   Expediente de Cumplimiento (paquete con índice y faltantes), borrador de descargos,
   Certificado de Cumplimiento e informe de trazabilidad (§8.2, §8.4, §8.5). *Aceptación: la de
   §8.6.*

Reglas de producto no negociables:
- **Disclaimer legal** en todos los documentos y en la fase de generación (§5-Fase 6).
- **Rationales visibles**: nunca mostrar un score o nivel sin su explicación (requisito de la
  guía SPDP y diferencial frente a "checklists mágicas").
- **Español ecuatoriano** en toda la UI, citando artículos LOPDP correctamente.
- Copy con neuroventa (§3): CTAs específicos, pérdida antes que ganancia, progreso visible.
  El texto exacto de headlines/CTAs del paywall y del diagnóstico está en §3 y §5 — usarlos
  como base, no inventar copy genérico ("Enviar", "Continuar" prohibidos).
- No romper nada existente: `/subscriptions`, vencimientos, notificaciones y el CRUD de activos
  siguen funcionando igual; el hook de clasificación es aditivo.

---

## 8. Flujos reactivos: "Modo Defensa" (denuncias, SPDP, trazabilidad y certificación)

Todo lo anterior es cumplimiento *proactivo*. Esta sección cubre el momento en que el cliente
más necesita el producto (y donde la neuroventa es más honesta): **cuando alguien reclama o la
autoridad toca la puerta**. El argumento central del módulo: *"Si te denuncian hoy, ¿qué
entregas? Con TechAssets Pro, un botón."*

### 8.1 Flujo: un titular me reclama directamente (art. 62 LOPDP)

Base legal: el titular puede presentar requerimientos, peticiones, quejas o reclamaciones
**directamente al responsable**, gratis, por medio físico o digital; el responsable tiene
**10 días término** para contestar (afirmativa o negativamente), notificar y ejecutar. Si no
contesta o niega, el titular puede escalar a **reclamo administrativo ante la SPDP** (art. 64)
y además ejercer acciones civiles, penales o constitucionales.

Flujo en el módulo (página **Solicitudes de titulares** dentro del grupo Datos personales):

1. **Registro de la solicitud**: formulario rápido (titular, canal de entrada, fecha, tipo:
   acceso · rectificación · eliminación · oposición · portabilidad · limitación · queja ·
   revocatoria de consentimiento). Al guardar arranca el **cronómetro de 10 días término**
   (visible como cuenta regresiva, igual que el de 72 h de incidentes; días término = días
   hábiles, calcular excluyendo fines de semana y feriados nacionales de Ecuador — tabla de
   feriados en seed, editable).
2. **Localización automática de los datos** (usa la trazabilidad de §8.3): el sistema lista en
   qué activos clasificados viven datos de esa categoría de titular, qué encargados los tocan
   y qué finalidades aplican — el operador marca dónde efectivamente están los datos del
   solicitante.
3. **Respuesta asistida**: plantilla de respuesta por tipo de solicitud (generada con el helper
   IA + variables del caso), con la motivación legal correcta tanto para conceder como para
   negar (una negativa sin motivación = infracción leve art. 67.1).
4. **Ejecución y evidencia**: checklist de ejecución (ej. eliminación → en qué activos se
   borró, quién, cuándo; rectificación → valor anterior/nuevo) y carga de evidencia (archivo o
   nota). Todo queda en el expediente del caso.
5. **Cierre**: estado final (concedida / negada motivada / parcial), fecha de notificación al
   titular. Si el cronómetro vence sin cierre → alerta roja + email (el riesgo ya no es
   abstracto: es la antesala de una denuncia).

KPI del panel: "Solicitudes atendidas a tiempo: 100 %" — es la primera línea de defensa ante
cualquier procedimiento (demuestra el art. 62 cumplido) y alimenta el ítem ARCO del score.

### 8.2 Flujo: me denunciaron / la SPDP me abre un procedimiento (arts. 63–66 LOPDP)

Cómo funciona el proceso real (esto va explicado en la UI en lenguaje simple, es parte del
valor — el usuario promedio no lo sabe):

1. **Actuaciones previas** (art. 63): la SPDP, de oficio o a petición del titular, investiga
   las circunstancias antes de decidir si abre procedimiento (conforme al COA).
2. **Medidas correctivas** (arts. 65–66): la SPDP puede ordenar cese del tratamiento,
   eliminación de datos, o imposición de medidas técnicas/jurídicas/organizativas. Reglas
   clave que definen la estrategia de defensa:
   - Infracción **leve** + estar en el **Registro Único de incumplidos** → procedimiento
     sancionatorio directo (medidas + sanción en la misma resolución).
   - Infracción **grave** → *primero* medidas correctivas; la sanción llega solo si se cumplen
     tarde, parcial o defectuosamente. **Cumplir medidas correctivas bien y a tiempo evita la
     multa** — este es el mensaje de oro para el usuario.
   - Infracción **muy grave** → sancionatorio directo.
3. **Procedimiento sancionatorio**: per COA (término de prueba, descargos, resolución).

Flujo en el módulo (página **Procedimientos SPDP**):

1. **Registro del procedimiento**: tipo (actuación previa · requerimiento de información ·
   medida correctiva · sancionatorio), nº de expediente, fecha de notificación, plazo otorgado
   → cronómetro por plazo.
2. **Generación del Expediente de Cumplimiento** (un clic — el corazón del Modo Defensa):
   paquete ZIP/PDF con todo lo que la SPDP tipicamente exige, ver §8.4.
3. **Gestión de medidas correctivas**: cada medida ordenada se registra y se convierte en
   acciones del plan (§5-Fase 5) con deadline duro y evidencia de cumplimiento adjunta; al
   cerrar todas, generar el **Informe de cumplimiento de medidas correctivas** para presentar
   a la SPDP (recordar: cumplimiento tardío/parcial/defectuoso activa la sanción — el módulo
   debe gritar estos deadlines por email y campana).
4. **Borrador de descargos**: documento asistido por IA que arma la narrativa de defensa desde
   la evidencia real del sistema: fecha de cada documento generado/publicado, histórico de
   scores (mejora demostrable), acciones completadas con fechas y responsables, solicitudes de
   titulares atendidas a tiempo, capacitaciones. La **responsabilidad demostrable** (principio
   del art. 10 y de la Guía SPDP) se demuestra con trazabilidad fechada — que es exactamente
   lo que `activity_log` + `dp_assessment` + versiones de documentos ya guardan.

### 8.3 Flujo: trazabilidad de datos ("¿dónde están los datos de X y quién los tocó?")

La trazabilidad es transversal: alimenta las solicitudes de titulares (§8.1), el expediente
(§8.2) y el RAT. El módulo la construye con lo que ya existe — no requiere instrumentar los
sistemas del cliente, sino trazar el *gobierno* de los datos:

- **Mapa de flujo de datos** (vista + informe descargable): grafo
  `finalidad → categorías de datos → activos donde viven → ubicación (local/nube EC/nube ext)
  → encargados con acceso (contratos) → plazo de conservación → destino final (eliminación/
  anonimización)`. Se dibuja automáticamente desde `dp_asset_classification` +
  `dp_company_profile.questionnaire` + contratos marcados como encargados. Render simple:
  columnas conectadas (CSS/SVG propio, sin librería de grafos).
- **Línea de tiempo por entidad**: para cada activo/documento/solicitud, el histórico completo
  desde `activity_log` (quién clasificó, quién generó qué versión, quién completó qué acción,
  con timestamps). Ya se registra todo — falta solo la vista filtrada.
- **Informe de trazabilidad** (`doc_type = 'trazabilidad'`): documento generado que responde
  formalmente "para la categoría de titular T: qué datos se tratan, con qué base legal, en qué
  activos, quién accede, cuánto se conservan, a quién se transfieren, y el registro de eventos
  del período". Es la respuesta directa a un requerimiento de la SPDP o de un titular
  (derecho de acceso, art. 62) — y el anexo técnico natural del RAT.
- **Requisito de captura**: para que la trazabilidad sea completa, TODAS las mutaciones del
  módulo dp_* deben pasar por `storage.logActivity()` con `entityType` específico
  (`dp_classification`, `dp_document`, `dp_action`, `dp_titular_request`, `dp_incident`,
  `dp_procedure`) — regla de implementación obligatoria para Opus 5.

### 8.4 Flujo: la SPDP me pide información — el "Paquete SPDP" (un clic)

Qué pide típicamente la autoridad en actuaciones previas o inspección (síntesis del material
del curso + potestades de los arts. 63–66 y obligaciones de la LOPDP). El botón **"Generar
Expediente de Cumplimiento"** exporta, con índice y fechas de vigencia:

| # | Contenido | De dónde sale |
|---|---|---|
| 1 | Identificación del responsable (RUC, representante, DPD si aplica) | `companies` + perfil |
| 2 | **RAT vigente** (art. 37) | Documento RAT (última versión publicada) |
| 3 | Política de protección de datos y avisos de privacidad | dp_document |
| 4 | Bases legales por tratamiento + formularios de consentimiento | Perfil + dp_document |
| 5 | **Contratos de encargo** con cada proveedor (art. 28) | dp_document + contratos vinculados |
| 6 | Informe de gestión de riesgos + EIPDP (metodología: exigida por art. 68.4 — no usar una es infracción GRAVE) | dp_assessment + dp_risk_scenario + doc EIPDP |
| 7 | Declaración de aplicabilidad (medidas técnicas/organizativas implementadas) | Plan de acción completado |
| 8 | Registro de solicitudes de titulares y tiempos de respuesta | dp_titular_request |
| 9 | Registro de incidentes y notificaciones (72 h) | dp_incident |
| 10 | Evidencia de capacitación del personal | Acción del plan + evidencia adjunta |
| 11 | Histórico de calificaciones (mejora demostrable en el tiempo) | dp_assessment |
| 12 | Bitácora de trazabilidad del período solicitado | activity_log filtrado |

Los ítems que falten aparecen en el índice como "NO DISPONIBLE" en rojo — dentro de la app esto
es a la vez el gap analysis y el empujón de venta ("tu expediente está incompleto: 4 documentos
faltantes"). Nunca inventar contenido para huecos: un expediente con huecos honestos + plan de
remediación es defendible; uno inflado es un fraude.

### 8.5 Flujo: certificación de datos (arts. 52–54 LOPDP)

La LOPDP distingue dos niveles — el módulo ofrece ambos sin confundirlos:

1. **Certificado de Cumplimiento TechAssets** (autodeclarativo, incluido): PDF verificable con
   las dos calificaciones, desglose por obligación, fecha de evaluación y vigencia de 6 meses
   (ligada a la revisión del RAT). Texto obligatorio: *"Evaluación autodeclarativa basada en la
   metodología de la Guía SPDP. No constituye certificación oficial en los términos del
   art. 54 LOPDP."* Es el mismo motor del sello "Empresa Protegida" (§5-Fase 7) en formato
   documento formal — sirve para licitaciones, clientes corporativos y bancos que ya piden
   evidencia LOPDP a sus proveedores.
2. **Kit de certificación oficial** (premium, diferido a v1.1): la LOPDP prevé **Entidades de
   Certificación** que emiten certificaciones de cumplimiento y **sellos de protección de
   datos** (art. 54), y la adhesión voluntaria a códigos de conducta (art. 52). El kit = el
   Expediente de Cumplimiento (§8.4) + checklist de requisitos de la entidad certificadora →
   el cliente llega a la auditoría de certificación con todo listo. (Cuando la SPDP acredite
   entidades y publique requisitos, se parametrizan aquí — dejar la estructura preparada.)

### 8.6 Impacto en el diseño técnico (delta sobre §6)

Tablas nuevas (mismas convenciones de §6.1):

```sql
-- Solicitudes de titulares (ARCO-PL + quejas, art. 62)
dp_titular_request (
  id, company_id NOT NULL, request_type NOT NULL,   -- 'acceso'|'rectificacion'|'eliminacion'|
                                                    -- 'oposicion'|'portabilidad'|'limitacion'|
                                                    -- 'queja'|'revocatoria'
  titular_name, titular_contact, channel, received_at NOT NULL,
  due_date NOT NULL,                                -- +10 días término (hábiles, feriados EC)
  affected_asset_ids TEXT[], response_document_id NULL,
  status DEFAULT 'open',                            -- 'open'|'in_progress'|'answered'|
                                                    -- 'executed'|'denied'|'expired'
  resolution, resolution_rationale, evidence JSONB, -- [{name,url|note,date}]
  answered_at NULL, created_at, updated_at
)

-- Procedimientos ante la SPDP (actuaciones previas, medidas correctivas, sancionatorios)
dp_authority_procedure (
  id, company_id NOT NULL, procedure_type NOT NULL, -- 'actuacion_previa'|'requerimiento_info'|
                                                    -- 'medida_correctiva'|'sancionatorio'
  file_number, notified_at NOT NULL, deadline NULL,
  description, status DEFAULT 'open',               -- 'open'|'responding'|'closed'
  outcome NULL, related_request_id NULL,            -- si nació de una solicitud vencida
  created_at, updated_at
)
-- Las medidas correctivas ordenadas se materializan como dp_action_item con
-- procedure_id (FK nueva columna en dp_action_item) y due_date duro.
```

Nuevos `doc_type` en dp_document: `'titular_response'`, `'descargos'`, `'medidas_informe'`,
`'trazabilidad'`, `'expediente'` (índice del paquete), `'certificado'`.

Endpoints adicionales:

```
GET/POST /api/dp/:companyId/titular-requests            PUT /:id
GET/POST /api/dp/:companyId/procedures                  PUT /:id
GET      /api/dp/:companyId/traceability/map            -- grafo del flujo de datos
GET      /api/dp/:companyId/traceability/log?entity=&from=&to=
POST     /api/dp/:companyId/compliance-package          -- genera Expediente (ZIP/PDF con índice)
POST     /api/dp/:companyId/certificate                 -- Certificado de Cumplimiento vigente
```

Scoring: solicitudes vencidas y procedimientos abiertos penalizan el ítem ARCO y suben P de los
escenarios jurídicos ("tratamiento sin base legal" y afines); el histórico de solicitudes
atendidas a tiempo lo bonifica. Las campanas/emails existentes suman las alertas de los dos
cronómetros (10 días término y plazos de la SPDP).

Para el plan de entregas de §7: los flujos §8.1 y §8.3 (solicitudes + trazabilidad) entran en
la **entrega 5**; §8.2, §8.4 y §8.5 (procedimientos, expediente, certificado) forman una
**entrega 6 — Modo Defensa**, con criterio de aceptación: *registrar una solicitud arranca el
cronómetro correcto en días hábiles; el botón Expediente produce el paquete con índice y
faltantes marcados; el certificado sale con disclaimer y vigencia.*

### 8.7 Neuroventa del Modo Defensa

- Es el bloque de mayor conversión del paywall: la pregunta *"¿Te llegó una notificación de la
  SPDP o un reclamo de un cliente?"* segmenta al visitante en pánico (comprador inmediato) —
  CTA: **"Armar mi expediente de defensa ahora"**.
- Mensaje de esperanza anclado en ley (alivio tras el miedo, fase Desire): *"En infracciones
  graves, cumplir las medidas correctivas a tiempo puede evitarte la multa (art. 66). Lo que
  no puedes hacer es llegar sin evidencia."*
- El Certificado de Cumplimiento es el trofeo compartible (advocacy) y el Expediente es la
  póliza (retención): ambos caducan → renovación natural del ciclo.

---

## 9. Riesgos del proyecto y decisiones abiertas

1. **Precio y empaquetado** (decisión de Kevin): ¿el módulo es un plan nuevo ("Premium LOPDP")
   o un add-on sobre pyme/professional? El diseño técnico (flag) soporta ambos.
2. **Diagnóstico gratis**: recomendado limitar a: clasificación de hasta 3 activos + score +
   top 3 riesgos, sin plan de acción ni documentos (reciprocidad sin regalar el producto).
3. **Validación jurídica de plantillas**: antes de vender, un abogado ecuatoriano debe revisar
   las plantillas base (una sola vez). El disclaimer no sustituye esta revisión.
4. **El sello "Empresa Protegida"** es autodeclarativo (no es certificación SPDP) — el texto
   del sello debe decirlo ("Evaluado con metodología basada en la Guía SPDP").
5. Futuro (no en v1): multi-idioma, portal público de verificación del sello, informes
   comparativos por sector, integración con el dashboard DPD de Kevin (3 empresas).
