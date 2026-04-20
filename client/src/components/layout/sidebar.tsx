import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Server,
  BarChart3,
  Monitor,
  Laptop,
  FileText,
  Key,
  Wrench,
  PieChart,
  Settings,
  ChevronDown,
  Crown,
} from "lucide-react";

interface SidebarProps {
  selectedCompanyId: string;
  onCompanyChange: (companyId: string) => void;
  showAdminPanel?: boolean;
}

const getNavigationItems = (isAdmin: boolean, showAdminPanel: boolean) => {
  const items = [
    { path: "/", icon: BarChart3, label: "Dashboard" },
    { path: "/assets", icon: Monitor, label: "Activos Físicos" },
    { path: "/applications", icon: Laptop, label: "Aplicaciones" },
    { path: "/contracts", icon: FileText, label: "Contratos" },
    { path: "/licenses", icon: Key, label: "Membresías" },
    { path: "/maintenance", icon: Wrench, label: "Mantenimiento" },
    { path: "/reports", icon: PieChart, label: "Reportes" },
    { path: "/settings", icon: Settings, label: "Configuración" },
  ];

  if (isAdmin && !showAdminPanel) {
    items.push({ path: "/admin", icon: Crown, label: "Administración" });
  }

  return items;
};

export default function Sidebar({ selectedCompanyId, onCompanyChange, showAdminPanel }: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Check if we're in support mode
  const { data: supportStatus } = useQuery({
    queryKey: ["/api/admin/support-status"],
    enabled: user?.role === 'super_admin',
    retry: false,
    refetchInterval: 10000,
  });
  
  const { data: userCompanies = [] } = useQuery({
    queryKey: ["/api/companies"],
    enabled: !supportStatus?.supportMode,
  });

  // Use support company or user companies
  const companies = supportStatus?.supportMode 
    ? [{ company: supportStatus.company }] 
    : userCompanies;

  const isAdmin = user?.role === 'super_admin';
  const navigationItems = getNavigationItems(isAdmin, showAdminPanel || false);

  const selectedCompany = companies.find((uc: any) => uc.company.id === selectedCompanyId);

  return (
    <aside className="w-64 bg-card border-r border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Server className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">TechAssets Pro</h1>
        </div>
        
        {/* Company Selector - Hide in admin panel */}
        {!showAdminPanel && (
          <Select value={selectedCompanyId} onValueChange={onCompanyChange}>
            <SelectTrigger className="w-full" data-testid="select-company">
              <SelectValue placeholder="Seleccionar empresa">
                {selectedCompany?.company.name || "Seleccionar empresa"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {companies.map((uc: any) => (
                <SelectItem key={uc.company.id} value={uc.company.id} data-testid={`option-company-${uc.company.id}`}>
                  {uc.company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {/* Admin Panel Indicator */}
        {showAdminPanel && (
          <div className="flex items-center space-x-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <Crown className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Panel de Admin</span>
          </div>
        )}
      </div>
      
      <nav className="p-4 space-y-2">
        {navigationItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          
          return (
            <Link key={item.path} href={item.path}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                data-testid={`nav-${item.path.replace('/', '') || 'dashboard'}`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
