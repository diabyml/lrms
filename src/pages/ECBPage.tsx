import { cn, extractId } from "@/lib/utils"; // Adjust path if needed
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient"; // Adjust path if needed

// Shadcn/ui Imports
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path if needed
import { Button } from "@/components/ui/button"; // Adjust path if needed
import { Label } from "@/components/ui/label"; // Added Label
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator"; // Adjust path if needed
import { Skeleton } from "@/components/ui/skeleton"; // Adjust path if needed
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
  Stethoscope,
  Trash2,
  User,
  X,
  Check,
  Plus,
  GripVertical,
} from "lucide-react";

// import { useRef } from "react"; // Not currently used, can be removed if not needed

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// 1. Restore print header template imports
import Footer from "@/components/Footer";
import Template1 from "@/components/print_header/Template1";
import Template2 from "@/components/print_header/Template2";
import Template3 from "@/components/print_header/Template3";
import Template4 from "@/components/print_header/Template4";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

// --- Types ---
type PatientResult = Tables<"patient_result">;
type Patient = Tables<"patient">;
type Doctor = Tables<"doctor">;

// --- START: Added Types for ECB Model Structure ---
interface EcbModelLabel {
  name: string;
  defaultValue: string | null;
}

interface EcbModelSection {
  title: string;
  labels: EcbModelLabel[]; // Now an array of objects
}

interface EcbModelType {
  id: string;
  name: string;
  description?: string;
  structure: EcbModelSection[]; // Uses the new section type
}
// --- END: Added Types for ECB Model Structure ---

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

// Add these functions after the existing helper functions and before the ECBPage component
const getStoredEcbDescription = (ecbId: string): string => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(`ecb_description_${ecbId}`) || "";
  } catch {
    return "";
  }
};

const saveEcbDescription = (ecbId: string, description: string) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`ecb_description_${ecbId}`, description);
  } catch (err) {
    console.error("Error saving ECB description to localStorage:", err);
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
  const [editingPrices, setEditingPrices] = useState(false);
  const [normalPrice, setNormalPrice] = useState<string>("");
  const [insurancePrice, setInsurancePrice] = useState<string>("");
  const [savingPrices, setSavingPrices] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);

  const [withAtb, setWithAtb] = useState(false);

  // ECB Model creation logic
  const [ecbModels, setEcbModels] = useState<EcbModelType[]>([]); // <<< Updated type
  const [loadingModels, setLoadingModels] = useState<boolean>(true);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [creatingEcb, setCreatingEcb] = useState<boolean>(false);
  const [createEcbError, setCreateEcbError] = useState<string | null>(null);
  const [ecbModelSearchQuery, setEcbModelSearchQuery] = useState("");

  // Inside ECBPage component, with other state variables:
  // =============================================================
  // Delete ECB
  // =================================================================
  const [ecbToDelete, setEcbToDelete] = useState<EcbRecord | null>(null);
  const [showDeleteEcbDialog, setShowDeleteEcbDialog] =
    useState<boolean>(false);
  const [isDeletingEcb, setIsDeletingEcb] = useState<boolean>(false);

  const openDeleteEcbInstanceDialog = (ecb: EcbRecord) => {
    setEcbToDelete(ecb);
    setShowDeleteEcbDialog(true);
  };

  const handleDeleteEcbInstanceConfirm = async () => {
    if (!ecbToDelete) return;

    setIsDeletingEcb(true);
    try {
      // Important: Deleting an 'ecb' record should ideally cascade delete
      // its 'ecb_section' and 'ecb_value' records if your foreign keys
      // are set up with ON DELETE CASCADE.
      // If not, you must delete them manually here, starting from ecb_value, then ecb_section.

      // Assuming ON DELETE CASCADE is NOT set up for ecb_section from ecb,
      // or for ecb_value from ecb_section (which is safer for direct queries):

      // 1. Get all section IDs for the ECB to delete
      const { data: sections, error: sectionFetchError } = await supabase
        .from("ecb_section")
        .select("id")
        .eq("ecb_id", ecbToDelete.id);

      if (sectionFetchError) throw sectionFetchError;

      const sectionIds = sections?.map((s) => s.id) || [];

      // 2. Delete all ecb_values for those sections (if any sections exist)
      if (sectionIds.length > 0) {
        const { error: valueDeleteError } = await supabase
          .from("ecb_value")
          .delete()
          .in("section_id", sectionIds);
        if (valueDeleteError) throw valueDeleteError;
      }

      // 3. Delete all ecb_sections for that ECB
      const { error: sectionDeleteError } = await supabase
        .from("ecb_section")
        .delete()
        .eq("ecb_id", ecbToDelete.id);
      if (sectionDeleteError) throw sectionDeleteError;

      // 4. Finally, delete the ECB record itself
      const { error: ecbDeleteError } = await supabase
        .from("ecb")
        .delete()
        .eq("id", ecbToDelete.id);
      if (ecbDeleteError) throw ecbDeleteError;

      toast.success(
        `ECB "${ecbToDelete.title || "Sans titre"}" supprimé avec succès.`
      );
      await fetchEcbs(); // Refresh the list of ECBs

      // If the deleted ECB was being edited, clear the editing state
      if (editingEcbId === ecbToDelete.id) {
        cancelEditingEcbValues(); // Or your function to cancel value editing
      }
      if (editingTitleEcbId === ecbToDelete.id) {
        cancelEditingTitle();
      }
    } catch (err: any) {
      console.error("Error deleting ECB instance:", err);
      toast.error("Erreur de suppression", {
        description: err.message || "Impossible de supprimer l'ECB.",
      });
    } finally {
      setIsDeletingEcb(false);
      setShowDeleteEcbDialog(false);
      setEcbToDelete(null);
    }
  };

  // end delete ecb
  // =======================================================================

  // Fetch ECB Models
  useEffect(() => {
    const fetchModels = async () => {
      setLoadingModels(true);
      const { data, error } = await supabase
        .from("ecb_model")
        .select("id, name, description, structure");
      if (!error && data) {
        // Ensure structure is parsed and defaults are handled if needed.
        // This assumes data from Supabase for `structure` is already in the correct new format.
        const typedData = data.map((model) => ({
          ...model,
          structure: Array.isArray(model.structure)
            ? model.structure.map((section: any) => ({
                title: section.title || "Titre de section manquant",
                labels: Array.isArray(section.labels)
                  ? section.labels.map((label: any) => {
                      if (typeof label === "string") {
                        // Handle old format (string labels) by migrating
                        return { name: label, defaultValue: null };
                      }
                      return {
                        // Assume new format { name: string, defaultValue: string | null }
                        name: label.name || "Label manquant",
                        defaultValue:
                          label.defaultValue !== undefined
                            ? label.defaultValue
                            : null,
                      };
                    })
                  : [],
              }))
            : [],
        }));
        setEcbModels(typedData as EcbModelType[]);
      } else {
        console.error("Error fetching ECB models or no data:", error);
        setEcbModels([]);
      }
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

  // Save prices
  const savePrices = useCallback(async () => {
    if (!resultData) return; // Ensure resultData is available
    setSavingPrices(true);
    setPricesError(null);
    try {
      const normal = normalPrice.trim() !== "" ? Number(normalPrice) : null;
      const insurance =
        insurancePrice.trim() !== "" ? Number(insurancePrice) : null;

      if (
        (normalPrice.trim() !== "" && isNaN(normal!)) || // Added non-null assertion as isNaN checks after this
        (insurancePrice.trim() !== "" && isNaN(insurance!))
      ) {
        setPricesError("Les prix doivent être des nombres valides.");
        setSavingPrices(false);
        return;
      }

      const { error } = await supabase // Removed `data` as it's not used
        .from("patient_result")
        .update({ normal_price: normal, insurance_price: insurance })
        .eq("id", resultData.id)
        .select() // Keep select to ensure RLS passes if needed
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
        // Fallback if data is not returned (e.g. RLS issue or network)
        setResultData((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
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
  }, [headerConfig, availableHeaderTemplates, defaultTemplateId]); // Added dependencies

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
  const [ecbs, setEcbs] = useState<Tables<"ecb">[]>([]); // Typed this
  const [ecbSections, setEcbSections] = useState<{
    [ecbId: string]: Tables<"ecb_section">[];
  }>({});
  const [ecbValues, setEcbValues] = useState<{
    [sectionId: string]: Tables<"ecb_value">[];
  }>({});
  const [loadingEcbs, setLoadingEcbs] = useState<boolean>(true);
  const [editingEcbId, setEditingEcbId] = useState<string | null>(null);
  const [batchValueEdits, setBatchValueEdits] = useState<{
    [valueId: string]: string;
  }>({});
  const [batchLabelEdits, setBatchLabelEdits] = useState<{
    [valueId: string]: string;
  }>({});
  const [batchSectionTitleEdits, setBatchSectionTitleEdits] = useState<{
    [sectionId: string]: string;
  }>({});
  const [ecbDescription, setEcbDescription] = useState<string>("");
  const [batchDescriptionEdits, setBatchDescriptionEdits] = useState<{
    [ecbId: string]: string;
  }>({});

  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelEditValue, setLabelEditValue] = useState<string>("");
  const [savingLabelId, setSavingLabelId] = useState<string | null>(null);
  const [savingBatchEcbId, setSavingBatchEcbId] = useState<string | null>(null);
  const [printEcbId, setPrintEcbId] = useState<string | null>(null);
  const [savingNewSection, setSavingNewSection] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionTitleEditValue, setSectionTitleEditValue] =
    useState<string>("");
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);

  // --- ECB Title Inline Edit State ---
  const [editingTitleEcbId, setEditingTitleEcbId] = useState<string | null>(
    null
  );
  const [titleEditValue, setTitleEditValue] = useState<string>("");
  const [savingTitleEcbId, setSavingTitleEcbId] = useState<string | null>(null);

  const startEditingTitle = (ecbId: string, currentTitle: string | null) => {
    // currentTitle can be null
    setEditingTitleEcbId(ecbId);
    setTitleEditValue(currentTitle || "");
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
    await fetchEcbs(); // Refetch to update UI
  };

  // Add these new functions for label editing
  const startEditingLabel = (valueId: string, currentLabel: string) => {
    setEditingLabelId(valueId);
    setLabelEditValue(currentLabel);
  };

  const cancelEditingLabel = () => {
    setEditingLabelId(null);
    setLabelEditValue("");
  };

  const saveLabelEdit = async (valueId: string) => {
    setSavingLabelId(valueId);
    try {
      const { error } = await supabase
        .from("ecb_value")
        .update({ label: labelEditValue })
        .eq("id", valueId);
      if (error) throw error;
      await fetchEcbs(); // Refresh to show updated label
    } catch (err) {
      console.error("Error saving label:", err);
      toast.error("Erreur lors de la modification du label");
    } finally {
      setSavingLabelId(null);
      setEditingLabelId(null);
      setLabelEditValue("");
    }
  };

  // Fetch all ECBs for the result
  const fetchEcbs = useCallback(async () => {
    if (!resultId) return;
    setLoadingEcbs(true);
    try {
      // 1. Fetch ECBs
      const { data: ecbList, error: ecbError } = await supabase
        .from("ecb")
        .select("*")
        .eq("result_id", resultId)
        .order("created_at", { ascending: true });
      if (ecbError) throw ecbError;
      setEcbs(ecbList || []);

      const ecbIds = (ecbList || []).map((e) => e.id);
      if (!ecbIds.length) {
        setEcbSections({});
        setEcbValues({});
        setLoadingEcbs(false);
        return;
      }

      // 2. Fetch all sections for these ECBs
      const { data: sectionList, error: sectionError } = await supabase
        .from("ecb_section")
        .select("*")
        .in("ecb_id", ecbIds)
        .order("position", { ascending: true });
      if (sectionError) throw sectionError;

      const sectionMap: { [ecbId: string]: Tables<"ecb_section">[] } = {};
      (sectionList || []).forEach((section) => {
        if (!sectionMap[section.ecb_id]) sectionMap[section.ecb_id] = [];
        sectionMap[section.ecb_id].push(section);
      });
      setEcbSections(sectionMap);

      const sectionIds = (sectionList || []).map((s) => s.id);
      if (!sectionIds.length) {
        setEcbValues({});
        setLoadingEcbs(false);
        return;
      }

      // 3. Fetch all values for these sections
      const { data: valueList, error: valueError } = await supabase
        .from("ecb_value")
        .select("*")
        .in("section_id", sectionIds)
        .order("position", { ascending: true });
      if (valueError) throw valueError;

      const valueMap: { [sectionId: string]: Tables<"ecb_value">[] } = {};
      (valueList || []).forEach((v) => {
        if (!valueMap[v.section_id]) valueMap[v.section_id] = [];
        valueMap[v.section_id].push(v);
      });
      setEcbValues(valueMap);
    } catch (err) {
      console.error("Error fetching ECBs, sections or values:", err);
      // Optionally set an error state
    } finally {
      setLoadingEcbs(false);
    }
  }, [resultId]);

  // Fetch ECBs on mount and after creation
  useEffect(() => {
    if (resultId) {
      // Only fetch if resultId is present
      fetchEcbs();
    }
  }, [fetchEcbs, resultId]); // Removed creatingEcb as fetchEcbs is called after creation explicitly

  // Start editing an ECB (enables all its values for edit)
  const startEditingEcb = (ecbId: string) => {
    setEditingEcbId(ecbId);
    let edits: { [valueId: string]: string } = {};
    let labelEdits: { [valueId: string]: string } = {};
    let sectionTitleEdits: { [sectionId: string]: string } = {};
    let descriptionEdits: { [ecbId: string]: string } = {};

    const ecb = ecbs.find((e) => e.id === ecbId);
    if (ecb) {
      // Get the model description for this ECB
      const model = ecbModels.find((m) => m.id === ecb.model_id);
      // First try to get stored description, fallback to model description
      descriptionEdits[ecbId] =
        getStoredEcbDescription(ecbId) || model?.description || "";
    }

    (ecbSections[ecbId] || []).forEach((section) => {
      sectionTitleEdits[section.id] = section.section_title;
      (ecbValues[section.id] || []).forEach((value) => {
        edits[value.id] = value.value ?? "";
        labelEdits[value.id] = value.label;
      });
    });

    setBatchValueEdits(edits);
    setBatchLabelEdits(labelEdits);
    setBatchSectionTitleEdits(sectionTitleEdits);
    setBatchDescriptionEdits(descriptionEdits);
  };

  // Cancel editing
  const cancelEditingEcb = () => {
    setEditingEcbId(null);
    setBatchValueEdits({});
    setBatchLabelEdits({});
    setBatchSectionTitleEdits({});
    setBatchDescriptionEdits({});
  };

  // Update value in batch edits
  const handleBatchEdit = (valueId: string, newValue: string) => {
    setBatchValueEdits((prev) => ({ ...prev, [valueId]: newValue }));
  };

  // Save all edits for one ECB
  const saveAllBatchEdits = async (ecbId: string) => {
    setSavingBatchEcbId(ecbId);
    try {
      // Save all value edits
      const valueUpdates = Object.entries(batchValueEdits).map(([id, value]) =>
        supabase.from("ecb_value").update({ value }).eq("id", id)
      );

      // Save all section title edits
      const sectionTitleUpdates = Object.entries(batchSectionTitleEdits).map(
        ([id, title]) =>
          supabase
            .from("ecb_section")
            .update({ section_title: title })
            .eq("id", id)
      );

      // Save all label edits
      const labelUpdates = Object.entries(batchLabelEdits).map(([id, label]) =>
        supabase.from("ecb_value").update({ label }).eq("id", id)
      );

      // Save description to localStorage instead of database
      if (batchDescriptionEdits[ecbId] !== undefined) {
        saveEcbDescription(ecbId, batchDescriptionEdits[ecbId]);
      }

      // Execute all updates in parallel
      await Promise.all([
        ...valueUpdates,
        ...sectionTitleUpdates,
        ...labelUpdates,
      ]);

      await fetchEcbs(); // Refresh to show updated values
    } catch (err) {
      console.error("Error saving batch edits:", err);
      toast.error("Erreur lors de la sauvegarde des modifications");
    } finally {
      setSavingBatchEcbId(null);
      setEditingEcbId(null);
      setBatchValueEdits({});
      setBatchSectionTitleEdits({});
      setBatchLabelEdits({});
      setBatchDescriptionEdits({});
      setEditingSectionId(null);
      setEditingLabelId(null);
    }
  };

  // Print handler (sets printEcbId)
  const handlePrintEcb = (ecbId: string) => {
    setPrintEcbId(ecbId);
    setTimeout(() => window.print(), 100);
    // Reset after print dialog is likely closed or actioned
    setTimeout(() => setPrintEcbId(null), 2000);
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "ecb_bold_toggles",
        JSON.stringify(boldToggles)
      );
    }
  }, [boldToggles]);

  const toggleLabelBold = (valueId: string) => {
    setBoldToggles((prev) => {
      const current = prev[valueId] || { labelBold: false, valueBold: false };
      return {
        ...prev,
        [valueId]: { ...current, labelBold: !current.labelBold },
      };
    });
  };
  const toggleValueBold = (valueId: string) => {
    setBoldToggles((prev) => {
      const current = prev[valueId] || { labelBold: false, valueBold: false };
      return {
        ...prev,
        [valueId]: { ...current, valueBold: !current.valueBold },
      };
    });
  };

  // --- Local state for section bold toggles ---
  const allSectionIds = useMemo(
    () =>
      Object.values(ecbSections || {})
        .flat()
        .map((section) => section.id),
    [ecbSections]
  );

  function getInitialSectionBoldToggles(ids: string[]) {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("ecb_section_bold_toggles");
        const parsed = stored ? JSON.parse(stored) : {};
        ids.forEach((id) => {
          if (!(id in parsed)) parsed[id] = true;
        }); // Default new to true
        return parsed;
      } catch {
        /* return default below */
      }
    }
    return Object.fromEntries(ids.map((id) => [id, true]));
  }
  const [sectionBoldToggles, setSectionBoldToggles] = useState<{
    [sectionId: string]: boolean;
  }>(() => getInitialSectionBoldToggles(allSectionIds));

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "ecb_section_bold_toggles",
        JSON.stringify(sectionBoldToggles)
      );
    }
  }, [sectionBoldToggles]);

  useEffect(() => {
    // For newly added sections
    setSectionBoldToggles((prev) => {
      const newToggles = { ...prev };
      let changed = false;
      allSectionIds.forEach((id) => {
        if (!(id in newToggles)) {
          newToggles[id] = true;
          changed = true;
        }
      });
      return changed ? newToggles : prev;
    });
  }, [allSectionIds]);

  const toggleSectionBold = (sectionId: string) => {
    setSectionBoldToggles((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId], // Toggles boolean or defaults to true if undefined
    }));
  };

  // --- Local state for abnormal cells ---
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "ecb_abnormal_cells",
        JSON.stringify(abnormalCells)
      );
    }
  }, [abnormalCells]);

  const toggleAbnormalCell = (valueId: string) => {
    setAbnormalCells((prev) => ({
      ...prev,
      [valueId]: !prev[valueId],
    }));
  };

  const handleLabelReorder = async (sectionId: string, result: any) => {
    if (!result.destination) return;

    const items = Array.from(ecbValues[sectionId] || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update positions
    const updatedItems = items.map((item, index) => ({
      ...item,
      position: index,
    }));

    // Update local state
    setEcbValues((prev) => ({
      ...prev,
      [sectionId]: updatedItems,
    }));

    // Update in database
    try {
      const updates = updatedItems.map((item) =>
        supabase
          .from("ecb_value")
          .update({ position: item.position })
          .eq("id", item.id)
      );
      await Promise.all(updates);
    } catch (err) {
      console.error("Error updating label positions:", err);
      // Optionally show error toast
    }
  };

  // Add new label/value pair to a section
  const handleAddLabelValue = async (sectionId: string) => {
    try {
      // Get the current values for this section to determine the new position
      const currentValues = ecbValues[sectionId] || [];
      const newPosition = currentValues.length;

      // Create new value in database
      const { data: newValue, error } = await supabase
        .from("ecb_value")
        .insert({
          section_id: sectionId,
          label: "Nouveau label",
          value: "",
          position: newPosition,
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setEcbValues((prev) => ({
        ...prev,
        [sectionId]: [...currentValues, newValue],
      }));

      // If we're in edit mode, add the new value to batch edits
      if (editingEcbId) {
        setBatchValueEdits((prev) => ({
          ...prev,
          [newValue.id]: "",
        }));
      }

      toast.success("Nouveau label ajouté");
    } catch (err) {
      console.error("Error adding new label:", err);
      toast.error("Erreur lors de l'ajout du label");
    }
  };

  // Add new section to an ECB
  const handleAddSection = async (ecbId: string) => {
    setSavingNewSection(ecbId);
    try {
      // Get current sections to determine new position
      const currentSections = ecbSections[ecbId] || [];
      const newPosition = currentSections.length;

      // Create new section in database
      const { data: newSection, error } = await supabase
        .from("ecb_section")
        .insert({
          ecb_id: ecbId,
          section_title: "Nouvelle section",
          position: newPosition,
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setEcbSections((prev) => ({
        ...prev,
        [ecbId]: [...currentSections, newSection],
      }));

      // Initialize empty values array for the new section
      setEcbValues((prev) => ({
        ...prev,
        [newSection.id]: [],
      }));

      toast.success("Nouvelle section ajoutée");
    } catch (err) {
      console.error("Error adding new section:", err);
      toast.error("Erreur lors de l'ajout de la section");
    } finally {
      setSavingNewSection(null);
    }
  };

  // Add these new functions for section title editing
  const startEditingSectionTitle = (
    sectionId: string,
    currentTitle: string
  ) => {
    setEditingSectionId(sectionId);
    setSectionTitleEditValue(currentTitle);
    setBatchSectionTitleEdits((prev) => ({
      ...prev,
      [sectionId]: currentTitle,
    }));
  };

  const cancelEditingSectionTitle = () => {
    setEditingSectionId(null);
    setSectionTitleEditValue("");
  };

  const saveSectionTitleEdit = async (sectionId: string) => {
    setSavingSectionId(sectionId);
    try {
      const { error } = await supabase
        .from("ecb_section")
        .update({ section_title: sectionTitleEditValue })
        .eq("id", sectionId);
      if (error) throw error;
      await fetchEcbs(); // Refresh to show updated title
    } catch (err) {
      console.error("Error saving section title:", err);
      toast.error("Erreur lors de la modification du titre de la section");
    } finally {
      setSavingSectionId(null);
      setEditingSectionId(null);
      setSectionTitleEditValue("");
    }
  };

  // Add these new functions after handleAddSection
  const handleDeleteSection = async (sectionId: string) => {
    try {
      // First delete all values in the section
      const { error: valueError } = await supabase
        .from("ecb_value")
        .delete()
        .eq("section_id", sectionId);
      if (valueError) throw valueError;

      // Then delete the section itself
      const { error: sectionError } = await supabase
        .from("ecb_section")
        .delete()
        .eq("id", sectionId);
      if (sectionError) throw sectionError;

      // Update local state
      const ecbId = Object.keys(ecbSections).find((key) =>
        ecbSections[key].some((section) => section.id === sectionId)
      );
      if (ecbId) {
        setEcbSections((prev) => ({
          ...prev,
          [ecbId]: prev[ecbId].filter((section) => section.id !== sectionId),
        }));
      }
      setEcbValues((prev) => {
        const newValues = { ...prev };
        delete newValues[sectionId];
        return newValues;
      });

      toast.success("Section supprimée");
    } catch (err) {
      console.error("Error deleting section:", err);
      toast.error("Erreur lors de la suppression de la section");
    }
  };

  const handleDeleteLabel = async (valueId: string) => {
    try {
      const { error } = await supabase
        .from("ecb_value")
        .delete()
        .eq("id", valueId);
      if (error) throw error;

      // Update local state
      const sectionId = Object.keys(ecbValues).find((key) =>
        ecbValues[key].some((value) => value.id === valueId)
      );
      if (sectionId) {
        setEcbValues((prev) => ({
          ...prev,
          [sectionId]: prev[sectionId].filter((value) => value.id !== valueId),
        }));
      }

      // Remove from batch edits if in edit mode
      if (editingEcbId) {
        setBatchValueEdits((prev) => {
          const newEdits = { ...prev };
          delete newEdits[valueId];
          return newEdits;
        });
      }

      toast.success("Label supprimé");
    } catch (err) {
      console.error("Error deleting label:", err);
      toast.error("Erreur lors de la suppression du label");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-muted bg-background p-4"
            >
              <div className="pb-2">
                {" "}
                <Skeleton className="h-5 w-24" />{" "}
                <Skeleton className="h-4 w-32 mt-1" />{" "}
              </div>
              <div className="space-y-3">
                {" "}
                <Skeleton className="h-8 w-full" />{" "}
                <Skeleton className="h-8 w-full" />{" "}
              </div>
            </div>
          ))}
        </div>
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-lg border border-muted bg-background p-4"
          >
            <div className="pb-2">
              {" "}
              <Skeleton className="h-6 w-1/3" />{" "}
            </div>
            <div>
              {" "}
              <Skeleton className="h-20 w-full" />{" "}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6 p-4">
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
  if (!resultData) return <div className="p-4">Résultat non trouvé.</div>;

  // --- Main Render ---
  return (
    <div className="space-y-6 p-4 md:p-6">
      {" "}
      {/* Added padding for overall page */}
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 print:hidden">
        {/* <div>
          <Link to={patientData ? `/patients/${patientData.id}` : "/patients"}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour {patientData ? `à ${patientData.full_name}` : "à la liste"}
            </Button>
          </Link>
        </div> */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 order-first sm:order-none">
          <FileText className="h-6 w-6 text-primary" />
          Détails du Résultat
        </h1>
        <div className="sm:min-w-[100px]">
          {" "}
          {/* Placeholder for right-side alignment if needed */}
          {/* <Button onClick={handlePrint} size="sm" className="print:hidden">
            <Printer className="mr-2 h-4 w-4" /> Imprimer le Rapport Complet
          </Button> */}
        </div>
      </div>
      {/* --- Report Content Wrapper (for Print/PDF) --- */}
      <div className="report-content bg-white p-0 sm:p-0 border border-transparent print:border-none print:p-0 print:shadow-none">
        {/* 7. Render header above report content */}
        {loadingHeader ? (
          <Skeleton className="h-20 w-full mb-2" />
        ) : headerConfig ? (
          <div className="mb-2 print:mb-0">
            <SelectedHeaderComponent
              data={headerDataProps}
              isPreview={false}
              reportTitle="RAPPORT DE RÉSULTATS D'ANALYSES" // Changed title slightly
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 print:mb-4 print:hidden">
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
                extractId(patientData?.patient_unique_id as string)
              )}
              {renderInfoItem(Phone, "Téléphone", patientData?.phone)}{" "}
              {/* Added Phone for Patient */}
              {renderInfoItem(
                CalendarDays,
                "Date Naissance",
                patientData?.date_of_birth
                  ? format(parseISO(patientData.date_of_birth), "P", {
                      locale: fr,
                    })
                  : null
              )}
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

              <div className="flex items-start space-x-3 mt-2">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0 print:h-4 print:w-4" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Statut
                  </p>
                  <div className="flex items-center gap-2 print:hidden">
                    <Select
                      value={resultData.status ?? ""}
                      onValueChange={(value: string) =>
                        handleStatusChange(value)
                      }
                      disabled={loadingStatusUpdate}
                    >
                      <SelectTrigger id="resultStatus" className="h-9 flex-1">
                        <SelectValue placeholder="Changer statut..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attente">
                          <div className="flex items-center gap-2">
                            <Hourglass className="h-4 w-4 text-muted-foreground" />
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
                            <CheckCircle className="h-4 w-4 text-green-600" />
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
        <div className="grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 print:mb-4 print:grid-cols-2 hidden print:grid">
          {/* Patient Info */}
          <div className="flex flex-col gap-1 rounded-lg border border-slate-600 print:shadow-lg bg-white/90 p-3 print:border  print:bg-white print:rounded-md print:p-2 text-xs">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <User className="h-4 w-4" /> Patient
            </div>
            {renderInfoItem(Info, "NOM PRENOM", patientData?.full_name)}
            {renderInfoItem(
              Info,
              "ID Unique",
              extractId(patientData?.patient_unique_id as string)
            )}
            {renderInfoItem(Phone, "Téléphone", patientData?.phone)}
            {/* {renderInfoItem(
                    CalendarDays,
                    "Date de Naissance",
                    patientData?.date_of_birth
                      ? format(parseISO(patientData.date_of_birth), "P", {
                          locale: fr,
                        })
                      : null
                  )} */}
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
            {renderInfoItem(Info, "Provenance", doctorData?.hospital)}
          </div>
        </div>

        {/* main page content */}
        <div className="page-content">
          {/* ECB Creation Section */}
          <div className="overflow-hidden rounded-lg border border-muted bg-background p-4 mb-4 print:hidden">
            <div>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <Label
                    htmlFor="ecb-model-select"
                    className="mb-4 font-bold text-lg"
                  >
                    Sélectionner un modèle
                  </Label>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Input
                        placeholder="Rechercher un modèle..."
                        value={ecbModelSearchQuery}
                        onChange={(e) => setEcbModelSearchQuery(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                      <div className="divide-y">
                        {ecbModels
                          .filter(
                            (model) =>
                              model.name
                                .toLowerCase()
                                .includes(ecbModelSearchQuery.toLowerCase()) ||
                              (model.description &&
                                model.description
                                  .toLowerCase()
                                  .includes(ecbModelSearchQuery.toLowerCase()))
                          )
                          .map((model) => (
                            <div
                              key={model.id}
                              className="flex items-center space-x-2 p-2 hover:bg-slate-50 cursor-pointer"
                              onClick={() => {
                                setSelectedModelId(model.id);
                              }}
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {model.name}
                                </p>
                                {model.description && (
                                  <p className="text-xs text-slate-500">
                                    {model.description}
                                  </p>
                                )}
                              </div>
                              {selectedModelId === model.id && (
                                <Check className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    setCreatingEcb(true);
                    setCreateEcbError(null);
                    try {
                      if (!selectedModelId || !resultId)
                        throw new Error(
                          "Sélectionner un modèle et s'assurer que l'ID du résultat est disponible."
                        );

                      const model = ecbModels.find(
                        (m) => m.id === selectedModelId
                      );
                      if (!model) throw new Error("Modèle non trouvé.");

                      const currentUser = (await supabase.auth.getUser()).data
                        .user;

                      const { data: newEcb, error: ecbError } = await supabase
                        .from("ecb")
                        .insert({
                          result_id: resultId,
                          model_id: model.id,
                          title: model.name, // Use model name as default title
                          created_by: currentUser?.id || null,
                        })
                        .select()
                        .single();
                      if (ecbError) throw ecbError;
                      if (!newEcb)
                        throw new Error("La création de l'ECB a échoué.");

                      // --- MODIFIED PART: Insert sections and values with defaults ---
                      const structure: EcbModelSection[] = model.structure; // Ensure structure is typed
                      let sectionInserts = [];
                      let valueInserts = [];

                      for (
                        let sectionIndex = 0;
                        sectionIndex < structure.length;
                        sectionIndex++
                      ) {
                        const section = structure[sectionIndex];
                        const sectionId = crypto.randomUUID(); // Client-side ID for linking
                        sectionInserts.push({
                          id: sectionId,
                          ecb_id: newEcb.id,
                          section_title: section.title,
                          position: sectionIndex,
                        });

                        for (
                          let labelIndex = 0;
                          labelIndex < section.labels.length;
                          labelIndex++
                        ) {
                          const labelObj: EcbModelLabel =
                            section.labels[labelIndex]; // labelObj is { name: string, defaultValue: string | null }
                          valueInserts.push({
                            section_id: sectionId,
                            label: labelObj.name, // Use the name of the label
                            value: labelObj.defaultValue, // Use the defaultValue from the model
                            position: labelIndex,
                          });
                        }
                      }
                      // --- END MODIFIED PART ---

                      if (sectionInserts.length) {
                        const { error: sectionError } = await supabase
                          .from("ecb_section")
                          .insert(sectionInserts);
                        if (sectionError) throw sectionError;
                      }
                      if (valueInserts.length) {
                        const { error: valueError } = await supabase
                          .from("ecb_value")
                          .insert(valueInserts);
                        if (valueError) throw valueError;
                      }

                      await fetchEcbs(); // Refresh the list of ECBs
                      setSelectedModelId(""); // Reset model selection
                      setEcbModelSearchQuery(""); // Reset search query
                    } catch (err: any) {
                      console.error("Error creating ECB:", err);
                      setCreateEcbError(
                        err.message || "Erreur lors de la création de l'ECB."
                      );
                    } finally {
                      setCreatingEcb(false);
                    }
                  }}
                  disabled={!selectedModelId || creatingEcb || loadingModels}
                  className="min-w-[120px]"
                >
                  {creatingEcb ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Créer
                </Button>
                <div>
                  <Button onClick={() => navigate(`/antibiotique/${resultId}`)}>
                    ATB
                  </Button>
                </div>
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
            <Skeleton className="h-24 w-full" />
          ) : ecbs.length === 0 ? (
            <div className="text-muted-foreground text-sm p-4 border rounded-md bg-background text-center">
              Aucun ECB trouvé pour ce résultat. Créez-en un en utilisant un
              modèle ci-dessus.
            </div>
          ) : (
            <div className="space-y-6 print:space-y-0">
              {ecbs.map((ecb) => (
                <div
                  key={ecb.id}
                  className="relative p-4 border rounded-lg bg-background print:border-none print:p-0 print:shadow-none"
                >
                  <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <div className="flex items-center gap-1">
                        {editingTitleEcbId === ecb.id ? (
                          <div className="flex items-center gap-1">
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
                              className="text-sm h-7"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveTitleEdit(ecb.id)}
                              disabled={
                                savingTitleEcbId === ecb.id ||
                                !titleEditValue.trim()
                              }
                              className="h-7 px-2"
                            >
                              {savingTitleEcbId === ecb.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "OK"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelEditingTitle}
                              disabled={savingTitleEcbId === ecb.id}
                              className="h-7 px-2"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span>{ecb.title}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                startEditingTitle(ecb.id, ecb.title)
                              }
                              className="ml-1 h-6 w-6"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                      {editingEcbId === ecb.id ? (
                        <div className="mt-2">
                          <Textarea
                            value={batchDescriptionEdits[ecb.id] || ""}
                            onChange={(e) =>
                              setBatchDescriptionEdits((prev) => ({
                                ...prev,
                                [ecb.id]: e.target.value,
                              }))
                            }
                            placeholder="Description (optionnelle)"
                            className="text-sm h-20"
                            disabled={savingBatchEcbId === ecb.id}
                          />
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground mt-1">
                          {getStoredEcbDescription(ecb.id) ||
                            ecbModels.find((m) => m.id === ecb.model_id)
                              ?.description ||
                            ""}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Créé le{" "}
                        {format(parseISO(ecb.created_at), "Pp", { locale: fr })}
                      </div>
                    </div>
                    <div className="flex gap-2 print:hidden self-start sm:self-center">
                      {editingEcbId === ecb.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="default" // Changed to default for save
                            onClick={() => saveAllBatchEdits(ecb.id)}
                            disabled={savingBatchEcbId === ecb.id}
                          >
                            {savingBatchEcbId === ecb.id && (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            Enregistrer
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
                            variant="destructive"
                            onClick={() => openDeleteEcbInstanceDialog(ecb)}
                            disabled={
                              isDeletingEcb && ecbToDelete?.id === ecb.id
                            } // Disable if this specific ECB is being deleted
                            className="ml-2" // Optional: add some margin
                          >
                            {isDeletingEcb && ecbToDelete?.id === ecb.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-1" />
                            )}
                            Supprimer ECB
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrintEcb(ecb.id)}
                          >
                            <Printer className="h-4 w-4 mr-1" /> Imprimer ECB
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="print:hidden">
                    {editingEcbId === ecb.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mb-4"
                        onClick={() => handleAddSection(ecb.id)}
                        disabled={savingNewSection === ecb.id}
                      >
                        {savingNewSection === ecb.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Ajouter une section
                      </Button>
                    )}
                    {(ecbSections[ecb.id] || []).map((section) => (
                      <div key={section.id} className="mb-4 print:mb-0">
                        <div className="font-semibold mb-2 text-lg flex items-center gap-1">
                          {editingSectionId === section.id ? (
                            <div className="flex items-center gap-1 w-full">
                              <Input
                                value={sectionTitleEditValue}
                                onChange={(e) => {
                                  setSectionTitleEditValue(e.target.value);
                                  setBatchSectionTitleEdits((prev) => ({
                                    ...prev,
                                    [section.id]: e.target.value,
                                  }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    setEditingSectionId(null);
                                    setSectionTitleEditValue("");
                                  }
                                  if (e.key === "Escape") {
                                    setEditingSectionId(null);
                                    setSectionTitleEditValue("");
                                    setBatchSectionTitleEdits((prev) => {
                                      const newEdits = { ...prev };
                                      delete newEdits[section.id];
                                      return newEdits;
                                    });
                                  }
                                }}
                                disabled={savingBatchEcbId === ecb.id}
                                className="text-base h-8 flex-1"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => saveSectionTitleEdit(section.id)}
                                disabled={
                                  savingBatchEcbId === ecb.id ||
                                  !sectionTitleEditValue.trim()
                                }
                                className="h-8 px-2"
                              >
                                {savingBatchEcbId === ecb.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "OK"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEditingSectionTitle}
                                disabled={savingBatchEcbId === ecb.id}
                                className="h-8 px-2"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span>{section.section_title}</span>
                              {editingEcbId === ecb.id && (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() =>
                                      startEditingSectionTitle(
                                        section.id,
                                        section.section_title
                                      )
                                    }
                                    className="h-5 w-5 p-0"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() =>
                                      handleDeleteSection(section.id)
                                    }
                                    className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="icon"
                                variant={
                                  sectionBoldToggles[section.id]
                                    ? "default"
                                    : "ghost"
                                }
                                className="h-6 w-6 p-0"
                                onClick={() => toggleSectionBold(section.id)}
                                type="button"
                              >
                                <b>B</b>
                              </Button>
                            </>
                          )}
                        </div>
                        <DragDropContext
                          onDragEnd={(result) =>
                            handleLabelReorder(section.id, result)
                          }
                        >
                          <Droppable droppableId={section.id}>
                            {(provided) => (
                              <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="grid grid-cols-1 gap-y-3 gap-x-2"
                              >
                                {(ecbValues[section.id] || []).map(
                                  (value, index) => (
                                    <Draggable
                                      key={value.id}
                                      draggableId={value.id}
                                      index={index}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 ${
                                            snapshot.isDragging
                                              ? "opacity-50"
                                              : ""
                                          }`}
                                        >
                                          <div className="flex items-center gap-2">
                                            <div
                                              {...provided.dragHandleProps}
                                              className="cursor-move"
                                            >
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="text-muted-foreground"
                                              >
                                                <circle cx="9" cy="12" r="1" />
                                                <circle cx="9" cy="5" r="1" />
                                                <circle cx="9" cy="19" r="1" />
                                                <circle cx="15" cy="12" r="1" />
                                                <circle cx="15" cy="5" r="1" />
                                                <circle cx="15" cy="19" r="1" />
                                              </svg>
                                            </div>
                                            <Label className="w-full sm:w-48 text-sm font-medium flex items-center gap-1 shrink-0">
                                              {editingLabelId === value.id ? (
                                                <div className="flex items-center gap-1 w-full">
                                                  <Input
                                                    value={labelEditValue}
                                                    onChange={(e) => {
                                                      setLabelEditValue(
                                                        e.target.value
                                                      );
                                                      setBatchLabelEdits(
                                                        (prev) => ({
                                                          ...prev,
                                                          [value.id]:
                                                            e.target.value,
                                                        })
                                                      );
                                                    }}
                                                    onKeyDown={(e) => {
                                                      if (e.key === "Enter") {
                                                        setEditingLabelId(null);
                                                        setLabelEditValue("");
                                                      }
                                                      if (e.key === "Escape") {
                                                        setEditingLabelId(null);
                                                        setLabelEditValue("");
                                                        setBatchLabelEdits(
                                                          (prev) => {
                                                            const newEdits = {
                                                              ...prev,
                                                            };
                                                            delete newEdits[
                                                              value.id
                                                            ];
                                                            return newEdits;
                                                          }
                                                        );
                                                      }
                                                    }}
                                                    disabled={
                                                      savingBatchEcbId ===
                                                      ecb.id
                                                    }
                                                    className="text-sm h-7 flex-1"
                                                    autoFocus
                                                  />
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                      saveLabelEdit(value.id)
                                                    }
                                                    disabled={
                                                      savingBatchEcbId ===
                                                        ecb.id ||
                                                      !labelEditValue.trim()
                                                    }
                                                    className="h-7 px-2"
                                                  >
                                                    {savingBatchEcbId ===
                                                    ecb.id ? (
                                                      <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                      "OK"
                                                    )}
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={cancelEditingLabel}
                                                    disabled={
                                                      savingBatchEcbId ===
                                                      ecb.id
                                                    }
                                                    className="h-7 px-2"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-1 w-full">
                                                  <span>{value.label}</span>
                                                  {editingEcbId === ecb.id && (
                                                    <Button
                                                      size="icon"
                                                      variant="ghost"
                                                      onClick={() =>
                                                        startEditingLabel(
                                                          value.id,
                                                          value.label
                                                        )
                                                      }
                                                      className="h-5 w-5 p-0"
                                                    >
                                                      <Edit className="h-3 w-3" />
                                                    </Button>
                                                  )}
                                                  <Button
                                                    size="icon"
                                                    variant={
                                                      boldToggles[value.id]
                                                        ?.labelBold
                                                        ? "default"
                                                        : "ghost"
                                                    }
                                                    className="h-5 w-5 p-0"
                                                    title={
                                                      boldToggles[value.id]
                                                        ?.labelBold
                                                        ? "Texte normal"
                                                        : "Mettre en gras"
                                                    }
                                                    onClick={() =>
                                                      toggleLabelBold(value.id)
                                                    }
                                                    type="button"
                                                  >
                                                    <b>B</b>
                                                  </Button>
                                                  {editingEcbId === ecb.id && (
                                                    <Button
                                                      size="icon"
                                                      variant="ghost"
                                                      onClick={() =>
                                                        handleDeleteLabel(
                                                          value.id
                                                        )
                                                      }
                                                      className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  )}
                                                </div>
                                              )}
                                            </Label>
                                          </div>
                                          <div className="flex-1 flex items-center gap-1">
                                            {editingEcbId === ecb.id ? (
                                              <Input
                                                value={
                                                  batchValueEdits[value.id] ??
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  handleBatchEdit(
                                                    value.id,
                                                    e.target.value
                                                  )
                                                }
                                                disabled={
                                                  savingBatchEcbId === ecb.id
                                                }
                                                className="text-sm flex-1 h-8"
                                              />
                                            ) : (
                                              <div
                                                className={`text-sm flex-1 ${
                                                  boldToggles[value.id]
                                                    ?.valueBold
                                                    ? "font-bold"
                                                    : ""
                                                } ${
                                                  abnormalCells[value.id]
                                                    ? "text-destructive"
                                                    : ""
                                                }`}
                                              >
                                                {value.value || (
                                                  <span className="text-muted-foreground italic">
                                                    -
                                                  </span>
                                                )}
                                              </div>
                                            )}
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
                                                  ? "Texte normal"
                                                  : "Mettre en gras"
                                              }
                                              onClick={() =>
                                                toggleValueBold(value.id)
                                              }
                                              type="button"
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
                                                  ? "Cellule normale"
                                                  : "Marquer comme anormale"
                                              }
                                              onClick={() =>
                                                toggleAbnormalCell(value.id)
                                              }
                                              type="button"
                                            >
                                              <span className="font-bold text-sm">
                                                !
                                              </span>
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  )
                                )}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                        {editingEcbId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => handleAddLabelValue(section.id)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Ajouter un label
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Print-only ECB rendering */}
                  {printEcbId === ecb.id && (
                    <div className="hidden print:block bg-white p-4 print:p-0">
                      <div className="font-semibold text-lg text-center mb-2 print:text-base print:mb-1">
                        {" "}
                        {/* Adjusted print font size */}
                        {ecb.title}
                      </div>
                      {/* description */}
                      <div className=" mb-2">
                        {getStoredEcbDescription(ecb.id) ||
                          ecbModels.find((m) => m.id === ecb.model_id)
                            ?.description ||
                          ""}
                      </div>
                      <table className="w-full border-collapse print-ecb-table">
                        <tbody>
                          {(ecbSections[ecb.id] || []).map((section) => (
                            <React.Fragment key={`print-section-${section.id}`}>
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
                                <tr key={`print-value-${value.id}`}>
                                  <td
                                    className={`align-top pr-4 pb-1 text-xs print-ecb-label  ${
                                      boldToggles[value.id]?.labelBold
                                        ? "font-bold"
                                        : "font-normal"
                                    }  ${
                                      value.label.includes(":")
                                        ? "print:font-semibold"
                                        : ""
                                    }     `}
                                    style={{ width: "35%" }}
                                    colSpan={value.label.includes(":") ? 2 : 1}
                                  >
                                    {value.label.includes("#") ? (
                                      <span className="font-bold">
                                        {value.label.split("#")[0]}
                                      </span>
                                    ) : (
                                      <>{value.label}</>
                                    )}
                                  </td>
                                  {value.value !== "-" && (
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
                                      <div className="w-full flex items-center ">
                                        {value.value &&
                                        value.value.trim() !== "" ? (
                                          value.value.split(";").map(
                                            (
                                              line,
                                              index // Handle newlines for print
                                            ) => (
                                              <div
                                                key={index}
                                                className="flex-1"
                                              >
                                                {/* check for norms: include val1#val2#val3 */}
                                                {line.includes("#") ? (
                                                  <div className="flex flex-col">
                                                    {line
                                                      .split("#")
                                                      .map((val, idx) => (
                                                        <span key={idx}>
                                                          {val}
                                                        </span>
                                                      ))}
                                                  </div>
                                                ) : (
                                                  line
                                                )}
                                              </div>
                                            )
                                          )
                                        ) : (
                                          <span className="italic text-muted-foreground">
                                            -
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>

                      {/* CSS for print is below */}
                    </div>
                  )}
                  {/* <div className="print:hidden">
                    <Checkbox
                      checked={withAtb}
                      onCheckedChange={() => setWithAtb((prev) => !prev)}
                    />
                    <Label htmlFor="withAtb">Avec ATB</Label>
                  </div> */}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`mt-4 print:mt-6 ${withAtb && "print:hidden"} `}>
          <div className="flex items-center space-x-2 mb-2 print:hidden">
            <Checkbox
              id="showFooter"
              checked={!withAtb}
              onCheckedChange={(checked) => setWithAtb(!checked)}
            />
            <Label htmlFor="showFooter">Afficher le pied de page</Label>
          </div>
          <Footer date={resultData.result_date || new Date().toISOString()} />
        </div>
      </div>{" "}
      {/* End Report Content Wrapper */}
      <AlertDialog
        open={showDeleteEcbDialog}
        onOpenChange={setShowDeleteEcbDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmer la Suppression de l'ECB
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement l'ECB intitulé "
              <span className="font-semibold">
                {ecbToDelete?.title || "Sans titre"}
              </span>
              " et tous ses résultats associés ? Cette action ne peut pas être
              annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteEcbDialog(false);
                setEcbToDelete(null);
              }}
              disabled={isDeletingEcb}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEcbInstanceConfirm}
              disabled={isDeletingEcb}
              className="bg-red-600 hover:bg-red-700" // Destructive action style
            >
              {isDeletingEcb && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Supprimer Définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ECBPage;
