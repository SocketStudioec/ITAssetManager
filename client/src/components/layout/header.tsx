/**
 * COMPONENTE HEADER PRINCIPAL
 *
 * Header global con título de página, campana de vencimientos y menú de usuario.
 *
 * CAMPANA DE VENCIMIENTOS:
 * - Consume /api/notifications/:companyId (vencimientos calculados en tiempo real)
 * - Badge con el conteo de alertas activas (no descartadas)
 * - Popover con las próximas alertas; permite descartar y navegar a la página
 * - Si no se pasa selectedCompanyId, usa la primera empresa del usuario
 *   (así la campana funciona en todas las páginas)
 */

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, LogOut, AlertTriangle, CalendarClock, ArrowRight, Wrench, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useLocation } from "wouter";

interface HeaderProps {
  title: string;
  subtitle?: string;
  selectedCompanyId?: string;
}

export default function Header({ title, subtitle, selectedCompanyId }: HeaderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  // Modo soporte (super admin)
  const { data: supportStatus } = useQuery<any>({
    queryKey: ["/api/admin/support-status"],
    enabled: user?.role === "super_admin",
    retry: false,
    refetchInterval: 10000,
  });

  // Empresas del usuario: fallback cuando la página no pasa selectedCompanyId
  const { data: userCompanies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    enabled: !selectedCompanyId && !supportStatus?.supportMode,
  });

  const companyId =
    selectedCompanyId ||
    supportStatus?.company?.id ||
    (userCompanies[0]?.company?.id ?? "");

  // Vencimientos (calculados en tiempo real en el backend)
  const { data: expirations = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications", companyId],
    enabled: !!companyId,
    refetchInterval: 5 * 60 * 1000, // refrescar cada 5 min
  });

  const active = expirations.filter((e) => !e.dismissed);
  const unreadCount = active.length;
  const hasNotifications = unreadCount > 0;

  const dismiss = async (key: string) => {
    if (!companyId) return;
    try {
      await apiRequest("POST", `/api/notifications/${companyId}/dismiss`, { key });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", companyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count", companyId] });
    } catch (error) {
      console.error("Error al descartar la notificación:", error);
    }
  };

  const describeDays = (daysLeft: number) => {
    if (daysLeft < 0) return `Venció hace ${Math.abs(daysLeft)} día${Math.abs(daysLeft) === 1 ? "" : "s"}`;
    if (daysLeft === 0) return "Vence hoy";
    return `Vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`;
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const getDisplayName = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName || lastName) return `${firstName || ""} ${lastName || ""}`.trim();
    return email || "Usuario";
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-foreground" data-testid="text-page-title">{title}</h2>
            {supportStatus?.supportMode && (
              <Badge variant="destructive" className="text-white">
                <Wrench className="w-3 h-3 mr-1" />
                Modo Soporte: {supportStatus.company?.name}
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground hover:text-foreground"
                data-testid="button-notifications"
              >
                <Bell className="w-5 h-5" />
                {hasNotifications && (
                  <Badge className="absolute -top-1 -right-1 min-w-[1.2rem] h-5 p-1 text-xs bg-destructive text-destructive-foreground">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">Vencimientos</h4>
                  <p className="text-xs text-muted-foreground">
                    {unreadCount === 0
                      ? "Todo al día, sin vencimientos próximos"
                      : `${unreadCount} alerta${unreadCount === 1 ? "" : "s"} en los próximos 30 días`}
                  </p>
                </div>
                <CalendarClock className="w-5 h-5 text-muted-foreground" />
              </div>
              <ScrollArea className="max-h-72">
                {unreadCount === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No tienes vencimientos por atender.
                  </div>
                ) : (
                  active.slice(0, 8).map((item) => (
                    <div
                      key={item.key}
                      className={`p-3 border-b last:border-b-0 hover:bg-muted/50 ${
                        item.severity === "expired" ? "bg-destructive/5" : ""
                      }`}
                      data-testid={`notif-${item.key}`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            item.severity === "expired"
                              ? "text-destructive"
                              : item.severity === "critical"
                              ? "text-orange-500"
                              : "text-yellow-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {item.kindLabel}: {item.entityName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {describeDays(item.daysLeft)} · {new Date(item.date).toLocaleDateString("es-ES")}
                          </p>
                        </div>
                        <button
                          onClick={() => dismiss(item.key)}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Descartar"
                          data-testid={`dismiss-${item.key}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    setShowNotifications(false);
                    navigate("/expirations");
                  }}
                  data-testid="button-see-all-expirations"
                >
                  Ver todos los vencimientos
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 p-2" data-testid="button-user-menu">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.profileImageUrl || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials(user?.firstName, user?.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground" data-testid="text-user-name">
                    {getDisplayName(user?.firstName, user?.lastName, user?.email)}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-user-role">
                    {user?.role === "super_admin" ? "Super Administrador" :
                     user?.role === "technical_admin" ? "Administrador TI" :
                     "Gerente/Propietario"}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={async () => {
                try {
                  await fetch('/api/logout', { method: 'POST', credentials: 'include' });
                  window.location.href = '/login';
                } catch (error) {
                  console.error('Error logging out:', error);
                  window.location.href = '/login';
                }
              }} data-testid="button-logout">
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
