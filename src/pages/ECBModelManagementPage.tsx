// import React, { useEffect, useState } from "react";
// import { supabase } from "@/lib/supabaseClient";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Pencil, Trash, Plus } from "lucide-react";
// import { Textarea } from "@/components/ui/textarea";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// interface Section {
//   title: string;
//   labels: string[];
// }

// interface EcbModel {
//   id: string;
//   name: string;
//   description?: string;
//   structure: Section[];
//   created_at?: string;
// }

// const ECBModelManagementPage: React.FC = () => {
//   const [models, setModels] = useState<EcbModel[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [editingId, setEditingId] = useState<string | null>(null);
//   const [editValue, setEditValue] = useState("");
//   const [editDescription, setEditDescription] = useState("");
//   const [newModelName, setNewModelName] = useState("");
//   const [newModelDescription, setNewModelDescription] = useState("");
//   const [saving, setSaving] = useState(false);
//   const [structureDialog, setStructureDialog] = useState<null | EcbModel>(null);
//   const [structureDraft, setStructureDraft] = useState<Section[]>([]);
//   const [structureError, setStructureError] = useState<string | null>(null);
//   const [deleteId, setDeleteId] = useState<string | null>(null);

//   // Fetch models
//   const fetchModels = async () => {
//     setLoading(true);
//     const { data, error } = await supabase
//       .from("ecb_model")
//       .select("id, name, description, structure, created_at")
//       .order("created_at");
//     if (!error) setModels(data || []);
//     setLoading(false);
//   };

//   useEffect(() => {
//     fetchModels();
//   }, []);

//   // Edit model name/desc
//   const handleEdit = (model: EcbModel) => {
//     setEditingId(model.id);
//     setEditValue(model.name);
//     setEditDescription(model.description || "");
//   };
//   const handleEditSave = async (id: string) => {
//     setSaving(true);
//     await supabase
//       .from("ecb_model")
//       .update({ name: editValue, description: editDescription })
//       .eq("id", id);
//     setEditingId(null);
//     setEditValue("");
//     setEditDescription("");
//     setSaving(false);
//     fetchModels();
//   };
//   // Delete model
//   const handleDelete = async (id: string) => {
//     setSaving(true);
//     await supabase.from("ecb_model").delete().eq("id", id);
//     fetchModels();
//     setSaving(false);
//     setDeleteId(null);
//   };
//   // Add model
//   const handleAdd = async () => {
//     if (!newModelName.trim()) return;
//     setSaving(true);
//     await supabase.from("ecb_model").insert({
//       name: newModelName.trim(),
//       description: newModelDescription.trim(),
//       structure: JSON.stringify([])
//     });
//     setNewModelName("");
//     setNewModelDescription("");
//     setSaving(false);
//     fetchModels();
//   };

//   // Structure editor logic
//   const openStructureEditor = (model: EcbModel) => {
//     setStructureDialog(model);
//     setStructureDraft(Array.isArray(model.structure) ? model.structure : []);
//     setStructureError(null);
//   };
//   const closeStructureEditor = () => {
//     setStructureDialog(null);
//     setStructureDraft([]);
//     setStructureError(null);
//   };
//   const handleStructureSave = async () => {
//     if (!structureDialog) return;
//     // Validation: section titles and labels must not be empty
//     for (const s of structureDraft) {
//       if (!s.title.trim()) {
//         setStructureError("Titre de section requis");
//         return;
//       }
//       if (!Array.isArray(s.labels) || s.labels.some(l => !l.trim())) {
//         setStructureError("Chaque section doit avoir des labels non vides");
//         return;
//       }
//     }
//     setSaving(true);
//     await supabase
//       .from("ecb_model")
//       .update({ structure: structureDraft })
//       .eq("id", structureDialog.id);
//     setSaving(false);
//     closeStructureEditor();
//     fetchModels();
//   };

//   // Section/label editing helpers
//   const addSection = () => setStructureDraft([...structureDraft, { title: "Nouvelle section", labels: ["Label 1"] }]);
//   const removeSection = (idx: number) => setStructureDraft(structureDraft.filter((_, i) => i !== idx));
//   const updateSectionTitle = (idx: number, title: string) => setStructureDraft(structureDraft.map((s, i) => i === idx ? { ...s, title } : s));
//   const addLabel = (sectionIdx: number) => setStructureDraft(structureDraft.map((s, i) => i === sectionIdx ? { ...s, labels: [...s.labels, "Nouveau label"] } : s));
//   const updateLabel = (sectionIdx: number, labelIdx: number, label: string) => setStructureDraft(structureDraft.map((s, i) => i === sectionIdx ? { ...s, labels: s.labels.map((l, j) => j === labelIdx ? label : l) } : s));
//   const removeLabel = (sectionIdx: number, labelIdx: number) => setStructureDraft(structureDraft.map((s, i) => i === sectionIdx ? { ...s, labels: s.labels.filter((_, j) => j !== labelIdx) } : s));

//   return (
//     <div className="w-full mx-auto p-4">
//       <h1 className="text-2xl font-bold mb-4">Gestion des Modèles ECB</h1>
//       <div className="mb-6 flex gap-2">
//         <Input
//           value={newModelName}
//           onChange={e => setNewModelName(e.target.value)}
//           placeholder="Nouveau modèle"
//           className="flex-1"
//         />
//         <Input
//           value={newModelDescription}
//           onChange={e => setNewModelDescription(e.target.value)}
//           placeholder="Description (optionnelle)"
//           className="flex-1"
//         />
//         <Button onClick={handleAdd} disabled={saving || !newModelName.trim()}>
//           <Plus className="w-4 h-4 mr-1" /> Ajouter
//         </Button>
//       </div>
//       <div className="bg-white rounded shadow p-4">
//         {loading ? (
//           <div>Chargement...</div>
//         ) : (
//           <table className="w-full border-collapse">
//             <thead>
//               <tr>
//                 <th className="text-left py-2">Nom du modèle</th>
//                 <th className="text-left py-2">Description</th>
//                 <th className="text-left py-2">Structure</th>
//                 <th className="w-48"></th>
//               </tr>
//             </thead>
//             <tbody>
//               {models.map(model => (
//                 <React.Fragment key={model.id}>
//                   <tr>
//                     <td className="py-2">
//                       {editingId === model.id ? (
//                         <Input
//                           value={editValue}
//                           onChange={e => setEditValue(e.target.value)}
//                           className="inline-block w-auto"
//                           onKeyDown={e => {
//                             if (e.key === "Enter") handleEditSave(model.id);
//                             if (e.key === "Escape") setEditingId(null);
//                           }}
//                           autoFocus
//                         />
//                       ) : (
//                         <span>{model.name}</span>
//                       )}
//                     </td>
//                     <td className="py-2">
//                       {editingId === model.id ? (
//                         <Input
//                           value={editDescription}
//                           onChange={e => setEditDescription(e.target.value)}
//                           className="inline-block w-auto"
//                           onKeyDown={e => {
//                             if (e.key === "Enter") handleEditSave(model.id);
//                             if (e.key === "Escape") setEditingId(null);
//                           }}
//                         />
//                       ) : (
//                         <span>{model.description}</span>
//                       )}
//                     </td>
//                     <td className="py-2">
//                       <Button size="sm" variant="outline" onClick={() => openStructureEditor(model)}>
//                         Éditer Structure
//                       </Button>
//                     </td>
//                     <td>
//                       {editingId === model.id ? (
//                         <Button size="sm" onClick={() => handleEditSave(model.id)} disabled={saving || !editValue.trim()}>
//                           Enregistrer
//                         </Button>
//                       ) : (
//                         <div className="flex gap-2">
//                           <Button size="icon" variant="ghost" onClick={() => handleEdit(model)}>
//                             <Pencil className="w-4 h-4" />
//                           </Button>
//                           <Button size="icon" variant="destructive" onClick={() => setDeleteId(model.id)}>
//                             <Trash className="w-4 h-4" />
//                           </Button>
//                         </div>
//                       )}
//                     </td>
//                   </tr>
//                   {structureDialog && structureDialog.id === model.id && (
//                     <tr>
//                       <td colSpan={4}>
//                         <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 border rounded p-4 bg-muted">
//                           <div className="mb-2 font-semibold text-lg">Éditer la structure du modèle</div>
//                           {structureDraft.map((section, idx) => (
//                             <div key={idx} className="border rounded p-3 mb-2">
//                               <div className="flex gap-2 items-center mb-2">
//                                 <Input
//                                   value={section.title}
//                                   onChange={e => updateSectionTitle(idx, e.target.value)}
//                                   placeholder="Titre de section"
//                                   className="flex-1"
//                                 />
//                                 <Button size="icon" variant="destructive" onClick={() => removeSection(idx)}>
//                                   <Trash className="w-4 h-4" />
//                                 </Button>
//                               </div>
//                               <div className="ml-4 space-y-1">
//                                 {section.labels.map((label, labelIdx) => (
//                                   <div key={labelIdx} className="flex gap-2 items-center mb-1">
//                                     <Input
//                                       value={label}
//                                       onChange={e => updateLabel(idx, labelIdx, e.target.value)}
//                                       placeholder="Label"
//                                       className="flex-1"
//                                     />
//                                     <Button size="icon" variant="destructive" onClick={() => removeLabel(idx, labelIdx)}>
//                                       <Trash className="w-4 h-4" />
//                                     </Button>
//                                   </div>
//                                 ))}
//                                 <Button size="sm" variant="outline" onClick={() => addLabel(idx)}>
//                                   <Plus className="w-4 h-4 mr-1" /> Ajouter Label
//                                 </Button>
//                               </div>
//                             </div>
//                           ))}
//                           <Button size="sm" variant="secondary" onClick={addSection}>
//                             <Plus className="w-4 h-4 mr-1" /> Ajouter Section
//                           </Button>
//                           {structureError && <div className="text-red-500 text-sm">{structureError}</div>}
//                           <div className="flex gap-2 mt-4">
//                             <Button onClick={handleStructureSave} disabled={saving}>Enregistrer la structure</Button>
//                             <Button variant="ghost" onClick={closeStructureEditor}>Annuler</Button>
//                           </div>
//                         </div>
//                       </td>
//                     </tr>
//                   )}
//                 </React.Fragment>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </div>
//       {/* Delete confirmation dialog */}
//       <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Confirmer la suppression</DialogTitle>
//           </DialogHeader>
//           <div>Êtes-vous sûr de vouloir supprimer ce modèle ECB&nbsp;?</div>
//           <DialogFooter>
//             <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} disabled={saving}>
//               Supprimer
//             </Button>
//             <Button variant="ghost" onClick={() => setDeleteId(null)} disabled={saving}>
//               Annuler
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// };

// export default ECBModelManagementPage;

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface LabelWithDefault {
  name: string;
  defaultValue: string | null;
}

interface Section {
  title: string;
  labels: LabelWithDefault[];
}

interface EcbModel {
  id: string;
  name: string;
  description?: string;
  structure: Section[];
  created_at?: string;
}

const ECBModelManagementPage: React.FC = () => {
  const [models, setModels] = useState<EcbModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newModelDescription, setNewModelDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [structureDialog, setStructureDialog] = useState<null | EcbModel>(null);
  const [structureDraft, setStructureDraft] = useState<Section[]>([]);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchModels = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ecb_model")
      .select("id, name, description, structure, created_at")
      .order("created_at");

    if (!error && data) {
      const parsedData = data.map((model) => {
        let currentStructure: Section[] = []; // Default to empty array
        if (
          typeof model.structure === "string" &&
          model.structure.trim() !== ""
        ) {
          try {
            const parsed = JSON.parse(model.structure);
            if (Array.isArray(parsed)) {
              // Further ensure each item in parsed is somewhat like a Section
              currentStructure = parsed.filter(
                (item) => typeof item === "object" && item !== null
              ) as Section[];
            } else {
              console.warn(
                `Model ${model.id} structure string did not parse to an array:`,
                model.structure
              );
            }
          } catch (e) {
            console.error(
              `Failed to parse model.structure string for model ${model.id}:`,
              model.structure,
              e
            );
          }
        } else if (Array.isArray(model.structure)) {
          currentStructure = model.structure.filter(
            (item) => typeof item === "object" && item !== null
          ) as Section[];
        }
        // else: if model.structure is null, undefined, or empty string, currentStructure remains []
        return {
          ...model,
          structure: currentStructure, // currentStructure is now an array of objects or an empty array
        };
      });
      setModels(parsedData as EcbModel[]);
    } else if (error) {
      console.error("Error fetching models:", error);
      setModels([]);
    } else {
      setModels([]); // No data and no error
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleEdit = (model: EcbModel) => {
    setEditingId(model.id);
    setEditValue(model.name);
    setEditDescription(model.description || "");
  };

  const handleEditSave = async (id: string) => {
    setSaving(true);
    await supabase
      .from("ecb_model")
      .update({ name: editValue, description: editDescription })
      .eq("id", id);
    setEditingId(null);
    setEditValue("");
    setEditDescription("");
    setSaving(false);
    fetchModels();
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    await supabase.from("ecb_model").delete().eq("id", id);
    fetchModels();
    setSaving(false);
    setDeleteId(null);
  };

  const handleAdd = async () => {
    if (!newModelName.trim()) return;
    setSaving(true);
    await supabase.from("ecb_model").insert({
      name: newModelName.trim(),
      description: newModelDescription.trim(),
      structure: [], // Initialize with valid empty JSON array
    });
    setNewModelName("");
    setNewModelDescription("");
    setSaving(false);
    fetchModels();
  };

  const openStructureEditor = (model: EcbModel) => {
    setStructureDialog(model);

    // Ensure model.structure is an array of objects.
    // Filter out any non-object elements and ensure basic structure.
    const safeInitialStructure: any[] = (
      Array.isArray(model.structure) ? model.structure : []
    ).filter((item) => typeof item === "object" && item !== null);

    const migratedStructure: Section[] = safeInitialStructure.map(
      (section: any, sectionIndex: number) => {
        // Ensure title is a string, provide default if missing or not a string
        const sectionTitle =
          typeof section.title === "string"
            ? section.title
            : `Section ${sectionIndex + 1}`;

        const sectionLabels: LabelWithDefault[] = (
          Array.isArray(section.labels) ? section.labels : []
        )
          // Filter for old string format or new object format, and ensure they are not null
          .filter(
            (labelItem) =>
              typeof labelItem === "string" ||
              (typeof labelItem === "object" && labelItem !== null)
          )
          .map((label: any, labelIndex: number) => {
            if (typeof label === "string") {
              // Old format: "LabelName"
              return {
                name: label || `Label ${labelIndex + 1}`,
                defaultValue: null,
              };
            }
            // New format: { name: "...", defaultValue: "..." }
            const labelName =
              typeof label.name === "string"
                ? label.name
                : `Label ${labelIndex + 1}`;
            // Ensure defaultValue is string or null
            const labelDefaultValue =
              label.defaultValue !== undefined && label.defaultValue !== null
                ? String(label.defaultValue)
                : null;
            return { name: labelName, defaultValue: labelDefaultValue };
          });

        return {
          title: sectionTitle,
          labels: sectionLabels,
        };
      }
    );

    setStructureDraft(migratedStructure);
    setStructureError(null);
  };

  const closeStructureEditor = () => {
    setStructureDialog(null);
    setStructureDraft([]);
    setStructureError(null);
  };

  const handleStructureSave = async () => {
    if (!structureDialog) return;

    console.log(
      "Attempting to save structure. Current structureDraft:",
      JSON.parse(JSON.stringify(structureDraft))
    );

    for (let i = 0; i < structureDraft.length; i++) {
      const s = structureDraft[i];

      // Detailed check for the section object itself
      if (!s || typeof s !== "object") {
        setStructureError(
          `Erreur: La section ${i + 1} est invalide ou manquante.`
        );
        console.error("Invalid section object:", s);
        return;
      }

      // Detailed check for section title
      if (s.title === undefined || s.title === null) {
        setStructureError(
          `Erreur: Le titre de la section ${i + 1} est manquant.`
        );
        console.error("Section with missing title property:", s);
        return;
      }
      if (typeof s.title !== "string") {
        setStructureError(
          `Erreur: Le titre de la section ${
            i + 1
          } n'est pas une chaîne de caractères valide.`
        );
        console.error("Section title is not a string:", s);
        return;
      }
      // This is where the original error was:
      if (!s.title.trim()) {
        setStructureError(`Titre de section requis pour la section ${i + 1}.`);
        return;
      }

      // Detailed check for labels array
      if (!Array.isArray(s.labels)) {
        setStructureError(
          `Erreur: Les labels pour la section "${s.title}" (section ${
            i + 1
          }) ne sont pas sous forme de tableau.`
        );
        console.error("Section labels is not an array:", s);
        return;
      }

      for (let j = 0; j < s.labels.length; j++) {
        const l = s.labels[j];
        if (!l || typeof l !== "object") {
          setStructureError(
            `Erreur: Le label ${j + 1} dans la section "${
              s.title
            }" est invalide.`
          );
          console.error("Invalid label object:", l, "in section", s);
          return;
        }
        if (l.name === undefined || l.name === null) {
          setStructureError(
            `Erreur: Le nom du label ${j + 1} dans la section "${
              s.title
            }" est manquant.`
          );
          console.error(
            "Label with missing name property:",
            l,
            "in section",
            s
          );
          return;
        }
        if (typeof l.name !== "string") {
          setStructureError(
            `Erreur: Le nom du label ${j + 1} dans la section "${
              s.title
            }" n'est pas une chaîne de caractères.`
          );
          console.error("Label name is not a string:", l, "in section", s);
          return;
        }
        if (!l.name.trim()) {
          setStructureError(
            `Le nom du label ne peut pas être vide pour le label ${
              j + 1
            } dans la section "${s.title}".`
          );
          return;
        }
        // defaultValue can be null, so no trim check unless it's a string.
        if (l.defaultValue !== null && typeof l.defaultValue !== "string") {
          setStructureError(
            `Erreur: La valeur par défaut du label "${l.name}" dans la section "${s.title}" n'est pas valide (doit être texte ou nulle).`
          );
          console.error(
            "Label defaultValue is not null and not a string:",
            l,
            "in section",
            s
          );
          return;
        }
      }
    }

    setStructureError(null); // Clear error if all validations pass
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ecb_model")
        .update({ structure: structureDraft })
        .eq("id", structureDialog.id);

      if (error) {
        console.error("Error updating structure:", error);
        setStructureError(`Erreur lors de la sauvegarde: ${error.message}`);
      } else {
        closeStructureEditor();
        fetchModels();
      }
    } catch (e: any) {
      console.error("Exception during structure save:", e);
      setStructureError(
        `Erreur inattendue lors de la sauvegarde: ${e.message}`
      );
    } finally {
      setSaving(false);
    }
  };

  const addSection = () =>
    setStructureDraft((prevDraft) => [
      ...prevDraft,
      {
        title: "Nouvelle section",
        labels: [{ name: "Label 1", defaultValue: null }],
      },
    ]);
  const removeSection = (idx: number) =>
    setStructureDraft((prevDraft) => prevDraft.filter((_, i) => i !== idx));

  const updateSectionTitle = (idx: number, title: string) => {
    setStructureDraft((prevDraft) =>
      prevDraft.map((s, i) => (i === idx ? { ...s, title } : s))
    );
  };

  const addLabel = (sectionIdx: number) => {
    setStructureDraft((prevDraft) =>
      prevDraft.map((s, i) =>
        i === sectionIdx
          ? {
              ...s,
              labels: [
                ...s.labels,
                { name: "Nouveau label", defaultValue: null },
              ],
            }
          : s
      )
    );
  };

  const updateLabelField = (
    sectionIdx: number,
    labelIdx: number,
    field: keyof LabelWithDefault,
    value: string
  ) => {
    setStructureDraft((prevDraft) =>
      prevDraft.map((s, i) =>
        i === sectionIdx
          ? {
              ...s,
              labels: s.labels.map((l, j) =>
                j === labelIdx
                  ? {
                      ...l,
                      [field]:
                        field === "defaultValue"
                          ? value === ""
                            ? null
                            : value
                          : value,
                    }
                  : l
              ),
            }
          : s
      )
    );
  };

  const removeLabel = (sectionIdx: number, labelIdx: number) => {
    setStructureDraft((prevDraft) =>
      prevDraft.map((s, i) =>
        i === sectionIdx
          ? { ...s, labels: s.labels.filter((_, j) => j !== labelIdx) }
          : s
      )
    );
  };

  return (
    <div className="w-full mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Gestion des Modèles ECB</h1>
      <div className="mb-6 flex gap-2">
        <Input
          value={newModelName}
          onChange={(e) => setNewModelName(e.target.value)}
          placeholder="Nouveau modèle"
          className="flex-1"
        />
        <Input
          value={newModelDescription}
          onChange={(e) => setNewModelDescription(e.target.value)}
          placeholder="Description (optionnelle)"
          className="flex-1"
        />
        <Button onClick={handleAdd} disabled={saving || !newModelName.trim()}>
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>
      <div className="bg-white rounded shadow p-4">
        {loading ? (
          <div>Chargement...</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 px-2">Nom du modèle</th>
                <th className="text-left py-2 px-2">Description</th>
                <th className="text-left py-2 px-2">Structure</th>
                <th className="w-48 py-2 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <React.Fragment key={model.id}>
                  <tr className="border-t">
                    <td className="py-2 px-2">
                      {editingId === model.id ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="inline-block w-auto"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(model.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <span>{model.name}</span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {editingId === model.id ? (
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="inline-block w-auto"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(model.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      ) : (
                        <span>{model.description}</span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openStructureEditor(model)}
                      >
                        Éditer Structure (
                        {Array.isArray(model.structure)
                          ? model.structure.length
                          : 0}{" "}
                        sections)
                      </Button>
                    </td>
                    <td className="py-2 px-2 text-right">
                      {editingId === model.id ? (
                        <Button
                          size="sm"
                          onClick={() => handleEditSave(model.id)}
                          disabled={saving || !editValue.trim()}
                        >
                          Enregistrer
                        </Button>
                      ) : (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(model)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => setDeleteId(model.id)}
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {structureDialog && structureDialog.id === model.id && (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 border-2 border-blue-200 rounded p-4 bg-slate-50 my-2">
                          <div className="mb-2 font-semibold text-lg">
                            Éditer la structure du modèle:{" "}
                            {structureDialog.name}
                          </div>
                          {structureDraft.map((section, sectionIdx) => (
                            <div
                              key={`section-${sectionIdx}-${structureDialog.id}`}
                              className="border rounded p-3 mb-2 bg-white shadow-sm"
                            >
                              <div className="flex gap-2 items-center mb-2">
                                <Input
                                  value={section.title}
                                  onChange={(e) =>
                                    updateSectionTitle(
                                      sectionIdx,
                                      e.target.value
                                    )
                                  }
                                  placeholder="Titre de section"
                                  className="flex-1 font-medium"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => removeSection(sectionIdx)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <Trash className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="ml-4 space-y-2">
                                {section.labels.map((label, labelIdx) => (
                                  <div
                                    key={`label-${sectionIdx}-${labelIdx}-${structureDialog.id}`}
                                    className="flex gap-2 items-center mb-1"
                                  >
                                    <Input
                                      value={label.name}
                                      onChange={(e) =>
                                        updateLabelField(
                                          sectionIdx,
                                          labelIdx,
                                          "name",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Nom du Label"
                                      className="flex-1"
                                    />
                                    <Input
                                      value={
                                        label.defaultValue === null
                                          ? ""
                                          : label.defaultValue
                                      }
                                      onChange={(e) =>
                                        updateLabelField(
                                          sectionIdx,
                                          labelIdx,
                                          "defaultValue",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Valeur par défaut (optionnel)"
                                      className="flex-1"
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        removeLabel(sectionIdx, labelIdx)
                                      }
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <Trash className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addLabel(sectionIdx)}
                                >
                                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                                  Label
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={addSection}
                            className="mt-2"
                          >
                            <Plus className="w-4 h-4 mr-1" /> Ajouter Section
                          </Button>
                          {structureError && (
                            <div className="text-red-500 text-sm mt-2 p-2 bg-red-100 border border-red-300 rounded">
                              {structureError}
                            </div>
                          )}
                          <div className="flex gap-2 mt-4">
                            <Button
                              onClick={handleStructureSave}
                              disabled={saving}
                            >
                              Enregistrer la structure
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={closeStructureEditor}
                            >
                              Annuler
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Dialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <div>
            Êtes-vous sûr de vouloir supprimer ce modèle ECB ? "
            {models.find((m) => m.id === deleteId)?.name}"
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={saving}
            >
              Supprimer
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDeleteId(null)}
              disabled={saving}
            >
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ECBModelManagementPage;
