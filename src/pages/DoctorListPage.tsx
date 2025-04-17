// src/pages/DoctorListPage.tsx

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient"; // Adjust path if needed
import { useDebounce } from "../hooks/useDebounce"; // Adjust path if needed

// Import shadcn/ui components and icons
import { Button } from "@/components/ui/button"; // Adjust path
import { Input } from "@/components/ui/input"; // Adjust path
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Adjust path
import { Skeleton } from "@/components/ui/skeleton"; // Adjust path
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path
import {
  PlusCircle,
  Search,
  Stethoscope,
  AlertCircle,
  DatabaseZap,
  Edit,
  Trash2,
} from "lucide-react"; // Icons
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

// Define Type
type Doctor = Tables<"doctor">;

const DoctorListPage: React.FC = () => {
  // State
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch Doctors
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("doctor")
        .select("*")
        .order("full_name", { ascending: true }); // Order by name

      if (dbError) throw dbError;
      setDoctors(data || []);
    } catch (err: unknown) {
      console.error("Erreur lors de la récupération des médecins:", err);
      setError(
        (err instanceof Error ? err.message : "") ||
          "Une erreur est survenue lors du chargement des médecins."
      );
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter doctors based on search term (client-side for MVP)
  const filteredDoctors = useMemo(() => {
    if (!debouncedSearchTerm) {
      return doctors; // Return all if no search term
    }
    const lowerCaseSearch = debouncedSearchTerm.toLowerCase();
    return doctors.filter(
      (doctor) =>
        doctor.full_name.toLowerCase().includes(lowerCaseSearch) ||
        (doctor.hospital &&
          doctor.hospital.toLowerCase().includes(lowerCaseSearch)) // Optional: search hospital too
    );
  }, [doctors, debouncedSearchTerm]);

  // Delete Doctor Handler
  const handleDelete = async () => {
    if (!doctorToDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("doctor")
        .delete()
        .eq("id", doctorToDelete.id);
      if (deleteError) throw deleteError;
      setDoctors((prev) => prev.filter((doc) => doc.id !== doctorToDelete.id));
      setDoctorToDelete(null);
    } catch (err: unknown) {
      setError(
        (err instanceof Error ? err.message : "") ||
          "Erreur lors de la suppression du médecin."
      );
    } finally {
      setDeleting(false);
    }
  };

  // --- Render Logic ---

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Stethoscope className="h-6 w-6" />
          Gestion des Médecins
        </h1>
        <Link to="/doctors/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter un Médecin
          </Button>
        </Link>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Rechercher par nom ou hôpital..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full md:w-1/3 h-10" // Standard height
          disabled={loading}
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="border rounded-lg">
          <Skeleton className="h-12 w-full rounded-t-lg" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur de Chargement</AlertTitle>
          <AlertDescription>
            {error}{" "}
            <Button
              variant="link"
              onClick={fetchData}
              className="p-0 h-auto text-destructive-foreground underline"
            >
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Data Table (or No Data message) */}
      {!loading && !error && (
        <div className="border rounded-lg overflow-hidden bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom Complet</TableHead>
                <TableHead className="w-[200px]">Téléphone</TableHead>
                <TableHead className="w-[300px]">Hôpital / Clinique</TableHead>
                <TableHead className="text-right w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDoctors.length > 0 ? (
                filteredDoctors.map((doctor) => (
                  <TableRow key={doctor.id}>
                    <TableCell className="font-medium">
                      {doctor.full_name}
                    </TableCell>
                    <TableCell>
                      {doctor.phone || (
                        <span className="italic text-muted-foreground">
                          N/A
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {doctor.hospital || (
                        <span className="italic text-muted-foreground">
                          N/A
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/doctors/${doctor.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">Modifier</span>
                          <span className="sm:hidden">Éditer</span>
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="ml-2"
                            title="Supprimer le médecin"
                            onClick={() => setDoctorToDelete(doctor)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Supprimer</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce médecin ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. Voulez-vous vraiment supprimer ce médecin ?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDoctorToDelete(null)} disabled={deleting}>Annuler</AlertDialogCancel>
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
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {searchTerm ? (
                      "Aucun médecin ne correspond à votre recherche."
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <DatabaseZap className="h-8 w-8 text-muted-foreground/50" />
                        Aucun médecin trouvé. Commencez par en ajouter un.
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* Add Pagination if needed later */}
        </div>
      )}
    </div>
  );
};

export default DoctorListPage;
