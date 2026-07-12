# DESIGN.md — Sistema de diseño TechAssets Pro (rediseño 2026-07)

Dirección visual para TODO el frontend. Cualquier componente nuevo o modificado
debe cumplir esto (basado en ui-ux-pro-max + web-design-guidelines).

## Personalidad
SaaS profesional de confianza para PYMES ecuatorianas. **Sencillo, moderno,
denso en datos pero limpio.** Referencia: Linear / Vercel dashboard. Nada de
sombras pesadas, gradientes decorativos ni tarjetas dentro de tarjetas.

## Reglas duras
1. **Tablas > tarjetas** para listados de datos (activos, aplicaciones,
   contratos, mantenimientos). Números con `tabular-nums`, alineados a la
   derecha. Fila clicable → modal/panel de detalle.
2. **Espaciado**: sistema de 4/8px (`space-y-6` secciones, `p-6` contenedores,
   `gap-2/3` dentro de componentes). Un solo `max-w` consistente.
3. **Jerarquía tipográfica**: título de página `text-2xl font-semibold
   tracking-tight`; subtítulo `text-sm text-muted-foreground`; labels
   `text-sm font-medium`. Nunca texto <12px.
4. **Color**: solo tokens semánticos de shadcn (primary, muted, destructive,
   border…). Prohibido hex crudo en componentes. Estados con color + icono
   (nunca solo color). Badges de estado: sutiles (`bg-*-50 text-*-700
   ring-1 ring-inset` estilo) no bloques saturados.
5. **Interacción**: todo clicable con `cursor-pointer` y estado hover visible;
   botones async con spinner + disabled; focus ring visible SIEMPRE;
   targets ≥40px; transiciones 150-200ms solo transform/opacity.
6. **Formularios**: label visible arriba (nunca placeholder-solo), error debajo
   del campo, helper text persistente en campos complejos, validación on-blur,
   wizard con indicador de pasos y navegación atrás. Modales de creación:
   `max-h-[90vh]` con scroll interno, footer fijo con acciones.
7. **Iconos**: solo lucide-react, tamaño consistente (16px en botones/tabla,
   20px en navegación), nunca emojis.
8. **Vacíos y carga**: skeletons (no spinners de página completa); estados
   vacíos con icono + mensaje + CTA.
9. **Sidebar**: colapsable a 64px (solo iconos + tooltip), expandido 256px,
   transición 200ms, estado en localStorage, item activo con indicador claro.
10. **Accesibilidad**: aria-label en botones de solo icono, contraste AA,
    orden de tab lógico, `aria-sort` en tablas ordenables.

## Neuroventa aplicada al dashboard
- El dato que le importa al dueño de la PYME es **cuánto gasta en tecnología al
  mes**: ese número debe ser prominente (informes, depreciación, totales).
- Reducir fricción: crear activo en pasos cortos con defaults inteligentes
  (categoría sugiere años de depreciación; código único autogenerado).
- Confianza: cifras contables con norma ecuatoriana explícita ("depreciación
  línea recta, 3 años — Art. 28 RLRTI").
