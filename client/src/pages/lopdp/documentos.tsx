/**
 * DOCUMENTOS LEGALES — generación, edición, versionado y publicación.
 *
 * Un documento generado vale la mitad del puntaje; publicado (firmado o
 * publicado de verdad) vale el total. La UI lo dice explícitamente.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import LopdpLayout, { LopdpNav, useLopdpCompany } from "@/components/lopdp/lopdp-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Download, FileText, Plus, Trash2, CheckCircle2 } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  generated: "Generado",
  published: "Publicado / firmado",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  generated: "secondary",
  published: "default",
};

export default function LopdpDocumentos() {
  const [companyId] = useLopdpCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState("");
  const [viewing, setViewing] = useState<any | null>(null);
  const [content, setContent] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/dp", companyId, "documents"],
    enabled: Boolean(companyId),
  });

  const documents: any[] = data?.documents ?? [];
  const catalog: any[] = data?.catalog ?? [];

  const generate = useMutation({
    mutationFn: async (docType: string) => {
      const res = await apiRequest("POST", `/api/dp/${companyId}/documents`, { docType });
      return res.json();
    },
    onSuccess: (doc: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dp", companyId] });
      toast({ title: "Documento generado", description: `${doc.title} (versión ${doc.version})` });
    },
    onError: (e: any) => toast({ title: "No se pudo generar", description: e.message, variant: "destructive" }),
  });

  const openDoc = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("GET", `/api/dp/${companyId}/documents/${id}`);
      return res.json();
    },
    onSuccess: (doc: any) => {
      setViewing(doc);
      setContent(doc.content);
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const res = await apiRequest("PUT", `/api/dp/${companyId}/documents/${id}`, body);
      return res.json();
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dp", companyId] });
      const a = res.assessment;
      toast({
        title: "Documento actualizado",
        description: a ? `Cumplimiento ${Number(a.complianceScore).toFixed(0)} (${a.complianceGrade})` : undefined,
      });
      setViewing(null);
    },
    onError: (e: any) => toast({ title: "No se pudo actualizar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/dp/${companyId}/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dp", companyId] });
      toast({ title: "Documento eliminado" });
    },
  });

  return (
    <LopdpLayout title="Documentos legales" subtitle="Generados con los datos reales de tu empresa">
      <LopdpNav current="/lopdp/documentos" />

      <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20">
        <CardContent className="p-4 text-sm">
          <strong>Aviso legal.</strong> Estos documentos son plantillas de apoyo al cumplimiento generadas con
          la información que registraste. <strong>No constituyen asesoría legal</strong>: revísalos con un
          profesional del derecho antes de firmarlos, publicarlos o presentarlos ante la Superintendencia.
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Generar un documento</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger data-testid="select-doc-type">
                <SelectValue placeholder="Elige el documento que necesitas" />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((c) => (
                  <SelectItem key={c.docType} value={c.docType}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => selectedType && generate.mutate(selectedType)}
            disabled={!selectedType || generate.isPending}
            data-testid="button-generate-doc"
          >
            <Plus className="mr-2 h-4 w-4" />Generar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tus documentos ({documents.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : documents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no generaste documentos. Empieza por tu política de protección de datos.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-2 font-medium">Documento</th>
                    <th className="pb-2 font-medium">Versión</th>
                    <th className="pb-2 font-medium">Estado</th>
                    <th className="pb-2 font-medium">Actualizado</th>
                    <th className="pb-2 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-border/50" data-testid={`doc-${doc.docType}`}>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium">{doc.title}</span>
                        </div>
                      </td>
                      <td className="py-2 text-muted-foreground">v{doc.version}</td>
                      <td className="py-2">
                        <Badge variant={STATUS_VARIANT[doc.status] ?? "outline"}>
                          {STATUS_LABEL[doc.status] ?? doc.status}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {new Date(doc.updatedAt).toLocaleDateString("es-EC")}
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openDoc.mutate(doc.id)}>Ver / editar</Button>
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`/api/dp/${companyId}/documents/${doc.id}/download`} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          {doc.status !== "published" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => update.mutate({ id: doc.id, body: { status: "published" } })}
                              title="Marcar como publicado o firmado"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => remove.mutate(doc.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted-foreground">
                Un documento generado suma la mitad del puntaje. Márcalo como publicado o firmado
                (✓ verde) para ganar el puntaje completo.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
          <DialogHeader><DialogTitle>{viewing?.title} · v{viewing?.version}</DialogTitle></DialogHeader>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[55vh] font-mono text-xs"
            data-testid="textarea-doc-content"
          />
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setViewing(null)}>Cerrar</Button>
            <Button
              variant="outline"
              onClick={() => viewing && update.mutate({ id: viewing.id, body: { content } })}
              disabled={update.isPending}
            >
              Guardar cambios
            </Button>
            <Button
              onClick={() => viewing && update.mutate({ id: viewing.id, body: { content, status: "published" } })}
              disabled={update.isPending}
              data-testid="button-publish-doc"
            >
              Guardar y marcar como publicado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LopdpLayout>
  );
}
