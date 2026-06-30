import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, LockKeyhole, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase, Tables } from "@/lib/supabaseClient";

const ACCESS_SESSION_KEY = "invoice_ai_settings_access_granted";
const DEFAULT_ACCESS_CODE = "AI2026";

type SettingsRow = Pick<
  Tables<"settings">,
  "invoice_ai_enabled" | "invoice_ai_access_code"
>;

const InvoiceAiSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [invoiceAiEnabled, setInvoiceAiEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(ACCESS_SESSION_KEY) === "1";
  });
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const accessCode = useMemo(
    () => settings?.invoice_ai_access_code || DEFAULT_ACCESS_CODE,
    [settings?.invoice_ai_access_code]
  );

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("settings")
          .select("invoice_ai_enabled, invoice_ai_access_code")
          .limit(1)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (data) {
          setSettings(data);
          setInvoiceAiEnabled(data.invoice_ai_enabled);
          return;
        }

        const payload = {
          invoice_ai_enabled: true,
          invoice_ai_access_code: DEFAULT_ACCESS_CODE,
        };
        const { data: inserted, error: insertError } = await supabase
          .from("settings")
          .insert(payload)
          .select("invoice_ai_enabled, invoice_ai_access_code")
          .single();

        if (insertError) throw insertError;

        setSettings(inserted);
        setInvoiceAiEnabled(inserted.invoice_ai_enabled);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Impossible de charger les paramètres IA.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleUnlock = (event: FormEvent) => {
    event.preventDefault();
    if (codeInput === accessCode) {
      sessionStorage.setItem(ACCESS_SESSION_KEY, "1");
      setUnlocked(true);
      setCodeInput("");
      setCodeError(null);
      return;
    }

    setCodeError("Code incorrect. Veuillez réessayer.");
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("settings")
        .update({ invoice_ai_enabled: invoiceAiEnabled })
        .in("invoice_ai_enabled", [true, false]);

      if (updateError) throw updateError;

      setSettings((current) =>
        current ? { ...current, invoice_ai_enabled: invoiceAiEnabled } : current
      );
      toast.success("Paramètres IA enregistrés", {
        description: invoiceAiEnabled
          ? "SmartInvoice est activé pour les factures."
          : "SmartInvoice est désactivé pour les factures.",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer les paramètres IA.";
      setError(message);
      toast.error("Erreur sauvegarde", { description: message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Dialog open={!unlocked}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-primary" />
              Code requis
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceAiAccessCode">Code d'accès</Label>
              <Input
                id="invoiceAiAccessCode"
                type="password"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value)}
                autoFocus
                placeholder="Entrer le code"
              />
            </div>
            {codeError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{codeError}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Paramètres IA</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={!codeInput}>
              Valider
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Paramètres IA Factures
        </h1>
        <p className="text-sm text-muted-foreground">
          Activez ou désactivez SmartInvoice pour la création et la modification
          des factures.
        </p>
      </div>

      {error && unlocked && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Paramètres IA</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            SmartInvoice
          </CardTitle>
          <CardDescription>
            Quand cette option est désactivée, le bouton Smart invoice disparaît
            du formulaire de facture.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3 rounded-md border p-4">
            <Checkbox
              id="invoiceAiEnabled"
              checked={invoiceAiEnabled}
              onCheckedChange={(checked) =>
                setInvoiceAiEnabled(Boolean(checked))
              }
              disabled={saving || !unlocked}
            />
            <div className="space-y-1">
              <Label htmlFor="invoiceAiEnabled" className="font-medium">
                Activer SmartInvoice
              </Label>
              <p className="text-sm text-muted-foreground">
                Autorise la dictée, le scan papier OCR et l'analyse IA dans les
                factures.
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || !unlocked}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceAiSettingsPage;
