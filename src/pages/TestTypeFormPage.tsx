// src/pages/TestTypeFormPage.tsx

import React, { useState, useEffect, FormEvent, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient"; // Adjust path
import { v4 as uuidv4 } from "uuid"; // For temporary parameter IDs

// --- Shadcn/ui Imports ---
import { Button } from "@/components/ui/button"; // Adjust path
import { Input } from "@/components/ui/input"; // Adjust path
import { Label } from "@/components/ui/label"; // Adjust path
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Adjust path
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Adjust path
import { Skeleton } from "@/components/ui/skeleton"; // Adjust path
import { Textarea } from "@/components/ui/textarea"; // Adjust path
import { Separator } from "@/components/ui/separator"; // Adjust path

// --- Icons ---
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  ClipboardList,
  Layers,
  PlusCircle,
  Trash2,
  Save,
} from "lucide-react";

// --- Types ---
type Category = Tables<"category">;
type TestParameter = Tables<"test_parameter">;
type TestType = Tables<"test_type">;

// Parameter state within the form, including temporary ID for new ones
interface FormParameter extends Partial<TestParameter> {
  tempId: string; // Unique ID within the form session (UUID)
  // id?: string | null; // Actual DB ID if it exists
  // test_type_id?: string | null; // DB test_type_id if it exists
  name?: string;
  unit?: string;
  reference_range?: string;
  description?: string;
}
// --- End Types ---

const TestTypeFormPage: React.FC = () => {
  // --- Hooks ---
  const { testTypeId } = useParams<{ testTypeId: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(testTypeId);

  // --- State ---
  const [testTypeName, setTestTypeName] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    string | undefined
  >(undefined);
  const [parameters, setParameters] = useState<FormParameter[]>([]);
  const [availableCategories, setAvailableCategories] = useState<Category[]>(
    []
  );
  // Store original state for diffing on save
  const [originalTestType, setOriginalTestType] = useState<TestType | null>(
    null
  );
  const [originalParameters, setOriginalParameters] = useState<FormParameter[]>(
    []
  );
  // Loading and Error States
  const [initialLoading, setInitialLoading] = useState<boolean>(true); // Separate loading for initial data
  const [loadingSubmit, setLoadingSubmit] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // --- End State ---

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    setInitialLoading(true);
    setError(null);
    setParameters([]); // Reset params
    setOriginalParameters([]);
    setOriginalTestType(null);
    setTestTypeName("");
    setSelectedCategoryId(undefined);

    try {
      // Always fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("category")
        .select("*")
        .order("name");
      if (categoriesError) throw categoriesError;
      setAvailableCategories(categoriesData || []);

      // If Edit Mode, fetch Test Type and its Parameters
      if (isEditMode && testTypeId) {
        const { data: testTypeData, error: testTypeError } = await supabase
          .from("test_type")
          .select("*")
          .eq("id", testTypeId)
          .single();

        if (testTypeError) throw testTypeError;
        if (!testTypeData) throw new Error("Type de test non trouvé.");

        const { data: paramsData, error: paramsError } = await supabase
          .from("test_parameter")
          .select("*")
          .eq("test_type_id", testTypeId)
          .order("name"); // Or order by created_at if preferred

        if (paramsError) throw paramsError;

        // Populate state
        setOriginalTestType(testTypeData);
        setTestTypeName(testTypeData.name);
        setSelectedCategoryId(testTypeData.category_id);
        const initialParams = (paramsData || []).map((p) => ({
          ...p,
          tempId: p.id || uuidv4(),
        })); // Use DB id as tempId if exists
        setParameters(initialParams);
        setOriginalParameters(JSON.parse(JSON.stringify(initialParams))); // Deep copy for comparison
      }
    } catch (err: any) {
      console.error("Erreur chargement données:", err);
      setError(err.message || "Impossible de charger les données.");
    } finally {
      setInitialLoading(false);
    }
  }, [isEditMode, testTypeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]); // Fetch data on mount or if testTypeId changes
  // --- End Data Fetching ---

  // --- Parameter Handlers ---
  const handleParameterChange = (
    tempId: string,
    field: keyof FormParameter,
    value: string
  ) => {
    setParameters((currentParams) =>
      currentParams.map((p) =>
        p.tempId === tempId ? { ...p, [field]: value } : p
      )
    );
  };

  const handleParameterAdd = () => {
    const newParam: FormParameter = {
      tempId: uuidv4(), // Generate a unique temporary ID
      name: "",
      unit: "",
      reference_range: "",
      description: "",
      // Explicitly set DB fields to null/undefined for clarity on insert
      id: undefined,
      test_type_id: undefined,
    };
    setParameters((currentParams) => [...currentParams, newParam]);
  };

  const handleParameterRemove = (tempId: string) => {
    // Directly remove from the parameters state array
    setParameters((currentParams) =>
      currentParams.filter((p) => p.tempId !== tempId)
    );
  };
  // --- End Parameter Handlers ---

  // --- Form Submission ---
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // Validation
    if (!testTypeName.trim()) {
      setError("Le nom du type de test est requis.");
      return;
    }
    if (!selectedCategoryId) {
      setError("Veuillez sélectionner une catégorie.");
      return;
    }
    const invalidParam = parameters.find((p) => !p.name?.trim());
    if (invalidParam) {
      setError(
        `Le nom est requis pour tous les paramètres (problème avec paramètre temporaire ID ${invalidParam.tempId}).`
      );
      return;
    }

    setLoadingSubmit(true);

    try {
      let currentTestTypeId = testTypeId; // Use existing ID in edit mode

      // 1. Save Test Type (Insert or Update)
      const testTypePayload = {
        name: testTypeName.trim(),
        category_id: selectedCategoryId,
      };

      if (isEditMode) {
        const { error: updateError } = await supabase
          .from("test_type")
          .update(testTypePayload)
          .eq("id", currentTestTypeId!);
        if (updateError) throw updateError;
      } else {
        const { data: insertedData, error: insertError } = await supabase
          .from("test_type")
          .insert(testTypePayload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        if (!insertedData?.id)
          throw new Error("Impossible d'obtenir l'ID du nouveau type de test.");
        currentTestTypeId = insertedData.id; // Get the new ID for parameter linking
      }

      // 2. Save Parameters (Diffing Approach)
      const finalParamsMap = new Map(parameters.map((p) => [p.tempId, p])); // Map by tempId
      const originalParamsMap = new Map(
        originalParameters.map((p) => [p.tempId, p])
      ); // Map by tempId (uses DB id if available)

      const paramsToDelete: string[] = []; // Store actual DB IDs (UUIDs) to delete
      const paramsToInsert: Omit<
        TestParameter,
        "id" | "created_at" | "updated_at"
      >[] = [];
      const paramsToUpdate: Partial<TestParameter>[] = []; // Store {id, name, unit, ...} for update

      // Find parameters to delete
      originalParameters.forEach((origParam) => {
        if (!finalParamsMap.has(origParam.tempId) && origParam.id) {
          // If it was in original but not final, and has a DB ID
          paramsToDelete.push(origParam.id);
        }
      });

      // Find parameters to insert or update
      parameters.forEach((finalParam) => {
        const originalParam = originalParamsMap.get(finalParam.tempId);
        const paramPayload = {
          test_type_id: currentTestTypeId!, // Link to the saved test type
          name: finalParam.name!.trim(), // Assume validated non-empty
          unit: finalParam.unit?.trim() || null,
          reference_range: finalParam.reference_range?.trim() || null,
          description: finalParam.description?.trim() || null,
        };

        if (originalParam?.id) {
          // It exists in the DB, check if needs update
          // Simple check: stringify comparison (could be more granular)
          const originalPayload = {
            test_type_id: originalParam.test_type_id || currentTestTypeId!, // Use original or current TT ID
            name: originalParam.name!.trim(),
            unit: originalParam.unit?.trim() || null,
            reference_range: originalParam.reference_range?.trim() || null,
            description: originalParam.description?.trim() || null,
          };
          if (
            JSON.stringify(paramPayload) !== JSON.stringify(originalPayload)
          ) {
            paramsToUpdate.push({ id: originalParam.id, ...paramPayload });
          }
        } else {
          // It's a new parameter (doesn't have an original DB id)
          paramsToInsert.push(paramPayload);
        }
      });

      // Execute DB operations
      if (paramsToDelete.length > 0) {
        console.log("Deleting parameters:", paramsToDelete);
        const { error: deleteError } = await supabase
          .from("test_parameter")
          .delete()
          .in("id", paramsToDelete);
        if (deleteError)
          throw new Error(
            `Erreur suppression paramètres: ${deleteError.message}`
          );
      }
      if (paramsToInsert.length > 0) {
        console.log("Inserting parameters:", paramsToInsert);
        const { error: insertError } = await supabase
          .from("test_parameter")
          .insert(paramsToInsert);
        if (insertError)
          throw new Error(
            `Erreur insertion paramètres: ${insertError.message}`
          );
      }
      if (paramsToUpdate.length > 0) {
        console.log("Updating parameters:", paramsToUpdate);
        // Use upsert for simplicity if primary key `id` is provided
        const { error: updateError } = await supabase
          .from("test_parameter")
          .upsert(paramsToUpdate, { onConflict: "id" });
        if (updateError)
          throw new Error(
            `Erreur mise à jour paramètres: ${updateError.message}`
          );
        /* // Alternative: Individual updates (slower but explicit)
                 const updatePromises = paramsToUpdate.map(p =>
                     supabase.from('test_parameter').update({ name: p.name, unit: p.unit, reference_range: p.reference_range, description: p.description, test_type_id: p.test_type_id }).eq('id', p.id!)
                 );
                 const updateResults = await Promise.all(updatePromises);
                 const firstError = updateResults.find(res => res.error);
                 if(firstError?.error) throw new Error(`Erreur mise à jour paramètres: ${firstError.error.message}`);
                 */
      }

      // Success
      console.log("Save successful");
      navigate("/test-types"); // Navigate back to list
    } catch (err: any) {
      console.error("Erreur sauvegarde type de test:", err);
      setError(
        err.message ||
          `Une erreur est survenue lors de ${
            isEditMode ? "la mise à jour" : "l'enregistrement"
          }.`
      );
    } finally {
      setLoadingSubmit(false);
    }
  };
  // --- End Form Submission ---

  // --- Render Logic ---
  if (initialLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" /> {/* Back button */}
        <Card>
          <CardHeader>
            {" "}
            <Skeleton className="h-6 w-1/2" />{" "}
            <Skeleton className="h-4 w-3/4" />{" "}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Separator />
            <Skeleton className="h-6 w-1/3" />
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-9 w-36" />
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-32" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back Button */}
      <div className="mb-4">
        <Link to="/test-types">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="shadow-md">
          {/* Card Header */}
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              {isEditMode ? (
                <ClipboardList className="h-5 w-5" />
              ) : (
                <ClipboardList className="h-5 w-5" />
              )}
              {isEditMode
                ? "Modifier le Type de Test"
                : "Ajouter un Type de Test"}
            </CardTitle>
            <CardDescription>
              Définissez le nom, la catégorie et les paramètres pour ce type de
              test.
            </CardDescription>
          </CardHeader>

          {/* Card Content - Test Type Info */}
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription className="whitespace-pre-line">
                  {error}
                </AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="testTypeName" className="font-semibold">
                  Nom du Type <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="testTypeName"
                  value={testTypeName}
                  onChange={(e) => setTestTypeName(e.target.value)}
                  placeholder="Ex: Numération Formule Sanguine"
                  disabled={loadingSubmit}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="font-semibold">
                  Catégorie <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={(value) => setSelectedCategoryId(value)}
                  disabled={loadingSubmit || availableCategories.length === 0}
                  required
                >
                  <SelectTrigger id="category" className="h-10">
                    <SelectValue placeholder="Sélectionner une catégorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                    {availableCategories.length === 0 && (
                      <SelectItem value="-" disabled>
                        Aucune catégorie
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Parameters Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Paramètres Associés</h3>
              {parameters.length > 0 && (
                <div className="space-y-4">
                  {parameters.map((param, index) => (
                    <Card key={param.tempId} className="bg-muted/30 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Parameter Name */}
                        <div className="space-y-1.5 md:col-span-2">
                          <Label
                            htmlFor={`param-name-${param.tempId}`}
                            className="text-sm"
                          >
                            Nom du Paramètre{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`param-name-${param.tempId}`}
                            value={param.name || ""}
                            onChange={(e) =>
                              handleParameterChange(
                                param.tempId,
                                "name",
                                e.target.value
                              )
                            }
                            placeholder="Ex: Hémoglobine"
                            disabled={loadingSubmit}
                            required
                            className="bg-background h-9"
                          />
                        </div>
                        {/* Unit */}
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`param-unit-${param.tempId}`}
                            className="text-sm"
                          >
                            Unité
                          </Label>
                          <Input
                            id={`param-unit-${param.tempId}`}
                            value={param.unit || ""}
                            onChange={(e) =>
                              handleParameterChange(
                                param.tempId,
                                "unit",
                                e.target.value
                              )
                            }
                            placeholder="Ex: g/dL"
                            disabled={loadingSubmit}
                            className="bg-background h-9"
                          />
                        </div>
                        {/* Reference Range */}
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`param-ref-${param.tempId}`}
                            className="text-sm"
                          >
                            Valeurs de Référence
                          </Label>
                          <Input
                            id={`param-ref-${param.tempId}`}
                            value={param.reference_range || ""}
                            onChange={(e) =>
                              handleParameterChange(
                                param.tempId,
                                "reference_range",
                                e.target.value
                              )
                            }
                            placeholder="Ex: 12.0 - 16.0"
                            disabled={loadingSubmit}
                            className="bg-background h-9"
                          />
                        </div>
                        {/* Description */}
                        <div className="space-y-1.5 md:col-span-2">
                          <Label
                            htmlFor={`param-desc-${param.tempId}`}
                            className="text-sm"
                          >
                            Description (Optionnel)
                          </Label>
                          <Textarea
                            id={`param-desc-${param.tempId}`}
                            value={param.description || ""}
                            onChange={(e) =>
                              handleParameterChange(
                                param.tempId,
                                "description",
                                e.target.value
                              )
                            }
                            placeholder="Explication du paramètre ou des valeurs..."
                            disabled={loadingSubmit}
                            className="bg-background"
                            rows={2}
                          />
                        </div>
                      </div>
                      {/* Remove Button */}
                      <div className="mt-3 text-right">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleParameterRemove(param.tempId)}
                          disabled={loadingSubmit}
                          className="h-8 px-2 py-1 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Retirer Param. #{index + 1}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              {parameters.length === 0 && (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  Aucun paramètre défini pour ce type de test.
                </p>
              )}

              {/* Add Parameter Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleParameterAdd}
                disabled={loadingSubmit}
                className="mt-4"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Ajouter un Paramètre
              </Button>
            </div>
          </CardContent>

          {/* Card Footer */}
          <CardFooter className="border-t px-6 py-4 flex justify-between">
            <Button type="submit" disabled={loadingSubmit || initialLoading}>
              {loadingSubmit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEditMode
                    ? "Enregistrer les Modifications"
                    : "Enregistrer le Type de Test"}
                </>
              )}
            </Button>
            <Link to="/test-types">
              <Button type="button" variant="outline" disabled={loadingSubmit}>
                Annuler
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};

export default TestTypeFormPage;
