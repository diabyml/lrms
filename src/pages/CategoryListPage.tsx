// src/pages/CategoryListPage.tsx

import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase, Tables } from "../lib/supabaseClient"; // Adjust path

// --- Shadcn/ui Imports ---
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // For Delete
import { Button } from "@/components/ui/button"; // Adjust path
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // For Add/Edit
import { Input } from "@/components/ui/input"; // Adjust path
import { Label } from "@/components/ui/label"; // Adjust path
import { Skeleton } from "@/components/ui/skeleton"; // Adjust path
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Adjust path

// --- Icons ---
import {
  AlertCircle,
  DatabaseZap,
  Edit,
  Layers,
  Loader2,
  PlusCircle,
  Trash2,
} from "lucide-react";

// --- Types ---
type Category = Tables<"category">;
type CategoryFormData = Pick<Category, "name">; // Only need name for the form

// --- Component ---
const CategoryListPage: React.FC = () => {
  // --- State ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null); // Error specific to modal form
  const [loadingSubmit, setLoadingSubmit] = useState<boolean>(false); // Loading for modal form submit

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null); // null for Add, Category object for Edit
  const [formData, setFormData] = useState<CategoryFormData>({ name: "" });
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null
  ); // For delete confirmation
  // --- End State ---

  // --- Data Fetching ---
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null); // Clear previous page errors on fetch
    try {
      const { data, error: dbError } = await supabase
        .from("category")
        .select("*")
        .order("name", { ascending: true });

      if (dbError) throw dbError;
      setCategories(data || []);
    } catch (err: unknown) {
      console.error("Erreur chargement catégories:", err);
      if (err instanceof Error) {
        setError(err.message || "Impossible de charger les catégories.");
      } else {
        setError("Impossible de charger les catégories.");
      }
      setCategories([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  // --- End Data Fetching ---

  // --- Modal Handling ---
  const openFormModal = (category: Category | null = null) => {
    setEditingCategory(category);
    setFormData({ name: category?.name || "" }); // Pre-fill form if editing
    setFormError(null); // Clear previous form errors
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    setIsFormOpen(false);
    // Delay resetting editingCategory slightly allows Dialog's onOpenChange to fire first
    setTimeout(() => {
      setEditingCategory(null);
      setFormData({ name: "" });
    }, 150);
  };

  const handleFormInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ name: e.target.value });
  };

  const handleFormSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!formData.name || !formData.name.trim()) {
      setFormError("Le nom de la catégorie est requis.");
      return;
    }

    setLoadingSubmit(true);
    const payload = { name: formData.name.trim() };

    try {
      let responseError = null;
      if (editingCategory) {
        // Update
        const { error } = await supabase
          .from("category")
          .update(payload)
          .eq("id", editingCategory.id);
        responseError = error;
      } else {
        // Insert
        const { error } = await supabase.from("category").insert(payload);
        responseError = error;
      }

      if (responseError) {
        if (responseError.code === "23505") {
          // Unique constraint
          setFormError("Ce nom de catégorie existe déjà.");
        } else {
          throw responseError;
        }
      } else {
        closeFormModal(); // Close modal on success
        await fetchData(false); // Refetch data without full loading indicator
      }
    } catch (err: unknown) {
      console.error("Erreur sauvegarde catégorie:", err);
      if (err instanceof Error) {
        setFormError(err.message || "Une erreur est survenue.");
      } else {
        setFormError("Une erreur est survenue.");
      }
    } finally {
      setLoadingSubmit(false);
    }
  };
  // --- End Modal Handling ---

  // --- Delete Handling ---
  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setLoadingSubmit(true); // Use same loading indicator for simplicity
    // Clear page error before attempting delete
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("category")
        .delete()
        .eq("id", categoryToDelete.id);

      if (deleteError) {
        // Check for foreign key violation (likely)
        if (deleteError.code === "23503") {
          // Set page-level error for FK violation
          setError(
            `Impossible de supprimer la catégorie "${categoryToDelete.name}" car elle est utilisée par un ou plusieurs types de test.`
          );
          setCategoryToDelete(null); // Close the dialog after setting error
        } else {
          throw deleteError; // Throw other DB errors
        }
      } else {
        // Success
        setCategoryToDelete(null); // Close confirmation dialog implicitly by resetting state
        await fetchData(false); // Refresh list
      }
    } catch (err: unknown) {
      console.error("Erreur suppression catégorie:", err);
      if (err instanceof Error) {
        // Set page-level error for unexpected issues
        setError(
          err.message || "Une erreur est survenue lors de la suppression."
        );
      } else {
        setError("Une erreur est survenue lors de la suppression.");
      }
      setCategoryToDelete(null); // Close dialog on other errors too
    } finally {
      setLoadingSubmit(false);
      // Dialog closing is handled by setting categoryToDelete to null
    }
  };
  // --- End Delete Handling ---

  // --- Render Logic ---
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-6 w-6" />
          Gestion des Catégories
        </h1>
        {/* Add Button triggers the modal */}
        <Button onClick={() => openFormModal(null)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter une Catégorie
        </Button>
      </div>

      {/* Main Error Display (for load or delete errors) */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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

      {/* Data Table */}
      {!loading && !error && (
        <div className="border rounded-lg overflow-hidden bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom de la Catégorie</TableHead>
                <TableHead className="text-right w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length > 0 ? (
                categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {/* Edit Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openFormModal(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                      {/* Delete Button Structure */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCategoryToDelete(category); // Set which category to confirm deletion for
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        {/* Content is defined once below */}
                      </AlertDialog>
                      {/* End Delete Button Structure */}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <DatabaseZap className="h-8 w-8 text-muted-foreground/50" />
                      Aucune catégorie définie.
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* Add pagination here if needed */}
        </div>
      )}

      {/* Add/Edit Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingCategory
                  ? "Modifier la Catégorie"
                  : "Ajouter une Catégorie"}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? "Modifiez le nom de la catégorie ci-dessous."
                  : "Entrez le nom de la nouvelle catégorie."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {formError && (
                <Alert variant="destructive" className="text-xs">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erreur</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label
                  htmlFor="category-name"
                  className="text-right col-span-1"
                >
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="category-name"
                  name="name"
                  value={formData.name}
                  onChange={handleFormInputChange}
                  className="col-span-3 h-9"
                  disabled={loadingSubmit}
                  required
                  autoFocus // Focus input when modal opens
                />
              </div>
            </div>
            <DialogFooter>
              {/* Explicit DialogClose needed if not relying solely on onOpenChange */}
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loadingSubmit}
                >
                  Annuler
                </Button>
              </DialogClose>
              <Button type="submit" disabled={loadingSubmit}>
                {loadingSubmit && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingCategory
                  ? "Enregistrer Modifications"
                  : "Ajouter Catégorie"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog (Defined ONCE) */}
      <AlertDialog
        open={!!categoryToDelete}
        onOpenChange={(open) => !open && setCategoryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr(e) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Voulez-vous vraiment supprimer la
              catégorie
              <span className="font-medium"> "{categoryToDelete?.name}"</span> ?
              <br />
              <span className="text-destructive/80 font-medium">
                Attention :
              </span>{" "}
              La suppression échouera si des types de test utilisent encore
              cette catégorie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={loadingSubmit}
              onClick={() => setCategoryToDelete(null)}
            >
              Annuler
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteCategory}
              disabled={loadingSubmit}
            >
              {loadingSubmit && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div> // End main container div
  );
};

export default CategoryListPage;
