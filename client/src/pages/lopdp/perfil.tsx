/**
 * ASISTENTE GUIADO DEL PERFIL LOPDP
 *
 * Diseñado para alguien que NO sabe de protección de datos. Cada bloque empieza
 * explicando el concepto, cada pregunta va en lenguaje cotidiano con un ejemplo
 * de su sector, y "No sé" es una respuesta válida que genera trabajo concreto
 * en lugar de una respuesta falsa.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import LopdpLayout, { LopdpNav, useLopdpCompany } from "@/components/lopdp/lopdp-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, HelpCircle, Lightbulb, Plus, Trash2, X, GraduationCap,
} from "lucide-react";
import { DP_SECTOR_LABELS, type DpSector } from "@shared/lopdp";

type Answer = true | false | "unknown" | undefined;

interface GuideQuestion {
  key: string;
  question: string;
  whatItMeans: string;
  example: string;
  ifYouDont: string;
  legalBasis: string;
  takeaway: string;
}
interface GuideStep {
  key: string;
  title: string;
  intro: string;
  whyItMatters: string;
  questions: GuideQuestion[];
}
interface Guide {
  welcome: {
    title: string;
    paragraphs: string[];
    glossary: Array<{ term: string; definition: string }>;
  };
  steps: GuideStep[];
  sector: string | null;
  answers: Record<string, any>;
}

/** Convierte **negritas** del contenido didáctico en markup real. */
function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

/** Tarjeta de una pregunta: enunciado, ayuda desplegable y tres respuestas. */
function QuestionCard({
  q, value, onAnswer,
}: { q: GuideQuestion; value: Answer; onAnswer: (v: true | false | "unknown") => void }) {
  const [open, setOpen] = useState(false);
  const answered = value !== undefined;

  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        answered ? "border-border bg-muted/30" : "border-primary/40"
      }`}
      data-testid={`question-${q.key}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex-1 font-medium">{q.question}</p>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1 text-muted-foreground"
          onClick={() => setOpen((o) => !o)}
          data-testid={`help-${q.key}`}
        >
          <HelpCircle className="h-4 w-4" />
          {open ? "Ocultar" : "¿Qué significa?"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-md bg-background p-3 text-sm">
          <RichText text={q.whatItMeans} className="text-muted-foreground" />
          {q.example && (
            <div className="flex gap-2 rounded bg-muted p-2">
              <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">En tu caso: </span>
                {q.example}
              </p>
            </div>
          )}
          <p className="text-muted-foreground">
            <span className="font-medium text-destructive">Si no lo tienes: </span>
            {q.ifYouDont}
          </p>
          <Badge variant="outline">{q.legalBasis}</Badge>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={value === true ? "default" : "outline"}
          onClick={() => onAnswer(true)}
          data-testid={`answer-yes-${q.key}`}
        >
          <Check className="mr-1 h-4 w-4" />Sí
        </Button>
        <Button
          size="sm"
          variant={value === false ? "destructive" : "outline"}
          onClick={() => onAnswer(false)}
          data-testid={`answer-no-${q.key}`}
        >
          <X className="mr-1 h-4 w-4" />No
        </Button>
        <Button
          size="sm"
          variant={value === "unknown" ? "secondary" : "outline"}
          onClick={() => onAnswer("unknown")}
          data-testid={`answer-unknown-${q.key}`}
        >
          <HelpCircle className="mr-1 h-4 w-4" />No sé
        </Button>
      </div>

      {/* Lo que el usuario acaba de aprender al responder */}
      {answered && (
        <div className="mt-3 flex gap-2 rounded bg-emerald-50 p-2 text-xs dark:bg-emerald-950/30">
          <GraduationCap className="h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-emerald-900 dark:text-emerald-200">{q.takeaway}</p>
        </div>
      )}
      {value === "unknown" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Sin problema: lo pondremos en tu lista de cosas por averiguar, con el siguiente paso concreto.
        </p>
      )}
    </div>
  );
}

export default function LopdpPerfil() {
  const [companyId] = useLopdpCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: guide } = useQuery<Guide>({
    queryKey: ["/api/dp", companyId, "guide"],
    enabled: Boolean(companyId),
  });
  const { data: profile } = useQuery<any>({
    queryKey: ["/api/dp", companyId, "profile"],
    enabled: Boolean(companyId),
  });

  // -1 = pantalla de bienvenida; luego 0 = datos de la empresa; después los bloques
  const [stepIndex, setStepIndex] = useState(-1);
  const [sector, setSector] = useState<DpSector>("otro");
  const [legalRepName, setLegalRepName] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [revenue, setRevenue] = useState("");
  const [dpoName, setDpoName] = useState("");
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
    setArcoChannel(profile.arcoChannel ?? "");
    setIsProcessor(profile.isProcessor === true);
    setAnswers(profile.questionnaire ?? {});
    setPurposes(profile.questionnaire?.purposes ?? []);
    // Si ya completó el asistente antes, no lo obligamos a ver la bienvenida.
    if (profile.wizardCompletedAt) setStepIndex(0);
  }, [profile]);

  const steps = guide?.steps ?? [];
  const totalQuestions = useMemo(
    () => steps.reduce((n, s) => n + s.questions.length, 0),
    [steps],
  );
  const answeredCount = useMemo(
    () => steps.reduce((n, s) => n + s.questions.filter((q) => answers[q.key] !== undefined).length, 0),
    [steps, answers],
  );
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const save = useMutation({
    mutationFn: async (completed: boolean) => {
      const res = await apiRequest("PUT", `/api/dp/${companyId}/profile`, {
        sector,
        legalRepName: legalRepName || null,
        employeeCount: employeeCount || null,
        annualRevenueRange: revenue || null,
        dpoName: dpoName || null,
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
      if (completed) {
        toast({
          title: "¡Listo! Ya tienes tu evaluación",
          description: a
            ? `Cumplimiento ${Number(a.complianceScore).toFixed(0)} (${a.complianceGrade}) · riesgo ${Number(a.riskScore).toFixed(0)} (${a.riskGrade})`
            : undefined,
        });
        navigate("/lopdp");
      } else {
        toast({ title: "Avance guardado", description: "Puedes seguir después desde donde lo dejaste." });
      }
    },
    onError: (e: any) => toast({ title: "No se pudo guardar", description: e.message, variant: "destructive" }),
  });

  const setAnswer = (key: string, value: true | false | "unknown") =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const isLastStep = stepIndex === steps.length;
  const currentStep = stepIndex > 0 ? steps[stepIndex - 1] : null;

  // -------------------------------------------------------------------------
  // Pantalla de bienvenida
  // -------------------------------------------------------------------------
  if (stepIndex === -1) {
    return (
      <LopdpLayout title="Protección de datos" subtitle="Empecemos por lo básico">
        <LopdpNav current="/lopdp/perfil" />
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-primary" />
              <CardTitle>{guide?.welcome.title ?? "Antes de empezar"}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {guide?.welcome.paragraphs.map((p, i) => (
              <RichText key={i} text={p} className="text-sm text-muted-foreground" />
            ))}

            <div className="rounded-lg border border-border p-4">
              <p className="mb-3 text-sm font-medium">Seis palabras que vas a ver seguido</p>
              <dl className="space-y-2">
                {guide?.welcome.glossary.map((g) => (
                  <div key={g.term} className="text-sm">
                    <dt className="font-medium">{g.term}</dt>
                    <dd className="text-muted-foreground">{g.definition}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">Toma unos 10 minutos. Puedes pausar y seguir después.</p>
              <Button onClick={() => setStepIndex(0)} data-testid="button-start-guide">
                Empezar<ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </LopdpLayout>
    );
  }

  // -------------------------------------------------------------------------
  // Asistente
  // -------------------------------------------------------------------------
  return (
    <LopdpLayout title="Protección de datos" subtitle="Responde con lo que hay hoy, no con lo que debería haber">
      <LopdpNav current="/lopdp/perfil" />

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {stepIndex === 0
                ? "Tu empresa"
                : isLastStep
                  ? "Revisión final"
                  : `Paso ${stepIndex} de ${steps.length}: ${currentStep?.title}`}
            </span>
            <span className="text-muted-foreground">{answeredCount} de {totalQuestions} preguntas</span>
          </div>
          <Progress value={progress} className="mt-2 h-2" />
        </CardContent>
      </Card>

      {/* ---------- Paso 0: datos de la empresa ---------- */}
      {stepIndex === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cuéntanos de tu empresa</CardTitle>
            <p className="text-sm text-muted-foreground">
              Con esto adaptamos las preguntas y los ejemplos a lo que tú haces.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>¿A qué se dedica tu empresa?</Label>
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
              <Label>¿Quién es el representante legal?</Label>
              <Input value={legalRepName} onChange={(e) => setLegalRepName(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div className="space-y-2">
              <Label>¿Cuántas personas trabajan contigo?</Label>
              <Input type="number" value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>¿Cuánto facturas al año, aproximadamente?</Label>
              <Select value={revenue} onValueChange={setRevenue}>
                <SelectTrigger data-testid="select-revenue"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="<100k">Menos de $100.000</SelectItem>
                  <SelectItem value="100k-500k">$100.000 – $500.000</SelectItem>
                  <SelectItem value="500k-1m">$500.000 – $1.000.000</SelectItem>
                  <SelectItem value=">1m">Más de $1.000.000</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Las multas de la ley se calculan sobre la facturación. Con esto estimamos cuánto arriesgas.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>¿A qué correo pueden escribirte tus clientes para pedir sus datos?</Label>
              <Input
                value={arcoChannel}
                onChange={(e) => setArcoChannel(e.target.value)}
                placeholder="datos@tuempresa.com"
                data-testid="input-arco-channel"
              />
              <p className="text-xs text-muted-foreground">
                Si no tienes uno, sirve tu correo de contacto habitual. Lo importante es que alguien lo revise.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------- Pasos 1..N: bloques temáticos ---------- */}
      {currentStep && (
        <>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">{currentStep.title}</h3>
              </div>
              <RichText text={currentStep.intro} className="text-sm text-muted-foreground" />
              <div className="flex gap-2 rounded bg-background p-3">
                <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm">
                  <span className="font-medium">Por qué importa: </span>
                  <span className="text-muted-foreground">{currentStep.whyItMatters}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {currentStep.questions.map((q) => (
              <QuestionCard key={q.key} q={q} value={answers[q.key]} onAnswer={(v) => setAnswer(q.key, v)} />
            ))}
          </div>

          {/* La pregunta del encargado vive en el bloque de inventario */}
          {currentStep.key === "inventario" && (
            <Card>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div>
                  <Label className="font-medium">¿Manejas datos POR CUENTA de tus clientes?</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Típico en estudios contables: llevas la nómina de tu cliente, así que tratas los datos de
                    empleados que no son tuyos. Si es tu caso, además de responsable eres <strong>encargado</strong> y
                    necesitas un contrato con tu cliente.
                  </p>
                </div>
                <Switch checked={isProcessor} onCheckedChange={setIsProcessor} data-testid="switch-is-processor" />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ---------- Último paso: finalidades ---------- */}
      {isLastStep && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por último: ¿para qué usas los datos?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Anota cada uso en palabras simples y marca por qué la ley te lo permite. Cada línea se convierte en
              una fila de tu Registro de Actividades de Tratamiento, el documento que te va a pedir la autoridad.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {purposes.map((p, idx) => (
              <div key={idx} className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1 space-y-1">
                  <Label className="text-xs">¿Para qué?</Label>
                  <Input
                    value={p.name}
                    onChange={(e) => {
                      const next = [...purposes];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setPurposes(next);
                    }}
                    placeholder="Ej.: atender pacientes, facturar, pagar sueldos"
                  />
                </div>
                <div className="min-w-[200px] flex-1 space-y-1">
                  <Label className="text-xs">¿Por qué puedes hacerlo?</Label>
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
                      <SelectItem value="Consentimiento del titular (art. 7.1)">La persona me dio permiso</SelectItem>
                      <SelectItem value="Ejecución de un contrato (art. 7.2)">Lo necesito para atenderla</SelectItem>
                      <SelectItem value="Obligación legal (art. 7.4)">Una ley me obliga a guardarlo</SelectItem>
                      <SelectItem value="Interés legítimo (art. 7.7)">Tengo un interés legítimo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setPurposes(purposes.filter((_, i) => i !== idx))}>
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
              <Plus className="mr-2 h-4 w-4" />Agregar uso
            </Button>

            {purposes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Sugerencia: casi toda empresa tiene al menos “atender a mis clientes”, “facturar” y “pagar sueldos”.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------- Navegación ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={stepIndex <= 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />Anterior
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => save.mutate(false)} disabled={save.isPending}>
            Guardar y seguir después
          </Button>
          {isLastStep ? (
            <Button onClick={() => save.mutate(true)} disabled={save.isPending} data-testid="button-finish-guide">
              Ver mi evaluación<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setStepIndex((i) => i + 1)} data-testid="button-next-step">
              Siguiente<ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </LopdpLayout>
  );
}
