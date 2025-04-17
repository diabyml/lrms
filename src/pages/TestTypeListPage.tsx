// src/pages/TestTypeListPage.tsx

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Adjust path

import { Label } from "@/components/ui/label"; // Adjust path

import {
  PlusCircle,
  Search,
  ClipboardList,
  Layers,
  AlertCircle,
  DatabaseZap,
  Edit,
  Trash,
} from "lucide-react"; // Icons
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

// Define Types
type Category = Tables<"category">;
// Define a type for TestType including the nested category from the join
type TestTypeWithCategory = Omit<Tables<"test_type">, "category_id"> & {
  category: Pick<Category, "id" | "name"> | null; // Category can be null if join fails or relation is missing temporarily
};

const TestTypeListPage: React.FC = () => {
  // State
  const [testTypes, setTestTypes] = useState<TestTypeWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all"); // 'all' or category ID
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch Test Types (with Category) and all Categories
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use Promise.all for concurrent fetching
      const [testTypesRes, categoriesRes] = await Promise.all([
        supabase
          .from("test_type")
          .select(
            `
            id,
            name,
            created_at,
            updated_at,
            category:category_id (id, name)
          `
          )
          .order("name", { ascending: true }),
        supabase
          .from("category")
          .select("*")
          .order("name", { ascending: true }),
      ]);

      if (testTypesRes.error) throw testTypesRes.error;
      // Cast needed if Supabase types aren't perfect for nested selects
      setTestTypes((testTypesRes.data as TestTypeWithCategory[]) || []);

      if (categoriesRes.error) throw categoriesRes.error;
      setCategories(categoriesRes.data || []);
    } catch (err: any) {
      console.error("Erreur lors de la récupération des données:", err);
      setError(err?.message || "Une erreur est survenue lors du chargement.");
      setTestTypes([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter test types based on search term and category filter
  const filteredTestTypes = useMemo(() => {
    let results = testTypes;

    // Apply category filter
    if (categoryFilter !== "all") {
      results = results.filter((tt) => tt.category?.id === categoryFilter);
    }

    // Apply search term filter (on name)
    if (debouncedSearchTerm) {
      const lowerCaseSearch = debouncedSearchTerm.toLowerCase();
      results = results.filter((tt) =>
        tt.name.toLowerCase().includes(lowerCaseSearch)
      );
    }

    return results;
  }, [testTypes, categoryFilter, debouncedSearchTerm]);

  // Delete handler
  const handleDelete = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.from("test_type").delete().eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Erreur lors de la suppression.");
    } finally {
      setLoading(false);
      setDialogOpen(false);
      setPendingDeleteId(null);
    }
  };

  // --- Render Logic ---

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Gestion des Types de Test
        </h1>
        <Link to="/test-types/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter un Type de Test
          </Button>
        </Link>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Category Filter */}
        <div className="flex-1 sm:flex-none sm:w-64 space-y-1.5">
          <Label
            htmlFor="categoryFilter"
            className="text-xs font-medium text-muted-foreground"
          >
            Filtrer par Catégorie
          </Label>
          <Select
            value={categoryFilter}
            onValueChange={(value) => setCategoryFilter(value || "all")}
            disabled={loading || categories.length === 0}
          >
            <SelectTrigger id="categoryFilter" className="h-10">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search Input */}
        <div className="flex-1 space-y-1.5">
          <Label
            htmlFor="testTypeSearch"
            className="text-xs font-medium text-muted-foreground"
          >
            Rechercher par Nom
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="testTypeSearch"
              type="search"
              placeholder="Nom du type de test..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 w-full"
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="border rounded-lg">
          <Skeleton className="h-12 w-full rounded-t-lg" /> {/* Header */}
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
                <TableHead>Nom du Type de Test</TableHead>
                <TableHead className="w-[250px]">Catégorie</TableHead>
                {/* Add Parameter Count later if desired */}
                {/* <TableHead className="w-[150px] text-center">Paramètres</TableHead> */}
                <TableHead className="text-right w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTestTypes.length > 0 ? (
                filteredTestTypes.map((testType) => (
                  <TableRow key={testType.id}>
                    <TableCell className="font-medium">
                      {testType.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {/* Render category name, handle null case */}
                        {testType.category ? (
                          <>
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            {testType.category.name}
                          </>
                        ) : (
                          <span className="italic text-muted-foreground">
                            N/A
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {/* <TableCell className="text-center">{parameterCountMap[testType.id] || 0}</TableCell> */}
                    <TableCell className="text-right">
                      <Link to={`/test-types/${testType.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                          <span className="hidden sm:inline">Modifier</span>
                          <span className="sm:hidden">Éditer</span>
                        </Button>
                      </Link>
                      {/* Delete Button with Dialog */}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="ml-2"
                        title="Supprimer"
                        onClick={() => {
                          setPendingDeleteId(testType.id);
                          setDialogOpen(true);
                        }}
                      >
                        <Trash className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Supprimer</span>
                        <span className="sm:hidden">Del</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {searchTerm || categoryFilter !== "all" ? (
                      "Aucun type de test ne correspond à vos filtres."
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <DatabaseZap className="h-8 w-8 text-muted-foreground/50" />
                        Aucun type de test défini.
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* Add Pagination if the list becomes very long */}
        </div>
      )}
      {/* Delete Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce type de test ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId) handleDelete(pendingDeleteId);
              }}
              disabled={loading}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TestTypeListPage;
