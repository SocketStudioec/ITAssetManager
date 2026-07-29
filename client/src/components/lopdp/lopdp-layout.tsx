/**
 * LAYOUT COMÚN DEL MÓDULO DE DATOS PERSONALES
 *
 * Resuelve en un solo lugar: sidebar + header, selección de empresa persistida,
 * y la puerta premium (paywall) cuando la empresa no tiene el módulo activo.
 */
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { usePersistedCompany } from "@/hooks/usePersistedCompany";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, ShieldCheck, Scale, FileWarning, ArrowRight } from "lucide-react";
import type { DpStatus } from "@shared/lopdp";

export function useLopdpCompany() {
  const [selectedCompanyId, setSelectedCompanyId] = usePersistedCompany();
  const { data: userCompanies = [] } = useQuery<any[]>({ queryKey: ["/api/companies"] });

  useEffect(() => {
    if (userCompanies.length === 0) return;
    const ids = userCompanies.map((uc: any) => uc.company.id);
    if (!selectedCompanyId || !ids.includes(selectedCompanyId)) {
      setSelectedCompanyId(ids[0]);
    }
  }, [userCompanies, selectedCompanyId, setSelectedCompanyId]);

  return [selectedCompanyId, setSelectedCompanyId] as const;
}

export function useLopdpStatus(companyId: string) {
  return useQuery<DpStatus>({
    queryKey: ["/api/dp", companyId, "status"],
    enabled: Boolean(companyId),
  });
}

/**
 * Paywall del módulo premium.
 *
 * Copy con enfoque de pérdida (no de característica): el usuario debe entender
 * que la obligación legal ya existe y qué le cuesta ignorarla. Cada afirmación
 * va anclada a su artículo — la autoridad legal es lo que sostiene la venta.
 */
function Paywall({ companyName }: { companyName: string }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Card className="border-2 border-primary/20">
        <CardContent className="space-y-6 p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Si te denuncian hoy, ¿qué le entregas a la Superintendencia?
              </h2>
              <p className="mt-2 text-muted-foreground">
                La Ley Orgánica de Protección de Datos Personales ya obliga a {companyName}. No es un
                proyecto futuro: es una obligación vigente, con plazos y multas.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <Scale className="mb-2 h-5 w-5 text-destructive" />
              <p className="text-sm font-medium">Multas de 0,1 % a 1 %</p>
              <p className="mt-1 text-xs text-muted-foreground">
                de tu facturación anual, según la gravedad de la infracción (arts. 80-83).
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <FileWarning className="mb-2 h-5 w-5 text-orange-600" />
              <p className="text-sm font-medium">72 horas para notificar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                una fuga de datos a la Superintendencia. El reloj corre desde que te enteras (art. 43).
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <ShieldCheck className="mb-2 h-5 w-5 text-amber-600" />
              <p className="text-sm font-medium">10 días término</p>
              <p className="mt-1 text-xs text-muted-foreground">
                para responder a un cliente que reclama sus datos. Si no respondes, escala a la SPDP (art. 62).
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium">Qué hace este módulo con los activos que ya registraste</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">1.</span>
                Clasifica qué datos personales vive en cada equipo, aplicación y contrato que ya tienes cargado.
              </li>
              <li className="flex gap-2">
                <span className="text-primary">2.</span>
                Calcula tu <strong>calificación de riesgo</strong> y tu <strong>calificación de cumplimiento
                LOPDP</strong> con la metodología oficial de la Guía de la Superintendencia.
              </li>
              <li className="flex gap-2">
                <span className="text-primary">3.</span>
                Te entrega el plan de acción priorizado: qué hacer primero y cuántos puntos sube tu calificación.
              </li>
              <li className="flex gap-2">
                <span className="text-primary">4.</span>
                Genera tus documentos legales: política de privacidad, términos y condiciones, contratos de
                manejo de datos, consentimientos y el Registro de Actividades de Tratamiento.
              </li>
              <li className="flex gap-2">
                <span className="text-primary">5.</span>
                Modo Defensa: expediente de cumplimiento en un clic cuando la autoridad lo pida.
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" asChild data-testid="button-activate-lopdp">
              <a href="mailto:ventas@socket-studio.com?subject=Activar%20m%C3%B3dulo%20de%20Datos%20Personales%20LOPDP">
                Activar mi módulo de Datos Personales
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Módulo premium. Tu administrador puede activarlo desde el panel de administración.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        La información de este módulo es de apoyo al cumplimiento y no constituye asesoría legal.
      </p>
    </div>
  );
}

interface LopdpLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Acciones del encabezado de la página (botones). */
  actions?: ReactNode;
}

export default function LopdpLayout({ title, subtitle, children, actions }: LopdpLayoutProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useLopdpCompany();
  const { data: status, isLoading } = useLopdpStatus(selectedCompanyId);
  const { data: userCompanies = [] } = useQuery<any[]>({ queryKey: ["/api/companies"] });

  const companyName =
    userCompanies.find((uc: any) => uc.company.id === selectedCompanyId)?.company.name ?? "tu empresa";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar selectedCompanyId={selectedCompanyId} onCompanyChange={setSelectedCompanyId} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} selectedCompanyId={selectedCompanyId} />
        <main className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !status?.enabled ? (
            <Paywall companyName={companyName} />
          ) : (
            <div className="space-y-6 p-6">
              {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** Navegación interna del módulo (tabs). */
export function LopdpNav({ current }: { current: string }) {
  const items = [
    { path: "/lopdp", label: "Panel" },
    { path: "/lopdp/perfil", label: "Perfil de la empresa" },
    { path: "/lopdp/clasificacion", label: "Clasificación" },
    { path: "/lopdp/riesgos", label: "Riesgos" },
    { path: "/lopdp/plan", label: "Plan de acción" },
    { path: "/lopdp/documentos", label: "Documentos" },
    { path: "/lopdp/defensa", label: "Modo Defensa" },
  ];

  return (
    <div className="flex flex-wrap gap-1 border-b border-border pb-2">
      {items.map((item) => (
        <Button
          key={item.path}
          asChild
          variant={current === item.path ? "secondary" : "ghost"}
          size="sm"
          data-testid={`nav-lopdp-${item.path.split("/").pop()}`}
        >
          <Link href={item.path}>{item.label}</Link>
        </Button>
      ))}
    </div>
  );
}
