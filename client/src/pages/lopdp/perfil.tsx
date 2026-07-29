/**
 * PERFIL LOPDP — cuestionario adaptativo por sector.
 *
 * Cada respuesta en falso es una vulnerabilidad que alimenta el motor de
 * riesgos y el plan de acción. Las preguntas están redactadas en lenguaje
 * llano: el usuario no es abogado.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import LopdpLayout, { LopdpNav, useLopdpCompany } from "@/components/lopdp/lopdp-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Save, Trash2 } from "lucide-react";
import { DP_SECTOR_LABELS, type DpSector } from "@shared/lopdp";

interface Question {
  key: string;
  label: string;
  help?: string;
}

const LEGAL_QUESTIONS: Question[] = [
  { key: "hasLegalBasis", label: "¿Tienes identificada la base legal de cada uso que le das a los datos?", help: "Consentimiento, contrato, obligación legal o interés legítimo (art. 7 LOPDP)." },
  { key: "hasRat", label: "¿Tienes un Registro de Actividades de Tratamiento (RAT)?", help: "Documento obligatorio del art. 37. El módulo puede generarlo por ti." },
  { key: "hasPrivacyPolicy", label: "¿Tienes publicada una política de protección de datos?", help: "En tu web, consultorio u oficina, accesible al cliente." },
  { key: "hasConsent", label: "¿Recoges consentimiento documentado cuando corresponde?", help: "Firmado o con registro digital; debe poder revocarse igual de fácil." },
  { key: "hasDpaContracts", label: "¿Firmaste contratos de manejo de datos con tus proveedores?", help: "Todo proveedor que acceda a datos de tus clientes lo necesita (art. 28)." },
  { key: "hasArcoChannel", label: "¿Tienes un canal para que un cliente pida o borre sus datos?", help: "Correo o formulario visible. Debes responder en 10 días término (art. 62)." },
  { key: "hasEipdp", label: "¿Realizaste una evaluación de impacto (EIPDP)?", help: "Obligatoria si tratas datos sensibles o de menores (art. 42)." },
  { key: "hasBreachProtocol", label: "¿Tienes un protocolo escrito para cuando haya una fuga de datos?", help: "Debes notificar a la Superintendencia en 72 horas (art. 43)." },
  { key: "hasDpo", label: "¿Designaste un Delegado de Protección de Datos?", help: "Obligatorio si tratas datos sensibles a gran escala (arts. 47-49)." },
];

const ORG_QUESTIONS: Question[] = [
  { key: "hasTraining", label: "¿Capacitaste a tu personal en protección de datos en el último año?" },
  { key: "hasAccessControl", label: "¿Cada persona accede solo a los datos que necesita para su trabajo?", help: "Principio de mínimo privilegio." },
  { key: "hasSecurityPolicy", label: "¿Tienes reglas internas escritas de seguridad de la información?" },
  { key: "hasNda", label: "¿Tu personal firmó acuerdos de confidencialidad?" },
];

const TECH_QUESTIONS: Question[] = [
  { key: "hasBackups", label: "¿Haces respaldos y comprobaste que se pueden restaurar?", help: "Un respaldo que nunca se probó no cuenta como control." },
  { key: "hasEncryption", label: "¿Los datos están cifrados (en los equipos y al enviarlos)?" },
  { key: "hasMfa", label: "¿Usas verificación en dos pasos (MFA) en correo y sistemas?" },
  { key: "hasAntivirus", label: "¿Tienes antivirus y actualizaciones al día?" },
  { key: "hasDeviceLock", label: "¿Los equipos tienen contraseña y bloqueo automático?" },
  { key: "hasAuditLogs", label: "¿Guardas registros de quién accede a los datos?" },
];

const SECTOR_QUESTIONS: Record<string, Question[]> = {
  salud: [
    { key: "clinicalRecordsDigital", label: "¿Las historias clínicas están digitalizadas?" },
    { key: "consentIncludesData", label: "¿Tu consentimiento informado menciona el tratamiento de datos personales?" },
  ],
  odontologia: [
    { key: "clinicalRecordsDigital", label: "¿Las fichas de pacientes están digitalizadas?" },
    { key: "consentIncludesData", label: "¿Tu consentimiento informado menciona el tratamiento de datos personales?" },
  ],
  contable: [
    { key: "treatmentIsCoreActivity", label: "¿Procesas datos por cuenta de tus clientes (nómina, facturación)?", help: "Si es así, actúas como ENCARGADO y necesitas el contrato espejo (art. 28)." },
  ],
  legal: [
    { key: "filesDigitized", label: "¿Los expedientes de clientes están digitalizados?" },
  ],
};

function QuestionRow({
  question, value, onChange,
}: { question: Question; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <Label htmlFor={question.key} className="cursor-pointer text-sm font-normal">
          {question.label}
        </Label>
        {question.help && <p className="mt-1 text-xs text-muted-foreground">{question.help}</p>}
      </div>
      <Switch
        id={question.key}
        checked={value}
        onCheckedChange={onChange}
        data-testid={`switch-${question.key}`}
      />
    </div>
  );
}

export default function LopdpPerfil() {
  const [companyId] = useLopdpCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: profile } = useQuery<any>({
    queryKey: ["/api/dp", companyId, "profile"],
    enabled: Boolean(companyId),
  });

  const [sector, setSector] = useState<DpSector>("otro");
  const [legalRepName, setLegalRepName] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [revenue, setRevenue] = useState("");
  const [dpoName, setDpoName] = useState("");
  const [dpoEmail, setDpoEmail] = useState("");
  const [arcoChannel, setArcoChannel] = useState("");
  const [isProcessor, setIsProcessor] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [purposes, setPurposes] = useState<Array<{ name: string; basis: string }>>([]);

  useEffect(() => {
    if (!profile) return;
    setSector(profile.sector ?? "otro");
    setLegalRepName(profile.legalRepName ?? "");
    setEmployeeCount(profile.employeeCount != null ? String(profile.employeeCount) : "");
    setRevenue(profile.annualRevenueRange ?? "");
    setDpoName(profile.dpoName ?? "");
    setDpoEmail(profile.dpoEmail ?? "");
    setArcoChannel(profile.arcoChannel ?? "");
    setIsProcessor(profile.isProcessor === true);
    setAnswers(profile.questionnaire ?? {});
    setPurposes(profile.questionnaire?.purposes ?? []);
  }, [profile]);

  const save = useMutation({
    mutationFn: async (completed: boolean) => {
      const res = await apiRequest("PUT", `/api/dp/${companyId}/profile`, {
        sector,
        legalRepName: legalRepName || null,
        employeeCount: employeeCount || null,
        annualRevenueRange: revenue || null,
        dpoName: dpoName || null,
        dpoEmail: dpoEmail || null,
        arcoChannel: arcoChannel || null,
        isProcessor,
        questionnaire: { ...answers, purposes },
        completed,
      });
      return res.json();
    },
    onSuccess: (data: any, completed) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dp", companyId] });
      const a = data.assessment;
      toast({
        title: "Perfil guardado",
        description: a
          ? `Tu calificación: riesgo ${Number(a.riskScore).toFixed(0)} (${a.riskGrade}) · cumplimiento ${Number(
              a.complianceScore,
            ).toFixed(0)} (${a.complianceGrade})`
          : "Evaluación actualizada",
      });
      if (completed) navigate("/lopdp/clasificacion");
    },
    onError: (e: any) => toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" }),
  });

  const setAnswer = (key: string, value: boolean) => setAnswers((prev) => ({ ...prev, [key]: value }));
  const sectorQuestions = SECTOR_QUESTIONS[sector] ?? [];

  return (
    <LopdpLayout title="Perfil de la empresa" subtitle="Responde con honestidad: lo que declaras determina tu calificación">
      <LopdpNav current="/lopdp/perfil" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidad del responsable del tratamiento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Sector de actividad</Label>
            <Select value={sector} onValueChange={(v) => setSector(v as DpSector)}>
              <SelectTrigger data-testid="select-sector"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DP_SECTOR_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Representante legal</Label>
            <Input value={legalRepName} onChange={(e) => setLegalRepName(e.target.value)} placeholder="Nombre completo" />
          </div>
          <div className="space-y-2">
            <Label>Número de empleados</Label>
            <Input type="number" value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>Facturación anual aproximada</Label>
            <Select value={revenue} onValueChange={setRevenue}>
              <SelectTrigger data-testid="select-revenue"><SelectValue placeholder="Seleccionar rango" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="<100k">Menos de $100.000</SelectItem>
                <SelectItem value="100k-500k">$100.000 – $500.000</SelectItem>
                <SelectItem value="500k-1m">$500.000 – $1.000.000</SelectItem>
                <SelectItem value=">1m">Más de $1.000.000</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Se usa para estimar la multa potencial (arts. 80-83).</p>
          </div>
          <div className="space-y-2">
            <Label>Delegado de Protección de Datos (si tienes)</Label>
            <Input value={dpoName} onChange={(e) => setDpoName(e.target.value)} placeholder="Nombre" />
          </div>
          <div className="space-y-2">
            <Label>Correo del delegado</Label>
            <Input value={dpoEmail} onChange={(e) => setDpoEmail(e.target.value)} placeholder="correo@empresa.com" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Canal para que los clientes ejerzan sus derechos</Label>
            <Input
              value={arcoChannel}
              onChange={(e) => setArcoChannel(e.target.value)}
              placeholder="datos@tuempresa.com o enlace al formulario"
              data-testid="input-arco-channel"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Para qué usas los datos personales?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cada finalidad se convierte en una fila de tu Registro de Actividades de Tratamiento (art. 37).
          </p>
          {purposes.map((p, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1 space-y-1">
                <Label className="text-xs">Finalidad</Label>
                <Input
                  value={p.name}
                  onChange={(e) => {
                    const next = [...purposes];
                    next[idx] = { ...next[idx], name: e.target.value };
                    setPurposes(next);
                  }}
                  placeholder="Ej.: facturación, historia clínica, nómina"
                />
              </div>
              <div className="min-w-[200px] flex-1 space-y-1">
                <Label className="text-xs">Base legal</Label>
                <Select
                  value={p.basis}
                  onValueChange={(v) => {
                    const next = [...purposes];
                    next[idx] = { ...next[idx], basis: v };
                    setPurposes(next);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consentimiento del titular (art. 7.1)">Consentimiento del titular</SelectItem>
                    <SelectItem value="Ejecución de un contrato (art. 7.2)">Ejecución de un contrato</SelectItem>
                    <SelectItem value="Obligación legal (art. 7.4)">Obligación legal</SelectItem>
                    <SelectItem value="Interés legítimo (art. 7.7)">Interés legítimo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPurposes(purposes.filter((_, i) => i !== idx))}
                aria-label="Eliminar finalidad"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPurposes([...purposes, { name: "", basis: "" }])}
            data-testid="button-add-purpose"
          >
            <Plus className="mr-2 h-4 w-4" />Agregar finalidad
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado actual de cumplimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {LEGAL_QUESTIONS.map((q) => (
              <QuestionRow key={q.key} question={q} value={answers[q.key] === true} onChange={(v) => setAnswer(q.key, v)} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organización y personas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {ORG_QUESTIONS.map((q) => (
              <QuestionRow key={q.key} question={q} value={answers[q.key] === true} onChange={(v) => setAnswer(q.key, v)} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medidas técnicas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {TECH_QUESTIONS.map((q) => (
              <QuestionRow key={q.key} question={q} value={answers[q.key] === true} onChange={(v) => setAnswer(q.key, v)} />
            ))}
          </div>
        </CardContent>
      </Card>

      {sectorQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preguntas de tu sector: {DP_SECTOR_LABELS[sector]}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {sectorQuestions.map((q) => (
                <QuestionRow key={q.key} question={q} value={answers[q.key] === true} onChange={(v) => setAnswer(q.key, v)} />
              ))}
              <div className="flex items-start justify-between gap-4 py-3">
                <div>
                  <Label className="text-sm font-normal">¿Tratas datos por cuenta de tus clientes?</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Si es así, además de responsable actúas como <strong>encargado del tratamiento</strong>.
                  </p>
                </div>
                <Switch checked={isProcessor} onCheckedChange={setIsProcessor} data-testid="switch-is-processor" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save.mutate(true)} disabled={save.isPending} data-testid="button-save-profile">
          <Save className="mr-2 h-4 w-4" />
          Guardar y ver mi nivel de riesgo
        </Button>
        <Button variant="outline" onClick={() => save.mutate(false)} disabled={save.isPending}>
          Guardar borrador
        </Button>
      </div>
    </LopdpLayout>
  );
}
