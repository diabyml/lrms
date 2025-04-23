import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface SkipValue {
  id: number;
  value: string;
  type: "category" | "test_type";
}

const SkipRangeManagementPage: React.FC = () => {
  const [skipValues, setSkipValues] = useState<SkipValue[]>([]);
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState<"category" | "test_type">("category");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchSkipValues = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from("skip_range_check").select("id, value, type").order("type").order("value");
    if (!error && data) {
      setSkipValues(data);
    } else {
      setError("Erreur lors du chargement des valeurs.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSkipValues();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.from("skip_range_check").insert({ value: newValue.trim(), type: newType });
    if (error) {
      setError("Erreur lors de l'ajout.");
    } else {
      setNewValue("");
      fetchSkipValues();
    }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.from("skip_range_check").delete().eq("id", id);
    if (error) {
      setError("Erreur lors de la suppression.");
    } else {
      fetchSkipValues();
    }
    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      <Card>
        <CardHeader>
          <CardTitle>Gestion des valeurs à ignorer pour le contrôle des plages</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-2 mb-6">
            <Input
              placeholder="Nom de la catégorie ou du test type"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              disabled={loading}
              required
            />
            <Select value={newType} onValueChange={v => setNewType(v as any)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Catégorie</SelectItem>
                <SelectItem value="test_type">Test Type</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={loading}>Ajouter</Button>
          </form>
          {error && <div className="text-red-500 mb-2">{error}</div>}
          {loading ? (
            <div>Chargement…</div>
          ) : (
            <ul className="space-y-2">
              {skipValues.map(({ id, value, type }) => (
                <li key={id} className="flex items-center justify-between border-b pb-2">
                  <span>
                    <span className="font-semibold">{type === "category" ? "Catégorie" : "Test Type"}:</span> {value}
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={loading} onClick={() => setDeleteId(id)}>
                        Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                        <AlertDialogDescription>
                          Voulez-vous vraiment supprimer cette valeur à ignorer ? Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                          <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Annuler
                          </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button
                            variant="destructive"
                            onClick={async () => {
                              await handleDelete(id);
                              setDeleteId(null);
                            }}
                          >
                            Supprimer
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SkipRangeManagementPage;
