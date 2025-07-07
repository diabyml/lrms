// src/pages/admin/ManageAntibiotiqueModelsPage.tsx (or your preferred path)
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient"; // Adjust as needed
import { Database } from "@/lib/database.types"; // Adjust as needed
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Edit3,
  Trash2,
  PlusCircle,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  AntibiotiqueModelForm,
  AntibiotiqueItemJson,
} from "@/components/app/models/AntibiotiqueModelForm"; // Import the form

type AntibiotiqueModel =
  Database["public"]["Tables"]["antibiotique_model"]["Row"];

export function ManageAntibiotiqueModelsPage() {
  const [models, setModels] = useState<AntibiotiqueModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState<AntibiotiqueModel | null>(
    null
  );

  // For delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<AntibiotiqueModel | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from("antibiotique_model")
      .select("*")
      .order("name", { ascending: true });

    if (searchTerm.trim() !== "") {
      query = query.ilike("name", `%${searchTerm.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
      sonnerToast.error("Erreur de chargement des modèles", {
        description: error.message,
      });
      console.error("Error fetching models:", error);
    } else {
      setModels(data || []);
    }
    setIsLoading(false);
  }, [searchTerm]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleCreateNew = () => {
    setEditingModel(null); // Clear any existing editing model
    setShowForm(true);
  };

  const handleEdit = (model: AntibiotiqueModel) => {
    setEditingModel(model);
    setShowForm(true);
  };

  const handleSaveSuccess = (savedModel: AntibiotiqueModel) => {
    setShowForm(false);
    setEditingModel(null);
    fetchModels(); // Refresh the list
    // Update the specific model in the list or re-fetch is simpler
    // setModels(prevModels => {
    //   const index = prevModels.findIndex(m => m.id === savedModel.id);
    //   if (index !== -1) {
    //     const updatedModels = [...prevModels];
    //     updatedModels[index] = savedModel;
    //     return updatedModels;
    //   }
    //   return [...prevModels, savedModel].sort((a, b) => a.name.localeCompare(b.name));
    // });
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingModel(null);
  };

  const openDeleteDialog = (model: AntibiotiqueModel) => {
    setModelToDelete(model);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!modelToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase
      .from("antibiotique_model")
      .delete()
      .eq("id", modelToDelete.id);

    setIsDeleting(false);
    setShowDeleteDialog(false);

    if (error) {
      sonnerToast.error("Erreur lors de la suppression", {
        description: `Le modèle "${modelToDelete.name}" n'a pas pu être supprimé. Il est peut-être utilisé. Détail: ${error.message}`,
      });
      console.error("Error deleting model:", error);
    } else {
      sonnerToast.success(`Modèle "${modelToDelete.name}" supprimé.`);
      fetchModels(); // Refresh the list
    }
    setModelToDelete(null);
  };

  if (showForm) {
    return (
      <AntibiotiqueModelForm
        modelId={editingModel?.id}
        onSaveSuccess={handleSaveSuccess}
        onCancel={handleCancelForm}
      />
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Gestion des Modèles d'Antibiogramme
        </h1>
        <Button onClick={handleCreateNew} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-5 w-5" />
          Créer un Nouveau Modèle
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Rechercher par nom de modèle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full md:w-1/2 lg:w-1/3 bg-white"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-sky-600" />
        </div>
      ) : models.length === 0 && searchTerm === "" ? (
        <div className="text-center py-10 bg-slate-50 rounded-lg shadow border">
          <ShieldAlert className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <p className="text-xl font-semibold text-slate-600">
            Aucun modèle d'antibiogramme trouvé.
          </p>
          <p className="text-slate-500 mt-1">
            Commencez par en créer un nouveau.
          </p>
        </div>
      ) : models.length === 0 && searchTerm !== "" ? (
        <div className="text-center py-10 bg-slate-50 rounded-lg shadow border">
          <Search className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <p className="text-xl font-semibold text-slate-600">
            Aucun modèle trouvé pour "{searchTerm}".
          </p>
          <p className="text-slate-500 mt-1">
            Essayez un autre terme de recherche.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden shadow bg-white">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">
                  Nom du Modèle
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Description
                </TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">
                  Nb. Antibiotiques
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-slate-800">
                    {model.name}
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm max-w-sm truncate">
                    {model.description || (
                      <span className="italic">Aucune description</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-slate-600">
                    {Array.isArray(model.antibiotiques)
                      ? (model.antibiotiques as AntibiotiqueItemJson[]).length
                      : 0}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(model)}
                    >
                      <Edit3 className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Modifier</span>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog(model)}
                    >
                      <Trash2 className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Suppr.</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la Suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le modèle{" "}
              <span className="font-semibold">"{modelToDelete?.name}"</span> ?
              Cette action ne peut pas être annulée. Les résultats patients
              basés sur ce modèle source ne seront pas supprimés mais la
              référence au modèle source pourrait être rompue si non gérée (ici
              `ON DELETE RESTRICT` sur `source_antibiotique_model_id` dans
              `patient_antibiogram_set` préviendra la suppression si des
              résultats l'utilisent).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              onClick={() => setModelToDelete(null)}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
