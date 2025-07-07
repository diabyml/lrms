// src/pages/admin/ManageHemocultureObservationModelsPage.tsx (or your preferred path)
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Database, Tables } from "@/lib/supabaseClient";
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
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Edit3,
  Trash2,
  PlusCircle,
  Search,
  Microscope,
  ShieldAlert,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  HemocultureObservationModelForm,
  HemocultureModelFieldJson,
} from "@/components/app/models/HemocultureObservationModelForm"; // Import the form

type HemocultureObservationModel = Tables<"hemoculture_observation_model">;

export function ManageHemocultureObservationModelsPage() {
  const [models, setModels] = useState<HemocultureObservationModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] =
    useState<HemocultureObservationModel | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [modelToDelete, setModelToDelete] =
    useState<HemocultureObservationModel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from("hemoculture_observation_model")
      .select("*")
      .order("name", { ascending: true });
    if (searchTerm.trim() !== "")
      query = query.ilike("name", `%${searchTerm.trim()}%`);
    const { data, error } = await query;
    if (error)
      sonnerToast.error("Erreur chargement des modèles", {
        description: error.message,
      });
    else setModels(data || []);
    setIsLoading(false);
  }, [searchTerm]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleCreateNew = () => {
    setEditingModel(null);
    setShowForm(true);
  };
  const handleEdit = (model: HemocultureObservationModel) => {
    setEditingModel(model);
    setShowForm(true);
  };
  const handleSaveSuccess = () => {
    setShowForm(false);
    setEditingModel(null);
    fetchModels();
  };
  const handleCancelForm = () => {
    setShowForm(false);
    setEditingModel(null);
  };
  const openDeleteDialog = (model: HemocultureObservationModel) => {
    setModelToDelete(model);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!modelToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase
      .from("hemoculture_observation_model")
      .delete()
      .eq("id", modelToDelete.id);
    setIsDeleting(false);
    setShowDeleteDialog(false);
    if (error)
      sonnerToast.error("Erreur suppression", {
        description: `Modèle "${modelToDelete.name}" non supprimé. Détail: ${error.message}`,
      });
    else {
      sonnerToast.success(`Modèle "${modelToDelete.name}" supprimé.`);
      fetchModels();
    }
    setModelToDelete(null);
  };

  if (showForm) {
    return (
      <HemocultureObservationModelForm
        modelId={editingModel?.id}
        onSaveSuccess={handleSaveSuccess}
        onCancel={handleCancelForm}
      />
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center">
          <Microscope className="mr-3 h-7 w-7 text-blue-600" />
          Gestion des Modèles d'Observation (Hémoculture)
        </h1>
        <Button onClick={handleCreateNew} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-5 w-5" />
          Créer Modèle
        </Button>
      </div>
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Rechercher par nom..."
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
            Aucun modèle trouvé.
          </p>
          <p className="text-slate-500 mt-1">Créez-en un nouveau.</p>
        </div>
      ) : models.length === 0 && searchTerm !== "" ? (
        <div className="text-center py-10 bg-slate-50 rounded-lg shadow border">
          <Search className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <p className="text-xl font-semibold text-slate-600">
            Aucun modèle pour "{searchTerm}".
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
                  Nb. Champs
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
                    {model.description || <span className="italic">N/A</span>}
                  </TableCell>
                  <TableCell className="text-center text-slate-600">
                    {Array.isArray(model.fields_json)
                      ? (model.fields_json as HemocultureModelFieldJson[])
                          .length
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
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer Suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer le modèle{" "}
              <span className="font-semibold">"{modelToDelete?.name}"</span> ?
              Action irréversible. Les résultats patients basés sur ce modèle ne
              seront pas supprimés mais la référence pourrait être rompue.
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
