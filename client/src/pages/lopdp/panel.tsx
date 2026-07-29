/**
 * PANEL LOPDP — el "momento espejo".
 *
 * Jerarquía deliberada: primero las dos calificaciones y la exposición
 * económica (impacto), después el detalle (evidencia), al final la acción.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import LopdpLayout, { LopdpNav, useLopdpCompany } from "@/components/lopdp/lopdp-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertTriangle, ArrowRight, RefreshCw, ShieldCheck, TrendingDown, Scale, CheckCircle2, Circle, MinusCircle,
} from "lucide-react";
import Interpretacion from "@/components/lopdp/interpretacion";
import {
  DP_LEVEL_LABELS, gradeColor, levelColor,
  type DpAssessment, type DpStatus, type DpRiskScenario, type DpInterpretation,
} from "@shared/lopdp";

const money = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

function GradeCard({
  title, score, grade, hint, invert,
}: { title: string; score: number; grade: string; hint: string; invert?: boolean }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="mt-2 flex items-baseline gap-3">
          <span className={`text-5xl font-bold ${gradeColor(grade as any)}`} data-testid={`grade-${invert ? "risk" : "compliance"}`}>
            {grade}
          </span>
          <span className="text-2xl font-semibold text-muted-foreground">{Number(score).toFixed(0)}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <Progress value={invert ? 100 - Number(score) : Number(score)} className="mt-3 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/** Mapa de calor 5×5. Representación, no cálculo: P e I quedan siempre visibles. */
function HeatMap({ scenarios }: { scenarios: DpRiskScenario[] }) {
  const cells: Record<string, number> = {};
  for (const s of scenarios) {
    const key = `${s.residualProbability}-${s.residualImpact}`;
    cells[key] = (cells[key] ?? 0) + 1;
  }

  const cellColor = (p: number, i: number) => {
    const product = p * i;
    if (i >= 5 && p >= 3) return "bg-red-500/80";
    if (i >= 5 || product >= 15) return "bg-orange-400/70";
    if (product >= 8) return "bg-orange-300/60";
    if (product >= 4) return "bg-amber-200/70";
    return "bg-emerald-200/70";
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-[320px]">
        <div className="flex">
          <div className="flex w-8 items-center justify-center">
            <span className="-rotate-90 whitespace-nowrap text-xs text-muted-foreground">Impacto</span>
          </div>
          <div>
            {[5, 4, 3, 2, 1].map((impact) => (
              <div key={impact} className="flex">
                <div className="flex w-6 items-center justify-center text-xs text-muted-foreground">{impact}</div>
                {[1, 2, 3, 4, 5].map((prob) => {
                  const count = cells[`${prob}-${impact}`] ?? 0;
                  return (
                    <div
                      key={prob}
                      className={`m-0.5 flex h-12 w-12 items-center justify-center rounded ${cellColor(prob, impact)}`}
                      title={`Probabilidad ${prob}, impacto ${impact}: ${count} escenario(s)`}
                    >
                      <span className="text-sm font-semibold text-foreground/80">{count || ""}</span>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="flex">
              <div className="w-6" />
              {[1, 2, 3, 4, 5].map((p) => (
                <div key={p} className="m-0.5 w-12 text-center text-xs text-muted-foreground">{p}</div>
              ))}
            </div>
            <p className="ml-6 mt-1 text-center text-xs text-muted-foreground">Probabilidad</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LopdpPanel() {
  const [companyId] = useLopdpCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status } = useQuery<DpStatus>({
    queryKey: ["/api/dp", companyId, "status"],
    enabled: Boolean(companyId),
  });
  const { data: assessment } = useQuery<DpAssessment>({
    queryKey: ["/api/dp", companyId, "assessment"],
    enabled: Boolean(companyId) && status?.enabled === true,
  });
  const { data: scenarios = [] } = useQuery<DpRiskScenario[]>({
    queryKey: ["/api/dp", companyId, "scenarios"],
    enabled: Boolean(companyId) && status?.enabled === true,
  });
  const { data: interpretation } = useQuery<DpInterpretation>({
    queryKey: ["/api/dp", companyId, "interpretation"],
    enabled: Boolean(companyId) && status?.enabled === true,
  });

  const runEngine = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/dp/${companyId}/engine/run`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dp", companyId] });
      toast({
        title: "Evaluación actualizada",
        description: `Riesgo ${Number(data.riskScore).toFixed(0)} (${data.riskGrade}) · Cumplimiento ${Number(
          data.complianceScore,
        ).toFixed(0)} (${data.complianceGrade})`,
      });
    },
    onError: (e: any) => toast({ title: "No se pudo evaluar", description: e.message, variant: "destructive" }),
  });

  const compliance: any[] = (assessment?.breakdown as any)?.compliance ?? [];
  const topRisks = scenarios.slice(0, 5);
  const classificationProgress =
    status && status.totalAssets > 0 ? Math.round((status.classifiedAssets / status.totalAssets) * 100) : 0;

  return (
    <LopdpLayout
      title="Protección de Datos Personales"
      subtitle="Cumplimiento LOPDP basado en tus activos registrados"
    >
      <LopdpNav current="/lopdp" />

      {!assessment ? (
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">Aún no conoces tu nivel de riesgo</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Completa el perfil de tu empresa y clasifica tus activos. En 15 minutos sabrás exactamente
                dónde estás parado frente a la ley.
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button asChild data-testid="button-start-wizard">
                <Link href="/lopdp/perfil">Empezar por el perfil<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button variant="outline" onClick={() => runEngine.mutate()} disabled={runEngine.isPending}>
                Evaluar ahora
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <GradeCard
              title="Calificación de riesgo"
              score={Number(assessment.riskScore)}
              grade={assessment.riskGrade}
              hint="Menor es mejor. Mide la exposición residual de tus escenarios de riesgo."
              invert
            />
            <GradeCard
              title="Cumplimiento LOPDP"
              score={Number(assessment.complianceScore)}
              grade={assessment.complianceGrade}
              hint="Mayor es mejor. Mide qué obligaciones legales tienes cubiertas con evidencia."
            />
            <Card className={Number(assessment.estimatedFineMax) > 0 ? "border-destructive/40" : ""}>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Exposición económica estimada</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <Scale className="h-5 w-5 text-destructive" />
                  <span className="text-2xl font-bold text-destructive" data-testid="estimated-fine">
                    {money(Number(assessment.estimatedFineMin))} – {money(Number(assessment.estimatedFineMax))}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {assessment.worstInfraction
                    ? `Infracción más grave detectada: ${assessment.worstInfraction.replace("_", " ")}. `
                    : "Sin infracciones detectadas. "}
                  Estimación referencial sobre tu facturación declarada (arts. 80-83 LOPDP). No es una
                  liquidación de sanción.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Qué significa cada calificación, qué puntaje hace falta y qué hacer */}
          {interpretation && <Interpretacion data={interpretation} />}

          {status && status.classifiedAssets < status.totalAssets && (
            <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium">
                      Tienes {status.totalAssets - status.classifiedAssets} activo(s) sin clasificar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tu calificación solo es confiable cuando todos tus activos están clasificados
                      ({classificationProgress} % completado).
                    </p>
                  </div>
                </div>
                <Button size="sm" asChild>
                  <Link href="/lopdp/clasificacion">Clasificar ahora</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Tus 5 riesgos principales</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/lopdp/riesgos">Ver todos<ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {topRisks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin escenarios evaluados. Clasifica tus activos y ejecuta la evaluación.
                  </p>
                ) : (
                  topRisks.map((s) => (
                    <div key={s.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{s.entityName}</p>
                        </div>
                        <Badge className={levelColor(s.level)}>{DP_LEVEL_LABELS[s.level]}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Probabilidad <strong className="text-foreground">{s.residualProbability}/5</strong></span>
                        <span>Impacto <strong className="text-foreground">{s.residualImpact}/5</strong></span>
                        {s.legalBasis && <span>{s.legalBasis}</span>}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mapa de calor de riesgos</CardTitle>
              </CardHeader>
              <CardContent>
                <HeatMap scenarios={scenarios} />
                <p className="mt-3 text-xs text-muted-foreground">
                  La matriz se usa como representación, no como cálculo: probabilidad e impacto se
                  mantienen visibles por separado en cada escenario, conforme a la Guía de la SPDP.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Estado de tus obligaciones legales</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/lopdp/plan">Ver plan de acción<ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="pb-2 font-medium">Obligación</th>
                      <th className="pb-2 font-medium">Base legal</th>
                      <th className="pb-2 text-right font-medium">Puntos</th>
                      <th className="pb-2 font-medium">Evidencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compliance.map((item) => (
                      <tr key={item.key} className="border-b border-border/50">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            {item.satisfied ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : item.partial ? (
                              <MinusCircle className="h-4 w-4 shrink-0 text-amber-600" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-red-500" />
                            )}
                            <span>{item.label}</span>
                          </div>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{item.legalBasis}</td>
                        <td className="py-2 text-right font-mono text-xs">
                          {item.earned} / {item.weight}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{item.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => runEngine.mutate()} disabled={runEngine.isPending} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${runEngine.isPending ? "animate-spin" : ""}`} />
              Recalcular evaluación
            </Button>
            <Button asChild>
              <Link href="/lopdp/plan">
                <TrendingDown className="mr-2 h-4 w-4" />
                Subir mi calificación
              </Link>
            </Button>
          </div>
        </>
      )}
    </LopdpLayout>
  );
}
