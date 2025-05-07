import React, { useState, useEffect, FormEvent, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient";

// Import shadcn/ui components and icons
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { cn, generateId, validateId, validateIdOnEdit } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { extractId } from "@/lib/utils";

import {
  Calendar as CalendarIcon,
  AlertCircle,
  Loader2,
  ArrowLeft,
  UserPlus,
  Edit,
} from "lucide-react"; // Added Edit icon
import { format, parseISO } from "date-fns"; // Added parseISO
import { fr } from "date-fns/locale";

type PatientFormData = Omit<
  Tables<"patient">,
  "id" | "created_at" | "updated_at"
>;

const PatientFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>(); // Get patientId from URL
  const isEditMode = Boolean(patientId); // Determine mode based on patientId presence

  const [formData, setFormData] = useState<Partial<PatientFormData>>({});
  const [existingId, setExistingId] = useState("");
  const [loading, setLoading] = useState(false); // For form submission
  const [initialLoading, setInitialLoading] = useState(isEditMode); // For fetching data in edit mode
  const [error, setError] = useState<string | null>(null);
  const [dobOpen, setDobOpen] = useState(false);

  // Fetch existing patient data in Edit mode
  const fetchPatientData = useCallback(async () => {
    if (!isEditMode || !patientId) {
      setInitialLoading(false); // No initial loading needed for create mode
      return;
    }
    setInitialLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("patient")
        .select("*")
        .eq("id", patientId)
        .single(); // Fetch the specific patient

      if (fetchError) throw fetchError;

      if (data) {
        // Pre-populate form data, handle nulls correctly
        setFormData({
          patient_unique_id: data.patient_unique_id || "",
          full_name: data.full_name || "",
          // Ensure date_of_birth is a string 'yyyy-MM-dd' if not null, otherwise undefined
          date_of_birth: data.date_of_birth
            ? format(parseISO(data.date_of_birth), "yyyy-MM-dd")
            : undefined,
          gender: data.gender || undefined,
          phone: data.phone || "",
        });
        setExistingId(data.patient_unique_id);
      } else {
        setError("Patient non trouvé."); // Handle case where ID is valid UUID but no patient exists
      }
    } catch (err: unknown) {
      console.error("Erreur lors de la récupération du patient:", err);
      setError(
        (err instanceof Error ? err.message : null) ||
          "Impossible de charger les données du patient."
      );
    } finally {
      setInitialLoading(false);
    }
  }, [isEditMode, patientId]);

  useEffect(() => {
    fetchPatientData();
  }, [fetchPatientData]); // Run fetch on mount/patientId change

  // --- Input Handlers (remain the same) ---
  //   // Generic handler for text/tel inputs
  //   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //     const { name, value } = e.target;
  //     setFormData((prev) => ({ ...prev, [name]: value }));
  //   };

  //   // Handler for Select component
  //   const handleSelectChange = (name: keyof PatientFormData, value: string) => {
  //     setFormData((prev) => ({ ...prev, [name]: value }));
  //   };

  //   // Handler for DatePicker
  //   const handleDateChange = (date: Date | undefined) => {
  //     setFormData((prev) => ({
  //       ...prev,
  //       date_of_birth: date ? format(date, "yyyy-MM-dd") : undefined,
  //     }));
  //     setDobOpen(false); // Close popover on select
  //   };
  // Re-add handlers here for completeness
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  function handleIdGeneration() {
    if (!isEditMode) {
      if (!validateId(formData.patient_unique_id as string)) {
        setError(
          "L'ID Unique doit commencer par 0 suivi d'un nombre, Ex: 021  , le reste est auto-généré ."
        );
        return;
      }
      setFormData((prev) => ({
        ...prev,
        patient_unique_id: generateId(prev.patient_unique_id as string),
      }));
    } else {
      // validate id on edit
      if (!validateIdOnEdit(existingId, formData.patient_unique_id as string)) {
        setError(
          "Format invalide. Seul l'ID (avant le premier trait d'union) peut être modifié.ex: 021-06-0525, seul 021 peut être modifié."
        );
        setFormData((prev) => ({
          ...prev,
          patient_unique_id: existingId,
        }));
        return;
      }
    }
  }

  const handleSelectChange = (name: keyof PatientFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value === "" ? undefined : value,
    })); // Handle empty selection as undefined?
  };
  const handleDateChange = (date: Date | undefined) => {
    setFormData((prev) => ({
      ...prev,
      date_of_birth: date ? format(date, "yyyy-MM-dd") : undefined,
    }));
    setDobOpen(false);
  };
  // --- End Input Handlers ---

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!formData.patient_unique_id || !formData.full_name) {
      setError("L'ID Unique et le Nom Complet sont requis.");
      return;
    }

    setLoading(true);

    try {
      // Prepare data for Supabase (ensure optional fields are null if empty/undefined)
      const dataPayload = {
        patient_unique_id: formData.patient_unique_id.trim(),
        full_name: formData.full_name.trim(),
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
        phone: formData.phone?.trim() || null,
      };

      let responseError = null;

      if (isEditMode) {
        // Update existing patient
        const { error: updateError } = await supabase
          .from("patient")
          .update(dataPayload)
          .eq("id", patientId as string); // Ensure patientId is passed
        responseError = updateError;
      } else {
        // Insert new patient
        const { error: insertError } = await supabase
          .from("patient")
          .insert({
            ...dataPayload,
            patient_unique_id: `${dataPayload.patient_unique_id}#${uuidv4()}`,
          });
        responseError = insertError;
      }

      if (responseError) {
        if (responseError.code === "23505") {
          setError(
            "Cet ID Unique de patient existe déjà. Veuillez en utiliser un autre."
          );
        } else {
          throw responseError; // Rethrow other errors
        }
      } else {
        // Success! Navigate back to the patient list (or detail page after edit?)
        navigate("/patients");
      }
    } catch (err: unknown) {
      console.error(
        `Erreur lors de ${
          isEditMode ? "la mise à jour" : "la création"
        } du patient:`,
        err
      );
      setError(
        (err instanceof Error ? err.message : null) ||
          `Une erreur est survenue lors de ${
            isEditMode ? "la mise à jour" : "l'enregistrement"
          }.`
      );
    } finally {
      setLoading(false);
    }
  };

  // --- Render Logic ---

  // Show loading skeletons while fetching data in edit mode
  if (initialLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" /> {/* Back button skeleton */}
        <Card className="shadow-md">
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24 ml-auto" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Main Render
  return (
    <div className="max-w-2xl mx-auto">
      {/* Back Button */}
      <div className="mb-4">
        <Link to="/patients">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Button>
        </Link>
      </div>

      {/* Form Card */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            {/* Dynamic Icon and Title */}
            {isEditMode ? (
              <Edit className="h-5 w-5" />
            ) : (
              <UserPlus className="h-5 w-5" />
            )}
            {isEditMode ? "Modifier le Patient" : "Ajouter un Nouveau Patient"}
          </CardTitle>
          <CardDescription>
            {isEditMode
              ? "Mettez à jour les informations du patient ci-dessous."
              : "Remplissez les informations ci-dessous pour enregistrer un nouveau patient."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Unique ID - Disable in Edit Mode */}
            <div className="space-y-2">
              <Label htmlFor="patient_unique_id" className="font-semibold">
                ID Unique Patient <span className="text-destructive">*</span>
              </Label>
              <Input
                id="patient_unique_id"
                name="patient_unique_id"
                placeholder="Ex: 021"
                required
                value={formData.patient_unique_id || ""}
                onChange={handleInputChange}
                disabled={loading} // Disable if loading or in edit mode
                // className={cn(isEditMode && "bg-muted/50 cursor-not-allowed")} // Style disabled field
                onBlur={handleIdGeneration}
              />
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name" className="font-semibold">
                Nom Complet <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                name="full_name"
                placeholder="Ex: Jean Dupont"
                required
                value={formData.full_name || ""}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>

            {/* Optional Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Date of Birth */}
              <div className="hidden space-y-2">
                <Label htmlFor="date_of_birth" className="font-semibold">
                  Date de Naissance
                </Label>
                <Popover open={dobOpen} onOpenChange={setDobOpen}>
                  {/* ... PopoverTrigger (Button) ... */}
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal h-10",
                        !formData.date_of_birth && "text-muted-foreground"
                      )}
                      disabled={loading}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {/* Parse date string before formatting */}
                      {formData.date_of_birth ? (
                        format(parseISO(formData.date_of_birth), "PPP", {
                          locale: fr,
                        })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  {/* ... PopoverContent (Calendar) ... */}
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      // Parse date string for selected prop
                      selected={
                        formData.date_of_birth
                          ? parseISO(formData.date_of_birth)
                          : undefined
                      }
                      onSelect={handleDateChange}
                      initialFocus
                      locale={fr}
                      captionLayout="dropdown-buttons"
                      fromYear={1900}
                      toYear={new Date().getFullYear()}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <Label htmlFor="gender" className="font-semibold">
                  Genre
                </Label>
                <Select
                  name="gender"
                  value={formData.gender || ""} // Use '' for placeholder compatibility
                  onValueChange={(value) => handleSelectChange("gender", value)}
                  disabled={loading}
                >
                  <SelectTrigger id="gender" className="h-10">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculin">Masculin</SelectItem>
                    <SelectItem value="Féminin">Féminin</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="font-semibold">
                  Téléphone
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="Ex: +33 6 12 34 56 78"
                  value={formData.phone || ""}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4 flex justify-between">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? "Mise à jour..." : "Enregistrement..."}
                </>
              ) : // Dynamic Button Text
              isEditMode ? (
                "Mettre à jour le Patient"
              ) : (
                "Enregistrer le Patient"
              )}
            </Button>
            <Link to="/patients">
              <Button type="button" variant="outline" disabled={loading}>
                Annuler
              </Button>
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default PatientFormPage;
