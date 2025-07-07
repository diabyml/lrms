// // src/components/app/results/antibiogram/MainContent.tsx
// import { useState, useEffect, useCallback, useRef } from "react";
// import { supabase } from "@/lib/supabaseClient"; // Adjust as needed
// import { Database } from "@/lib/database.types"; // Adjust as needed
// import { Button } from "@/components/ui/button";
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
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import {
//   Loader2,
//   PlusCircle,
//   Edit3,
//   Trash2,
//   Printer,
//   Save,
//   XCircle,
//   ShieldAlert,
//   FileEdit, // Icon for editing description
// } from "lucide-react";
// import { toast as sonnerToast } from "sonner";
// import { v4 as uuidv4 } from "uuid";
// import Footer from "@/components/Footer"; // Assuming this component exists

// export interface AntibiotiqueItemJson {
//   id: string;
//   name: string;
//   order: number;
//   s: boolean;
//   i: boolean;
//   r: boolean;
// }

// type AntibiotiqueModel =
//   Database["public"]["Tables"]["antibiotique_model"]["Row"];

// type PatientAntibiogramSet =
//   Database["public"]["Tables"]["patient_antibiogram_set"]["Row"] & {
//     antibiotique_model?: Pick<AntibiotiqueModel, "name" | "description"> | null;
//   };

// interface MainContentProps {
//   resultId: string;
//   // Optional: Pass patient info if needed for printing header
//   // patientName?: string;
//   // patientRecordId?: string; // e.g. MRN
//   // sampleNature?: string;
//   // studiedStrain?: string;
//   // collectionDate?: string;
//   // resultDate?: string;
// }

// const renderSirValue = (
//   item: AntibiotiqueItemJson,
//   column: "s" | "i" | "r"
// ) => {
//   if (column === "s" && item.s) return "S";
//   if (column === "i" && item.i) return "I";
//   if (column === "r" && item.r) return "R";
//   return "";
// };

// export const MainContent = ({
//   resultId,
// }: // patientName,
// // patientRecordId,
// // sampleNature,
// // studiedStrain,
// // collectionDate,
// // resultDate
// MainContentProps) => {
//   const [appliedSets, setAppliedSets] = useState<PatientAntibiogramSet[]>([]);
//   const [availableModels, setAvailableModels] = useState<AntibiotiqueModel[]>(
//     []
//   );
//   const [editingSet, setEditingSet] = useState<PatientAntibiogramSet | null>(
//     null
//   );
//   const [currentResultsJson, setCurrentResultsJson] = useState<
//     AntibiotiqueItemJson[]
//   >([]);
//   const [currentSetDescription, setCurrentSetDescription] =
//     useState<string>(""); // For editable description

//   const [isLoadingSets, setIsLoadingSets] = useState(true);
//   const [isLoadingModels, setIsLoadingModels] = useState(true);
//   const [isSaving, setIsSaving] = useState(false);
//   const [isDeleting, setIsDeleting] = useState(false);
//   const [showModelSelector, setShowModelSelector] = useState(false);
//   const [selectedNewModelId, setSelectedNewModelId] = useState<
//     string | undefined
//   >(undefined);
//   const [showDeleteDialog, setShowDeleteDialog] = useState(false);
//   const [setToDelete, setSetToDelete] = useState<PatientAntibiogramSet | null>(
//     null
//   );
//   const [showAddAdhocAntibiotiqueDialog, setShowAddAdhocAntibiotiqueDialog] =
//     useState(false);
//   const [newAdhocAntibiotiqueName, setNewAdhocAntibiotiqueName] = useState("");

//   const [printSetId, setPrintSetId] = useState<string | null>(null); // To target specific set for print styles

//   const fetchAppliedSets = useCallback(async () => {
//     setIsLoadingSets(true);
//     const { data, error } = await supabase
//       .from("patient_antibiogram_set")
//       .select(
//         `*, antibiotique_model:source_antibiotique_model_id (name, description)`
//       )
//       .eq("patient_result_id", resultId)
//       .order("created_at", { ascending: true });
//     if (error)
//       sonnerToast.error("Erreur chargement des antibiogrammes", {
//         description: error.message,
//       });
//     else setAppliedSets(data || []);
//     setIsLoadingSets(false);
//   }, [resultId]);

//   const fetchAvailableModels = useCallback(async () => {
//     setIsLoadingModels(true);
//     const { data, error } = await supabase
//       .from("antibiotique_model")
//       .select("*")
//       .order("name");
//     if (error)
//       sonnerToast.error("Erreur chargement des modèles", {
//         description: error.message,
//       });
//     else setAvailableModels(data || []);
//     setIsLoadingModels(false);
//   }, []);

//   useEffect(() => {
//     fetchAppliedSets();
//     fetchAvailableModels();
//   }, [fetchAppliedSets, fetchAvailableModels]);

//   const handleAddNewSet = () => {
//     setSelectedNewModelId(undefined);
//     setShowModelSelector(true);
//     setEditingSet(null);
//     setCurrentResultsJson([]);
//     setCurrentSetDescription("");
//   };

//   const handleSelectModelAndStart = () => {
//     if (!selectedNewModelId) {
//       sonnerToast.info("Veuillez sélectionner un modèle.");
//       return;
//     }
//     const model = availableModels.find((m) => m.id === selectedNewModelId);
//     if (model && Array.isArray(model.antibiotiques)) {
//       if (
//         appliedSets.some((s) => s.source_antibiotique_model_id === model.id)
//       ) {
//         sonnerToast.warning("Modèle déjà appliqué", {
//           description:
//             "Ce modèle a déjà été appliqué. Vous pouvez le modifier.",
//         });
//         const existing = appliedSets.find(
//           (s) => s.source_antibiotique_model_id === model.id
//         );
//         if (existing) handleEditSet(existing);
//         setShowModelSelector(false);
//         return;
//       }
//       const newSetData: Partial<PatientAntibiogramSet> = {
//         patient_result_id: resultId,
//         source_antibiotique_model_id: model.id,
//         results_json: JSON.parse(JSON.stringify(model.antibiotiques)),
//         description: model.description || "", // Initialize with model's description
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
//       setEditingSet(newSetData as PatientAntibiogramSet);
//       setCurrentResultsJson(initialResults);
//       setCurrentSetDescription(model.description || "");
//       setShowModelSelector(false);
//     }
//   };

//   const handleEditSet = (set: PatientAntibiogramSet) => {
//     setEditingSet(set);
//     let parsedResults: AntibiotiqueItemJson[] = [];
//     if (Array.isArray(set.results_json))
//       parsedResults = set.results_json as AntibiotiqueItemJson[];
//     else if (typeof set.results_json === "string") {
//       try {
//         parsedResults = JSON.parse(set.results_json);
//         if (!Array.isArray(parsedResults)) parsedResults = [];
//       } catch (e) {
//         console.error("Failed to parse results_json string:", e);
//       }
//     }
//     setCurrentResultsJson(
//       parsedResults.map((item, index) => ({
//         id: item.id || uuidv4(),
//         name: item.name || "",
//         order: item.order !== undefined ? item.order : index,
//         s: item.s === true,
//         i: item.i === true,
//         r: item.r === true,
//       }))
//     );
//     setCurrentSetDescription(set.description || ""); // Use the set's own description
//     setShowModelSelector(false);
//   };

//   const handleSirChange = (
//     antibiotiqueId: string,
//     sirValue: "s" | "i" | "r" | "none"
//   ) => {
//     setCurrentResultsJson((prevJson) =>
//       prevJson.map((item) =>
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
//   };

//   const handleCancelEdit = () => {
//     setEditingSet(null);
//     setCurrentResultsJson([]);
//     setCurrentSetDescription("");
//     setShowModelSelector(false);
//   };

//   const handleSaveSet = async () => {
//     if (!editingSet || !currentResultsJson) return;
//     setIsSaving(true);
//     const dataToSave = {
//       patient_result_id: resultId,
//       source_antibiotique_model_id: editingSet.source_antibiotique_model_id,
//       results_json: currentResultsJson.map((item, index) => ({
//         ...item,
//         order: index,
//       })),
//       description: currentSetDescription.trim() || null, // Save the current editable description
//       notes: editingSet.notes,
//     };
//     const { error } = editingSet.id
//       ? await supabase
//           .from("patient_antibiogram_set")
//           .update(dataToSave)
//           .eq("id", editingSet.id)
//       : await supabase
//           .from("patient_antibiogram_set")
//           .insert(dataToSave)
//           .select()
//           .single();
//     setIsSaving(false);
//     if (error)
//       sonnerToast.error("Erreur d'enregistrement", {
//         description: error.message,
//       });
//     else {
//       sonnerToast.success(
//         `Antibiogramme ${editingSet.id ? "mis à jour" : "enregistré"}.`
//       );
//       handleCancelEdit();
//       fetchAppliedSets();
//     }
//   };

//   const openDeleteSetDialog = (set: PatientAntibiogramSet) => {
//     setSetToDelete(set);
//     setShowDeleteDialog(true);
//   };
//   const handleDeleteSetConfirm = async () => {
//     if (!setToDelete) return;
//     setIsDeleting(true);
//     const { error } = await supabase
//       .from("patient_antibiogram_set")
//       .delete()
//       .eq("id", setToDelete.id);
//     setIsDeleting(false);
//     setShowDeleteDialog(false);
//     if (error)
//       sonnerToast.error("Erreur de suppression", {
//         description: error.message,
//       });
//     else {
//       sonnerToast.success("Jeu d'antibiogramme supprimé.");
//       fetchAppliedSets();
//       if (editingSet?.id === setToDelete.id) handleCancelEdit();
//     }
//     setSetToDelete(null);
//   };

//   const handleActualPrint = () => {
//     // Renamed to avoid conflict
//     window.print();
//     // Reset after print dialog is likely closed or actioned to remove print-specific classes
//     setTimeout(() => setPrintSetId(null), 1000);
//   };

//   const prepareAndTriggerPrint = (set: PatientAntibiogramSet) => {
//     setPrintSetId(set.id); // Set the ID of the set to be printed
//     // Delay print to allow state to update and conditional rendering in AntibiogramSetDisplay
//     setTimeout(() => {
//       handleActualPrint();
//     }, 100); // Small delay
//   };

//   const handleOpenAddAdhocAntibiotiqueDialog = () => {
//     setNewAdhocAntibiotiqueName("");
//     setShowAddAdhocAntibiotiqueDialog(true);
//   };
//   const handleConfirmAddAdhocAntibiotique = () => {
//     if (!newAdhocAntibiotiqueName.trim()) {
//       sonnerToast.warning("Le nom de l'antibiotique est requis.");
//       return;
//     }
//     const newAntibiotique: AntibiotiqueItemJson = {
//       id: uuidv4(),
//       name: newAdhocAntibiotiqueName.trim(),
//       order: currentResultsJson.length,
//       s: false,
//       i: false,
//       r: false,
//     };
//     setCurrentResultsJson((prev) => [...prev, newAntibiotique]);
//     setShowAddAdhocAntibiotiqueDialog(false);
//   };
//   const handleRemoveAdhocAntibiotique = (antibiotiqueIdToRemove: string) => {
//     setCurrentResultsJson((prev) =>
//       prev
//         .filter((item) => item.id !== antibiotiqueIdToRemove)
//         .map((item, index) => ({ ...item, order: index }))
//     );
//   };

//   const AntibiogramSetDisplay = ({ set }: { set: PatientAntibiogramSet }) => {
//     const results = Array.isArray(set.results_json)
//       ? (set.results_json as AntibiotiqueItemJson[]).sort(
//           (a, b) => a.order - b.order
//         )
//       : [];
//     const displayDescription =
//       set.description || set.antibiotique_model?.description; // Prioritize instance description

//     // Conditionally apply 'print-this-set' only when printing this specific set
//     const setContainerClasses = `printable-antibiogram ${
//       printSetId === set.id ? "print-this-set" : "print:hidden"
//     }`;

//     return (
//       <div className={setContainerClasses} id={`antibiogram-set-${set.id}`}>
//         <div className="print-header p-4 bg-gray-100 border-b flex justify-between items-center print:hidden">
//           <div>
//             <h3 className="text-lg font-semibold text-gray-700">
//               {set.antibiotique_model?.name || "Modèle Ad-hoc"}
//             </h3>
//             {displayDescription && (
//               <p className="text-sm text-gray-500 italic">
//                 {displayDescription}
//               </p>
//             )}
//           </div>
//           <div className="space-x-2 print:hidden">
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={() => prepareAndTriggerPrint(set)}
//               className="no-print"
//             >
//               <Printer className="mr-1 h-4 w-4" /> Imprimer
//             </Button>
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={() => handleEditSet(set)}
//               className="no-print"
//             >
//               <Edit3 className="mr-1 h-4 w-4" /> Modifier
//             </Button>
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={() => openDeleteSetDialog(set)}
//               className="text-red-600 hover:bg-red-50 no-print"
//             >
//               <Trash2 className="mr-1 h-4 w-4" /> Supprimer
//             </Button>
//           </div>
//         </div>
//         <div>
//           {" "}
//           {/* Screen display padding */}
//           {/* Content for print (will be styled by @media print) */}
//           <div className="print-content-wrapper hidden print:block">
//             {" "}
//             {/* Wrapper for print-specific layout */}
//             {/* You'd inject patientName, sampleNature etc. here for print if passed as props */}
//             <div className="print-title print:hidden">
//               RESULTAT DE L'ANTIBIOGRAMME
//             </div>
//             <div className="print-model-name print:hidden">
//               {set.antibiotique_model?.name || "Modèle Ad-hoc"}
//             </div>
//             {displayDescription && (
//               <div className="print-model-description">
//                 {displayDescription}
//               </div>
//             )}
//           </div>
//           <Table className="min-w-full">
//             <TableHeader>
//               <TableRow>
//                 <TableHead className="w-[40%] font-semibold px-3 py-2">
//                   Dénomination
//                 </TableHead>
//                 <TableHead className="text-center font-semibold px-1 py-2 sir-column">
//                   S
//                 </TableHead>
//                 <TableHead className="text-center font-semibold px-1 py-2 sir-column">
//                   I
//                 </TableHead>
//                 <TableHead className="text-center font-semibold px-1 py-2 sir-column">
//                   R
//                 </TableHead>
//               </TableRow>
//             </TableHeader>
//             <TableBody>
//               {results.map((abItem) => (
//                 <TableRow key={abItem.id}>
//                   <TableCell className="font-medium px-3 py-1.5">
//                     {abItem.name}
//                   </TableCell>
//                   <TableCell className="text-center px-1 py-1.5 sir-column">
//                     {renderSirValue(abItem, "s")}
//                   </TableCell>
//                   <TableCell className="text-center px-1 py-1.5 sir-column">
//                     {renderSirValue(abItem, "i")}
//                   </TableCell>
//                   <TableCell className="text-center px-1 py-1.5 sir-column">
//                     {renderSirValue(abItem, "r")}
//                   </TableCell>
//                 </TableRow>
//               ))}
//             </TableBody>
//             <TableFooter>
//               <TableRow>
//                 <TableCell
//                   colSpan={4}
//                   className="text-xs px-3 py-2 text-black print-legend"
//                 >
//                   S = Sensible    I = Intermédiaire    R = Résistant
//                 </TableCell>
//               </TableRow>
//             </TableFooter>
//           </Table>
//           <div className="mt-4 ">
//             <Footer date={new Date().toISOString() || ""} />
//           </div>
//         </div>
//       </div>
//     );
//   };

//   if (isLoadingSets || isLoadingModels) {
//     return (
//       <div className="flex justify-center items-center p-8">
//         <Loader2 className="h-8 w-8 animate-spin text-sky-600" /> Chargement...
//       </div>
//     );
//   }

//   return (
//     <div>
//       {" "}
//       {/* This ref is for the whole page, print CSS will target .print-this-set */}
//       <div className="mb-1 flex justify-between print:justify-center items-center no-print">
//         <h1 className="text-2xl font-bold text-slate-700 text-center">
//           ANTIBIOGRAMME
//         </h1>
//         {!editingSet && (
//           <Button onClick={handleAddNewSet} size="sm" className="print:hidden">
//             <PlusCircle className="mr-2 h-4 w-4" /> Appliquer un Modèle
//           </Button>
//         )}
//       </div>
//       {showModelSelector && !editingSet && (
//         <div className="">
//           <Label htmlFor="model-select" className="mb-2 block font-medium">
//             Choisir un modèle :
//           </Label>
//           <div className="flex space-x-2">
//             <Select
//               value={selectedNewModelId}
//               onValueChange={setSelectedNewModelId}
//             >
//               <SelectTrigger id="model-select" className="flex-grow">
//                 <SelectValue placeholder="Sélectionner..." />
//               </SelectTrigger>
//               <SelectContent>
//                 {availableModels.map((model) => (
//                   <SelectItem
//                     key={model.id}
//                     value={model.id}
//                     disabled={appliedSets.some(
//                       (s) => s.source_antibiotique_model_id === model.id
//                     )}
//                   >
//                     {model.name}{" "}
//                     {appliedSets.some(
//                       (s) => s.source_antibiotique_model_id === model.id
//                     ) && "(Déjà appliqué)"}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//             <Button
//               onClick={handleSelectModelAndStart}
//               disabled={!selectedNewModelId}
//             >
//               Commencer
//             </Button>
//             <Button variant="ghost" onClick={() => setShowModelSelector(false)}>
//               Annuler
//             </Button>
//           </div>
//         </div>
//       )}
//       {editingSet ? (
//         <div className="">
//           <div className=" bg-slate-50 border-b rounded-t-lg">
//             <h2 className="text-xl font-semibold text-slate-700">
//               {editingSet.id ? "Modification" : "Nouvel"} Antibiogramme :{" "}
//               {editingSet.antibiotique_model?.name || "Ad-hoc"}
//             </h2>
//             {/* Editable Description Area */}
//             <div className="mt-2 space-y-1">
//               <Label
//                 htmlFor="set-description"
//                 className="text-sm font-medium text-slate-600 flex items-center"
//               >
//                 <FileEdit className="h-4 w-4 mr-2 text-slate-500" />
//                 Description pour ce set (optionnel)
//               </Label>
//               <Textarea
//                 id="set-description"
//                 value={currentSetDescription}
//                 onChange={(e) => setCurrentSetDescription(e.target.value)}
//                 placeholder={
//                   editingSet.antibiotique_model?.description
//                     ? "Basé sur: " + editingSet.antibiotique_model.description
//                     : "Entrez une description..."
//                 }
//                 rows={2}
//                 className="bg-white text-sm"
//               />
//             </div>
//             <p className="text-sm text-slate-500 mt-2">
//               S=Sensible, I=Intermédiaire, R=Résistant
//             </p>
//           </div>
//           <div className="p-0">
//             <Table className="min-w-full text-lg">
//               <TableHeader>
//                 <TableRow>
//                   <TableHead className="w-[calc(40%-40px)] font-semibold px-3 py-2">
//                     Dénomination
//                   </TableHead>
//                   <TableHead className="text-center font-semibold px-1 py-2 sir-column">
//                     S
//                   </TableHead>
//                   <TableHead className="text-center font-semibold px-1 py-2 sir-column">
//                     I
//                   </TableHead>
//                   <TableHead className="text-center font-semibold px-1 py-2 sir-column">
//                     R
//                   </TableHead>
//                   <TableHead className="w-[40px] px-1 py-2"></TableHead>
//                 </TableRow>
//               </TableHeader>
//               <TableBody>
//                 {currentResultsJson
//                   .sort((a, b) => a.order - b.order)
//                   .map((abItem) => (
//                     <TableRow key={abItem.id} className="hover:bg-blue-100">
//                       <TableCell className="font-medium px-3 py-1.5 align-middle">
//                         {abItem.name}
//                       </TableCell>
//                       {["s", "i", "r"].map((sirKey) => (
//                         <TableCell
//                           key={sirKey}
//                           className="text-center px-1 py-1.5 sir-column align-middle"
//                         >
//                           <RadioGroup
//                             value={
//                               abItem.s
//                                 ? "s"
//                                 : abItem.i
//                                 ? "i"
//                                 : abItem.r
//                                 ? "r"
//                                 : "none"
//                             }
//                             onValueChange={(val) =>
//                               handleSirChange(
//                                 abItem.id,
//                                 val as "s" | "i" | "r" | "none"
//                               )
//                             }
//                           >
//                             <div className="flex items-center justify-center">
//                               <RadioGroupItem
//                                 value={sirKey}
//                                 id={`${sirKey}-${resultId}-${editingSet.source_antibiotique_model_id}-${abItem.id}`}
//                               />
//                             </div>
//                           </RadioGroup>
//                         </TableCell>
//                       ))}
//                       <TableCell className="px-1 py-1.5 align-middle">
//                         <Button
//                           variant="ghost"
//                           size="icon-sm"
//                           onClick={() =>
//                             handleRemoveAdhocAntibiotique(abItem.id)
//                           }
//                           title="Supprimer cet antibiotique"
//                         >
//                           <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
//                         </Button>
//                       </TableCell>
//                     </TableRow>
//                   ))}
//               </TableBody>
//               <TableFooter>
//                 <TableRow>
//                   <TableCell
//                     colSpan={5}
//                     className="text-xs px-3 py-2 text-black print:text-black"
//                   >
//                     S = Sensible    I = Intermédiaire    R = Résistant
//                   </TableCell>
//                 </TableRow>
//               </TableFooter>
//             </Table>
//           </div>
//           <div className="flex items-center justify-between bg-slate-50 rounded-b-lg">
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={handleOpenAddAdhocAntibiotiqueDialog}
//             >
//               <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Ad-hoc
//             </Button>
//             <div className="space-x-2">
//               <Button
//                 variant="outline"
//                 onClick={handleCancelEdit}
//                 disabled={isSaving}
//               >
//                 <XCircle className="mr-2 h-4 w-4" /> Annuler
//               </Button>
//               <Button onClick={handleSaveSet} disabled={isSaving}>
//                 {isSaving ? (
//                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                 ) : (
//                   <Save className="mr-2 h-4 w-4" />
//                 )}{" "}
//                 Enregistrer
//               </Button>
//             </div>
//           </div>
//         </div>
//       ) : appliedSets.length > 0 ? (
//         <div className="space-y-6">
//           {appliedSets.map((set) => (
//             <AntibiogramSetDisplay key={set.id} set={set} />
//           ))}
//         </div>
//       ) : (
//         !showModelSelector && (
//           <div className="text-center py-10 bg-slate-50 rounded-lg shadow border">
//             <ShieldAlert className="mx-auto h-12 w-12 text-slate-400 mb-3" />
//             <p className="text-xl font-semibold text-slate-600">
//               Aucun antibiogramme appliqué.
//             </p>
//             <p className="text-slate-500 mt-1">
//               Cliquez sur "Appliquer un Modèle" pour commencer.
//             </p>
//           </div>
//         )
//       )}
//       <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle>Confirmer la Suppression</AlertDialogTitle>
//             <AlertDialogDescription>
//               Êtes-vous sûr de vouloir supprimer les résultats de
//               l'antibiogramme basé sur le modèle{" "}
//               <span className="font-semibold">
//                 "{setToDelete?.antibiotique_model?.name}"
//               </span>{" "}
//               ? Cette action ne peut pas être annulée.
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel
//               disabled={isDeleting}
//               onClick={() => setSetToDelete(null)}
//             >
//               Annuler
//             </AlertDialogCancel>
//             <AlertDialogAction
//               onClick={handleDeleteSetConfirm}
//               disabled={isDeleting}
//               className="bg-red-600 hover:bg-red-700"
//             >
//               {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
//               Supprimer
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>
//       <AlertDialog
//         open={showAddAdhocAntibiotiqueDialog}
//         onOpenChange={setShowAddAdhocAntibiotiqueDialog}
//       >
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle>
//               Ajouter un Antibiotique (Ad-hoc)
//             </AlertDialogTitle>
//             <AlertDialogDescription>
//               Entrez le nom du nouvel antibiotique. Il sera initialisé avec S,
//               I, et R non sélectionnés.
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <div className="py-4">
//             <Label htmlFor="adhoc-name">Nom de l'antibiotique</Label>
//             <Input
//               id="adhoc-name"
//               value={newAdhocAntibiotiqueName}
//               onChange={(e) => setNewAdhocAntibiotiqueName(e.target.value)}
//               placeholder="Ex: Vancomycine"
//               className="mt-1"
//             />
//           </div>
//           <AlertDialogFooter>
//             <AlertDialogCancel onClick={() => setNewAdhocAntibiotiqueName("")}>
//               Annuler
//             </AlertDialogCancel>
//             <AlertDialogAction onClick={handleConfirmAddAdhocAntibiotique}>
//               Ajouter
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>
//     </div>
//   );
// };

// ============================================================================================================
// src/components/app/results/antibiogram/MainContent.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Database, Tables } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  PlusCircle,
  Edit3,
  Trash2,
  Printer,
  Save,
  XCircle,
  ShieldAlert,
  FileEdit,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import Footer from "@/components/Footer";

export interface AntibiotiqueItemJson {
  id: string;
  name: string;
  order: number;
  s: boolean;
  i: boolean;
  r: boolean;
}

type AntibiotiqueModel =
  Database["public"]["Tables"]["antibiotique_model"]["Row"];

type PatientAntibiogramSet =
  Database["public"]["Tables"]["patient_antibiogram_set"]["Row"] & {
    antibiotique_model?: Pick<AntibiotiqueModel, "name" | "description"> | null;
  };

interface MainContentProps {
  resultId: string;
}

// Renamed from renderSirValue to avoid potential naming conflicts if MainContent itself had one.
const renderSirValueStatic = (
  item: AntibiotiqueItemJson,
  column: "s" | "i" | "r"
) => {
  if (column === "s" && item.s) return "S";
  if (column === "i" && item.i) return "I";
  if (column === "r" && item.r) return "R";
  return "";
};

export const MainContent = ({ resultId }: MainContentProps) => {
  const [appliedSets, setAppliedSets] = useState<PatientAntibiogramSet[]>([]);
  const [availableModels, setAvailableModels] = useState<AntibiotiqueModel[]>(
    []
  );
  const [editingSet, setEditingSet] = useState<PatientAntibiogramSet | null>(
    null
  );
  const [currentResultsJson, setCurrentResultsJson] = useState<
    AntibiotiqueItemJson[]
  >([]);
  const [currentSetDescription, setCurrentSetDescription] =
    useState<string>("");
  const [isLoadingSets, setIsLoadingSets] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedNewModelId, setSelectedNewModelId] = useState<
    string | undefined
  >(undefined);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [setToDelete, setSetToDelete] = useState<PatientAntibiogramSet | null>(
    null
  );
  const [showAddAdhocAntibiotiqueDialog, setShowAddAdhocAntibiotiqueDialog] =
    useState(false);
  const [newAdhocAntibiotiqueName, setNewAdhocAntibiotiqueName] = useState("");
  const [printSetId, setPrintSetId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const fetchAppliedSets = useCallback(async () => {
    setIsLoadingSets(true);
    const { data, error } = await supabase
      .from("patient_antibiogram_set")
      .select(
        `*, antibiotique_model:source_antibiotique_model_id (name, description)`
      )
      .eq("patient_result_id", resultId)
      .order("created_at", { ascending: true });
    if (error)
      sonnerToast.error("Erreur chargement des antibiogrammes", {
        description: error.message,
      });
    else setAppliedSets(data || []);
    setIsLoadingSets(false);
  }, [resultId]);

  const fetchAvailableModels = useCallback(async () => {
    setIsLoadingModels(true);
    const { data, error } = await supabase
      .from("antibiotique_model")
      .select("*")
      .order("name");
    if (error)
      sonnerToast.error("Erreur chargement des modèles ATB", {
        description: error.message,
      });
    else setAvailableModels(data || []);
    setIsLoadingModels(false);
  }, []);

  useEffect(() => {
    fetchAppliedSets();
    fetchAvailableModels();
  }, [fetchAppliedSets, fetchAvailableModels]);

  const handleAddNewSet = () => {
    setSelectedNewModelId(undefined);
    setShowModelSelector(true);
    setEditingSet(null);
    setCurrentResultsJson([]);
    setCurrentSetDescription("");
  };

  const handleSelectModelAndStart = () => {
    if (!selectedNewModelId) {
      sonnerToast.info("Veuillez sélectionner un modèle.");
      return;
    }
    const model = availableModels.find((m) => m.id === selectedNewModelId);
    if (model && Array.isArray(model.antibiotiques)) {
      if (
        appliedSets.some((s) => s.source_antibiotique_model_id === model.id)
      ) {
        sonnerToast.warning("Modèle déjà appliqué", {
          description:
            "Ce modèle a déjà été appliqué. Vous pouvez le modifier.",
        });
        const existing = appliedSets.find(
          (s) => s.source_antibiotique_model_id === model.id
        );
        if (existing) handleEditSet(existing);
        setShowModelSelector(false);
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
      setEditingSet(newSetData as PatientAntibiogramSet);
      setCurrentResultsJson(initialResults);
      setCurrentSetDescription(model.description || "");
      setShowModelSelector(false);
    }
  };

  const handleEditSet = (set: PatientAntibiogramSet) => {
    setEditingSet(set);
    let parsedResults: AntibiotiqueItemJson[] = [];
    if (Array.isArray(set.results_json))
      parsedResults = set.results_json as AntibiotiqueItemJson[];
    else if (typeof set.results_json === "string") {
      try {
        parsedResults = JSON.parse(set.results_json);
        if (!Array.isArray(parsedResults)) parsedResults = [];
      } catch (e) {
        console.error("Failed to parse results_json string:", e);
      }
    }
    setCurrentResultsJson(
      parsedResults.map((item, index) => ({
        id: item.id || uuidv4(),
        name: item.name || "",
        order: item.order !== undefined ? item.order : index,
        s: item.s === true,
        i: item.i === true,
        r: item.r === true,
      }))
    );
    setCurrentSetDescription(set.description || "");
    setShowModelSelector(false);
  };

  const handleSirChange = (
    antibiotiqueId: string,
    sirValue: "s" | "i" | "r" | "none"
  ) =>
    setCurrentResultsJson((prevJson) =>
      prevJson.map((item) =>
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
  const handleCancelEdit = () => {
    setEditingSet(null);
    setCurrentResultsJson([]);
    setCurrentSetDescription("");
    setShowModelSelector(false);
  };

  const handleSaveSet = async () => {
    if (!editingSet || !currentResultsJson) return;
    setIsSaving(true);
    const orderedResults = currentResultsJson.map((item, index) => ({
      ...item,
      order: index,
    }));
    const dataToSave = {
      patient_result_id: resultId,
      source_antibiotique_model_id: editingSet.source_antibiotique_model_id,
      results_json: orderedResults,
      description: currentSetDescription.trim() || null,
      notes: editingSet.notes,
    };
    const { error } = editingSet.id
      ? await supabase
          .from("patient_antibiogram_set")
          .update(dataToSave)
          .eq("id", editingSet.id)
      : await supabase
          .from("patient_antibiogram_set")
          .insert(dataToSave)
          .select()
          .single();
    setIsSaving(false);
    if (error)
      sonnerToast.error("Erreur d'enregistrement", {
        description: error.message,
      });
    else {
      sonnerToast.success(
        `Antibiogramme ${editingSet.id ? "mis à jour" : "enregistré"}.`
      );
      handleCancelEdit();
      fetchAppliedSets();
    }
  };

  const openDeleteSetDialog = (set: PatientAntibiogramSet) => {
    setSetToDelete(set);
    setShowDeleteDialog(true);
  };
  const handleDeleteSetConfirm = async () => {
    if (!setToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase
      .from("patient_antibiogram_set")
      .delete()
      .eq("id", setToDelete.id);
    setIsDeleting(false);
    setShowDeleteDialog(false);
    if (error)
      sonnerToast.error("Erreur de suppression", {
        description: error.message,
      });
    else {
      sonnerToast.success("Jeu d'antibiogramme supprimé.");
      fetchAppliedSets();
      if (editingSet?.id === setToDelete.id) handleCancelEdit();
    }
    setSetToDelete(null);
  };

  const handleActualPrint = () => {
    window.print();
    setTimeout(() => setPrintSetId(null), 1000);
  };
  const prepareAndTriggerPrint = (set: PatientAntibiogramSet) => {
    setPrintSetId(set.id);
    setTimeout(() => {
      handleActualPrint();
    }, 100);
  };

  const handleOpenAddAdhocAntibiotiqueDialog = () => {
    setNewAdhocAntibiotiqueName("");
    setShowAddAdhocAntibiotiqueDialog(true);
  };
  const handleConfirmAddAdhocAntibiotique = () => {
    if (!newAdhocAntibiotiqueName.trim()) {
      sonnerToast.warning("Le nom de l'antibiotique est requis.");
      return;
    }
    const newAntibiotique: AntibiotiqueItemJson = {
      id: uuidv4(),
      name: newAdhocAntibiotiqueName.trim(),
      order: currentResultsJson.length,
      s: false,
      i: false,
      r: false,
    };
    setCurrentResultsJson((prev) => [...prev, newAntibiotique]);
    setShowAddAdhocAntibiotiqueDialog(false);
  };
  const handleRemoveAdhocAntibiotique = (antibiotiqueIdToRemove: string) => {
    setCurrentResultsJson((prev) =>
      prev
        .filter((item) => item.id !== antibiotiqueIdToRemove)
        .map((item, index) => ({ ...item, order: index }))
    );
  };

  const handleMoveAntibiotique = (
    currentIndex: number,
    direction: "up" | "down"
  ) => {
    setCurrentResultsJson((prev) => {
      const newItems = [...prev];
      const targetIndex =
        direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= newItems.length) return prev;
      [newItems[currentIndex], newItems[targetIndex]] = [
        newItems[targetIndex],
        newItems[currentIndex],
      ];
      return newItems.map((item, index) => ({ ...item, order: index }));
    });
  };

  const AntibiogramSetDisplay = ({ set }: { set: PatientAntibiogramSet }) => {
    const results = Array.isArray(set.results_json)
      ? (set.results_json as AntibiotiqueItemJson[]).sort(
          (a, b) => a.order - b.order
        )
      : [];
    const displayDescription =
      set.description || set.antibiotique_model?.description;
    const setContainerClasses = `printable-antibiogram ${
      printSetId === set.id ? "print-this-set" : "print:hidden"
    }`;
    return (
      <div className={setContainerClasses} id={`antibiogram-set-${set.id}`}>
        <div className="print-header p-4 bg-gray-100 border-b flex justify-between items-center print:hidden">
          <div>
            <h3 className="text-lg font-semibold text-gray-700">
              {set.antibiotique_model?.name || "Modèle Ad-hoc"}
            </h3>
            {displayDescription && (
              <p className="text-sm text-gray-500 italic">
                {displayDescription}
              </p>
            )}
          </div>
          <div className="space-x-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => prepareAndTriggerPrint(set)}
              className="no-print"
            >
              <Printer className="mr-1 h-4 w-4" /> Imprimer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditSet(set)}
              className="no-print"
            >
              <Edit3 className="mr-1 h-4 w-4" /> Modifier
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDeleteSetDialog(set)}
              className="text-red-600 hover:bg-red-50 no-print"
            >
              <Trash2 className="mr-1 h-4 w-4" /> Supprimer
            </Button>
          </div>
        </div>
        <div>
          <div className="print-content-wrapper hidden print:block">
            <div className="print-title print:hidden">
              RESULTAT DE L'ANTIBIOGRAMME
            </div>
            <div className="print-model-name print:hidden">
              {set.antibiotique_model?.name || "Modèle Ad-hoc"}
            </div>
            {displayDescription && (
              <div className="print-model-description">
                {displayDescription}
              </div>
            )}
          </div>
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%] font-semibold px-3 py-2">
                  Dénomination
                </TableHead>
                <TableHead className="text-center font-semibold px-1 py-2 sir-column">
                  S
                </TableHead>
                <TableHead className="text-center font-semibold px-1 py-2 sir-column">
                  I
                </TableHead>
                <TableHead className="text-center font-semibold px-1 py-2 sir-column">
                  R
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((abItem) => (
                <TableRow key={abItem.id}>
                  <TableCell className="font-medium px-3 py-1.5">
                    {abItem.name}
                  </TableCell>
                  <TableCell className="text-center px-1 py-1.5 sir-column">
                    {renderSirValueStatic(abItem, "s")}
                  </TableCell>{" "}
                  {/* Corrected call */}
                  <TableCell className="text-center px-1 py-1.5 sir-column">
                    {renderSirValueStatic(abItem, "i")}
                  </TableCell>{" "}
                  {/* Corrected call */}
                  <TableCell className="text-center px-1 py-1.5 sir-column">
                    {renderSirValueStatic(abItem, "r")}
                  </TableCell>{" "}
                  {/* Corrected call */}
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
          <div className="mt-4">
            <Footer date={new Date().toISOString() || ""} />
          </div>
        </div>
      </div>
    );
  };

  if (isLoadingSets || isLoadingModels) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" /> Chargement...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex justify-between print:justify-center items-center no-print">
        <h1 className="text-2xl font-bold text-slate-700 text-center">
          ANTIBIOGRAMME
        </h1>
        {!editingSet && (
          <Button onClick={handleAddNewSet} size="sm" className="print:hidden">
            <PlusCircle className="mr-2 h-4 w-4" /> Appliquer un Modèle
          </Button>
        )}
      </div>
      {showModelSelector && !editingSet && (
        <div className="mb-4 p-4 border rounded-md bg-slate-50 print:hidden">
          <Label htmlFor="model-select" className="mb-2 block font-medium">
            Choisir un modèle :
          </Label>
          <div className="flex space-x-2">
            <Select
              value={selectedNewModelId}
              onValueChange={setSelectedNewModelId}
            >
              <SelectTrigger id="model-select" className="flex-grow">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((model) => (
                  <SelectItem
                    key={model.id}
                    value={model.id}
                    disabled={appliedSets.some(
                      (s) => s.source_antibiotique_model_id === model.id
                    )}
                  >
                    {model.name}{" "}
                    {appliedSets.some(
                      (s) => s.source_antibiotique_model_id === model.id
                    ) && "(Déjà appliqué)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleSelectModelAndStart}
              disabled={!selectedNewModelId}
            >
              Commencer
            </Button>
            <Button variant="ghost" onClick={() => setShowModelSelector(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
      {editingSet ? (
        <div className="">
          <div className="p-4 bg-slate-50 border-b rounded-t-lg">
            <h2 className="text-xl font-semibold text-slate-700">
              {editingSet.id ? "Modification" : "Nouvel"} Antibiogramme :{" "}
              {editingSet.antibiotique_model?.name || "Ad-hoc"}
            </h2>
            <div className="mt-2 space-y-1">
              <Label
                htmlFor="set-description-atb"
                className="text-sm font-medium text-slate-600 flex items-center"
              >
                <FileEdit className="h-4 w-4 mr-2 text-slate-500" />
                Description pour ce set (optionnel)
              </Label>
              <Textarea
                id="set-description-atb"
                value={currentSetDescription}
                onChange={(e) => setCurrentSetDescription(e.target.value)}
                placeholder={
                  editingSet.antibiotique_model?.description
                    ? "Basé sur: " + editingSet.antibiotique_model.description
                    : "Entrez une description..."
                }
                rows={2}
                className="bg-white text-sm"
              />
            </div>
            <p className="text-sm text-slate-500 mt-2">
              S=Sensible, I=Intermédiaire, R=Résistant
            </p>
          </div>
          <div className="p-0">
            <Table className="min-w-full text-lg">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 px-1 py-2 print:hidden"></TableHead>
                  <TableHead className="w-[calc(40%-40px-48px)] font-semibold px-3 py-2">
                    Dénomination
                  </TableHead>
                  <TableHead className="text-center font-semibold px-1 py-2 sir-column">
                    S
                  </TableHead>
                  <TableHead className="text-center font-semibold px-1 py-2 sir-column">
                    I
                  </TableHead>
                  <TableHead className="text-center font-semibold px-1 py-2 sir-column">
                    R
                  </TableHead>
                  <TableHead className="w-[40px] px-1 py-2"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentResultsJson
                  .sort((a, b) => a.order - b.order)
                  .map((abItem, index) => (
                    <TableRow key={abItem.id} className="hover:bg-blue-100">
                      <TableCell className="px-1 py-1.5 align-middle print:hidden">
                        <div className="flex flex-col items-center space-y-0.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleMoveAntibiotique(index, "up")}
                            disabled={index === 0 || isReordering}
                            title="Monter"
                          >
                            <ArrowUpCircle className="h-4 w-4 text-slate-500 hover:text-slate-700" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              handleMoveAntibiotique(index, "down")
                            }
                            disabled={
                              index === currentResultsJson.length - 1 ||
                              isReordering
                            }
                            title="Descendre"
                          >
                            <ArrowDownCircle className="h-4 w-4 text-slate-500 hover:text-slate-700" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium px-3 py-1.5 align-middle">
                        {abItem.name}
                      </TableCell>
                      {["s", "i", "r"].map((sirKey) => (
                        <TableCell
                          key={sirKey}
                          className="text-center px-1 py-1.5 sir-column align-middle"
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
                              handleSirChange(
                                abItem.id,
                                val as "s" | "i" | "r" | "none"
                              )
                            }
                          >
                            <div className="flex items-center justify-center">
                              <RadioGroupItem
                                value={sirKey}
                                id={`${sirKey}-${resultId}-${editingSet.source_antibiotique_model_id}-${abItem.id}`}
                              />
                            </div>
                          </RadioGroup>
                        </TableCell>
                      ))}
                      <TableCell className="px-1 py-1.5 align-middle">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            handleRemoveAdhocAntibiotique(abItem.id)
                          }
                          title="Supprimer cet antibiotique"
                        >
                          <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
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
                    S = Sensible    I = Intermédiaire    R = Résistant
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
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Ad-hoc
            </Button>
            <div className="space-x-2">
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                <XCircle className="mr-2 h-4 w-4" /> Annuler
              </Button>
              <Button onClick={handleSaveSet} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}{" "}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      ) : appliedSets.length > 0 ? (
        <div className="space-y-6">
          {appliedSets.map((set) => (
            <AntibiogramSetDisplay key={set.id} set={set} />
          ))}
        </div>
      ) : (
        !showModelSelector && (
          <div className="text-center py-10 bg-slate-50 rounded-lg shadow border">
            <ShieldAlert className="mx-auto h-12 w-12 text-slate-400 mb-3" />
            <p className="text-xl font-semibold text-slate-600">
              Aucun antibiogramme appliqué.
            </p>
            <p className="text-slate-500 mt-1">
              Cliquez sur "Appliquer un Modèle" pour commencer.
            </p>
          </div>
        )
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la Suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer les résultats de
              l'antibiogramme basé sur le modèle{" "}
              <span className="font-semibold">
                "{setToDelete?.antibiotique_model?.name}"
              </span>{" "}
              ? Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              onClick={() => setSetToDelete(null)}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSetConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
            <AlertDialogTitle>
              Ajouter un Antibiotique (Ad-hoc)
            </AlertDialogTitle>
            <AlertDialogDescription>
              Entrez le nom du nouvel antibiotique. Il sera initialisé avec S,
              I, et R non sélectionnés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="adhoc-name">Nom de l'antibiotique</Label>
            <Input
              id="adhoc-name"
              value={newAdhocAntibiotiqueName}
              onChange={(e) => setNewAdhocAntibiotiqueName(e.target.value)}
              placeholder="Ex: Vancomycine"
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewAdhocAntibiotiqueName("")}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAddAdhocAntibiotique}>
              Ajouter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
