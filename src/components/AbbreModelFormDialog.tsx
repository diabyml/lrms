import { useEffect, useState, useMemo, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { supabase, AbbreModel, TestType } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast as sonnerToast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  name: z
    .string()
    .min(1, "Nom ne peut pas être vide.")
    .refine(
      (s) => !s.includes("_"),
      "Nom ne peut pas contenir des underscores."
    ),
  description: z.string().optional(),
});

type AbbreModelFormData = z.infer<typeof formSchema>;

interface AbbreModelFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: AbbreModel | null;
}

export function AbbreModelFormDialog({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AbbreModelFormDialogProps) {
  const form = useForm<AbbreModelFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "" },
  });

  const [allTestTypes, setAllTestTypes] = useState<TestType[]>([]);
  const [selectedTestTypeIds, setSelectedTestTypeIds] = useState<Set<string>>(
    new Set()
  );
  const [isLoadingTestTypes, setIsLoadingTestTypes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const originalAbbreModelName = useMemo(
    () => initialData?.name,
    [initialData]
  );

  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: initialData?.name || "",
        description: initialData?.description || "",
      });

      const fetchAllTestTypes = async () => {
        setIsLoadingTestTypes(true);
        const { data, error } = await supabase
          .from("test_type")
          .select("id, name");
        if (error) {
          sonnerToast.error(
            "Erreur lors de la récupération des types de test",
            {
              description: error.message,
            }
          );
          setAllTestTypes([]);
        } else {
          const fetchedTestTypes = data || [];
          setAllTestTypes(fetchedTestTypes);
          if (initialData) {
            const nameToInclude = initialData.name;
            const initiallySelected = new Set<string>();
            fetchedTestTypes.forEach((tt) => {
              if (tt.name.includes(nameToInclude)) {
                initiallySelected.add(tt.id);
              }
            });
            setSelectedTestTypeIds(initiallySelected);
          } else {
            setSelectedTestTypeIds(new Set());
          }
        }
        setIsLoadingTestTypes(false);
      };
      fetchAllTestTypes();
    }
  }, [isOpen, initialData]);

  const handleTestTypeToggle = useCallback((testTypeId: string) => {
    setSelectedTestTypeIds((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(testTypeId)) newSelected.delete(testTypeId);
      else newSelected.add(testTypeId);
      return newSelected;
    });
  }, []);

  async function onSubmit(values: AbbreModelFormData) {
    setIsSubmitting(true);
    const abbreModelNameFromForm = values.name.trim();

    if (!abbreModelNameFromForm) {
      sonnerToast.error("Erreur de validation", {
        description: "Le nom du modèle d'abréviation ne peut pas être vide.",
      });
      setIsSubmitting(false);
      return;
    }

    let savedAbbreModelId: string | undefined;
    if (initialData) {
      const { data, error } = await supabase
        .from("abbre_models")
        .update({
          name: abbreModelNameFromForm,
          description: values.description,
        })
        .eq("id", initialData.id)
        .select("id") // Only select id
        .single();
      if (error) {
        sonnerToast.error(
          "Erreur lors de la mise à jour du modèle d'abréviation",
          {
            description: error.message,
          }
        );
        setIsSubmitting(false);
        return;
      }
      savedAbbreModelId = data?.id;
    } else {
      const { data, error } = await supabase
        .from("abbre_models")
        .insert({
          name: abbreModelNameFromForm,
          description: values.description,
        })
        .select("id") // Only select id
        .single();
      if (error) {
        sonnerToast.error(
          "Erreur lors de la création du modèle d'abréviation",
          {
            description: error.message,
          }
        );
        setIsSubmitting(false);
        return;
      }
      savedAbbreModelId = data?.id;
    }

    if (!savedAbbreModelId) {
      sonnerToast.error("Erreur de sauvegarde", {
        description:
          "Le modèle d'abréviation n'a pas été sauvegardé correctement.",
      });
      setIsSubmitting(false);
      return;
    }

    const testTypeUpdates: Promise<any>[] = [];

    allTestTypes.forEach((tt) => {
      let processedName = tt.name; // Start with the original name from DB for this iteration
      const originalNameFromDB = tt.name;
      const isCurrentlySelectedInUI = selectedTestTypeIds.has(tt.id);

      // --- Step 1: Removal Logic ---
      // This applies if we are editing an existing abbre_model.
      if (initialData && originalAbbreModelName) {
        const oldAssociationName = originalAbbreModelName;

        // Condition for removal:
        // 1. The old association is part of the current name (processedName)
        // 2. AND (the item is now deselected OR the abbre_model name itself is changing)
        if (
          processedName.includes(oldAssociationName) &&
          (!isCurrentlySelectedInUI ||
            originalAbbreModelName !== abbreModelNameFromForm)
        ) {
          // Remove the first occurrence of the oldAssociationName
          processedName = processedName.replace(oldAssociationName, "");
        }
      }

      // --- Step 2: Addition Logic ---
      // This applies if the test type is currently selected in the UI.
      if (isCurrentlySelectedInUI) {
        const newAssociationName = abbreModelNameFromForm;
        // If the (potentially modified) name does not already END with the new association name, append it.
        if (!processedName.endsWith(newAssociationName)) {
          processedName += newAssociationName;
        }
      }

      // --- Push update if the name actually changed from its original DB state ---
      if (processedName !== originalNameFromDB) {
        testTypeUpdates.push(
          supabase
            .from("test_type")
            .update({ name: processedName })
            .eq("id", tt.id)
        );
      }
    });

    if (testTypeUpdates.length > 0) {
      const results = await Promise.allSettled(testTypeUpdates);
      const failedUpdatesCount = results.filter(
        (r) => r.status === "rejected"
      ).length;
      if (failedUpdatesCount > 0) {
        sonnerToast.warning("Partiel succès avec les types de test", {
          description: `${failedUpdatesCount} type(s) de test a echoué à la mise à jour. Veuillez vérifier manuellement.`,
        });
      }
    }

    sonnerToast.success("Modèle d'abréviation sauvegardé", {
      description: `"${abbreModelNameFromForm}" a été sauvegardé avec succès.`,
    });
    setIsSubmitting(false);
    onSuccess();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(openState) => !openState && onClose()}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Modifier" : "Créer un nouveau"} Modèle d'abréviation
          </DialogTitle>
          <DialogDescription>
            {initialData ? "Modifier le" : "Entrer les détails pour le nouveau"}{" "}
            modèle d'abréviation. Sélectionnez les types de test à associer.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du modèle d'abréviation</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., ModelX" {...field} />
                  </FormControl>
                  <FormDescription>
                    Ce nom sera utilisé comme suffixe pour les types de test
                    sélectionnés. Ne peut pas contenir des underscores.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description optionnelle..."
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <FormLabel>Associer les types de test</FormLabel>
              <FormDescription>
                Sélectionnez les types de test. Le nom du modèle d'abréviation
                sera ajouté au/au nom des types de test sélectionnés.
              </FormDescription>
              {isLoadingTestTypes ? (
                <p>Loading test types...</p>
              ) : (
                <Command className="rounded-lg border shadow-md mt-2">
                  <CommandInput placeholder="Search test types..." />
                  <ScrollArea className="h-[200px]">
                    <CommandList>
                      <CommandEmpty>Aucun type de test trouvé.</CommandEmpty>
                      <CommandGroup>
                        {allTestTypes.map((tt) => (
                          <CommandItem
                            key={tt.id}
                            value={tt.name}
                            onSelect={() => handleTestTypeToggle(tt.id)}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <span className="flex-grow">{tt.name}</span>
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 ml-auto"
                            >
                              <Checkbox
                                checked={selectedTestTypeIds.has(tt.id)}
                                onCheckedChange={() =>
                                  handleTestTypeToggle(tt.id)
                                }
                                aria-label={`Select test type ${tt.name}`}
                              />
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </ScrollArea>
                </Command>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isLoadingTestTypes}
              >
                {isSubmitting
                  ? "Sauvegarde..."
                  : initialData
                  ? "Sauvegarder les modifications"
                  : "Créer le modèle"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
