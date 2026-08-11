/**
 * GESTIÓN DE USUARIOS DEL PANEL DE ADMINISTRACIÓN
 *
 * Tabla con todos los usuarios del sistema y su empresa, para que el super
 * administrador pueda restablecerle la contraseña a cualquiera cuando alguien
 * no puede entrar.
 *
 * FLUJO DEL RESET:
 * 1. El admin escribe la contraseña temporal que le va a dar al usuario.
 * 2. Con "Pedir cambio al ingresar" activado (por defecto), el usuario entra
 *    con esa clave y la app lo obliga a definir una propia antes de seguir.
 * 3. El admin ve el badge "Debe cambiar clave" hasta que el usuario lo haga.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyRound, Search, ShieldAlert, Eye, EyeOff } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  mustChangePassword: boolean;
  companies: string[];
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  manager_owner: "Gerente / dueño",
  technical_admin: "Admin técnico",
  technician: "Técnico",
};

/** Contraseña temporal legible: sin caracteres ambiguos (0/O, 1/l). */
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";

  for (let index = 0; index < 10; index += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return password;
}

export default function UsersPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [targetUser, setTargetUser] = useState<AdminUser | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [requireChange, setRequireChange] = useState(true);

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, ...body }: { userId: string; password: string; requireChange: boolean }) => {
      const response = await apiRequest(
        "POST",
        `/api/admin/users/${userId}/reset-password`,
        body
      );
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Contraseña restablecida",
        description: data?.message ?? "La contraseña se actualizó correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "No se pudo restablecer",
        description: error.message.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      });
    },
  });

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return users;
    }

    return users.filter((user) =>
      [user.firstName, user.lastName, user.email, ...(user.companies ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [users, search]);

  const openDialog = (user: AdminUser) => {
    setTargetUser(user);
    setPassword("");
    setShowPassword(true);
    setRequireChange(true);
  };

  const closeDialog = () => {
    setTargetUser(null);
    setPassword("");
  };

  const handleSubmit = () => {
    if (!targetUser) {
      return;
    }

    if (password.trim().length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "Debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({
      userId: targetUser.id,
      password: password.trim(),
      requireChange,
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Usuarios</CardTitle>
            <CardDescription>
              Restablece la contraseña de cualquier usuario que no pueda ingresar
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, correo o empresa"
              className="pl-9"
              data-testid="input-search-users"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Cargando usuarios...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {users.length === 0
                ? "No hay usuarios registrados"
                : "Ningún usuario coincide con la búsqueda"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">
                        {`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.companies?.length ? user.companies.join(", ") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ROLE_LABELS[user.role] ?? user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.mustChangePassword ? (
                          <Badge variant="secondary" className="gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            Debe cambiar clave
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Activo</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDialog(user)}
                          data-testid={`button-reset-password-${user.id}`}
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          Restablecer contraseña
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={targetUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>
              {targetUser
                ? `Le vas a fijar una contraseña nueva a ${targetUser.email}. Anótala: no se puede volver a ver.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-reset-password">Contraseña temporal</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="admin-reset-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleSubmit();
                      }
                    }}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPassword(generateTempPassword());
                    setShowPassword(true);
                  }}
                >
                  Generar
                </Button>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Pedir cambio al ingresar</p>
                <p className="text-xs text-muted-foreground">
                  El usuario entra con esta clave y la app lo obliga a definir la suya
                  antes de poder usar el sistema.
                </p>
              </div>
              <Switch
                checked={requireChange}
                onCheckedChange={setRequireChange}
                data-testid="switch-require-change"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={resetPasswordMutation.isPending}
              data-testid="button-confirm-reset"
            >
              {resetPasswordMutation.isPending ? "Guardando..." : "Restablecer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
