import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ATB {
  id: string;
  name: string;
}

const ATBManagementPage: React.FC = () => {
  const [atbs, setAtbs] = useState<ATB[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchATBs = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("atbs").select("*").order("name");
    if (error) setError(error.message);
    else setAtbs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchATBs();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("atbs").insert({ name: newName.trim() });
    if (error) setError(error.message);
    setNewName("");
    fetchATBs();
    setLoading(false);
  };

  const handleEdit = (atb: ATB) => {
    setEditingId(atb.id);
    setEditValue(atb.name);
    setError(null);
  };

  const handleEditSave = async (id: string) => {
    if (!editValue.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("atbs").update({ name: editValue.trim() }).eq("id", id);
    if (error) setError(error.message);
    setEditingId(null);
    setEditValue("");
    fetchATBs();
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from("atbs").delete().eq("id", id);
    if (error) setError(error.message);
    fetchATBs();
    setLoading(false);
    setDeleteId(null);
  };

  return (
    <div className="max-w-xl mx-auto mt-8">
      <h1 className="text-2xl font-bold mb-4">Gestion des ATBs</h1>
      <div className="flex gap-2 mb-4">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nom de l'ATB"
          disabled={loading}
          onKeyDown={e => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <Button onClick={handleAdd} disabled={loading || !newName.trim()}>
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="text-left p-2 border">Nom</th>
            <th className="text-left p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {atbs.map(atb => (
            <tr key={atb.id}>
              <td className="p-2 border">
                {editingId === atb.id ? (
                  <Input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") handleEditSave(atb.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  atb.name
                )}
              </td>
              <td className="p-2 border">
                {editingId === atb.id ? (
                  <Button size="sm" onClick={() => handleEditSave(atb.id)} disabled={loading || !editValue.trim()}>
                    Enregistrer
                  </Button>
                ) : (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(atb)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="destructive" onClick={() => setDeleteId(atb.id)} disabled={loading}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <div>Êtes-vous sûr de vouloir supprimer cet ATB&nbsp;?</div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} disabled={loading}>
              Supprimer
            </Button>
            <Button variant="ghost" onClick={() => setDeleteId(null)} disabled={loading}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ATBManagementPage;
