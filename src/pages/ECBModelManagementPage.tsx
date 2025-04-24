import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Section {
  title: string;
  labels: string[];
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

  // Fetch models
  const fetchModels = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ecb_model")
      .select("id, name, description, structure, created_at")
      .order("created_at");
    if (!error) setModels(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchModels();
  }, []);

  // Edit model name/desc
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
  // Delete model
  const handleDelete = async (id: string) => {
    setSaving(true);
    await supabase.from("ecb_model").delete().eq("id", id);
    fetchModels();
    setSaving(false);
    setDeleteId(null);
  };
  // Add model
  const handleAdd = async () => {
    if (!newModelName.trim()) return;
    setSaving(true);
    await supabase.from("ecb_model").insert({
      name: newModelName.trim(),
      description: newModelDescription.trim(),
      structure: JSON.stringify([])
    });
    setNewModelName("");
    setNewModelDescription("");
    setSaving(false);
    fetchModels();
  };

  // Structure editor logic
  const openStructureEditor = (model: EcbModel) => {
    setStructureDialog(model);
    setStructureDraft(Array.isArray(model.structure) ? model.structure : []);
    setStructureError(null);
  };
  const closeStructureEditor = () => {
    setStructureDialog(null);
    setStructureDraft([]);
    setStructureError(null);
  };
  const handleStructureSave = async () => {
    if (!structureDialog) return;
    // Validation: section titles and labels must not be empty
    for (const s of structureDraft) {
      if (!s.title.trim()) {
        setStructureError("Titre de section requis");
        return;
      }
      if (!Array.isArray(s.labels) || s.labels.some(l => !l.trim())) {
        setStructureError("Chaque section doit avoir des labels non vides");
        return;
      }
    }
    setSaving(true);
    await supabase
      .from("ecb_model")
      .update({ structure: structureDraft })
      .eq("id", structureDialog.id);
    setSaving(false);
    closeStructureEditor();
    fetchModels();
  };

  // Section/label editing helpers
  const addSection = () => setStructureDraft([...structureDraft, { title: "Nouvelle section", labels: ["Label 1"] }]);
  const removeSection = (idx: number) => setStructureDraft(structureDraft.filter((_, i) => i !== idx));
  const updateSectionTitle = (idx: number, title: string) => setStructureDraft(structureDraft.map((s, i) => i === idx ? { ...s, title } : s));
  const addLabel = (sectionIdx: number) => setStructureDraft(structureDraft.map((s, i) => i === sectionIdx ? { ...s, labels: [...s.labels, "Nouveau label"] } : s));
  const updateLabel = (sectionIdx: number, labelIdx: number, label: string) => setStructureDraft(structureDraft.map((s, i) => i === sectionIdx ? { ...s, labels: s.labels.map((l, j) => j === labelIdx ? label : l) } : s));
  const removeLabel = (sectionIdx: number, labelIdx: number) => setStructureDraft(structureDraft.map((s, i) => i === sectionIdx ? { ...s, labels: s.labels.filter((_, j) => j !== labelIdx) } : s));

  return (
    <div className="w-full mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Gestion des Modèles ECB</h1>
      <div className="mb-6 flex gap-2">
        <Input
          value={newModelName}
          onChange={e => setNewModelName(e.target.value)}
          placeholder="Nouveau modèle"
          className="flex-1"
        />
        <Input
          value={newModelDescription}
          onChange={e => setNewModelDescription(e.target.value)}
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
                <th className="text-left py-2">Nom du modèle</th>
                <th className="text-left py-2">Description</th>
                <th className="text-left py-2">Structure</th>
                <th className="w-48"></th>
              </tr>
            </thead>
            <tbody>
              {models.map(model => (
                <React.Fragment key={model.id}>
                  <tr>
                    <td className="py-2">
                      {editingId === model.id ? (
                        <Input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="inline-block w-auto"
                          onKeyDown={e => {
                            if (e.key === "Enter") handleEditSave(model.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <span>{model.name}</span>
                      )}
                    </td>
                    <td className="py-2">
                      {editingId === model.id ? (
                        <Input
                          value={editDescription}
                          onChange={e => setEditDescription(e.target.value)}
                          className="inline-block w-auto"
                          onKeyDown={e => {
                            if (e.key === "Enter") handleEditSave(model.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                      ) : (
                        <span>{model.description}</span>
                      )}
                    </td>
                    <td className="py-2">
                      <Button size="sm" variant="outline" onClick={() => openStructureEditor(model)}>
                        Éditer Structure
                      </Button>
                    </td>
                    <td>
                      {editingId === model.id ? (
                        <Button size="sm" onClick={() => handleEditSave(model.id)} disabled={saving || !editValue.trim()}>
                          Enregistrer
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(model)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="destructive" onClick={() => setDeleteId(model.id)}>
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {structureDialog && structureDialog.id === model.id && (
                    <tr>
                      <td colSpan={4}>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 border rounded p-4 bg-muted">
                          <div className="mb-2 font-semibold text-lg">Éditer la structure du modèle</div>
                          {structureDraft.map((section, idx) => (
                            <div key={idx} className="border rounded p-3 mb-2">
                              <div className="flex gap-2 items-center mb-2">
                                <Input
                                  value={section.title}
                                  onChange={e => updateSectionTitle(idx, e.target.value)}
                                  placeholder="Titre de section"
                                  className="flex-1"
                                />
                                <Button size="icon" variant="destructive" onClick={() => removeSection(idx)}>
                                  <Trash className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="ml-4 space-y-1">
                                {section.labels.map((label, labelIdx) => (
                                  <div key={labelIdx} className="flex gap-2 items-center mb-1">
                                    <Input
                                      value={label}
                                      onChange={e => updateLabel(idx, labelIdx, e.target.value)}
                                      placeholder="Label"
                                      className="flex-1"
                                    />
                                    <Button size="icon" variant="destructive" onClick={() => removeLabel(idx, labelIdx)}>
                                      <Trash className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button size="sm" variant="outline" onClick={() => addLabel(idx)}>
                                  <Plus className="w-4 h-4 mr-1" /> Ajouter Label
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button size="sm" variant="secondary" onClick={addSection}>
                            <Plus className="w-4 h-4 mr-1" /> Ajouter Section
                          </Button>
                          {structureError && <div className="text-red-500 text-sm">{structureError}</div>}
                          <div className="flex gap-2 mt-4">
                            <Button onClick={handleStructureSave} disabled={saving}>Enregistrer la structure</Button>
                            <Button variant="ghost" onClick={closeStructureEditor}>Annuler</Button>
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
      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <div>Êtes-vous sûr de vouloir supprimer ce modèle ECB&nbsp;?</div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} disabled={saving}>
              Supprimer
            </Button>
            <Button variant="ghost" onClick={() => setDeleteId(null)} disabled={saving}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ECBModelManagementPage;
