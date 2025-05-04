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
const AnapathPage: React.FC = () => {
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
            </CardContent>
          </Card>
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

        <MainPageContent resultId={resultId as string} />
      </div>
      {/* End Report Content Wrapper */}
    </div> // End main container div
  );
};

interface Props {
  resultId: string;
}

export function MainPageContent({ resultId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anapath, setAnapath] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Local state for editable fields
  const [fields, setFields] = useState({
    diagnostic_clinique: "",
    biopsie_chirurgicale: "",
    fixateur_utilise: "",
    etude_macroscopique: "",
    etude_histologique: "",
    conclusion: "",
    bottom_text: "",
  });

  // Local state for editable signature fields (city/date and doctor)
  const [signatureFields, setSignatureFields] = useState({
    cityDate: `BAMAKO, LE ${format(new Date(), "dd/MM/yyyy")}`,
    doctor: "Dr, Bourama COULIBALY",
  });

  // Load signature fields from localStorage on mount
  useEffect(() => {
    const storedCityDate = localStorage.getItem("anapath_city_date");
    const storedDoctor = localStorage.getItem("anapath_doctor");
    setSignatureFields({
      cityDate: storedCityDate || "BAMAKO, LE 4/06/2024",
      doctor: storedDoctor || "Dr, Bourama COULIBALY",
    });
  }, []);

  // Save signature fields to localStorage on change
  useEffect(() => {
    localStorage.setItem("anapath_city_date", signatureFields.cityDate);
    localStorage.setItem("anapath_doctor", signatureFields.doctor);
  }, [signatureFields]);

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSignatureFields((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    async function fetchOrCreateAnapath() {
      setLoading(true);
      setError(null);
      // 1. Try to fetch existing entry for this resultId
      const { data, error } = await supabase
        .from("anapath")
        .select("*")
        .eq("result_id", resultId)
        .maybeSingle();
      if (error) {
        setError("Erreur lors du chargement: " + error.message);
        setLoading(false);
        return;
      }
      if (data) {
        setAnapath(data);
        setFields({
          diagnostic_clinique: data.diagnostic_clinique || "",
          biopsie_chirurgicale: data.biopsie_chirurgicale || "",
          fixateur_utilise: data.fixateur_utilise || "",
          etude_macroscopique: data.etude_macroscopique || "",
          etude_histologique: data.etude_histologique || "",
          conclusion: data.conclusion || "",
          bottom_text: data.bottom_text || "",
        });
        setLoading(false);
        return;
      }
      // 2. If not found, try to insert
      const { data: newData, error: insertError } = await supabase
        .from("anapath")
        .insert([{ result_id: resultId }])
        .select()
        .maybeSingle();
      if (insertError) {
        // If duplicate key, fetch again (race condition)
        if (
          insertError.code === "23505" ||
          (insertError.message &&
            insertError.message.includes("duplicate key value"))
        ) {
          const { data: retryData, error: retryError } = await supabase
            .from("anapath")
            .select("*")
            .eq("result_id", resultId)
            .maybeSingle();
          if (retryError) {
            setError(
              "Erreur lors du chargement après duplication: " +
                retryError.message
            );
          } else if (retryData) {
            setAnapath(retryData);
            setFields({
              diagnostic_clinique: retryData.diagnostic_clinique || "",
              biopsie_chirurgicale: retryData.biopsie_chirurgicale || "",
              fixateur_utilise: retryData.fixateur_utilise || "",
              etude_macroscopique: retryData.etude_macroscopique || "",
              etude_histologique: retryData.etude_histologique || "",
              conclusion: retryData.conclusion || "",
              bottom_text: retryData.bottom_text || "",
            });
          } else {
            setError(
              "Erreur inattendue lors de la récupération après duplication."
            );
          }
        } else {
          setError("Erreur lors de la création: " + insertError.message);
        }
      } else {
        setAnapath(newData);
        setFields({
          diagnostic_clinique: newData.diagnostic_clinique || "",
          biopsie_chirurgicale: newData.biopsie_chirurgicale || "",
          fixateur_utilise: newData.fixateur_utilise || "",
          etude_macroscopique: newData.etude_macroscopique || "",
          etude_histologique: newData.etude_histologique || "",
          conclusion: newData.conclusion || "",
          bottom_text: newData.bottom_text || "",
        });
      }
      setLoading(false);
    }
    if (resultId) fetchOrCreateAnapath();
  }, [resultId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!anapath) return;
    setSaving(true);
    setSaveMsg(null);
    const { error } = await supabase
      .from("anapath")
      .update(fields)
      .eq("id", anapath.id);
    setSaving(false);
    if (error) {
      setSaveMsg("Erreur lors de la sauvegarde: " + error.message);
    } else {
      setSaveMsg("Modifications enregistrées !");
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!anapath) return <div>Entrée Anapath non trouvée.</div>;

  return (
    <>
      {/* Print Button (hidden when printing) */}
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="mr-2 h-4 w-4" /> Imprimer
        </Button>
      </div>
      <div
        className="w-full mx-auto bg-white p-8 rounded shadow print:bg-white print:shadow-none print:p-0 print:max-w-full print:text-black print:font-serif print:leading-relaxed print:text-[16pt] print:rounded-none"
        style={{ minHeight: "29.7cm", minWidth: "21cm" }}
      >
        <h1 className="text-2xl font-bold text-center mb-6 uppercase print:text-[20pt] print:mb-8 print:font-bold">
          EXAMEN ANATOMO-PATHOLOGIQUE
        </h1>
        <div className="mb-4 print:mb-6">
          <h2 className="font-bold mb-2 print:mb-1 print:text-[17pt] uppercase">
            Résumé de l’Observation Clinique :
          </h2>
          <div className="ml-4 space-y-2 print:ml-0 print:space-y-1">
            <div>
              Diagnostic Clinique :
              <span className="print:inline print:ml-1">
                <span className="hidden print:inline print:text-[16pt]">
                  {fields.diagnostic_clinique}
                </span>
                <input
                  name="diagnostic_clinique"
                  value={fields.diagnostic_clinique}
                  onChange={handleChange}
                  className="border-b border-gray-300 focus:outline-none w-full print:hidden bg-transparent"
                  placeholder="Diagnostic Clinique"
                  disabled={saving}
                />
              </span>
            </div>
            <div>
              Biopsie Chirurgicale :
              <span className="print:inline print:ml-1">
                <span className="hidden print:inline print:text-[16pt]">
                  {fields.biopsie_chirurgicale}
                </span>
                <input
                  name="biopsie_chirurgicale"
                  value={fields.biopsie_chirurgicale}
                  onChange={handleChange}
                  className="border-b border-gray-300 focus:outline-none w-full print:hidden bg-transparent"
                  placeholder="Biopsie Chirurgicale"
                  disabled={saving}
                />
              </span>
            </div>
            <div>
              Fixateur Utilisé :
              <span className="print:inline print:ml-1">
                <span className="hidden print:inline print:text-[16pt]">
                  {fields.fixateur_utilise}
                </span>
                <input
                  name="fixateur_utilise"
                  value={fields.fixateur_utilise}
                  onChange={handleChange}
                  className="border-b border-gray-300 focus:outline-none w-full print:hidden bg-transparent"
                  placeholder="Fixateur Utilisé"
                  disabled={saving}
                />
              </span>
            </div>
          </div>
        </div>
        <div className="mb-4 print:mb-6">
          <h2 className="font-bold mb-2 uppercase print:mb-1 print:text-[17pt]">
            COMPTE –RENDU HISTOPATHOLOGIQUE :
          </h2>
          <div className="ml-4 space-y-2 print:ml-0 print:space-y-1">
            <div>
              <span className="font-bold print:text-[16pt]">
                I. Etude Macroscopique :
              </span>
              <span className="print:inline print:ml-1">
                <span className="hidden print:inline print:text-[16pt]">
                  {fields.etude_macroscopique}
                </span>
                <textarea
                  name="etude_macroscopique"
                  value={fields.etude_macroscopique}
                  onChange={handleChange}
                  className="border-b border-gray-300 focus:outline-none w-full print:hidden bg-transparent"
                  placeholder="Etude Macroscopique"
                  rows={2}
                  disabled={saving}
                />
              </span>
            </div>
            <div>
              <span className="font-bold print:text-[16pt]">
                2-Etude Histologique :
              </span>
              <span className="print:inline print:ml-1">
                <span className="hidden print:inline print:text-[16pt]">
                  {fields.etude_histologique}
                </span>
                <textarea
                  name="etude_histologique"
                  value={fields.etude_histologique}
                  onChange={handleChange}
                  className="border-b border-gray-300 focus:outline-none w-full print:hidden bg-transparent"
                  placeholder="Etude Histologique"
                  rows={2}
                  disabled={saving}
                />
              </span>
            </div>
            <div>
              <span className="font-bold underline print:text-[16pt]">
                3-Conclusion :
              </span>
              <span className="print:inline print:ml-1">
                <span className="hidden print:inline print:text-[16pt]">
                  {fields.conclusion}
                </span>
                <textarea
                  name="conclusion"
                  value={fields.conclusion}
                  onChange={handleChange}
                  className="border-b border-gray-300 focus:outline-none w-full print:hidden bg-transparent"
                  placeholder="Conclusion"
                  rows={2}
                  disabled={saving}
                />
              </span>
            </div>
            <div>
              <span className="print:inline print:ml-1">
                <span className="hidden print:inline print:text-[16pt]">
                  {fields.bottom_text}
                </span>
                <textarea
                  name="bottom_text"
                  value={fields.bottom_text}
                  onChange={handleChange}
                  className="border-b border-gray-300 focus:outline-none w-full print:hidden bg-transparent"
                  placeholder="OLGA/OLGIM..."
                  rows={1}
                  disabled={saving}
                />
              </span>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-end print:mt-12 print:items-end">
          <span className="print:text-[15pt]">
            <span className="hidden print:inline">
              {signatureFields.cityDate}
            </span>
            <input
              name="cityDate"
              value={signatureFields.cityDate}
              onChange={handleSignatureChange}
              className="border-b border-gray-300 focus:outline-none bg-transparent w-auto text-right print:hidden"
            />
          </span>
          <span className="print:text-[15pt]">
            <span className="hidden print:inline">
              {signatureFields.doctor}
            </span>
            <input
              name="doctor"
              value={signatureFields.doctor}
              onChange={handleSignatureChange}
              className="border-b border-gray-300 focus:outline-none bg-transparent w-auto text-right print:hidden"
            />
          </span>
        </div>
        {/* Save feedback and button */}
        <div className="mt-6 flex items-center gap-4 print:hidden">
          <Button onClick={handleSave} disabled={saving} variant="default">
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
          {saveMsg && (
            <span
              className={
                saveMsg.startsWith("Erreur") ? "text-red-500" : "text-green-600"
              }
            >
              {saveMsg}
            </span>
          )}
        </div>
      </div>
      {/* Optional: page break after content for print */}
      <div className="print:block hidden page-break-after"></div>
    </>
  );
}

export default AnapathPage;
