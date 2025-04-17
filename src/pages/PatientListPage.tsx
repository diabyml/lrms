// src/pages/PatientListPage.tsx

import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient";

// Import shadcn/ui components and icons
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  PlusCircle,
  Search,
  Users,
  AlertCircle,
  DatabaseZap,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react"; // Added pagination icons
import { useDebounce } from "../hooks/useDebounce"; // Assuming a debounce hook (implementation below)
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

type Patient = Tables<"patient">;
type Doctor = Tables<"doctor">;
const ITEMS_PER_PAGE = 10; // Define how many items per page

const PatientListPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorFilter, setDoctorFilter] = useState<string>("");

  // Debounce the search term to avoid excessive API calls while typing
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // 300ms delay

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Fetch doctors for filter
  useEffect(() => {
    const fetchDoctors = async () => {
      const { data, error } = await supabase
        .from("doctor")
        .select("id, full_name")
        .order("full_name", { ascending: true });
      if (!error) setDoctors(data || []);
    };
    fetchDoctors();
  }, []);

  // Fetch patients data with pagination and search
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase.from("patient").select("*", { count: "exact" }); // Request total count

      // Apply search filter if debouncedSearchTerm exists
      if (debouncedSearchTerm) {
        const searchPattern = `%${debouncedSearchTerm}%`; // Prepare pattern for ILIKE
        query = query.or(
          `full_name.ilike.${searchPattern},patient_unique_id.ilike.${searchPattern}`
        );
      }

      // Apply doctor filter if selected (indirectly via patient_result)
      if (doctorFilter) {
        // 1. Get all patient_ids for this doctor from patient_result
        const { data: resultRows, error: resultError } = await supabase
          .from("patient_result")
          .select("patient_id")
          .eq("doctor_id", doctorFilter);
        if (resultError) {
          console.error("Supabase error while fetching patient_result:", resultError);
          throw resultError;
        }
        const patientIds = (resultRows || []).map((row) => row.patient_id);
        if (patientIds.length === 0) {
          setPatients([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
        query = query.in("id", patientIds);
      }

      // Apply ordering and pagination range
      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data, error: dbError, count } = await query;

      if (dbError) {
        // Log error for debugging
        console.error("Supabase error while fetching patients:", dbError);
        throw dbError;
      }

      setPatients(data || []);
      setTotalCount(count ?? 0); // Update total count
    } catch (err: unknown) {
      console.error("Erreur lors de la récupération des patients:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors du chargement des patients."
      );
      setPatients([]);
      setTotalCount(0); // Reset count on error
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, doctorFilter]); // Depend on currentPage, debounced search term, and doctor filter

  // useEffect to fetch data when page or search term changes
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]); // fetchPatients includes currentPage, debouncedSearchTerm, doctorFilter

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, doctorFilter]);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  // Delete Patient Handler
  const handleDelete = async () => {
    if (!patientToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("patient")
        .delete()
        .eq("id", patientToDelete.id);
      if (deleteError) throw deleteError;
      setPatients((prev) => prev.filter((pat) => pat.id !== patientToDelete.id));
      setTotalCount((prev) => prev - 1);
      setPatientToDelete(null);
    } catch (err: unknown) {
      setError(
        (err instanceof Error ? err.message : "") ||
          "Erreur lors de la suppression du patient."
      );
    } finally {
      setDeleting(false);
    }
  };

  // --- Render Logic ---

  return (
    <div className="space-y-6">
      {/* Page Header and Add Button (same as before) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* ... */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6" />
          Gestion des Patients
        </h1>
        <Link to="/patients/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter un Patient
          </Button>
        </Link>
      </div>

      {/* Search Input (same as before) */}
      <div className="relative">
        {/* ... */}
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Rechercher par nom ou ID unique..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full md:w-1/3"
        />
      </div>

      {/* Doctor Filter Dropdown */}
      <div className="flex items-center gap-2 pt-2">
        <Label htmlFor="doctor-filter">Filtrer par médecin :</Label>
        <select
          id="doctor-filter"
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">Tous les médecins</option>
          {doctors.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        // ... Skeleton remains the same ...
        <div className="space-y-2 pt-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        // ... Error Alert remains the same ...
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur de Chargement</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Data Table Area */}
      {!loading && !error && (
        <div className="space-y-4">
          {" "}
          {/* Add space for pagination controls */}
          <div className="border rounded-lg overflow-hidden bg-background">
            <Table>
              <TableHeader>
                {/* ... TableHeader remains the same ... */}
                <TableRow>
                  <TableHead className="w-[150px]">ID Unique</TableHead>
                  <TableHead>Nom Complet</TableHead>
                  <TableHead>Date de Naissance</TableHead>
                  <TableHead className="hidden md:table-cell">Genre</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Téléphone
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.length > 0 ? (
                  patients.map((patient) => (
                    // ... TableRow mapping remains the same ...
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">
                        {patient.patient_unique_id}
                      </TableCell>
                      <TableCell>{patient.full_name}</TableCell>
                      <TableCell>
                        {patient.date_of_birth
                          ? new Date(patient.date_of_birth).toLocaleDateString(
                              "fr-FR"
                            )
                          : "N/A"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {patient.gender || "N/A"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {patient.phone || "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/patients/${patient.id}`}>
                          <Button variant="outline" size="sm">
                            Voir Détails
                          </Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="ml-2"
                              title="Supprimer le patient"
                              onClick={() => setPatientToDelete(patient)}
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Supprimer</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer ce patient ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Voulez-vous vraiment supprimer ce patient ?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setPatientToDelete(null)} disabled={deleting}>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  // ... No Data message remains the same ...
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {searchTerm ? (
                        "Aucun patient ne correspond à votre recherche."
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <DatabaseZap className="h-8 w-8 text-muted-foreground/50" />
                          Aucun patient trouvé. Commencez par en ajouter un.
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/* --- Pagination Controls --- */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between space-x-2 pt-2">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} sur {totalPages} ({totalCount}{" "}
                {totalCount === 1 ? "résultat" : "résultats"})
              </span>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1 sm:mr-2" />{" "}
                  {/* Adjusted margin */}
                  <span className="hidden sm:inline">Précédent</span>{" "}
                  {/* Hide text on xs screens */}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                >
                  <span className="hidden sm:inline">Suivant</span>{" "}
                  {/* Hide text on xs screens */}
                  <ChevronRight className="h-4 w-4 ml-1 sm:ml-2" />{" "}
                  {/* Adjusted margin */}
                </Button>
              </div>
            </div>
          )}
          {/* --- End Pagination Controls --- */}
        </div>
      )}
    </div>
  );
};

export default PatientListPage;
