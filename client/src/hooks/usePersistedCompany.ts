import { useCallback, useState } from "react";

/**
 * Empresa seleccionada, persistida en localStorage.
 *
 * PROBLEMA que resuelve: cada página tenía su propio `useState("")` para la
 * empresa y un efecto que ponía `companies[0]` por defecto. Al navegar entre
 * páginas o recargar, la selección se perdía y volvía SIEMPRE a la primera
 * empresa (p. ej. "Kevin Palma"), ignorando que el usuario había cambiado a
 * otra (p. ej. "Socket Studio").
 *
 * Este hook mantiene la elección entre páginas y recargas. La VALIDACIÓN de
 * que el id pertenezca a las empresas del usuario la sigue haciendo cada
 * página en su efecto (si el id guardado no está en su lista, cae a la
 * primera). El setter persiste cada cambio.
 */
const STORAGE_KEY = "ta-selected-company";

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function usePersistedCompany() {
  const [selectedCompanyId, setState] = useState<string>(() => readStored());

  const setSelectedCompanyId = useCallback((companyId: string) => {
    try {
      if (companyId) localStorage.setItem(STORAGE_KEY, companyId);
    } catch {
      /* localStorage no disponible: seguimos solo en memoria */
    }
    setState(companyId);
  }, []);

  return [selectedCompanyId, setSelectedCompanyId] as const;
}
