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
import { cn } from "@/lib/utils"; // Adjust path if needed
import { useDebounce } from "../hooks/useDebounce"; // Adjust path if needed

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Adjust path
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
  Search,
  X,
  Edit as EditIcon,
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
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(
    patientIdFromRoute || null
  );
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [availableTestTypes, setAvailableTestTypes] = useState<TestType[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>(
    undefined
  );
  const [resultDate, setResultDate] = useState<Date | undefined>(new Date());
  const [selectedTestTypes, setSelectedTestTypes] = useState<
    Map<string, SelectedTestType>
  >(new Map());
  const [testTypeSearchTerm, setTestTypeSearchTerm] = useState<string>("");
  const [loadingInitialData, setLoadingInitialData] = useState<boolean>(true);
  const [loadingSubmit, setLoadingSubmit] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [originalResultValues, setOriginalResultValues] = useState<
    ResultValue[]
  >([]);
  // --- End State ---

  const debouncedTestTypeSearch = useDebounce(testTypeSearchTerm, 250);

  // --- Data Fetching ---
  const fetchEditData = useCallback(async () => {
    if (!resultId) return;
    setLoadingInitialData(true);
    setError(null);
    try {
      const [resultRes, valuesRes, doctorsRes, allTestTypesRes] =
        await Promise.all([
          supabase
            .from("patient_result")
            .select("*")
            .eq("id", resultId)
            .single(),
          supabase
            .from("result_value")
            .select(
              `id, value, test_parameter_id, test_parameter:test_parameter_id(test_type_id, test_type:test_type_id(id, name))`
            )
            .eq("patient_result_id", resultId), // Fetch FKs needed for grouping
          supabase.from("doctor").select("id, full_name").order("full_name"),
          supabase.from("test_type").select("id, name").order("name"),
        ]);

      // Handle Main Result
      if (resultRes.error) throw resultRes.error;
      if (!resultRes.data) throw new Error("Résultat non trouvé.");
      const resultData = resultRes.data;
      setSelectedDoctorId(resultData.doctor_id);
      setResultDate(
        resultData.result_date && isValid(parseISO(resultData.result_date))
          ? parseISO(resultData.result_date)
          : new Date()
      ); // Safely parse date
      setCurrentPatientId(resultData.patient_id);
      setOriginalResultValues(valuesRes.data || []);

      // Handle Patient
      if (resultData.patient_id) {
        /* ... fetch patient ... */
        const { data: patientData, error: patientError } = await supabase
          .from("patient")
          .select("*")
          .eq("id", resultData.patient_id)
          .single();
        if (patientError)
          console.warn("Erreur chargement patient:", patientError.message);
        setPatient(patientData);
      }

      // Handle Doctors and All Test Types
      if (doctorsRes.error) throw doctorsRes.error;
      if (allTestTypesRes.error) throw allTestTypesRes.error;
      setDoctors(doctorsRes.data || []);
      setAvailableTestTypes(allTestTypesRes.data || []);

      // Handle Existing Values & Populate State
      if (valuesRes.error) throw valuesRes.error;
      const existingValues = valuesRes.data || [];
      const initialSelectedTypes = new Map<string, SelectedTestType>();
      const involvedTestTypeIds = [
        ...new Set(
          existingValues
            .map((v) => (v.test_parameter as any)?.test_type?.id)
            .filter(Boolean)
        ),
      ];

      // Fetch ALL parameters for involved types
      const { data: allParamsData, error: paramsError } = await supabase
        .from("test_parameter")
        .select(`*, test_type:test_type_id(id, name)`)
        .in("test_type_id", involvedTestTypeIds);
      if (paramsError) throw paramsError;

      involvedTestTypeIds.forEach((testTypeId) => {
        const firstValue = existingValues.find(
          (v) => (v.test_parameter as any)?.test_type?.id === testTypeId
        );
        const testTypeName =
          (firstValue?.test_parameter as any)?.test_type?.name ||
          "Type Inconnu";
        const relevantParams = (allParamsData || []).filter(
          (p) => p.test_type_id === testTypeId
        );

        initialSelectedTypes.set(testTypeId, {
          id: testTypeId,
          name: testTypeName,
          category_id: relevantParams[0]?.test_type_id || "",
          created_at: "",
          updated_at: "",
          parameters: relevantParams.map((paramDef) => {
            const existingVal = existingValues.find(
              (val) => val.test_parameter_id === paramDef.id
            );
            return {
              ...paramDef,
              resultValue: existingVal?.value || "",
              isVisible: true,
              originalValueId: existingVal?.id || null,
            };
          }),
          loadingParams: false,
          errorLoadingParams: false,
        });
      });
      setSelectedTestTypes(initialSelectedTypes);
    } catch (err: any) {
      /* ... error handling ... */
      console.error("Erreur chargement données pour modification:", err);
      setError(
        err.message || "Impossible de charger les données pour la modification."
      );
    } finally {
      setLoadingInitialData(false);
    }
  }, [resultId]);

  const fetchCreateData = useCallback(async () => {
    if (!patientIdFromRoute) return;
    setLoadingInitialData(true);
    setError(null);
    try {
      /* ... fetch patient, doctors, test types ... */
      const [patientRes, doctorsRes, testTypesRes] = await Promise.all([
        supabase
          .from("patient")
          .select("*")
          .eq("id", patientIdFromRoute)
          .single(),
        supabase.from("doctor").select("id, full_name").order("full_name"),
        supabase.from("test_type").select("id, name").order("name"),
      ]);
      if (patientRes.error) throw patientRes.error;
      if (!patientRes.data)
        throw new Error("Patient non trouvé pour la création.");
      if (doctorsRes.error) throw doctorsRes.error;
      if (testTypesRes.error) throw testTypesRes.error;
      setPatient(patientRes.data);
      setCurrentPatientId(patientIdFromRoute);
      setDoctors(doctorsRes.data || []);
      setAvailableTestTypes(testTypesRes.data || []);
    } catch (err: any) {
      /* ... error handling ... */
      console.error("Erreur chargement données pour création:", err);
      setError(
        err.message || "Impossible de charger les informations nécessaires."
      );
    } finally {
      setLoadingInitialData(false);
    }
  }, [patientIdFromRoute]);

  useEffect(() => {
    if (isEditMode) {
      fetchEditData();
    } else {
      fetchCreateData();
    }
  }, [isEditMode, fetchEditData, fetchCreateData]);
  // --- End Data Fetching ---

  // Filter available test types based on search term
  const filteredAvailableTestTypes = useMemo(() => {
    if (!debouncedTestTypeSearch) return availableTestTypes;
    const lowerCaseSearch = debouncedTestTypeSearch.toLowerCase();
    return availableTestTypes.filter((tt) =>
      tt.name.toLowerCase().includes(lowerCaseSearch)
    );
  }, [availableTestTypes, debouncedTestTypeSearch]);

  // --- handleTestTypeToggle ---
  const handleTestTypeToggle = useCallback(
    async (checked: boolean | "indeterminate", testTypeId: string) => {
      const testType = availableTestTypes.find((tt) => tt.id === testTypeId);
      if (!testType) return;

      if (checked === true) {
        setSelectedTestTypes((prevMap) => {
          /* ... add/update with loading ... */
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
          /* ... fetch params ... */
          const { data, error } = await supabase
            .from("test_parameter")
            .select("*")
            .eq("test_type_id", testTypeId)
            .order("name");
          if (error) throw error;
          setSelectedTestTypes((currentMap) => {
            /* ... update with fetched params, merge values ... */
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
          /* ... error handling ... */
          console.error(
            `Erreur chargement paramètres pour ${testType.name}:`,
            err
          );
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
          setError((prev) =>
            prev
              ? `${prev}\nImpossible de charger les paramètres pour ${testType.name}.`
              : `Impossible de charger les paramètres pour ${testType.name}.`
          );
        }
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
    [availableTestTypes]
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

  // --- Handle Form Submission ---
  // const handleSubmit = async (event: FormEvent) => {
  //   event.preventDefault();
  //   setError(null);
  //   if (!currentPatientId) {
  //     setError("Erreur: ID du patient non défini.");
  //     return;
  //   }
  //   if (!selectedDoctorId) {
  //     setError("Veuillez sélectionner un médecin prescripteur.");
  //     return;
  //   }
  //   if (!resultDate) {
  //     setError("Veuillez sélectionner la date du résultat.");
  //     return;
  //   }
  //   setLoadingSubmit(true);

  //   try {
  //     // 1. Upsert PatientResult
  //     const resultUpsertData = {
  //       patient_id: currentPatientId,
  //       doctor_id: selectedDoctorId,
  //       result_date: format(resultDate, "yyyy-MM-dd'T'HH:mm:ssXXX"),
  //       // status will default or keep existing if updating; not changing status here
  //     };
  //     const { data: savedResult, error: resultSaveError } = await (isEditMode
  //       ? supabase
  //           .from("patient_result")
  //           .update(resultUpsertData)
  //           .eq("id", resultId!)
  //           .select("id")
  //           .single()
  //       : supabase
  //           .from("patient_result")
  //           .insert({ ...resultUpsertData, status: "attente" })
  //           .select("id")
  //           .single());
  //     if (resultSaveError) throw resultSaveError;
  //     const currentResultId = savedResult?.id;
  //     if (!currentResultId)
  //       throw new Error(
  //         "Erreur lors de l'enregistrement de l'en-tête du résultat."
  //       );

  //     // 2. Determine ResultValue changes
  //     const finalValuesToSave = new Map<
  //       string,
  //       { value: string; test_parameter_id: string }
  //     >();
  //     const finalVisibleParamIds = new Set<string>();
  //     selectedTestTypes.forEach((tt) => {
  //       /* ... build finalVisibleParamIds and finalValuesToSave ... */
  //       tt.parameters.forEach((p) => {
  //         if (p.isVisible !== false) {
  //           finalVisibleParamIds.add(p.id);
  //           if (p.resultValue !== undefined && p.resultValue.trim() !== "") {
  //             finalValuesToSave.set(p.id, {
  //               value: p.resultValue.trim(),
  //               test_parameter_id: p.id,
  //             });
  //           }
  //         }
  //       });
  //     });

  //     const originalValueMap = new Map(
  //       originalResultValues.map((ov) => [ov.test_parameter_id, ov])
  //     );
  //     const valuesToDelete: string[] = [];
  //     const valuesToUpsert: any[] = [];

  //     // Find values to delete
  //     originalResultValues.forEach((ov) => {
  //       /* ... logic to add to valuesToDelete ... */
  //       if (
  //         !finalVisibleParamIds.has(ov.test_parameter_id) ||
  //         !finalValuesToSave.has(ov.test_parameter_id)
  //       ) {
  //         valuesToDelete.push(ov.id);
  //       }
  //     });

  //     // Prepare values to upsert
  //     finalValuesToSave.forEach((valueData, paramId) => {
  //       /* ... logic to add to valuesToUpsert ... */
  //       const original = originalValueMap.get(paramId);
  //       valuesToUpsert.push({
  //         id: original?.id,
  //         patient_result_id: currentResultId,
  //         test_parameter_id: valueData.test_parameter_id,
  //         value: valueData.value,
  //       });
  //     });

  //     // 3. Perform DB operations
  //     if (valuesToDelete.length > 0) {
  //       /* ... delete ... */
  //       const { error: deleteError } = await supabase
  //         .from("result_value")
  //         .delete()
  //         .in("id", valuesToDelete);
  //       if (deleteError) throw deleteError;
  //     }
  //     if (valuesToUpsert.length > 0) {
  //       /* ... upsert ... */
  //       const { error: upsertError } = await supabase
  //         .from("result_value")
  //         .upsert(valuesToUpsert, { onConflict: "id" });
  //       if (upsertError) throw upsertError;
  //     }

  //     // Success navigation
  //     navigate(
  //       isEditMode
  //         ? `/results/${currentResultId}`
  //         : `/patients/${currentPatientId}`
  //     );
  //   } catch (err: any) {
  //     /* ... error handling ... */
  //     console.error(
  //       `Erreur lors de ${
  //         isEditMode ? "la mise à jour" : "la création"
  //       } du résultat:`,
  //       err
  //     );
  //     setError(
  //       err?.message ||
  //         `Une erreur est survenue lors de ${
  //           isEditMode ? "la mise à jour" : "l'enregistrement"
  //         }.`
  //     );
  //   } finally {
  //     setLoadingSubmit(false);
  //   }
  // };

  // src/pages/ResultFormPage.tsx -> (within the ResultFormPage component)

  // --- Handle Form Submission (REVISED for Edit/Create/Delete Logic) ---
  // const handleSubmit = async (event: FormEvent) => {
  //   event.preventDefault();
  //   setError(null);

  //   // Validation
  //   if (!currentPatientId) {
  //     setError("Erreur: ID du patient non défini.");
  //     return;
  //   } // Check patient ID
  //   if (!selectedDoctorId) {
  //     setError("Veuillez sélectionner un médecin prescripteur.");
  //     return;
  //   }
  //   if (!resultDate) {
  //     setError("Veuillez sélectionner la date du résultat.");
  //     return;
  //   }
  //   // Removed check for 0 test types in edit mode
  //   if (selectedTestTypes.size === 0 && !isEditMode) {
  //     setError("Veuillez sélectionner au moins un type de test.");
  //     return;
  //   }

  //   setLoadingSubmit(true);

  //   try {
  //     // 1. Upsert the main PatientResult record
  //     const resultUpsertData = {
  //       // id: isEditMode ? resultId : undefined, // Let insert generate ID, update matches on .eq()
  //       patient_id: currentPatientId,
  //       doctor_id: selectedDoctorId,
  //       result_date: format(resultDate, "yyyy-MM-dd'T'HH:mm:ssXXX"), // ISO 8601 format
  //       // Note: Status is not updated here, only set on create. Status updates happen on the Detail page.
  //     };

  //     // Perform Insert or Update for patient_result
  //     const { data: savedResult, error: resultSaveError } = await (isEditMode
  //       ? supabase
  //           .from("patient_result")
  //           .update(resultUpsertData)
  //           .eq("id", resultId!) // Non-null assertion because isEditMode is true
  //           .select("id")
  //           .single()
  //       : supabase
  //           .from("patient_result")
  //           .insert({ ...resultUpsertData, status: "attente" }) // Default status 'attente' on create
  //           .select("id")
  //           .single());

  //     if (resultSaveError) throw resultSaveError;
  //     const currentResultId = savedResult?.id; // Use the ID from upsert/insert response
  //     if (!currentResultId)
  //       throw new Error(
  //         "Erreur lors de l'enregistrement de l'en-tête du résultat (ID manquant)."
  //       );

  //     // 2. Determine ResultValue changes
  //     const finalValuesToSave = new Map<
  //       string,
  //       { value: string; test_parameter_id: string }
  //     >(); // Map paramId -> {value, paramId}
  //     const finalVisibleParamIds = new Set<string>();

  //     // Collect all currently visible parameters and their values
  //     selectedTestTypes.forEach((tt) => {
  //       tt.parameters.forEach((p) => {
  //         if (p.isVisible !== false) {
  //           finalVisibleParamIds.add(p.id); // Track all visible param IDs
  //           // Only consider saving if there's a non-empty value
  //           if (p.resultValue !== undefined && p.resultValue.trim() !== "") {
  //             finalValuesToSave.set(p.id, {
  //               value: p.resultValue.trim(),
  //               test_parameter_id: p.id,
  //             });
  //           }
  //         }
  //       });
  //     });

  //     // Map original values by parameter ID for quick lookup
  //     const originalValueMap = new Map(
  //       originalResultValues.map((ov) => [ov.test_parameter_id, ov])
  //     );

  //     const valuesToDelete: string[] = []; // Store IDs (UUIDs) of result_value records to delete
  //     const valuesToUpsert: any[] = []; // Store objects for upserting result_value records

  //     // --- Determine which original values need deletion ---
  //     originalResultValues.forEach((ov) => {
  //       // Condition 1: The parameter associated with this original value is no longer visible (was hidden or test type removed)
  //       // Condition 2: The parameter IS still visible, BUT its value in the form is now empty (meaning it should be deleted)
  //       if (
  //         !finalVisibleParamIds.has(ov.test_parameter_id) ||
  //         !finalValuesToSave.has(ov.test_parameter_id)
  //       ) {
  //         valuesToDelete.push(ov.id);
  //       }
  //     });

  //     // --- Prepare values to upsert (these are parameters that are visible AND have a non-empty value) ---
  //     finalValuesToSave.forEach((valueData, paramId) => {
  //       const original = originalValueMap.get(paramId);

  //       // *** FIX APPLIED HERE ***
  //       // Conditionally build the payload object for upsert
  //       const upsertPayload: {
  //         id?: string; // ID is optional
  //         patient_result_id: string;
  //         test_parameter_id: string;
  //         value: string;
  //       } = {
  //         patient_result_id: currentResultId,
  //         test_parameter_id: valueData.test_parameter_id,
  //         value: valueData.value,
  //       };

  //       // ONLY include the 'id' if we are updating an existing record (original exists)
  //       if (original?.id) {
  //         upsertPayload.id = original.id;
  //       }
  //       // If original?.id is null/undefined, the id field is omitted,
  //       // allowing the database to generate a new UUID on INSERT.

  //       valuesToUpsert.push(upsertPayload);
  //     });

  //     // 3. Perform database operations (Delete first, then Upsert)
  //     // Wrap in a Promise.all if you want them to run more concurrently,
  //     // but sequential (delete then upsert) is often safer for logic.
  //     if (valuesToDelete.length > 0) {
  //       console.log("Deleting result_value IDs:", valuesToDelete); // Debug log
  //       const { error: deleteError } = await supabase
  //         .from("result_value")
  //         .delete()
  //         .in("id", valuesToDelete);
  //       if (deleteError) {
  //         console.error("Delete error details:", deleteError);
  //         throw new Error(
  //           `Erreur lors de la suppression d'anciennes valeurs: ${deleteError.message}`
  //         );
  //       }
  //     }

  //     if (valuesToUpsert.length > 0) {
  //       console.log("Upserting result_value data:", valuesToUpsert); // Debug log
  //       const { error: upsertError } = await supabase
  //         .from("result_value")
  //         .upsert(valuesToUpsert, {
  //           onConflict: "id", // Use the primary key for conflict resolution
  //           // ignoreDuplicates: false // default is false, ensures updates happen
  //         });
  //       if (upsertError) {
  //         console.error("Upsert error details:", upsertError);
  //         // Provide more specific error if possible
  //         if (
  //           upsertError.code === "23502" &&
  //           upsertError.message.includes('"id"')
  //         ) {
  //           throw new Error(
  //             `Erreur Upsert: Problème avec la génération/utilisation de l'ID pour result_value.`
  //           );
  //         }
  //         throw new Error(
  //           `Erreur lors de l'enregistrement des valeurs: ${upsertError.message}`
  //         );
  //       }
  //     }

  //     // Success: Navigate to the appropriate page
  //     console.log("Save successful, navigating...");
  //     navigate(
  //       isEditMode
  //         ? `/results/${currentResultId}`
  //         : `/patients/${currentPatientId}`
  //     );
  //   } catch (err: any) {
  //     console.error(
  //       `Erreur lors de ${
  //         isEditMode ? "la mise à jour" : "la création"
  //       } du résultat:`,
  //       err
  //     );
  //     // Make error message more specific if it's a constraint violation
  //     let displayError =
  //       err?.message ||
  //       `Une erreur est survenue lors de ${
  //         isEditMode ? "la mise à jour" : "l'enregistrement"
  //       }.`;
  //     if (err?.code === "23505") {
  //       // Unique constraint (e.g., maybe on patient_result_id + test_parameter_id if you added that)
  //       displayError =
  //         "Erreur de base de données : Violation de contrainte d'unicité.";
  //     } else if (err?.code === "23503") {
  //       // Foreign key constraint
  //       displayError =
  //         "Erreur de base de données : Violation de clé étrangère (données liées manquantes).";
  //     } else if (err?.code === "23502") {
  //       // Not-null constraint (should be less likely now)
  //       displayError = `Erreur de base de données : Violation de contrainte NOT NULL (${err.message}).`;
  //     }
  //     setError(displayError);
  //   } finally {
  //     setLoadingSubmit(false);
  //   }
  // };

  // src/pages/ResultFormPage.tsx -> (within the ResultFormPage component)

  // --- Handle Form Submission (REVISED with Separate Insert/Update) ---
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // Validation
    if (!currentPatientId) {
      setError("Erreur: ID du patient non défini.");
      return;
    }
    if (!selectedDoctorId) {
      setError("Veuillez sélectionner un médecin prescripteur.");
      return;
    }
    if (!resultDate) {
      setError("Veuillez sélectionner la date du résultat.");
      return;
    }
    if (selectedTestTypes.size === 0 && !isEditMode) {
      setError("Veuillez sélectionner au moins un type de test.");
      return;
    }

    setLoadingSubmit(true);

    try {
      // 1. Save the main PatientResult record (Insert or Update)
      const resultSaveData = {
        patient_id: currentPatientId,
        doctor_id: selectedDoctorId,
        result_date: format(resultDate, "yyyy-MM-dd'T'HH:mm:ssXXX"),
        // Status handled on create or via detail page, not here
      };

      const { data: savedResult, error: resultSaveError } = await (isEditMode
        ? supabase
            .from("patient_result")
            .update(resultSaveData)
            .eq("id", resultId!)
            .select("id")
            .single()
        : supabase
            .from("patient_result")
            .insert({ ...resultSaveData, status: "attente" })
            .select("id")
            .single());

      if (resultSaveError) throw resultSaveError;
      const currentResultId = savedResult?.id;
      if (!currentResultId)
        throw new Error(
          "Erreur lors de l'enregistrement de l'en-tête du résultat (ID manquant)."
        );

      // 2. Determine ResultValue changes
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
      // *** SEPARATE ARRAYS ***
      const valuesToInsert: Omit<
        Tables<"result_value">,
        "id" | "created_at" | "updated_at"
      >[] = [];
      const valuesToUpdate: Partial<Tables<"result_value">>[] = []; // Use Partial as we only update 'value'

      // --- Determine Deletions ---
      originalResultValues.forEach((ov) => {
        if (
          !finalVisibleParamIds.has(ov.test_parameter_id) ||
          !finalValuesToSave.has(ov.test_parameter_id)
        ) {
          valuesToDelete.push(ov.id);
        }
      });

      // --- Prepare Inserts and Updates ---
      finalValuesToSave.forEach((valueData, paramId) => {
        const original = originalValueMap.get(paramId);

        if (original?.id) {
          // --- Prepare for UPDATE ---
          // Check if value actually changed to avoid unnecessary updates
          if (original.value !== valueData.value) {
            valuesToUpdate.push({
              id: original.id,
              value: valueData.value,
              // You could add patient_result_id and test_parameter_id here too,
              // but they shouldn't change for an update based on 'id'
            });
          }
        } else {
          // --- Prepare for INSERT ---
          valuesToInsert.push({
            // id is omitted - let database generate it
            patient_result_id: currentResultId,
            test_parameter_id: valueData.test_parameter_id,
            value: valueData.value,
          });
        }
      });

      // 3. Perform database operations sequentially: DELETE -> INSERT -> UPDATE
      //    (Could potentially run INSERT and UPDATE in parallel after DELETE)

      // --- DELETE ---
      if (valuesToDelete.length > 0) {
        console.log("Deleting result_value IDs:", valuesToDelete);
        const { error: deleteError } = await supabase
          .from("result_value")
          .delete()
          .in("id", valuesToDelete);
        if (deleteError) {
          console.error("Delete error details:", deleteError);
          throw new Error(
            `Erreur lors de la suppression d'anciennes valeurs: ${deleteError.message}`
          );
        }
      }

      // --- INSERT ---
      if (valuesToInsert.length > 0) {
        console.log("Inserting result_value data:", valuesToInsert);
        const { error: insertError } = await supabase
          .from("result_value")
          .insert(valuesToInsert); // Use standard insert
        if (insertError) {
          console.error("Insert error details:", insertError);
          throw new Error(
            `Erreur lors de l'insertion de nouvelles valeurs: ${insertError.message}`
          );
        }
      }

      // --- UPDATE ---
      // Need to run updates individually or batch them if Supabase client supports batch updates well
      // For simplicity, let's run them sequentially (can be slow for many updates)
      // A more advanced approach would use Promise.all for parallel updates
      if (valuesToUpdate.length > 0) {
        console.log("Updating result_value data:", valuesToUpdate);
        // Example using Promise.all for potentially faster updates
        const updatePromises = valuesToUpdate.map(
          (updateData) =>
            supabase
              .from("result_value")
              .update({ value: updateData.value }) // Only update the value
              .eq("id", updateData.id!) // Match by ID
        );
        const updateResults = await Promise.all(updatePromises);

        // Check for errors in any of the update promises
        const firstUpdateError = updateResults.find((res) => res.error);
        if (firstUpdateError?.error) {
          console.error("Update error details:", firstUpdateError.error);
          throw new Error(
            `Erreur lors de la mise à jour des valeurs: ${firstUpdateError.error.message}`
          );
        }

        /* // Sequential alternative (simpler but slower):
                 for (const updateData of valuesToUpdate) {
                     const { error: updateError } = await supabase
                        .from('result_value')
                        .update({ value: updateData.value }) // Only update the value
                        .eq('id', updateData.id!);
                     if (updateError) {
                         console.error("Update error details:", updateError);
                         throw new Error(`Erreur lors de la mise à jour de la valeur (ID: ${updateData.id}): ${updateError.message}`);
                     }
                 }
                 */
      }

      // --- Success ---
      console.log("Save successful, navigating...");
      navigate(
        isEditMode
          ? `/results/${currentResultId}`
          : `/patients/${currentPatientId}`
      );
    } catch (err: any) {
      /* ... (existing error handling and display) ... */
      console.error(
        `Erreur lors de ${
          isEditMode ? "la mise à jour" : "la création"
        } du résultat:`,
        err
      );
      let displayError =
        err?.message ||
        `Une erreur est survenue lors de ${
          isEditMode ? "la mise à jour" : "l'enregistrement"
        }.`;
      // ... (specific error code checks remain useful) ...
      setError(displayError);
    } finally {
      setLoadingSubmit(false);
    }
  };
  // --- End Handle Form Submission ---
  // --- End Handle Form Submission ---

  // --- End Form Submission ---

  // --- Render Logic ---
  if (loadingInitialData) {
    // ... Skeleton ...
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-32" />
          </CardFooter>
        </Card>
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

        <form onSubmit={handleSubmit}>
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
                  Médecin Prescripteur{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
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
                </Select>
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

            {/* Test Type Selection with Search */}
            <div className="space-y-4">
              <Label className="font-semibold text-base">
                Types de Tests Inclus
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Rechercher et ajouter un type de test..."
                  value={testTypeSearchTerm}
                  onChange={(e) => setTestTypeSearchTerm(e.target.value)}
                  className="pl-10 w-full md:w-1/2 h-9"
                  disabled={availableTestTypes.length === 0}
                />
              </div>
              {availableTestTypes.length > 0 ? (
                <div className="grid grid-cols-2 _sm:grid-cols-3 _md:grid-cols-4 gap-x-4 gap-y-3 rounded-md border p-4 max-h-80 overflow-y-auto">
                  {filteredAvailableTestTypes.length > 0 ? (
                    filteredAvailableTestTypes.map((tt) => (
                      <div key={tt.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`test-type-${tt.id}`}
                          checked={selectedTestTypes.has(tt.id)}
                          onCheckedChange={(checked) =>
                            handleTestTypeToggle(checked, tt.id)
                          }
                          disabled={loadingSubmit}
                        />
                        <label
                          htmlFor={`test-type-${tt.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {tt.name}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full text-sm text-muted-foreground text-center py-4">
                      Aucun type de test ne correspond.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Aucun type de test configuré.
                </p>
              )}
            </div>

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
                    {selectedType.name}
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
                    <AlertDescription>
                      Impossible de charger les paramètres pour ce test.
                    </AlertDescription>
                  </Alert>
                ) : selectedType.parameters.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 pl-7">
                    {selectedType.parameters
                      .filter((param) => param.isVisible !== false) // Filter visible
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
                            value={param.resultValue || ""}
                            onChange={(e) =>
                              handleParameterChange(
                                selectedType.id,
                                param.id,
                                e.target.value
                              )
                            }
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
              type="submit"
              disabled={loadingSubmit || loadingInitialData}
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
        </form>
      </Card>
    </div>
  );
};

export default ResultFormPage;
