// src/pages/RistourneListPage.tsx

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useDebounce } from "../hooks/useDebounce";

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
import { Badge } from "@/components/ui/badge";
import {
  PlusCircle,
  Search,
  AlertCircle,
  Banknote,
  Edit,
  Trash2,
  FilterX,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// Define Types
interface Doctor {
  id: string;
  full_name: string;
  hospital: string | null;
}

interface Ristourne {
  id: string;
  doctor_id: string;
  created_date: string;
  status: RistourneStatus;
  total_fee: number;
  notes: string | null;
  doctor: Doctor;
}

type RistourneStatus = "pending" | "approved" | "paid";

const statusColors: Record<RistourneStatus, "default" | "warning" | "success"> =
{
  pending: "default",
  approved: "warning",
  paid: "success",
};

const statusLabels: Record<RistourneStatus, string> = {
  pending: "En attente",
  approved: "Approuvé",
  paid: "Payé",
};

const PAGE_SIZE = 10;

const RistourneListPage: React.FC = () => {
  // State
  const [ristournes, setRistournes] = useState<Ristourne[]>([]);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>(
    undefined
  );
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Add state for delete dialog
  const [ristourneToDelete, setRistourneToDelete] = useState<Ristourne | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add state and effect for access code modal
  const [showAccessModal, setShowAccessModal] = useState(() => {
    // Only show modal if sessionStorage does not have the access flag
    return !sessionStorage.getItem("ristourne_access_granted");
  });
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [accessCodeError, setAccessCodeError] = useState<string | null>(null);
  const [ristourneAccessCode, setRistourneAccessCode] = useState<string | null>(
    null
  );
  const [loadingAccessCode, setLoadingAccessCode] = useState(true);

  // Fetch ristourne_access_code from settings table
  useEffect(() => {
    const fetchAccessCode = async () => {
      setLoadingAccessCode(true);
      const { data, error } = await supabase
        .from("settings")
        .select("ristourne_access_code")
        .limit(1)
        .single();
      if (!error && data && data.ristourne_access_code) {
        setRistourneAccessCode(data.ristourne_access_code);
      } else {
        setRistourneAccessCode(null);
      }
      setLoadingAccessCode(false);
    };
    fetchAccessCode();
  }, []);

  // Handler for access code submit
  const handleAccessCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCodeInput === ristourneAccessCode) {
      setShowAccessModal(false);
      setAccessCodeInput("");
      setAccessCodeError(null);
      // Set session flag so modal is not shown again this session
      sessionStorage.setItem("ristourne_access_granted", "1");
    } else {
      setAccessCodeError("Code incorrect. Veuillez réessayer.");
    }
  };

  // Memoize doctor options for the combobox
  const doctorOptions = useMemo(() => {
    const options = allDoctors.map((doc) => ({
      value: doc.id,
      label: doc.full_name || "Nom Inconnu",
    }));
    // Add "Tous les médecins" option at the beginning
    return [{ value: "ALL_DOCTORS", label: "Tous les médecins" }, ...options];
  }, [allDoctors]);

  // Update the Doctor interface to make hospital optional
  interface Doctor {
    id: string;
    full_name: string;
    hospital?: string | null;
  }

  // Fetch all doctors for the dropdown
  const fetchDoctors = useCallback(async () => {
    const { data, error } = await supabase
      .from("doctor")
      .select("id, full_name")
      .order("full_name");

    if (error) {
      console.error("Erreur lors du chargement des médecins:", error);
      toast.error("Erreur de chargement des médecins", {
        description: error.message,
      });
    } else {
      setAllDoctors(data || []);
    }
  }, []);

  // Fetch ristournes with server-side filtering and sorting
  const fetchRistournes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build the base query with sorting (newest first)
      let query = supabase
        .from("ristourne")
        .select(
          `
          *,
          doctor:doctor_id (id, full_name, hospital)
        `,
          { count: "exact" }
        )
        .order("created_date", { ascending: false });

      // Apply search filter if search term exists
      // const trimmedSearchTerm = searchTerm.trim();
      // if (trimmedSearchTerm !== "") {
      //   query = query.ilike("doctor.full_name", `%${trimmedSearchTerm}%`);
      // }

      // Apply doctor filter if selected
      if (selectedDoctorId && selectedDoctorId !== "ALL_DOCTORS") {
        query = query.eq("doctor_id", selectedDoctorId);
      }

      // Apply status filter if showOnlyPending is true
      if (showOnlyPending) {
        query = query.eq("status", "pending");
      }

      // Execute the query with pagination
      const {
        data,
        error: fetchError,
        count,
      } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (fetchError) throw fetchError;

      // Data is already sorted by created_date in descending order (newest first)
      setRistournes(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Error fetching ristournes:", err);
      setError("Erreur lors du chargement des ristournes");
      toast.error("Erreur lors du chargement des ristournes");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedDoctorId, showOnlyPending, page]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  // Use debounced search term to reduce number of requests
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchRistournes();
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [fetchRistournes, debouncedSearchTerm, page]);

  // We no longer need client-side filtering as it's now done on the server
  const filteredRistournes = ristournes;

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
    }).format(amount);
  };

  const handleDelete = async () => {
    if (!ristourneToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { error } = await supabase
        .from("ristourne")
        .delete()
        .eq("id", ristourneToDelete.id);
      if (error) throw error;
      setRistourneToDelete(null);
      fetchRistournes();
    } catch (err: any) {
      setDeleteError(err.message || "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDoctorId(undefined);
    setShowOnlyPending(false);
    setPage(1);
  };

  return (
    <>
      {/* Access Code Modal */}
      <Dialog open={showAccessModal}>
        <DialogContent className="max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Code d'accès requis</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAccessCodeSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Entrer le code d'accès"
              value={accessCodeInput}
              onChange={(e) => setAccessCodeInput(e.target.value)}
              disabled={loadingAccessCode}
              autoFocus
            />
            {accessCodeError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{accessCodeError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={loadingAccessCode || !accessCodeInput}
              >
                {loadingAccessCode ? "Chargement..." : "Valider"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Main page content, only visible if access granted */}
      {!showAccessModal && (
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Banknote className="h-6 w-6" />
              Gestion des Ristournes
            </h1>
            <Link to="/ristournes/new">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nouvelle Ristourne
              </Button>
            </Link>
          </div>

          {/* Search and Filter */}
          <div className="mb-6 p-4 border rounded-lg bg-slate-50 shadow">
            <div className="flex  flex-col md:flex-row gap-4 items-center">
              {/* <div className="w-full md:w-1/3 space-y-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Rechercher par nom de médecin..."
                    className="pl-9 bg-white"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div> */}

              <div className="w-full md:w-1/3 space-y-1">
                <Combobox
                  options={doctorOptions}
                  value={selectedDoctorId || "ALL_DOCTORS"}
                  onValueChange={(value) => {
                    setSelectedDoctorId(
                      value === "ALL_DOCTORS" ? undefined : value
                    );
                    setPage(1);
                  }}
                  placeholder="Tous les médecins"
                  searchPlaceholder="Rechercher un médecin..."
                  emptyStateMessage="Aucun médecin trouvé."
                  className="bg-white"
                />
              </div>

              <div className="flex items-center space-x-2 w-full md:w-auto">
                <Checkbox
                  id="showPending"
                  checked={showOnlyPending}
                  onCheckedChange={(checked) =>
                    setShowOnlyPending(checked as boolean)
                  }
                  className="border-gray-400"
                />
                <label
                  htmlFor="showPending"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-700 whitespace-nowrap"
                >
                  Seulement en attente
                </label>
              </div>

              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                <Button
                  onClick={fetchRistournes}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Actualiser
                </Button>
                <Button
                  onClick={clearFilters}
                  variant="ghost"
                  className="w-full text-slate-600 hover:text-slate-800"
                >
                  <FilterX className="mr-2 h-4 w-4" /> Effacer Filtres
                </Button>
                <Button asChild className="w-full">
                  <Link to="/ristournes/nouveau">
                    <PlusCircle className="mr-2 h-4 w-4" /> Nouvelle Ristourne
                  </Link>
                </Button>
              </div>
            </div>
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
                  onClick={fetchRistournes}
                  className="p-0 h-auto text-destructive-foreground underline"
                >
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Data Table */}
          {!loading && !error && (
            <div className="border rounded-lg overflow-hidden bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Médecin</TableHead>
                    <TableHead>Hôpital</TableHead>
                    <TableHead>Montant Total</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRistournes.length > 0 ? (
                    filteredRistournes.map((ristourne) => (
                      <TableRow key={ristourne.id}>
                        <TableCell>
                          {formatDate(ristourne.created_date)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {ristourne.doctor?.full_name}
                        </TableCell>
                        <TableCell>
                          {ristourne.doctor?.hospital || (
                            <span className="italic text-muted-foreground">
                              N/A
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(ristourne.total_fee)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusColors[ristourne.status]}>
                            {statusLabels[ristourne.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to={`/ristournes/${ristourne.id}`}>
                            <Button variant="outline" size="sm">
                              <Edit className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                              <span className="hidden sm:inline">Modifier</span>
                              <span className="sm:hidden">Éditer</span>
                            </Button>
                          </Link>
                          {
                            /*
                            
                            <Button
                            variant="destructive"
                            size="sm"
                            className="ml-2"
                            onClick={() => setRistourneToDelete(ristourne)}
                            disabled={deleting}
                          >
                            <Trash2 className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Supprimer</span>
                            <span className="sm:hidden">Del</span>
                          </Button>
                            
                            
                            */
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {searchTerm ? (
                          "Aucune ristourne ne correspond à votre recherche."
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <p>Aucune ristourne n'a été créée.</p>
                            <Link to="/ristournes/new">
                              <Button variant="link" className="gap-2">
                                <PlusCircle className="h-4 w-4" />
                                Créer une ristourne
                              </Button>
                            </Link>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {/* Pagination Controls */}
              <div className="flex justify-between items-center py-3 px-2 border-t bg-muted text-xs">
                <div>
                  Page {page} sur {totalPages}
                </div>
                <div className="space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={!canPrev}
                  >
                    Précédent
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={!canNext}
                  >
                    Suivant
                  </Button>
                </div>
                <div>{totalCount} résultats</div>
              </div>
            </div>
          )}
          {/* Delete confirmation dialog */}
          <Dialog
            open={!!ristourneToDelete}
            onOpenChange={() => setRistourneToDelete(null)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmer la suppression</DialogTitle>
              </DialogHeader>
              <div>
                Voulez-vous vraiment supprimer cette ristourne ? Cette action
                est irréversible.
                {deleteError && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erreur</AlertTitle>
                    <AlertDescription>{deleteError}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setRistourneToDelete(null)}
                  disabled={deleting}
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  loading={deleting}
                >
                  Supprimer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </>
  );
};

export default RistourneListPage;
