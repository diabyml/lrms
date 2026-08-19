// src/pages/ResultFormPage.tsx

import React, {
  useState,
  useEffect,
  FormEvent,
  useCallback,
  useMemo,
} from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient"; // Adjust path if needed
import { cn, extractTestTypeName } from "@/lib/utils"; // Adjust path if needed
import { TestTypeSelector } from "@/components/TestTypeSelector";

// --- Shadcn/ui Imports ---
import { Button } from "@/components/ui/button"; // Adjust path
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Adjust path
import { Label } from "@/components/ui/label"; // Adjust path
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"; // Adjust path
import { Calendar } from "@/components/ui/calendar"; // Adjust path
import { Input } from "@/components/ui/input"; // Adjust path
import { Checkbox } from "@/components/ui/checkbox"; // Adjust path
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path
import { Skeleton } from "@/components/ui/skeleton"; // Adjust path
import { Separator } from "@/components/ui/separator"; // Adjust path

// import Select as SearchableSelect from 'react-select
import SearchableSelect from "react-select";

// --- Icons & Date Handling ---
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  AlertCircle,
  Loader2,
  FlaskConical,
  User,
  Stethoscope,
  Check,
  X,
  Edit as EditIcon,
  RefreshCw,
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns"; // Added isValid
import { fr } from "date-fns/locale";

// --- Types ---
type Patient = Tables<"patient">;
type Doctor = Tables<"doctor">;
type TestType = Tables<"test_type">;
type TestParameter = Tables<"test_parameter">;
type ResultValue = Tables<"result_value">;
type PatientResult = Tables<"patient_result">; // Added PatientResult type

type Category = {
  id: string;
  name: string;
};

interface TestParameterWithResult extends TestParameter {
  resultValue?: string;
  isVisible?: boolean;
  originalValueId?: string | null; // ID from result_value table if editing
}
interface SelectedTestType extends TestType {
  parameters: TestParameterWithResult[];
  loadingParams: boolean;
  errorLoadingParams?: boolean;
}
type ResultFormBootstrapPayload = {
  patient: Patient;
  doctors: Doctor[];
  categories: Category[];
  testTypes: TestType[];
  result: PatientResult | null;
  selectedTestTypes: SelectedTestType[];
  originalResultValues: ResultValue[];
};
// --- End Types ---

const ResultFormPage: React.FC = () => {
  // --- Hooks ---
  const { patientId: patientIdFromRoute, resultId } = useParams<{
    patientId?: string;
    resultId?: string;
  }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(resultId);

  // --- State ---
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isFree, setIsFree] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(
    patientIdFromRoute || null
  );
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableTestTypes, setAvailableTestTypes] = useState<TestType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>(
    undefined
  );
  const [resultDate, setResultDate] = useState<Date | undefined>(new Date());
  const [selectedTestTypes, setSelectedTestTypes] = useState<
    Map<string, SelectedTestType>
  >(new Map());
  const [loadingInitialData, setLoadingInitialData] = useState<boolean>(true);
  const [loadingSubmit, setLoadingSubmit] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [originalResultValues, setOriginalResultValues] = useState<
    ResultValue[]
  >([]);
  const [normalPrice, setNormalPrice] = useState<number | "" | undefined>("");
  const [insurancePrice, setInsurancePrice] = useState<number | "" | undefined>(
    ""
  );
  // unpaid amount state
  const [unpaidAmount, setUnpaidAmount] = useState<number | "" | undefined>("");
  // --- End State ---

  // --- Data Fetching ---
  const fetchBootstrapData = useCallback(async () => {
    if (!patientIdFromRoute && !resultId) {
      setError("ID du patient ou du résultat manquant.");
      setLoadingInitialData(false);
      return;
    }

    setLoadingInitialData(true);
    setError(null);
    try {
      const { data, error: bootstrapError } = await supabase.rpc(
        "get_result_form_bootstrap",
        {
          p_patient_id: isEditMode ? null : patientIdFromRoute || null,
          p_result_id: isEditMode ? resultId || null : null,
        }
      );

      if (bootstrapError) throw bootstrapError;
      if (!data) throw new Error("Impossible de charger le formulaire.");

      const payload = data as ResultFormBootstrapPayload;
      const resultData = payload.result;
      const initialSelectedTypes = new Map<string, SelectedTestType>();

      (payload.selectedTestTypes || []).forEach((testType) => {
        initialSelectedTypes.set(testType.id, {
          ...testType,
          parameters: (testType.parameters || []).map((parameter) => ({
            ...parameter,
            resultValue: parameter.resultValue || "",
            isVisible: parameter.isVisible !== false,
            originalValueId: parameter.originalValueId || null,
          })),
          loadingParams: false,
          errorLoadingParams: false,
        });
      });

      setPatient(payload.patient);
      setCurrentPatientId(resultData?.patient_id || payload.patient.id);
      setDoctors(payload.doctors || []);
      setCategories(payload.categories || []);
      setAvailableTestTypes(payload.testTypes || []);
      setOriginalResultValues(payload.originalResultValues || []);
      setSelectedTestTypes(initialSelectedTypes);
      setSelectedDoctorId(resultData?.doctor_id || undefined);
      setResultDate(
        resultData?.result_date ? new Date(resultData.result_date) : new Date()
      );
      setNormalPrice(resultData?.normal_price ?? "");
      setUnpaidAmount(resultData?.unpaid_amount ?? "");
      setInsurancePrice(resultData?.insurance_price ?? "");
      setIsFree(!!resultData?.isFree);
      setNotes(resultData?.notes ?? "");
    } catch (err: any) {
      /* ... error handling ... */
      console.error("Erreur chargement données du formulaire:", err);
      setError(
        err.message || "Impossible de charger les informations nécessaires."
      );
    } finally {
      setLoadingInitialData(false);
    }
  }, [isEditMode, patientIdFromRoute, resultId]);

  useEffect(() => {
    fetchBootstrapData();
  }, [fetchBootstrapData]);
  // --- End Data Fetching ---

  const loadParametersForTestType = useCallback(
    async (testTypeId: string) => {
      const testType = availableTestTypes.find((tt) => tt.id === testTypeId);
      if (!testType) return;

      setSelectedTestTypes((prevMap) => {
        const newMap = new Map(prevMap);
        const existingEntry = newMap.get(testTypeId);
        const newSelectedType: SelectedTestType = {
          ...(existingEntry || testType),
          parameters: existingEntry?.parameters || [],
          loadingParams: true,
          errorLoadingParams: false,
        };
        newMap.set(testTypeId, newSelectedType);
        return newMap;
      });

      try {
        const { data, error } = await supabase
          .from("test_parameter")
          .select(`*, test_type:test_type_id(id, name), order`)
          .eq("test_type_id", testTypeId)
          .order("order");

        if (error) throw error;

        setSelectedTestTypes((currentMap) => {
          const finalMap = new Map(currentMap);
          const entry = finalMap.get(testTypeId);
          if (entry) {
            const existingParamsMap = new Map(
              entry.parameters.map((p) => [p.id, p])
            );
            const mergedParams = (data || []).map((paramDef) => {
              const existingParamState = existingParamsMap.get(paramDef.id);
              return {
                ...paramDef,
                resultValue: existingParamState?.resultValue || "",
                isVisible: existingParamState?.isVisible !== false,
                originalValueId: existingParamState?.originalValueId || null,
              };
            });
            const updatedEntry: SelectedTestType = {
              ...entry,
              parameters: mergedParams,
              loadingParams: false,
              errorLoadingParams: false,
            };
            finalMap.set(testTypeId, updatedEntry);
            return finalMap;
          }
          return currentMap;
        });
      } catch (err: any) {
        console.error(`Erreur chargement paramètres pour ${testType.name}:`, err);
        setSelectedTestTypes((currentMap) => {
          const errorMap = new Map(currentMap);
          const entry = errorMap.get(testTypeId);
          if (entry) {
            const updatedEntry: SelectedTestType = {
              ...entry,
              loadingParams: false,
              errorLoadingParams: true,
            };
            errorMap.set(testTypeId, updatedEntry);
            return errorMap;
          }
          return currentMap;
        });
      }
    },
    [availableTestTypes]
  );

  // --- handleTestTypeToggle ---
  const handleTestTypeToggle = useCallback(
    async (checked: boolean | "indeterminate", testTypeId: string) => {
      const testType = availableTestTypes.find((tt) => tt.id === testTypeId);
      if (!testType) return;

      if (checked === true) {
        await loadParametersForTestType(testTypeId);
      } else {
        // Unchecked
        setSelectedTestTypes((prevMap) => {
          /* ... remove from map ... */
          const newMap = new Map(prevMap);
          newMap.delete(testTypeId);
          return newMap;
        });
      }
    },
    [availableTestTypes, loadParametersForTestType]
  ); // Dependency: availableTestTypes

  // --- handleParameterChange ---
  const handleParameterChange = (
    testTypeId: string,
    parameterId: string,
    value: string
  ) => {
    setSelectedTestTypes((prevMap) => {
      /* ... immutable update ... */
      const newMap = new Map(prevMap);
      const testTypeEntry = newMap.get(testTypeId);
      if (testTypeEntry) {
        const newParameters = testTypeEntry.parameters.map((param) =>
          param.id === parameterId ? { ...param, resultValue: value } : param
        );
        const updatedEntry: SelectedTestType = {
          ...testTypeEntry,
          parameters: newParameters,
        };
        newMap.set(testTypeId, updatedEntry);
        return newMap;
      }
      return prevMap;
    });
  };

  // --- handleParameterRemove ---
  const handleParameterRemove = (testTypeId: string, parameterId: string) => {
    setSelectedTestTypes((prevMap) => {
      /* ... immutable update ... */
      const newMap = new Map(prevMap);
      const testTypeEntry = newMap.get(testTypeId);
      if (testTypeEntry) {
        const newParameters = testTypeEntry.parameters.map((param) =>
          param.id === parameterId ? { ...param, isVisible: false } : param
        );
        const updatedEntry: SelectedTestType = {
          ...testTypeEntry,
          parameters: newParameters,
        };
        newMap.set(testTypeId, updatedEntry);
        return newMap;
      }
      return prevMap;
    });
  };

  const handleResultValueKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key !== "Enter" && event.key !== "Tab") return;

    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input[data-result-value-input="true"]:not(:disabled)'
      )
    ).filter((input) => input.offsetParent !== null);
    const currentIndex = inputs.indexOf(event.currentTarget);
    const direction = event.key === "Tab" && event.shiftKey ? -1 : 1;
    const nextInput = inputs[currentIndex + direction];

    if (nextInput) {
      event.preventDefault();
      nextInput.focus();
      nextInput.select();
    } else if (event.key === "Enter") {
      event.preventDefault();
    }
  };

  // --- Handle Form Submission ---
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // Validation
    if (!currentPatientId) {
      setError("Erreur: ID du patient non défini.");
      // alert("Erreur: ID du patient non défini.");
      return;
    }
    if (!selectedDoctorId) {
      setError("Veuillez sélectionner un médecin prescripteur.");
      // alert("Veuillez sélectionner un médecin prescripteur.");
      return;
    }
    if (!resultDate) {
      setError("Veuillez sélectionner la date du résultat.");
      // alert("Veuillez sélectionner la date du résultat.");
      return;
    }
    if (selectedTestTypes.size === 0 && !isEditMode) {
      setError("Veuillez sélectionner au moins un type de test.");
      // alert("Veuillez sélectionner au moins un type de test.");
      return;
    }
    // Validate prices
    if (normalPrice === "" || insurancePrice === "" || unpaidAmount === "") {
      setError("Veuillez remplir les prix correctement.");
      // alert("Veuillez remplir les prix correctement.");
      return;
    }

    setLoadingSubmit(true);

    try {
      // Determine ResultValue changes, then save everything in one RPC call.
      const finalValuesToSave = new Map<
        string,
        { value: string; test_parameter_id: string }
      >();
      const finalVisibleParamIds = new Set<string>();

      selectedTestTypes.forEach((tt) => {
        tt.parameters.forEach((p) => {
          if (p.isVisible !== false) {
            finalVisibleParamIds.add(p.id);
            if (p.resultValue !== undefined && p.resultValue.trim() !== "") {
              finalValuesToSave.set(p.id, {
                value: p.resultValue.trim(),
                test_parameter_id: p.id,
              });
            }
          }
        });
      });

      const originalValueMap = new Map(
        originalResultValues.map((ov) => [ov.test_parameter_id, ov])
      );
      const valuesToDelete: string[] = [];
      const valuesToUpdate: any[] = [];
      const valuesToInsert: any[] = [];

      // Find values to delete
      originalResultValues.forEach((ov) => {
        if (
          !finalVisibleParamIds.has(ov.test_parameter_id) ||
          !finalValuesToSave.has(ov.test_parameter_id)
        ) {
          valuesToDelete.push(ov.id);
        }
      });

      // Prepare values to upsert
      finalValuesToSave.forEach((valueData, paramId) => {
        const original = originalValueMap.get(paramId);

        if (original?.id) {
          valuesToUpdate.push({
            id: original.id,
            test_parameter_id: valueData.test_parameter_id,
            value: valueData.value,
          });
        } else {
          valuesToInsert.push({
            test_parameter_id: valueData.test_parameter_id,
            value: valueData.value,
          });
        }
      });

      const { data: savedResultId, error: saveError } = await supabase.rpc(
        "save_patient_result_with_values",
        {
          p_result_id: isEditMode ? resultId! : null,
          p_patient_id: currentPatientId,
          p_doctor_id: selectedDoctorId,
          p_result_date: format(resultDate, "yyyy-MM-dd'T'HH:mm:ssXXX"),
          p_normal_price: Number(normalPrice),
          p_insurance_price: Number(insurancePrice),
          p_unpaid_amount: Number(unpaidAmount),
          p_is_free: isFree,
          p_notes: notes,
          p_values_to_delete: valuesToDelete,
          p_values_to_update: valuesToUpdate,
          p_values_to_insert: valuesToInsert,
        }
      );

      if (saveError) throw saveError;
      if (!savedResultId) {
        throw new Error(
          "Erreur lors de l'enregistrement du résultat (ID manquant)."
        );
      }

      // Success navigation
      navigate(`/results/${savedResultId}`);
    } catch (err: any) {
      /* ... error handling ... */
      console.error(
        `Erreur lors de ${
          isEditMode ? "la mise à jour" : "la création"
        } du résultat:`,
        err
      );
      setError(
        err?.message ||
          `Une erreur est survenue lors de ${
            isEditMode ? "la mise à jour" : "l'enregistrement"
          }.`
      );
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleRapidTestTypeSelection = (testTypeIds: string[]) => {
    const testTypeIdSet = new Set(testTypeIds);
    setSelectedTestTypes((prevMap) => {
      const newMap = new Map(prevMap);
      availableTestTypes
        .filter((testType) => testTypeIdSet.has(testType.id))
        .forEach((testType) => {
        newMap.set(testType.id, {
          ...testType,
          parameters: [],
          loadingParams: true,
          errorLoadingParams: false,
        });
        });
      return newMap;
    });

    testTypeIds.forEach((testTypeId) => {
      void loadParametersForTestType(testTypeId);
    });
  };

  // --- Render Logic ---
  if (loadingInitialData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Card className="shadow-md">
          <CardHeader>
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-3 rounded-md border p-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="ml-auto h-10 w-24" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link to={isEditMode && resultId ? `/results/${resultId}` : "/patients"}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchBootstrapData}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const cancelLinkTarget = isEditMode
    ? `/results/${resultId}`
    : `/patients/${currentPatientId}`;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <div className="mb-4">
        <Link to={cancelLinkTarget}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isEditMode ? "Retour au Résultat" : "Retour au Patient"}
          </Button>
        </Link>
      </div>

      <Card className="shadow-md">
        {/* Card Header */}
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            {isEditMode ? (
              <EditIcon className="h-5 w-5 text-primary" />
            ) : (
              <FlaskConical className="h-5 w-5 text-primary" />
            )}
            {isEditMode
              ? "Modifier le Résultat"
              : "Ajouter un Nouveau Résultat"}
          </CardTitle>
          {patient && (
            <CardDescription>
              Pour le patient :{" "}
              <span className="font-medium">{patient.full_name}</span> (ID:{" "}
              {patient.patient_unique_id})
            </CardDescription>
          )}
        </CardHeader>

        {/* <form onSubmit={handleSubmit}> */}
        <CardContent className="space-y-6">
          {/* Global Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription className="whitespace-pre-line">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Top Row: Doctor and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Doctor Select */}
            <div className="space-y-2">
              <Label htmlFor="doctor" className="font-semibold">
                Médecin Prescripteur <span className="text-destructive">*</span>
              </Label>
              {/* doctor-select */}
              <SearchableSelect
                name="doctor"
                options={
                  doctors.length > 0
                    ? doctors.map((doc) => ({
                        value: doc.id,
                        label: doc.full_name,
                      }))
                    : []
                }
                value={
                  doctors.length > 0
                    ? doctors
                        .map((doc) => ({
                          value: doc.id,
                          label: doc.full_name,
                        }))
                        .find((option) => option.value === selectedDoctorId) ||
                      null
                    : null
                }
                onChange={(value) => setSelectedDoctorId(value?.value)}
                placeholder={
                  doctors.length === 0 ? "Aucun médecin..." : "Rechercher..."
                }
                required
                isDisabled={loadingSubmit || doctors.length === 0}
              />

              {/* <Select
                  name="doctor"
                  value={selectedDoctorId}
                  onValueChange={(value) => setSelectedDoctorId(value)}
                  required
                  disabled={loadingSubmit || doctors.length === 0}
                >
                  <SelectTrigger id="doctor" className="h-10">
                    <SelectValue
                      placeholder={
                        doctors.length === 0
                          ? "Aucun médecin..."
                          : "Sélectionner..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.length > 0 ? (
                      doctors.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.full_name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-doctors" disabled>
                        Aucun médecin disponible
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select> */}
            </div>
            {/* Result Date */}
            <div className="space-y-2">
              <Label htmlFor="resultDate" className="font-semibold">
                Date du Résultat <span className="text-destructive">*</span>
              </Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      !resultDate && "text-muted-foreground"
                    )}
                    disabled={loadingSubmit}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {resultDate ? (
                      format(resultDate, "PPP", { locale: fr })
                    ) : (
                      <span>Choisir une date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={resultDate}
                    onSelect={(date) => {
                      setResultDate(date || new Date());
                      setDatePickerOpen(false);
                    }}
                    initialFocus
                    locale={fr}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Price Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="normal_price" className="font-semibold">
                Prix Normal
              </Label>
              <Input
                id="normal_price"
                name="normal_price"
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="Prix normal"
                value={normalPrice}
                onChange={(e) => setNormalPrice(e.target.value)}
                disabled={loadingSubmit}
                className="!text-4xl placeholder:text-[16px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurance_price" className="font-semibold">
                Prix Assurance
              </Label>
              <Input
                id="insurance_price"
                name="insurance_price"
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="Prix assurance"
                value={insurancePrice}
                onChange={(e) => setInsurancePrice(e.target.value)}
                disabled={loadingSubmit}
                className="!text-4xl placeholder:text-[16px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unpaid_amount" className="font-semibold">
                {" "}
                Restant{" "}
              </Label>
              <Input
                id="unpaid_amount"
                name="unpaid_amount"
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="Restant"
                value={unpaidAmount}
                onChange={(e) => setUnpaidAmount(e.target.value)}
                disabled={loadingSubmit}
                className="!text-4xl placeholder:text-[16px]"
              />
            </div>
          </div>
          {/* isFree Checkbox */}
          <div className="flex items-center space-x-2 mt-2">
            <Checkbox
              id="isFree"
              checked={isFree}
              onCheckedChange={(checked) => setIsFree(!!checked)}
              disabled={loadingSubmit}
            />
            <Label htmlFor="isFree" className="font-semibold">
              Gratuit
            </Label>
          </div>

          {/* Notes Textarea */}
          <div className="mt-4">
            <Label htmlFor="notes" className="font-semibold">
              Notes
            </Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border rounded-md p-2 mt-1 focus:outline-none focus:ring focus:border-blue-300"
              placeholder="Ajouter des notes ou des commentaires..."
              disabled={loadingSubmit}
            />
          </div>

          <TestTypeSelector
            categories={categories}
            tests={availableTestTypes}
            selectedTestIds={Array.from(selectedTestTypes.keys())}
            onTestToggle={handleTestTypeToggle}
            onAddTests={handleRapidTestTypeSelection}
            disabled={loadingSubmit}
          />

          {/* Dynamically Rendered Parameter Inputs */}
          {selectedTestTypes.size > 0 && <Separator />}
          {Array.from(selectedTestTypes.values()).map((selectedType) => (
            <div
              key={selectedType.id}
              className="space-y-4 py-4 border-b last:border-b-0"
            >
              <h3 className="text-lg font-semibold flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  {extractTestTypeName(selectedType.name)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => handleTestTypeToggle(false, selectedType.id)}
                  disabled={loadingSubmit}
                >
                  Retirer ce Test
                </Button>
              </h3>
              {selectedType.loadingParams ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pl-7">
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>
              ) : selectedType.errorLoadingParams ? (
                <Alert variant="destructive" className="ml-7">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erreur Paramètres</AlertTitle>
                  <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>Impossible de charger les paramètres pour ce test.</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loadParametersForTestType(selectedType.id)}
                      disabled={loadingSubmit}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Réessayer
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : selectedType.parameters.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 pl-7">
                  {selectedType.parameters
                    .filter((param) => param.isVisible !== false) // Filter visible
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) // Sort by order
                    .map((param) => (
                      <div key={param.id} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label
                            htmlFor={`param-${param.id}`}
                            className="text-sm font-medium flex items-center gap-1"
                          >
                            {/* <span>{param.name}</span> */}
                            <span
                              dangerouslySetInnerHTML={{
                                __html: param.name,
                              }}
                            ></span>
                            {param.unit && (
                              <span className="text-xs text-muted-foreground">
                                ({param.unit})
                              </span>
                            )}
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              handleParameterRemove(selectedType.id, param.id)
                            }
                            disabled={loadingSubmit}
                            aria-label={`Retirer ${param.name}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          id={`param-${param.id}`}
                          name={`param-${param.id}`}
                          data-result-value-input="true"
                          value={param.resultValue || ""}
                          onChange={(e) =>
                            handleParameterChange(
                              selectedType.id,
                              param.id,
                              e.target.value
                            )
                          }
                          onKeyDown={handleResultValueKeyDown}
                          placeholder={`Valeur ${
                            param.reference_range
                              ? `(Réf: ${param.reference_range})`
                              : ""
                          }`}
                          disabled={loadingSubmit}
                          className="h-9"
                        />
                        {param.description && (
                          <p className="text-xs text-muted-foreground pt-1">
                            {param.description}
                          </p>
                        )}
                      </div>
                    ))}
                  {selectedType.parameters.every(
                    (p) => p.isVisible === false
                  ) && (
                    <p className="col-span-full text-sm text-muted-foreground italic">
                      Tous les paramètres pour ce test sont masqués.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic pl-7">
                  Aucun paramètre défini pour ce type de test.
                </p>
              )}
            </div>
          ))}
        </CardContent>

        {/* Card Footer */}
        <CardFooter className="border-t px-6 py-4 flex justify-between">
          <Button
            // type="submit"
            disabled={loadingSubmit || loadingInitialData}
            onClick={handleSubmit}
          >
            {loadingSubmit ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditMode ? "Mise à jour..." : "Enregistrement..."}
              </>
            ) : isEditMode ? (
              "Mettre à jour le Résultat"
            ) : (
              "Enregistrer le Résultat"
            )}
          </Button>
          <Link to={cancelLinkTarget}>
            <Button type="button" variant="outline" disabled={loadingSubmit}>
              Annuler
            </Button>
          </Link>
        </CardFooter>
        {/* </form> */}
      </Card>
    </div>
  );
};

export default ResultFormPage;
