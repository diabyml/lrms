// src/pages/PatientDetailPage.tsx

import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom"; // Import useNavigate
import { supabase, Tables } from "../lib/supabaseClient";

// Import shadcn/ui components and icons
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge"; // For result status
import {
  ArrowLeft,
  Edit,
  PlusCircle,
  User,
  CalendarDays,
  Phone,
  FileText,
  AlertCircle,
  Info,
  ListChecks,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// Define types
type Patient = Tables<"patient">;
// Type for the result including the joined doctor data
type PatientResultWithDoctor = Pick<
  Tables<"patient_result">,
  "id" | "result_date" | "status"
> & {
  doctor: Pick<Tables<"doctor">, "full_name"> | null; // Allow doctor to be null if join fails? Handle defensively
};

// Helper function to format status with appropriate badge variant
const getStatusBadgeVariant = (
  status: string | null
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status?.toLowerCase()) {
    case "completed":
      return "default"; // Or 'success' if you add a custom variant
    case "in progress":
      return "secondary";
    case "pending":
      return "outline";
    default:
      return "secondary";
  }
};

const PatientDetailPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate(); // Use navigate hook

  const [patient, setPatient] = useState<Patient | null>(null);
  const [results, setResults] = useState<PatientResultWithDoctor[]>([]);
  const [loadingPatient, setLoadingPatient] = useState<boolean>(true);
  const [loadingResults, setLoadingResults] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch patient details
  const fetchPatientDetails = useCallback(async () => {
    if (!patientId) return;
    setLoadingPatient(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("patient")
        .select("*")
        .eq("id", patientId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Patient non trouvé.");

      setPatient(data);
    } catch (err: unknown) {
      console.error("Erreur chargement détails patient:", err);
      setError(
        (prev) =>
          prev ||
          (err instanceof Error ? err.message : "Erreur inconnue") ||
          "Impossible de charger les détails du patient."
      ); // Set error only if not already set by other fetch
    } finally {
      setLoadingPatient(false);
    }
  }, [patientId]);

  // Fetch patient results with doctor name
  const fetchPatientResults = useCallback(async () => {
    if (!patientId) return;
    setLoadingResults(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("patient_result")
        .select(
          `
          id,
          result_date,
          status,
          doctor:doctor_id ( full_name )
        `
        )
        .eq("patient_id", patientId)
        .order("result_date", { ascending: false }); // Newest first

      if (fetchError) throw fetchError;

      setResults(data || []);
    } catch (err: unknown) {
      console.error("Erreur chargement résultats patient:", err);
      setError(
        (prev) =>
          prev ||
          (err instanceof Error ? err.message : "Erreur inconnue") ||
          "Impossible de charger les résultats du patient."
      );
    } finally {
      setLoadingResults(false);
    }
  }, [patientId]);

  // Fetch both on mount / patientId change
  useEffect(() => {
    setError(null); // Clear previous errors on new load
    const loadData = async () => {
      // Reset states if needed when patientId changes
      setPatient(null);
      setResults([]);
      setLoadingPatient(true);
      setLoadingResults(true);
      // Fetch concurrently
      await Promise.all([fetchPatientDetails(), fetchPatientResults()]);
    };
    loadData();
  }, [fetchPatientDetails, fetchPatientResults]); // Depend on the memoized fetch functions

  // --- Render Logic ---

  const isLoading = loadingPatient || loadingResults;

  // Helper function to render demographic details
  const renderDetailItem = (
    icon: React.ElementType,
    label: string,
    value: string | null | undefined
  ) => {
    const Icon = icon;
    return (
      <div className="flex items-start space-x-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-base">
            {value || (
              <span className="text-muted-foreground italic">Non spécifié</span>
            )}
          </p>
        </div>
      </div>
    );
  };

  // Main Render
  return (
    <div className="space-y-6">
      {/* Back Button and Page Title Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        {/* Back Button */}
        <div>
          <Link to="/patients">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la liste
            </Button>
          </Link>
        </div>
        {/* Edit Button (show only if patient loaded and no error) */}
        {!isLoading && patient && !error && (
          <Link to={`/patients/${patientId}/edit`}>
            <Button variant="secondary">
              <Edit className="mr-2 h-4 w-4" />
              Modifier le Patient
            </Button>
          </Link>
        )}
      </div>

      {/* Loading State for Patient Card */}
      {loadingPatient && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error &&
        !isLoading && ( // Show error only if not loading
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>
              {error}{" "}
              <Button
                variant="link"
                onClick={() => {
                  fetchPatientDetails();
                  fetchPatientResults();
                }}
                className="p-0 h-auto text-destructive-foreground underline"
              >
                Réessayer
              </Button>
            </AlertDescription>
          </Alert>
        )}

      {/* Patient Details Card (Show only if loaded and no error) */}
      {!loadingPatient && patient && !error && (
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations du Patient
            </CardTitle>
            <CardDescription>Détails démographiques.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {renderDetailItem(User, "Nom Complet", patient.full_name)}
            {renderDetailItem(Info, "ID Unique", patient.patient_unique_id)}
            {renderDetailItem(
              CalendarDays,
              "Date de Naissance",
              patient.date_of_birth
                ? format(parseISO(patient.date_of_birth), "PPP", { locale: fr })
                : null
            )}
            {renderDetailItem(Info, "Genre", patient.gender)}
            {renderDetailItem(Phone, "Téléphone", patient.phone)}
          </CardContent>
        </Card>
      )}

      {/* Test Results Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ListChecks className="h-6 w-6" />
            Historique des Résultats
          </h2>
          {/* Add Result Button (show only if patient loaded and no error) */}
          {!isLoading && patient && !error && (
            <Button
              onClick={() => navigate(`/patients/${patientId}/results/new`)}
            >
              {" "}
              {/* Navigate to create result page */}
              <PlusCircle className="mr-2 h-4 w-4" />
              Ajouter un Résultat
            </Button>
          )}
        </div>

        {/* Loading State for Results Table */}
        {loadingResults && (
          <div className="border rounded-lg overflow-hidden bg-background">
            <Skeleton className="h-12 w-full" /> {/* Header */}
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {/* Results Table (Show only if not loading and no general error - specific results errors handled internally) */}
        {!loadingResults && !error && (
          <div className="border rounded-lg overflow-hidden bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Date du Résultat</TableHead>
                  <TableHead>Médecin Prescripteur</TableHead>
                  <TableHead className="w-[130px]">Statut</TableHead>
                  <TableHead className="text-right w-[150px]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length > 0 ? (
                  results.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell>
                        {result.result_date
                          ? format(
                              parseISO(result.result_date),
                              "PPP 'à' HH:mm",
                              { locale: fr }
                            )
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {result.doctor?.full_name || (
                          <span className="italic text-muted-foreground">
                            Inconnu
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(result.status)}>
                          {/* Capitalize status for display */}
                          {result.status?.charAt(0).toUpperCase() +
                            result.status?.slice(1) || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/results/${result.id}`}>
                          {" "}
                          {/* Link to specific result detail page */}
                          <Button variant="outline" size="sm">
                            <FileText className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />{" "}
                            {/* Responsive Icon */}
                            <span className="hidden sm:inline">
                              Voir Résultat
                            </span>{" "}
                            {/* Hide text on xs */}
                            <span className="sm:hidden">Voir</span>{" "}
                            {/* Show shorter text on xs */}
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Aucun résultat trouvé pour ce patient.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDetailPage;
