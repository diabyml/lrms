// // src/components/app/results/hemoculture/HemocultureMainContent.tsx
// import { useState, useEffect, useCallback, useRef } from "react";
// import { supabase } from "@/lib/supabaseClient";
// import { Database, Tables } from "@/lib/supabaseClient";
// import { Button } from "@/components/ui/button";
// import {
//   Card,
//   CardContent,
//   CardHeader,
//   CardTitle,
//   CardDescription,
// } from "@/components/ui/card";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Textarea } from "@/components/ui/textarea";
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
//   TableFooter,
// } from "@/components/ui/table";
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
// } from "@/components/ui/alert-dialog";
// import {
//   Loader2,
//   PlusCircle,
//   Edit3,
//   Trash2,
//   Printer,
//   Save,
//   XCircle,
//   Microscope,
//   ShieldCheck,
//   ShieldAlert,
//   FileText,
//   Check,
//   ChevronDown,
//   ChevronUp,
//   EyeOff,
//   Eye,
//   FileEdit,
// } from "lucide-react";
// import { toast as sonnerToast } from "sonner";
// import { v4 as uuidv4 } from "uuid";
// import Footer from "@/components/Footer";

// // --- Hémoculture Observation Types ---
// export interface HemocultureModelFieldJson {
//   id: string;
//   label: string;
//   type: "textarea" | "input" | "select" | string;
//   order: number;
//   defaultValue?: string;
//   options?: string[];
//   placeholder?: string;
// }
// export interface HemocultureObservationResultItemJson {
//   field_id: string;
//   label: string;
//   value: string;
//   order: number;
// }
// type HemocultureObservationModel = Tables<"hemoculture_observation_model"> & {
//   fields_json: HemocultureModelFieldJson[];
// };
// type PatientHemocultureObservation =
//   Tables<"patient_hemoculture_observation"> & {
//     hemoculture_observation_model?: Pick<
//       HemocultureObservationModel,
//       "name" | "description" | "fields_json"
//     > | null;
//   };

// // --- Antibiogram Types ---
// export interface AntibiotiqueItemJson {
//   id: string;
//   name: string;
//   order: number;
//   s: boolean;
//   i: boolean;
//   r: boolean;
// }
// type AntibiotiqueModel = Tables<"antibiotique_model">;
// type PatientAntibiogramSet = Tables<"patient_antibiogram_set"> & {
//   antibiotique_model?: Pick<AntibiotiqueModel, "name" | "description"> | null;
// };

// interface HemocultureMainContentProps {
//   resultId: string;
// }

// const renderSirValueStatic = (
//   item: AntibiotiqueItemJson,
//   column: "s" | "i" | "r"
// ) => {
//   if (column === "s" && item.s) return "S";
//   if (column === "i" && item.i) return "I";
//   if (column === "r" && item.r) return "R";
//   return "";
// };

// export default function HemocultureMainContent({
//   resultId,
// }: HemocultureMainContentProps) {
//   const [isPageLoading, setIsPageLoading] = useState(true);
//   const printableRef = useRef<HTMLDivElement>(null);
//   const [printTarget, setPrintTarget] = useState<
//     "all" | "observation" | "antibiogram" | null
//   >(null);
//   const [printSetId, setPrintSetId] = useState<string | null>(null);

//   const [patientObservation, setPatientObservation] =
//     useState<PatientHemocultureObservation | null>(null);
//   const [availableObservationModels, setAvailableObservationModels] = useState<
//     HemocultureObservationModel[]
//   >([]);
//   const [showObservationModelSelector, setShowObservationModelSelector] =
//     useState(false);
//   const [selectedNewObservationModelId, setSelectedNewObservationModelId] =
//     useState<string | undefined>(undefined);
//   const [isObservationLoading, setIsObservationLoading] = useState(true);
//   const [isObservationSaving, setIsObservationSaving] = useState(false);
//   const [isEditingObservation, setIsEditingObservation] = useState(false);
//   const [observationResultValues, setObservationResultValues] = useState<{
//     [fieldId: string]: string;
//   }>({});
//   const [showDeleteObservationDialog, setShowDeleteObservationDialog] =
//     useState(false);

//   const [appliedAntibiogramSets, setAppliedAntibiogramSets] = useState<
//     PatientAntibiogramSet[]
//   >([]);
//   const [availableAntibiotiqueModels, setAvailableAntibiotiqueModels] =
//     useState<AntibiotiqueModel[]>([]);
//   const [editingAntibiogramSet, setEditingAntibiogramSet] =
//     useState<PatientAntibiogramSet | null>(null);
//   const [currentAntibiogramResultsJson, setCurrentAntibiogramResultsJson] =
//     useState<AntibiotiqueItemJson[]>([]);
//   const [
//     currentAntibiogramSetDescription,
//     setCurrentAntibiogramSetDescription,
//   ] = useState<string>("");
//   const [isLoadingAntibiotiqueData, setIsLoadingAntibiotiqueData] =
//     useState(true);
//   const [isSavingAntibiogram, setIsSavingAntibiogram] = useState(false);
//   const [isDeletingAntibiogram, setIsDeletingAntibiogram] = useState(false); // <<<< THIS LINE WAS MISSING
//   const [showAntibiotiqueModelSelector, setShowAntibiotiqueModelSelector] =
//     useState(false);
//   const [selectedNewAntibiotiqueModelId, setSelectedNewAntibiotiqueModelId] =
//     useState<string | undefined>(undefined);
//   const [showDeleteAntibiogramDialog, setShowDeleteAntibiogramDialog] =
//     useState(false);
//   const [antibiogramSetToDelete, setAntibiogramSetToDelete] =
//     useState<PatientAntibiogramSet | null>(null);
//   const [showAddAdhocAntibiotiqueDialog, setShowAddAdhocAntibiotiqueDialog] =
//     useState(false);
//   const [newAdhocAntibiotiqueName, setNewAdhocAntibiotiqueName] = useState("");
//   const [showAntibiogramSectionContents, setShowAntibiogramSectionContents] =
//     useState(true);

//   const fetchInitialData = useCallback(async () => {
//     setIsPageLoading(true);
//     setIsObservationLoading(true);
//     setIsLoadingAntibiotiqueData(true);
//     try {
//       const [obsModelsRes, patientObsRes, atbModelsRes, appliedAtbSetsRes] =
//         await Promise.all([
//           supabase
//             .from("hemoculture_observation_model")
//             .select("*")
//             .order("name"),
//           supabase
//             .from("patient_hemoculture_observation")
//             .select(
//               "*, hemoculture_observation_model:source_model_id!inner(name, description, fields_json)"
//             )
//             .eq("patient_result_id", resultId)
//             .maybeSingle(),
//           supabase.from("antibiotique_model").select("*").order("name"),
//           supabase
//             .from("patient_antibiogram_set")
//             .select(
//               "*, antibiotique_model:source_antibiotique_model_id (name, description)"
//             )
//             .eq("patient_result_id", resultId)
//             .order("created_at", { ascending: true }),
//         ]);
//       if (obsModelsRes.error)
//         sonnerToast.error("Erreur modèles obs.", {
//           description: obsModelsRes.error.message,
//         });
//       else
//         setAvailableObservationModels(
//           (obsModelsRes.data || []).map((m) => ({
//             ...m,
//             fields_json: (typeof m.fields_json === "string"
//               ? JSON.parse(m.fields_json)
//               : m.fields_json) as HemocultureModelFieldJson[],
//           })) as HemocultureObservationModel[]
//         );
//       if (patientObsRes.error)
//         sonnerToast.error("Erreur obs. patient", {
//           description: patientObsRes.error.message,
//         });
//       else
//         setPatientObservation(
//           patientObsRes.data as PatientHemocultureObservation | null
//         );
//       if (atbModelsRes.error)
//         sonnerToast.error("Erreur modèles ATB", {
//           description: atbModelsRes.error.message,
//         });
//       else setAvailableAntibiotiqueModels(atbModelsRes.data || []);
//       if (appliedAtbSetsRes.error)
//         sonnerToast.error("Erreur sets ATB", {
//           description: appliedAtbSetsRes.error.message,
//         });
//       else setAppliedAntibiogramSets(appliedAtbSetsRes.data || []);
//     } catch (e: any) {
//       sonnerToast.error("Erreur de chargement des données.", {
//         description: e.message,
//       });
//     } finally {
//       setIsObservationLoading(false);
//       setIsLoadingAntibiotiqueData(false);
//       setIsPageLoading(false);
//     }
//   }, [resultId]);

//   useEffect(() => {
//     fetchInitialData();
//   }, [fetchInitialData]);

//   // --- Hémoculture Observation Handlers ---
//   const handleApplyNewObservationModel = async () => {
//     if (!selectedNewObservationModelId) {
//       sonnerToast.info("Sélectionnez un modèle d'observation.");
//       return;
//     }
//     const model = availableObservationModels.find(
//       (m) => m.id === selectedNewObservationModelId
//     );
//     if (!model || !Array.isArray(model.fields_json)) {
//       sonnerToast.error("Modèle invalide.");
//       return;
//     }
//     setIsObservationSaving(true);
//     try {
//       const initialResultsJson = model.fields_json.map((field) => ({
//         field_id: field.id,
//         label: field.label,
//         value: field.defaultValue || "",
//         order: field.order,
//       }));
//       const { data: newObservation, error } = await supabase
//         .from("patient_hemoculture_observation")
//         .insert({
//           patient_result_id: resultId,
//           source_model_id: model.id,
//           results_json: initialResultsJson,
//         })
//         .select(
//           "*, hemoculture_observation_model:source_model_id!inner(name, description, fields_json)"
//         )
//         .single();
//       if (error) throw error;
//       sonnerToast.success(`Modèle d'observation "${model.name}" appliqué.`);
//       setPatientObservation(newObservation as PatientHemocultureObservation);
//       startEditingObservation(newObservation as PatientHemocultureObservation);
//       setShowObservationModelSelector(false);
//     } catch (err: any) {
//       sonnerToast.error("Erreur application modèle", {
//         description: err.message,
//       });
//     } finally {
//       setIsObservationSaving(false);
//     }
//   };
//   const startEditingObservation = (
//     obsSetToEdit?: PatientHemocultureObservation | null
//   ) => {
//     const currentObs = obsSetToEdit || patientObservation;
//     if (!currentObs) return;
//     let edits: { [fieldId: string]: string } = {};
//     const currentResults = (currentObs.results_json ||
//       []) as HemocultureObservationResultItemJson[];
//     const modelFields =
//       (currentObs.hemoculture_observation_model as HemocultureObservationModel)
//         ?.fields_json || [];
//     modelFields.forEach((fieldDef) => {
//       const existingValue = currentResults.find(
//         (r) => r.field_id === fieldDef.id
//       )?.value;
//       edits[fieldDef.id] = existingValue ?? fieldDef.defaultValue ?? "";
//     });
//     setObservationResultValues(edits);
//     setIsEditingObservation(true);
//   };
//   const cancelEditingObservation = () => {
//     setIsEditingObservation(false);
//     setObservationResultValues({});
//   };
//   const handleObservationValueChange = (field_id: string, value: string) =>
//     setObservationResultValues((prev) => ({ ...prev, [field_id]: value }));
//   const saveObservationEdits = async () => {
//     if (!patientObservation || !patientObservation.id) return;
//     setIsObservationSaving(true);
//     const modelFields =
//       (
//         patientObservation.hemoculture_observation_model as HemocultureObservationModel
//       )?.fields_json || [];
//     const newResultsJson = modelFields.map((fieldDef) => ({
//       field_id: fieldDef.id,
//       label: fieldDef.label,
//       order: fieldDef.order,
//       value: observationResultValues[fieldDef.id] ?? "",
//     }));
//     try {
//       const { error } = await supabase
//         .from("patient_hemoculture_observation")
//         .update({ results_json: newResultsJson })
//         .eq("id", patientObservation.id);
//       if (error) throw error;
//       sonnerToast.success("Observations enregistrées.");
//       setIsEditingObservation(false);
//       await fetchInitialData();
//     } catch (err: any) {
//       sonnerToast.error("Erreur enregistrement observations", {
//         description: err.message,
//       });
//     } finally {
//       setIsObservationSaving(false);
//     }
//   };
//   const handleDeleteObservationConfirmation = async () => {
//     if (!patientObservation || !patientObservation.id) return;
//     setIsObservationSaving(true);
//     const { error } = await supabase
//       .from("patient_hemoculture_observation")
//       .delete()
//       .eq("id", patientObservation.id);
//     setIsObservationSaving(false);
//     setShowDeleteObservationDialog(false);
//     if (error)
//       sonnerToast.error("Erreur suppression observations", {
//         description: error.message,
//       });
//     else {
//       sonnerToast.success("Observations supprimées.");
//       setPatientObservation(null);
//       setObservationResultValues({});
//       setIsEditingObservation(false);
//     }
//   };

//   // --- Antibiogram Section Handlers ---
//   const handleAddNewAntibiogramSet = () => {
//     setSelectedNewAntibiotiqueModelId(undefined);
//     setShowAntibiotiqueModelSelector(true);
//     setEditingAntibiogramSet(null);
//     setCurrentAntibiogramResultsJson([]);
//     setCurrentAntibiogramSetDescription("");
//   };
//   const handleSelectAntibiotiqueModelAndStart = () => {
//     if (!selectedNewAntibiotiqueModelId) {
//       sonnerToast.info("Veuillez sélectionner un modèle d'antibiogramme.");
//       return;
//     }
//     const model = availableAntibiotiqueModels.find(
//       (m) => m.id === selectedNewAntibiotiqueModelId
//     );
//     if (model && Array.isArray(model.antibiotiques)) {
//       if (
//         appliedAntibiogramSets.some(
//           (s) => s.source_antibiotique_model_id === model.id
//         )
//       ) {
//         sonnerToast.warning("Modèle ATB déjà appliqué.", {
//           description: "Vous pouvez le modifier.",
//         });
//         const existing = appliedAntibiogramSets.find(
//           (s) => s.source_antibiotique_model_id === model.id
//         );
//         if (existing) handleEditAntibiogramSet(existing);
//         setShowAntibiotiqueModelSelector(false);
//         return;
//       }
//       const newSetData: Partial<PatientAntibiogramSet> = {
//         patient_result_id: resultId,
//         source_antibiotique_model_id: model.id,
//         results_json: JSON.parse(JSON.stringify(model.antibiotiques)),
//         description: model.description || "",
//         antibiotique_model: {
//           name: model.name,
//           description: model.description,
//         },
//       };
//       const initialResults = ((newSetData.results_json || []) as any[]).map(
//         (item, index) => ({
//           id: item.id || uuidv4(),
//           name: item.name || "",
//           order: item.order !== undefined ? item.order : index,
//           s: item.s === true,
//           i: item.i === true,
//           r: item.r === true,
//         })
//       );
//       setEditingAntibiogramSet(newSetData as PatientAntibiogramSet);
//       setCurrentAntibiogramResultsJson(initialResults);
//       setCurrentAntibiogramSetDescription(newSetData.description || "");
//       setShowAntibiotiqueModelSelector(false);
//     }
//   };
//   const handleEditAntibiogramSet = (set: PatientAntibiogramSet) => {
//     setEditingAntibiogramSet(set);
//     let parsedResults: AntibiotiqueItemJson[] = [];
//     if (Array.isArray(set.results_json))
//       parsedResults = set.results_json as AntibiotiqueItemJson[];
//     else if (typeof set.results_json === "string") {
//       try {
//         parsedResults = JSON.parse(set.results_json);
//         if (!Array.isArray(parsedResults)) parsedResults = [];
//       } catch (e) {
//         console.error("Failed to parse ATB results_json string:", e);
//       }
//     }
//     setCurrentAntibiogramResultsJson(
//       parsedResults.map((item, index) => ({
//         id: item.id || uuidv4(),
//         name: item.name || "",
//         order: item.order !== undefined ? item.order : index,
//         s: item.s === true,
//         i: item.i === true,
//         r: item.r === true,
//       }))
//     );
//     setCurrentAntibiogramSetDescription(set.description || "");
//     setShowAntibiotiqueModelSelector(false);
//   };
//   const handleAntibiogramSirChange = (
//     antibiotiqueId: string,
//     sirValue: "s" | "i" | "r" | "none"
//   ) =>
//     setCurrentAntibiogramResultsJson((prev) =>
//       prev.map((item) =>
//         item.id === antibiotiqueId
//           ? {
//               ...item,
//               s: sirValue === "s",
//               i: sirValue === "i",
//               r: sirValue === "r",
//             }
//           : item
//       )
//     );
//   const handleCancelEditAntibiogram = () => {
//     setEditingAntibiogramSet(null);
//     setCurrentAntibiogramResultsJson([]);
//     setCurrentAntibiogramSetDescription("");
//     setShowAntibiotiqueModelSelector(false);
//   };
//   const handleSaveAntibiogramSet = async () => {
//     if (!editingAntibiogramSet || !currentAntibiogramResultsJson) return;
//     setIsSavingAntibiogram(true);
//     const dataToSave = {
//       patient_result_id: resultId,
//       source_antibiotique_model_id:
//         editingAntibiogramSet.source_antibiotique_model_id,
//       results_json: currentAntibiogramResultsJson.map((item, index) => ({
//         ...item,
//         order: index,
//       })),
//       description: currentAntibiogramSetDescription.trim() || null,
//       notes: editingAntibiogramSet.notes,
//     };
//     const { error } = editingAntibiogramSet.id
//       ? await supabase
//           .from("patient_antibiogram_set")
//           .update(dataToSave)
//           .eq("id", editingAntibiogramSet.id)
//       : await supabase
//           .from("patient_antibiogram_set")
//           .insert(dataToSave)
//           .select()
//           .single();
//     setIsSavingAntibiogram(false);
//     if (error)
//       sonnerToast.error("Erreur enregistrement ATB", {
//         description: error.message,
//       });
//     else {
//       sonnerToast.success(
//         `Antibiogramme ${
//           editingAntibiogramSet.id ? "mis à jour" : "enregistré"
//         }.`
//       );
//       handleCancelEditAntibiogram();
//       await fetchInitialData();
//     }
//   };
//   const openDeleteAntibiogramDialog = (set: PatientAntibiogramSet) => {
//     setAntibiogramSetToDelete(set);
//     setShowDeleteAntibiogramDialog(true);
//   };
//   const handleDeleteAntibiogramConfirm = async () => {
//     if (!antibiogramSetToDelete) return;
//     setIsDeletingAntibiogram(true); // Use isDeletingAntibiogram
//     const { error } = await supabase
//       .from("patient_antibiogram_set")
//       .delete()
//       .eq("id", antibiogramSetToDelete.id);
//     setIsDeletingAntibiogram(false);
//     setShowDeleteAntibiogramDialog(false);
//     if (error)
//       sonnerToast.error("Erreur suppression ATB", {
//         description: error.message,
//       });
//     else {
//       sonnerToast.success("Set Antibiogramme supprimé.");
//       if (editingAntibiogramSet?.id === antibiogramSetToDelete.id)
//         handleCancelEditAntibiogram();
//       await fetchInitialData();
//     }
//     setAntibiogramSetToDelete(null);
//   };
//   const handleOpenAddAdhocAntibiotiqueDialog = () => {
//     setNewAdhocAntibiotiqueName("");
//     setShowAddAdhocAntibiotiqueDialog(true);
//   };
//   const handleConfirmAddAdhocAntibiotique = () => {
//     if (!newAdhocAntibiotiqueName.trim()) {
//       sonnerToast.warning("Nom de l'antibiotique requis.");
//       return;
//     }
//     const newAntibiotique: AntibiotiqueItemJson = {
//       id: uuidv4(),
//       name: newAdhocAntibiotiqueName.trim(),
//       order: currentAntibiogramResultsJson.length,
//       s: false,
//       i: false,
//       r: false,
//     };
//     setCurrentAntibiogramResultsJson((prev) => [...prev, newAntibiotique]);
//     setShowAddAdhocAntibiotiqueDialog(false);
//   };
//   const handleRemoveAdhocAntibiotiqueFromCurrentSet = (id: string) =>
//     setCurrentAntibiogramResultsJson((prev) =>
//       prev
//         .filter((item) => item.id !== id)
//         .map((item, index) => ({ ...item, order: index }))
//     );

//   // --- Overall Print ---
//   const handleActualPrint = () => {
//     window.print();
//     setTimeout(() => {
//       setPrintTarget(null);
//       setPrintSetId(null);
//     }, 1000);
//   };
//   const prepareAndTriggerPrint = (
//     target: "all" | "observation" | "antibiogram",
//     atbSetId?: string
//   ) => {
//     setPrintTarget(target);
//     if (atbSetId) setPrintSetId(atbSetId);
//     setTimeout(() => {
//       handleActualPrint();
//     }, 100);
//   };

//   // --- Antibiogram Display Sub-Component (Read-Only for list) ---
//   const AntibiogramSetDisplayItem = ({
//     set,
//   }: {
//     set: PatientAntibiogramSet;
//   }) => {
//     const results = Array.isArray(set.results_json)
//       ? (set.results_json as AntibiotiqueItemJson[]).sort(
//           (a, b) => a.order - b.order
//         )
//       : [];
//     const displayDescription =
//       set.description || set.antibiotique_model?.description;
//     const setContainerClasses = `antibiogram-set-display-item mb-4 border rounded-lg ${
//       printTarget === "all" ||
//       (printTarget === "antibiogram" && printSetId === set.id)
//         ? "print-this-set"
//         : "print:hidden"
//     }`;
//     return (
//       <div className={setContainerClasses} id={`antibiogram-print-${set.id}`}>
//         <div className="p-3 bg-slate-100 border-b flex justify-between items-center print:hidden">
//           <div>
//             <h4 className="font-semibold text-md text-slate-700">
//               {set.antibiotique_model?.name || "Antibiogramme Ad-hoc"}
//             </h4>
//             {displayDescription && (
//               <p className="text-xs text-slate-500 italic">
//                 {displayDescription}
//               </p>
//             )}
//           </div>
//           <div className="space-x-1">
//             <Button
//               variant="outline"
//               size="icon-sm"
//               //   onClick={() => prepareAndTriggerPrint("antibiogram", set.id)}
//               onClick={() => window.print()}
//               title="Imprimer ce set ATB"
//             >
//               <Printer className="h-4 w-4" />
//             </Button>
//             <Button
//               variant="outline"
//               size="icon-sm"
//               onClick={() => handleEditAntibiogramSet(set)}
//               title="Modifier ce set ATB"
//             >
//               <Edit3 className="h-4 w-4" />
//             </Button>
//             <Button
//               variant="ghost"
//               size="icon-sm"
//               onClick={() => openDeleteAntibiogramDialog(set)}
//               title="Supprimer ce set ATB"
//             >
//               <Trash2 className="h-4 w-4 text-red-500" />
//             </Button>
//           </div>
//         </div>
//         <div
//           className={`hidden ${
//             printTarget === "antibiogram" && printSetId === set.id
//               ? "print:block"
//               : printTarget === "all"
//               ? "print:block"
//               : ""
//           } mb-2 print-content-wrapper`}
//         >
//           <div className="print-title">RESULTAT DE L'ANTIBIOGRAMME</div>
//           <div className="print-model-name">
//             {set.antibiotique_model?.name || "Antibiogramme Ad-hoc"}
//           </div>
//           {displayDescription && (
//             <div className="print-model-description">{displayDescription}</div>
//           )}
//         </div>
//         <Table size="sm" className="min-w-full text-xs">
//           <TableHeader>
//             <TableRow>
//               <TableHead className="w-[40%] font-semibold px-2 py-1">
//                 Dénomination
//               </TableHead>
//               <TableHead className="text-center font-semibold px-1 py-1 sir-column">
//                 S
//               </TableHead>
//               <TableHead className="text-center font-semibold px-1 py-1 sir-column">
//                 I
//               </TableHead>
//               <TableHead className="text-center font-semibold px-1 py-1 sir-column">
//                 R
//               </TableHead>
//             </TableRow>
//           </TableHeader>
//           <TableBody>
//             {results.map((abItem) => (
//               <TableRow key={abItem.id}>
//                 <TableCell className="px-2 py-0.5">{abItem.name}</TableCell>
//                 <TableCell className="text-center px-1 py-0.5 sir-column">
//                   {renderSirValueStatic(abItem, "s")}
//                 </TableCell>
//                 <TableCell className="text-center px-1 py-0.5 sir-column">
//                   {renderSirValueStatic(abItem, "i")}
//                 </TableCell>
//                 <TableCell className="text-center px-1 py-0.5 sir-column">
//                   {renderSirValueStatic(abItem, "r")}
//                 </TableCell>
//               </TableRow>
//             ))}
//           </TableBody>
//           <TableFooter>
//             <TableRow>
//               <TableCell
//                 colSpan={4}
//                 className="text-xs px-3 py-2 text-black print-legend"
//               >
//                 S = Sensible    I = Intermédiaire    R = Résistant
//               </TableCell>
//             </TableRow>
//           </TableFooter>
//         </Table>
//         {printTarget === "all" && (
//           <div className="mt-4 print:hidden">
//             <Footer date={new Date().toISOString() || ""} />
//           </div>
//         )}
//       </div>
//     );
//   };

//   if (isPageLoading) {
//     return (
//       <div className="flex justify-center items-center p-10">
//         <Loader2 className="h-10 w-10 animate-spin text-sky-600" /> Chargement
//         Général...
//       </div>
//     );
//   }

//   const currentObservationFields =
//     patientObservation?.hemoculture_observation_model?.fields_json?.sort(
//       (a, b) => a.order - b.order
//     ) || [];
//   const currentObservationValuesForDisplay =
//     (patientObservation?.results_json ||
//       []) as HemocultureObservationResultItemJson[];

//   const displayAntibiogramme = (set: PatientAntibiogramSet) => {
//     const results = Array.isArray(set.results_json)
//       ? (set.results_json as AntibiotiqueItemJson[]).sort(
//           (a, b) => a.order - b.order
//         )
//       : [];
//     const displayDescription =
//       set.description || set.antibiotique_model?.description;

//     return (
//       <div>
//         <p>{displayDescription}</p>
//         <Table size="sm" className="min-w-full text-xs">
//           <TableHeader>
//             <TableRow>
//               <TableHead className="w-[40%] font-semibold px-2 py-1">
//                 Dénomination
//               </TableHead>
//               <TableHead className="text-center font-semibold px-1 py-1 sir-column">
//                 S
//               </TableHead>
//               <TableHead className="text-center font-semibold px-1 py-1 sir-column">
//                 I
//               </TableHead>
//               <TableHead className="text-center font-semibold px-1 py-1 sir-column">
//                 R
//               </TableHead>
//             </TableRow>
//           </TableHeader>
//           <TableBody>
//             {results.map((abItem) => (
//               <TableRow key={abItem.id}>
//                 <TableCell className="px-2 py-0.5">{abItem.name}</TableCell>
//                 <TableCell className="text-center px-1 py-0.5 sir-column">
//                   {renderSirValueStatic(abItem, "s")}
//                 </TableCell>
//                 <TableCell className="text-center px-1 py-0.5 sir-column">
//                   {renderSirValueStatic(abItem, "i")}
//                 </TableCell>
//                 <TableCell className="text-center px-1 py-0.5 sir-column">
//                   {renderSirValueStatic(abItem, "r")}
//                 </TableCell>
//               </TableRow>
//             ))}
//           </TableBody>
//           <TableFooter>
//             <TableRow>
//               <TableCell
//                 colSpan={4}
//                 className="text-xs px-3 py-2 text-black print-legend"
//               >
//                 S = Sensible    I = Intermédiaire    R = Résistant
//               </TableCell>
//             </TableRow>
//           </TableFooter>
//         </Table>
//       </div>
//     );
//   };

//   return (
//     <div>
//       {/* ui */}
//       <div className="print:hidden">
//         <div className="hemoculture-content-container">
//           <div
//             ref={printableRef}
//             className={`printable-hemoculture-area ${
//               printTarget === "all" ? "print-all-active" : ""
//             }`}
//           >
//             <div className="print-only-header hidden print:block mb-4 border-b pb-2">
//               <h1 className="text-2xl font-bold text-center">HEMOCULTURE</h1>
//             </div>

//             <Card className="mb-6">
//               <CardHeader className="flex flex-row justify-between items-center print:hidden">
//                 <CardTitle className="text-xl flex items-center">
//                   <Microscope className="mr-2 h-6 w-6 text-blue-600" />
//                   Observation / Culture
//                 </CardTitle>
//                 <div className="space-x-2">
//                   {!patientObservation && !isEditingObservation && (
//                     <Button
//                       size="sm"
//                       onClick={() => setShowObservationModelSelector(true)}
//                       disabled={isObservationLoading}
//                     >
//                       <PlusCircle className="mr-2 h-4 w-4" />
//                       Appliquer Modèle
//                     </Button>
//                   )}
//                   {patientObservation && !isEditingObservation && (
//                     <Button
//                       size="sm"
//                       variant="outline"
//                       onClick={() => startEditingObservation()}
//                       disabled={isObservationLoading}
//                     >
//                       <Edit3 className="mr-2 h-4 w-4" />
//                       Modifier
//                     </Button>
//                   )}
//                 </div>
//               </CardHeader>
//               <CardContent>
//                 {showObservationModelSelector && !patientObservation && (
//                   <div className="p-4 border rounded-md bg-slate-50 print:hidden">
//                     <Label className="mb-2 block">Modèle d'Observation:</Label>
//                     <div className="flex gap-2 items-center">
//                       <Select
//                         value={selectedNewObservationModelId}
//                         onValueChange={setSelectedNewObservationModelId}
//                       >
//                         <SelectTrigger>
//                           <SelectValue placeholder="Choisir..." />
//                         </SelectTrigger>
//                         <SelectContent>
//                           {availableObservationModels.map((m) => (
//                             <SelectItem key={m.id} value={m.id}>
//                               {m.name}
//                             </SelectItem>
//                           ))}
//                         </SelectContent>
//                       </Select>
//                       <Button
//                         onClick={handleApplyNewObservationModel}
//                         disabled={
//                           !selectedNewObservationModelId || isObservationSaving
//                         }
//                       >
//                         Appliquer
//                       </Button>
//                       <Button
//                         variant="ghost"
//                         size="icon"
//                         onClick={() => setShowObservationModelSelector(false)}
//                       >
//                         <XCircle className="h-5 w-5" />
//                       </Button>
//                     </div>
//                   </div>
//                 )}
//                 {isObservationLoading && !patientObservation && (
//                   <div className="text-center py-4">
//                     <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
//                   </div>
//                 )}
//                 {patientObservation && (
//                   <div
//                     className={
//                       isEditingObservation
//                         ? "mt-4 space-y-4"
//                         : `mt-2 ${
//                             printTarget === "all" ||
//                             printTarget === "observation"
//                               ? "observation-print-format"
//                               : "observation-read-only"
//                           }`
//                     }
//                   >
//                     {(isEditingObservation ||
//                       patientObservation.hemoculture_observation_model
//                         ?.name) && (
//                       <div className="mb-3 pb-2 border-b flex justify-between items-center">
//                         <div>
//                           <h3 className="text-md font-semibold text-slate-700">
//                             {isEditingObservation ? "Modification: " : ""}
//                             {
//                               patientObservation.hemoculture_observation_model
//                                 ?.name
//                             }
//                           </h3>
//                           {patientObservation.hemoculture_observation_model
//                             ?.description && (
//                             <p className="text-xs italic text-slate-500">
//                               {
//                                 patientObservation.hemoculture_observation_model
//                                   .description
//                               }
//                             </p>
//                           )}
//                         </div>
//                         {isEditingObservation && patientObservation.id && (
//                           <Button
//                             variant="destructive"
//                             size="sm"
//                             onClick={() => setShowDeleteObservationDialog(true)}
//                             disabled={isObservationSaving}
//                           >
//                             <Trash2 className="mr-1 h-4 w-4" />
//                             Supprimer
//                           </Button>
//                         )}
//                       </div>
//                     )}
//                     {currentObservationFields.map((fieldDef) => {
//                       const resultValue = isEditingObservation
//                         ? observationResultValues[fieldDef.id] ?? ""
//                         : currentObservationValuesForDisplay.find(
//                             (r) => r.field_id === fieldDef.id
//                           )?.value ?? "";
//                       if (
//                         !isEditingObservation &&
//                         !resultValue.trim() &&
//                         !fieldDef.label.toLowerCase().includes("résultat") &&
//                         !fieldDef.label.toLowerCase().includes("conclusion")
//                       )
//                         return null;
//                       return (
//                         <div
//                           key={fieldDef.id}
//                           className={`mb-2 print:mb-0.5 ${
//                             isEditingObservation
//                               ? "space-y-1"
//                               : "grid grid-cols-3 gap-2 items-baseline"
//                           }`}
//                         >
//                           <Label
//                             htmlFor={`obs-${fieldDef.id}`}
//                             className={`text-sm print:text-xs ${
//                               isEditingObservation
//                                 ? "block font-medium"
//                                 : "font-semibold col-span-1"
//                             }`}
//                           >
//                             {fieldDef.label}:
//                           </Label>
//                           {isEditingObservation ? (
//                             <Textarea
//                               id={`obs-${fieldDef.id}`}
//                               value={resultValue}
//                               onChange={(e) =>
//                                 handleObservationValueChange(
//                                   fieldDef.id,
//                                   e.target.value
//                                 )
//                               }
//                               rows={
//                                 fieldDef.label
//                                   .toLowerCase()
//                                   .includes("conclusion") ||
//                                 fieldDef.label
//                                   .toLowerCase()
//                                   .includes("résultat")
//                                   ? 4
//                                   : 2
//                               }
//                               placeholder={
//                                 fieldDef.placeholder ||
//                                 `Entrez ${fieldDef.label.toLowerCase()}...`
//                               }
//                               className="bg-white text-sm col-span-2"
//                             />
//                           ) : (
//                             <span className="text-sm print:text-xs whitespace-pre-wrap col-span-2">
//                               {resultValue || (
//                                 <span className="italic text-slate-400">
//                                   N/A
//                                 </span>
//                               )}
//                             </span>
//                           )}
//                         </div>
//                       );
//                     })}
//                     {isEditingObservation && (
//                       <div className="mt-6 flex justify-end space-x-2 print:hidden">
//                         <Button
//                           variant="outline"
//                           onClick={cancelEditingObservation}
//                           disabled={isObservationSaving}
//                         >
//                           Annuler
//                         </Button>
//                         <Button
//                           onClick={saveObservationEdits}
//                           disabled={isObservationSaving}
//                         >
//                           {isObservationSaving ? (
//                             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                           ) : (
//                             <Save className="mr-2 h-4 w-4" />
//                           )}{" "}
//                           Enregistrer
//                         </Button>
//                       </div>
//                     )}
//                   </div>
//                 )}
//                 {!isObservationLoading &&
//                   !patientObservation &&
//                   !showObservationModelSelector && (
//                     <p className="italic text-slate-500 py-4 text-center">
//                       Aucune observation/culture. Appliquer un modèle.
//                     </p>
//                   )}
//               </CardContent>
//             </Card>

//             <Card className="mt-6">
//               <CardHeader className="flex flex-row justify-between items-center print:hidden">
//                 <CardTitle className="text-xl flex items-center">
//                   <ShieldCheck className="mr-2 h-6 w-6 text-red-600" />
//                   Antibiogramme
//                 </CardTitle>
//                 <Button
//                   variant="ghost"
//                   size="sm"
//                   onClick={() =>
//                     setShowAntibiogramSectionContents(
//                       !showAntibiogramSectionContents
//                     )
//                   }
//                 >
//                   {showAntibiogramSectionContents ? (
//                     <EyeOff className="mr-2 h-4 w-4" />
//                   ) : (
//                     <Eye className="mr-2 h-4 w-4" />
//                   )}
//                   {showAntibiogramSectionContents
//                     ? "Masquer"
//                     : "Afficher/Gérer"}
//                 </Button>
//               </CardHeader>
//               {showAntibiogramSectionContents && (
//                 <CardContent className="pt-0 print:pt-4">
//                   {isLoadingAntibiotiqueData && (
//                     <div className="text-center py-4">
//                       <Loader2 className="h-6 w-6 animate-spin" />
//                     </div>
//                   )}
//                   {!isLoadingAntibiotiqueData &&
//                     (editingAntibiogramSet ? (
//                       <div className="border rounded-lg no-print mt-4">
//                         <div className="p-4 bg-slate-50 border-b rounded-t-lg">
//                           <h3 className="text-lg font-semibold text-slate-700">
//                             {editingAntibiogramSet.id
//                               ? "Modification"
//                               : "Nouvel"}{" "}
//                             Antibiogramme :{" "}
//                             {editingAntibiogramSet.antibiotique_model?.name ||
//                               "Ad-hoc"}
//                           </h3>
//                           <div className="mt-2 space-y-1">
//                             <Label
//                               htmlFor="antibiogram-set-description"
//                               className="text-sm font-medium text-slate-600 flex items-center"
//                             >
//                               <FileEdit className="h-4 w-4 mr-2" />
//                               Description ATB
//                             </Label>
//                             <Textarea
//                               id="antibiogram-set-description"
//                               value={currentAntibiogramSetDescription}
//                               onChange={(e) =>
//                                 setCurrentAntibiogramSetDescription(
//                                   e.target.value
//                                 )
//                               }
//                               placeholder={
//                                 editingAntibiogramSet.antibiotique_model
//                                   ?.description
//                                   ? `Modèle: ${editingAntibiogramSet.antibiotique_model.description.substring(
//                                       0,
//                                       70
//                                     )}...`
//                                   : "Description..."
//                               }
//                               rows={2}
//                               className="bg-white text-sm"
//                             />
//                           </div>
//                           <p className="text-xs text-slate-500 mt-1">
//                             S=Sensible, I=Intermédiaire, R=Résistant
//                           </p>
//                         </div>
//                         <div className="p-0">
//                           <Table className="min-w-full">
//                             <TableHeader>
//                               <TableRow>
//                                 <TableHead className="w-[calc(40%-40px)] font-semibold px-2 py-1">
//                                   Dénomination
//                                 </TableHead>
//                                 <TableHead className="text-center font-semibold px-1 py-1 sir-column">
//                                   S
//                                 </TableHead>
//                                 <TableHead className="text-center font-semibold px-1 py-1 sir-column">
//                                   I
//                                 </TableHead>
//                                 <TableHead className="text-center font-semibold px-1 py-1 sir-column">
//                                   R
//                                 </TableHead>
//                                 <TableHead className="w-[40px] px-1 py-1"></TableHead>
//                               </TableRow>
//                             </TableHeader>
//                             <TableBody>
//                               {currentAntibiogramResultsJson
//                                 .sort((a, b) => a.order - b.order)
//                                 .map((abItem) => (
//                                   <TableRow
//                                     key={abItem.id}
//                                     className="hover:bg-slate-50"
//                                   >
//                                     <TableCell className="px-2 py-1 align-middle">
//                                       {abItem.name}
//                                     </TableCell>
//                                     {["s", "i", "r"].map((sirKey) => (
//                                       <TableCell
//                                         key={sirKey}
//                                         className="text-center px-1 py-1 sir-column align-middle"
//                                       >
//                                         <RadioGroup
//                                           value={
//                                             abItem.s
//                                               ? "s"
//                                               : abItem.i
//                                               ? "i"
//                                               : abItem.r
//                                               ? "r"
//                                               : "none"
//                                           }
//                                           onValueChange={(val) =>
//                                             handleAntibiogramSirChange(
//                                               abItem.id,
//                                               val as any
//                                             )
//                                           }
//                                         >
//                                           <div className="flex items-center justify-center">
//                                             <RadioGroupItem
//                                               value={sirKey}
//                                               id={`${sirKey}-${abItem.id}`}
//                                             />
//                                           </div>
//                                         </RadioGroup>
//                                       </TableCell>
//                                     ))}
//                                     <TableCell className="px-1 py-1 align-middle">
//                                       <Button
//                                         variant="ghost"
//                                         size="icon-xs"
//                                         onClick={() =>
//                                           handleRemoveAdhocAntibiotiqueFromCurrentSet(
//                                             abItem.id
//                                           )
//                                         }
//                                         title="Supprimer"
//                                       >
//                                         <Trash2 className="h-3.5 w-3.5 text-red-500" />
//                                       </Button>
//                                     </TableCell>
//                                   </TableRow>
//                                 ))}
//                             </TableBody>
//                             <TableFooter>
//                               <TableRow>
//                                 <TableCell
//                                   colSpan={5}
//                                   className="text-xs px-3 py-2 text-black print:text-black"
//                                 >
//                                   S = Sensible    I = Intermédiaire    R =
//                                   Résistant
//                                 </TableCell>
//                               </TableRow>
//                             </TableFooter>
//                           </Table>
//                         </div>
//                         <div className="p-4 border-t flex items-center justify-between bg-slate-50 rounded-b-lg">
//                           <Button
//                             variant="outline"
//                             size="sm"
//                             onClick={handleOpenAddAdhocAntibiotiqueDialog}
//                           >
//                             <PlusCircle className="mr-2 h-4 w-4" />
//                             Ajouter Ad-hoc
//                           </Button>
//                           <div className="space-x-2">
//                             <Button
//                               variant="outline"
//                               onClick={handleCancelEditAntibiogram}
//                               disabled={isSavingAntibiogram}
//                             >
//                               <XCircle className="mr-2 h-4 w-4" />
//                               Annuler
//                             </Button>
//                             <Button
//                               onClick={handleSaveAntibiogramSet}
//                               disabled={isSavingAntibiogram}
//                             >
//                               {isSavingAntibiogram ? (
//                                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                               ) : (
//                                 <Save className="mr-2 h-4 w-4" />
//                               )}
//                               Enregistrer ATB
//                             </Button>
//                           </div>
//                         </div>
//                       </div>
//                     ) : (
//                       <div>
//                         <div className="mb-2 flex justify-end items-center">
//                           <Button
//                             onClick={handleAddNewAntibiogramSet}
//                             size="sm"
//                             disabled={isLoadingAntibiotiqueData}
//                           >
//                             <PlusCircle className="mr-2 h-4 w-4" />
//                             Appliquer Modèle ATB
//                           </Button>
//                         </div>
//                         {showAntibiotiqueModelSelector && (
//                           <Card className="mb-4 p-4 no-print">
//                             <Label
//                               htmlFor="atb-model-select"
//                               className="mb-2 block font-medium"
//                             >
//                               Choisir un modèle ATB:
//                             </Label>
//                             <div className="flex space-x-2">
//                               <Select
//                                 value={selectedNewAntibiotiqueModelId}
//                                 onValueChange={
//                                   setSelectedNewAntibiotiqueModelId
//                                 }
//                               >
//                                 <SelectTrigger
//                                   id="atb-model-select"
//                                   className="flex-grow"
//                                 >
//                                   <SelectValue placeholder="Sélectionner..." />
//                                 </SelectTrigger>
//                                 <SelectContent>
//                                   {availableAntibiotiqueModels.map((model) => (
//                                     <SelectItem
//                                       key={model.id}
//                                       value={model.id}
//                                       disabled={appliedAntibiogramSets.some(
//                                         (s) =>
//                                           s.source_antibiotique_model_id ===
//                                           model.id
//                                       )}
//                                     >
//                                       {model.name}{" "}
//                                       {appliedAntibiogramSets.some(
//                                         (s) =>
//                                           s.source_antibiotique_model_id ===
//                                           model.id
//                                       ) && "(Déjà appliqué)"}
//                                     </SelectItem>
//                                   ))}
//                                 </SelectContent>
//                               </Select>
//                               <Button
//                                 onClick={handleSelectAntibiotiqueModelAndStart}
//                                 disabled={
//                                   !selectedNewAntibiotiqueModelId ||
//                                   isLoadingAntibiotiqueData
//                                 }
//                               >
//                                 Commencer
//                               </Button>
//                               <Button
//                                 variant="ghost"
//                                 onClick={() =>
//                                   setShowAntibiotiqueModelSelector(false)
//                                 }
//                               >
//                                 Annuler
//                               </Button>
//                             </div>
//                           </Card>
//                         )}
//                         {!isLoadingAntibiotiqueData &&
//                         appliedAntibiogramSets.length > 0 ? (
//                           <div className="space-y-3">
//                             {appliedAntibiogramSets.map((set) => (
//                               <AntibiogramSetDisplayItem
//                                 key={set.id}
//                                 set={set}
//                               />
//                             ))}
//                           </div>
//                         ) : (
//                           !showAntibiotiqueModelSelector && (
//                             <p className="italic text-slate-500 py-2 text-center">
//                               Aucun antibiogramme.
//                             </p>
//                           )
//                         )}
//                       </div>
//                     ))}
//                 </CardContent>
//               )}
//               {!showAntibiogramSectionContents && (
//                 <CardContent>
//                   <p className="italic text-slate-500 print:hidden py-4 text-center">
//                     Section Antibiogramme masquée.
//                   </p>
//                 </CardContent>
//               )}
//             </Card>
//           </div>

//           <div className="mt-8 flex justify-end no-print">
//             {/* <Button onClick={handleOverallPrint} size="lg">
//           <Printer className="mr-2 h-5 w-5" />
//           Imprimer Rapport Hémoculture
//         </Button> */}
//             <Button onClick={() => window.print()} size="lg">
//               <Printer className="mr-2 h-5 w-5" />
//               Imprimer Rapport Hémoculture
//             </Button>
//           </div>

//           <AlertDialog
//             open={showDeleteObservationDialog}
//             onOpenChange={setShowDeleteObservationDialog}
//           >
//             <AlertDialogContent>
//               <AlertDialogHeader>
//                 <AlertDialogTitle>
//                   Confirmer Suppression Observation
//                 </AlertDialogTitle>
//                 <AlertDialogDescription>
//                   Êtes-vous sûr de vouloir supprimer ces observations/résultats
//                   de culture (Modèle:{" "}
//                   {patientObservation?.hemoculture_observation_model?.name ||
//                     "N/A"}
//                   ) ? Action irréversible.
//                 </AlertDialogDescription>
//               </AlertDialogHeader>
//               <AlertDialogFooter>
//                 <AlertDialogCancel
//                   onClick={() => setShowDeleteObservationDialog(false)}
//                   disabled={isObservationSaving}
//                 >
//                   Annuler
//                 </AlertDialogCancel>
//                 <AlertDialogAction
//                   onClick={handleDeleteObservationConfirmation}
//                   className="bg-destructive hover:bg-destructive/90"
//                   disabled={isObservationSaving}
//                 >
//                   {isObservationSaving && (
//                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                   )}{" "}
//                   Supprimer
//                 </AlertDialogAction>
//               </AlertDialogFooter>
//             </AlertDialogContent>
//           </AlertDialog>
//           <AlertDialog
//             open={showDeleteAntibiogramDialog}
//             onOpenChange={setShowDeleteAntibiogramDialog}
//           >
//             <AlertDialogContent>
//               <AlertDialogHeader>
//                 <AlertDialogTitle>
//                   Confirmer Suppression Antibiogramme
//                 </AlertDialogTitle>
//                 <AlertDialogDescription>
//                   Êtes-vous sûr de vouloir supprimer ce set d'antibiogramme
//                   (Modèle:{" "}
//                   {antibiogramSetToDelete?.antibiotique_model?.name || "N/A"}) ?
//                   Action irréversible.
//                 </AlertDialogDescription>
//               </AlertDialogHeader>
//               <AlertDialogFooter>
//                 <AlertDialogCancel
//                   onClick={() => setAntibiogramSetToDelete(null)}
//                   disabled={isDeletingAntibiogram}
//                 >
//                   Annuler
//                 </AlertDialogCancel>
//                 <AlertDialogAction
//                   onClick={handleDeleteAntibiogramConfirm}
//                   className="bg-destructive hover:bg-destructive/90"
//                   disabled={isDeletingAntibiogram}
//                 >
//                   {isDeletingAntibiogram && (
//                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                   )}{" "}
//                   Supprimer
//                 </AlertDialogAction>
//               </AlertDialogFooter>
//             </AlertDialogContent>
//           </AlertDialog>
//           <AlertDialog
//             open={showAddAdhocAntibiotiqueDialog}
//             onOpenChange={setShowAddAdhocAntibiotiqueDialog}
//           >
//             <AlertDialogContent>
//               <AlertDialogHeader>
//                 <AlertDialogTitle>
//                   Ajouter Antibiotique (Ad-hoc)
//                 </AlertDialogTitle>
//                 <AlertDialogDescription>
//                   Nom du nouvel antibiotique. S, I, R seront non sélectionnés.
//                 </AlertDialogDescription>
//               </AlertDialogHeader>
//               <div className="py-4">
//                 <Label htmlFor="adhoc-name-atb">Nom de l'antibiotique</Label>
//                 <Input
//                   id="adhoc-name-atb"
//                   value={newAdhocAntibiotiqueName}
//                   onChange={(e) => setNewAdhocAntibiotiqueName(e.target.value)}
//                   placeholder="Ex: Vancomycine"
//                   className="mt-1"
//                 />
//               </div>
//               <AlertDialogFooter>
//                 <AlertDialogCancel
//                   onClick={() => setNewAdhocAntibiotiqueName("")}
//                 >
//                   Annuler
//                 </AlertDialogCancel>
//                 <AlertDialogAction onClick={handleConfirmAddAdhocAntibiotique}>
//                   Ajouter
//                 </AlertDialogAction>
//               </AlertDialogFooter>
//             </AlertDialogContent>
//           </AlertDialog>
//         </div>
//       </div>

//       {/* for my print only */}
//       <div className="hidden print:block">
//         <h1 className="text-2xl text-black text-center uppercase font-bold mb-1">
//           HEMOCULTURE
//         </h1>

//         {/* observation fields and values not default values but actual result stored */}
//         {/* actual stored values for this result */}
//         <div>
//           {currentObservationFields.map((field) => {
//             const resultValue = isEditingObservation
//               ? observationResultValues[field.id] ?? ""
//               : currentObservationValuesForDisplay.find(
//                   (r) => r.field_id === field.id
//                 )?.value ?? "";
//             return (
//               <div
//                 key={field.id}
//                 className="flex space-x-2 mb-2 items-baseline"
//               >
//                 <div>
//                   <p className="font-semibold text-lg whitespace-nowrap ">
//                     {field.label}:
//                   </p>
//                 </div>
//                 <div>
//                   <p>{resultValue}</p>
//                 </div>
//               </div>
//             );
//           })}
//         </div>

//         {/* atb */}
//         <div>
//           {appliedAntibiogramSets.length > 0 && (
//             <>
//               <h1 className="text-2xl text-black text-center uppercase font-bold mb-1">
//                 ANTIBIOGRAMME
//               </h1>
//               {displayAntibiogramme(
//                 appliedAntibiogramSets[appliedAntibiogramSets.length - 1]
//               )}
//             </>
//           )}
//         </div>

//         {/* footer */}
//         <div className="mt-8">
//           <Footer date={new Date().toISOString() || ""} />
//         </div>
//       </div>
//     </div>
//   );
// }

// ================================================================================================================
// src/components/app/results/hemoculture/HemocultureMainContent.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Database, Tables } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  PlusCircle,
  Edit3,
  Trash2,
  Printer,
  Save,
  XCircle,
  Microscope,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Check,
  FileEdit,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react"; // Removed Eye/EyeOff as per simplification
import { toast as sonnerToast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import Footer from "@/components/Footer";

// --- Hémoculture Observation Types ---
export interface HemocultureModelFieldJson {
  id: string;
  label: string;
  type: string;
  order: number;
  defaultValue?: string;
  options?: string[];
  placeholder?: string;
}
export interface HemocultureObservationResultItemJson {
  field_id: string;
  label: string;
  value: string;
  order: number;
}
type HemocultureObservationModel = Tables<"hemoculture_observation_model"> & {
  fields_json: HemocultureModelFieldJson[];
};
type PatientHemocultureObservation =
  Tables<"patient_hemoculture_observation"> & {
    hemoculture_observation_model?: Pick<
      HemocultureObservationModel,
      "name" | "description" | "fields_json"
    > | null;
  };

// --- Antibiogram Types ---
export interface AntibiotiqueItemJson {
  id: string;
  name: string;
  order: number;
  s: boolean;
  i: boolean;
  r: boolean;
}
type AntibiotiqueModel = Tables<"antibiotique_model">;
type PatientAntibiogramSet = Tables<"patient_antibiogram_set"> & {
  antibiotique_model?: Pick<AntibiotiqueModel, "name" | "description"> | null;
};

interface HemocultureMainContentProps {
  resultId: string;
}

const renderSirValueStatic = (
  item: AntibiotiqueItemJson,
  column: "s" | "i" | "r"
) => {
  if (column === "s" && item.s) return "S";
  if (column === "i" && item.i) return "I";
  if (column === "r" && item.r) return "R";
  return "";
};

export default function HemocultureMainContent({
  resultId,
}: HemocultureMainContentProps) {
  const [isPageLoading, setIsPageLoading] = useState(true);
  const printableRef = useRef<HTMLDivElement>(null);
  const [printTarget, setPrintTarget] = useState<
    "all" | "observation" | "antibiogram" | null
  >(null);
  const [printSetId, setPrintSetId] = useState<string | null>(null);

  const [patientObservation, setPatientObservation] =
    useState<PatientHemocultureObservation | null>(null);
  const [availableObservationModels, setAvailableObservationModels] = useState<
    HemocultureObservationModel[]
  >([]);
  const [showObservationModelSelector, setShowObservationModelSelector] =
    useState(false);
  const [selectedNewObservationModelId, setSelectedNewObservationModelId] =
    useState<string | undefined>(undefined);
  const [isObservationLoading, setIsObservationLoading] = useState(true);
  const [isObservationSaving, setIsObservationSaving] = useState(false);
  const [isEditingObservation, setIsEditingObservation] = useState(false);
  const [observationResultValues, setObservationResultValues] = useState<{
    [fieldId: string]: string;
  }>({});
  const [showDeleteObservationDialog, setShowDeleteObservationDialog] =
    useState(false);

  const [appliedAntibiogramSets, setAppliedAntibiogramSets] = useState<
    PatientAntibiogramSet[]
  >([]);
  const [availableAntibiotiqueModels, setAvailableAntibiotiqueModels] =
    useState<AntibiotiqueModel[]>([]);
  const [editingAntibiogramSet, setEditingAntibiogramSet] =
    useState<PatientAntibiogramSet | null>(null);
  const [currentAntibiogramResultsJson, setCurrentAntibiogramResultsJson] =
    useState<AntibiotiqueItemJson[]>([]);
  const [
    currentAntibiogramSetDescription,
    setCurrentAntibiogramSetDescription,
  ] = useState<string>("");
  const [isLoadingAntibiotiqueData, setIsLoadingAntibiotiqueData] =
    useState(true);
  const [isSavingAntibiogram, setIsSavingAntibiogram] = useState(false);
  const [isDeletingAntibiogram, setIsDeletingAntibiogram] = useState(false);
  const [showAntibiotiqueModelSelector, setShowAntibiotiqueModelSelector] =
    useState(false);
  const [selectedNewAntibiotiqueModelId, setSelectedNewAntibiotiqueModelId] =
    useState<string | undefined>(undefined);
  const [showDeleteAntibiogramDialog, setShowDeleteAntibiogramDialog] =
    useState(false);
  const [antibiogramSetToDelete, setAntibiogramSetToDelete] =
    useState<PatientAntibiogramSet | null>(null);
  const [showAddAdhocAntibiotiqueDialog, setShowAddAdhocAntibiotiqueDialog] =
    useState(false);
  const [newAdhocAntibiotiqueName, setNewAdhocAntibiotiqueName] = useState("");
  const [isReorderingAtb, setIsReorderingAtb] = useState(false);

  const fetchInitialData = useCallback(async () => {
    setIsPageLoading(true);
    setIsObservationLoading(true);
    setIsLoadingAntibiotiqueData(true);
    try {
      const [obsModelsRes, patientObsRes, atbModelsRes, appliedAtbSetsRes] =
        await Promise.all([
          supabase
            .from("hemoculture_observation_model")
            .select("*")
            .order("name"),
          supabase
            .from("patient_hemoculture_observation")
            .select(
              "*, hemoculture_observation_model:source_model_id!inner(name, description, fields_json)"
            )
            .eq("patient_result_id", resultId)
            .maybeSingle(),
          supabase.from("antibiotique_model").select("*").order("name"),
          supabase
            .from("patient_antibiogram_set")
            .select(
              "*, antibiotique_model:source_antibiotique_model_id (name, description)"
            )
            .eq("patient_result_id", resultId)
            .order("created_at", { ascending: true }),
        ]);
      if (obsModelsRes.error)
        sonnerToast.error("Erreur modèles obs.", {
          description: obsModelsRes.error.message,
        });
      else
        setAvailableObservationModels(
          (obsModelsRes.data || []).map((m) => ({
            ...m,
            fields_json: (typeof m.fields_json === "string"
              ? JSON.parse(m.fields_json)
              : m.fields_json) as HemocultureModelFieldJson[],
          })) as HemocultureObservationModel[]
        );
      if (patientObsRes.error)
        sonnerToast.error("Erreur obs. patient", {
          description: patientObsRes.error.message,
        });
      else
        setPatientObservation(
          patientObsRes.data as PatientHemocultureObservation | null
        );
      if (atbModelsRes.error)
        sonnerToast.error("Erreur modèles ATB", {
          description: atbModelsRes.error.message,
        });
      else setAvailableAntibiotiqueModels(atbModelsRes.data || []);
      if (appliedAtbSetsRes.error)
        sonnerToast.error("Erreur sets ATB", {
          description: appliedAtbSetsRes.error.message,
        });
      else setAppliedAntibiogramSets(appliedAtbSetsRes.data || []);
    } catch (e: any) {
      sonnerToast.error("Erreur de chargement des données.", {
        description: e.message,
      });
    } finally {
      setIsObservationLoading(false);
      setIsLoadingAntibiotiqueData(false);
      setIsPageLoading(false);
    }
  }, [resultId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // --- Hémoculture Observation Handlers ---
  const handleApplyNewObservationModel = async () => {
    if (!selectedNewObservationModelId) {
      sonnerToast.info("Sélectionnez un modèle d'observation.");
      return;
    }
    const model = availableObservationModels.find(
      (m) => m.id === selectedNewObservationModelId
    );
    if (!model || !Array.isArray(model.fields_json)) {
      sonnerToast.error("Modèle invalide.");
      return;
    }
    setIsObservationSaving(true);
    try {
      const initialResultsJson = model.fields_json.map((field) => ({
        field_id: field.id,
        label: field.label,
        value: field.defaultValue || "",
        order: field.order,
      }));
      const { data: newObservation, error } = await supabase
        .from("patient_hemoculture_observation")
        .insert({
          patient_result_id: resultId,
          source_model_id: model.id,
          results_json: initialResultsJson,
        })
        .select(
          "*, hemoculture_observation_model:source_model_id!inner(name, description, fields_json)"
        )
        .single();
      if (error) throw error;
      sonnerToast.success(`Modèle d'observation "${model.name}" appliqué.`);
      setPatientObservation(newObservation as PatientHemocultureObservation);
      startEditingObservation(newObservation as PatientHemocultureObservation);
      setShowObservationModelSelector(false);
    } catch (err: any) {
      sonnerToast.error("Erreur application modèle", {
        description: err.message,
      });
    } finally {
      setIsObservationSaving(false);
    }
  };
  const startEditingObservation = (
    obsSetToEdit?: PatientHemocultureObservation | null
  ) => {
    const currentObs = obsSetToEdit || patientObservation;
    if (!currentObs) return;
    let edits: { [fieldId: string]: string } = {};
    const currentResults = (currentObs.results_json ||
      []) as HemocultureObservationResultItemJson[];
    const modelFields =
      (currentObs.hemoculture_observation_model as HemocultureObservationModel)
        ?.fields_json || [];
    modelFields.forEach((fieldDef) => {
      const existingValue = currentResults.find(
        (r) => r.field_id === fieldDef.id
      )?.value;
      edits[fieldDef.id] = existingValue ?? fieldDef.defaultValue ?? "";
    });
    setObservationResultValues(edits);
    setIsEditingObservation(true);
  };
  const cancelEditingObservation = () => {
    setIsEditingObservation(false);
    setObservationResultValues({});
  };
  const handleObservationValueChange = (field_id: string, value: string) =>
    setObservationResultValues((prev) => ({ ...prev, [field_id]: value }));
  const saveObservationEdits = async () => {
    if (!patientObservation || !patientObservation.id) return;
    setIsObservationSaving(true);
    const modelFields =
      (
        patientObservation.hemoculture_observation_model as HemocultureObservationModel
      )?.fields_json || [];
    const newResultsJson = modelFields.map((fieldDef) => ({
      field_id: fieldDef.id,
      label: fieldDef.label,
      order: fieldDef.order,
      value: observationResultValues[fieldDef.id] ?? "",
    }));
    try {
      const { error } = await supabase
        .from("patient_hemoculture_observation")
        .update({ results_json: newResultsJson })
        .eq("id", patientObservation.id);
      if (error) throw error;
      sonnerToast.success("Observations enregistrées.");
      setIsEditingObservation(false);
      await fetchInitialData();
    } catch (err: any) {
      sonnerToast.error("Erreur enregistrement observations", {
        description: err.message,
      });
    } finally {
      setIsObservationSaving(false);
    }
  };
  const handleDeleteObservationConfirmation = async () => {
    if (!patientObservation || !patientObservation.id) return;
    setIsObservationSaving(true);
    const { error } = await supabase
      .from("patient_hemoculture_observation")
      .delete()
      .eq("id", patientObservation.id);
    setIsObservationSaving(false);
    setShowDeleteObservationDialog(false);
    if (error)
      sonnerToast.error("Erreur suppression observations", {
        description: error.message,
      });
    else {
      sonnerToast.success("Observations supprimées.");
      setPatientObservation(null);
      setObservationResultValues({});
      setIsEditingObservation(false);
    }
  };

  // --- Antibiogram Section Handlers ---
  const handleAddNewAntibiogramSet = () => {
    setSelectedNewAntibiotiqueModelId(undefined);
    setShowAntibiotiqueModelSelector(true);
    setEditingAntibiogramSet(null);
    setCurrentAntibiogramResultsJson([]);
    setCurrentAntibiogramSetDescription("");
  };
  const handleSelectAntibiotiqueModelAndStart = () => {
    if (!selectedNewAntibiotiqueModelId) {
      sonnerToast.info("Veuillez sélectionner un modèle d'antibiogramme.");
      return;
    }
    const model = availableAntibiotiqueModels.find(
      (m) => m.id === selectedNewAntibiotiqueModelId
    );
    if (model && Array.isArray(model.antibiotiques)) {
      if (
        appliedAntibiogramSets.some(
          (s) => s.source_antibiotique_model_id === model.id
        )
      ) {
        sonnerToast.warning("Modèle ATB déjà appliqué.", {
          description: "Vous pouvez le modifier.",
        });
        const existing = appliedAntibiogramSets.find(
          (s) => s.source_antibiotique_model_id === model.id
        );
        if (existing) handleEditAntibiogramSet(existing);
        setShowAntibiotiqueModelSelector(false);
        return;
      }
      const newSetData: Partial<PatientAntibiogramSet> = {
        patient_result_id: resultId,
        source_antibiotique_model_id: model.id,
        results_json: JSON.parse(JSON.stringify(model.antibiotiques)),
        description: model.description || "",
        antibiotique_model: {
          name: model.name,
          description: model.description,
        },
      };
      const initialResults = ((newSetData.results_json || []) as any[]).map(
        (item, index) => ({
          id: item.id || uuidv4(),
          name: item.name || "",
          order: item.order !== undefined ? item.order : index,
          s: item.s === true,
          i: item.i === true,
          r: item.r === true,
        })
      );
      setEditingAntibiogramSet(newSetData as PatientAntibiogramSet);
      setCurrentAntibiogramResultsJson(initialResults);
      setCurrentAntibiogramSetDescription(newSetData.description || "");
      setShowAntibiotiqueModelSelector(false);
    }
  };
  const handleEditAntibiogramSet = (set: PatientAntibiogramSet) => {
    setEditingAntibiogramSet(set);
    let parsedResults: AntibiotiqueItemJson[] = [];
    if (Array.isArray(set.results_json))
      parsedResults = set.results_json as AntibiotiqueItemJson[];
    else if (typeof set.results_json === "string") {
      try {
        parsedResults = JSON.parse(set.results_json);
        if (!Array.isArray(parsedResults)) parsedResults = [];
      } catch (e) {
        console.error("Failed to parse ATB results_json string:", e);
      }
    }
    setCurrentAntibiogramResultsJson(
      parsedResults.map((item, index) => ({
        id: item.id || uuidv4(),
        name: item.name || "",
        order: item.order !== undefined ? item.order : index,
        s: item.s === true,
        i: item.i === true,
        r: item.r === true,
      }))
    );
    setCurrentAntibiogramSetDescription(set.description || "");
    setShowAntibiotiqueModelSelector(false);
  };
  const handleAntibiogramSirChange = (
    antibiotiqueId: string,
    sirValue: "s" | "i" | "r" | "none"
  ) =>
    setCurrentAntibiogramResultsJson((prev) =>
      prev.map((item) =>
        item.id === antibiotiqueId
          ? {
              ...item,
              s: sirValue === "s",
              i: sirValue === "i",
              r: sirValue === "r",
            }
          : item
      )
    );
  const handleCancelEditAntibiogram = () => {
    setEditingAntibiogramSet(null);
    setCurrentAntibiogramResultsJson([]);
    setCurrentAntibiogramSetDescription("");
    setShowAntibiotiqueModelSelector(false);
  };
  const handleSaveAntibiogramSet = async () => {
    if (!editingAntibiogramSet || !currentAntibiogramResultsJson) return;
    setIsSavingAntibiogram(true);
    const orderedResults = currentAntibiogramResultsJson.map((item, index) => ({
      ...item,
      order: index,
    }));
    const dataToSave = {
      patient_result_id: resultId,
      source_antibiotique_model_id:
        editingAntibiogramSet.source_antibiotique_model_id,
      results_json: orderedResults,
      description: currentAntibiogramSetDescription.trim() || null,
      notes: editingAntibiogramSet.notes,
    };
    const { error } = editingAntibiogramSet.id
      ? await supabase
          .from("patient_antibiogram_set")
          .update(dataToSave)
          .eq("id", editingAntibiogramSet.id)
      : await supabase
          .from("patient_antibiogram_set")
          .insert(dataToSave)
          .select()
          .single();
    setIsSavingAntibiogram(false);
    if (error)
      sonnerToast.error("Erreur enregistrement ATB", {
        description: error.message,
      });
    else {
      sonnerToast.success(
        `Antibiogramme ${
          editingAntibiogramSet.id ? "mis à jour" : "enregistré"
        }.`
      );
      handleCancelEditAntibiogram();
      await fetchInitialData();
    }
  };
  const openDeleteAntibiogramDialog = (set: PatientAntibiogramSet) => {
    setAntibiogramSetToDelete(set);
    setShowDeleteAntibiogramDialog(true);
  };
  const handleDeleteAntibiogramConfirm = async () => {
    if (!antibiogramSetToDelete) return;
    setIsDeletingAntibiogram(true);
    const { error } = await supabase
      .from("patient_antibiogram_set")
      .delete()
      .eq("id", antibiogramSetToDelete.id);
    setIsDeletingAntibiogram(false);
    setShowDeleteAntibiogramDialog(false);
    if (error)
      sonnerToast.error("Erreur suppression ATB", {
        description: error.message,
      });
    else {
      sonnerToast.success("Set Antibiogramme supprimé.");
      if (editingAntibiogramSet?.id === antibiogramSetToDelete.id)
        handleCancelEditAntibiogram();
      await fetchInitialData();
    }
    setAntibiogramSetToDelete(null);
  };
  const handleOpenAddAdhocAntibiotiqueDialog = () => {
    setNewAdhocAntibiotiqueName("");
    setShowAddAdhocAntibiotiqueDialog(true);
  };
  const handleConfirmAddAdhocAntibiotique = () => {
    if (!newAdhocAntibiotiqueName.trim()) {
      sonnerToast.warning("Nom de l'antibiotique requis.");
      return;
    }
    const newAntibiotique: AntibiotiqueItemJson = {
      id: uuidv4(),
      name: newAdhocAntibiotiqueName.trim(),
      order: currentAntibiogramResultsJson.length,
      s: false,
      i: false,
      r: false,
    };
    setCurrentAntibiogramResultsJson((prev) => [...prev, newAntibiotique]);
    setShowAddAdhocAntibiotiqueDialog(false);
  };
  const handleRemoveAdhocAntibiotiqueFromCurrentSet = (id: string) =>
    setCurrentAntibiogramResultsJson((prev) =>
      prev
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, order: index }))
    );
  const handleMoveAntibiotiqueItem = (
    currentIndex: number,
    direction: "up" | "down"
  ) => {
    setIsReorderingAtb(true); // Indicate reorder might be in progress
    setCurrentAntibiogramResultsJson((prev) => {
      const newItems = [...prev];
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= newItems.length) return prev;
      [newItems[currentIndex], newItems[targetIndex]] = [
        newItems[targetIndex],
        newItems[currentIndex],
      ];
      const reorderedItems = newItems.map((item, index) => ({
        ...item,
        order: index,
      }));
      return reorderedItems;
    });
    // Set timeout to simulate async operation or just to remove reordering state after a bit
    setTimeout(() => setIsReorderingAtb(false), 100);
  };

  // --- Overall Print ---
  const handleActualPrint = () => {
    window.print();
    setTimeout(() => {
      setPrintTarget(null);
      setPrintSetId(null);
    }, 1000);
  };
  const prepareAndTriggerPrint = (
    target: "all" | "observation" | "antibiogram",
    atbSetId?: string
  ) => {
    setPrintTarget(target);
    if (atbSetId) setPrintSetId(atbSetId);
    else setPrintSetId(null); // Clear specific ATB set ID if not printing individual ATB
    setTimeout(() => {
      handleActualPrint();
    }, 100);
  };
  const handleOverallPrint = () => {
    prepareAndTriggerPrint("all");
  };

  const AntibiogramSetDisplayItem = ({
    set,
  }: {
    set: PatientAntibiogramSet;
  }) => {
    const results = Array.isArray(set.results_json)
      ? (set.results_json as AntibiotiqueItemJson[]).sort(
          (a, b) => a.order - b.order
        )
      : [];
    const displayDescription =
      set.description || set.antibiotique_model?.description;
    const setContainerClasses = `antibiogram-set-display-item mb-4 border rounded-lg ${
      printTarget === "all" ||
      (printTarget === "antibiogram" && printSetId === set.id)
        ? "print-this-set"
        : "print:hidden"
    }`;
    return (
      <div className={setContainerClasses} id={`antibiogram-print-${set.id}`}>
        <div className="p-3 bg-slate-100 border-b flex justify-between items-center print:hidden">
          <div>
            <h4 className="font-semibold text-md text-slate-700">
              {set.antibiotique_model?.name || "Antibiogramme Ad-hoc"}
            </h4>
            {displayDescription && (
              <p className="text-xs text-slate-500 italic">
                {displayDescription}
              </p>
            )}
          </div>
          <div className="space-x-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => prepareAndTriggerPrint("antibiogram", set.id)}
              title="Imprimer ce set ATB"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => handleEditAntibiogramSet(set)}
              title="Modifier ce set ATB"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => openDeleteAntibiogramDialog(set)}
              title="Supprimer ce set ATB"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
        <div
          className={`hidden ${
            printTarget === "antibiogram" && printSetId === set.id
              ? "print:block"
              : printTarget === "all"
              ? "print:block"
              : ""
          } mb-2 print-content-wrapper`}
        >
          <div className="print-title">RESULTAT DE L'ANTIBIOGRAMME</div>
          <div className="print-model-name">
            {set.antibiotique_model?.name || "Antibiogramme Ad-hoc"}
          </div>
          {displayDescription && (
            <div className="print-model-description">{displayDescription}</div>
          )}
        </div>
        <Table size="sm" className="min-w-full text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%] font-semibold px-2 py-1">
                Dénomination
              </TableHead>
              <TableHead className="text-center font-semibold px-1 py-1 sir-column">
                S
              </TableHead>
              <TableHead className="text-center font-semibold px-1 py-1 sir-column">
                I
              </TableHead>
              <TableHead className="text-center font-semibold px-1 py-1 sir-column">
                R
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((abItem) => (
              <TableRow key={abItem.id}>
                <TableCell className="px-2 py-0.5">{abItem.name}</TableCell>
                <TableCell className="text-center px-1 py-0.5 sir-column">
                  {renderSirValueStatic(abItem, "s")}
                </TableCell>
                <TableCell className="text-center px-1 py-0.5 sir-column">
                  {renderSirValueStatic(abItem, "i")}
                </TableCell>
                <TableCell className="text-center px-1 py-0.5 sir-column">
                  {renderSirValueStatic(abItem, "r")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-xs px-3 py-2 text-black print-legend"
              >
                S = Sensible    I = Intermédiaire    R = Résistant
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        {printTarget === "all" && (
          <div className="mt-4 print:hidden">
            <Footer date={new Date().toISOString() || ""} />
          </div>
        )}
      </div>
    );
  };

  if (isPageLoading) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="h-10 w-10 animate-spin text-sky-600" /> Chargement
        Général...
      </div>
    );
  }

  const currentObservationFields =
    patientObservation?.hemoculture_observation_model?.fields_json?.sort(
      (a, b) => a.order - b.order
    ) || [];
  const currentObservationValuesForDisplay =
    (patientObservation?.results_json ||
      []) as HemocultureObservationResultItemJson[];
  const hasObservationDataToPrint =
    patientObservation &&
    currentObservationValuesForDisplay.some(
      (item) => item.value && item.value.trim() !== ""
    );
  const hasAntibiogramDataToPrint =
    appliedAntibiogramSets.length > 0 || editingAntibiogramSet;

  const displayAntibiogramme = (set: PatientAntibiogramSet) => {
    const results = Array.isArray(set.results_json)
      ? (set.results_json as AntibiotiqueItemJson[]).sort(
          (a, b) => a.order - b.order
        )
      : [];
    const displayDescription =
      set.description || set.antibiotique_model?.description;

    return (
      <div>
        <p>{displayDescription}</p>
        <Table size="sm" className="min-w-full text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%] font-semibold px-2 py-1">
                Dénomination
              </TableHead>
              <TableHead className="text-center font-semibold px-1 py-1 sir-column">
                S
              </TableHead>
              <TableHead className="text-center font-semibold px-1 py-1 sir-column">
                I
              </TableHead>
              <TableHead className="text-center font-semibold px-1 py-1 sir-column">
                R
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((abItem) => (
              <TableRow key={abItem.id}>
                <TableCell className="px-2 py-0.5">{abItem.name}</TableCell>
                <TableCell className="text-center px-1 py-0.5 sir-column">
                  {renderSirValueStatic(abItem, "s")}
                </TableCell>
                <TableCell className="text-center px-1 py-0.5 sir-column">
                  {renderSirValueStatic(abItem, "i")}
                </TableCell>
                <TableCell className="text-center px-1 py-0.5 sir-column">
                  {renderSirValueStatic(abItem, "r")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-xs px-3 py-2 text-black print-legend"
              >
                S = Sensible    I = Intermédiaire    R = Résistant
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    );
  };

  return (
    <div className="hemoculture-content-container">
      <div className="print:hidden">
        <div
          ref={printableRef}
          className={`printable-hemoculture-area ${
            printTarget === "all" ? "print-all-active" : ""
          }`}
        >
          <div className="print-only-header hidden print:block mb-4 border-b pb-2">
            <h1 className="text-2xl font-bold text-center">HEMOCULTURE</h1>
          </div>

          <Card
            className={`mb-6 print-card-reset ${
              !hasObservationDataToPrint && printTarget === "all"
                ? "print:hidden"
                : ""
            }`}
          >
            <CardHeader className="flex flex-row justify-between items-center print:hidden print-card-header-reset">
              <CardTitle className="text-xl flex items-center">
                <Microscope className="mr-2 h-6 w-6 text-blue-600" />
                Observation / Culture
              </CardTitle>
              <div className="space-x-2">
                {!patientObservation && !isEditingObservation && (
                  <Button
                    size="sm"
                    onClick={() => setShowObservationModelSelector(true)}
                    disabled={
                      isObservationLoading ||
                      availableObservationModels.length === 0
                    }
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {availableObservationModels.length === 0
                      ? "Aucun Modèle Obs."
                      : "Appliquer Modèle"}
                  </Button>
                )}
                {patientObservation && !isEditingObservation && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEditingObservation()}
                    disabled={isObservationLoading}
                  >
                    <Edit3 className="mr-2 h-4 w-4" />
                    Modifier
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="print-card-content-reset">
              {showObservationModelSelector && !patientObservation && (
                <div className="p-4 border rounded-md bg-slate-50 print:hidden">
                  <Label className="mb-2 block">Modèle d'Observation:</Label>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={selectedNewObservationModelId}
                      onValueChange={setSelectedNewObservationModelId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableObservationModels.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleApplyNewObservationModel}
                      disabled={
                        !selectedNewObservationModelId || isObservationSaving
                      }
                    >
                      Appliquer
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowObservationModelSelector(false)}
                    >
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}
              {isObservationLoading && !patientObservation && (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              )}
              {patientObservation && (
                <div
                  className={
                    isEditingObservation
                      ? "mt-4 space-y-4"
                      : `mt-2 ${
                          printTarget === "all" || printTarget === "observation"
                            ? "observation-print-format"
                            : "observation-read-only"
                        }`
                  }
                >
                  {(isEditingObservation ||
                    patientObservation.hemoculture_observation_model?.name) && (
                    <div
                      className={`mb-3 pb-2 border-b flex justify-between items-center ${
                        isEditingObservation ? "" : "print:hidden"
                      }`}
                    >
                      <div>
                        <h3 className="text-md font-semibold text-slate-700">
                          {isEditingObservation ? "Modification: " : ""}
                          {
                            patientObservation.hemoculture_observation_model
                              ?.name
                          }
                        </h3>
                        {patientObservation.hemoculture_observation_model
                          ?.description && (
                          <p className="text-xs italic text-slate-500">
                            {
                              patientObservation.hemoculture_observation_model
                                .description
                            }
                          </p>
                        )}
                      </div>
                      {isEditingObservation && patientObservation.id && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteObservationDialog(true)}
                          disabled={isObservationSaving}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Supprimer
                        </Button>
                      )}
                    </div>
                  )}
                  <div
                    className={`hidden ${
                      printTarget === "all" || printTarget === "observation"
                        ? "print:block"
                        : ""
                    } mb-2`}
                  >
                    <div className="print-title text-lg">
                      Observation / Culture
                    </div>
                    <div className="print-model-name text-md">
                      {patientObservation.hemoculture_observation_model?.name}
                    </div>
                    {patientObservation.hemoculture_observation_model
                      ?.description && (
                      <div className="print-model-description text-sm italic">
                        {
                          patientObservation.hemoculture_observation_model
                            .description
                        }
                      </div>
                    )}
                  </div>
                  {currentObservationFields.map((fieldDef) => {
                    const resultValue = isEditingObservation
                      ? observationResultValues[fieldDef.id] ?? ""
                      : currentObservationValuesForDisplay.find(
                          (r) => r.field_id === fieldDef.id
                        )?.value ?? "";
                    if (
                      !isEditingObservation &&
                      !resultValue.trim() &&
                      !fieldDef.label.toLowerCase().includes("résultat") &&
                      !fieldDef.label.toLowerCase().includes("conclusion") &&
                      printTarget !== "all" &&
                      printTarget !== "observation"
                    )
                      return null;
                    return (
                      <div
                        key={fieldDef.id}
                        className={`mb-2 print:mb-1 ${
                          isEditingObservation
                            ? "space-y-1"
                            : "grid grid-cols-3 gap-2 items-baseline"
                        }`}
                      >
                        <Label
                          htmlFor={`obs-${fieldDef.id}`}
                          className={`text-sm print:text-xs ${
                            isEditingObservation
                              ? "block font-medium"
                              : "font-semibold col-span-1"
                          }`}
                        >
                          {fieldDef.label}:
                        </Label>
                        {isEditingObservation ? (
                          <Textarea
                            id={`obs-${fieldDef.id}`}
                            value={resultValue}
                            onChange={(e) =>
                              handleObservationValueChange(
                                fieldDef.id,
                                e.target.value
                              )
                            }
                            rows={
                              fieldDef.label
                                .toLowerCase()
                                .includes("conclusion") ||
                              fieldDef.label.toLowerCase().includes("résultat")
                                ? 4
                                : 2
                            }
                            placeholder={
                              fieldDef.placeholder ||
                              `Entrez ${fieldDef.label.toLowerCase()}...`
                            }
                            className="bg-white text-sm col-span-2"
                          />
                        ) : (
                          <span className="text-sm print:text-xs whitespace-pre-wrap col-span-2">
                            {resultValue || (
                              <span className="italic text-slate-400">N/A</span>
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {isEditingObservation && (
                    <div className="mt-6 flex justify-end space-x-2 print:hidden">
                      <Button
                        variant="outline"
                        onClick={cancelEditingObservation}
                        disabled={isObservationSaving}
                      >
                        Annuler
                      </Button>
                      <Button
                        onClick={saveObservationEdits}
                        disabled={isObservationSaving}
                      >
                        {isObservationSaving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}{" "}
                        Enregistrer
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {!isObservationLoading &&
                !patientObservation &&
                !showObservationModelSelector && (
                  <p className="italic text-slate-500 py-4 text-center print:hidden">
                    Aucune observation/culture.
                  </p>
                )}
            </CardContent>
          </Card>

          <div
            className={`antibiogram-print-section ${
              !hasAntibiogramDataToPrint && printTarget === "all"
                ? "print:hidden"
                : ""
            }`}
          >
            <Card className={`mt-6 print-card-reset`}>
              <CardHeader className="flex flex-row justify-between items-center print:hidden print-card-header-reset">
                <CardTitle className="text-xl flex items-center">
                  <ShieldCheck className="mr-2 h-6 w-6 text-red-600" />
                  Antibiogramme
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 print:pt-2 print-card-content-reset">
                {isLoadingAntibiotiqueData && (
                  <div className="text-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
                {!isLoadingAntibiotiqueData &&
                  (editingAntibiogramSet ? (
                    <div className="border rounded-lg no-print mt-0">
                      <div className="p-4 bg-slate-50 border-b rounded-t-lg">
                        <h3 className="text-lg font-semibold text-slate-700">
                          {editingAntibiogramSet.id ? "Modification" : "Nouvel"}{" "}
                          Antibiogramme :{" "}
                          {editingAntibiogramSet.antibiotique_model?.name ||
                            "Ad-hoc"}
                        </h3>
                        <div className="mt-2 space-y-1">
                          <Label
                            htmlFor="antibiogram-set-description"
                            className="text-sm font-medium text-slate-600 flex items-center"
                          >
                            <FileEdit className="h-4 w-4 mr-2" />
                            Description ATB
                          </Label>
                          <Textarea
                            id="antibiogram-set-description"
                            value={currentAntibiogramSetDescription}
                            onChange={(e) =>
                              setCurrentAntibiogramSetDescription(
                                e.target.value
                              )
                            }
                            placeholder={
                              editingAntibiogramSet.antibiotique_model
                                ?.description
                                ? `Modèle: ${editingAntibiogramSet.antibiotique_model.description.substring(
                                    0,
                                    70
                                  )}...`
                                : "Description..."
                            }
                            rows={2}
                            className="bg-white text-sm"
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          S=Sensible, I=Intermédiaire, R=Résistant
                        </p>
                      </div>
                      <div className="p-0">
                        <Table className="min-w-full">
                          {" "}
                          {/* Removed text-lg, was making it too big */}
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 px-1 py-1 print:hidden"></TableHead>{" "}
                              {/* Reorder */}
                              <TableHead className="w-[calc(40%-40px-48px)] font-semibold px-2 py-1">
                                Dénomination
                              </TableHead>
                              <TableHead className="text-center font-semibold px-1 py-1 sir-column">
                                S
                              </TableHead>
                              <TableHead className="text-center font-semibold px-1 py-1 sir-column">
                                I
                              </TableHead>
                              <TableHead className="text-center font-semibold px-1 py-1 sir-column">
                                R
                              </TableHead>
                              <TableHead className="w-[40px] px-1 py-1"></TableHead>{" "}
                              {/* Delete */}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentAntibiogramResultsJson
                              .sort((a, b) => a.order - b.order)
                              .map((abItem, index) => (
                                <TableRow
                                  key={abItem.id}
                                  className="hover:bg-slate-50"
                                >
                                  <TableCell className="px-1 py-1 align-middle print:hidden">
                                    <div className="flex flex-col items-center space-y-0.5">
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() =>
                                          handleMoveAntibiotiqueItem(
                                            index,
                                            "up"
                                          )
                                        }
                                        disabled={
                                          index === 0 || isReorderingAtb
                                        }
                                        title="Monter"
                                      >
                                        <ArrowUpCircle className="h-4 w-4 text-slate-500 hover:text-slate-700" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() =>
                                          handleMoveAntibiotiqueItem(
                                            index,
                                            "down"
                                          )
                                        }
                                        disabled={
                                          index ===
                                            currentAntibiogramResultsJson.length -
                                              1 || isReorderingAtb
                                        }
                                        title="Descendre"
                                      >
                                        <ArrowDownCircle className="h-4 w-4 text-slate-500 hover:text-slate-700" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-2 py-1 align-middle font-medium">
                                    {abItem.name}
                                  </TableCell>
                                  {["s", "i", "r"].map((sirKey) => (
                                    <TableCell
                                      key={sirKey}
                                      className="text-center px-1 py-1 sir-column align-middle"
                                    >
                                      <RadioGroup
                                        value={
                                          abItem.s
                                            ? "s"
                                            : abItem.i
                                            ? "i"
                                            : abItem.r
                                            ? "r"
                                            : "none"
                                        }
                                        onValueChange={(val) =>
                                          handleAntibiogramSirChange(
                                            abItem.id,
                                            val as any
                                          )
                                        }
                                      >
                                        <div className="flex items-center justify-center">
                                          <RadioGroupItem
                                            value={sirKey}
                                            id={`${sirKey}-${abItem.id}`}
                                          />
                                        </div>
                                      </RadioGroup>
                                    </TableCell>
                                  ))}
                                  <TableCell className="px-1 py-1 align-middle">
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() =>
                                        handleRemoveAdhocAntibiotiqueFromCurrentSet(
                                          abItem.id
                                        )
                                      }
                                      title="Supprimer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="text-xs px-3 py-2 text-black print:text-black"
                              >
                                S = Sensible    I = Intermédiaire    R =
                                Résistant
                              </TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                      <div className="p-4 border-t flex items-center justify-between bg-slate-50 rounded-b-lg">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenAddAdhocAntibiotiqueDialog}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Ajouter Ad-hoc
                        </Button>
                        <div className="space-x-2">
                          <Button
                            variant="outline"
                            onClick={handleCancelEditAntibiogram}
                            disabled={isSavingAntibiogram}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Annuler
                          </Button>
                          <Button
                            onClick={handleSaveAntibiogramSet}
                            disabled={isSavingAntibiogram}
                          >
                            {isSavingAntibiogram ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-4 w-4" />
                            )}
                            Enregistrer ATB
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-2 flex justify-end items-center no-print">
                        <Button
                          onClick={handleAddNewAntibiogramSet}
                          size="sm"
                          disabled={
                            isLoadingAntibiotiqueData ||
                            availableAntibiotiqueModels.length === 0
                          }
                        >
                          {availableAntibiotiqueModels.length === 0 ? (
                            "Aucun Modèle ATB"
                          ) : (
                            <>
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Appliquer Modèle ATB
                            </>
                          )}
                        </Button>
                      </div>
                      {showAntibiotiqueModelSelector && (
                        <Card className="mb-4 p-4 no-print">
                          <Label
                            htmlFor="atb-model-select"
                            className="mb-2 block font-medium"
                          >
                            Choisir un modèle ATB:
                          </Label>
                          <div className="flex space-x-2">
                            <Select
                              value={selectedNewAntibiotiqueModelId}
                              onValueChange={setSelectedNewAntibiotiqueModelId}
                            >
                              <SelectTrigger
                                id="atb-model-select"
                                className="flex-grow"
                              >
                                <SelectValue placeholder="Sélectionner..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableAntibiotiqueModels.map((model) => (
                                  <SelectItem
                                    key={model.id}
                                    value={model.id}
                                    disabled={appliedAntibiogramSets.some(
                                      (s) =>
                                        s.source_antibiotique_model_id ===
                                        model.id
                                    )}
                                  >
                                    {model.name}{" "}
                                    {appliedAntibiogramSets.some(
                                      (s) =>
                                        s.source_antibiotique_model_id ===
                                        model.id
                                    ) && "(Déjà appliqué)"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              onClick={handleSelectAntibiotiqueModelAndStart}
                              disabled={
                                !selectedNewAntibiotiqueModelId ||
                                isLoadingAntibiotiqueData
                              }
                            >
                              Commencer
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setShowAntibiotiqueModelSelector(false)
                              }
                            >
                              Annuler
                            </Button>
                          </div>
                        </Card>
                      )}
                      {!isLoadingAntibiotiqueData &&
                      appliedAntibiogramSets.length > 0 ? (
                        <div className="space-y-3">
                          {appliedAntibiogramSets.map((set) => (
                            <AntibiogramSetDisplayItem key={set.id} set={set} />
                          ))}
                        </div>
                      ) : (
                        !showAntibiotiqueModelSelector && (
                          <p className="italic text-slate-500 py-2 text-center no-print">
                            Aucun antibiogramme appliqué.
                          </p>
                        )
                      )}
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          <div className="footer-print-only hidden print:block">
            {" "}
            <Footer date={new Date().toISOString() || ""} />{" "}
          </div>
        </div>

        <div className="mt-8 flex justify-end no-print">
          <Button onClick={handleOverallPrint} size="lg">
            <Printer className="mr-2 h-5 w-5" />
            Imprimer Rapport Hémoculture
          </Button>
        </div>

        {/* Dialogs */}
        <AlertDialog
          open={showDeleteObservationDialog}
          onOpenChange={setShowDeleteObservationDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Confirmer Suppression Observation
              </AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer ces observations/résultats de
                culture (Modèle:{" "}
                {patientObservation?.hemoculture_observation_model?.name ||
                  "N/A"}
                ) ? Action irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => setShowDeleteObservationDialog(false)}
                disabled={isObservationSaving}
              >
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteObservationConfirmation}
                className="bg-destructive hover:bg-destructive/90"
                disabled={isObservationSaving}
              >
                {isObservationSaving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}{" "}
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={showDeleteAntibiogramDialog}
          onOpenChange={setShowDeleteAntibiogramDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Confirmer Suppression Antibiogramme
              </AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer ce set d'antibiogramme
                (Modèle:{" "}
                {antibiogramSetToDelete?.antibiotique_model?.name || "N/A"}) ?
                Action irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => setAntibiogramSetToDelete(null)}
                disabled={isDeletingAntibiogram}
              >
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAntibiogramConfirm}
                className="bg-destructive hover:bg-destructive/90"
                disabled={isDeletingAntibiogram}
              >
                {isDeletingAntibiogram && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}{" "}
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={showAddAdhocAntibiotiqueDialog}
          onOpenChange={setShowAddAdhocAntibiotiqueDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ajouter Antibiotique (Ad-hoc)</AlertDialogTitle>
              <AlertDialogDescription>
                Nom du nouvel antibiotique. S, I, R seront non sélectionnés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="adhoc-name-atb">Nom de l'antibiotique</Label>
              <Input
                id="adhoc-name-atb"
                value={newAdhocAntibiotiqueName}
                onChange={(e) => setNewAdhocAntibiotiqueName(e.target.value)}
                placeholder="Ex: Vancomycine"
                className="mt-1"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => setNewAdhocAntibiotiqueName("")}
              >
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmAddAdhocAntibiotique}>
                Ajouter
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* for my print only */}
      <div className="hidden print:block">
        <h1 className="text-2xl text-black text-center uppercase font-bold mb-1">
          HEMOCULTURE
        </h1>

        {/* observation fields and values not default values but actual result stored */}
        {/* actual stored values for this result */}
        <div>
          {currentObservationFields.map((field) => {
            const resultValue = isEditingObservation
              ? observationResultValues[field.id] ?? ""
              : currentObservationValuesForDisplay.find(
                  (r) => r.field_id === field.id
                )?.value ?? "";
            return (
              <div
                key={field.id}
                className="flex space-x-2 mb-2 items-baseline"
              >
                <div>
                  <p className="font-semibold text-lg whitespace-nowrap ">
                    {field.label}:
                  </p>
                </div>
                <div>
                  <p className="text-md">{resultValue}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* atb */}
        <div>
          {appliedAntibiogramSets.length > 0 && (
            <>
              <h1 className="text-2xl text-black text-center uppercase font-bold mb-1">
                ANTIBIOGRAMME
              </h1>
              {displayAntibiogramme(
                appliedAntibiogramSets[appliedAntibiogramSets.length - 1]
              )}
            </>
          )}
        </div>

        {/* footer */}
        <div className="mt-8">
          <Footer date={new Date().toISOString() || ""} />
        </div>
      </div>
    </div>
  );
}
