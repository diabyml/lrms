/* eslint-disable @typescript-eslint/no-unused-vars */

// no typescript check

import { cn } from "@/lib/utils"; // Adjust path if needed
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient"; // Adjust path if needed

// Shadcn/ui Imports
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path if needed
import { Button } from "@/components/ui/button"; // Adjust path if needed
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Adjust path if needed
import { Checkbox } from "@/components/ui/checkbox"; // Adjust path if needed
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
  ArrowDownToLine,
  ArrowLeft,
  CalendarDays,
  CheckCircle,
  Download,
  Edit,
  FileText,
  Hourglass,
  Info,
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
import { checkValueRangeStatus, RangeCheckStatus } from "@/lib/rangeChecker";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove, // Keep this one for the button item
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable, // Keep this one for the button item
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react"; // Keep or use another handle icon if preferred
import Footer from "@/components/Footer";

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
  const navigate = useNavigate();
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

  const [forceBreakBefore, setForceBreakBefore] = useState<
    Record<string, boolean>
  >({}); // Maps categoryId to boolean

  type HighlightOverride = "on" | "off" | "warn";
  const [highlightOverrides, setHighlightOverrides] = useState<
    Record<string, HighlightOverride>
  >({});

  const [description, setDescription] = useState<string>("");
  const [savingDescription, setSavingDescription] = useState(false);

  const [editingPrices, setEditingPrices] = useState(false);
  const [normalPrice, setNormalPrice] = useState<string>("");
  const [insurancePrice, setInsurancePrice] = useState<string>("");
  const [savingPrices, setSavingPrices] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);

  // Add state for skip range check values
  const [skipRangeCheckValues, setSkipRangeCheckValues] = useState<{ value: string; type: string }[]>([]);

  useEffect(() => {
    // Fetch skip_range_check values from Supabase
    const fetchSkipRangeCheck = async () => {
      const { data, error } = await supabase.from("skip_range_check").select("value, type");
      if (!error && data) {
        setSkipRangeCheckValues(data);
      }
    };
    fetchSkipRangeCheck();
  }, []);

  // Add state for margin top control
  const [marginTop, setMarginTop] = useState(5); // default to 20

  // Add state for column widths
  const [paramWidth, setParamWidth] = useState(40);
  const [valueWidth, setValueWidth] = useState(15);
  const [unitWidth, setUnitWidth] = useState(10);
  const [refWidth, setRefWidth] = useState(35);

  // Load column widths from Supabase on mount
  useEffect(() => {
    async function fetchColumnWidths() {
      const { data, error } = await supabase
        .from("result_column_widths")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      if (data) {
        setParamWidth(data.param_width);
        setValueWidth(data.value_width);
        setUnitWidth(data.unit_width);
        setRefWidth(data.ref_width);
      }
      // If not found or error, keep defaults
    }
    fetchColumnWidths();
  }, []);

  // --- Print Category Selection State ---
  const [categoriesToPrint, setCategoriesToPrint] = useState<string[]>([]);

  useEffect(() => {
    if (groupedResults.length > 0) {
      setCategoriesToPrint((prev) => {
        if (prev.length === 0) {
          return groupedResults.map((g) => g.category.id);
        }
        const currentSet = new Set(prev);
        groupedResults.forEach((g) => currentSet.add(g.category.id));
        return Array.from(currentSet);
      });
    }
  }, [groupedResults]);

  const handleCategoryPrintToggle = (categoryId: string) => {
    setCategoriesToPrint((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

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
          testTypeGroup.parameters.sort((a, b) => {
            // First sort by order
            if (a.order !== b.order) {
              return a.order - b.order;
            }
            // If orders are equal, fallback to sorting by name
            return a.name.localeCompare(b.name);
          });
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

  useEffect(() => {
    if (resultData?.description) {
      setDescription(resultData.description);
    }
  }, [resultData]);

  useEffect(() => {
    setNormalPrice(
      resultData?.normal_price != null ? String(resultData.normal_price) : ""
    );
    setInsurancePrice(
      resultData?.insurance_price != null
        ? String(resultData.insurance_price)
        : ""
    );
  }, [resultData]);

  // Save description with debounce
  const saveDescription = useCallback(
    async (newDescription: string) => {
      if (!resultId) return;
      setSavingDescription(true);

      try {
        const { error } = await supabase
          .from("patient_result")
          .update({ description: newDescription })
          .eq("id", resultId);

        if (error) throw error;
      } catch (err: any) {
        console.error("Error saving description:", err);
      } finally {
        setSavingDescription(false);
      }
    },
    [resultId]
  );

  // Debounced save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (description !== resultData?.description) {
        saveDescription(description);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [description, resultData?.description, saveDescription]);

  // Save prices
  const savePrices = useCallback(async () => {
    setSavingPrices(true);
    setPricesError(null);
    try {
      const normal = normalPrice !== "" ? Number(normalPrice) : null;
      const insurance = insurancePrice !== "" ? Number(insurancePrice) : null;
      if (
        (normalPrice !== "" && isNaN(normal)) ||
        (insurancePrice !== "" && isNaN(insurance))
      ) {
        setPricesError("Les prix doivent être des nombres valides.");
        setSavingPrices(false);
        return;
      }
      const { error, data } = await supabase
        .from("patient_result")
        .update({ normal_price: normal, insurance_price: insurance })
        .eq("id", resultData.id)
        .select()
        .single();
      if (error) throw error;
      setResultData((prev) =>
        prev
          ? { ...prev, normal_price: normal, insurance_price: insurance }
          : prev
      );
      setEditingPrices(false);
    } catch (err: any) {
      setPricesError(err.message || "Erreur lors de la sauvegarde des prix.");
    } finally {
      setSavingPrices(false);
    }
  }, [resultData, normalPrice, insurancePrice]);

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

  // --- Page Break Toggle Handler --- NEW FUNCTION ---
  const handleForceBreakToggle = (categoryId: string, shouldBreak: boolean) => {
    setForceBreakBefore((prev) => ({
      ...prev,
      [categoryId]: shouldBreak, // Set the boolean value for the specific categoryId
    }));
  };
  // --- End Page Break Toggle Handler ---

  // --- Highlight Override Handler --- NEW FUNCTION ---
  // --- Override Toggle Handler ---
  const handleHighlightToggle = (parameterId: string) => {
    setHighlightOverrides((prevOverrides) => {
      const currentOverride = prevOverrides[parameterId];
      const newOverrides = { ...prevOverrides };

      // Determine automatic status first
      let autoStatus: RangeCheckStatus = "indeterminate";
      // Find the parameter data (consider optimizing this lookup if needed)
      for (const category of groupedResults) {
        for (const testType of category.testTypes) {
          const param = testType.parameters.find((p) => p.id === parameterId);
          if (param) {
            autoStatus = checkValueRangeStatus(
              param.resultValue,
              param.reference_range,
              category.category.name,
              testType.testType.name,
              skipRangeCheckValues.map( ({value}) =>  value )
            );
            break;
          }
        }
        if (autoStatus !== "indeterminate") break; // Found and checked
      }

      // Cycle logic: Auto -> Force Off -> Force On -> Force Warn -> Auto...
      if (currentOverride === undefined) {
        // No override -> Force Off
        newOverrides[parameterId] = "off";
      } else if (currentOverride === "off") {
        // Forced Off -> Force On (Red)
        newOverrides[parameterId] = "on";
      } else if (currentOverride === "on") {
        // Forced On -> Force Warn (Orange)
        newOverrides[parameterId] = "warn";
      } else {
        // currentOverride === 'warn'
        // Forced Warn -> Remove override (back to Auto)
        delete newOverrides[parameterId];
      }

      return newOverrides;
    });
  };
  // --- End Highlight Override Handler ---

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
              <span className="text-muted-foreground italic font-normal">
                Non spécifié
              </span>
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
        className="report-content bg-white  p-4 sm:p-6 border border-transparent print:border-none print:p-0 print:shadow-none"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 print:mb-4 print:grid-cols-2 print:hidden">
          {/* Patient Card */}
          <Card className="overflow-hidden print:shadow-none">
            <CardHeader className="pb-2 print:pb-1">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 print:text-xs">
                <User className="h-4 w-4" />
                Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-1 print:space-y-0.5 print:pt-0.5">
              {renderInfoItem(Info, "NOM PRENOM", patientData?.full_name)}
              {renderInfoItem(
                Info,
                "IDENTIFIANT Unique",
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
              <div className="hidden print:block">
                {renderInfoItem(
                  CalendarDays,
                  "Date Résultat",
                  resultData.result_date
                    ? format(parseISO(resultData.result_date), "Pp", {
                        locale: fr,
                      })
                    : null
                )}
              </div>
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
              {renderInfoItem(User, "NOM PRENOM", doctorData?.full_name)}
              {renderInfoItem(Phone, "Téléphone", doctorData?.phone)}
              {renderInfoItem(Info, "Provenance", doctorData?.hospital)}
            </CardContent>
          </Card>
          {/* Result Info Card */}
          <Card className="overflow-hidden print:shadow-none _print:border-none  print:hidden">
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
              {/* --- Price Fields (Screen Only, Not Print) --- */}
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="normal_price" className="text-xs font-medium">
                    Prix Normal
                  </Label>
                  {editingPrices ? (
                    <input
                      id="normal_price"
                      type="number"
                      min="0"
                      step="0.01"
                      className="border rounded px-2 py-1 text-xs w-28"
                      value={normalPrice}
                      onChange={(e) => setNormalPrice(e.target.value)}
                      disabled={savingPrices}
                    />
                  ) : (
                    <input
                      id="normal_price"
                      type="text"
                      className="border-none bg-transparent text-xs w-28"
                      value={normalPrice}
                      disabled
                      readOnly
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="insurance_price"
                    className="text-xs font-medium"
                  >
                    Prix Assurance
                  </Label>
                  {editingPrices ? (
                    <input
                      id="insurance_price"
                      type="number"
                      min="0"
                      step="0.01"
                      className="border rounded px-2 py-1 text-xs w-28"
                      value={insurancePrice}
                      onChange={(e) => setInsurancePrice(e.target.value)}
                      disabled={savingPrices}
                    />
                  ) : (
                    <input
                      id="insurance_price"
                      type="text"
                      className="border-none bg-transparent text-xs w-28"
                      value={insurancePrice}
                      disabled
                      readOnly
                    />
                  )}
                </div>
                {/* Action Buttons */}
                <div className="flex gap-2 mt-1">
                  {editingPrices ? (
                    <>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={savePrices}
                        disabled={savingPrices}
                      >
                        {savingPrices ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : null}
                        Sauvegarder
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setEditingPrices(false)}
                        disabled={savingPrices}
                      >
                        Annuler
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setEditingPrices(true)}
                    >
                      Modifier Prix
                    </Button>
                  )}
                </div>
                {pricesError && (
                  <p className="text-xs text-destructive mt-1">{pricesError}</p>
                )}
              </div>
              {/* --- End Price Fields --- */}
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
        {/* print info grid for print only*/}
        <div className="grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 print:mb-4 print:grid-cols-2 hidden print:grid">
          {/* Patient Info */}
          <div className="flex flex-col gap-1 rounded-lg border border-slate-600 print:shadow-lg bg-white/90 p-3 print:border  print:bg-white print:rounded-md print:p-2 text-xs">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <User className="h-4 w-4" /> Patient
            </div>
            {renderInfoItem(Info, "NOM PRENOM", patientData?.full_name)}
            {renderInfoItem(Info, "ID Unique", patientData?.patient_unique_id)}
            {renderInfoItem(
              CalendarDays,
              "Date de Naissance",
              patientData?.date_of_birth
                ? format(parseISO(patientData.date_of_birth), "P", {
                    locale: fr,
                  })
                : null
            )}
            {/* <div className="hidden print:block">
              {renderInfoItem(
                CalendarDays,
                "Date Résultat",
                resultData.result_date
                  ? format(parseISO(resultData.result_date), "Pp", { locale: fr })
                  : null
              )}
            </div> */}
          </div>

          {/* Doctor Info */}
          <div className="flex flex-col gap-1 rounded-lg border border-slate-600  bg-white/90 p-3 print:border print:shadow-lg print:bg-white print:rounded-md print:p-2 text-xs">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <Stethoscope className="h-4 w-4" /> Médecin
            </div>
            {renderInfoItem(User, "NOM PRENOM", doctorData?.full_name)}
            {renderInfoItem(Phone, "Téléphone", doctorData?.phone)}
            {renderInfoItem(Info, "Hôpital", doctorData?.hospital)}
          </div>
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

        {/* Column width controls (screen only, visible ONCE for all groups) */}
        <div className="flex gap-4 mb-2 print:hidden items-end">
          <div className="flex flex-col text-xs">
            <label htmlFor="paramWidth">Paramètre (%)</label>
            <input
              id="paramWidth"
              type="number"
              min={5}
              max={80}
              value={paramWidth}
              onChange={(e) => setParamWidth(Number(e.target.value))}
              className="border px-2 py-1 w-16 rounded"
            />
          </div>
          <div className="flex flex-col text-xs">
            <label htmlFor="valueWidth">Valeur (%)</label>
            <input
              id="valueWidth"
              type="number"
              min={5}
              max={80}
              value={valueWidth}
              onChange={(e) => setValueWidth(Number(e.target.value))}
              className="border px-2 py-1 w-16 rounded"
            />
          </div>
          <div className="flex flex-col text-xs">
            <label htmlFor="unitWidth">Unité (%)</label>
            <input
              id="unitWidth"
              type="number"
              min={5}
              max={80}
              value={unitWidth}
              onChange={(e) => setUnitWidth(Number(e.target.value))}
              className="border px-2 py-1 w-16 rounded"
            />
          </div>
          <div className="flex flex-col text-xs">
            <label htmlFor="refWidth">Réf. (%)</label>
            <input
              id="refWidth"
              type="number"
              min={5}
              max={80}
              value={refWidth}
              onChange={(e) => setRefWidth(Number(e.target.value))}
              className="border px-2 py-1 w-16 rounded"
            />
          </div>
        </div>

        {/* --- 3. Grouped Results Section (Single Table per Category + Page Break Toggle) --- */}
        <div className="space-y-8 print:space-y-4">
          {groupedResults.map((categoryGroup) => {
            const shouldForceBreak = forceBreakBefore[categoryGroup.category.id] ?? false;
            const shouldPrint = categoriesToPrint.includes(categoryGroup.category.id);
            return (
              <div
                key={categoryGroup.category.id}
                className={cn(
                  shouldForceBreak && "print-force-break-before",
                  !shouldPrint && "print:hidden"
                )}
              >
                {/* Category Header (Includes Page Break Toggle) */}
                <div className="flex items-center gap-3 mb-3 print:mb-2">
                  {" "}
                  {/* Added bottom margin */}
                  {/* <Layers className="h-5 w-5 text-primary print:h-4 print:w-4" /> */}
                  <h2 className="text-xl font-bold uppercase mx-auto tracking-tight  print:text-center">
                    {" "}
                    {/* Corrected font-weight */}
                    {categoryGroup.category.name}
                  </h2>
                  <Separator className="flex-1 print:hidden" />
                  {/* --- Page Break Toggle Checkbox (Screen Only - KEPT FROM YOUR CODE) --- */}
                  <div className="flex items-center space-x-2 ml-auto print:hidden pl-4">
                    <Checkbox
                      id={`break-${categoryGroup.category.id}`}
                      checked={shouldForceBreak}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        handleForceBreakToggle(
                          categoryGroup.category.id,
                          isChecked
                        );
                      }}
                      aria-label="Forcer saut de page avant"
                    />
                    <Label
                      htmlFor={`break-${categoryGroup.category.id}`}
                      className="text-xs font-medium text-muted-foreground cursor-pointer flex items-center gap-1"
                      title="Forcer un saut de page avant cette catégorie à l'impression"
                    >
                      <ArrowDownToLine className="h-3.5 w-3.5" /> Saut Page
                      Avant
                    </Label>
                  </div>
                  {/* --- End Page Break Toggle Checkbox --- */}
                  {/* --- Category Print Toggle Checkbox (Screen Only) --- */}
                  <div className="flex items-center space-x-2 ml-auto print:hidden pl-4">
                    <Checkbox
                      id={`print-${categoryGroup.category.id}`}
                      checked={categoriesToPrint.includes(
                        categoryGroup.category.id
                      )}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        handleCategoryPrintToggle(
                          categoryGroup.category.id,
                          isChecked
                        );
                      }}
                      aria-label="Inclure dans l'impression"
                    />
                    <Label
                      htmlFor={`print-${categoryGroup.category.id}`}
                      className="text-xs font-medium text-muted-foreground cursor-pointer flex items-center gap-1"
                      title="Inclure cette catégorie dans l'impression"
                    >
                      Imprimer
                    </Label>
                  </div>
                  {/* --- End Category Print Toggle Checkbox --- */}
                </div>

                {/* == START: SINGLE TABLE PER CATEGORY == */}
                <Table className="print:text-xs">
                  {/* == Table Header (Rendered ONCE per category) == */}
                  <TableHeader className="bg-muted/10 print:bg-gray-100">
                    <TableRow>
                      <TableHead
                        style={{ width: `${paramWidth}%` }}
                        className="pl-4 print:pl-1"
                      >
                        Paramètre
                      </TableHead>
                      <TableHead
                        style={{ width: `${valueWidth}%` }}
                        className="pl-2 print:pl-1"
                      >
                        Valeur
                      </TableHead>
                      <TableHead
                        style={{ width: `${unitWidth}%` }}
                        className="pl-2 print:pl-1"
                      >
                        Unité
                      </TableHead>
                      <TableHead
                        style={{ width: `${refWidth}%` }}
                        className="pr-4 print:pr-1"
                      >
                        Réf.
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  {/* == Table Body (Contains Test Type Subheaders and Parameter Rows) == */}
                  <TableBody>
                    {/* Check if there are any test types */}
                    {categoryGroup.testTypes.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-10 text-center text-xs italic text-muted-foreground"
                        >
                          (Aucun type de test dans cette catégorie)
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Loop through Test Types WITHIN the Table Body */}
                    {categoryGroup.testTypes.map((testTypeGroup) => (
                      <React.Fragment key={testTypeGroup.testType.id}>
                        {/* --- Test Type Subheader Row --- */}
                        {testTypeGroup.parameters.length > 1 && (
                          <TableRow className="bg-muted/50 print:bg-gray-50 hover:bg-muted/60 print:break-inside-avoid">
                            <TableCell
                              colSpan={4}
                              className="py-1.5 px-4 print:px-1 font-semibold text-sm print:text-xs text-foreground"
                            >
                              {testTypeGroup.testType.name}
                            </TableCell>
                          </TableRow>
                        )}

                        {/* --- Parameter Rows --- */}
                        {testTypeGroup.parameters.length > 0 ? (
                          <>
                            {testTypeGroup.parameters.map((param) => {
                              // 1. Automatic check status
                              const autoStatus: RangeCheckStatus =
                                checkValueRangeStatus(
                                  param.resultValue,
                                  param.reference_range,
                                  categoryGroup.category.name,
                                  testTypeGroup.testType.name,
                                  skipRangeCheckValues.map( ({value}) =>  value )
                                );
                              // 2. Check override state
                              const overrideState =
                                highlightOverrides[param.id];

                              // 3. Determine final highlight class
                              let highlightClass = "";
                              const isClickable = true; // Values are generally clickable now
                              let valueClasses = ""; // For optional text styling

                              if (overrideState === "on") {
                                highlightClass = "result-out-of-range"; // Force Red
                                valueClasses =
                                  "font-bold text-red-700 dark:text-red-400 print:text-red-700";
                              } else if (overrideState === "off") {
                                highlightClass = ""; // Force Normal
                              } else if (overrideState === "warn") {
                                highlightClass = "result-indeterminate-range"; // Force Orange
                                // valueClasses = 'text-amber-800 dark:text-amber-400 print:text-amber-800'; // Optional text style
                              } else {
                                // overrideState is undefined, use automatic check
                                if (autoStatus === "out-of-range") {
                                  highlightClass = "result-out-of-range"; // Auto Red
                                  valueClasses =
                                    "font-bold text-red-700 dark:text-red-400 print:text-red-700";
                                } else if (autoStatus === "indeterminate") {
                                  highlightClass = "result-indeterminate-range"; // Auto Orange
                                  // valueClasses = 'text-amber-800 dark:text-amber-400 print:text-amber-800';
                                } else {
                                  // autoStatus === 'in-range'
                                  highlightClass = ""; // Auto Normal
                                  // isClickable = false; // Optionally make in-range values non-clickable? Maybe keep clickable for consistency.
                                }
                              }

                              return (
                                <TableRow
                                  key={param.id}
                                  className={cn(
                                    "print:even:bg-white print:break-inside-avoid  "
                                    // shouldHighlight &&
                                    //   "bg-red-100 dark:bg-red-900/30 print:bg-white" // Lighter red for screen/print
                                    // highlightClass
                                  )}
                                >
                                  <TableCell
                                    style={{ width: `${paramWidth}%` }}
                                    className="font-medium pl-6 print:pl-2"
                                    dangerouslySetInnerHTML={{
                                      __html: param.name,
                                    }}
                                  ></TableCell>
                                  <TableCell
                                    style={{ width: `${valueWidth}%` }}
                                    className={cn(
                                      "pl-2 print:pl-1 cursor-pointer hover:bg-muted/50",
                                      isClickable &&
                                        "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5", // Apply click styles if needed
                                      valueClasses, // Apply text styles
                                      highlightClass
                                    )}
                                    onClick={
                                      isClickable
                                        ? () => handleHighlightToggle(param.id)
                                        : undefined
                                    }
                                    title={
                                      isClickable
                                        ? "Cliquer pour changer le surlignage"
                                        : undefined
                                    }
                                  >
                                    {param.resultValue}
                                  </TableCell>
                                  <TableCell
                                    style={{ width: `${unitWidth}%` }}
                                    className="pl-2 print:pl-1"
                                    dangerouslySetInnerHTML={{
                                      __html: param.unit || "-",
                                    }}
                                  >
                                    {/* {param.unit || "-"} */}
                                  </TableCell>
                                  <TableCell
                                    style={{ width: `${refWidth}%` }}
                                    className="text-muted-foreground pr-4 print:pr-1 !whitespace-pre-line"
                                  >
                                    {!param.reference_range && "-"}
                                    {param.reference_range === "NEGATIF" && "-"}
                                    {param.reference_range?.includes(
                                      "style"
                                    ) && (
                                      <div
                                        dangerouslySetInnerHTML={{
                                          __html: param.reference_range,
                                        }}
                                      ></div>
                                    )}
                                    {param.reference_range !== "NEGATIF" &&
                                      !param.reference_range?.includes(
                                        "style"
                                      ) &&
                                      param.reference_range &&
                                      param.reference_range
                                        .split(";")
                                        .map((line, index) => (
                                          <div key={index}>{line}</div>
                                        ))}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {/* Add test type description if it exists */}
                            {testTypeGroup.testType.description && (
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="py-2 px-6 print:px-2 text-sm print:text-xs text-muted-foreground"
                                >
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html:
                                        testTypeGroup.testType.description,
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        ) : (
                          <></> // Render nothing if no params (subheader is also skipped)
                        )}
                      </React.Fragment>
                    ))}

                    {/* Optional: Handle case where category has TTypes, but NONE have params */}
                    {categoryGroup.testTypes.length > 0 &&
                      categoryGroup.testTypes.every(
                        (tt) => tt.parameters.length === 0
                      ) && (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="h-10 text-center text-xs italic text-muted-foreground"
                          >
                            (Aucun paramètre défini pour les tests de cette
                            catégorie)
                          </TableCell>
                        </TableRow>
                      )}
                  </TableBody>
                </Table>
                {/* == END: SINGLE TABLE PER CATEGORY == */}
              </div> // End Category Group Div
            );
          })}
        </div>
        {/* --- End Grouped Results Section --- */}
        <Card className="mt-8 print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Description du résultat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[100px] p-2 border rounded-md resize-y"
                placeholder="Entrez une description pour ce résultat..."
              />
              {savingDescription && (
                <div className="absolute right-2 top-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        {/* Padding control (screen only, not print) */}
        <div className="flex items-center gap-2 mb-2 print:hidden">
          <label htmlFor="marginTopControl" className="text-xs">
            Décalage vertical (mt):
          </label>
          <input
            id="marginTopControl"
            type="number"
            min={0}
            max={20}
            value={marginTop}
            onChange={(e) => setMarginTop(Number(e.target.value))}
            className="border px-2 py-1 text-xs w-16 rounded"
          />
        </div>
       
        {/* Controlled margin top for signature block */}
        <div
          className="text-sm text-black print:block print:mt-4"
          style={{ marginTop: `${marginTop * 0.25}rem` }}
        >
          <div
            className="font-bold"
            // dangerouslySetInnerHTML={{ __html: description }}
          >

              {
                description.split("\n").map((line, index) => (
                  <div key={index}>{line}</div>
                ))
              }


          </div>
          <div className="mt-4">
           <Footer date={resultData.result_date}/>
          </div>


          <div className="mt-[200px] flex flex-wrap flex-row items-center space-x-2 print:hidden">
              <div className="">
                <Button onClick={() => navigate(`/protidogramme/${resultId}`)}>Protidogramme</Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button onClick={() => navigate(`/atb/${resultId}`)}>ATB</Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button onClick={() => navigate(`/ecb/${resultId}`)}>ECB</Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button onClick={() => navigate(`/vhb/${resultId}`)}>VHB</Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button onClick={() => navigate(`/vih/${resultId}`)}>VIH</Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button onClick={() => navigate(`/anapath/${resultId}`)}>Anapath</Button>
              </div>
        </div>
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
