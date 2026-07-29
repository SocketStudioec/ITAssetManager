/**
 * CLASIFICACIÓN DE ACTIVOS — el diferencial del módulo.
 *
 * No pide inventario: usa los activos, licencias y contratos YA registrados en
 * TechAssets Pro y solo pregunta qué datos personales viven en cada uno.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import LopdpLayout, { LopdpNav, useLopdpCompany } from "@/components/lopdp/lopdp-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, Circle, Search, ShieldAlert } from "lucide-react";
import {
  DP_CATEGORY_LABELS, DP_SUBJECT_LABELS, DP_SENSITIVE_CATEGORIES,
  type DpDataCategory, type DpDataSubject,
} from "@shared/lopdp";

const KIND_LABEL: Record<string, string> = {
  asset: "Activo",
  license: "Licencia",
  contract: "Contrato",
};

/**
 * Pre-clasificación sugerida por el nombre del activo: el usuario confirma en
 * lugar de escribir. Reduce la fricción del paso más largo del flujo.
 */
function suggestCategories(name: string, kind: string): DpDataCategory[] {
  const n = (name || "").toLowerCase();
  if (/(clinic|paciente|historia|odonto|salud|medic)/.test(n)) return ["identificativos", "contacto", "salud"];
  if (/(nomina|nómina|rrhh|personal|empleado|talento)/.test(n)) return ["identificativos", "contacto", "laborales"];
  if (/(contab|factur|sri|tribut|banco|cobr|pago)/.test(n)) return ["identificativos", "financieros"];
  if (/(crm|cliente|venta|marketing|mail)/.test(n)) return ["identificativos", "contacto"];
  if (/(expediente|caso|juridic|jurídic|legal)/.test(n)) return ["identificativos", "contacto"];
  if (kind === "contract") return [];
  return ["identificativos"];
}

function suggestStorage(name: string): string {
  const n = (name || "").toLowerCase();
  if (/(microsoft|google|aws|azure|dropbox|zoom|office 365|m365|hubspot|salesforce)/.test(n)) return "nube_ext";
  return "local";
}

interface Row {
  entityId: string;
  entityKind: string;
  entityName: string;
  entityType: string;
  classified: boolean;
  hasPersonalData: boolean | null;
  dataCategories: string[];
  dataSubjects: string[];
  subjectCountRange: string | null;
  storageLocation: string | null;
  isProcessorAsset: boolean;
  retentionPeriod: string | null;
}

export default function LopdpClasificacion() {
  const [companyId] = useLopdpCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["/api/dp", companyId, "classifications"],
    enabled: Boolean(companyId),
  });

  const [form, setForm] = useState({
    hasPersonalData: true,
    dataCategories: [] as string[],
    dataSubjects: [] as string[],
    subjectCountRange: "<100",
    storageLocation: "local",
    isProcessorAsset: false,
    retentionPeriod: "",
  });

  const openEditor = (row: Row) => {
    setEditing(row);
    setForm({
      hasPersonalData: row.classified ? row.hasPersonalData === true : true,
      dataCategories: row.classified ? row.dataCategories : suggestCategories(row.entityName, row.entityKind),
      dataSubjects: row.classified ? row.dataSubjects : [],
      subjectCountRange: row.subjectCountRange ?? "<100",
      storageLocation: row.storageLocation ?? suggestStorage(row.entityName),
      isProcessorAsset: row.isProcessorAsset ?? row.entityKind === "contract",
      retentionPeriod: row.retentionPeriod ?? "",
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return null;
      const idField =
        editing.entityKind === "asset" ? "assetId" : editing.entityKind === "license" ? "licenseId" : "contractId";
      const res = await apiRequest("PUT", `/api/dp/${companyId}/classifications`, {
        [idField]: editing.entityId,
        hasPersonalData: form.hasPersonalData,
        dataCategories: form.hasPersonalData ? form.dataCategories : [],
        dataSubjects: form.hasPersonalData ? form.dataSubjects : [],
        subjectCountRange: form.hasPersonalData ? form.subjectCountRange : null,
        storageLocation: form.hasPersonalData ? form.storageLocation : null,
        isProcessorAsset: form.isProcessorAsset,
        retentionPeriod: form.retentionPeriod || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dp", companyId] });
      setEditing(null);
      toast({ title: "Activo clasificado", description: "La calificación se actualizará al recalcular." });
    },
    onError: (e: any) => toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" }),
  });

  const runEngine = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/dp/${companyId}/engine/run`, {});
      return res.json();
    },
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dp", companyId] });
      toast({
        title: "Evaluación actualizada",
        description: `Riesgo ${Number(d.riskScore).toFixed(0)} (${d.riskGrade}) · Cumplimiento ${Number(d.complianceScore).toFixed(0)} (${d.complianceGrade})`,
      });
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (onlyPending && r.classified) return false;
      if (search && !r.entityName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, search, onlyPending]);

  const classifiedCount = rows.filter((r) => r.classified).length;
  const progress = rows.length > 0 ? Math.round((classifiedCount / rows.length) * 100) : 0;

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  return (
    <LopdpLayout title="Clasificación de datos" subtitle="Qué datos personales vive en cada activo que ya tienes registrado">
      <LopdpNav current="/lopdp/clasificacion" />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-[220px] flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Activos clasificados</span>
              <span className="text-muted-foreground">{classifiedCount} / {rows.length}</span>
            </div>
            <Progress value={progress} className="mt-2 h-2" />
          </div>
          <Button onClick={() => runEngine.mutate()} disabled={runEngine.isPending} data-testid="button-run-engine">
            Recalcular mi riesgo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Inventario</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-56 pl-8"
                placeholder="Buscar activo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-assets"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="pending" checked={onlyPending} onCheckedChange={setOnlyPending} />
              <Label htmlFor="pending" className="cursor-pointer text-sm font-normal">Solo pendientes</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando inventario…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? "No tienes activos registrados. Agrega equipos, aplicaciones o contratos para empezar."
                : "No hay activos que coincidan con el filtro."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="pb-2 font-medium">Activo</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium">Datos personales</th>
                    <th className="pb-2 font-medium">Categorías</th>
                    <th className="pb-2 font-medium">Volumen</th>
                    <th className="pb-2 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const sensitive = row.dataCategories?.some((c) => DP_SENSITIVE_CATEGORIES.includes(c as any));
                    return (
                      <tr key={`${row.entityKind}-${row.entityId}`} className="border-b border-border/50">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            {row.classified ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="font-medium">{row.entityName}</span>
                            {sensitive && (
                              <Badge variant="destructive" className="gap-1">
                                <ShieldAlert className="h-3 w-3" />Sensible
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-muted-foreground">{KIND_LABEL[row.entityKind] ?? row.entityKind}</td>
                        <td className="py-2">
                          {!row.classified ? (
                            <span className="text-muted-foreground">Sin clasificar</span>
                          ) : row.hasPersonalData ? (
                            <Badge variant="secondary">Sí</Badge>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {(row.dataCategories ?? []).map((c) => (DP_CATEGORY_LABELS as any)[c] ?? c).join(", ") || "—"}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{row.subjectCountRange ?? "—"}</td>
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            variant={row.classified ? "ghost" : "default"}
                            onClick={() => openEditor(row)}
                            data-testid={`button-classify-${row.entityId}`}
                          >
                            {row.classified ? "Editar" : "Clasificar"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.entityName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">¿Este activo almacena o procesa datos personales?</Label>
                <p className="text-xs text-muted-foreground">Si no, igual suma a tu progreso.</p>
              </div>
              <Switch
                checked={form.hasPersonalData}
                onCheckedChange={(v) => setForm({ ...form, hasPersonalData: v })}
                data-testid="switch-has-personal-data"
              />
            </div>

            {form.hasPersonalData && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm">¿Qué categorías de datos?</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(DP_CATEGORY_LABELS).map(([key, label]) => {
                      const active = form.dataCategories.includes(key);
                      const isSensitive = DP_SENSITIVE_CATEGORIES.includes(key as any);
                      return (
                        <Button
                          key={key}
                          type="button"
                          size="sm"
                          variant={active ? (isSensitive ? "destructive" : "default") : "outline"}
                          onClick={() => setForm({ ...form, dataCategories: toggle(form.dataCategories, key) })}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                  {form.dataCategories.some((c) => DP_SENSITIVE_CATEGORIES.includes(c as any)) && (
                    <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                      Datos sensibles (art. 25 LOPDP): elevan el impacto al máximo y obligan a realizar una
                      evaluación de impacto (EIPDP, art. 42).
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">¿De quiénes son esos datos?</Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(DP_SUBJECT_LABELS).map(([key, label]) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant={form.dataSubjects.includes(key) ? "default" : "outline"}
                        onClick={() => setForm({ ...form, dataSubjects: toggle(form.dataSubjects, key) })}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm">¿Cuántas personas aproximadamente?</Label>
                    <Select value={form.subjectCountRange} onValueChange={(v) => setForm({ ...form, subjectCountRange: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<100">Menos de 100</SelectItem>
                        <SelectItem value="100-1000">100 – 1.000</SelectItem>
                        <SelectItem value="1000-10000">1.000 – 10.000</SelectItem>
                        <SelectItem value=">10000">Más de 10.000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">¿Dónde viven los datos?</Label>
                    <Select value={form.storageLocation} onValueChange={(v) => setForm({ ...form, storageLocation: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Equipos o servidor propio</SelectItem>
                        <SelectItem value="nube_ec">Nube en Ecuador</SelectItem>
                        <SelectItem value="nube_ext">Nube en el exterior</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.storageLocation === "nube_ext" && (
                  <p className="rounded bg-amber-100 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    Alojar datos fuera del Ecuador es una transferencia internacional: debe cumplir los
                    artículos 55 a 61 de la LOPDP.
                  </p>
                )}

                <div className="space-y-2">
                  <Label className="text-sm">Plazo de conservación (opcional)</Label>
                  <Input
                    value={form.retentionPeriod}
                    onChange={(e) => setForm({ ...form, retentionPeriod: e.target.value })}
                    placeholder="Ej.: 7 años por obligación tributaria"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">¿Un proveedor externo accede a estos datos por cuenta tuya?</Label>
                <p className="text-xs text-muted-foreground">
                  Si es así, necesitas un contrato de encargo del tratamiento (art. 28 LOPDP).
                </p>
              </div>
              <Switch
                checked={form.isProcessorAsset}
                onCheckedChange={(v) => setForm({ ...form, isProcessorAsset: v })}
                data-testid="switch-is-processor-asset"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-classification">
              Guardar clasificación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LopdpLayout>
  );
}
