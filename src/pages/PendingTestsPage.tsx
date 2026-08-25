import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useDebounce } from "@/hooks/useDebounce";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  ListChecks,
  Loader2,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// --- Types ---
type PendingResultRow = {
  id: string;
  result_date: string;
  description: string | null;
  patient: { id: string; full_name: string; patient_unique_id: string | null } | null;
  doctor: { id: string; full_name: string } | null;
};

// --- Parsing Utility ---
function parsePendingTests(description: string | null): string[] {
  if (!description) return [];

  // Strip "NB:" prefix
  let text = description.replace(/^NB\s*:\s*/i, "").trim();

  // Split by comma
  const segments = text.split(",");
  const tests: string[] = [];

  for (const raw of segments) {
    const seg = raw.trim();
    if (!seg.toLowerCase().includes("en cours")) continue;

    // Split " et " and "+" within an "en cours" segment
    const subSegments = seg.split(/\s*(?:et|\+)\s*/i);
    for (const sub of subSegments) {
      let name = sub.replace(/en cours.*$/i, "").trim();
      // Strip trailing punctuation / colons
      name = name.replace(/[:;,.\s]+$/, "").trim();
      // Remove VN: (range) notation if present
      name = name.replace(/\s*:\s*VN\s*:.*$/i, "").trim();
      if (name) tests.push(name);
    }
  }

  return tests;
}

// --- Component ---
const PendingTestsPage: React.FC = () => {
  const navigate = useNavigate();

  // Data state
  const [results, setResults] = useState<PendingResultRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [testNameFilter, setTestNameFilter] = useState("__all__");
  const [monthFilter, setMonthFilter] = useState("__all__");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Available test names for filter dropdown
  const [availableTestNames, setAvailableTestNames] = useState<string[]>([]);
  const [loadingFilterNames, setLoadingFilterNames] = useState(true);

  // Edit description dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<PendingResultRow | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);

  const openEditDialog = (row: PendingResultRow) => {
    setEditingResult(row);
    setEditDescription(row.description ?? "");
    setEditDialogOpen(true);
  };

  const handleSaveDescription = async () => {
    if (!editingResult) return;
    setSavingDescription(true);
    try {
      const { error } = await supabase
        .from("patient_result")
        .update({ description: editDescription || null })
        .eq("id", editingResult.id);
      if (error) throw error;
      setEditDialogOpen(false);
      fetchResults();
    } catch (err: any) {
      console.error("Error updating description:", err);
    } finally {
      setSavingDescription(false);
    }
  };

  // Derived
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  );

  // --- Fetch available test names for filter dropdown ---
  useEffect(() => {
    const fetchTestNames = async () => {
      setLoadingFilterNames(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("patient_result")
          .select("description")
          .ilike("description", "%en cours%");

        if (fetchError) throw fetchError;

        const names = new Set<string>();
        (data || []).forEach((row) => {
          parsePendingTests(row.description).forEach((name) =>
            names.add(name)
          );
        });
        setAvailableTestNames(Array.from(names).sort());
      } catch (err: any) {
        console.error("Error fetching filter names:", err);
      } finally {
        setLoadingFilterNames(false);
      }
    };
    fetchTestNames();
  }, []);

  // --- Fetch results ---
  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("patient_result")
        .select(
          `id, result_date, description,
           patient:patient_id (id, full_name, patient_unique_id),
           doctor:doctor_id (id, full_name)`,
          { count: "exact" }
        )
        .ilike("description", "%en cours%")
        .order("result_date", { ascending: false });

      // Free-text search filter
      if (debouncedSearchTerm.trim()) {
        query = query.ilike(
          "description",
          `%${debouncedSearchTerm.trim()}%`
        );
      }

      // Test name filter (applied server-side as ILIKE on description)
      if (testNameFilter && testNameFilter !== "__all__") {
        query = query.ilike("description", `%${testNameFilter}%`);
      }

      // Month filter
      if (monthFilter !== "__all__") {
        const [year, month] = monthFilter.split("-").map(Number);
        const start = new Date(year, month - 1, 1).toISOString();
        const end = new Date(year, month, 1).toISOString();
        query = query.gte("result_date", start).lt("result_date", end);
      }

      const from = (page - 1) * pageSize;
      const to = page * pageSize - 1;

      const { data, error: fetchError, count } = await query.range(from, to);

      if (fetchError) throw fetchError;

      setResults((data || []) as PendingResultRow[]);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error("Error fetching pending tests:", err);
      setError(
        err.message || "Une erreur est survenue lors du chargement des données."
      );
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, testNameFilter, monthFilter, page, pageSize]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, testNameFilter, monthFilter]);

  // Clamp page if it exceeds totalPages
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // --- Reset filters ---
  const resetFilters = () => {
    setSearchTerm("");
    setTestNameFilter("__all__");
    setMonthFilter("__all__");
  };

  const hasActiveFilters = Boolean(
    debouncedSearchTerm ||
      (testNameFilter && testNameFilter !== "__all__") ||
      monthFilter !== "__all__"
  );

  // --- Render ---
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <ListChecks className="h-6 w-6 text-primary" />
          Examens en cours
        </h1>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchResults}
            >
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="grid gap-3 rounded-lg border bg-background p-4 lg:grid-cols-[minmax(200px,1fr)_180px_180px_auto] lg:items-end">
        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="pending-search">Recherche</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="pending-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher dans la description..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Test name filter */}
        <div className="space-y-2">
          <Label htmlFor="pending-test-filter">Examen</Label>
          <Select
            value={testNameFilter}
            onValueChange={setTestNameFilter}
            disabled={loadingFilterNames || availableTestNames.length === 0}
          >
            <SelectTrigger id="pending-test-filter">
              <SelectValue placeholder="Tous les examens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les examens</SelectItem>
              {availableTestNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month filter */}
        <div className="space-y-2">
          <Label htmlFor="pending-month-filter">Mois</Label>
          <Input
            id="pending-month-filter"
            type="month"
            value={monthFilter === "__all__" ? "" : monthFilter}
            onChange={(e) =>
              setMonthFilter(e.target.value || "__all__")
            }
          />
        </div>

        {/* Clear filters */}
        <Button
          type="button"
          variant="outline"
          onClick={resetFilters}
          disabled={!hasActiveFilters}
        >
          <X className="mr-2 h-4 w-4" />
          Effacer
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3 rounded-lg border p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/5" />
              <Skeleton className="h-5 w-1/6" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="ml-auto h-9 w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Médecin</TableHead>
                <TableHead>Date du résultat</TableHead>
                <TableHead>Examens en cours</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length > 0 ? (
                results.map((row) => {
                  const pendingTests = parsePendingTests(row.description);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/patients/${row.patient?.id}`}
                          className="text-primary hover:underline"
                        >
                          {row.patient?.full_name || "Patient inconnu"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {row.doctor?.full_name || "Médecin inconnu"}
                      </TableCell>
                      <TableCell>
                        {row.result_date
                          ? format(parseISO(row.result_date), "P", {
                              locale: fr,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {pendingTests.length > 0 ? (
                            pendingTests.map((test, idx) => (
                              <Badge key={idx} variant="secondary">
                                {test}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              —
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(row)}
                            title="Modifier la description"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/results/${row.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Voir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Aucun examen en cours trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalCount > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} sur {totalPages} · {totalCount} résultat(s)
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Description Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier la description</DialogTitle>
            <DialogDescription>
              {editingResult?.patient?.full_name
                ? `Résultat du patient : ${editingResult.patient.full_name}`
                : "Modifier la description du résultat"}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="min-h-[150px]"
            placeholder="Description du résultat..."
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={savingDescription}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveDescription}
              disabled={savingDescription}
            >
              {savingDescription && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingTestsPage;
