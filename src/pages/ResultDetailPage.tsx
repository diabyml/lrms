/* eslint-disable @typescript-eslint/no-unused-vars */

// no typescript check

import { cn } from "@/lib/utils"; // Adjust path if needed
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient"; // Adjust path if needed

// Shadcn/ui Imports
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path if needed
import { Button } from "@/components/ui/button"; // Adjust path if needed
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Adjust path if needed
import { Label } from "@/components/ui/label"; // Added Label
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Adjust path if needed
import { Separator } from "@/components/ui/separator"; // Adjust path if needed
import { Skeleton } from "@/components/ui/skeleton"; // Adjust path if needed
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Adjust path if needed

// Icons & Date Handling
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle,
  Download,
  Edit,
  FileText,
  Hourglass,
  Info,
  Layers,
  ListChecks,
  Loader2,
  Phone,
  Printer,
  Stethoscope,
  User,
  Workflow,
} from "lucide-react";

import { useRef } from "react"; // Impo

import Template1 from "@/components/print_header/Template1"; // Adjust path
import Template2 from "@/components/print_header/Template2"; // Adjust path
import Template3 from "@/components/print_header/Template3"; // Adjust path
import Template4 from "@/components/print_header/Template4"; // Adjust path
import { Badge } from "@/components/ui/badge";

const availableHeaderTemplates = [
  { id: "template1", component: Template1 },
  { id: "template2", component: Template2 },
  { id: "template3", component: Template3 },
  { id: "template4", component: Template4 },
];
const defaultTemplateId = "template1"; // Match default in DB/settings page

// draggable-categories
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable, // Keep this one for the button item
  horizontalListSortingStrategy, // Use horizontal strategy for buttons
  // verticalListSortingStrategy, // No longer needed for categories directly
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react"; // Keep or use another handle icon if preferred

// --- Types ---
type PatientResult = Tables<"patient_result">;
type Patient = Tables<"patient">;
type Doctor = Tables<"doctor">;
// Removed unused type ResultValue
type TestParameter = Tables<"test_parameter">;
type TestType = Tables<"test_type">;
type Category = Tables<"category">;

type PrintConfig = Tables<"print_header_config">;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface TestTypeWithCategory extends TestType {
  // category_id is already in TestType from DB schema
  category: Pick<Category, "id" | "name"> | null; // Added for join result clarity
}
// Removed unused interface TestParameterWithDetails
interface ResultParameterDetail extends TestParameter {
  resultValue: string;
}
interface GroupedTestType {
  testType: TestType;
  parameters: ResultParameterDetail[];
}
interface GroupedCategoryResult {
  category: Category;
  testTypes: GroupedTestType[];
}
type ResultStatus = "attente" | "en cours" | "fini";
// --- End Types ---

// --- Helper Functions ---
const getStatusBadgeVariant = (
  status: ResultStatus | string | null
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status?.toLowerCase()) {
    case "fini":
      return "default";
    case "en cours":
      return "secondary";
    case "attente":
      return "outline";
    default:
      return "secondary";
  }
};
const displayStatus = (status: ResultStatus | string | null): string => {
  switch (status?.toLowerCase()) {
    case "fini":
      return "Fini";
    case "en cours":
      return "En cours";
    case "attente":
      return "En attente";
    default:
      return status || "Inconnu";
  }
};
// --- End Helper Functions ---

// --- Component ---
const ResultDetailPage: React.FC = () => {
  const { resultId } = useParams<{ resultId: string }>();
  const [resultData, setResultData] = useState<PatientResult | null>(null);
  const [patientData, setPatientData] = useState<Patient | null>(null);
  const [doctorData, setDoctorData] = useState<Doctor | null>(null);
  const [groupedResults, setGroupedResults] = useState<GroupedCategoryResult[]>(
    []
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStatusUpdate, setLoadingStatusUpdate] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(
    null
  );

  const [headerConfig, setHeaderConfig] = useState<PrintConfig | null>(null);
  const [loadingHeader, setLoadingHeader] = useState<boolean>(true); // Separate loading state

  const reportContentRef = useRef<HTMLDivElement>(null); // Create the ref

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates, // sortableKeyboardCoordinates might need adjustments for horizontal
    })
  );

  // Find the selected header component
  const SelectedHeaderComponent = useMemo(() => {
    const templateId = headerConfig?.selected_template || defaultTemplateId;
    return (
      availableHeaderTemplates.find((t) => t.id === templateId)?.component ||
      Template1
    ); // Fallback
  }, [headerConfig]);

  // Prepare data for the header component
  const headerDataProps = useMemo(
    () => ({
      logoUrl: headerConfig?.logo_url || null,
      labName: headerConfig?.lab_name,
      addressLine1: headerConfig?.address_line1,
      addressLine2: headerConfig?.address_line2,
      cityPostalCode: headerConfig?.city_postal_code,
      phone: headerConfig?.phone,
      email: headerConfig?.email,
      website: headerConfig?.website,
    }),
    [headerConfig]
  );

  // Fetch all necessary data based on resultId
  const fetchResultDetails = useCallback(async () => {
    if (!resultId) {
      setError("ID du résultat manquant.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setStatusUpdateError(null);
    setResultData(null);
    setPatientData(null);
    setDoctorData(null);
    setGroupedResults([]);
    setHeaderConfig(null); // Reset header config

    try {
      // 1. Fetch the main result record
      const { data: result, error: resultError } = await supabase
        .from("patient_result")
        .select("*")
        .eq("id", resultId)
        .single();

      if (resultError) throw resultError;
      if (!result) throw new Error("Résultat non trouvé.");
      setResultData(result);

      // 2. Fetch related Patient and Doctor data concurrently
      const [patientRes, doctorRes, headerRes] = await Promise.all([
        supabase
          .from("patient")
          .select("*")
          .eq("id", result.patient_id)
          .single(),
        supabase.from("doctor").select("*").eq("id", result.doctor_id).single(),
        supabase.from("print_header_config").select("*").limit(1).maybeSingle(), // Fetch header config
      ]);

      if (patientRes.error)
        console.warn("Erreur chargement patient:", patientRes.error.message);

      if (doctorRes.error)
        console.warn("Erreur chargement médecin:", doctorRes.error.message);

      setPatientData(patientRes.data);
      setDoctorData(doctorRes.data);

      // --- Handle Header Config ---
      if (headerRes.error)
        console.warn(
          "Erreur chargement config en-tête:",
          headerRes.error.message
        ); // Warn but continue
      setHeaderConfig(headerRes.data); // Set header config (can be null)
      setLoadingHeader(false); // Header loading done

      // 3. Fetch Result Values joined with Parameter, Test Type, and CATEGORY details
      const { data: valuesData, error: valuesError } = await supabase
        .from("result_value")
        .select(
          `
                    value,
                    test_parameter: test_parameter_id (
                        *,
                        test_type: test_type_id (
                            *,
                            category: category_id (id, name)
                        )
                    )
                `
        )
        .eq("patient_result_id", resultId);

      if (valuesError) throw valuesError;

      // 4. Process and group the fetched values by CATEGORY, then by Test Type
      const categoryMap = new Map<string, GroupedCategoryResult>();

      (valuesData || []).forEach((rv) => {
        // Type assertion might be needed based on Supabase client version/typing
        const param = rv.test_parameter as
          | (TestParameter & {
              test_type: (TestType & { category: Category | null }) | null;
            })
          | null;

        if (param && param.test_type && param.test_type.category) {
          const categoryId = param.test_type.category.id;
          const categoryName = param.test_type.category.name;
          const testTypeId = param.test_type.id;
          const testTypeName = param.test_type.name;

          // Ensure Category Group exists
          if (!categoryMap.has(categoryId)) {
            categoryMap.set(categoryId, {
              category: {
                ...param.test_type.category,
                created_at: "",
                updated_at: "",
              }, // Reconstruct Category
              testTypes: [],
            });
          }
          const categoryGroup = categoryMap.get(categoryId)!;

          // Find or create Test Type Group within the Category Group
          let testTypeGroup = categoryGroup.testTypes.find(
            (ttg) => ttg.testType.id === testTypeId
          );
          if (!testTypeGroup) {
            testTypeGroup = {
              // Reconstruct TestType, ensure category_id is included
              testType: {
                ...param.test_type,
                category_id: categoryId,
                category: null,
              }, // Remove nested category here if needed
              parameters: [],
            };
            categoryGroup.testTypes.push(testTypeGroup);
          }

          // Add parameter details
          testTypeGroup.parameters.push({
            ...param, // Spread the raw parameter details
            resultValue: rv.value, // Add the actual result value
            // remove nested test_type from param spread if causing issues
            test_type: null, // We handle test type at the group level
          });
        } else {
          console.warn(
            "Données de paramètre/type/catégorie manquantes pour une valeur:",
            rv
          );
        }
      });

      // Sort parameters, test types, and categories
      categoryMap.forEach((categoryGroup) => {
        categoryGroup.testTypes.forEach((testTypeGroup) => {
          testTypeGroup.parameters.sort((a, b) => a.name.localeCompare(b.name));
        });
        categoryGroup.testTypes.sort((a, b) =>
          a.testType.name.localeCompare(b.testType.name)
        );
      });
      const sortedGroupedResults = Array.from(categoryMap.values()).sort(
        (a, b) => a.category.name.localeCompare(b.category.name)
      );

      setGroupedResults(sortedGroupedResults);
    } catch (err: any) {
      console.error("Erreur chargement détails du résultat:", err);
      setError(
        err.message || "Une erreur est survenue lors du chargement du résultat."
      );
    } finally {
      setLoading(false);
    }
  }, [resultId]);

  useEffect(() => {
    fetchResultDetails();
  }, [fetchResultDetails]);

  // --- Handle Status Change ---
  const handleStatusChange = async (newStatus: ResultStatus) => {
    if (!resultData || newStatus === resultData.status) return;

    setLoadingStatusUpdate(true);
    setStatusUpdateError(null);

    try {
      const { data, error: updateError } = await supabase
        .from("patient_result")
        .update({ status: newStatus })
        .eq("id", resultData.id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (data) {
        setResultData(data);
      } else {
        setResultData((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      // Optionally show success toast here
    } catch (err: any) {
      console.error("Erreur mise à jour statut:", err);
      setStatusUpdateError(
        err.message || "Impossible de mettre à jour le statut."
      );
    } finally {
      setLoadingStatusUpdate(false);
    }
  };

  // --- Print Handler ---
  const handlePrint = () => {
    // Optional: Could add checks here, like if data is loaded
    window.print();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setGroupedResults((items) => {
        // active.id and over.id will be category IDs from the buttons
        const oldIndex = items.findIndex(
          (item) => item.category.id === active.id
        );
        const newIndex = items.findIndex(
          (item) => item.category.id === over.id
        );
        if (oldIndex === -1 || newIndex === -1) return items; // Safety check
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // --- Render Logic ---
  // --- Render Logic ---
  const renderInfoItem = (
    icon: React.ElementType,
    label: string,
    value: string | null | undefined,
    className?: string
  ) => {
    const Icon = icon;
    return (
      <div className={cn("flex items-start space-x-3", className)}>
        <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0 print:h-4 print:w-4" />
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="text-sm font-bold print:text-xs">
            {value || (
              <span className="text-muted-foreground italic">Non spécifié</span>
            )}
          </p>
        </div>
      </div>
    );
  };

  if (loading || loadingHeader) {
    // Check both loading states
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32 mt-1" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32 mt-1" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32 mt-1" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <div className="mb-4">
          <Link
            to={
              resultData?.patient_id
                ? `/patients/${resultData.patient_id}`
                : "/patients"
            }
          >
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Button>
          </Link>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            {error}{" "}
            <Button
              variant="link"
              onClick={fetchResultDetails}
              className="p-0 h-auto text-destructive-foreground underline"
            >
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!resultData) return <div>Résultat non trouvé.</div>;

  // --- Main Render ---
  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 print:hidden">
        <div>
          <Link to={patientData ? `/patients/${patientData.id}` : "/patients"}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour {patientData ? `à ${patientData.full_name}` : "à la liste"}
            </Button>
          </Link>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 order-first sm:order-none">
          <FileText className="h-6 w-6 text-primary" />
          Détails du Résultat
        </h1>
        <div className="flex gap-2">
          <Link to={`/results/${resultId}/edit`}>
            <Button variant="secondary" size="sm">
              <Edit className="mr-2 h-4 w-4" /> Modifier
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={loading}
          >
            <Printer className="mr-2 h-4 w-4" /> Imprimer
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Download className="mr-2 h-4 w-4" /> Télécharger
          </Button>
        </div>
      </div>
      {/* --- Report Content Wrapper (for Print/PDF) --- */}
      <div
        ref={reportContentRef}
        className="report-content bg-white p-4 sm:p-6 border border-transparent print:border-none print:p-0 print:shadow-none"
      >
        {/* 1. Render the Dynamic Header */}
        {headerConfig ? (
          <div className="mb-6 print:mb-4">
            <SelectedHeaderComponent
              data={headerDataProps}
              isPreview={false}
              reportTitle="RAPPORT DE RÉSULTATS"
            />
          </div>
        ) : (
          <Alert variant="default" className="mb-6 print:hidden">
            {/* ... Header Missing Alert ... */}
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>En-tête Manquant</AlertTitle>
            <AlertDescription>
              La configuration de l'en-tête d'impression n'a pas été trouvée.{" "}
              <Link to="/settings/print-header" className="underline">
                Configurer maintenant
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}

        <Separator className="my-4 print:hidden" />

        {/* 2. Info Grid (Patient, Doctor, Result Meta) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 print:mb-4 print:grid-cols-3">
          {/* Patient Card */}
          <Card className="overflow-hidden print:shadow-none _print:border-none">
            <CardHeader className="pb-2 print:pb-1">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 print:text-xs">
                <User className="h-4 w-4" />
                Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-1 print:space-y-0.5 print:pt-0.5">
              {renderInfoItem(Info, "Nom Complet", patientData?.full_name)}
              {renderInfoItem(
                Info,
                "ID Unique",
                patientData?.patient_unique_id
              )}
              {renderInfoItem(
                CalendarDays,
                "Date Naissance",
                patientData?.date_of_birth
                  ? format(parseISO(patientData.date_of_birth), "P", {
                      locale: fr,
                    })
                  : null
              )}
            </CardContent>
          </Card>
          {/* Doctor Card */}
          <Card className="overflow-hidden print:shadow-none _print:border-none">
            <CardHeader className="pb-2 print:pb-1">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 print:text-xs">
                <Stethoscope className="h-4 w-4" />
                Médecin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-1 print:space-y-0.5 print:pt-0.5">
              {renderInfoItem(User, "Nom", doctorData?.full_name)}
              {renderInfoItem(Phone, "Téléphone", doctorData?.phone)}
              {renderInfoItem(Info, "Hôpital", doctorData?.hospital)}
            </CardContent>
          </Card>
          {/* Result Info Card */}
          <Card className="overflow-hidden print:shadow-none _print:border-none">
            <CardHeader className="pb-2 print:pb-1">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 print:text-xs">
                <ListChecks className="h-4 w-4" />
                Résultat Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-1 print:space-y-0.5 print:pt-0.5">
              {renderInfoItem(
                CalendarDays,
                "Date Résultat",
                resultData.result_date
                  ? format(parseISO(resultData.result_date), "Pp", {
                      locale: fr,
                    })
                  : null
              )}
              {/* Status Display */}
              <div className="flex items-start space-x-3">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0 print:h-4 print:w-4" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Statut
                  </p>
                  {/* Status Select (Screen Only) */}
                  <div className="flex items-center gap-2 print:hidden">
                    <Select
                      value={resultData.status ?? ""}
                      onValueChange={(value: ResultStatus) =>
                        handleStatusChange(value)
                      }
                      disabled={loadingStatusUpdate}
                    >
                      <SelectTrigger id="resultStatus" className="h-9 flex-1">
                        {" "}
                        <SelectValue placeholder="Changer statut..." />{" "}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attente">
                          <div className="flex items-center gap-2">
                            <Workflow className="h-4 w-4 text-muted-foreground" />{" "}
                            En attente
                          </div>
                        </SelectItem>
                        <SelectItem value="en cours">
                          <div className="flex items-center gap-2">
                            <Hourglass className="h-4 w-4 text-blue-600" /> En
                            cours
                          </div>
                        </SelectItem>
                        <SelectItem value="fini">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />{" "}
                            Fini
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {loadingStatusUpdate && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {statusUpdateError && (
                    <p className="text-xs text-destructive mt-1 print:hidden">
                      {statusUpdateError}
                    </p>
                  )}
                  {/* Status Badge (Print Only) */}
                  <Badge
                    variant={getStatusBadgeVariant(resultData.status)}
                    className="hidden text-sm font-medium print:inline-flex print:text-xs print:font-normal print:border print:shadow-none"
                  >
                    {displayStatus(resultData.status)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- Category Reorder Buttons (UPDATED with DND) --- */}
        {groupedResults.length > 1 && (
          <div className="my-6 print:hidden">
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">
              Réorganiser les Catégories (Glisser-Déposer) :
            </Label>
            {/* Wrap buttons in Dnd Context */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={groupedResults.map((g) => g.category.id)} // IDs for context
                strategy={horizontalListSortingStrategy} // Use horizontal strategy
              >
                <div className="flex flex-wrap gap-2">
                  {/* Map over groupedResults to render sortable buttons */}
                  {groupedResults.map((categoryGroup) => (
                    <SortableCategoryButton
                      key={categoryGroup.category.id}
                      category={categoryGroup.category}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <Separator className="mt-6" />
          </div>
        )}
        {/* --- End Category Reorder Buttons --- */}

        {/* 3. Grouped Results Section */}
        <div className="space-y-6 print:space-y-4">
          {groupedResults.length === 0 && (
            <Card className="print:border-none print:shadow-none">
              <CardContent className="pt-6 text-center text-muted-foreground print:pt-2">
                Aucune valeur de résultat enregistrée pour ce rapport.
              </CardContent>
            </Card>
          )}

          {groupedResults.map((categoryGroup) => (
            <div
              key={categoryGroup.category.id}
              className="space-y-3 _print:break-inside-avoid-page"
            >
              {/* Category Header */}
              <div className="flex items-center gap-3 pt-4 print:pt-2">
                <Layers className="h-5 w-5 text-primary print:h-4 print:w-4" />
                <h2 className="text-xl font-bold  tracking-tight print:text-base">
                  {categoryGroup.category.name}
                </h2>
                <Separator className="flex-1 print:hidden" />
              </div>

              {/* Test Type Tables/Rows within Category */}
              {categoryGroup.testTypes.map((testTypeGroup) => {
                const isSingleParameter = testTypeGroup.parameters.length === 1;
                const singleParam = isSingleParameter
                  ? testTypeGroup.parameters[0]
                  : null;

                return (
                  <div
                    key={testTypeGroup.testType.id}
                    className={cn(
                      "print:break-inside-avoid",
                      !isSingleParameter && "ml-4 sm:ml-8 print:ml-0" // Indent only if multiple params or zero
                    )}
                  >
                    {/* Conditionally render Test Type Name */}
                    {!isSingleParameter && (
                      <h3 className="text-base font-regular mb-1 print:text-sm">
                        {testTypeGroup.testType.name}
                      </h3>
                    )}

                    {/* Render Table */}
                    <Table
                      className={cn(
                        "print:text-xs",
                        isSingleParameter && "mt-1"
                      )}
                    >
                      {/* Conditionally render TableHeader only if NOT single parameter */}
                      {!isSingleParameter && (
                        <TableHeader className="bg-muted/10 print:bg-gray-100">
                          <TableRow>
                            <TableHead className="w-[40%] pl-2 print:pl-0">
                              Paramètre
                            </TableHead>
                            <TableHead className="w-[20%]">Valeur</TableHead>
                            <TableHead className="w-[15%]">Unité</TableHead>
                            <TableHead className="w-[25%] pr-2 print:pr-0">
                              Réf.
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                      )}
                      <TableBody>
                        {/* If single param, render it directly WITH EXPLICIT WIDTHS */}
                        {isSingleParameter && singleParam ? (
                          <TableRow className="print:even:bg-white print:break-inside-avoid">
                            {/* Apply matching width classes here */}
                            <TableCell className="font-medium pl-10   print:pl-0 w-[40%]">
                              {singleParam.name}
                            </TableCell>
                            <TableCell className=" pl-7 print:pl-2 w-[20%]">
                              {singleParam.resultValue}
                            </TableCell>
                            <TableCell className="pl-5 print:pl-2 w-[15%]">
                              {singleParam.unit || "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground pr-2 print:pr-0 w-[25%]">
                              {singleParam.reference_range || "-"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          // Otherwise, map multiple parameters (widths applied via TableHead)
                          testTypeGroup.parameters.map((param) => (
                            <TableRow
                              key={param.id}
                              className="print:even:bg-white print:break-inside-avoid"
                            >
                              <TableCell className="font-medium pl-2 print:pl-0">
                                {param.name}
                              </TableCell>
                              <TableCell>{param.resultValue}</TableCell>
                              <TableCell>{param.unit || "-"}</TableCell>
                              <TableCell className="text-muted-foreground pr-2 print:pr-0">
                                {param.reference_range || "-"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                        {/* Handle case of a test type with ZERO parameters */}
                        {testTypeGroup.parameters.length === 0 && (
                          // ... zero parameters row ...
                          <TableRow className="print:break-inside-avoid">
                            <TableCell
                              colSpan={4}
                              className="h-10 text-center text-xs italic text-muted-foreground pl-2 print:pl-0"
                            >
                              (Aucun paramètre pour ce test)
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>{" "}
      {/* End Report Content Wrapper */}
    </div> // End main container div
  );
};

// src/pages/ResultDetailPage.tsx -> Define this component within or import it

interface SortableCategoryButtonProps {
  category: Category; // Pass the category object
  // No children needed if button content is defined here
}

const SortableCategoryButton: React.FC<SortableCategoryButtonProps> = ({
  category,
}) => {
  const {
    attributes,
    listeners, // Listeners for the drag handle
    setNodeRef, // Ref for the whole sortable item (the button container)
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id }); // Use category ID

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    // Apply ref, style, and non-listener attributes to the container
    <div ref={setNodeRef} style={style} {...attributes}>
      {/* Button now includes the drag handle */}
      <Button
        variant="secondary"
        size="sm"
        className="cursor-grab touch-none flex items-center gap-1.5" // Add flex styling
      >
        {/* Drag Handle Element - Apply listeners here */}
        <span {...listeners} aria-label={`Réorganiser ${category.name}`}>
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </span>
        {category.name}
      </Button>
    </div>
  );
};
// --- End SortableCategoryButton ---

export default ResultDetailPage;
