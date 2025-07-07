// src/components/app/doctors/CreateDoctorDialog.tsx
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient"; // Adjust as needed
import { Database } from "@/lib/database.types"; // Adjust as needed
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose, // Or manage open state with prop
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // For Bio
import { Loader2, Save, UserPlus, AlertTriangle } from "lucide-react";
import { toast as sonnerToast } from "sonner";

type Doctor = Database["public"]["Tables"]["doctor"]["Row"];

interface CreateDoctorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDoctorCreated: () => void; // Callback after successful creation
}

export function CreateDoctorDialog({
  open,
  onOpenChange,
  onDoctorCreated,
}: CreateDoctorDialogProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [hospital, setHospital] = useState("");
  const [bio, setBio] = useState("");

  const [similarDoctors, setSimilarDoctors] = useState<
    Pick<Doctor, "id" | "full_name" | "hospital">[]
  >([]);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Debounce function
  const debounce = <F extends (...args: any[]) => any>(
    func: F,
    waitFor: number
  ) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
      new Promise((resolve) => {
        if (timeout) {
          clearTimeout(timeout);
        }
        timeout = setTimeout(() => resolve(func(...args)), waitFor);
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkSimilarNames = useCallback(
    debounce(async (name: string) => {
      if (name.trim().length < 3) {
        // Only search if name is reasonably long
        setSimilarDoctors([]);
        return;
      }
      setIsCheckingName(true);
      const { data, error } = await supabase
        .from("doctor")
        .select("id, full_name, hospital")
        .ilike("full_name", `%${name.trim()}%`) // Case-insensitive search
        .limit(5); // Limit results to avoid overwhelming UI

      if (error) {
        console.error("Error checking similar names:", error);
        // Don't show toast for this, just silently fail or log
      } else {
        setSimilarDoctors(data || []);
      }
      setIsCheckingName(false);
    }, 500), // 500ms debounce
    []
  );

  useEffect(() => {
    if (fullName) {
      checkSimilarNames(fullName);
    } else {
      setSimilarDoctors([]); // Clear if name is empty
    }
  }, [fullName, checkSimilarNames]);

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setHospital("");
    setBio("");
    setSimilarDoctors([]);
    setIsCheckingName(false);
  };

  const handleOpenChangeWithReset = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm(); // Reset form when dialog closes
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      sonnerToast.error("Nom Complet Requis", {
        description: "Veuillez entrer le nom complet du médecin.",
      });
      return;
    }
    setIsSaving(true);

    const { data, error } = await supabase
      .from("doctor")
      .insert({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        hospital: hospital.trim() || null,
        bio: bio.trim() || null,
      })
      .select()
      .single();

    setIsSaving(false);

    if (error) {
      sonnerToast.error("Erreur d'enregistrement", {
        description: error.message,
      });
      console.error("Error creating doctor:", error);
    } else if (data) {
      sonnerToast.success("Médecin Créé", {
        description: `Le Dr. ${data.full_name} a été ajouté avec succès.`,
      });
      resetForm();
      onDoctorCreated(); // Call the callback
      onOpenChange(false); // Close dialog
      // window.location.reload(); // Reload window as requested
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChangeWithReset}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <UserPlus className="mr-2 h-5 w-5" />
            Ajouter un Nouveau Médecin
          </DialogTitle>
          <DialogDescription>
            Remplissez les informations ci-dessous. Une vérification des noms
            similaires sera effectuée.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label htmlFor="fullName">
              Nom Complet <span className="text-red-500">*</span>
            </Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. Prénom Nom"
              required
              className="mt-1"
            />
            {isCheckingName && (
              <p className="text-xs text-slate-500 mt-1 flex items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-1" /> Vérification
                des noms...
              </p>
            )}
            {similarDoctors.length > 0 && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                <div className="flex items-center text-amber-700">
                  <AlertTriangle className="h-4 w-4 mr-2 shrink-0" />
                  <p className="text-sm font-medium">
                    Des médecins avec des noms similaires existent déjà :
                  </p>
                </div>
                <ul className="list-disc list-inside mt-1 pl-2 text-sm text-amber-600 space-y-0.5">
                  {similarDoctors.map((doc) => (
                    <li key={doc.id}>
                      {doc.full_name} {doc.hospital && `(${doc.hospital})`}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-500 mt-1.5">
                  Veuillez vérifier pour éviter les doublons avant de continuer.
                </p>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Numéro de téléphone"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="hospital">Hôpital/Clinique Principal(e)</Label>
            <Input
              id="hospital"
              value={hospital}
              onChange={(e) => setHospital(e.target.value)}
              placeholder="Nom de l'établissement"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="bio">Bio/Notes</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Courte description ou notes sur le médecin..."
              className="mt-1"
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSaving}>
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSaving || isCheckingName}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Enregistrer le Médecin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
