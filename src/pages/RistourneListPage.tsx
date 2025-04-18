// src/pages/RistourneListPage.tsx

import React, { useState, useEffect, useMemo } from "react";
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
  Trash2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

const statusColors: Record<RistourneStatus, "default" | "warning" | "success"> = {
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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Add state for delete dialog
  const [ristourneToDelete, setRistourneToDelete] = useState<Ristourne | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add state and effect for access code modal
  const [showAccessModal, setShowAccessModal] = useState(() => {
    // Only show modal if sessionStorage does not have the access flag
    return !sessionStorage.getItem("ristourne_access_granted");
  });
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [accessCodeError, setAccessCodeError] = useState<string | null>(null);
  const [ristourneAccessCode, setRistourneAccessCode] = useState<string | null>(null);
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

  // Fetch Ristournes with pagination
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get total count
      const { count } = await supabase
        .from("ristourne")
        .select("id", { count: "exact", head: true });
      setTotalCount(count || 0);

      // Get paginated data (newest at top of page 1)
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error: dbError } = await supabase
        .from("ristourne")
        .select(`
          *,
          doctor:doctor_id (
            id,
            full_name,
            hospital
          )
        `)
        .order("created_date", { ascending: false })
        .range(from, to);

      if (dbError) throw dbError;
      setRistournes(data || []);
    } catch (err: unknown) {
      console.error("Erreur lors de la récupération des ristournes:", err);
      setError(
        (err instanceof Error ? err.message : "") ||
          "Une erreur est survenue lors du chargement des ristournes."
      );
      setRistournes([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Filter and sort ristournes based on search term (newest at top)
  const filteredRistournes = useMemo(() => {
    let filtered = ristournes;
    if (debouncedSearchTerm) {
      const lowerCaseSearch = debouncedSearchTerm.toLowerCase();
      filtered = ristournes.filter(
        (ristourne) =>
          ristourne.doctor?.full_name.toLowerCase().includes(lowerCaseSearch) ||
          (ristourne.doctor?.hospital &&
            ristourne.doctor.hospital.toLowerCase().includes(lowerCaseSearch))
      );
    }
    // Sort by created_date descending (newest first)
    return filtered.slice().sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
  }, [ristournes, debouncedSearchTerm]);

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
      const { error } = await supabase.from("ristourne").delete().eq("id", ristourneToDelete.id);
      if (error) throw error;
      setRistourneToDelete(null);
      fetchData();
    } catch (err: any) {
      setDeleteError(err.message || "Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
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
              <Button type="submit" disabled={loadingAccessCode || !accessCodeInput}>
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

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Rechercher par médecin ou hôpital..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full md:w-1/3 h-10"
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
                  <Button size="sm" variant="outline" onClick={() => setPage(page - 1)} disabled={!canPrev}>
                    Précédent
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPage(page + 1)} disabled={!canNext}>
                    Suivant
                  </Button>
                </div>
                <div>
                  {totalCount} résultats
                </div>
              </div>
            </div>
          )}
          {/* Delete confirmation dialog */}
          <Dialog open={!!ristourneToDelete} onOpenChange={() => setRistourneToDelete(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmer la suppression</DialogTitle>
              </DialogHeader>
              <div>
                Voulez-vous vraiment supprimer cette ristourne ? Cette action est irréversible.
                {deleteError && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erreur</AlertTitle>
                    <AlertDescription>{deleteError}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRistourneToDelete(null)} disabled={deleting}>
                  Annuler
                </Button>
                <Button variant="destructive" onClick={handleDelete} loading={deleting}>
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
