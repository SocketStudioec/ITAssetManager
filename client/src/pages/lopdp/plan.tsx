/**
 * PLAN DE ACCIÓN — etapa 5 (tratamiento de riesgos).
 *
 * Ordenado por impacto/esfuerzo. Cada acción muestra cuántos puntos suma para
 * que el progreso sea visible: completar una acción recalcula la calificación
 * al instante y devuelve el delta.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import LopdpLayout, { LopdpNav, useLopdpCompany } from "@/components/lopdp/lopdp-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Clock, FileText, ArrowRight, Ban } from "lucide-react";
import type { DpActionItem, DpAssessment } from "@shared/lopdp";

const CATEGORY_LABEL: Record<string, string> = {
  juridica: "Jurídica",
  organizacional: "Organizacional",
  tecnica: "Técnica",
};

const EFFORT_LABEL: Record<string, string> = {
  minutos: "Minutos",
  horas: "Horas",
  dias: "Días",
};

export default function LopdpPlan() {
  const [companyId] = useLopdpCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [naDialog, setNaDialog] = useState<DpActionItem | null>(null);
  const [naRationale, setNaRationale] = useState("");

  const { data: actions = [], isLoading } = useQuery<DpActionItem[]>({
    queryKey: ["/api/dp", companyId, "actions"],
    enabled: Boolean(companyId),
  });
  const { data: assessment } = useQuery<DpAssessment>({
    queryKey: ["/api/dp", companyId, "assessment"],
    enabled: Boolean(companyId),
  });

  const update = useMutation({
    mutationFn: async ({ id, status, rationale }: { id: string; status: string; rationale?: string }) => {
      const res = await apiRequest("PUT", `/api/dp/${companyId}/actions/${id}`, {
        status,
        naRationale: rationale ?? null,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dp", companyId] });
      setNaDialog(null);
      setNaRationale("");
      const dc = data.delta?.compliance ?? 0;
      const dr = data.delta?.risk ?? 0;
      const a = data.assessment;
      toast({
        title: dc > 0 ? `¡+${dc.toFixed(1)} puntos de cumplimiento!` : "Acción actualizada",
        description: a
          ? `Cumplimiento ${Number(a.complianceScore).toFixed(0)} (${a.complianceGrade})` +
            (dr < 0 ? ` · riesgo ${dr.toFixed(1)} puntos` : "")
          : undefined,
      });
    },
    onError: (e: any) => toast({ title: "No se pudo actualizar", description: e.message, variant: "destructive" }),
  });

  const generateDoc = useMutation({
    mutationFn: async (action: DpActionItem) => {
      const res = await apiRequest("POST", `/api/dp/${companyId}/documents`, { docType: action.docType });
      return res.json();
    },
    onSuccess: (doc: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dp", companyId] });
      toast({
        title: "Documento generado",
        description: `${doc.title}. Revísalo y publícalo para ganar el puntaje completo.`,
      });
    },
    onError: (e: any) => toast({ title: "No se pudo generar", description: e.message, variant: "destructive" }),
  });

  const pending = actions.filter((a) => a.status === "pending" || a.status === "in_progress");
  const done = actions.filter((a) => a.status === "done");
  const na = actions.filter((a) => a.status === "not_applicable");

  const byCategory = (cat: string) => pending.filter((a) => a.category === cat);

  const renderAction = (action: DpActionItem) => (
    <div key={action.id} className="rounded-lg border border-border p-4" data-testid={`action-${action.controlKey}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{action.title}</h4>
            {Number(action.compliancePoints) > 0 && (
              <Badge variant="secondary">+{Number(action.compliancePoints)} pts</Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />{EFFORT_LABEL[action.effort] ?? action.effort}
            </Badge>
            {action.procedureId && <Badge variant="destructive">Medida correctiva SPDP</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
          {action.legalBasis && (
            <p className="mt-1 text-xs font-medium text-primary">{action.legalBasis}</p>
          )}
          {action.dueDate && (
            <p className="mt-1 text-xs text-destructive">
              Vence: {new Date(action.dueDate).toLocaleDateString("es-EC")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {action.docType && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateDoc.mutate(action)}
              disabled={generateDoc.isPending}
            >
              <FileText className="mr-1 h-3 w-3" />Generar documento
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => update.mutate({ id: action.id, status: "done" })}
            disabled={update.isPending}
            data-testid={`button-complete-${action.controlKey}`}
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />Marcar hecho
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNaDialog(action)}>
            <Ban className="mr-1 h-3 w-3" />No aplica
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <LopdpLayout title="Plan de acción" subtitle="Ordenado por lo que más sube tu calificación con menos esfuerzo">
      <LopdpNav current="/lopdp/plan" />

      {assessment && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm text-muted-foreground">Tu cumplimiento actual</p>
              <p className="text-2xl font-bold">
                {Number(assessment.complianceScore).toFixed(0)}
                <span className="text-base text-muted-foreground"> / 100 · nivel {assessment.complianceGrade}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Acciones pendientes</p>
              <p className="text-2xl font-bold">{pending.length}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando plan…</p>
      ) : actions.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no hay plan de acción. Completa el perfil de tu empresa para que el motor detecte tus brechas.
            </p>
            <Button asChild><Link href="/lopdp/perfil">Completar perfil<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {["juridica", "organizacional", "tecnica"].map((cat) => {
            const items = byCategory(cat);
            if (items.length === 0) return null;
            return (
              <Card key={cat}>
                <CardHeader>
                  <CardTitle className="text-base">{CATEGORY_LABEL[cat]} · {items.length} pendientes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">{items.map(renderAction)}</CardContent>
              </Card>
            );
          })}

          {done.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">
                  Completadas ({done.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {done.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded border border-border/50 p-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span className="truncate">{a.title}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => update.mutate({ id: a.id, status: "pending" })}
                    >
                      Reabrir
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {na.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">No aplican ({na.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {na.map((a) => (
                  <div key={a.id} className="rounded border border-border/50 p-2 text-sm">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">Justificación: {a.naRationale}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={Boolean(naDialog)} onOpenChange={(open) => !open && setNaDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como no aplicable</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{naDialog?.title}</p>
            <div className="space-y-2">
              <Label>¿Por qué no aplica a tu empresa? *</Label>
              <Textarea
                value={naRationale}
                onChange={(e) => setNaRationale(e.target.value)}
                placeholder="Ej.: no tenemos proveedores externos que accedan a datos de clientes."
                rows={3}
                data-testid="input-na-rationale"
              />
              <p className="text-xs text-muted-foreground">
                La justificación queda registrada como evidencia: ante la autoridad, un "no aplica" sin
                sustento equivale a un incumplimiento.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNaDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => naDialog && update.mutate({ id: naDialog.id, status: "not_applicable", rationale: naRationale })}
              disabled={naRationale.trim().length < 10 || update.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LopdpLayout>
  );
}
