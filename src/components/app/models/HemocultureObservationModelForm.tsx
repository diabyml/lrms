// src/components/app/models/HemocultureObservationModelForm.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Database, Tables } from "@/lib/supabaseClient";
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
import {
  PlusCircle,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  ArrowLeft,
  Settings2,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // For field type

// Type for an individual field within the model's fields_json
export interface HemocultureModelFieldJson {
  id: string; // Client-side unique ID
  label: string;
  type: "input" | "textarea" | "select"; // Add more types as needed
  order: number;
  defaultValue?: string;
  placeholder?: string;
  options?: string[]; // For select type, comma-separated string initially then parsed
}

// Type for the model being edited/created
type HemocultureObservationModel = Tables<"hemoculture_observation_model">;
type HemocultureObservationModelFormData = Omit<
  HemocultureObservationModel,
  "id" | "created_at" | "updated_at" | "fields_json"
> & {
  id?: string; // For editing existing
  fields_json: HemocultureModelFieldJson[];
};

interface HemocultureObservationModelFormProps {
  modelId?: string;
  onSaveSuccess: (savedModel: HemocultureObservationModel) => void;
  onCancel: () => void;
}

export function HemocultureObservationModelForm({
  modelId,
  onSaveSuccess,
  onCancel,
}: HemocultureObservationModelFormProps) {
  const [formData, setFormData] = useState<HemocultureObservationModelFormData>(
    {
      name: "",
      description: "",
      fields_json: [],
    }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (modelId) {
      const fetchModel = async () => {
        setIsFetching(true);
        const { data, error } = await supabase
          .from("hemoculture_observation_model")
          .select("*")
          .eq("id", modelId)
          .single();
        if (error)
          sonnerToast.error("Erreur chargement du modèle", {
            description: error.message,
          });
        else if (data) {
          setFormData({
            id: data.id,
            name: data.name || "",
            description: data.description || "",
            fields_json: Array.isArray(data.fields_json)
              ? (data.fields_json as any[]).map((field, index) => ({
                  id: field.id || uuidv4(),
                  label: field.label || "",
                  type: field.type || "input",
                  order: field.order !== undefined ? field.order : index,
                  defaultValue: field.defaultValue || "",
                  placeholder: field.placeholder || "",
                  options: Array.isArray(field.options)
                    ? field.options
                    : typeof field.options === "string"
                    ? field.options.split(",").map((s) => s.trim())
                    : [],
                }))
              : [],
          });
        }
        setIsFetching(false);
      };
      fetchModel();
    } else {
      setFormData((prev) => ({
        ...prev,
        fields_json: [createEmptyFieldItem(0)],
      }));
    }
  }, [modelId]);

  const createEmptyFieldItem = (order: number): HemocultureModelFieldJson => ({
    id: uuidv4(),
    label: "",
    type: "input",
    order,
    defaultValue: "",
    placeholder: "",
    options: [],
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFieldChange = (
    index: number,
    fieldProp: keyof HemocultureModelFieldJson,
    value: string | string[]
  ) => {
    const newFields = [...formData.fields_json];
    const itemToUpdate = { ...newFields[index] };
    if (fieldProp === "options" && typeof value === "string") {
      (itemToUpdate[fieldProp] as any) = value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
    } else {
      (itemToUpdate[fieldProp] as any) = value;
    }
    newFields[index] = itemToUpdate;
    setFormData((prev) => ({ ...prev, fields_json: newFields }));
  };

  const addField = () =>
    setFormData((prev) => ({
      ...prev,
      fields_json: [
        ...prev.fields_json,
        createEmptyFieldItem(prev.fields_json.length),
      ],
    }));
  const removeField = (index: number) => {
    const updatedFields = formData.fields_json
      .filter((_, i) => i !== index)
      .map((field, newIndex) => ({ ...field, order: newIndex }));
    setFormData((prev) => ({ ...prev, fields_json: updatedFields }));
  };

  // Basic Drag and Drop
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) =>
    e.dataTransfer.setData("fieldIndex", index.toString());
  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetIndex: number
  ) => {
    const draggedIndex = parseInt(e.dataTransfer.getData("fieldIndex"));
    if (draggedIndex === targetIndex) return;
    const newFields = [...formData.fields_json];
    const [draggedItem] = newFields.splice(draggedIndex, 1);
    newFields.splice(targetIndex, 0, draggedItem);
    setFormData((prev) => ({
      ...prev,
      fields_json: newFields.map((item, idx) => ({ ...item, order: idx })),
    }));
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) =>
    e.preventDefault();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (!formData.name.trim()) {
      sonnerToast.error("Nom du modèle requis.");
      setIsLoading(false);
      return;
    }
    if (formData.fields_json.some((f) => !f.label.trim())) {
      sonnerToast.error("Le libellé de chaque champ est requis.");
      setIsLoading(false);
      return;
    }

    const fieldsToSave = formData.fields_json.map((field) => ({
      ...field,
      options:
        field.type === "select" && Array.isArray(field.options)
          ? field.options.filter((opt) => opt.trim() !== "")
          : [],
    }));

    const dataToSave = {
      name: formData.name,
      description: formData.description,
      fields_json: fieldsToSave as any,
    };
    let error;
    let savedData: HemocultureObservationModel | null = null;

    if (formData.id) {
      ({ data: savedData, error } = await supabase
        .from("hemoculture_observation_model")
        .update(dataToSave)
        .eq("id", formData.id)
        .select()
        .single());
    } else {
      ({ data: savedData, error } = await supabase
        .from("hemoculture_observation_model")
        .insert(dataToSave)
        .select()
        .single());
    }
    setIsLoading(false);
    if (error)
      sonnerToast.error("Erreur enregistrement", {
        description: error.message,
      });
    else if (savedData) {
      sonnerToast.success(
        `Modèle "${savedData.name}" ${formData.id ? "mis à jour" : "créé"}.`
      );
      onSaveSuccess(savedData);
    }
  };

  if (isFetching)
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="h-8 w-8 animate-spin" /> Chargement...
      </div>
    );

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>
            {modelId
              ? "Modifier Modèle Observation Hémoculture"
              : "Créer Modèle Observation Hémoculture"}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft />
          </Button>
        </div>
        <CardDescription>
          Définissez les champs structurés pour les observations.
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
              placeholder="Ex: Observations Hémoculture Standard"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description || ""}
              onChange={handleInputChange}
              placeholder="Courte description..."
            />
          </div>
          <div className="space-y-4">
            <Label className="text-md font-semibold">Champs du Modèle</Label>
            {formData.fields_json.map((field, index) => (
              <div
                key={field.id}
                className="p-4 border rounded-md space-y-3 bg-slate-50 group"
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <GripVertical className="h-5 w-5 text-gray-400 cursor-grab group-hover:text-gray-600" />
                  <Input
                    type="text"
                    placeholder="Libellé du champ (Ex: Aspect du bouillon)"
                    value={field.label}
                    onChange={(e) =>
                      handleFieldChange(index, "label", e.target.value)
                    }
                    className="flex-grow bg-white"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(index)}
                    disabled={formData.fields_json.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label
                      htmlFor={`field-type-${field.id}`}
                      className="text-xs"
                    >
                      Type de Champ
                    </Label>
                    <Select
                      value={field.type}
                      onValueChange={(val) =>
                        handleFieldChange(index, "type", val)
                      }
                    >
                      <SelectTrigger
                        id={`field-type-${field.id}`}
                        className="bg-white text-xs h-8"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="input">
                          Texte Court (Input)
                        </SelectItem>
                        <SelectItem value="textarea">
                          Texte Long (Textarea)
                        </SelectItem>
                        <SelectItem value="select">Sélection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor={`field-default-${field.id}`}
                      className="text-xs"
                    >
                      Valeur par Défaut
                    </Label>
                    <Input
                      id={`field-default-${field.id}`}
                      type="text"
                      placeholder="Optionnel"
                      value={field.defaultValue || ""}
                      onChange={(e) =>
                        handleFieldChange(index, "defaultValue", e.target.value)
                      }
                      className="bg-white text-xs h-8"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor={`field-placeholder-${field.id}`}
                    className="text-xs"
                  >
                    Texte indicatif (Placeholder)
                  </Label>
                  <Input
                    id={`field-placeholder-${field.id}`}
                    type="text"
                    placeholder="Optionnel"
                    value={field.placeholder || ""}
                    onChange={(e) =>
                      handleFieldChange(index, "placeholder", e.target.value)
                    }
                    className="bg-white text-xs h-8"
                  />
                </div>
                {field.type === "select" && (
                  <div className="space-y-1">
                    <Label
                      htmlFor={`field-options-${field.id}`}
                      className="text-xs"
                    >
                      Options (séparées par virgule)
                    </Label>
                    <Input
                      id={`field-options-${field.id}`}
                      type="text"
                      placeholder="Option A, Option B, Option C"
                      value={(field.options || []).join(", ")}
                      onChange={(e) =>
                        handleFieldChange(index, "options", e.target.value)
                      }
                      className="bg-white text-xs h-8"
                    />
                  </div>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addField}
              className="w-full"
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Champ
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
            {formData.id ? "Mettre à Jour" : "Enregistrer"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
