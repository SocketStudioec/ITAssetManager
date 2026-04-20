/**
 * COMPONENTE HEADER PRINCIPAL
 * 
 * Header global de la aplicación que se muestra en todas las páginas.
 * Integra navegación, notificaciones, perfil de usuario y modo soporte.
 * 
 * FUNCIONALIDADES:
 * - Título dinámico según la página actual
 * - Sistema de notificaciones en tiempo real
 * - Dropdown de perfil de usuario con logout
 * - Indicador visual de modo soporte para super admins
 * - Badge de notificaciones no leídas
 * - Avatar personalizado con fallback a iniciales
 * 
 * NOTIFICACIONES:
 * - Obtiene notificaciones de la empresa seleccionada
 * - Muestra contador de no leídas con badge rojo
 * - Formateo inteligente de fechas (relativo vs. absoluto)  
 * - Marca como leídas al hacer click
 * - Scroll area para manejar múltiples notificaciones
 * 
 * MODO SOPORTE:
 * - Detecta automáticamente si el super admin está en modo soporte
 * - Muestra banner naranja distintivo
 * - Información de la empresa que se está soportando
 * - Botón para salir del modo soporte
 * 
 * RESPONSIVE:
 * - Adaptado para desktop y mobile
 * - Iconos claros y reconocibles
 * - Colores consistentes con el tema de la app
 * 
 * USADO EN: Todas las páginas principales de la aplicación
 */

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, LogOut, AlertTriangle, Calendar, ExternalLink, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  selectedCompanyId?: string;
}

export default function Header({ title, subtitle, selectedCompanyId }: HeaderProps) {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  // Get notifications from API
  const { data: notifications = [] } = useQuery({
    queryKey: ["/api/notifications", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  // Get unread notification count
  const { data: unreadData } = useQuery({
    queryKey: ["/api/notifications/unread-count", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  const unreadCount = unreadData?.count || 0;

  // Check if user is super admin in support mode
  const { data: supportStatus } = useQuery({
    queryKey: ["/api/admin/support-status"],
    enabled: user?.role === 'super_admin',
    retry: false,
    refetchInterval: 10000, // Check every 10 seconds
  });

  // Format notification date
  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'hace unos minutos';
    } else if (diffInHours < 24) {
      return `hace ${Math.floor(diffInHours)} hora${Math.floor(diffInHours) === 1 ? '' : 's'}`;
    } else {
      return date.toLocaleDateString('es-ES');
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/mark-read`, { method: 'POST' });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const hasNotifications = unreadCount > 0;

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const getDisplayName = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName || lastName) {
      return `${firstName || ""} ${lastName || ""}`.trim();
    }
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
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-4 border-b">
                <h4 className="font-semibold text-sm">Notificaciones</h4>
                <p className="text-xs text-muted-foreground">
                  {notifications.length === 0 ? 'No hay notificaciones' : `${notifications.length} notificación${notifications.length === 1 ? '' : 'es'}`}
                </p>
              </div>
              <ScrollArea className="max-h-64">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No hay notificaciones
                  </div>
                ) : (
                  notifications.map((notification: any) => (
                    <div 
                      key={notification.id} 
                      className={`p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer ${
                        notification.type.includes('expired') ? 'bg-destructive/5' : 'bg-warning/5'
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                          notification.type.includes('expired') ? 'text-destructive' : 'text-warning'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatNotificationDate(notification.createdAt)}
                          </p>
                        </div>
                        <Badge variant={notification.type === 'expired' ? 'destructive' : 'outline'} className="text-xs">
                          {notification.type === 'expired' ? 'Vencido' : `${notification.daysLeft}d`}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
              {notifications.length > 0 && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowNotifications(false)}>
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Ver todas las aplicaciones
                  </Button>
                </div>
              )}
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
