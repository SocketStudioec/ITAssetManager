/**
 * CAMBIO OBLIGATORIO DE CONTRASEÑA
 *
 * Se muestra sobre toda la app cuando el usuario entró con la contraseña
 * temporal que le puso el administrador (users.must_change_password = TRUE).
 *
 * No se puede cerrar: mientras la marca siga encendida el backend responde
 * 403 PASSWORD_CHANGE_REQUIRED a cualquier otra ruta de la API, así que la
 * única salida es definir una contraseña nueva (o cerrar sesión).
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyRound } from "lucide-react";

export default function ForcePasswordChange() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await apiRequest("POST", "/api/auth/change-password", {
        newPassword: password,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contraseña actualizada",
        description: "Ya puedes usar el sistema con tu contraseña nueva.",
      });
      // Recargar para que toda la app arranque con la sesión ya desbloqueada
      queryClient.clear();
      window.location.reload();
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message.replace(/^\d+:\s*/, ""));
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (newPassword.trim().length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    changePasswordMutation.mutate(newPassword.trim());
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/logout", {});
    } catch {
      // Si falla, igual mandamos al login
    }
    window.location.href = "/login";
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        /* [&>button]:hidden oculta la X de cerrar: el diálogo no es opcional */
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>Define tu contraseña</DialogTitle>
          <DialogDescription>
            Estás usando una contraseña temporal que te dio el administrador.
            Para continuar, crea una contraseña propia.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="force-new-password">Contraseña nueva</Label>
            <Input
              id="force-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              autoFocus
              data-testid="input-force-new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="force-confirm-password">Repetir contraseña</Label>
            <Input
              id="force-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Escríbela otra vez"
              autoComplete="new-password"
              data-testid="input-force-confirm-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" data-testid="text-force-password-error">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={changePasswordMutation.isPending}
            data-testid="button-force-password-submit"
          >
            {changePasswordMutation.isPending ? "Guardando..." : "Guardar y continuar"}
          </Button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Cerrar sesión
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
