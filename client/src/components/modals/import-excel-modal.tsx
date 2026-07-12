import { ChangeEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";

type ImportKind = "assets" | "applications";

interface ImportExcelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  kind: ImportKind;
}

interface ImportError {
  row: string | number;
  error: string;
}

interface ImportResult {
  importedCount: number;
  errors: ImportError[];
}

function normalizeErrors(errors: unknown): ImportError[] {
  if (!Array.isArray(errors)) {
    return [];
  }

  return errors.map((item, index) => {
    if (typeof item === "string") {
      return {
        row: index + 1,
        error: item,
      };
    }

    if (item && typeof item === "object") {
      const value = item as Record<string, unknown>;

      return {
        row: String(value.row ?? value.fila ?? value.line ?? index + 1),
        error: String(value.error ?? value.message ?? value.reason ?? "Error de importación"),
      };
    }

    return {
      row: index + 1,
      error: String(item),
    };
  });
}

function getImportedCount(payload: Record<string, unknown>) {
  const possibleValues = [
    payload.importedCount,
    payload.imported,
    payload.successCount,
    payload.successful,
    payload.created,
    payload.count,
  ];

  const value = possibleValues.find((candidate) => candidate !== undefined && candidate !== null);
  const count = Number(value ?? 0);

  return Number.isFinite(count) ? count : 0;
}

export default function ImportExcelModal({
  open,
  onOpenChange,
  companyId,
  kind,
}: ImportExcelModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const isAssets = kind === "assets";
  const title = isAssets
    ? "Importar equipos desde Excel"
    : "Importar aplicaciones desde Excel";
  const templatePath = isAssets ? "assets" : "applications";
  const inputId = `excel-import-${kind}`;

  const resetState = () => {
    setFile(null);
    setResult(null);
    setIsUploading(false);
    setInputKey((current) => current + 1);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isUploading) {
      resetState();
    }

    if (nextOpen || !isUploading) {
      onOpenChange(nextOpen);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setResult(null);
  };

  const handleDownloadTemplate = () => {
    window.open(`/api/excel/${templatePath}-template`, "_blank");
  };

  const handleImport = async () => {
    if (!file || !companyId || isUploading) {
      return;
    }

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/excel/${kind}-import/${companyId}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      let payload: Record<string, unknown> = {};

      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        throw new Error(
          String(payload.message || payload.error || `No se pudo importar el archivo (${response.status}).`),
        );
      }

      const importedCount = getImportedCount(payload);
      const errors = normalizeErrors(payload.errors);

      setResult({
        importedCount,
        errors,
      });

      toast({
        title: "Importación completada",
        description: `Se importaron ${importedCount} registros.`,
      });
    } catch (error) {
      toast({
        title: "Error al importar",
        description: error instanceof Error
          ? error.message
          : "No se pudo importar el archivo seleccionado.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = async () => {
    if (isAssets) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/assets"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] }),
      ]);
    } else {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/assets"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/licenses"] }),
      ]);
    }

    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Descarga la plantilla, completa la información y carga un único archivo en formato XLSX.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">1. Descarga la plantilla</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Usa la estructura proporcionada para evitar errores durante la importación.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadTemplate}
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar plantilla
            </Button>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">2. Selecciona el archivo</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Solo se admite un archivo con extensión .xlsx.
              </p>
            </div>

            <input
              key={inputKey}
              id={inputId}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isUploading}
            />

            <label
              htmlFor={inputId}
              className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center outline-none transition-opacity hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            >
              <FileSpreadsheet className="mb-3 h-8 w-8 text-muted-foreground" />
              {file ? (
                <>
                  <span className="max-w-full truncate text-sm font-medium">{file.name}</span>
                  <span className="mt-1 text-sm text-muted-foreground">
                    Haz clic para seleccionar otro archivo
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium">Seleccionar archivo Excel</span>
                  <span className="mt-1 text-sm text-muted-foreground">
                    Haz clic para buscar un archivo .xlsx
                  </span>
                </>
              )}
            </label>
          </section>

          {result && (
            <section className="space-y-3" aria-live="polite">
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="font-medium">
                  Se importaron {result.importedCount} registros
                </span>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Registros que requieren revisión ({result.errors.length})
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20 text-xs">Fila</TableHead>
                          <TableHead className="text-xs">Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.errors.map((importError, index) => (
                          <TableRow key={`${importError.row}-${index}`}>
                            <TableCell className="align-top text-xs tabular-nums">
                              {importError.row}
                            </TableCell>
                            <TableCell className="text-xs text-destructive">
                              {importError.error}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={handleClose}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isUploading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={!file || !companyId || isUploading}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isUploading ? "Importando..." : "Importar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}