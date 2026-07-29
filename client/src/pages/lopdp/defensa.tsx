/**
 * MODO DEFENSA — qué hacer cuando alguien reclama o llega la autoridad.
 *
 * Tres flujos reactivos en una sola pantalla, más el botón que resume todo el
 * módulo: el Expediente de Cumplimiento.
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, Clock, FileArchive, Plus, ShieldCheck, Gavel, Siren } from "lucide-react";
import {
  DP_REQUEST_TYPE_LABELS, DP_PROCEDURE_TYPE_LABELS, DP_CATEGORY_LABELS,
} from "@shared/lopdp";

const today = () => new Date().toISOString().slice(0, 10);

const REQUEST_STATUS_LABEL: Record<string, string> = {
  open: "Abierta",
  in_progress: "En trámite",
  answered: "Contestada",
  executed: "Ejecutada",
  denied: "Negada",
  expired: "Vencida",
};

const INCIDENT_STATUS_LABEL: Record<string, string> = {
  contencion: "Contención",
  evaluacion: "Evaluación",
  notificado_spdp: "Notificado a la SPDP",
  notificado_titulares: "Notificado a titulares",
  cerrado: "Cerrado",
};

export default function LopdpDefensa() {
  const [companyId] = useLopdpCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newRequest, setNewRequest] = useState(false);
  const [newIncident, setNewIncident] = useState(false);
  const [newProcedure, setNewProcedure] = useState(false);

  const { data: requests = [] } = useQuery<any[]>({
    queryKey: ["/api/dp", companyId, "titular-requests"], enabled: Boolean(companyId),
  });
  const { data: incidents = [] } = useQuery<any[]>({
    queryKey: ["/api/dp", companyId, "incidents"], enabled: Boolean(companyId),
  });
  const { data: procedures = [] } = useQuery<any[]>({
    queryKey: ["/api/dp", companyId, "procedures"], enabled: Boolean(companyId),
  });

  const [reqForm, setReqForm] = useState({
    requestType: "acceso", titularName: "", titularContact: "", titularIdNumber: "",
    channel: "email", detail: "", receivedAt: today(),
  });
  const [incForm, setIncForm] = useState({
    title: "", description: "", detectedAt: new Date().toISOString().slice(0, 16),
    dimensions: [] as string[], dataCategories: [] as string[], subjectCountEstimate: "", severity: "media",
  });
  const [procForm, setProcForm] = useState({
    procedureType: "requerimiento_info", fileNumber: "", notifiedAt: today(),
    deadline: "", description: "", correctiveMeasures: "",
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/dp", companyId] });

  const createRequest = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/dp/${companyId}/titular-requests`, reqForm)).json(),
    onSuccess: (r: any) => {
      invalidate(); setNewRequest(false);
      toast({
        title: "Solicitud registrada",
        description: `Tienes hasta el ${new Date(r.dueDate).toLocaleDateString("es-EC")} para responder (10 días término, art. 62).`,
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateRequest = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) =>
      (await apiRequest("PUT", `/api/dp/${companyId}/titular-requests/${id}`, body)).json(),
    onSuccess: () => { invalidate(); toast({ title: "Solicitud actualizada" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createIncident = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/dp/${companyId}/incidents`, {
        ...incForm,
        subjectCountEstimate: incForm.subjectCountEstimate || null,
      })).json(),
    onSuccess: (i: any) => {
      invalidate(); setNewIncident(false);
      toast({
        title: "Incidente registrado",
        description: `Debes notificar a la SPDP antes del ${new Date(i.spdpDeadline).toLocaleString("es-EC")} (72 horas, art. 43).`,
        variant: "destructive",
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateIncident = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) =>
      (await apiRequest("PUT", `/api/dp/${companyId}/incidents/${id}`, body)).json(),
    onSuccess: () => { invalidate(); toast({ title: "Incidente actualizado" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createProcedure = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/dp/${companyId}/procedures`, {
        ...procForm, deadline: procForm.deadline || null,
      })).json(),
    onSuccess: () => {
      invalidate(); setNewProcedure(false);
      toast({ title: "Procedimiento registrado", description: "Las medidas correctivas se agregaron a tu plan de acción." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const genDoc = useMutation({
    mutationFn: async ({ docType, relatedEntityId }: { docType: string; relatedEntityId?: string }) =>
      (await apiRequest("POST", `/api/dp/${companyId}/documents`, { docType, relatedEntityId })).json(),
    onSuccess: (doc: any) => {
      invalidate();
      toast({ title: "Documento generado", description: `${doc.title}. Revísalo en la sección Documentos.` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const buildPackage = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/dp/${companyId}/compliance-package`, {})).json(),
    onSuccess: (doc: any) => {
      invalidate();
      toast({
        title: "Expediente generado",
        description: "Revísalo en Documentos: los faltantes están marcados en rojo.",
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const certificate = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/dp/${companyId}/certificate`, {})).json(),
    onSuccess: () => { invalidate(); toast({ title: "Certificado emitido", description: "Vigencia de 6 meses. Disponible en Documentos." }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const overdue = requests.filter((r) => r.isOverdue).length;

  return (
    <LopdpLayout title="Modo Defensa" subtitle="Reclamos de titulares, incidentes y procedimientos ante la SPDP">
      <LopdpNav current="/lopdp/defensa" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-primary/30">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Expediente de Cumplimiento</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Genera en un clic el paquete de 12 puntos que la Superintendencia suele pedir: RAT, política,
              contratos de encargo, gestión de riesgos, registro de solicitudes e incidentes. Lo que falte
              aparece marcado en rojo.
            </p>
            <Button onClick={() => buildPackage.mutate()} disabled={buildPackage.isPending} data-testid="button-build-package">
              Armar mi expediente ahora
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold">Certificado de cumplimiento</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Documento con tus calificaciones y obligaciones verificadas, vigencia de 6 meses. Útil para
              licitaciones y clientes corporativos. Es autodeclarativo: no sustituye la certificación oficial
              del art. 54 de la LOPDP.
            </p>
            <Button variant="outline" onClick={() => certificate.mutate()} disabled={certificate.isPending}>
              Emitir certificado
            </Button>
          </CardContent>
        </Card>
      </div>

      {overdue > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm">
              <strong>{overdue} solicitud(es) vencida(s).</strong> No contestar en el término de 10 días
              habilita al titular a reclamar ante la Superintendencia (art. 64) y es infracción leve (art. 67.1).
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests" data-testid="tab-requests">Solicitudes de titulares ({requests.length})</TabsTrigger>
          <TabsTrigger value="incidents" data-testid="tab-incidents">Incidentes ({incidents.length})</TabsTrigger>
          <TabsTrigger value="procedures" data-testid="tab-procedures">Procedimientos SPDP ({procedures.length})</TabsTrigger>
        </TabsList>

        {/* ---------------- SOLICITUDES DE TITULARES ---------------- */}
        <TabsContent value="requests" className="space-y-4">
          <div className="flex justify-between">
            <p className="text-sm text-muted-foreground">
              Plazo legal: <strong>10 días término</strong> (hábiles) desde la recepción (art. 62 LOPDP).
            </p>
            <Button size="sm" onClick={() => setNewRequest(true)} data-testid="button-new-request">
              <Plus className="mr-2 h-4 w-4" />Registrar solicitud
            </Button>
          </div>

          {requests.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              Sin solicitudes registradas. Registra aquí cualquier pedido que te llegue por correo, formulario o en persona.
            </CardContent></Card>
          ) : (
            requests.map((r) => (
              <Card key={r.id} className={r.isOverdue ? "border-destructive" : ""}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.titularName}</span>
                        <Badge variant="outline">{(DP_REQUEST_TYPE_LABELS as any)[r.requestType]}</Badge>
                        <Badge variant={r.isOverdue ? "destructive" : "secondary"}>
                          {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Recibida el {new Date(r.receivedAt).toLocaleDateString("es-EC")} · {r.titularContact || "sin contacto"}
                      </p>
                      {r.detail && <p className="mt-1 text-sm">{r.detail}</p>}
                    </div>
                    <div className="text-right">
                      <div className={`flex items-center gap-1 ${r.isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {r.isOverdue
                            ? `Vencida hace ${Math.abs(r.daysLeft)} días hábiles`
                            : `${r.daysLeft} días hábiles restantes`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Límite: {new Date(r.dueDate).toLocaleDateString("es-EC")}
                      </p>
                    </div>
                  </div>

                  {["open", "in_progress"].includes(r.status) && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline"
                        onClick={() => genDoc.mutate({ docType: "titular_response", relatedEntityId: r.id })}>
                        Generar respuesta
                      </Button>
                      <Button size="sm"
                        onClick={() => updateRequest.mutate({ id: r.id, body: { status: "executed", resolution: "concedida" } })}>
                        Atendida y ejecutada
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => {
                          const rationale = window.prompt(
                            "Negar sin motivación es infracción leve (art. 67.1 LOPDP). Escribe la motivación:",
                          );
                          if (rationale && rationale.trim().length >= 10) {
                            updateRequest.mutate({
                              id: r.id,
                              body: { status: "denied", resolution: "negada", resolutionRationale: rationale },
                            });
                          } else if (rationale !== null) {
                            toast({ title: "Motivación insuficiente", description: "Debe tener al menos 10 caracteres.", variant: "destructive" });
                          }
                        }}>
                        Negar (motivada)
                      </Button>
                    </div>
                  )}
                  {r.resolutionRationale && (
                    <p className="rounded bg-muted p-2 text-xs"><strong>Motivación:</strong> {r.resolutionRationale}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ---------------- INCIDENTES ---------------- */}
        <TabsContent value="incidents" className="space-y-4">
          <div className="flex justify-between">
            <p className="text-sm text-muted-foreground">
              Plazo legal: <strong>72 horas</strong> para notificar a la SPDP desde que conoces la vulneración (art. 43).
            </p>
            <Button size="sm" variant="destructive" onClick={() => setNewIncident(true)} data-testid="button-new-incident">
              <Siren className="mr-2 h-4 w-4" />Reportar incidente
            </Button>
          </div>

          {incidents.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              Sin incidentes registrados.
            </CardContent></Card>
          ) : (
            incidents.map((i) => (
              <Card key={i.id} className={i.hoursLeft < 0 && !i.spdpNotifiedAt ? "border-destructive" : ""}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{i.title}</span>
                        <Badge variant="secondary">{INCIDENT_STATUS_LABEL[i.status] ?? i.status}</Badge>
                        <Badge variant="outline">{i.severity}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Detectado: {new Date(i.detectedAt).toLocaleString("es-EC")} ·
                        {" "}{i.subjectCountEstimate ?? "?"} titulares estimados
                      </p>
                      {i.description && <p className="mt-1 text-sm">{i.description}</p>}
                    </div>
                    {!i.spdpNotifiedAt && (
                      <div className={`text-right ${i.hoursLeft < 24 ? "text-destructive" : "text-muted-foreground"}`}>
                        <p className="text-2xl font-bold">{i.hoursLeft > 0 ? `${i.hoursLeft} h` : "VENCIDO"}</p>
                        <p className="text-xs">para notificar a la SPDP</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline"
                      onClick={() => genDoc.mutate({ docType: "spdp_notification", relatedEntityId: i.id })}>
                      Generar notificación a la SPDP
                    </Button>
                    {!i.spdpNotifiedAt && (
                      <Button
                        size="sm"
                        disabled={updateIncident.isPending}
                        onClick={() =>
                          updateIncident.mutate({
                            id: i.id,
                            body: { status: "notificado_spdp", spdpNotifiedAt: new Date().toISOString() },
                          })
                        }
                      >
                        Marcar notificado a la SPDP
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ---------------- PROCEDIMIENTOS SPDP ---------------- */}
        <TabsContent value="procedures" className="space-y-4">
          <Card className="bg-muted/50">
            <CardContent className="p-4 text-sm">
              <strong>Cómo funciona.</strong> Ante una presunta infracción <strong>grave</strong>, la
              Superintendencia aplica <strong>primero medidas correctivas</strong>: la multa solo procede si
              las cumples tarde, de forma parcial o defectuosa (art. 66.2). Registrar aquí el procedimiento
              convierte cada medida en una acción de tu plan con fecha límite.
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => setNewProcedure(true)} data-testid="button-new-procedure">
              <Gavel className="mr-2 h-4 w-4" />Registrar procedimiento
            </Button>
          </div>

          {procedures.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              Sin procedimientos registrados. Ojalá siga así.
            </CardContent></Card>
          ) : (
            procedures.map((p) => (
              <Card key={p.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{(DP_PROCEDURE_TYPE_LABELS as any)[p.procedureType]}</span>
                        {p.fileNumber && <Badge variant="outline">Exp. {p.fileNumber}</Badge>}
                        <Badge variant="secondary">{p.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Notificado: {new Date(p.notifiedAt).toLocaleDateString("es-EC")}
                        {p.deadline && ` · Plazo: ${new Date(p.deadline).toLocaleDateString("es-EC")}`}
                      </p>
                      {p.description && <p className="mt-1 text-sm">{p.description}</p>}
                      {p.correctiveMeasures && (
                        <p className="mt-2 rounded bg-muted p-2 text-xs">
                          <strong>Medidas dispuestas:</strong> {p.correctiveMeasures}
                        </p>
                      )}
                    </div>
                    {p.daysLeft != null && (
                      <div className={p.daysLeft < 3 ? "text-destructive" : "text-muted-foreground"}>
                        <p className="text-sm font-medium">
                          {p.daysLeft < 0 ? `Vencido hace ${Math.abs(p.daysLeft)} días` : `${p.daysLeft} días hábiles`}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline"
                      onClick={() => genDoc.mutate({ docType: "descargos", relatedEntityId: p.id })}>
                      Generar borrador de descargos
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => genDoc.mutate({ docType: "medidas_informe", relatedEntityId: p.id })}>
                      Informe de medidas cumplidas
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ---------------- DIÁLOGOS ---------------- */}
      <Dialog open={newRequest} onOpenChange={setNewRequest}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar solicitud de titular</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tipo de solicitud</Label>
              <Select value={reqForm.requestType} onValueChange={(v) => setReqForm({ ...reqForm, requestType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DP_REQUEST_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre del titular *</Label>
                <Input value={reqForm.titularName} onChange={(e) => setReqForm({ ...reqForm, titularName: e.target.value })} data-testid="input-titular-name" />
              </div>
              <div className="space-y-2">
                <Label>Cédula / identificación</Label>
                <Input value={reqForm.titularIdNumber} onChange={(e) => setReqForm({ ...reqForm, titularIdNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Input value={reqForm.titularContact} onChange={(e) => setReqForm({ ...reqForm, titularContact: e.target.value })} placeholder="correo o teléfono" />
              </div>
              <div className="space-y-2">
                <Label>Fecha de recepción *</Label>
                <Input type="date" value={reqForm.receivedAt} onChange={(e) => setReqForm({ ...reqForm, receivedAt: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Detalle de lo solicitado</Label>
              <Textarea value={reqForm.detail} onChange={(e) => setReqForm({ ...reqForm, detail: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRequest(false)}>Cancelar</Button>
            <Button onClick={() => createRequest.mutate()} disabled={!reqForm.titularName || createRequest.isPending}>
              Registrar e iniciar el plazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newIncident} onOpenChange={setNewIncident}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Reportar vulneración de seguridad</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>¿Qué pasó? *</Label>
              <Input value={incForm.title} onChange={(e) => setIncForm({ ...incForm, title: e.target.value })} placeholder="Ej.: acceso no autorizado al correo institucional" data-testid="input-incident-title" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={incForm.description} onChange={(e) => setIncForm({ ...incForm, description: e.target.value })} rows={3} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fecha y hora de detección *</Label>
                <Input type="datetime-local" value={incForm.detectedAt} onChange={(e) => setIncForm({ ...incForm, detectedAt: e.target.value })} />
                <p className="text-xs text-muted-foreground">Desde aquí corren las 72 horas.</p>
              </div>
              <div className="space-y-2">
                <Label>Titulares afectados (aprox.)</Label>
                <Input type="number" value={incForm.subjectCountEstimate} onChange={(e) => setIncForm({ ...incForm, subjectCountEstimate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>¿Qué se vio afectado?</Label>
              <div className="flex gap-2">
                {[["C", "Confidencialidad"], ["I", "Integridad"], ["D", "Disponibilidad"]].map(([k, label]) => (
                  <Button key={k} type="button" size="sm"
                    variant={incForm.dimensions.includes(k) ? "default" : "outline"}
                    onClick={() => setIncForm({ ...incForm, dimensions: toggle(incForm.dimensions, k) })}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categorías de datos comprometidas</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(DP_CATEGORY_LABELS).map(([k, label]) => (
                  <Button key={k} type="button" size="sm"
                    variant={incForm.dataCategories.includes(k) ? "default" : "outline"}
                    onClick={() => setIncForm({ ...incForm, dataCategories: toggle(incForm.dataCategories, k) })}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Severidad</Label>
              <Select value={incForm.severity} onValueChange={(v) => setIncForm({ ...incForm, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewIncident(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => createIncident.mutate()} disabled={!incForm.title || createIncident.isPending}>
              Registrar e iniciar el reloj de 72 h
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newProcedure} onOpenChange={setNewProcedure}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar procedimiento de la SPDP</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={procForm.procedureType} onValueChange={(v) => setProcForm({ ...procForm, procedureType: v })}>
                <SelectTrigger data-testid="select-procedure-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DP_PROCEDURE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Número de expediente</Label>
                <Input value={procForm.fileNumber} onChange={(e) => setProcForm({ ...procForm, fileNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fecha de notificación *</Label>
                <Input type="date" value={procForm.notifiedAt} onChange={(e) => setProcForm({ ...procForm, notifiedAt: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Plazo otorgado</Label>
                <Input type="date" value={procForm.deadline} onChange={(e) => setProcForm({ ...procForm, deadline: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción del requerimiento</Label>
              <Textarea value={procForm.description} onChange={(e) => setProcForm({ ...procForm, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Medidas correctivas dispuestas (una por línea)</Label>
              <Textarea
                value={procForm.correctiveMeasures}
                onChange={(e) => setProcForm({ ...procForm, correctiveMeasures: e.target.value })}
                rows={4}
                placeholder={"Publicar la política de protección de datos\nSuscribir contratos de encargo con proveedores"}
              />
              <p className="text-xs text-muted-foreground">
                Cada línea se convierte en una acción de tu plan con la fecha límite del procedimiento.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProcedure(false)}>Cancelar</Button>
            <Button onClick={() => createProcedure.mutate()} disabled={createProcedure.isPending}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LopdpLayout>
  );
}
