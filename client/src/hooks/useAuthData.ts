import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AuthData {
  userId: string;
}

/**
 * Hook para obtener el ID del usuario logueado haciendo una llamada al endpoint /api/me.
 * Este endpoint es seguro ya que usa la cookie httpOnly para la autenticación.
 */
export function useAuthData( ) {
  const { data, isLoading, isError } = useQuery<AuthData>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me");
      return res.json();
    },
    staleTime: Infinity, // El ID del usuario no cambia durante la sesión
  });

  return {
    userId: data?.userId,
    isLoading,
    isError,
  };
}
