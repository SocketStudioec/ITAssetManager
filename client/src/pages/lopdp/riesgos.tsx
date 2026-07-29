/**
 * ESCENARIOS DE RIESGO — etapas 2 a 4 de la Guía SPDP.
 *
 * Regla del módulo: nunca mostrar un nivel sin su justificación. Probabilidad e
 * impacto se muestran SIEMPRE por separado, con el rationale que los sustenta.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import LopdpLayout, { LopdpNav, useLopdpCompany } from "@/components/lopdp/lopdp-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SlidersHorizontal } from "lucide-react";
import { DP_LEVEL_LABELS, levelColor, type DpRiskScenario } from "@shared/lopdp";

const DIMENSION_LABEL: Record<string, string> = {
  C: "Confidencialidad",
  I: "Integridad",
  D: "Disponibilidad",
};

const money = (n: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export default function LopdpRiesgos() {
  const [companyId] = useLopdpCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<DpRiskScenario | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>("todos");

  const { data: scenarios = [], isLoading } = useQuery<DpRiskScenario[]>({
    queryKey: ["/api/dp", companyId, "scenarios"],
    enabled: Boolean(companyId),
  });

  const [form, setForm] = useState({
    probabilityOverride: "",
    impactOverride: "",
    overrideRationale: "",
    status: "open",
    frequency: "",
    impactMin: "",
    impactLikely: "",
    impactMax: "",
  });

  const openEditor = (s: DpRiskScenario) => {
    setEditing(s);
    setForm({
      probabilityOverride: s.probabilityOverride != null ? String(s.probabilityOverride) : "",
      impactOverride: s.impactOverride != null ? String(s.impactOverride) : "",
      overrideRationale: s.overrideRationale ?? "",
      status: s.status ?? "open",
      frequency: s.frequency != null ? String(s.frequency) : "",
      impactMin: "",
      impactLikely: "",
      impactMax: "",
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return null;
      const res = await apiRequest("PUT", `/api/dp/${companyId}/scenarios/${editing.id}`, {
        probabilityOverride: form.probabilityOverride || null,
        impactOverride: form.impactOverride || null,
        overrideRationale: form.overrideRationale,
        status: form.status,
        frequency: form.frequency || null,
        impactMin: form.impactMin || null,
        impactLikely: form.impactLikely || null,
        impactMax: form.impactMax || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dp", companyId] });
      setEditing(null);
      toast({ title: "Escenario actualizado", description: "Tu justificación quedó registrada como evidencia." });
    },
    onError: (e: any) => toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" }),
  });

  const filtered = levelFilter === "todos" ? scenarios : scenarios.filter((s) => s.level === levelFilter);

  return (
    <LopdpLayout title="Escenarios de riesgo" subtitle="Análisis conforme a la Guía de Gestión de Riesgos de la SPDP">
      <LopdpNav current="/lopdp/riesgos" />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{scenarios.length} escenarios evaluados</CardTitle>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-48" data-testid="select-level-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los niveles</SelectItem>
              <SelectItem value="muy_alto">Muy alto</SelectItem>
              <SelectItem value="alto">Alto</SelectItem>
              <SelectItem value="medio">Medio</SelectItem>
              <SelectItem value="bajo">Bajo</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando escenarios…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay escenarios. Clasifica tus activos y ejecuta la evaluación desde el panel.
            </p>
          ) : (
            filtered.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-4" data-testid={`scenario-${s.templateKey}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{s.title}</h3>
                      <Badge className={levelColor(s.level)}>{DP_LEVEL_LABELS[s.level]}</Badge>
                      <Badge variant="outline">{DIMENSION_LABEL[s.dimension]}</Badge>
                      {s.status !== "open" && <Badge variant="secondary">{s.status}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Activo afectado: {s.entityName}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Probabilidad</p>
                      <p className="text-2xl font-bold">{s.residualProbability}<span className="text-sm text-muted-foreground">/5</span></p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Impacto</p>
                      <p className="text-2xl font-bold">{s.residualImpact}<span className="text-sm text-muted-foreground">/5</span></p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openEditor(s)} aria-label="Calibrar escenario">
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 space-y-2 rounded bg-muted/50 p-3 text-xs">
                  <p><strong>Justificación:</strong> {s.rationale}</p>
                  {s.overrideRationale && (
                    <p className="text-amber-700 dark:text-amber-400">
                      <strong>Calibración manual:</strong> {s.overrideRationale}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                    {s.threatCommunity && <span><strong>Amenaza:</strong> {s.threatCommunity}</span>}
                    {s.attackVector && <span><strong>Vector:</strong> {s.attackVector}</span>}
                    {s.legalBasis && <span><strong>Base legal:</strong> {s.legalBasis}</span>}
                  </div>
                  {(s.ale || s.var90) && (
                    <p className="text-muted-foreground">
                      <strong>Análisis cuantitativo:</strong> pérdida anual esperada {money(Number(s.ale))} ·
                      valor al riesgo (90 %) {money(Number(s.var90))}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Calibrar: {editing?.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="rounded bg-muted p-3 text-xs text-muted-foreground">
              Valores calculados por el motor: probabilidad {editing?.probability}/5, impacto {editing?.impact}/5.
              Si los ajustas, la Guía SPDP exige justificar el cambio: ese texto queda como evidencia ante la autoridad.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Probabilidad (1-5)</Label>
                <Input
                  type="number" min={1} max={5}
                  value={form.probabilityOverride}
                  onChange={(e) => setForm({ ...form, probabilityOverride: e.target.value })}
                  placeholder={String(editing?.probability ?? "")}
                />
              </div>
              <div className="space-y-2">
                <Label>Impacto (1-5)</Label>
                <Input
                  type="number" min={1} max={5}
                  value={form.impactOverride}
                  onChange={(e) => setForm({ ...form, impactOverride: e.target.value })}
                  placeholder={String(editing?.impact ?? "")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estrategia de tratamiento</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Mitigar (activo)</SelectItem>
                  <SelectItem value="accepted">Aceptar el riesgo</SelectItem>
                  <SelectItem value="transferred">Transferir (seguro/tercero)</SelectItem>
                  <SelectItem value="avoided">Evitar (cesar el tratamiento)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Justificación del cambio *</Label>
              <Textarea
                value={form.overrideRationale}
                onChange={(e) => setForm({ ...form, overrideRationale: e.target.value })}
                placeholder="Ej.: implementamos MFA y respaldos verificados en marzo, lo que reduce la probabilidad."
                rows={3}
                data-testid="input-override-rationale"
              />
            </div>

            <details className="rounded border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Análisis cuantitativo (opcional)</summary>
              <p className="mt-2 text-xs text-muted-foreground">
                Pérdida anual esperada (ALE) y valor al riesgo al 90 % con distribución triangular.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Frecuencia anual (λ)</Label>
                  <Input type="number" step="0.1" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="1.2" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pérdida mínima (USD)</Label>
                  <Input type="number" value={form.impactMin} onChange={(e) => setForm({ ...form, impactMin: e.target.value })} placeholder="10000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pérdida más probable</Label>
                  <Input type="number" value={form.impactLikely} onChange={(e) => setForm({ ...form, impactLikely: e.target.value })} placeholder="25000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pérdida máxima</Label>
                  <Input type="number" value={form.impactMax} onChange={(e) => setForm({ ...form, impactMax: e.target.value })} placeholder="50000" />
                </div>
              </div>
            </details>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || form.overrideRationale.trim().length < 10}
              data-testid="button-save-scenario"
            >
              Guardar calibración
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LopdpLayout>
  );
}
