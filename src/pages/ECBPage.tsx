/* eslint-disable @typescript-eslint/no-unused-vars */

// no typescript check

import { cn } from "@/lib/utils"; // Adjust path if needed
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient"; // Adjust path if needed

// Shadcn/ui Imports
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path if needed
import { Button } from "@/components/ui/button"; // Adjust path if needed
import { Label } from "@/components/ui/label"; // Added Label
import { Separator } from "@/components/ui/separator"; // Adjust path if needed
import { Skeleton } from "@/components/ui/skeleton"; // Adjust path if needed
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Icons & Date Handling
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle,
  Edit,
  FileText,
  Hourglass,
  Info,
  ListChecks,
  Loader2,
  Phone,
  Printer,
  Save,
  Stethoscope,
  User,
  X,
} from "lucide-react";

import { useRef } from "react"; // Impo

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// 1. Restore print header template imports
import Template1 from "@/components/print_header/Template1";
import Template2 from "@/components/print_header/Template2";
import Template3 from "@/components/print_header/Template3";
import Template4 from "@/components/print_header/Template4";
import Footer from "@/components/Footer";

// --- Types ---
type PatientResult = Tables<"patient_result">;
type Patient = Tables<"patient">;
type Doctor = Tables<"doctor">;

// --- End Types ---

// --- Helper Functions ---
const getStatusBadgeVariant = (
  status: string | null
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
const displayStatus = (status: string | null): string => {
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
const ECBPage: React.FC = () => {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [resultData, setResultData] = useState<PatientResult | null>(null);
  const [patientData, setPatientData] = useState<Patient | null>(null);
  const [doctorData, setDoctorData] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStatusUpdate, setLoadingStatusUpdate] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(
    null
  );
  const [description, setDescription] = useState<string>("");
  const [editingPrices, setEditingPrices] = useState(false);
  const [normalPrice, setNormalPrice] = useState<string>("");
  const [insurancePrice, setInsurancePrice] = useState<string>("");
  const [savingPrices, setSavingPrices] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);

  // ECB Model creation logic
  const [ecbModels, setEcbModels] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState<boolean>(true);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [creatingEcb, setCreatingEcb] = useState<boolean>(false);
  const [createEcbError, setCreateEcbError] = useState<string | null>(null);

  // Fetch ECB Models
  useEffect(() => {
    const fetchModels = async () => {
      setLoadingModels(true);
      const { data, error } = await supabase
        .from("ecb_model")
        .select("id, name, description, structure");
      if (!error) setEcbModels(data || []);
      setLoadingModels(false);
    };
    fetchModels();
  }, []);

  // 2. Add availableHeaderTemplates and defaultTemplateId
  const availableHeaderTemplates = [
    { id: "template1", component: Template1 },
    { id: "template2", component: Template2 },
    { id: "template3", component: Template3 },
    { id: "template4", component: Template4 },
  ];
  const defaultTemplateId = "template1";

  // 3. Add header config state
  const [headerConfig, setHeaderConfig] = useState<any>(null);
  const [loadingHeader, setLoadingHeader] = useState<boolean>(true);

  // Define fetchResultDetails at the top-level of the component
  const fetchResultDetails = async () => {
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
    setLoadingHeader(true);
    setHeaderConfig(null);

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
        supabase.from("print_header_config").select("*").limit(1).maybeSingle(),
      ]);

      if (patientRes.error)
        console.warn("Erreur chargement patient:", patientRes.error.message);

      if (doctorRes.error)
        console.warn("Erreur chargement médecin:", doctorRes.error.message);

      setPatientData(patientRes.data);
      setDoctorData(doctorRes.data);
      setHeaderConfig(headerRes.data);
      setLoadingHeader(false);
    } catch (err: any) {
      console.error("Erreur chargement détails du résultat:", err);
      setError(
        err.message || "Une erreur est survenue lors du chargement du résultat."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResultDetails();
  }, [resultId]);

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
      try {
        const { error } = await supabase
          .from("patient_result")
          .update({ description: newDescription })
          .eq("id", resultId);

        if (error) throw error;
      } catch (err: any) {
        console.error("Error saving description:", err);
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
  const handleStatusChange = async (newStatus: string) => {
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

  // 5. Select header component
  const SelectedHeaderComponent = useMemo(() => {
    const templateId = headerConfig?.selected_template || defaultTemplateId;
    return (
      availableHeaderTemplates.find((t) => t.id === templateId)?.component ||
      Template1
    );
  }, [headerConfig]);

  // 6. Prepare props for header
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

  // ECBs state
  const [ecbs, setEcbs] = useState<any[]>([]);
  const [ecbSections, setEcbSections] = useState<{ [ecbId: string]: any[] }>(
    {}
  );
  const [ecbValues, setEcbValues] = useState<{ [sectionId: string]: any[] }>(
    {}
  );
  const [loadingEcbs, setLoadingEcbs] = useState<boolean>(true);
  const [editingEcbId, setEditingEcbId] = useState<string | null>(null);
  const [batchValueEdits, setBatchValueEdits] = useState<{
    [valueId: string]: string;
  }>({});
  const [savingBatchEcbId, setSavingBatchEcbId] = useState<string | null>(null);
  const [printEcbId, setPrintEcbId] = useState<string | null>(null);

  // --- ECB Title Inline Edit State ---
  const [editingTitleEcbId, setEditingTitleEcbId] = useState<string | null>(
    null
  );
  const [titleEditValue, setTitleEditValue] = useState<string>("");
  const [savingTitleEcbId, setSavingTitleEcbId] = useState<string | null>(null);

  const startEditingTitle = (ecbId: string, currentTitle: string) => {
    setEditingTitleEcbId(ecbId);
    setTitleEditValue(currentTitle);
  };
  const cancelEditingTitle = () => {
    setEditingTitleEcbId(null);
    setTitleEditValue("");
  };
  const saveTitleEdit = async (ecbId: string) => {
    setSavingTitleEcbId(ecbId);
    await supabase
      .from("ecb")
      .update({ title: titleEditValue })
      .eq("id", ecbId);
    setSavingTitleEcbId(null);
    setEditingTitleEcbId(null);
    setTitleEditValue("");
    await fetchEcbs();
  };

  // Fetch all ECBs for the result
  const fetchEcbs = useCallback(async () => {
    if (!resultId) return;
    setLoadingEcbs(true);
    // 1. Fetch ECBs
    const { data: ecbList, error: ecbError } = await supabase
      .from("ecb")
      .select("*")
      .eq("result_id", resultId)
      .order("created_at", { ascending: true });
    if (ecbError) {
      setLoadingEcbs(false);
      return;
    }
    setEcbs(ecbList || []);
    // 2. Fetch all sections for these ECBs
    const ecbIds = (ecbList || []).map((e: any) => e.id);
    const { data: sectionList } = await supabase
      .from("ecb_section")
      .select("*")
      .in(
        "ecb_id",
        ecbIds.length ? ecbIds : ["00000000-0000-0000-0000-000000000000"]
      )
      .order("position", { ascending: true });
    const sectionMap: { [ecbId: string]: any[] } = {};
    (sectionList || []).forEach((section) => {
      if (!sectionMap[section.ecb_id]) sectionMap[section.ecb_id] = [];
      sectionMap[section.ecb_id].push(section);
    });
    setEcbSections(sectionMap);
    // 3. Fetch all values for these sections
    const sectionIds = (sectionList || []).map((s: any) => s.id);
    const { data: valueList } = await supabase
      .from("ecb_value")
      .select("*")
      .in(
        "section_id",
        sectionIds.length
          ? sectionIds
          : ["00000000-0000-0000-0000-000000000000"]
      )
      .order("position", { ascending: true });
    const valueMap: { [sectionId: string]: any[] } = {};
    (valueList || []).forEach((v) => {
      if (!valueMap[v.section_id]) valueMap[v.section_id] = [];
      valueMap[v.section_id].push(v);
    });
    setEcbValues(valueMap);
    setLoadingEcbs(false);
  }, [resultId]);

  // Fetch ECBs on mount and after creation
  useEffect(() => {
    fetchEcbs();
  }, [fetchEcbs, creatingEcb]);

  // Start editing an ECB (enables all its values for edit)
  const startEditingEcb = (ecbId: string) => {
    setEditingEcbId(ecbId);
    // Pre-fill batchValueEdits with current values
    let edits: { [valueId: string]: string } = {};
    (ecbSections[ecbId] || []).forEach((section) => {
      (ecbValues[section.id] || []).forEach((value) => {
        edits[value.id] = value.value ?? "";
      });
    });
    setBatchValueEdits(edits);
  };
  // Cancel editing
  const cancelEditingEcb = () => {
    setEditingEcbId(null);
    setBatchValueEdits({});
  };
  // Update value in batch edits
  const handleBatchEdit = (valueId: string, newValue: string) => {
    setBatchValueEdits((prev) => ({ ...prev, [valueId]: newValue }));
  };
  // Save all edits for one ECB
  const saveAllBatchEdits = async (ecbId: string) => {
    setSavingBatchEcbId(ecbId);
    const updates = Object.entries(batchValueEdits).map(([id, value]) =>
      supabase.from("ecb_value").update({ value }).eq("id", id)
    );
    await Promise.all(updates);
    setSavingBatchEcbId(null);
    setEditingEcbId(null);
    setBatchValueEdits({});
    await fetchEcbs();
  };

  // Print handler (sets printEcbId)
  const handlePrintEcb = (ecbId: string) => {
    setPrintEcbId(ecbId);
    setTimeout(() => window.print(), 100); // triggers print
  };

  // --- Local state for label/value bold toggles, persisted in localStorage ---
  function getInitialBoldToggles() {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("ecb_bold_toggles");
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    }
    return {};
  }
  const [boldToggles, setBoldToggles] = useState<{
    [valueId: string]: { labelBold: boolean; valueBold: boolean };
  }>(getInitialBoldToggles);

  useEffect(() => {
    window.localStorage.setItem(
      "ecb_bold_toggles",
      JSON.stringify(boldToggles)
    );
  }, [boldToggles]);

  const toggleLabelBold = (valueId: string) => {
    setBoldToggles((prev) => ({
      ...prev,
      [valueId]: { ...prev[valueId], labelBold: !prev[valueId]?.labelBold },
    }));
  };
  const toggleValueBold = (valueId: string) => {
    setBoldToggles((prev) => ({
      ...prev,
      [valueId]: { ...prev[valueId], valueBold: !prev[valueId]?.valueBold },
    }));
  };

  // --- Local state for section bold toggles, persisted in localStorage ---
  function getInitialSectionBoldToggles(sectionIds: string[]) {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("ecb_section_bold_toggles");
        const parsed = stored ? JSON.parse(stored) : {};
        // Default unseen sections to true (bold)
        for (const id of sectionIds) {
          if (!(id in parsed)) parsed[id] = true;
        }
        return parsed;
      } catch {
        // All bold by default
        return Object.fromEntries(sectionIds.map((id) => [id, true]));
      }
    }
    return Object.fromEntries(sectionIds.map((id) => [id, true]));
  }

  // Get all section IDs for all ECBs
  const allSectionIds = Object.values(ecbSections || {})
    .flat()
    .map((section: any) => section.id);
  const [sectionBoldToggles, setSectionBoldToggles] = useState<{
    [sectionId: string]: boolean;
  }>(() => getInitialSectionBoldToggles(allSectionIds));

  useEffect(() => {
    window.localStorage.setItem(
      "ecb_section_bold_toggles",
      JSON.stringify(sectionBoldToggles)
    );
  }, [sectionBoldToggles]);

  // Ensure new sections get default bold=true after mount
  useEffect(() => {
    setSectionBoldToggles((prev) => {
      let changed = false;
      const updated = { ...prev };
      for (const id of allSectionIds) {
        if (!(id in updated)) {
          updated[id] = true;
          changed = true;
        }
      }
      return changed ? updated : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSectionIds.length]);

  const toggleSectionBold = (sectionId: string) => {
    setSectionBoldToggles((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // --- Local state for abnormal cells, persisted in localStorage ---
  function getInitialAbnormalCells() {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("ecb_abnormal_cells");
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    }
    return {};
  }
  const [abnormalCells, setAbnormalCells] = useState<{
    [valueId: string]: boolean;
  }>(getInitialAbnormalCells);

  useEffect(() => {
    window.localStorage.setItem(
      "ecb_abnormal_cells",
      JSON.stringify(abnormalCells)
    );
  }, [abnormalCells]);

  const toggleAbnormalCell = (valueId: string) => {
    setAbnormalCells((prev) => ({
      ...prev,
      [valueId]: !prev[valueId],
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="overflow-hidden rounded-lg border border-muted bg-background p-4">
            <div className="pb-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-muted bg-background p-4">
            <div className="pb-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-muted bg-background p-4">
            <div className="pb-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32 mt-1" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-muted bg-background p-4">
          <div className="pb-2">
            <Skeleton className="h-6 w-1/3" />
          </div>
          <div>
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-muted bg-background p-4">
          <div className="pb-2">
            <Skeleton className="h-6 w-1/3" />
          </div>
          <div>
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
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
      </div>
      {/* --- Report Content Wrapper (for Print/PDF) --- */}
      <div className="report-content bg-white  p-4 sm:p-6 border border-transparent print:border-none print:p-0 print:shadow-none">
        {/* 7. Render header above report content */}
        {headerConfig ? (
          <div className="mb-2 print:mb-0">
            <SelectedHeaderComponent
              data={headerDataProps}
              isPreview={false}
              reportTitle="RAPPORT DE RÉSULTATS"
            />
          </div>
        ) : (
          <Alert variant="default" className="mb-2 print:mb-0 print:hidden">
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
        <Separator className="my-2 print:my-0 print:border-none" />
        {/* 2. Info Grid (Patient, Doctor, Result Meta) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 print:mb-4 print:grid-cols-2 print:hidden">
          {/* Patient Card */}
          <div className="overflow-hidden rounded-lg border border-muted bg-background p-4">
            <div className="pb-2">
              <div className="text-sm font-semibold flex items-center gap-2 print:text-xs">
                <User className="h-4 w-4" />
                Patient
              </div>
            </div>
            <div className="space-y-1 pt-1 print:space-y-0.5 print:pt-0.5">
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
            </div>
          </div>

          {/* Doctor Card */}
          <div className="overflow-hidden rounded-lg border border-muted bg-background p-4">
            <div className="pb-2">
              <div className="text-sm font-semibold flex items-center gap-2 print:text-xs">
                <Stethoscope className="h-4 w-4" />
                Médecin
              </div>
            </div>
            <div className="space-y-1 pt-1 print:space-y-0.5 print:pt-0.5">
              {renderInfoItem(User, "NOM PRENOM", doctorData?.full_name)}
              {renderInfoItem(Phone, "Téléphone", doctorData?.phone)}
              {renderInfoItem(Info, "Provenance", doctorData?.hospital)}
            </div>
          </div>
          {/* Result Info Card */}
          <div className="overflow-hidden rounded-lg border border-muted bg-background p-4 print:hidden">
            <div className="pb-2">
              <div className="text-sm font-semibold flex items-center gap-2 print:text-xs">
                <ListChecks className="h-4 w-4" />
                Résultat Info
              </div>
            </div>
            <div className="space-y-1 pt-1 print:space-y-0.5 print:pt-0.5">
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
                      onValueChange={(value: string) =>
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
                            <Hourglass className="h-4 w-4 text-muted-foreground" />{" "}
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
            </div>
          </div>
        </div>
        {/* print info grid for print only*/}
        <div className="grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6  print:grid-cols-2 hidden print:grid ">
          {/* Patient Info */}
          <div className="flex flex-col gap-1 rounded-lg border border-slate-600 print:shadow-lg bg-white/90 p-3 print:border  print:bg-white print:rounded-md print:p-2 text-xs">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <User className="h-4 w-4" />
              Patient
            </div>
            {renderInfoItem(Info, "NOM PRENOM", patientData?.full_name)}
            {renderInfoItem(Info, "ID Unique", patientData?.patient_unique_id)}
            {renderInfoItem(Phone, "Téléphone", patientData?.phone)}
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

        {/* main page content */}
        <div className="page-content">
          {/* ECB Creation Section */}
          <div className="overflow-hidden rounded-lg border border-muted bg-background p-4 mb-4 print:hidden">
            <div>
              <div className="font-semibold">Créer un nouvel ECB</div>
            </div>
            <div>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="ecb-model-select">
                    Sélectionner un modèle
                  </Label>
                  <Select
                    value={selectedModelId}
                    onValueChange={setSelectedModelId}
                    disabled={loadingModels || creatingEcb}
                  >
                    <SelectTrigger id="ecb-model-select" className="w-full">
                      <SelectValue
                        placeholder={
                          loadingModels ? "Chargement..." : "Choisir un modèle"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {ecbModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedModelId && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {
                        ecbModels.find((m) => m.id === selectedModelId)
                          ?.description
                      }
                    </div>
                  )}
                </div>
                <Button
                  onClick={async () => {
                    setCreatingEcb(true);
                    setCreateEcbError(null);
                    try {
                      if (!selectedModelId || !resultId)
                        throw new Error("Sélectionner un modèle.");
                      // Get model details
                      const model = ecbModels.find(
                        (m) => m.id === selectedModelId
                      );
                      if (!model) throw new Error("Modèle non trouvé.");
                      // Insert ECB
                      const { data: newEcb, error: ecbError } = await supabase
                        .from("ecb")
                        .insert({
                          result_id: resultId,
                          model_id: model.id,
                          title: model.name,
                          created_by:
                            (await supabase.auth.getUser()).data.user?.id ||
                            null,
                        })
                        .select()
                        .single();
                      if (ecbError) throw ecbError;
                      // Insert sections and values
                      const structure = model.structure;
                      let sectionInserts = [];
                      let valueInserts = [];
                      let sectionPosition = 0;
                      for (const section of structure) {
                        const sectionId = crypto.randomUUID();
                        sectionInserts.push({
                          id: sectionId,
                          ecb_id: newEcb.id,
                          section_title: section.title,
                          position: sectionPosition,
                        });
                        let valuePosition = 0;
                        for (const label of section.labels) {
                          valueInserts.push({
                            section_id: sectionId,
                            label: label,
                            value: null,
                            position: valuePosition,
                          });
                          valuePosition++;
                        }
                        sectionPosition++;
                      }
                      // Insert sections
                      if (sectionInserts.length) {
                        const { error: sectionError } = await supabase
                          .from("ecb_section")
                          .insert(sectionInserts);
                        if (sectionError) throw sectionError;
                      }
                      // Insert values
                      if (valueInserts.length) {
                        const { error: valueError } = await supabase
                          .from("ecb_value")
                          .insert(valueInserts);
                        if (valueError) throw valueError;
                      }
                      // Optionally, refresh ECB data or navigate to the new ECB
                      await fetchEcbs();
                      setSelectedModelId("");
                    } catch (err: any) {
                      setCreateEcbError(
                        err.message || "Erreur lors de la création de l''ECB."
                      );
                    } finally {
                      setCreatingEcb(false);
                    }
                  }}
                  disabled={!selectedModelId || creatingEcb}
                  className="min-w-[120px]"
                >
                  {creatingEcb ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Créer
                </Button>
              </div>
              {createEcbError && (
                <div className="text-xs text-destructive mt-2">
                  {createEcbError}
                </div>
              )}
            </div>
          </div>
          {/* ECB List */}
          {loadingEcbs ? (
            <Skeleton className="h-12 w-full" />
          ) : ecbs.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              Aucun ECB trouvé pour ce résultat.
            </div>
          ) : (
            <div className="space-y-6 print:space-y-0">
              {ecbs.map((ecb) => (
                <div key={ecb.id} className="relative  p-4">
                  <div className="print:hidden flex flex-row items-center justify-between border-b pb-2 mb-2 print:mb-0">
                    <div className="print:hidden">
                      <div className="font-semibold text-base flex items-center gap-2">
                        {editingTitleEcbId === ecb.id ? (
                          <>
                            <Input
                              value={titleEditValue}
                              onChange={(e) =>
                                setTitleEditValue(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveTitleEdit(ecb.id);
                                if (e.key === "Escape") cancelEditingTitle();
                              }}
                              disabled={savingTitleEcbId === ecb.id}
                              className="text-base w-48"
                              autoFocus
                            />
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => saveTitleEdit(ecb.id)}
                              disabled={savingTitleEcbId === ecb.id}
                            >
                              {savingTitleEcbId === ecb.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Enregistrer"
                              )}
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={cancelEditingTitle}
                              disabled={savingTitleEcbId === ecb.id}
                            >
                              Annuler
                            </Button>
                          </>
                        ) : (
                          <>
                            <span>{ecb.title}</span>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() =>
                                startEditingTitle(ecb.id, ecb.title)
                              }
                              className="ml-1"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Créé le{" "}
                        {format(parseISO(ecb.created_at), "Pp", { locale: fr })}
                      </div>
                    </div>
                    <div className="flex gap-2 print:hidden">
                      {editingEcbId === ecb.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => saveAllBatchEdits(ecb.id)}
                            disabled={savingBatchEcbId === ecb.id}
                          >
                            {savingBatchEcbId === ecb.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Enregistrer toutes les modifications
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditingEcb}
                            disabled={savingBatchEcbId === ecb.id}
                          >
                            Annuler
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditingEcb(ecb.id)}
                          >
                            <Edit className="h-4 w-4 mr-1" /> Modifier
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrintEcb(ecb.id)}
                          >
                            <Printer className="h-4 w-4 mr-1" /> Imprimer
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="print:hidden">
                    {/* Sections */}
                    {(ecbSections[ecb.id] || []).map((section) => (
                      <div key={section.id} className="mb-4 print:mb-0">
                        <div className="font-semibold mb-2 text-lg flex items-center gap-1">
                          {section.section_title}
                          <Button
                            size="icon"
                            variant={
                              sectionBoldToggles[section.id]
                                ? "default"
                                : "ghost"
                            }
                            className="h-5 w-5 p-0"
                            title={
                              sectionBoldToggles[section.id]
                                ? "Définir en normal"
                                : "Mettre en gras"
                            }
                            onClick={() => toggleSectionBold(section.id)}
                            type="button"
                            tabIndex={-1}
                          >
                            <b>B</b>
                          </Button>
                        </div>
                        <div className="grid grid-cols-1  gap-2">
                          {(ecbValues[section.id] || []).map((value) => (
                            <div
                              key={value.id}
                              className="flex items-center gap-2"
                            >
                              <Label className="w-40 text-md font-medium flex items-center gap-1">
                                {value.label}
                                <Button
                                  size="icon"
                                  variant={
                                    boldToggles[value.id]?.labelBold
                                      ? "default"
                                      : "ghost"
                                  }
                                  className="h-5 w-5 p-0"
                                  title={
                                    boldToggles[value.id]?.labelBold
                                      ? "Définir en normal"
                                      : "Mettre en gras"
                                  }
                                  onClick={() => toggleLabelBold(value.id)}
                                  type="button"
                                  tabIndex={-1}
                                >
                                  <b>B</b>
                                </Button>
                              </Label>
                              {editingEcbId === ecb.id ? (
                                <div className="flex-1 flex items-center gap-1">
                                  <Input
                                    value={batchValueEdits[value.id] ?? ""}
                                    onChange={(e) =>
                                      handleBatchEdit(value.id, e.target.value)
                                    }
                                    disabled={savingBatchEcbId === ecb.id}
                                    className="text-xs flex-1"
                                  />
                                  <Button
                                    size="icon"
                                    variant={
                                      boldToggles[value.id]?.valueBold
                                        ? "default"
                                        : "ghost"
                                    }
                                    className="h-5 w-5 p-0"
                                    title={
                                      boldToggles[value.id]?.valueBold
                                        ? "Définir en normal"
                                        : "Mettre en gras"
                                    }
                                    onClick={() => toggleValueBold(value.id)}
                                    type="button"
                                    tabIndex={-1}
                                  >
                                    <b>B</b>
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant={
                                      abnormalCells[value.id]
                                        ? "destructive"
                                        : "ghost"
                                    }
                                    className="h-5 w-5 p-0"
                                    title={
                                      abnormalCells[value.id]
                                        ? "Cellule anormale"
                                        : "Marquer comme anormale"
                                    }
                                    onClick={() => toggleAbnormalCell(value.id)}
                                    type="button"
                                    tabIndex={-1}
                                  >
                                    <span style={{ fontWeight: "bold" }}>
                                      !
                                    </span>
                                  </Button>
                                </div>
                              ) : (
                                <span
                                  className={`text-xs flex-1 ${
                                    boldToggles[value.id]?.valueBold
                                      ? "font-bold"
                                      : ""
                                  } ${
                                    abnormalCells[value.id]
                                      ? "bg-gray-200 font-bold"
                                      : ""
                                  }`}
                                >
                                  {value.value ?? (
                                    <span className="italic text-muted-foreground">
                                      (vide)
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Print-only ECB rendering (hidden on screen, visible on print if printEcbId matches) */}
                  {printEcbId === ecb.id && (
                    <div className="hidden print:block bg-white p-4 print:p-0">
                      {/* Add ecb title here */}
                      <div className="font-semibold text-lg text-center mb-1">
                        {ecb.title}
                      </div>
                      <table className="w-full border-collapse print-ecb-table">
                        <tbody>
                          {(ecbSections[ecb.id] || []).map((section) => (
                            <React.Fragment key={section.id}>
                              <tr>
                                <td
                                  colSpan={2}
                                  className={`text-xs mb-1 py-2 print-ecb-section-title ${
                                    sectionBoldToggles[section.id]
                                      ? "font-bold"
                                      : "font-normal"
                                  }`}
                                >
                                  {section.section_title}
                                </td>
                              </tr>
                              {(ecbValues[section.id] || []).map((value) => (
                                <tr key={value.id}>
                                  <td
                                    className={`align-top pr-4 pb-1 text-xs print-ecb-label ${
                                      boldToggles[value.id]?.labelBold
                                        ? "font-bold"
                                        : "font-normal"
                                    }`}
                                    style={{ width: "35%" }}
                                  >
                                    {value.label}
                                  </td>
                                  <td
                                    className={`align-top pb-1 text-xs print-ecb-value ${
                                      boldToggles[value.id]?.valueBold
                                        ? "font-bold"
                                        : "font-normal"
                                    } ${
                                      abnormalCells[value.id]
                                        ? "print-ecb-abnormal-cell"
                                        : ""
                                    }`}
                                  >
                                    {value.value ? (
                                      <div className="flex items-center justify-between">
                                        {value.value
                                          .split(";")
                                          .map((line, index) => (
                                            <div key={index}>{line}</div>
                                          ))}
                                      </div>
                                    ) : (
                                      <span className="italic text-muted-foreground">
                                        (vide)
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>

                      <div className="mt-4">
                        <Footer date={new Date().toISOString()} />
                      </div>

                      <style jsx global>{`
                        @media print {
                          .print-ecb-table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 13.5px;
                          }
                          .print-ecb-label {
                            text-align: left;
                            padding-right: 16px;
                            vertical-align: top;
                            width: 35%;
                            font-size: 13.5px;
                          }
                          .print-ecb-section-title {
                            background: #f6f6f6;
                            font-size: 14px;
                            font-weight: bold;
                            padding-top: 12px;
                            padding-bottom: 6px;
                            text-align: left;
                            border-bottom: 1px solid #e5e5e5;
                          }
                          .print-ecb-value {
                            text-align: left;
                            vertical-align: top;
                            word-break: break-word;
                            font-size: 13.5px;
                          }
                          .print-ecb-abnormal-cell {
                            background: #e5e5e5 !important;
                            font-weight: bold !important;
                          }
                          .print-ecb-table td {
                            padding-top: 3px;
                            padding-bottom: 3px;
                          }
                        }
                      `}</style>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>{" "}
      {/* End Report Content Wrapper */}
    </div> // End main container div
  );
};

export default ECBPage;

<style jsx global>{`
  @media print {
    .print-ecb-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    .print-ecb-label {
      font-weight: bold;
      text-align: left;
      padding-right: 16px;
      vertical-align: top;
      width: 35%;
      font-size: 13.5px;
    }
    .print-ecb-section-title {
      background: #f6f6f6;
      font-size: 14px;
      font-weight: bold;
      padding-top: 12px;
      padding-bottom: 6px;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
    }
    .print-ecb-value {
      text-align: left;
      vertical-align: top;
      word-break: break-word;
      font-size: 13.5px;
    }
    .print-ecb-abnormal-cell {
      background: #e5e5e5 !important;
      font-weight: bold !important;
    }
    .print-ecb-table td {
      padding-top: 3px;
      padding-bottom: 3px;
    }
  }
`}</style>;
