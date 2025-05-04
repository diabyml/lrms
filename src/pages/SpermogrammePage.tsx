/* eslint-disable @typescript-eslint/no-unused-vars */

// no typescript check

import "./Spermogramme.css";

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
const PlaceholderPage: React.FC = () => {
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

        <div className="flex items-center justify-end  print:hidden">
          <Button onClick={handlePrint} className="">
            Imprimer
          </Button>
        </div>

        <SpermogrammeReport />
      </div>
      {/* End Report Content Wrapper */}
    </div> // End main container div
  );
};

const SpermogrammeReport = () => {
  return (
    <>
      <div className="p-4 space-y-1">
        <ReportHeader />

        <SampleId />

        {/* section 2  patient details */}
        <SectionContainer>
          <PatientDetailsTable />
        </SectionContainer>
        {/* section3  */}
        <SectionContainer>
          {/* sample details */}
          <div className="flex flex-wrap items-center gap-6">
            <ReportPill label="Délai d'abstinence" value="3 (j)" />
            <ReportPill label="Lieu de Recueil" value="Laboratoire" />
            <ReportPill label="Mode de Recueil" value="Masturbation" />
          </div>
          <div className="grid grid-cols-3 gap-1 pt-1 ">
            <ReportCard label="Volume" value="1 ml" ref="VN: 1.5 - 6 ml" />
            <ReportCard label="pH" value="-" ref="VN: 7.2 - 8.5" />
            <ReportCard label="Viscosité" value="Normale" />
            <ReportCard label="Couleur" value="Normale" />
            <ReportCard label="Odeur" value="Normale" />
          </div>
          <div className="grid grid-cols-2 pt-1 gap-2">
            <ReportCard label="Agglutinats spontanés" value="Absence" />
            <ReportCard label="Agrégats multiples" value="Absence" />
          </div>
        </SectionContainer>
        <SectionContainer>
          <div className="flex items-center justify-between">
            <Text type="section">
              MOBILITÉ DES SPERMATOZOÏDES APRÈS 1 HEURE
            </Text>
            <Pill>
              <Text type="text">Normale [a+b+c] ≥ 40%</Text>
            </Pill>
          </div>
          <div className="grid grid-cols-2 gap-1 ">
            <ReportCard
              label="Rapides et progressifs (a)"
              value="15%"
              ref="VN:Vitesse > 25 ms"
            />
            <ReportCard
              label="Lents et progressifs (b)"
              value="15%"
              ref="VN:Vitesse < 25 ms"
            />
            <ReportCard label="Mobiles sur place (c)" value="5%" />
            <ReportCard label="Immobiles (d)" value="80%" />
          </div>
        </SectionContainer>
        <SectionContainer>
          <div className="flex items-center gap-2">
            <Text type="section">CULOT DE CENTRIFUGATION:</Text>
            <Text type="text">AUCUN SPERMATOZOIDE OBSERVÉ</Text>
          </div>
          <Text type="section">
            NUMÉRATION/CONCENTRATION DE SPERMATOZOÏDES PAR MILLILITRE DE SPERME
          </Text>
          <NumerationTabale />
          <Text type="text">
            Identification des cellules rondes: Cellules épithéliales
          </Text>
        </SectionContainer>
        <SectionContainer>
          <Text type="section">VITALITE ou Test de Williams</Text>
          <div className="grid grid-cols-2 gap-2">
            <ReportCard
              label="% de spermatozoïdes Vivants"
              value="40%"
              ref="VN: ≥ 58%"
            />
            <ReportCard label="% de spermatozoïdes Morts" value="60%" />
          </div>
        </SectionContainer>
        <SectionContainer>
          <Text type="section">
            SPERMOCYTOGRAMME (Critères de David et Kruger)
          </Text>
          <SpermoCytogrammeTable />
        </SectionContainer>
        <div className="flex items-center justify-between">
          <Text type="section" className="uppercase">
            Conclusion:{" "}
          </Text>
          <Text type="text">Le Biologiste</Text>
        </div>
        <ReportFooter />
      </div>
    </>
  );
};

interface TextProps {
  children: React.ReactNode;
  type: "header" | "section" | "subSection" | "title " | "text";
  className?: string;
}
const Text: React.FC<TextProps> = ({ children, type, className }) => {
  // medical: {
  // 				primary: '#9b87f5',
  // 				secondary: '#7E69AB',
  // 				light: '#E5DEFF',
  // 				dark: '#1A1F2C',
  // 			},
  return (
    <span
      className={cn(
        "inline-block text-base leading-4",
        type === "header" &&
          "font-bold print:text-[14pt] text-[#9b87f5] print:text-black",
        type === "section" &&
          " print:text-[10pt] text-[#9b87f5] print:text-black font-bold",
        type === "text" && "font-normal print:text-[9pt]",
        className
      )}
    >
      {children}
    </span>
  );
};

function Pill({
  children,
  primary,
  bg,
}: {
  children: React.ReactNode;
  primary?: boolean;
  bg?: boolean;
}) {
  return (
    <div
      className={`border border-slate-${
        primary ? 300 : 200
      } rounded-full px-2  ${bg ? `bg-slate-50` : ""}`}
    >
      {children}
    </div>
  );
}

function ReportCard({
  label,
  value,
  ref,
}: {
  label: string;
  value: string;
  ref?: string;
}) {
  return (
    <div className="bg-gray-50 px-2 rounded-lg">
      {ref ? (
        <>
          <div className="flex items-center justify-between py-1">
            <Text type="text">{label}</Text>

            <Pill>
              <Text type="text">{ref}</Text>
            </Pill>
          </div>
          <Text type="text" className="font-bold">
            {value}
          </Text>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 py-1">
            <Text type="text">{label}:</Text>
            <Text type="text">{value}</Text>
          </div>
        </>
      )}
    </div>
  );
}

function ReportPill({ label, value }: { label: string; value: string }) {
  return (
    <Pill>
      <div className="flex items-center gap-2 ml-1">
        <Text type="text" className="text-muted-foreground leading-5">
          {label}:
        </Text>
        <Text type="text" className="font-bold leading-5">
          {value}
        </Text>
      </div>
    </Pill>
  );
}

interface ReportTableProps {
  columns: string[];
  data: unknown[];
  borderVisible?: boolean;
}

function ReportTable({
  columns,
  data,
  borderVisible = true,
}: ReportTableProps) {
  return (
    <div className={`${borderVisible ? "border-visible" : "border-none"}`}>
      <table className="w-full  ">
        <thead>
          <tr className="text-left">
            {columns.map((column, index) => (
              <th key={index}>
                <Text type="text" className="font-bold">
                  {column}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {columns.map((column, index) => (
                <td key={index}>
                  <Text type="text">{row[column]}</Text>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PatientDetailsTable() {
  return (
    <div className="border-none">
      <table className="w-full  ">
        <thead>
          <tr className="text-left">
            <th>
              <Text type="text" className="text-muted-foreground">
                Prénom et Nom
              </Text>
            </th>
            <th>
              <Text type="text" className="text-muted-foreground">
                Âge
              </Text>
            </th>
            <th>
              <Text type="text" className="text-muted-foreground">
                Profession
              </Text>
            </th>
            <th>
              <Text type="text" className="text-muted-foreground">
                Résidence
              </Text>
            </th>
            <th>
              <Text type="text" className="text-muted-foreground">
                Ethnie
              </Text>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-left">
            <td>
              <Text type="text" className="font-bold">
                Naouma TRAORE
              </Text>
            </td>
            <td>
              <Text type="text" className="font-bold">
                - ans
              </Text>
            </td>
            <td>
              <Text type="text" className="font-bold">
                -
              </Text>
            </td>
            <td>
              <Text type="text" className="font-bold">
                -
              </Text>
            </td>
            <td>
              <Text type="text" className="font-bold">
                -
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ReportHeader() {
  return (
    <div className="flex flex-col items-center border border-slate-300 rounded-lg">
      <Text type="header" className=" text-center tracking-wider pt-2 ">
        DÉCLIC SANTÉ
      </Text>
      <Text type="text">
        MEDINA COURA RUE: 1 PORTE: 28 BAMAKO - MALI TEL: 92906964/67737350
      </Text>
      <Text type="text">LABORATOIRE - ECHOGRAPHIES - CONSULTATIONS</Text>
    </div>
  );
}

function SampleId() {
  const date = new Date();
  const year = date.getFullYear();
  const day = date.getDate();
  // get month name in french
  const month = date.getMonth();

  const monthNames = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];

  const monthName = monthNames[month];

  return (
    <div className="flex items-center justify-between">
      <Text type="section" className="uppercase">
        Spermogramme {year}
      </Text>
      <Pill bg>
        <Text type="text">
          Nº: 022/24 du {day} {monthName}
        </Text>
      </Pill>
    </div>
  );
}

function ReportFooter() {
  return (
    <>
      <div className="flex flex-col items-center">
        <Text type="text" className="font-bold -ml-[200px]">
          OLIGO-ASTHENO-NECROZOOSPERMIE SEVERE
        </Text>
        <Text type="text" className="font-bold -ml-[200px]">
          HYPOSPERMIE
        </Text>
        <Text type="text" className="font-bold -ml-[200px]">
          INTERET DE BILAN INFECTIEUX
        </Text>
        <Text type="text" className="font-bold -ml-[200px]">
          EXAMEN DE CONTROLE A REALISER DANS 03 MOIS
        </Text>
      </div>
      {/* <div className="flex justify-end">
        <Text type="text">Le Biologiste</Text>
      </div> */}
    </>
  );
}

interface SectionContainerProps {
  children: React.ReactNode;
}
const SectionContainer = ({ children }: SectionContainerProps) => {
  return (
    <div className="border border-slate-300 rounded-lg px-2 py-1">
      {children}
    </div>
  );
};

function NumerationTabale() {
  const columns = ["Paramètres", "Résultats", "Ref."];
  const data = [
    {
      Paramètres: "Nombre de Spermatozoïdes / millilitre de sperme",
      Résultats: "5 millions",
      "Ref.": "> 15 millions/ml",
    },
    {
      Paramètres: "Nombre de Spermatozoïdes dans l'éjaculat",
      Résultats: "+",
      "Ref.": "≥  39.10^6 / ml",
    },
    {
      Paramètres: "Cellules rondes",
      Résultats: "+",
      "Ref.": "≤ 5000 / ml",
    },
    {
      Paramètres: "Leucocytes",
      Résultats: "+",
      "Ref.": "≤ 10^6 / ml",
    },
  ];

  return <ReportTable columns={columns} data={data} />;
}

function SpermoCytogrammeTable() {
  const columns = ["Paramètres", "Résultats", "Ref."];
  const data = [
    {
      Paramètres: "% de spermatozoïdes de formes typiques",
      Résultats: "-%",
      "Ref.": "≥ 4%",
    },
    {
      Paramètres: "% de spermatozoïdes présentant une anomalie de la tête",
      Résultats: "-%",
      "Ref.": "-",
    },
    {
      Paramètres:
        "% de spermatozoïdes présentant une anomalie de la pièce intermédiaire",
      Résultats: "-%",
      "Ref.": "-",
    },
    {
      Paramètres: "% de spermatozoïdes présentant une anomalie de la flagelle",
      Résultats: "-%",
      "Ref.": "-",
    },
    {
      Paramètres: "% de spermatozoïdes de formes immatures",
      Résultats: "-%",
      "Ref.": "-",
    },
  ];

  return <ReportTable columns={columns} data={data} />;
}

export default PlaceholderPage;
