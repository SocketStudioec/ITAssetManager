import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Server, ArrowLeft, Building2, User } from "lucide-react";
import { companyRegistrationSchema, type CompanyRegistration } from "@shared/schema";
import { c } from "node_modules/vite/dist/node/types.d-aGj9QkWt";

export default function Register() {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<"pyme" | "professional">("pyme");
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = "/";
    }
  }, [isAuthenticated]);

  const form = useForm<CompanyRegistration>({
    resolver: zodResolver(companyRegistrationSchema),
    defaultValues: {
      plan: "pyme",
    },
    shouldFocusError: true,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: CompanyRegistration) => {
      return await apiRequest("POST", "/api/register", data);
    },
    onSuccess: () => {
      toast({
        title: "¡Registro exitoso!",
        description: "Tu empresa ha sido registrada. Redirigiendo...",
      });
      // Redirect to home (user is automatically logged in)
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Error al registrar",
        description: error.message || "Hubo un problema al crear tu cuenta",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanyRegistration) => {
 // Validar que RUC o Cédula estén presentes antes de enviar
  if (data.plan === "pyme" && !data.ruc) {
    toast({
      title: "Error",
      description: "El RUC es obligatorio para empresas PyME.",
      variant: "destructive",
    });
    return; // No continuar con el envío del formulario
  }

  if (data.plan === "professional" && !data.cedula) {
    toast({
      title: "Error",
      description: "La Cédula es obligatoria para profesionales.",
      variant: "destructive",
    });
    return; // No continuar con el envío del formulario
  }

  registerMutation.mutate(data);  // Enviar los datos al backend
};

  const onValidationFailure = (errors: any) => {
    // Esto se ejecuta SOLO si el formulario es inválido
    toast({
      title: "Formulario inválido",
      description: "Por favor revisa los campos marcados en rojo antes de continuar.",
      variant: "destructive",
    });
  };

  const handlePlanChange = (plan: "pyme" | "professional") => {
    setSelectedPlan(plan);
    form.setValue("plan", plan);
    // Reset conditional fields
    form.setValue("ruc", "");
    form.setValue("cedula", "");
  };

  const handleRucChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 13);
    form.setValue("ruc", value, { shouldValidate: true });
  };
  const handleCedulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
    form.setValue("cedula", value, { shouldValidate: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Server className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">TechAssets Pro</h1>
            </div>
            <Button
              variant="ghost"
              onClick={() => window.location.href = "/"}
              className="flex items-center space-x-2"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al inicio</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Registration Form */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Registra tu empresa
            </h2>
            <p className="text-muted-foreground">
              Comienza a gestionar tus activos tecnológicos de manera profesional
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="w-5 h-5" />
                <span>Información de la empresa</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit, onValidationFailure)} className="space-y-6">
                {/* Plan Selection */}
                <div className="space-y-2">
                  <Label htmlFor="plan">Tipo de cuenta</Label>
                  <Select
                    value={selectedPlan}
                    onValueChange={handlePlanChange}
                    data-testid="select-plan"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pyme" data-testid="option-pyme">
                        PyME - Pequeña y Mediana Empresa
                      </SelectItem>
                      <SelectItem value="professional" data-testid="option-professional">
                        Profesional - Freelancer o Consultor
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {selectedPlan === "pyme" 
                      ? "Hasta 500 activos y 10 usuarios" 
                      : "Hasta 2000 activos y 50 usuarios"}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Company Name */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name">Nombre de la empresa</Label>
                    <Input
                      {...form.register("name")}
                      placeholder="Ej: Mi Empresa S.A."
                      data-testid="input-name"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                    )}
                  </div>

                  {/* RUC or Cedula based on plan */}
                  {selectedPlan === "pyme" ? (
                    <div className="space-y-2">
                      <Label htmlFor="ruc">RUC</Label>
                      <Input
                        {...form.register("ruc")}
                        placeholder="Ej: 1234567890001"
                        onChange={handleRucChange}
                        data-testid="input-ruc"
                      />
                      {form.formState.errors.ruc && (
                        <p className="text-sm text-red-500">{form.formState.errors.ruc.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="cedula">Cédula</Label>
                      <Input
                        {...form.register("cedula")}
                        placeholder="Ej: 1234567890"
                        onChange={handleCedulaChange}
                        data-testid="input-cedula"
                      />
                      {form.formState.errors.cedula && (
                        <p className="text-sm text-red-500">{form.formState.errors.cedula.message}</p>
                      )}
                    </div>
                  )}

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="phone">Celular</Label>
                    <Input
                      {...form.register("phone")}
                      placeholder="Ej: 0987654321"
                      data-testid="input-phone"
                    />
                    {form.formState.errors.phone && (
                      <p className="text-sm text-red-500">{form.formState.errors.phone.message}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                      {...form.register("email")}
                      type="email"
                      placeholder="contacto@miempresa.com"
                      data-testid="input-email"
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                    )}
                  </div>

                  {/* Address */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Textarea
                      {...form.register("address")}
                      placeholder="Dirección completa de la empresa"
                      data-testid="input-address"
                    />
                    {form.formState.errors.address && (
                      <p className="text-sm text-red-500">{form.formState.errors.address.message}</p>
                    )}
                  </div>
                </div>

                {/* Personal Information Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Información personal (Administrador)</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* First Name */}
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Nombre</Label>
                      <Input
                        {...form.register("firstName")}
                        placeholder="Tu nombre"
                        data-testid="input-firstName"
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-sm text-red-500">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>

                    {/* Last Name */}
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Apellido</Label>
                      <Input
                        {...form.register("lastName")}
                        placeholder="Tu apellido"
                        data-testid="input-lastName"
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-sm text-red-500">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Password Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Configurar contraseña</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Password */}
                    <div className="space-y-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <Input
                        {...form.register("password")}
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        data-testid="input-password"
                      />
                      {form.formState.errors.password && (
                        <p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                      <Input
                        {...form.register("confirmPassword")}
                        type="password"
                        placeholder="Repetir contraseña"
                        data-testid="input-confirmPassword"
                      />
                      {form.formState.errors.confirmPassword && (
                        <p className="text-sm text-red-500">{form.formState.errors.confirmPassword.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-center pt-6">
                  <Button
                    type="submit"
                    className="w-full max-w-sm"
                    disabled={registerMutation.isPending}
                    data-testid="button-register"
                  >
                    {registerMutation.isPending ? "Registrando..." : "Registrar empresa"}
                  </Button>
                </div>

                {/* Login Link */}
                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    ¿Ya tienes una cuenta?{" "}
                    <button
                      type="button"
                      onClick={() => window.location.href = "/login"}
                      className="text-primary hover:underline"
                      data-testid="link-login"
                    >
                      Inicia sesión aquí
                    </button>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}