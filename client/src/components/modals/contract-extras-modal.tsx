import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { FileText, Loader2, Plus, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface ContractExtrasModalProps {
  contract: any | null;
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SupportContact {
  id: string;
  name: string;
  phone: string;
  email: string;
}

function createContact(contact?: any): SupportContact {
  return {
    id: contact?.id ? String(contact.id) : crypto.randomUUID(),
    name: String(contact?.name ?? ""),
    phone: String(contact?.phone ?? ""),
    email: String(contact?.email ?? ""),
  };
}

function parseSupportContacts(value: unknown): SupportContact[] {
  if (Array.isArray(value)) {
    return value.map(createContact);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(createContact) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido";
}

export default function ContractExtrasModal({
  contract,
  companyId,
  open,
  onOpenChange,
}: ContractExtrasModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contractFile, setContractFile] = useState<string | null>(null);
  const [contacts, setContacts] = useState<SupportContact[]>([]);
  const [contactErrors, setContactErrors] = useState<Record<string, string>>(
    {},
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingContacts, setIsSavingContacts] = useState(false);

  useEffect(() => {
    if (!contract) return;

    setContractFile(contract.contractFile ?? contract.contract_file ?? null);
    setContacts(parseSupportContacts(contract.supportContacts));
    setContactErrors({});
  }, [contract, open]);

  if (!contract) return null;

  const triggerFileSelection = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "Archivo demasiado grande",
        description: "El contrato no puede superar los 15 MB.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setIsUploading(true);

    try {
      const response = await fetch(
        `/api/contracts/${companyId}/${contract.id}/file`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        },
      );

      if (!response.ok) {
        const message = (await response.text()) || response.statusText;
        throw new Error(`${response.status}: ${message}`);
      }

      const data = await response.json();
      setContractFile(data.contractFile);

      await queryClient.invalidateQueries({
        queryKey: ["/api/contracts"],
      });

      toast({
        title: "Documento cargado",
        description: "El documento del contrato se guardó correctamente.",
      });
    } catch (error) {
      toast({
        title: "No se pudo cargar el documento",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const updateContact = (
    id: string,
    field: "name" | "phone" | "email",
    value: string,
  ) => {
    setContacts((current) =>
      current.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact,
      ),
    );

    if (field === "name" && value.trim()) {
      setContactErrors((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  };

  const removeContact = (id: string) => {
    setContacts((current) =>
      current.filter((contact) => contact.id !== id),
    );
    setContactErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const saveContacts = async () => {
    const errors = contacts.reduce<Record<string, string>>(
      (result, contact) => {
        if (!contact.name.trim()) {
          result[contact.id] = "El nombre es obligatorio.";
        }
        return result;
      },
      {},
    );

    setContactErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setIsSavingContacts(true);

    try {
      const payload = contacts.map((contact) => ({
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        email: contact.email.trim(),
      }));

      await apiRequest(
        "PUT",
        `/api/contracts/${companyId}/${contract.id}/support-contacts`,
        { contacts: payload },
      );

      await queryClient.invalidateQueries({
        queryKey: ["/api/contracts"],
      });

      toast({
        title: "Contactos guardados",
        description: "Los contactos de soporte se actualizaron correctamente.",
      });
    } catch (error) {
      toast({
        title: "No se pudieron guardar los contactos",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSavingContacts(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Soporte y documento</DialogTitle>
          <DialogDescription>
            {contract.name ?? contract.contractName ?? "Contrato"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Documento del contrato</h3>
              <p className="text-sm text-muted-foreground">
                Conserva una copia digital del contrato firmado.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {contractFile ? (
              <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">
                    Contrato cargado
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      window.open(`/uploads/${contractFile}`, "_blank")
                    }
                  >
                    Ver
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUploading}
                    onClick={triggerFileSelection}
                  >
                    {isUploading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Reemplazar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={triggerFileSelection}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">
                  Subir contrato (PDF o imagen, max 15MB)
                </span>
              </button>
            )}
          </section>

          <Separator />

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Contactos de soporte</h3>
              <p className="text-sm text-muted-foreground">
                Personas a contactar para soporte o garantías.
              </p>
            </div>

            <div className="space-y-3">
              {contacts.map((contact, index) => (
                <div key={contact.id} className="space-y-2 rounded-md border p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2">
                    <div className="space-y-2">
                      <Label htmlFor={`support-name-${contact.id}`}>
                        Nombre
                      </Label>
                      <Input
                        id={`support-name-${contact.id}`}
                        value={contact.name}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "name",
                            event.target.value,
                          )
                        }
                        className={
                          contactErrors[contact.id]
                            ? "border-destructive"
                            : undefined
                        }
                        placeholder={`Contacto ${index + 1}`}
                      />
                      {contactErrors[contact.id] && (
                        <p className="text-sm text-destructive">
                          {contactErrors[contact.id]}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-7"
                      aria-label="Eliminar contacto"
                      onClick={() => removeContact(contact.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`support-phone-${contact.id}`}>
                        Teléfono
                      </Label>
                      <Input
                        id={`support-phone-${contact.id}`}
                        type="tel"
                        value={contact.phone}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "phone",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`support-email-${contact.id}`}>
                        Email
                      </Label>
                      <Input
                        id={`support-email-${contact.id}`}
                        type="email"
                        value={contact.email}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "email",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}

              {contacts.length === 0 && (
                <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No hay contactos de soporte registrados.
                </p>
              )}
            </div>

            <div className="flex flex-col justify-between gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setContacts((current) => [...current, createContact()])
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar contacto
              </Button>
              <Button
                type="button"
                onClick={saveContacts}
                disabled={isSavingContacts}
              >
                {isSavingContacts && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Guardar contactos
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}