import { cn } from "@/lib/utils"; // Adjust path
import React, {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner"; // Use sonner toast
import { supabase, Tables } from "../lib/supabaseClient"; // Adjust path

// --- Shadcn/ui Imports ---
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Adjust path
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Adjust path
import { Button, buttonVariants } from "@/components/ui/button"; // Adjust path
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Adjust path
import { Input } from "@/components/ui/input"; // Adjust path
import { Label } from "@/components/ui/label"; // Adjust path
import { Progress } from "@/components/ui/progress"; // Adjust path
import { Skeleton } from "@/components/ui/skeleton"; // Adjust path

// --- Icons ---
import {
  AlertCircle,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Save,
  Upload,
} from "lucide-react";

// --- Component Imports ---
// Assuming HeaderTemplateSelector is correctly implemented as per previous step
import Template1 from "@/components/print_header/Template1"; // Adjust path
import Template2 from "@/components/print_header/Template2"; // Adjust path
import Template3 from "@/components/print_header/Template3";
import Template4 from "@/components/print_header/Template4";
import Template5 from "@/components/print_header/Template5";

import HeaderTemplateSelector, {
  HeaderTemplateOption,
} from "@/components/settings/HeaderTemplateSelector"; // Adjust path
// Import other templates if you created more...

// --- Types ---
// Ensure this matches your generated types after adding selected_template
type PrintConfig = Tables<"print_header_config">;
// FormData excludes fields managed separately (like id, timestamps, and selected_template)
type PrintConfigFormData = Partial<
  Omit<PrintConfig, "id" | "created_at" | "updated_at" | "selected_template">
>;

// --- Constants ---
const LOGO_STORAGE_PATH = "public";
const LOGO_FILE_NAME_BASE = "header-logo"; // Consistent name for overwriting

// Define available templates
const availableHeaderTemplates: HeaderTemplateOption[] = [
  { id: "template1", name: "Classique (Logo à Gauche)", component: Template1 },
  { id: "template2", name: "Centré (Logo au Dessus)", component: Template2 },
  { id: "template3", name: "Centré (Avec Séparateur)", component: Template3 }, // Add Template 3
  { id: "template4", name: "Moderne (Divisé)", component: Template4 }, // Add Template 4
  // { id: "template5", name: "Moderne shadow encercle", component: Template5 }, // Add Template 5
  // Add more template definitions here
  // { id: 'template3', name: 'Modèle 3', component: Template3 },
];
const defaultTemplateId = "template1"; // Define the default template ID

// --- Component ---
const PrintHeaderDesignPage: React.FC = () => {
  // --- State ---
  const [configId, setConfigId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PrintConfigFormData>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<string>(defaultTemplateId); // State for selected template ID
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadingInitialData, setLoadingInitialData] = useState<boolean>(true);
  const [loadingSubmit, setLoadingSubmit] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // --- End State ---

  // --- Data Fetching ---
  const fetchConfig = useCallback(async () => {
    setLoadingInitialData(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("print_header_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setConfigId(data.id);
        setFormData({
          lab_name: data.lab_name,
          address_line1: data.address_line1,
          address_line2: data.address_line2,
          city_postal_code: data.city_postal_code,
          phone: data.phone,
          email: data.email,
          website: data.website,
        });
        setLogoUrl(data.logo_url);
        setSelectedTemplate(data.selected_template || defaultTemplateId);
      } else {
        setConfigId(null);
        setFormData({});
        setLogoUrl(null);
        setSelectedTemplate(defaultTemplateId);
      }
    } catch (err: unknown) {
      console.error("Erreur chargement configuration:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger la configuration de l'en-tête."
      );
    } finally {
      setLoadingInitialData(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);
  // --- End Data Fetching ---

  // --- Input Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
      setLogoPreviewUrl(null);
    } // Clean previous first
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
      const previewUrl = URL.createObjectURL(file);
      setLogoPreviewUrl(previewUrl);
    } else {
      setSelectedFile(null);
    }
  };

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);
  // --- End Input Handlers ---

  // --- Logo Upload ---
  const handleLogoUpload = async (): Promise<string | null> => {
    if (!selectedFile) return logoUrl;
    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      const fileExt =
        selectedFile.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `${LOGO_STORAGE_PATH}/${LOGO_FILE_NAME_BASE}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(filePath, selectedFile, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(filePath);
      if (!urlData?.publicUrl)
        throw new Error("Impossible d'obtenir l'URL publique du logo.");
      const finalUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;
      setLogoUrl(finalUrl);
      setSelectedFile(null);
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
        setLogoPreviewUrl(null);
      }
      return finalUrl;
    } catch (err: unknown) {
      console.error("Erreur upload logo:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Échec de l'upload du logo.";
      setUploadError(errorMsg);
      toast.error("Erreur Upload Logo", { description: errorMsg });
      return logoUrl;
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };
  // --- End Logo Upload ---

  // --- Form Submission ---
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setUploadError(null); // Clear errors before attempting save
    setLoadingSubmit(true);

    try {
      let finalLogoUrl = logoUrl;
      if (selectedFile) {
        finalLogoUrl = await handleLogoUpload();
        if (!finalLogoUrl || uploadError) {
          // Check if upload failed
          setError(
            uploadError || "L'upload du logo a échoué. Veuillez réessayer."
          );
          setLoadingSubmit(false);
          return;
        }
      }

      const payload = {
        lab_name: formData.lab_name?.trim() || null,
        address_line1: formData.address_line1?.trim() || null,
        address_line2: formData.address_line2?.trim() || null,
        city_postal_code: formData.city_postal_code?.trim() || null,
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
        website: formData.website?.trim() || null,
        logo_url: finalLogoUrl,
        selected_template: selectedTemplate, // Include selected template
      };

      let responseError = null;
      let savedData: PrintConfig | null = null;

      if (configId) {
        const { data, error } = await supabase
          .from("print_header_config")
          .update(payload)
          .eq("id", configId)
          .select()
          .single();
        responseError = error;
        savedData = data;
      } else {
        const { data, error } = await supabase
          .from("print_header_config")
          .insert(payload)
          .select()
          .single();
        responseError = error;
        savedData = data;
        if (savedData?.id) setConfigId(savedData.id);
      }
      if (responseError) throw responseError;

      toast.success("Configuration Enregistrée", {
        description: "L'en-tête d'impression a été mis à jour avec succès.",
        duration: 3000,
      });
    } catch (err: unknown) {
      console.error("Erreur sauvegarde configuration:", err);
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de l'enregistrement.";
      setError(errorMsg);
      toast.error("Erreur Sauvegarde", { description: errorMsg });
    } finally {
      setLoadingSubmit(false);
    }
  };
  // --- End Form Submission ---

  // --- Dynamic Preview ---
  const CurrentPreviewComponent = useMemo(() => {
    return (
      availableHeaderTemplates.find((t) => t.id === selectedTemplate)
        ?.component || Template1
    );
  }, [selectedTemplate]);

  const previewDataProps = useMemo(
    () => ({
      logoUrl: logoPreviewUrl || logoUrl,
      labName: formData.lab_name,
      addressLine1: formData.address_line1,
      addressLine2: formData.address_line2,
      cityPostalCode: formData.city_postal_code,
      phone: formData.phone,
      email: formData.email,
      website: formData.website,
    }),
    [formData, logoUrl, logoPreviewUrl]
  );
  // --- End Dynamic Preview ---

  // --- Render Logic ---
  if (loadingInitialData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-32 w-full" /> {/* Template Selector Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-16 w-32 mx-auto" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
        <Skeleton className="h-10 w-36 ml-auto" /> {/* Save Button Skeleton */}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
        <FileText className="h-6 w-6" />
        Configuration En-tête Impression/PDF
      </h1>

      {/* Main Error Alert */}
      {error && !loadingSubmit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            {error}{" "}
            <Button
              variant="link"
              onClick={fetchConfig}
              className="p-0 h-auto text-destructive-foreground underline"
            >
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* --- Template Selection --- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5" /> Modèle d'En-tête
            </CardTitle>
            <CardDescription>
              Choisissez la disposition de l'en-tête pour vos rapports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HeaderTemplateSelector
              templates={availableHeaderTemplates}
              selectedTemplateId={selectedTemplate}
              onSelectTemplate={setSelectedTemplate}
              disabled={loadingSubmit || isUploading} // Disable during operations
            />
          </CardContent>
        </Card>

        {/* --- Details Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Text Details */}
          <Card>
            <CardHeader>
              <CardTitle>Informations du Laboratoire</CardTitle>
              <CardDescription>
                Ces informations apparaîtront dans l'en-tête choisi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Input fields... */}
              <div className="space-y-1.5">
                <Label htmlFor="lab_name">Nom du Laboratoire</Label>
                <Input
                  id="lab_name"
                  name="lab_name"
                  value={formData.lab_name || ""}
                  onChange={handleInputChange}
                  disabled={loadingSubmit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address_line1">Adresse Ligne 1</Label>
                <Input
                  id="address_line1"
                  name="address_line1"
                  value={formData.address_line1 || ""}
                  onChange={handleInputChange}
                  disabled={loadingSubmit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address_line2">Adresse Ligne 2</Label>
                <Input
                  id="address_line2"
                  name="address_line2"
                  value={formData.address_line2 || ""}
                  onChange={handleInputChange}
                  disabled={loadingSubmit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city_postal_code">Ville & Code Postal</Label>
                <Input
                  id="city_postal_code"
                  name="city_postal_code"
                  value={formData.city_postal_code || ""}
                  onChange={handleInputChange}
                  disabled={loadingSubmit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone || ""}
                  onChange={handleInputChange}
                  disabled={loadingSubmit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={handleInputChange}
                  disabled={loadingSubmit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website">Site Web</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  value={formData.website || ""}
                  onChange={handleInputChange}
                  disabled={loadingSubmit}
                />
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Logo */}
          <Card>
            <CardHeader>
              <CardTitle>Logo du Laboratoire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Label>Aperçu Actuel / Nouveau</Label>
              <Avatar className="h-20 w-20 rounded-md border">
                <AvatarImage
                  src={logoPreviewUrl || logoUrl || undefined}
                  alt="Logo"
                  className="object-contain"
                />
                <AvatarFallback className="rounded-md text-muted-foreground">
                  <ImageIcon />
                </AvatarFallback>
              </Avatar>
              <Label
                htmlFor="logo-upload"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "cursor-pointer w-full",
                  isUploading ||
                    (loadingSubmit && "cursor-not-allowed opacity-50")
                )}
              >
                {" "}
                <Upload className="mr-2 h-4 w-4" />{" "}
                {selectedFile ? "Changer le logo..." : "Choisir un logo..."}{" "}
              </Label>
              <Input
                id="logo-upload"
                type="file"
                accept="image/png, image/jpeg, image/gif, image/svg+xml"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading || loadingSubmit}
              />
              {selectedFile && !isUploading && (
                <p className="text-sm text-muted-foreground">
                  Fichier : {selectedFile.name}
                </p>
              )}
              {isUploading && (
                <Progress value={uploadProgress} className="w-full h-2" />
              )}
              {uploadError && !isUploading && (
                <Alert variant="destructive" className="text-xs">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erreur Upload Précédente</AlertTitle>
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* --- Live Preview Section --- */}
        <Card>
          <CardHeader>
            <CardTitle>
              Aperçu de l'En-tête (Modèle:{" "}
              {availableHeaderTemplates.find((t) => t.id === selectedTemplate)
                ?.name || selectedTemplate}
              )
            </CardTitle>
            <CardDescription>
              Ceci est une prévisualisation basée sur le modèle sélectionné et
              les informations saisies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CurrentPreviewComponent data={previewDataProps} isPreview={true} />
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={loadingSubmit || isUploading}>
            {loadingSubmit ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Enregistrer la Configuration
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PrintHeaderDesignPage;
