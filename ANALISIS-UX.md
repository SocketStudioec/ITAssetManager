# Análisis UX/UI — TechAssets Pro (julio 2026)

Auditoría de diseño e informe de rediseño para la actualización de arquitectura
de información. Basado en principios de psicología del usuario (carga cognitiva,
ley de Hick, agrupamiento semántico, progressive disclosure) y en las guías de
rediseño de proyectos existentes (auditar → diagnosticar → mejorar sin romper).

## 1. Diagnóstico del diseño actual

### Arquitectura de información (crítico)
- **8 ítems planos en el sidebar** al mismo nivel (Dashboard, Activos Físicos,
  Aplicaciones, Contratos, Licencias, Mantenimiento, Reportes, Configuración).
  La ley de Hick dice que el tiempo de decisión crece con cada opción visible;
  un dueño de PyME no técnico no distingue "Aplicaciones" de "Licencias" — son
  el mismo concepto mental: *"software por el que pago"*.
- **Aplicaciones y Licencias duplican el modelo mental.** Una suscripción SaaS
  hoy puede registrarse como "aplicación" (tabla assets) o como "licencia"
  (tabla licenses), y el usuario no sabe cuál usar. Resultado: datos partidos y
  costos subestimados en el dashboard.
- **Contratos está huérfano**: no se relaciona con nada. Un contrato de
  mantenimiento de 10 laptops o el contrato del ERP no puede vincularse a esos
  activos, así que no aporta trazabilidad ni contexto de costo.

### Funcionalidad incompleta (descubierto en auditoría de código)
- Licencias y Contratos son **solo lectura**: los botones "Nueva Licencia" /
  "Nuevo Contrato" no hacen nada (sin modal, sin mutación). Solo Activos tiene
  CRUD completo.
- **Bug de datos**: el backend devuelve columnas snake_case (`monthly_cost`)
  pero el frontend lee camelCase (`monthlyCost`) → costos y fechas aparecen
  como "N/A" o $0 en licencias/contratos. El total de costos que ve el dueño
  está mal.

### Formularios (psicología del usuario)
- El alta de activo es **un formulario monolítico de ~20 campos** en un modal.
  Costo cognitivo alto: el usuario no sabe qué es obligatorio, qué puede
  saltarse, ni cuánto falta. Abandono garantizado en PyMEs.
- Sin agrupamiento semántico (identificación / asignación / compra mezclados),
  sin defaults inteligentes (estado, fechas), sin microcopy que explique para
  qué sirve un campo.

### Superficie visual
- Jerarquía tipográfica correcta (shadcn) pero navegación sin indicación de
  grupo/contexto; botones muertos (Filtros); estados vacíos genéricos.

## 2. Nueva arquitectura de información

Agrupamiento por modelo mental del dueño de PyME ("mis cosas de tecnología",
"cuánto pago", "configurar"):

```
Dashboard                          ← visión ejecutiva (costos, vencimientos)
ACTIVOS IT                         ← módulo padre (colapsable, abierto por defecto)
  ├─ Equipos físicos               ← /assets (laptops, servidores, impresoras)
  ├─ Licencias y suscripciones     ← /subscriptions (FUSIÓN apps + licencias)
  ├─ Contratos                     ← /contracts (relacionados a equipos/apps)
  └─ Mantenimientos                ← /maintenance
REPORTES                           ← /reports
CONFIGURACIÓN                      ← /settings
Administración                     ← /admin (solo super_admin)
```

Preparada para el futuro módulo de **Datos personales** como nuevo módulo padre
sin tocar la estructura.

### Decisiones clave

1. **Fusión Aplicaciones + Licencias → "Licencias y suscripciones"**
   Una sola página con lista unificada (apps SaaS de la tabla assets + licencias
   de la tabla licenses, distinguidas con badge de tipo), tarjetas de resumen
   combinadas (costo mensual real total, por vencer en 30 días) y un solo flujo
   de alta que pregunta primero *"¿Qué quieres registrar?"* (suscripción/app o
   licencia con clave). Las tablas de BD no se fusionan (riesgo innecesario);
   la fusión es de experiencia.
   - Se agrega `billing_cycle` (mensual/anual/pago único) a licencias para la
     recurrencia de pago que pidió el negocio.

2. **Contratos ↔ activos**: nueva tabla `contract_assets` (N:M). En el
   formulario de contrato se seleccionan los equipos físicos y/o aplicaciones
   cubiertos; la tabla muestra chips de los activos vinculados. Migración
   aditiva, sin romper datos existentes.

3. **CRUD completo** para licencias y contratos (crear, editar, eliminar) con
   confirmación de borrado.

## 3. Rediseño de formularios (psicoanálisis del consumidor)

Principios aplicados al alta de equipos físicos y al alta de suscripciones:

| Principio | Aplicación |
|-----------|------------|
| **Chunking** (Miller): 3-5 grupos | Wizard de 3 pasos: ① ¿Qué equipo es? ② ¿Dónde está y quién lo usa? ③ Compra y garantía (opcional) |
| **Progressive disclosure** | Paso 3 es opcional y se puede saltar; los costos de infraestructura solo aparecen para apps |
| **Reducción de fricción inicial** | Solo el nombre es obligatorio; todo lo demás tiene default o es opcional. "Empezar es gratis, completar es progresivo" |
| **Defaults inteligentes** | Estado = Activo, fecha de compra = hoy, ciclo = mensual |
| **Reconocimiento sobre recuerdo** | Categorías con iconos clicables (Laptop, Desktop, Servidor, Impresora, Red, Móvil) en vez de un select de texto |
| **Feedback de progreso** | Indicador de pasos (1/3) con etiquetas, botón primario único por paso |
| **Goal-gradient** | El último paso muestra resumen de lo ingresado → sensación de logro antes de guardar |
| **Microcopy de confianza** | "Podrás completar esto después" en campos opcionales; errores en lenguaje directo, sin "Oops" |

## 4. Correcciones técnicas incluidas

- Mapeo snake_case → camelCase centralizado en storage (activos, contratos,
  licencias, mantenimiento) — corrige costos/fechas vacíos.
- Endpoints PUT/DELETE para licencias y contratos con validación de pertenencia
  a la empresa (multi-tenancy) y log de auditoría.
- Migración SQL aditiva: `licenses.billing_cycle` + tabla `contract_assets`.
- Redirects de `/applications` y `/licenses` → `/subscriptions` (URLs viejas no
  se rompen).

## 5. Fuera de alcance (siguiente iteración)

- Módulo de datos personales (LOPDP) como módulo padre nuevo.
- Notificaciones push/email de vencimientos (hoy: visibles en dashboard).
- Migración de hashing de contraseñas a bcrypt.
- Tipado de los ~90 useQuery del cliente.
