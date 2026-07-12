import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ImagePlus,
  Loader2,
  Plus,
  QrCode,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AddPhysicalAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

type Step = 1 | 2 | 3 | 4;

interface Category {
  id: string | number;
  name: string;
  depreciationYears?: number | null;
  depreciation_years?: number | null;
  yearsOfDepreciation?: number | null;
}

interface AssetCodeResponse {
  assetCode: string;
}

interface CustomField {
  fieldName: string;
  fieldValue: string;
}

interface StepOneErrors {
  name?: string;
  category?: string;
}

interface StepTwoErrors {
  purchaseCost?: string;
  residualValue?: string;
  depreciationYears?: string;
}

interface CreatedAsset {
  id: string | number;
  assetCode?: string;
}

const steps = [
  { number: 1, label: "Información básica" },
  { number: 2, label: "Compra" },
  { number: 3, label: "Fotos y detalles" },
  { number: 4, label: "Resumen" },
] as const;

const statusLabels: Record<string, string> = {
  active: "Activo",
  maintenance: "En mantenimiento",
  inactive: "Inactivo",
  deprecated: "Obsoleto",
};

function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toIsoDate(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.replace(/^\d+:\s*/, "");
  }

  if (typeof error === "object" && error !== null) {
    const responseError = error as {
      response?: {
        data?: {
          message?: string;
        };
      };
      message?: string;
    };

    return (
      responseError.response?.data?.message ||
      responseError.message ||
      "Ocurrió un error al registrar el equipo."
    );
  }

  return "Ocurrió un error al registrar el equipo.";
}

function getCategoryYears(category: Category | undefined) {
  if (!category) {
    return null;
  }

  const value =
    category.depreciationYears ??
    category.depreciation_years ??
    category.yearsOfDepreciation;

  const years = Number(value);
  return Number.isFinite(years) && years > 0 ? years : null;
}

function normalizeCategories(
  response: Category[] | { categories?: Category[] } | undefined,
) {
  if (Array.isArray(response)) {
    return response;
  }

  return response?.categories ?? [];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function PhotoPreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
      {previewUrl && (
        <img
          src={previewUrl}
          alt={`Vista previa de ${file.name}`}
          className="h-full w-full object-cover"
        />
      )}
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute right-1 top-1 h-10 w-10"
        onClick={onRemove}
        aria-label={`Quitar ${file.name}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export default function AddPhysicalAssetModal({
  open,
  onOpenChange,
  companyId,
}: AddPhysicalAssetModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);

  const [step, setStep] = useState<Step>(1);
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [location, setLocation] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(getToday());
  const [purchaseCost, setPurchaseCost] = useState("");
  const [residualValue, setResidualValue] = useState("0");
  const [depreciationYears, setDepreciationYears] = useState("3");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [status, setStatus] = useState("active");
  const [photos, setPhotos] = useState<File[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [notes, setNotes] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryYears, setNewCategoryYears] = useState("3");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [stepOneErrors, setStepOneErrors] = useState<StepOneErrors>({});
  const [stepTwoErrors, setStepTwoErrors] = useState<StepTwoErrors>({});

  const categoriesQuery = useQuery<
    Category[] | { categories?: Category[] }
  >({
    queryKey: ["/api/categories", companyId],
    enabled: open && Boolean(companyId),
  });

  const assetCodeQuery = useQuery<AssetCodeResponse>({
    queryKey: ["/api/asset-code", companyId],
    enabled: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (open && companyId && !wasOpenRef.current) {
      void assetCodeQuery.refetch();
    }

    wasOpenRef.current = open;
  }, [open, companyId, assetCodeQuery.refetch]);

  const categories = normalizeCategories(categoriesQuery.data);
  const selectedCategory = categories.find(
    (category) => String(category.id) === categoryId,
  );
  const selectedCategoryYears = getCategoryYears(selectedCategory);
  const assetCode = assetCodeQuery.data?.assetCode ?? "";

  const purchaseCostNumber = Number(purchaseCost) || 0;
  const residualValueNumber = Number(residualValue) || 0;
  const depreciationYearsNumber = Number(depreciationYears);

  const monthlyDepreciation = useMemo(() => {
    if (
      purchaseCostNumber <= 0 ||
      !Number.isInteger(depreciationYearsNumber) ||
      depreciationYearsNumber <= 0 ||
      residualValueNumber > purchaseCostNumber
    ) {
      return null;
    }

    return (
      Math.max(purchaseCostNumber - residualValueNumber, 0) /
      (depreciationYearsNumber * 12)
    );
  }, [
    depreciationYearsNumber,
    purchaseCostNumber,
    residualValueNumber,
  ]);

  const hasChanges =
    step !== 1 ||
    Boolean(categoryId) ||
    Boolean(name.trim()) ||
    Boolean(manufacturer.trim()) ||
    Boolean(model.trim()) ||
    Boolean(serialNumber.trim()) ||
    Boolean(location.trim()) ||
    Boolean(assignedTo.trim()) ||
    purchaseDate !== getToday() ||
    Boolean(purchaseCost) ||
    residualValue !== "0" ||
    depreciationYears !== "3" ||
    Boolean(warrantyExpiry) ||
    status !== "active" ||
    photos.length > 0 ||
    customFields.some(
      (field) => field.fieldName.trim() || field.fieldValue.trim(),
    ) ||
    Boolean(notes.trim()) ||
    Boolean(newCategoryName.trim()) ||
    newCategoryYears !== "3";

  const resetForm = () => {
    setStep(1);
    setCategoryId("");
    setName("");
    setManufacturer("");
    setModel("");
    setSerialNumber("");
    setLocation("");
    setAssignedTo("");
    setPurchaseDate(getToday());
    setPurchaseCost("");
    setResidualValue("0");
    setDepreciationYears("3");
    setWarrantyExpiry("");
    setStatus("active");
    setPhotos([]);
    setCustomFields([]);
    setNotes("");
    setNewCategoryName("");
    setNewCategoryYears("3");
    setIsCreatingCategory(false);
    setStepOneErrors({});
    setStepTwoErrors({});

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const invalidateAssetQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }),
    ]);
  };

  const createAssetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/assets", {
        companyId,
        name: name.trim(),
        type: "physical",
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        serialNumber: serialNumber.trim(),
        location: location.trim(),
        assignedTo: assignedTo.trim(),
        purchaseDate: toIsoDate(purchaseDate),
        warrantyExpiry: toIsoDate(warrantyExpiry),
        notes: notes.trim(),
        status,
        categoryId: categoryId ? selectedCategory?.id ?? null : null,
        assetCode,
        purchaseCost: purchaseCostNumber,
        residualValue: residualValueNumber,
        depreciationYears:
          depreciationYears.trim() &&
          Number.isFinite(depreciationYearsNumber)
            ? depreciationYearsNumber
            : null,
      });

      const asset = (await response.json()) as CreatedAsset;
      const partialErrors: string[] = [];

      if (photos.length > 0) {
        try {
          const formData = new FormData();
          photos.forEach((photo) => formData.append("photos", photo));

          const photosResponse = await fetch(
            `/api/assets/${companyId}/${asset.id}/photos`,
            {
              method: "POST",
              body: formData,
              credentials: "include",
            },
          );

          if (!photosResponse.ok) {
            const message =
              (await photosResponse.text()) || photosResponse.statusText;
            throw new Error(message);
          }
        } catch (error) {
          partialErrors.push(`fotos: ${getErrorMessage(error)}`);
        }
      }

      const validCustomFields = customFields
        .filter((field) => field.fieldName.trim())
        .map((field) => ({
          fieldName: field.fieldName.trim(),
          fieldValue: field.fieldValue.trim(),
        }));

      if (validCustomFields.length > 0) {
        try {
          await apiRequest(
            "PUT",
            `/api/assets/${companyId}/${asset.id}/custom-fields`,
            { fields: validCustomFields },
          );
        } catch (error) {
          partialErrors.push(`campos: ${getErrorMessage(error)}`);
        }
      }

      return {
        code: asset.assetCode || assetCode,
        partialError: partialErrors.join("; "),
      };
    },
    onSuccess: async ({ code, partialError }) => {
      await invalidateAssetQueries();

      if (partialError) {
        toast({
          title: "Equipo creado con advertencias",
          description: `El equipo se creo pero fallo la subida de fotos/campos: ${partialError}`,
        });
      } else {
        toast({
          title: `Equipo ${code} creado`,
          description: "El equipo físico se registró correctamente.",
        });
      }

      resetForm();
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: "No pudimos crear el equipo",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const validateStepOne = () => {
    const errors: StepOneErrors = {};

    if (!name.trim()) {
      errors.name = "Ingresa un nombre para el equipo.";
    }

    if (!categoryId || categoryId === "__new__") {
      errors.category =
        categoryId === "__new__"
          ? "Crea la nueva categoría antes de continuar."
          : "Selecciona una categoría.";
    }

    setStepOneErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStepTwo = () => {
    const errors: StepTwoErrors = {};
    const parsedPurchaseCost = Number(purchaseCost || 0);
    const parsedResidualValue = Number(residualValue || 0);

    if (!Number.isFinite(parsedPurchaseCost) || parsedPurchaseCost < 0) {
      errors.purchaseCost = "El costo de compra debe ser mayor o igual a 0.";
    }

    if (!Number.isFinite(parsedResidualValue) || parsedResidualValue < 0) {
      errors.residualValue =
        "El valor residual debe ser mayor o igual a 0.";
    } else if (
      Number.isFinite(parsedPurchaseCost) &&
      parsedResidualValue > parsedPurchaseCost
    ) {
      errors.residualValue =
        "El valor residual no puede ser mayor que el costo de compra.";
    }

    if (
      depreciationYears.trim() &&
      (!Number.isInteger(depreciationYearsNumber) ||
        depreciationYearsNumber <= 0)
    ) {
      errors.depreciationYears =
        "Los años de depreciación deben ser un entero mayor a 0.";
    }

    setStepTwoErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (createAssetMutation.isPending) {
      return;
    }

    if (
      hasChanges &&
      !window.confirm("Se perderan los datos ingresados")
    ) {
      return;
    }

    resetForm();
    onOpenChange(false);
  };

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setStepOneErrors((current) => ({ ...current, category: undefined }));

    if (value === "__new__") {
      return;
    }

    const category = categories.find(
      (currentCategory) => String(currentCategory.id) === value,
    );
    const suggestedYears = getCategoryYears(category);

    if (suggestedYears) {
      setDepreciationYears(String(suggestedYears));
    }
  };

  const handleCreateCategory = async () => {
    const categoryName = newCategoryName.trim();
    const years = Number(newCategoryYears);

    if (!categoryName) {
      toast({
        title: "Falta el nombre de la categoría",
        description: "Ingresa un nombre para crear la categoría.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isInteger(years) || years <= 0) {
      toast({
        title: "Años de depreciación no válidos",
        description: "Ingresa un número entero mayor a 0.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingCategory(true);

    try {
      const response = await apiRequest(
        "POST",
        `/api/categories/${companyId}`,
        {
          name: categoryName,
          depreciationYears: years,
        },
      );
      const responseBody = (await response.json()) as
        | Category
        | { category?: Category };
      const createdCategory =
        "category" in responseBody && responseBody.category
          ? responseBody.category
          : (responseBody as Category);

      await queryClient.invalidateQueries({
        queryKey: ["/api/categories", companyId],
      });
      await categoriesQuery.refetch();

      setCategoryId(String(createdCategory.id));
      setDepreciationYears(
        String(getCategoryYears(createdCategory) ?? years),
      );
      setNewCategoryName("");
      setNewCategoryYears("3");
      setStepOneErrors((current) => ({
        ...current,
        category: undefined,
      }));

      toast({
        title: "Categoría creada",
        description: `${createdCategory.name || categoryName} está lista para usar.`,
      });
    } catch (error) {
      toast({
        title: "No pudimos crear la categoría",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStepOne()) {
        setStep(2);
      }
      return;
    }

    if (step === 2) {
      if (validateStepTwo()) {
        setStep(3);
      }
      return;
    }

    if (step === 3) {
      setStep(4);
    }
  };

  const handleBack = () => {
    setStep((current) => Math.max(1, current - 1) as Step);
  };

  const handleSubmit = () => {
    if (!validateStepOne()) {
      setStep(1);
      return;
    }

    if (!validateStepTwo()) {
      setStep(2);
      return;
    }

    if (!companyId) {
      toast({
        title: "No pudimos identificar la empresa",
        description: "Cierra el formulario e inténtalo nuevamente.",
        variant: "destructive",
      });
      return;
    }

    if (!assetCode) {
      toast({
        title: "El código del equipo aún no está disponible",
        description: "Espera un momento e inténtalo nuevamente.",
        variant: "destructive",
      });
      void assetCodeQuery.refetch();
      return;
    }

    createAssetMutation.mutate();
  };

  const handlePhotoSelection = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const validFiles = selectedFiles.filter(
      (file) => file.type.startsWith("image/") && file.size <= 8 * 1024 * 1024,
    );
    const availableSlots = Math.max(0, 10 - photos.length);
    const filesToAdd = validFiles.slice(0, availableSlots);

    if (
      validFiles.length !== selectedFiles.length ||
      validFiles.length > availableSlots
    ) {
      toast({
        title: "Algunas fotos no se agregaron",
        description:
          "Solo se permiten hasta 10 imágenes con un tamaño máximo de 8 MB cada una.",
        variant: "destructive",
      });
    }

    if (filesToAdd.length > 0) {
      setPhotos((current) => [...current, ...filesToAdd]);
    }

    event.target.value = "";
  };

  const updateCustomField = (
    index: number,
    key: keyof CustomField,
    value: string,
  ) => {
    setCustomFields((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, [key]: value } : field,
      ),
    );
  };

  const basicSummary = [
    { label: "Nombre", value: name.trim() },
    { label: "Categoría", value: selectedCategory?.name || "—" },
    { label: "Marca", value: manufacturer.trim() || "—" },
    { label: "Modelo", value: model.trim() || "—" },
    { label: "Número de serie", value: serialNumber.trim() || "—" },
    { label: "Ubicación", value: location.trim() || "—" },
    { label: "Asignado a", value: assignedTo.trim() || "—" },
  ];

  const purchaseSummary = [
    { label: "Fecha de compra", value: purchaseDate || "—" },
    { label: "Costo de compra", value: formatMoney(purchaseCostNumber) },
    { label: "Valor residual", value: formatMoney(residualValueNumber) },
    {
      label: "Años de depreciación",
      value: depreciationYears.trim() || "—",
    },
    { label: "Garantía hasta", value: warrantyExpiry || "—" },
    { label: "Estado", value: statusLabels[status] || status },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-5 border-b px-6 pb-5 pt-6">
          <DialogTitle>Registrar equipo físico</DialogTitle>

          <div aria-label={`Paso ${step} de 4`}>
            <div className="flex items-start">
              {steps.map((item, index) => {
                const isActive = step === item.number;
                const isCompleted = step > item.number;

                return (
                  <div
                    key={item.number}
                    className="flex min-w-0 flex-1 items-start last:flex-none"
                  >
                    <div className="flex w-20 shrink-0 flex-col items-center gap-2 sm:w-28">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium",
                          isActive &&
                            "border-primary bg-primary text-primary-foreground",
                          isCompleted &&
                            "border-primary bg-primary text-primary-foreground",
                          !isActive &&
                            !isCompleted &&
                            "border-border bg-background text-muted-foreground",
                        )}
                      >
                        {isCompleted ? (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          item.number
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-center text-xs leading-tight",
                          isActive
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.label}
                      </span>
                    </div>

                    {index < steps.length - 1 && (
                      <div
                        className={cn(
                          "mt-4 h-px min-w-2 flex-1",
                          step > item.number ? "bg-primary" : "bg-border",
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-3">
              <QrCode
                className="h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Código del equipo
                </p>
                {assetCodeQuery.isFetching ? (
                  <p className="text-sm text-muted-foreground">
                    Generando código...
                  </p>
                ) : assetCodeQuery.isError ? (
                  <button
                    type="button"
                    className="cursor-pointer text-sm font-medium text-destructive underline-offset-4 hover:underline"
                    onClick={() => void assetCodeQuery.refetch()}
                  >
                    No se pudo generar. Reintentar
                  </button>
                ) : (
                  <p className="truncate font-mono text-sm font-semibold">
                    {assetCode || "Pendiente"}
                  </p>
                )}
              </div>
            </div>

            {step === 1 && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">
                    Información básica
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Identifica el equipo y dónde se encuentra.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="physical-asset-name">Nombre*</Label>
                    <Input
                      id="physical-asset-name"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        if (stepOneErrors.name) {
                          setStepOneErrors((current) => ({
                            ...current,
                            name: undefined,
                          }));
                        }
                      }}
                      onBlur={() => {
                        if (!name.trim()) {
                          setStepOneErrors((current) => ({
                            ...current,
                            name: "Ingresa un nombre para el equipo.",
                          }));
                        }
                      }}
                      placeholder="Ej: Laptop de gerencia"
                      aria-invalid={Boolean(stepOneErrors.name)}
                    />
                    {stepOneErrors.name && (
                      <p className="text-sm text-destructive">
                        {stepOneErrors.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="physical-asset-category">
                      Categoría*
                    </Label>
                    <Select
                      value={categoryId}
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger
                        id="physical-asset-category"
                        aria-invalid={Boolean(stepOneErrors.category)}
                      >
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">
                          + Crear nueva categoría
                        </SelectItem>
                        {categories.map((category) => (
                          <SelectItem
                            key={String(category.id)}
                            value={String(category.id)}
                          >
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {stepOneErrors.category && (
                      <p className="text-sm text-destructive">
                        {stepOneErrors.category}
                      </p>
                    )}

                    {selectedCategoryYears && (
                      <Badge variant="secondary" className="font-normal">
                        Depreciación sugerida: {selectedCategoryYears} años
                      </Badge>
                    )}
                  </div>

                  {categoryId === "__new__" && (
                    <div className="space-y-4 rounded-md border bg-muted/30 p-4 sm:col-span-2">
                      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                        <div className="space-y-2">
                          <Label htmlFor="new-category-name">
                            Nombre de la categoría
                          </Label>
                          <Input
                            id="new-category-name"
                            value={newCategoryName}
                            onChange={(event) =>
                              setNewCategoryName(event.target.value)
                            }
                            placeholder="Ej: Cámaras de seguridad"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="new-category-years">
                            Años de depreciación
                          </Label>
                          <Input
                            id="new-category-years"
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={newCategoryYears}
                            onChange={(event) =>
                              setNewCategoryYears(event.target.value)
                            }
                          />
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        Norma Ecuador: cómputo 3, maquinaria/cámaras 10,
                        vehículos 5
                      </p>

                      <Button
                        type="button"
                        onClick={handleCreateCategory}
                        disabled={
                          isCreatingCategory || !newCategoryName.trim()
                        }
                      >
                        {isCreatingCategory && (
                          <Loader2
                            className="mr-2 h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        )}
                        Crear
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="physical-asset-manufacturer">Marca</Label>
                    <Input
                      id="physical-asset-manufacturer"
                      value={manufacturer}
                      onChange={(event) =>
                        setManufacturer(event.target.value)
                      }
                      placeholder="Ej: Dell"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="physical-asset-model">Modelo</Label>
                    <Input
                      id="physical-asset-model"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="Ej: Latitude 5520"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="physical-asset-serial-number">
                      Número de serie
                    </Label>
                    <Input
                      id="physical-asset-serial-number"
                      value={serialNumber}
                      onChange={(event) =>
                        setSerialNumber(event.target.value)
                      }
                      placeholder="Ej: SN-123456"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="physical-asset-location">
                      Ubicación
                    </Label>
                    <Input
                      id="physical-asset-location"
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                      placeholder="Ej: Oficina Quito"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="physical-asset-assigned-to">
                      Asignado a
                    </Label>
                    <Input
                      id="physical-asset-assigned-to"
                      value={assignedTo}
                      onChange={(event) =>
                        setAssignedTo(event.target.value)
                      }
                      placeholder="Nombre de la persona responsable"
                    />
                  </div>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">
                    Compra y depreciación
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Calcula la depreciación lineal estimada del equipo.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="physical-asset-purchase-date">
                      Fecha de compra
                    </Label>
                    <Input
                      id="physical-asset-purchase-date"
                      type="date"
                      value={purchaseDate}
                      onChange={(event) =>
                        setPurchaseDate(event.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="physical-asset-purchase-cost">
                      Costo de compra $
                    </Label>
                    <Input
                      id="physical-asset-purchase-cost"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={purchaseCost}
                      onChange={(event) => {
                        setPurchaseCost(event.target.value);
                        setStepTwoErrors((current) => ({
                          ...current,
                          purchaseCost: undefined,
                          residualValue: undefined,
                        }));
                      }}
                      onBlur={validateStepTwo}
                      placeholder="0.00"
                      aria-invalid={Boolean(stepTwoErrors.purchaseCost)}
                    />
                    {stepTwoErrors.purchaseCost && (
                      <p className="text-sm text-destructive">
                        {stepTwoErrors.purchaseCost}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="physical-asset-residual-value">
                      Valor residual $
                    </Label>
                    <Input
                      id="physical-asset-residual-value"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={residualValue}
                      onChange={(event) => {
                        setResidualValue(event.target.value);
                        setStepTwoErrors((current) => ({
                          ...current,
                          residualValue: undefined,
                        }));
                      }}
                      onBlur={validateStepTwo}
                      aria-invalid={Boolean(stepTwoErrors.residualValue)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Valor estimado al final de su vida útil.
                    </p>
                    {stepTwoErrors.residualValue && (
                      <p className="text-sm text-destructive">
                        {stepTwoErrors.residualValue}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="physical-asset-depreciation-years">
                      Años de depreciación
                    </Label>
                    <Input
                      id="physical-asset-depreciation-years"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={depreciationYears}
                      onChange={(event) => {
                        setDepreciationYears(event.target.value);
                        setStepTwoErrors((current) => ({
                          ...current,
                          depreciationYears: undefined,
                        }));
                      }}
                      onBlur={validateStepTwo}
                      aria-invalid={Boolean(
                        stepTwoErrors.depreciationYears,
                      )}
                    />
                    {stepTwoErrors.depreciationYears && (
                      <p className="text-sm text-destructive">
                        {stepTwoErrors.depreciationYears}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="physical-asset-warranty-expiry">
                      Garantía hasta
                    </Label>
                    <Input
                      id="physical-asset-warranty-expiry"
                      type="date"
                      value={warrantyExpiry}
                      onChange={(event) =>
                        setWarrantyExpiry(event.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="physical-asset-status">Estado</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger id="physical-asset-status">
                        <SelectValue placeholder="Selecciona un estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="maintenance">
                          En mantenimiento
                        </SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                        <SelectItem value="deprecated">Obsoleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <p className="text-sm font-medium">
                    Depreciación mensual estimada
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {monthlyDepreciation === null
                      ? "—"
                      : formatMoney(monthlyDepreciation)}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Gasto anual:{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {monthlyDepreciation === null
                        ? "—"
                        : formatMoney(monthlyDepreciation * 12)}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Depreciación en línea recta según la vida útil indicada.
                  </p>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">
                    Fotos y detalles adicionales
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Agrega evidencia visual e información específica.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Fotos</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoSelection}
                  />
                  <button
                    type="button"
                    className="flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-4 text-center transition-colors hover:border-primary hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus
                      className="h-6 w-6 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium">
                      Agregar fotos (máx. 10, 8 MB c/u)
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {photos.length} de 10 fotos seleccionadas
                    </span>
                  </button>

                  {photos.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {photos.map((photo, index) => (
                        <PhotoPreview
                          key={`${photo.name}-${photo.lastModified}-${index}`}
                          file={photo}
                          onRemove={() =>
                            setPhotos((current) =>
                              current.filter(
                                (_currentPhoto, photoIndex) =>
                                  photoIndex !== index,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Campos personalizados</Label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ejemplo: Etiqueta 1 = Equipo de backup.
                    </p>
                  </div>

                  {customFields.map((field, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_1fr_40px] items-center gap-2"
                    >
                      <Input
                        value={field.fieldName}
                        onChange={(event) =>
                          updateCustomField(
                            index,
                            "fieldName",
                            event.target.value,
                          )
                        }
                        placeholder="Nombre del campo"
                        aria-label={`Nombre del campo personalizado ${index + 1}`}
                      />
                      <Input
                        value={field.fieldValue}
                        onChange={(event) =>
                          updateCustomField(
                            index,
                            "fieldValue",
                            event.target.value,
                          )
                        }
                        placeholder="Valor"
                        aria-label={`Valor del campo personalizado ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setCustomFields((current) =>
                            current.filter(
                              (_field, fieldIndex) => fieldIndex !== index,
                            ),
                          )
                        }
                        aria-label={`Quitar campo personalizado ${index + 1}`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setCustomFields((current) => [
                        ...current,
                        { fieldName: "", fieldValue: "" },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Agregar campo
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="physical-asset-notes">Notas</Label>
                  <Textarea
                    id="physical-asset-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Información adicional sobre el equipo"
                    rows={4}
                  />
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">Resumen</h3>
                  <p className="text-sm text-muted-foreground">
                    Verifica los datos antes de crear el equipo.
                  </p>
                </div>

                <div className="rounded-md border bg-muted/30 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Código del equipo
                  </p>
                  <p className="mt-1 font-mono text-base font-semibold">
                    {assetCode || "Pendiente"}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">
                    Información básica
                  </h4>
                  <dl className="divide-y rounded-md border">
                    {basicSummary.map((item) => (
                      <div
                        key={item.label}
                        className="grid grid-cols-2 gap-3 px-4 py-2.5 text-sm"
                      >
                        <dt className="text-muted-foreground">
                          {item.label}
                        </dt>
                        <dd className="min-w-0 break-words text-right font-medium">
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">
                    Compra y depreciación
                  </h4>
                  <dl className="divide-y rounded-md border">
                    {purchaseSummary.map((item) => (
                      <div
                        key={item.label}
                        className="grid grid-cols-2 gap-3 px-4 py-2.5 text-sm"
                      >
                        <dt className="text-muted-foreground">
                          {item.label}
                        </dt>
                        <dd className="text-right font-medium tabular-nums">
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border px-4 py-3">
                    <p className="text-sm text-muted-foreground">Fotos</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {photos.length}
                    </p>
                  </div>
                  <div className="rounded-md border px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      Campos personalizados
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {
                        customFields.filter((field) =>
                          field.fieldName.trim(),
                        ).length
                      }
                    </p>
                  </div>
                </div>

                <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Depreciación mensual estimada
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {monthlyDepreciation === null
                      ? "—"
                      : formatMoney(monthlyDepreciation)}
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t bg-background px-6 py-4">
          <div>
            {step > 1 && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                disabled={createAssetMutation.isPending}
                data-testid="button-physical-asset-back"
              >
                Atrás
              </Button>
            )}
          </div>

          {step < 4 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={
                createAssetMutation.isPending ||
                isCreatingCategory ||
                (step === 1 && categoryId === "__new__")
              }
              data-testid="button-physical-asset-next"
            >
              Siguiente
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                createAssetMutation.isPending ||
                !companyId ||
                !assetCode
              }
              data-testid="button-submit-physical-asset"
            >
              {createAssetMutation.isPending && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {createAssetMutation.isPending
                ? "Creando equipo..."
                : "Crear equipo"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}