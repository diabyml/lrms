/* eslint-disable @typescript-eslint/no-unused-vars */

// no typescript check

import { cn } from "@/lib/utils"; // Adjust path if needed
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient"; // Adjust path if needed

// Shadcn/ui Imports
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path if needed
import { Button } from "@/components/ui/button"; // Adjust path if needed
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Adjust path if needed
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
import {
  Table as ShadTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
// Icons & Date Handling
import { format, parseISO, set } from "date-fns";
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

// --- Antibiogram Table Props ---
interface AntibiogramTableProps {
  resultId?: string;
}

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
const ATBPage: React.FC = () => {
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

  // --- Editable Antibiogram Fields State ---

  const [atbResultId, setAtbResultId] = useState<string | null>(null);
  const [fieldsLoading, setFieldsLoading] = useState(true);

  useEffect(() => {
    const fetchAtbFields = async () => {
      setFieldsLoading(true);
      if (!resultId) return;
      // @ts-ignore: If types are out of sync, update Supabase types!
      const { data, error } = await supabase
        .from("atbs_result" as any)
        .select("id, nature_prelevement, souche")
        .eq("result_id", resultId)
        .single();
      if (data) {
        setAtbResultId(data.id);
      }
      setFieldsLoading(false);
    };
    fetchAtbFields();
  }, [resultId]);

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

  // --- ATBs Results State ---
  const [atbsResults, setAtbsResults] = useState<any[]>([]);
  const [atbsResultsLoading, setAtbsResultsLoading] = useState(false);

  // Fetch all atbs_results for this resultId
  useEffect(() => {
    if (!resultId) return;
    setAtbsResultsLoading(true);
    supabase
      .from("atbs_result")
      .select("*")
      .eq("result_id", resultId)
      .then(({ data }) => {
        setAtbsResults(data || []);
        setAtbsResultsLoading(false);
      });
  }, [resultId]);

  // --- State for print selection ---
  const [selectedForPrint, setSelectedForPrint] = useState<string[]>([]);

  // Toggle selection for print
  const handleTogglePrint = (id: string) => {
    setSelectedForPrint((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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

  const [creating, setCreating] = useState(false);

  // Handler to create a new atbs_result and link all ATBs
  const handleCreateAtbsResult = async () => {
    if (!resultId) return;
    setCreating(true);
    try {
      // 1. Create new atbs_result
      const { data: newAtbsResult, error: insertError } = await supabase
        .from("atbs_result")
        .insert({ result_id: resultId })
        .select("id");
      if (insertError || !newAtbsResult || !newAtbsResult[0]) throw insertError;
      const newAtbsResultId = newAtbsResult[0].id;

      // 2. Get all ATBs
      const { data: atbsList, error: atbsError } = await supabase
        .from("atbs")
        .select("id");
      if (atbsError || !atbsList) throw atbsError;

      // 3. Insert all ATBs into atbs_result_atb
      const inserts = atbsList.map((atb: any) => ({
        atbs_result_id: newAtbsResultId,
        atb_id: atb.id,
      }));
      if (inserts.length > 0) {
        await supabase.from("atbs_result_atb").insert(inserts);
      }

      // 4. Refresh page state (you may want to reload data here)
      window.location.reload();
    } catch (e) {
      // Optionally handle error
      setCreating(false);
    }
  };

  useEffect(() => {
    // Only run when resultId is available and loading is finished
    if (!resultId || loading) return;

    let isMounted = true;
    const initializeATBsResult = async () => {
      // 1. Check if there is already an atbs_result for this result
      const { data: atbsResultList, error: atbsResultError } = await supabase
        .from("atbs_result")
        .select("id")
        .eq("result_id", resultId);
      if (atbsResultError) {
        console.error(
          "Erreur lors de la vérification d'atbs_result:",
          atbsResultError
        );
        return;
      }
      if (atbsResultList && atbsResultList.length > 0) {
        // Already exists, nothing to do
        return;
      }
      // 2. Create a new atbs_result for this result
      const { data: newAtbsResult, error: createAtbsResultError } =
        await supabase
          .from("atbs_result")
          .insert({ result_id: resultId })
          .select("id")
          .single();
      if (createAtbsResultError || !newAtbsResult) {
        console.error(
          "Erreur lors de la création d'atbs_result:",
          createAtbsResultError
        );
        return;
      }
      // 3. Fetch all atbs
      const { data: atbsList, error: atbsListError } = await supabase
        .from("atbs")
        .select("id");
      if (atbsListError || !atbsList) {
        console.error(
          "Erreur lors de la récupération des ATBs:",
          atbsListError
        );
        return;
      }
      // 4. Bulk insert atbs_result_atb entries for each atb
      const atbsResultAtbRows = atbsList.map((atb: { id: string }) => ({
        atbs_result_id: newAtbsResult.id,
        atb_id: atb.id,
      }));
      if (atbsResultAtbRows.length > 0) {
        const { error: atbsResultAtbError } = await supabase
          .from("atbs_result_atb")
          .insert(atbsResultAtbRows);
        if (atbsResultAtbError) {
          console.error(
            "Erreur lors de la création des atbs_result_atb:",
            atbsResultAtbError
          );
        }
      }
    };
    initializeATBsResult();
    return () => {
      isMounted = false;
    };
  }, [resultId, loading]);

  if (loading) {
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
        <div className="flex justify-end">
          <Button variant="default" onClick={() => window.print()}>
            Imprimer
          </Button>
          <Button
            variant="secondary"
            onClick={handleCreateAtbsResult}
            disabled={creating}
          >
            {creating ? "Création..." : "Créer un nouvel ATB Résultat"}
          </Button>
        </div>
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
        <Separator className="my-2 print:my-0 print:border-none print:hidden" />
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
                      onValueChange={(value: string) =>
                        handleStatusChange(value)
                      }
                      disabled={loadingStatusUpdate}
                    >
                      <SelectTrigger id="resultStatus" className="h-9 flex-1">
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
            </CardContent>
          </Card>
        </div>
        {/* print info grid for print only*/}
        <div className="grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6  print:grid-cols-2 hidden ">
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
        {/* ANTIBIOGRAMME Title and Editable Fields */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <Input
            className="text-2xl font-bold text-center w-auto"
            value={description || "ANTIBIOGRAMME"}
            onChange={(e) => setDescription(e.target.value)}
            style={{ maxWidth: 400 }}
          />

          {/* TODO: Replace below with antibiogram table code provided by user */}
          <div className="w-full mt-0">
            {/* === ANTIBIOGRAMME TABLE GOES HERE === */}
            {atbsResultsLoading ? (
              <div className="text-center">
                Chargement des antibiogrammes...
              </div>
            ) : atbsResults.length === 0 ? (
              <div className="flex flex-col gap-2 items-center">
                <div className="text-center text-muted-foreground">
                  Aucun antibiogramme trouvé.
                </div>
                <Button
                  onClick={() => window.location.reload()}
                  className="mx-auto"
                >
                  Creer
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-8 mt-0">
                {atbsResults.map((result) => (
                  <div
                    key={result.id}
                    className={
                      selectedForPrint.length > 0 &&
                      !selectedForPrint.includes(result.id)
                        ? "print:hidden"
                        : ""
                    }
                  >
                    <div className="flex items-center gap-2 mb-2 print:hidden">
                      <input
                        type="checkbox"
                        checked={
                          selectedForPrint.length === 0 ||
                          selectedForPrint.includes(result.id)
                        }
                        onChange={() => handleTogglePrint(result.id)}
                        id={`print-checkbox-${result.id}`}
                      />
                      <label
                        htmlFor={`print-checkbox-${result.id}`}
                        className="text-sm"
                      >
                        Inclure pour impression
                      </label>
                    </div>
                    <AntibiogramTable resultId={result.id} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>{" "}
        {/* End Report Content Wrapper */}
        <style>{`
        @media print {
          .report-content table {
            font-size: 16px;
            width: 100%;
          }
          .report-content th, .report-content td {
            padding: 4px 4px !important;
            font-size: 16px;
          }
          .report-content {
            padding: 2px !important;
            margin: 0 !important;
          }
          .report-content table {
            border-collapse: collapse;
          }
          .report-content th, .report-content td {
            border: 1px solid #ccc;
          }
        }
      `}</style>
      </div>
    </div>
  );
};

const AntibiogramTable: React.FC<AntibiogramTableProps> = ({ resultId }) => {
  const [atbs, setAtbs] = useState<{ id: string; name: string }[]>([]);
  const [atbsResultId, setAtbsResultId] = useState<string | null>(null);
  const [atbsResultATBs, setAtbsResultATBs] = useState<any[]>([]);
  const [localSIR, setLocalSIR] = useState<
    Record<string, { S: boolean; I: boolean; R: boolean }>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<null | "success" | "error">(
    null
  );
  const [naturePrelevement, setNaturePrelevement] = useState("");
  const [souche, setSouche] = useState("");

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (!resultId) return;
      // 1. Get the atbs_result for this resultId
      // @ts-ignore: If types are out of sync, update Supabase types!
      const { data: atbsResultList } = await supabase
        .from("atbs_result" as any)
        .select("*")
        .eq("id", resultId);
      if (!atbsResultList || atbsResultList.length === 0) {
        setLoading(false);
        return;
      }
      const atbsResultId = atbsResultList[0].id;
      setAtbsResultId(atbsResultId);
      setNaturePrelevement(atbsResultList[0].nature_prelement);
      setSouche(atbsResultList[0].souche);
      // 2. Get all antibiotics
      const { data: atbsList } = await supabase
        .from("atbs" as any)
        .select("id, name");
      setAtbs(atbsList || []);
      // 3. Get all atbs_result_atb entries for this atbs_result
      // @ts-ignore: If types are out of sync, update Supabase types!
      const { data: atbsResultAtbList } = await supabase
        .from("atbs_result_atb" as any)
        .select("id, atb_id, sensible, intermediaire, resistant")
        .eq("atbs_result_id", atbsResultId);
      setAtbsResultATBs(atbsResultAtbList || []);
      // Prepare local SIR state
      const sirObj: Record<string, { S: boolean; I: boolean; R: boolean }> = {};
      (atbsResultAtbList || []).forEach((entry: any) => {
        sirObj[entry.atb_id] = {
          S: !!entry.sensible,
          I: !!entry.intermediaire,
          R: !!entry.resistant,
        };
      });
      setLocalSIR(sirObj);
      setLoading(false);
    };
    fetchData();
  }, [resultId]);

  // Checkbox handler
  const handleCheckbox = (atbId: string, type: "S" | "I" | "R") => {
    setLocalSIR((prev) => ({
      ...prev,
      [atbId]: {
        ...prev[atbId],
        [type]: !prev[atbId]?.[type],
      },
    }));
  };

  // Save handler
  const handleSave = async () => {
    if (!atbsResultId) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      // For each atb, update the corresponding atbs_result_atb entry
      for (const atb of atbs) {
        const entry = atbsResultATBs.find((x: any) => x.atb_id === atb.id);
        if (entry) {
          await supabase
            .from("atbs_result_atb" as any)
            .update({
              sensible: localSIR[atb.id]?.S || false,
              intermediaire: localSIR[atb.id]?.I || false,
              resistant: localSIR[atb.id]?.R || false,
            })
            .eq("id", entry.id);
        }
      }

      await supabase
        .from("atbs_result" as any)
        .update({
          nature_prelement: naturePrelevement,
          souche: souche,
        })
        .eq("id", atbsResultId);

      setSaveStatus("success");
    } catch (e) {
      setSaveStatus("error");
    }
    setSaving(false);
  };

  if (loading)
    return <div className="text-center">Chargement du tableau...</div>;
  if (!atbsResultId)
    return (
      <div className="text-center text-muted-foreground">
        Aucun antibiogramme trouvé.
      </div>
    );

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 w-full justify-center">
        <div className="flex flex-col items-start">
          <Label
            htmlFor="nature_prelevement"
            className="text-lg font-bold print:-mb-2"
          >
            Nature du prélèvement
          </Label>
          <Input
            id="nature_prelevement"
            value={naturePrelevement}
            onChange={(e) => setNaturePrelevement(e.target.value)}
            style={{ minWidth: 220 }}
            className="print:border-none print:bg-transparent"
          />
        </div>
        <div className="flex flex-col items-start">
          <Label htmlFor="souche" className="text-lg font-bold print:-mb-2">
            Souche étudiée
          </Label>
          <Input
            id="souche"
            value={souche}
            onChange={(e) => setSouche(e.target.value)}
            style={{ minWidth: 180 }}
            className="print:border-none print:bg-transparent"
          />
        </div>
      </div>
      <ShadTable>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Dénomination</TableHead>
            <TableHead className="text-center">S</TableHead>
            <TableHead className="text-center">I</TableHead>
            <TableHead className="text-center">R</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {atbs.map((atb, idx) => (
            <TableRow
              key={atb.id}
              className={idx % 2 === 0 ? "bg-muted/50" : ""}
            >
              <TableCell>{atb.name}</TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="print:hidden"
                  checked={!!localSIR[atb.id]?.S}
                  onCheckedChange={() => handleCheckbox(atb.id, "S")}
                />
                <p className="hidden print:inline">
                  {localSIR[atb.id]?.S && <>S</>}
                </p>
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  className="print:hidden"
                  checked={!!localSIR[atb.id]?.I}
                  onCheckedChange={() => handleCheckbox(atb.id, "I")}
                />
                <p className="hidden print:inline">
                  {localSIR[atb.id]?.I && <>I</>}
                </p>
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  checked={!!localSIR[atb.id]?.R}
                  onCheckedChange={() => handleCheckbox(atb.id, "R")}
                  className="print:hidden"
                />
                <p className="hidden print:inline">
                  {localSIR[atb.id]?.R && <>R</>}
                </p>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </ShadTable>
      <div className="mt-2 text-sm  font-semibold text-center">
        S = sensible &nbsp; | &nbsp; I = intermédiaire &nbsp; | &nbsp; R =
        résistant
      </div>
      <div className="flex flex-col items-center mt-4 print:hidden">
        <Button disabled={saving} onClick={handleSave}>
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </Button>
        {saveStatus === "success" && (
          <span className="text-green-600 mt-2 print:hidden">
            Modifications enregistrées !
          </span>
        )}
        {saveStatus === "error" && (
          <span className="text-red-600 mt-2 print:hidden">
            Erreur lors de l'enregistrement.
          </span>
        )}
      </div>
      <div className="mt-4">
        <Footer date={new Date().toISOString() || ""} />
      </div>
    </div>
  );
};

export default ATBPage;
