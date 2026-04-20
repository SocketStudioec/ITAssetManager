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
import Applications from "@/pages/applications";
import Contracts from "@/pages/contracts";
import Licenses from "@/pages/licenses";
import Maintenance from "@/pages/maintenance";
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
          <Route path="/applications" component={Applications} />
          <Route path="/contracts" component={Contracts} />
          <Route path="/licenses" component={Licenses} />
          <Route path="/maintenance" component={Maintenance} />
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
