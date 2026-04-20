import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Shield, BarChart3, Users } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Server className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">TechAssets Pro</h1>
            </div>
            <div className="flex space-x-3">
              <Button 
                onClick={() => window.location.href = '/register'}
                variant="default"
                data-testid="button-register"
              >
                Registrarse
              </Button>
              <Button 
                onClick={() => window.location.href = '/login'}
                variant="outline"
                data-testid="button-login"
              >
                Iniciar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-background to-primary/5">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-5xl font-bold text-foreground mb-6">
            Gestión Inteligente de Activos TI
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Controla todos tus activos de TI, optimiza costos y mejora la eficiencia de tu empresa con nuestra plataforma especializada para PyMEs.
          </p>
          <div className="flex justify-center space-x-4">
            <Button 
              size="lg"
              onClick={() => window.location.href = '/register'}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3"
              data-testid="button-get-started"
            >
              Comenzar Gratis
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => window.location.href = '/login'}
              className="px-8 py-3"
              data-testid="button-login-hero"
            >
              Iniciar Sesión
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-card">
        <div className="container mx-auto px-6">
          <h3 className="text-3xl font-bold text-center text-foreground mb-12">
            Todo lo que necesitas para gestionar tu TI
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-chart-1 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Server className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-foreground">Activos Físicos</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Gestiona equipos, servidores y hardware con seguimiento completo de garantías y mantenimiento.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-chart-2 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-foreground">Aplicaciones y Licencias</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Control total de software, licencias y aplicaciones con alertas de vencimiento automáticas.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-chart-3 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-foreground">Dashboard de Costos</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Visualiza gastos mensuales y anuales con reportes detallados y análisis de tendencias.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center border-border">
              <CardHeader>
                <div className="w-12 h-12 bg-chart-4 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-foreground">Multi-empresa</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Gestiona múltiples empresas con control de acceso basado en roles y permisos granulares.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/20 py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-muted-foreground">
            © 2025 TechAssets Pro. Solución especializada para PyMEs.
          </p>
        </div>
      </footer>
    </div>
  );
}
