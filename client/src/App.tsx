import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Register from "@/pages/register";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import PhysicalAssets from "@/pages/physical-assets";
import Subscriptions from "@/pages/subscriptions";
import Contracts from "@/pages/contracts";
import Maintenance from "@/pages/maintenance";
import Expirations from "@/pages/expirations";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import AdminPanel from "@/pages/admin";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public routes (always available) */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/assets" component={PhysicalAssets} />
          {/* Módulo fusionado: aplicaciones + licencias = suscripciones */}
          <Route path="/subscriptions" component={Subscriptions} />
          {/* Rutas antiguas: siguen funcionando, muestran el módulo fusionado */}
          <Route path="/applications" component={Subscriptions} />
          <Route path="/licenses" component={Subscriptions} />
          <Route path="/contracts" component={Contracts} />
          <Route path="/maintenance" component={Maintenance} />
          <Route path="/expirations" component={Expirations} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={Settings} />
          <Route path="/admin" component={AdminPanel} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
