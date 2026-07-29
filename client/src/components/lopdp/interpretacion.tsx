/**
 * INTERPRETACIÓN DE LA CALIFICACIÓN
 *
 * Responde las tres preguntas que se hace el usuario al ver sus notas:
 *   1. ¿Qué significa esto?
 *   2. ¿Qué puntaje necesito para no tener problemas?
 *   3. Si estoy por debajo, ¿qué hago?
 */
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck, Target, Clock,
} from "lucide-react";
import type { DpInterpretation } from "@shared/lopdp";

const STATUS_STYLE = {
  protegido: {
    icon: ShieldCheck,
    border: "border-emerald-500/50",
    bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  aceptable: {
    icon: CheckCircle2,
    border: "border-lime-500/50",
    bg: "bg-lime-50/60 dark:bg-lime-950/20",
    text: "text-lime-700 dark:text-lime-400",
  },
  en_riesgo: {
    icon: AlertTriangle,
    border: "border-amber-500/50",
    bg: "bg-amber-50/60 dark:bg-amber-950/20",
    text: "text-amber-700 dark:text-amber-400",
  },
  critico: {
    icon: AlertOctagon,
    border: "border-destructive/60",
    bg: "bg-destructive/5",
    text: "text-destructive",
  },
} as const;

const INFRACTION_LABEL: Record<string, string> = {
  muy_grave: "Muy grave",
  grave: "Grave",
  leve: "Leve",
};

const INFRACTION_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  muy_grave: "destructive",
  grave: "secondary",
  leve: "outline",
};

const EFFORT_LABEL: Record<string, string> = {
  minutos: "Minutos",
  horas: "Horas",
  dias: "Días",
};

/** Barra que muestra dónde estás respecto de la meta. */
function ScoreGauge({
  score, target, safeTarget, invert, label,
}: { score: number; target: number; safeTarget: number; invert?: boolean; label: string }) {
  // En riesgo, menos es mejor: se invierte la barra para que "lleno" siempre sea bueno.
  const filled = invert ? Math.max(0, 100 - score) : score;
  const targetMark = invert ? 100 - target : target;
  const safeMark = invert ? 100 - safeTarget : safeTarget;

  return (
    <div>
      <div className="relative">
        <Progress value={filled} className="h-3" />
        {/* Marca del mínimo exigible */}
        <div
          className="absolute top-0 h-3 w-0.5 bg-foreground/70"
          style={{ left: `${targetMark}%` }}
          title={`Mínimo: ${target}`}
        />
        <div
          className="absolute top-0 h-3 w-0.5 bg-emerald-600"
          style={{ left: `${safeMark}%` }}
          title={`Objetivo: ${safeTarget}`}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          mínimo <strong className="text-foreground">{target}</strong> · objetivo{" "}
          <strong className="text-emerald-600">{safeTarget}</strong>
        </span>
      </div>
    </div>
  );
}

export default function Interpretacion({ data }: { data: DpInterpretation }) {
  const style = STATUS_STYLE[data.status];
  const StatusIcon = style.icon;

  return (
    <div className="space-y-4">
      {/* ---------- Veredicto ---------- */}
      <Card className={`border-2 ${style.border} ${style.bg}`}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <StatusIcon className={`mt-0.5 h-7 w-7 shrink-0 ${style.text}`} />
            <div className="min-w-0">
              <h2 className={`text-xl font-semibold ${style.text}`} data-testid="interpretation-headline">
                {data.headline}
              </h2>
              <p className="mt-2 text-sm text-foreground/80">{data.summary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Qué significa cada calificación ---------- */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Cumplimiento LOPDP</CardTitle>
              <Badge variant={data.compliance.reachesTarget ? "default" : "destructive"}>
                {data.compliance.score.toFixed(0)} / 100 · {data.compliance.grade}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">{data.compliance.title}</p>
            <p className="text-sm text-muted-foreground">{data.compliance.meaning}</p>

            <ScoreGauge
              score={data.compliance.score}
              target={data.compliance.target}
              safeTarget={data.compliance.safeTarget}
              label="Más es mejor"
            />

            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="flex items-start gap-2">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">¿Qué puntaje necesitas?</p>
                  <p className="mt-1 text-muted-foreground">
                    <strong className="text-foreground">{data.compliance.target} como mínimo</strong> para poder
                    defenderte ante un requerimiento, y{" "}
                    <strong className="text-emerald-600">{data.compliance.safeTarget} o más</strong> para
                    considerarte cubierto.
                  </p>
                  {!data.compliance.reachesTarget && (
                    <p className="mt-2 font-medium text-destructive">
                      Te faltan {data.compliance.gap.toFixed(0)} puntos para el mínimo.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Nota legal: frente a las obligaciones de la LOPDP no existe un "riesgo aceptable" — el
              cumplimiento debe ser del 100 %. Estos umbrales miden qué tan defendible es tu posición
              mientras llegas ahí.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Riesgo</CardTitle>
              <Badge variant={data.risk.reachesTarget ? "default" : "destructive"}>
                {data.risk.score.toFixed(0)} / 100 · {data.risk.grade}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">{data.risk.title}</p>
            <p className="text-sm text-muted-foreground">{data.risk.meaning}</p>

            <ScoreGauge
              score={data.risk.score}
              target={data.risk.target}
              safeTarget={data.risk.safeTarget}
              invert
              label="Menos es mejor"
            />

            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="flex items-start gap-2">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">¿Qué puntaje necesitas?</p>
                  <p className="mt-1 text-muted-foreground">
                    <strong className="text-foreground">{data.risk.target} como máximo</strong> para estar dentro
                    de lo tolerable, e idealmente{" "}
                    <strong className="text-emerald-600">{data.risk.safeTarget} o menos</strong>.
                  </p>
                  {!data.risk.reachesTarget && (
                    <p className="mt-2 font-medium text-destructive">
                      Estás {data.risk.gap.toFixed(0)} puntos por encima del máximo tolerable.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              A diferencia del cumplimiento, aquí siempre quedará un riesgo residual: ningún control lo
              elimina por completo. La meta es reducirlo al máximo posible y poder justificarlo.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Qué te está bloqueando ---------- */}
      {data.blockers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Obligaciones que no cumples ({data.blockers.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Ordenadas por la gravedad de la infracción que se configura al no cumplirlas.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.blockers.map((b) => (
              <div key={b.key} className="rounded-lg border border-border p-4" data-testid={`blocker-${b.key}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium">{b.label}</h4>
                  <Badge variant={INFRACTION_VARIANT[b.infraction] ?? "outline"}>
                    Infracción {INFRACTION_LABEL[b.infraction] ?? b.infraction}
                  </Badge>
                  <Badge variant="outline">{b.legalBasis}</Badge>
                  <span className="text-xs text-muted-foreground">+{b.pointsAvailable} pts disponibles</span>
                </div>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Qué es: </span>
                  <span className="text-muted-foreground">{b.meaning}</span>
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-medium">Si no lo tienes: </span>
                  <span className="text-muted-foreground">{b.consequence}</span>
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ---------- Lo que respondiste "No sé" ---------- */}
      {data.toVerify && data.toVerify.length > 0 && (
        <Card className="border-sky-500/40 bg-sky-50/50 dark:bg-sky-950/20">
          <CardHeader>
            <CardTitle className="text-base">
              Cosas que debes averiguar ({data.toVerify.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Respondiste "No sé" a estas preguntas. Mientras no lo confirmes, la evaluación asume que no lo
              tienes — es el criterio prudente y el mismo que aplica la autoridad: si no puedes demostrarlo,
              no cuenta.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.toVerify.map((v) => (
              <div key={v.key} className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-medium">{v.question}</p>
                <p className="mt-1 text-xs text-muted-foreground">{v.whatItMeans}</p>
                <Badge variant="outline" className="mt-2">{v.legalBasis}</Badge>
              </div>
            ))}
            <Button size="sm" variant="outline" asChild className="mt-2">
              <Link href="/lopdp/perfil">Actualizar mis respuestas</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ---------- Qué hacer ahora ---------- */}
      {data.recommendations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Tu plan de acción, en orden</CardTitle>
              <p className="text-sm text-muted-foreground">
                Empieza por arriba: es lo que más sube tu calificación con menos trabajo.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href="/lopdp/plan">Ir al plan<ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recommendations.map((r) => (
              <div
                key={r.order}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
                data-testid={`recommendation-${r.order}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {r.order}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.why}</p>
                </div>
                <Badge variant="outline" className="shrink-0 gap-1">
                  <Clock className="h-3 w-3" />
                  {EFFORT_LABEL[r.effort] ?? r.effort}
                </Badge>
              </div>
            ))}

            {data.achievableScore >= data.compliance.target && !data.compliance.reachesTarget && (
              <p className="pt-2 text-sm text-emerald-700 dark:text-emerald-400">
                Completando todo tu plan llegarías a {data.achievableScore.toFixed(0)} puntos de cumplimiento:
                suficiente para superar el mínimo defendible de {data.compliance.target}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {data.blockers.length === 0 && (
        <Card className="border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="text-sm">
              No tienes obligaciones pendientes. Mantén la evidencia viva: revisa el RAT cada 6 meses,
              capacita a tu personal cada año y revisa los contratos de encargo anualmente.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
