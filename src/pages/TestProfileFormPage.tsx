import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import { AlertCircle, ArrowLeft, Layers, Loader2, Save } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase, Tables } from "@/lib/supabaseClient";

type TestType = Pick<
  Tables<"test_type">,
  "id" | "name" | "code" | "is_active" | "is_orderable"
>;

type TestProfilePayload = {
  id: string;
  name: string;
  description: string | null;
  test_profile_item: { test_type_id: string }[];
};

const TestProfileFormPage: React.FC = () => {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(profileId);

  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testOptions = useMemo(
    () =>
      testTypes.map((test) => ({
        value: test.id,
        label: test.code ? `${test.code} - ${test.name}` : test.name,
      })),
    [testTypes]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const profilePromise = profileId
      ? supabase
          .from("test_profile")
          .select("id, name, description, test_profile_item(test_type_id)")
          .eq("id", profileId)
          .single()
      : Promise.resolve({ data: null, error: null });

    const [testTypesRes, profileRes] = await Promise.all([
      supabase
        .from("test_type")
        .select("id, name, code, is_active, is_orderable")
        .eq("is_active", true)
        .eq("is_orderable", true)
        .order("name"),
      profilePromise,
    ]);

    if (testTypesRes.error) {
      setError(testTypesRes.error.message);
    } else if (profileRes.error) {
      setError(profileRes.error.message);
    } else {
      setTestTypes((testTypesRes.data || []) as TestType[]);
      if (profileRes.data) {
        const profile = profileRes.data as unknown as TestProfilePayload;
        setName(profile.name);
        setDescription(profile.description || "");
        setSelectedTestIds(
          (profile.test_profile_item || []).map((item) => item.test_type_id)
        );
      }
    }

    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Le nom du profil est requis.");
      return;
    }
    if (selectedTestIds.length === 0) {
      setError("Sélectionnez au moins un test.");
      return;
    }

    setSaving(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const profileResult = isEditMode
      ? await supabase
          .from("test_profile")
          .update(payload)
          .eq("id", profileId as string)
          .select("id")
          .single()
      : await supabase.from("test_profile").insert(payload).select("id").single();

    if (profileResult.error || !profileResult.data?.id) {
      setError(profileResult.error?.message || "Impossible d'enregistrer le profil.");
      setSaving(false);
      return;
    }

    const savedProfileId = profileResult.data.id;
    const { error: deleteError } = await supabase
      .from("test_profile_item")
      .delete()
      .eq("profile_id", savedProfileId);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("test_profile_item").insert(
      selectedTestIds.map((testId, index) => ({
        profile_id: savedProfileId,
        test_type_id: testId,
        sort_order: index,
      }))
    );

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    navigate("/test-profiles");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to="/test-profiles">
        <Button variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux profils
        </Button>
      </Link>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Layers className="h-5 w-5 text-primary" />
              {isEditMode ? "Modifier le profil" : "Nouveau profil"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="profile-name">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={saving}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-description">Description</Label>
              <Textarea
                id="profile-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Tests <span className="text-destructive">*</span>
              </Label>
              <Select
                isMulti
                options={testOptions}
                value={testOptions.filter((option) =>
                  selectedTestIds.includes(option.value)
                )}
                onChange={(options) =>
                  setSelectedTestIds(options.map((option) => option.value))
                }
                placeholder="Rechercher et sélectionner des tests..."
                isDisabled={saving}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Link to="/test-profiles">
              <Button type="button" variant="outline" disabled={saving}>
                Annuler
              </Button>
            </Link>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};

export default TestProfileFormPage;
