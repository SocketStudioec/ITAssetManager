import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Save, Send } from "lucide-react";

interface NotificationSettings {
  companyId: string;
  emailEnabled: boolean;
  recipientEmails: string;
  daysBefore: number;
  notifyLicenses: boolean;
  notifyContracts: boolean;
  notifyWarranties: boolean;
}

interface Props {
  companyId: string;
}

export default function NotificationSettings({ companyId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NotificationSettings | null>(null);

  const { data, isLoading } = useQuery<NotificationSettings>({
    queryKey: ["/api/notification-settings", companyId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/notification-settings/${companyId}`);
      return res.json();
    },
    enabled: Boolean(companyId),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: NotificationSettings) => {
      const res = await apiRequest("PUT", `/api/notification-settings/${companyId}`, {
        emailEnabled: payload.emailEnabled,
        recipientEmails: payload.recipientEmails,
        daysBefore: payload.daysBefore,
        notifyLicenses: payload.notifyLicenses,
        notifyContracts: payload.notifyContracts,
        notifyWarranties: payload.notifyWarranties,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Guardado", description: "Configuración de notificaciones actualizada." });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-settings", companyId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/notification-settings/${companyId}/test`, {
        recipientEmails: form?.recipientEmails ?? "",
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      toast({
        title: "Correo de prueba enviado",
        description: result?.message ?? "Revisa la bandeja de entrada.",
      });
    },
    onError: () => {
      toast({
        title: "No se pudo enviar",
        description: "Verifica los destinatarios y la configuración de correo.",
        variant: "destructive",
      });
    },
  });

  if (isLoading || !form) {
    return <Skeleton className="h-64 w-full" />;
  }

  const set = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Bell className="w-5 h-5 mr-2" />
          Notificaciones por correo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Activar/desactivar el envío de correos */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">Enviar recordatorios por email</h4>
            <p className="text-sm text-muted-foreground">
              Avisa automáticamente antes de que venza una licencia, contrato o garantía.
            </p>
          </div>
          <Switch
            checked={form.emailEnabled}
            onCheckedChange={(v) => set("emailEnabled", v)}
            data-testid="switch-email-enabled"
          />
        </div>

        <Separator />

        {/* Destinatarios */}
        <div className="space-y-2">
          <Label htmlFor="recipient-emails">Correos destinatarios</Label>
          <Textarea
            id="recipient-emails"
            placeholder="correo1@empresa.com, correo2@empresa.com"
            value={form.recipientEmails}
            onChange={(e) => set("recipientEmails", e.target.value)}
            disabled={!form.emailEnabled}
            data-testid="input-recipient-emails"
          />
          <p className="text-xs text-muted-foreground">
            Separa varios correos con comas. Si lo dejas vacío se usará el correo de la empresa.
          </p>
        </div>

        {/* Días de antelación */}
        <div className="space-y-2">
          <Label htmlFor="days-before">Días de antelación</Label>
          <Input
            id="days-before"
            type="number"
            min={1}
            max={365}
            className="w-32"
            value={form.daysBefore}
            onChange={(e) => set("daysBefore", parseInt(e.target.value) || 1)}
            disabled={!form.emailEnabled}
            data-testid="input-days-before"
          />
          <p className="text-xs text-muted-foreground">
            Cuántos días antes del vencimiento enviar el aviso (por defecto 1 = un día antes).
          </p>
        </div>

        <Separator />

        {/* Qué vigilar */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Qué notificar</h4>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Licencias y suscripciones</p>
              <p className="text-sm text-muted-foreground">Avisar antes del pago/vencimiento de licencias</p>
            </div>
            <Switch
              checked={form.notifyLicenses}
              onCheckedChange={(v) => set("notifyLicenses", v)}
              disabled={!form.emailEnabled}
              data-testid="switch-notify-licenses"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Contratos</p>
              <p className="text-sm text-muted-foreground">Fin y renovación de contratos</p>
            </div>
            <Switch
              checked={form.notifyContracts}
              onCheckedChange={(v) => set("notifyContracts", v)}
              disabled={!form.emailEnabled}
              data-testid="switch-notify-contracts"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Garantías de equipos</p>
              <p className="text-sm text-muted-foreground">Vencimiento de garantía de equipos físicos</p>
            </div>
            <Switch
              checked={form.notifyWarranties}
              onCheckedChange={(v) => set("notifyWarranties", v)}
              disabled={!form.emailEnabled}
              data-testid="switch-notify-warranties"
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => form && saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            data-testid="button-save-notifications"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !form.emailEnabled}
            data-testid="button-test-email"
          >
            <Send className="w-4 h-4 mr-2" />
            {testMutation.isPending ? "Enviando..." : "Enviar correo de prueba"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
