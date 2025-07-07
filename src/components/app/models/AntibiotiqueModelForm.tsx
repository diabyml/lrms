// src/components/app/models/AntibiotiqueModelForm.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient"; // Adjust as needed
import { Database } from "@/lib/database.types"; // Adjust as needed
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  PlusCircle,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { v4 as uuidv4 } from "uuid"; // For generating unique IDs for antibiotic items

// Define the structure for an antibiotic item within the model's JSONB
export interface AntibiotiqueItemJson {
  id: string; // Unique client-side generated ID for this item in the list
  name: string;
  order: number;
  s: boolean; // Default Sensible
  i: boolean; // Default Intermediaire
  r: boolean; // Default Resistant
}

// Type for the model being edited/created
type AntibiotiqueModel =
  Database["public"]["Tables"]["antibiotique_model"]["Row"];
// For new models, ID and timestamps are optional until saved
type AntibiotiqueModelFormData = Omit<
  AntibiotiqueModel,
  "id" | "created_at" | "updated_at" | "antibiotiques"
> & {
  id?: string; // For editing existing
  antibiotiques: AntibiotiqueItemJson[];
};

interface AntibiotiqueModelFormProps {
  modelId?: string; // If provided, we are editing an existing model
  onSaveSuccess: (savedModel: AntibiotiqueModel) => void;
  onCancel: () => void;
}

export function AntibiotiqueModelForm({
  modelId,
  onSaveSuccess,
  onCancel,
}: AntibiotiqueModelFormProps) {
  const [formData, setFormData] = useState<AntibiotiqueModelFormData>({
    name: "",
    description: "",
    antibiotiques: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (modelId) {
      const fetchModel = async () => {
        setIsFetching(true);
        const { data, error } = await supabase
          .from("antibiotique_model")
          .select("*")
          .eq("id", modelId)
          .single();

        if (error) {
          sonnerToast.error("Erreur de chargement du modèle", {
            description: error.message,
          });
          console.error(error);
        } else if (data) {
          setFormData({
            id: data.id,
            name: data.name || "",
            description: data.description || "",
            // Ensure `antibiotiques` is an array and items have default s,i,r if missing from DB
            antibiotiques: Array.isArray(data.antibiotiques)
              ? (data.antibiotiques as any[]).map((ab, index) => ({
                  id: ab.id || uuidv4(), // Ensure ID exists
                  name: ab.name || "",
                  order: ab.order !== undefined ? ab.order : index,
                  s: ab.s === true, // Explicit boolean conversion
                  i: ab.i === true,
                  r: ab.r === true,
                }))
              : [],
          });
        }
        setIsFetching(false);
      };
      fetchModel();
    } else {
      // Initialize with one empty antibiotic row for new models
      setFormData((prev) => ({
        ...prev,
        antibiotiques: [createEmptyAntibiotiqueItem(0)],
      }));
    }
  }, [modelId]);

  const createEmptyAntibiotiqueItem = (
    order: number
  ): AntibiotiqueItemJson => ({
    id: uuidv4(),
    name: "",
    order,
    s: false,
    i: false,
    r: false,
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAntibiotiqueChange = (
    index: number,
    field: keyof AntibiotiqueItemJson,
    value: string | boolean
  ) => {
    const newAntibiotiques = [...formData.antibiotiques];
    const itemToUpdate = { ...newAntibiotiques[index] };
    (itemToUpdate[field] as any) = value; // Type assertion for dynamic field update

    // Ensure S/I/R exclusivity
    if (field === "s" && value === true) {
      itemToUpdate.i = false;
      itemToUpdate.r = false;
    } else if (field === "i" && value === true) {
      itemToUpdate.s = false;
      itemToUpdate.r = false;
    } else if (field === "r" && value === true) {
      itemToUpdate.s = false;
      itemToUpdate.i = false;
    }

    newAntibiotiques[index] = itemToUpdate;
    setFormData((prev) => ({ ...prev, antibiotiques: newAntibiotiques }));
  };

  const handleSirChange = (index: number, sirValue: "s" | "i" | "r") => {
    const newAntibiotiques = [...formData.antibiotiques];
    const item = newAntibiotiques[index];
    item.s = sirValue === "s";
    item.i = sirValue === "i";
    item.r = sirValue === "r";
    setFormData((prev) => ({ ...prev, antibiotiques: newAntibiotiques }));
  };

  const addAntibiotique = () => {
    setFormData((prev) => ({
      ...prev,
      antibiotiques: [
        ...prev.antibiotiques,
        createEmptyAntibiotiqueItem(prev.antibiotiques.length),
      ],
    }));
  };

  const removeAntibiotique = (index: number) => {
    // Re-order subsequent items
    const updatedAntibiotiques = formData.antibiotiques
      .filter((_, i) => i !== index)
      .map((ab, newIndex) => ({ ...ab, order: newIndex }));
    setFormData((prev) => ({ ...prev, antibiotiques: updatedAntibiotiques }));
  };

  // Basic drag and drop reordering (can be enhanced with libraries like react-beautiful-dnd)
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    index: number
  ) => {
    e.dataTransfer.setData("antibiotiqueIndex", index.toString());
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetIndex: number
  ) => {
    const draggedIndex = parseInt(e.dataTransfer.getData("antibiotiqueIndex"));
    if (draggedIndex === targetIndex) return;

    const newAntibiotiques = [...formData.antibiotiques];
    const [draggedItem] = newAntibiotiques.splice(draggedIndex, 1);
    newAntibiotiques.splice(targetIndex, 0, draggedItem);

    // Re-assign order based on new position
    const reorderedAntibiotiques = newAntibiotiques.map((item, index) => ({
      ...item,
      order: index,
    }));
    setFormData((prev) => ({ ...prev, antibiotiques: reorderedAntibiotiques }));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow drop
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!formData.name.trim()) {
      sonnerToast.error("Erreur de validation", {
        description: "Le nom du modèle est requis.",
      });
      setIsLoading(false);
      return;
    }
    if (formData.antibiotiques.some((ab) => !ab.name.trim())) {
      sonnerToast.error("Erreur de validation", {
        description: "Le nom de chaque antibiotique est requis.",
      });
      setIsLoading(false);
      return;
    }
    // Ensure each antibiotic item has an ID (should be handled by createEmptyAntibiotiqueItem)
    const antibiotiquesToSave = formData.antibiotiques.map((ab) => ({
      ...ab,
      id: ab.id || uuidv4(), // Defensive: ensure ID
    }));

    const dataToSave = {
      name: formData.name,
      description: formData.description,
      antibiotiques: antibiotiquesToSave as any, // Cast to any to match Supabase jsonb type expectation
    };

    let error;
    let savedData: AntibiotiqueModel | null = null;

    if (formData.id) {
      // Editing existing model
      const { data, error: updateError } = await supabase
        .from("antibiotique_model")
        .update(dataToSave)
        .eq("id", formData.id)
        .select()
        .single();
      error = updateError;
      savedData = data;
    } else {
      // Creating new model
      const { data, error: insertError } = await supabase
        .from("antibiotique_model")
        .insert(dataToSave)
        .select()
        .single();
      error = insertError;
      savedData = data;
    }

    setIsLoading(false);
    if (error) {
      sonnerToast.error("Erreur lors de l'enregistrement", {
        description: error.message,
      });
      console.error(error);
    } else if (savedData) {
      sonnerToast.success(
        `Modèle "${savedData.name}" ${
          formData.id ? "mis à jour" : "créé"
        } avec succès!`
      );
      onSaveSuccess(savedData);
    }
  };

  if (isFetching) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="h-8 w-8 animate-spin" /> Chargement du modèle...
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>
            {modelId
              ? "Modifier le Modèle d'Antibiogramme"
              : "Créer un Modèle d'Antibiogramme"}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <CardDescription>
          Définissez un nom pour ce panel d'antibiotiques et listez les
          antibiotiques à inclure avec leurs états par défaut.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du Modèle</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Ex: Antibiogramme Urinaire Standard"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optionnel)</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description || ""}
              onChange={handleInputChange}
              placeholder="Brève description du panel ou de son utilisation..."
            />
          </div>

          <div className="space-y-4">
            <Label className="text-md font-semibold">
              Liste des Antibiotiques
            </Label>
            {formData.antibiotiques.map((abItem, index) => (
              <div
                key={abItem.id} // Use stable client-side generated ID for key
                className="p-4 border rounded-md space-y-3 bg-slate-50 relative group"
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <GripVertical className="h-5 w-5 text-gray-400 cursor-grab group-hover:text-gray-600" />
                  <Input
                    type="text"
                    placeholder="Nom de l'antibiotique (Ex: Ampicilline)"
                    value={abItem.name}
                    onChange={(e) =>
                      handleAntibiotiqueChange(index, "name", e.target.value)
                    }
                    className="flex-grow bg-white"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAntibiotique(index)}
                    disabled={formData.antibiotiques.length <= 1}
                    aria-label="Supprimer l'antibiotique"
                  >
                    <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
                  </Button>
                </div>
                <div>
                  <Label className="text-sm mb-1 block">
                    État par défaut (S/I/R)
                  </Label>
                  <RadioGroup
                    defaultValue={
                      abItem.s ? "s" : abItem.i ? "i" : abItem.r ? "r" : "none"
                    }
                    onValueChange={(value) =>
                      handleSirChange(index, value as "s" | "i" | "r")
                    }
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="s" id={`s-${abItem.id}`} />
                      <Label htmlFor={`s-${abItem.id}`} className="font-normal">
                        S
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="i" id={`i-${abItem.id}`} />
                      <Label htmlFor={`i-${abItem.id}`} className="font-normal">
                        I
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="r" id={`r-${abItem.id}`} />
                      <Label htmlFor={`r-${abItem.id}`} className="font-normal">
                        R
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addAntibiotique}
              className="w-full"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Antibiotique
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={isLoading || isFetching}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {formData.id ? "Mettre à Jour" : "Enregistrer"} le Modèle
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
