// src/pages/DoctorFormPage.tsx

import React, { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient"; // Adjust path

// --- Shadcn/ui Imports ---
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path
import { Button } from "@/components/ui/button"; // Adjust path
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Adjust path
import { Input } from "@/components/ui/input"; // Adjust path
import { Label } from "@/components/ui/label"; // Adjust path
import { Skeleton } from "@/components/ui/skeleton"; // Adjust path
import { Textarea } from "@/components/ui/textarea"; // Adjust path

// --- Icons ---
import {
  AlertCircle,
  ArrowLeft,
  Edit,
  Loader2,
  Save,
  UserPlus,
} from "lucide-react";

// --- Types ---
type Doctor = Tables<"doctor">;
// Type for form data, making optional fields potentially undefined initially
type DoctorFormData = Partial<Omit<Doctor, "id" | "created_at" | "updated_at">>;

// --- Component ---
const DoctorFormPage: React.FC = () => {
  // --- Hooks ---
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(doctorId);

  // --- State ---
  const [formData, setFormData] = useState<DoctorFormData>({
    full_name: "",
    phone: "",
    hospital: "",
    bio: "",
  });
  const [initialLoading, setInitialLoading] = useState<boolean>(isEditMode); // Load only if editing
  const [loadingSubmit, setLoadingSubmit] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // --- End State ---

  // --- Data Fetching (Edit Mode) ---
  const fetchDoctorData = useCallback(async () => {
    if (!isEditMode || !doctorId) {
      setInitialLoading(false);
      return;
    }
    setInitialLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("doctor")
        .select("*")
        .eq("id", doctorId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Médecin non trouvé.");

      // Populate state, handling nulls from DB
      setFormData({
        full_name: data.full_name || "",
        phone: data.phone || "",
        hospital: data.hospital || "",
        bio: data.bio || "",
      });
    } catch (err: unknown) {
      console.error("Erreur chargement médecin:", err);
      if (err instanceof Error) {
        setError(
          err.message || "Impossible de charger les données du médecin."
        );
      } else {
        setError("Une erreur inconnue est survenue.");
      }
    } finally {
      setInitialLoading(false);
    }
  }, [isEditMode, doctorId]);

  useEffect(() => {
    fetchDoctorData();
  }, [fetchDoctorData]);
  // --- End Data Fetching ---

  // --- Input Handlers ---
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  // --- End Input Handlers ---

  // --- Form Submission ---
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    // Validation
    if (!formData.full_name || !formData.full_name.trim()) {
      setError("Le nom complet du médecin est requis.");
      return;
    }

    setLoadingSubmit(true);

    try {
      // Prepare payload, ensuring empty strings become null for optional fields
      const payload = {
        full_name: formData.full_name.trim(),
        phone: formData.phone?.trim() || null,
        hospital: formData.hospital?.trim() || null,
        bio: formData.bio?.trim() || null,
      };

      let responseError = null;

      if (isEditMode) {
        // --- Update ---
        const { error: updateError } = await supabase
          .from("doctor")
          .update(payload)
          .eq("id", doctorId!); // doctorId is guaranteed in edit mode
        responseError = updateError;
      } else {
        // --- Insert ---
        const { error: insertError } = await supabase
          .from("doctor")
          .insert(payload);
        responseError = insertError;
      }

      if (responseError) {
        // Basic check for unique constraint if you added one later
        if (responseError.code === "23505") {
          setError(
            "Un médecin avec ces informations (ex: nom) existe peut-être déjà."
          );
        } else {
          throw responseError; // Rethrow other errors
        }
      } else {
        // Success
        navigate("/doctors"); // Navigate back to list
      }
    } catch (err: unknown) {
      console.error(
        `Erreur ${isEditMode ? "mise à jour" : "création"} médecin:`,
        err
      );
      if (err instanceof Error) {
        setError(
          err.message ||
            `Une erreur est survenue lors de ${
              isEditMode ? "la mise à jour" : "l'enregistrement"
            }.`
        );
      } else {
        setError(
          `Une erreur inconnue est survenue lors de ${
            isEditMode ? "la mise à jour" : "l'enregistrement"
          }.`
        );
      }
    } finally {
      setLoadingSubmit(false);
    }
  };
  // --- End Form Submission ---

  // --- Render Logic ---
  if (initialLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" /> {/* Back button */}
        <Card>
          <CardHeader>
            {" "}
            <Skeleton className="h-6 w-1/2" />{" "}
            <Skeleton className="h-4 w-3/4" />{" "}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-32" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back Button */}
      <div className="mb-4">
        <Link to="/doctors">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="shadow-md">
          {/* Card Header */}
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              {isEditMode ? (
                <Edit className="h-5 w-5" />
              ) : (
                <UserPlus className="h-5 w-5" />
              )}
              {isEditMode
                ? "Modifier le Médecin"
                : "Ajouter un Nouveau Médecin"}
            </CardTitle>
            <CardDescription>
              {isEditMode
                ? "Mettez à jour les informations du médecin."
                : "Entrez les informations du nouveau médecin."}
            </CardDescription>
          </CardHeader>

          {/* Card Content - Form Fields */}
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription className="whitespace-pre-line">
                  {error}
                </AlertDescription>
              </Alert>
            )}
            {/* Full Name (Required) */}
            <div className="space-y-2">
              <Label htmlFor="full_name" className="font-semibold">
                Nom Complet <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                name="full_name"
                value={formData.full_name || ""}
                onChange={handleInputChange}
                placeholder="Ex: Dr. Alain Dupont"
                disabled={loadingSubmit}
                required
                className="h-10"
              />
            </div>
            {/* Optional Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="font-semibold">
                  Téléphone
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone || ""}
                  onChange={handleInputChange}
                  placeholder="Ex: +33 6 11 22 33 44"
                  disabled={loadingSubmit}
                  className="h-10"
                />
              </div>
              {/* Hospital */}
              <div className="space-y-2">
                <Label htmlFor="hospital" className="font-semibold">
                  Hôpital / Clinique
                </Label>
                <Input
                  id="hospital"
                  name="hospital"
                  value={formData.hospital || ""}
                  onChange={handleInputChange}
                  placeholder="Ex: Hôpital Central"
                  disabled={loadingSubmit}
                  className="h-10"
                />
              </div>
            </div>
            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio" className="font-semibold">
                Bio / Notes (Optionnel)
              </Label>
              <Textarea
                id="bio"
                name="bio"
                value={formData.bio || ""}
                onChange={handleInputChange}
                placeholder="Spécialité, notes importantes..."
                disabled={loadingSubmit}
                rows={4}
              />
            </div>
          </CardContent>

          {/* Card Footer */}
          <CardFooter className="border-t px-6 py-4 flex justify-between">
            <Button type="submit" disabled={loadingSubmit || initialLoading}>
              {loadingSubmit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEditMode
                    ? "Enregistrer les Modifications"
                    : "Enregistrer le Médecin"}
                </>
              )}
            </Button>
            <Link to="/doctors">
              <Button type="button" variant="outline" disabled={loadingSubmit}>
                Annuler
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};

export default DoctorFormPage;
