// import React, { useState, useEffect, useCallback, useMemo } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import { supabase } from "@/lib/supabaseClient";
// import { Database } from "@/lib/database.types";

// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import {
//   Card,
//   CardContent,
//   CardHeader,
//   CardTitle,
//   CardFooter,
// } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator";
// import { Checkbox } from "@/components/ui/checkbox";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import {
//   TrashIcon as RadixTrashIcon,
//   PlusIcon,
//   CheckIcon,
//   Cross2Icon,
// } from "@radix-ui/react-icons";
// import {
//   UserPlus,
//   ListChecks,
//   ClipboardPaste,
//   UserMinus,
//   DollarSign,
// } from "lucide-react"; // Added UserMinus, DollarSign for expenses
// import { toast as sonnerToast } from "sonner";
// import { extractId } from "@/lib/utils";

// // --- Type Definitions ---
// type Agent = Database["public"]["Tables"]["agents"]["Row"];
// type PatientResult = Database["public"]["Tables"]["patient_result"]["Row"] & {
//   patient: { id: string; full_name: string | null } | null;
// };

// // Assuming your database.types.ts includes these after generation
// type Ristourne = Database["public"]["Tables"]["ristourne"]["Row"] & {
//   // Assuming 'doctor' is the related table name specified in Supabase FK or relationship
//   doctor: { id: string; full_name: string | null } | null;
// };

// type IncomeExpenseRecord =
//   Database["public"]["Tables"]["income_expense_records"]["Row"];
// type IncomeInsert = Database["public"]["Tables"]["incomes"]["Insert"];
// type IncomeRow = Database["public"]["Tables"]["incomes"]["Row"];
// type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
// type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];

// interface FormIncome extends Partial<IncomeRow> {
//   patient_result_id: string;
//   notes?: string | null;
//   _patientName?: string;
//   _calculatedIncome?: number;
//   _tempId?: string;
//   _isNew?: boolean;
//   _isMarkedForDeletion?: boolean;
// }
// interface FormExpense extends Partial<ExpenseRow> {
//   name: string;
//   price: number | string;
//   expense_date: string;
//   notes?: string | null;
//   _tempId?: string;
//   _isNew?: boolean;
//   _isMarkedForDeletion?: boolean;
//   _sourceRistourneId?: string; // To prevent re-adding the same ristourne as an expense
// }
// interface SelectablePatientResult extends PatientResult {
//   isSelected?: boolean;
//   calculated_income: number;
// }

// // New Type for Ristourne Selection
// interface SelectableRistourne extends Ristourne {
//   isSelected?: boolean;
// }
// // --- End Type Definitions ---

// export default function IncomeExpenseFormPage() {
//   const { recordId } = useParams<{ recordId?: string }>();
//   const navigate = useNavigate();

//   const [isEditing, setIsEditing] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);

//   const [agentId, setAgentId] = useState<string>("");
//   const [recordDate, setRecordDate] = useState<Date | undefined>(new Date());
//   const [mainNotes, setMainNotes] = useState<string>("");

//   const [formIncomes, setFormIncomes] = useState<FormIncome[]>([]);
//   const [formExpenses, setFormExpenses] = useState<FormExpense[]>([]);

//   const [agents, setAgentsData] = useState<Agent[]>([]);
//   const [todaysPatientResults, setTodaysPatientResults] = useState<
//     SelectablePatientResult[]
//   >([]);
//   const [todaysRistournes, setTodaysRistournes] = useState<
//     SelectableRistourne[]
//   >([]); // New state for Ristournes

//   const todayIsoDate = useMemo(
//     () => new Date().toISOString().split("T")[0],
//     []
//   );

//   const yesterdayIsoDate = useMemo(
//     () => new Date(Date.now() - 86400000).toISOString().split("T")[0],
//     []
//   );

//   const fetchData = useCallback(async () => {
//     setLoading(true);
//     try {
//       const agentPromise = supabase.from("agents").select("id, name, code");
//       const patientResultPromise = supabase
//         .from("patient_result")
//         .select("*, patient!inner(id, full_name,patient_unique_id)")
//         .gte("created_at", `${yesterdayIsoDate}T00:00:00.000Z`)
//         .lte("created_at", `${todayIsoDate}T23:59:59.999Z`)
//         .order("created_at", { ascending: true });

//       // Fetch today's ristournes with doctor name
//       // IMPORTANT: Adjust 'doctor!inner(full_name)' based on your actual FK relationship and table/column names.
//       // This assumes 'ristourne' has a 'created_at' field. If not, filter by a relevant date field on 'ristourne'.
//       const ristournePromise = supabase
//         .from("ristourne")
//         .select("*, doctor!inner(id, full_name)") // Ensure this join is correct
//         .gte("created_at", `${yesterdayIsoDate}T00:00:00.000Z`) // Filter for today
//         .lte("created_at", `${todayIsoDate}T23:59:59.999Z`)
//         .order("created_at", { ascending: true });

//       const [agentRes, patientResultRes, ristourneRes] = await Promise.all([
//         agentPromise,
//         patientResultPromise,
//         ristournePromise, // Add ristourne promise
//       ]);

//       if (agentRes.error) throw agentRes.error;
//       setAgentsData(agentRes.data || []);

//       if (patientResultRes.error) throw patientResultRes.error;
//       const fetchedPatientResults = (
//         (patientResultRes.data as PatientResult[]) || []
//       ).map((pr) => ({
//         ...pr,
//         isSelected: false,
//         calculated_income: (pr.normal_price || 0) + (pr.insurance_price || 0),
//       }));
//       setTodaysPatientResults(fetchedPatientResults);

//       // Process Ristournes
//       if (ristourneRes.error) throw ristourneRes.error;
//       const fetchedRistournes = ((ristourneRes.data as Ristourne[]) || []).map(
//         (r) => ({
//           ...r,
//           isSelected: false,
//         })
//       );
//       setTodaysRistournes(fetchedRistournes);

//       if (recordId) {
//         setIsEditing(true);
//         const recordRes = await supabase
//           .from("income_expense_records")
//           .select("*, incomes(*), expenses(*)")
//           .eq("id", recordId)
//           .single();
//         if (recordRes.error) throw recordRes.error;

//         if (recordRes.data) {
//           const record = recordRes.data;
//           setAgentId(record.agent_id);
//           setRecordDate(
//             record.record_date ? new Date(record.record_date) : undefined
//           );
//           setMainNotes(record.notes || "");

//           const populatedIncomes = ((record.incomes as IncomeRow[]) || []).map(
//             (inc) => {
//               const originalPr =
//                 fetchedPatientResults.find(
//                   (p) => p.id === inc.patient_result_id
//                 ) ||
//                 patientResultRes.data?.find(
//                   (p) => p.id === inc.patient_result_id
//                 );
//               return {
//                 ...inc,
//                 _patientName:
//                   originalPr?.patient?.full_name || "Patient Inconnu",
//                 _calculatedIncome:
//                   (originalPr?.normal_price || 0) +
//                   (originalPr?.insurance_price || 0),
//               };
//             }
//           );
//           setFormIncomes(populatedIncomes);
//           setTodaysPatientResults((prevResults) =>
//             prevResults.map((pr) => ({
//               ...pr,
//               isSelected: populatedIncomes.some(
//                 (fi) => fi.patient_result_id === pr.id
//               ),
//             }))
//           );

//           const loadedExpenses = ((record.expenses as ExpenseRow[]) || []).map(
//             (exp) => ({
//               ...exp,
//               expense_date: exp.expense_date || todayIsoDate,
//               price: exp.price || 0,
//             })
//           );
//           setFormExpenses(loadedExpenses);

//           // Mark today's ristournes as selected if they are part of the loaded expenses (by matching name and price, or a source ID if you add one)
//           setTodaysRistournes((prevRistournes) =>
//             prevRistournes.map((r) => {
//               const potentialExpenseName = `Ristourne de ${
//                 r.doctor?.full_name || "Inconnu"
//               }`;
//               return {
//                 ...r,
//                 isSelected: loadedExpenses.some(
//                   (exp) =>
//                     exp.name === potentialExpenseName &&
//                     Number(exp.price) === r.total_fee
//                 ),
//               };
//             })
//           );
//         }
//       }
//     } catch (error: any) {
//       console.error("Error fetching data:", error);
//       sonnerToast.error("Erreur de chargement des données", {
//         description: error.message || "Impossible de charger les données.",
//       });
//     } finally {
//       setLoading(false);
//     }
//   }, [recordId, todayIsoDate]);

//   useEffect(() => {
//     fetchData();
//   }, [fetchData]);

//   // --- Patient Result (Income) Selection ---
//   const handlePatientResultSelectionChange = (id: string) =>
//     setTodaysPatientResults((prev) =>
//       prev.map((pr) =>
//         pr.id === id ? { ...pr, isSelected: !pr.isSelected } : pr
//       )
//     );
//   const handleSelectAllPatientResults = (checked: boolean) =>
//     setTodaysPatientResults((prev) =>
//       prev.map((pr) => ({ ...pr, isSelected: checked }))
//     );
//   const handleAddSelectedPatientResultsToIncomes = () => {
//     /* ... (same as before) ... */
//     const newIncomesToAdd: FormIncome[] = [];
//     todaysPatientResults.forEach((pr) => {
//       if (
//         pr.isSelected &&
//         !formIncomes.some(
//           (fi) => fi.patient_result_id === pr.id && !fi._isMarkedForDeletion
//         )
//       ) {
//         newIncomesToAdd.push({
//           _tempId: `new_income_${pr.id}_${Date.now()}`,
//           patient_result_id: pr.id,
//           _patientName: pr.patient?.full_name || "Patient Inconnu",
//           _calculatedIncome: pr.calculated_income,
//           notes: "",
//           _isNew: true,
//         });
//       }
//     });
//     if (newIncomesToAdd.length > 0) {
//       setFormIncomes((prev) => [
//         ...prev.filter((fi) => !fi._isMarkedForDeletion),
//         ...newIncomesToAdd,
//       ]);
//       sonnerToast.info(`${newIncomesToAdd.length} revenu(s) ajouté(s).`);
//     }
//   };
//   const handleFormIncomeNotesChange = (index: number, notes: string) => {
//     const updatedIncomes = [...formIncomes];
//     updatedIncomes[index].notes = notes;
//     setFormIncomes(updatedIncomes);
//   };
//   const handleRemoveFormIncome = (index: number) => {
//     /* ... (same as before, ensure it unchecks from todaysPatientResults) ... */
//     const updatedIncomes = [...formIncomes];
//     const incomeToRemove = updatedIncomes[index];
//     if (incomeToRemove._isNew) {
//       updatedIncomes.splice(index, 1);
//     } else {
//       updatedIncomes[index]._isMarkedForDeletion = true;
//     }
//     setFormIncomes(updatedIncomes);
//     setTodaysPatientResults((prevResults) =>
//       prevResults.map((pr) =>
//         pr.id === incomeToRemove.patient_result_id
//           ? { ...pr, isSelected: false }
//           : pr
//       )
//     );
//   };

//   // --- Ristourne (Expense) Selection ---
//   const handleRistourneSelectionChange = (id: string) => {
//     setTodaysRistournes((prev) =>
//       prev.map((r) => (r.id === id ? { ...r, isSelected: !r.isSelected } : r))
//     );
//   };
//   const handleSelectAllRistournes = (checked: boolean) => {
//     setTodaysRistournes((prev) =>
//       prev.map((r) => ({ ...r, isSelected: checked }))
//     );
//   };
//   const handleAddSelectedRistournesToExpenses = () => {
//     const newExpensesToAdd: FormExpense[] = [];
//     const currentDate = new Date().toISOString().split("T")[0];

//     todaysRistournes.forEach((r) => {
//       // Check if already added (using _sourceRistourneId)
//       if (
//         r.isSelected &&
//         !formExpenses.some(
//           (fe) => fe._sourceRistourneId === r.id && !fe._isMarkedForDeletion
//         )
//       ) {
//         newExpensesToAdd.push({
//           _tempId: `new_expense_ristourne_${r.id}_${Date.now()}`,
//           name: `Ristourne de ${r.doctor?.full_name || "Docteur Inconnu"}`,
//           price: r.total_fee || 0,
//           expense_date: currentDate, // Default to today, can be changed later
//           notes: `Ristourne ID: ${r.id}`, // Optional: add source ID to notes
//           _isNew: true,
//           _sourceRistourneId: r.id, // Track source to prevent duplicates from this list
//         });
//       }
//     });

//     if (newExpensesToAdd.length > 0) {
//       setFormExpenses((prev) => [
//         ...prev.filter((fe) => !fe._isMarkedForDeletion),
//         ...newExpensesToAdd,
//       ]);
//       sonnerToast.info(
//         `${newExpensesToAdd.length} ristourne(s) ajoutée(s) aux dépenses.`
//       );
//     }
//     // Optionally deselect after adding
//     // setTodaysRistournes(prev => prev.map(r => ({ ...r, isSelected: false })));
//   };

//   // --- General Expense Handlers (for manually added or edited ristourne-expenses) ---
//   const handleAddManualExpense = () => {
//     /* Renamed from handleAddExpense */
//     setFormExpenses([
//       ...formExpenses,
//       {
//         _tempId: `new_expense_manual_${Date.now()}`,
//         name: "",
//         price: "",
//         expense_date: todayIsoDate,
//         notes: "",
//         _isNew: true,
//       },
//     ]);
//   };
//   const handleExpenseChange = (
//     index: number,
//     field: keyof FormExpense,
//     value: any
//   ) => {
//     const updatedExpenses = [...formExpenses];
//     (updatedExpenses[index] as any)[field] = value;
//     setFormExpenses(updatedExpenses);
//   };
//   const handleRemoveExpense = (index: number) => {
//     const updatedExpenses = [...formExpenses];
//     const expenseToRemove = updatedExpenses[index];
//     if (expenseToRemove._isNew) {
//       updatedExpenses.splice(index, 1);
//     } else {
//       updatedExpenses[index]._isMarkedForDeletion = true;
//     }
//     setFormExpenses(updatedExpenses);
//     // If it was a ristourne-derived expense, uncheck it from the selection list
//     if (expenseToRemove._sourceRistourneId) {
//       setTodaysRistournes((prevRistournes) =>
//         prevRistournes.map((r) =>
//           r.id === expenseToRemove._sourceRistourneId
//             ? { ...r, isSelected: false }
//             : r
//         )
//       );
//     }
//   };

//   // --- Save Handler --- (Largely the same, ensures FormExpense structure is saved)
//   const handleSubmit = async (e: React.FormEvent) => {
//     /* ... (same as before) ... */
//     e.preventDefault();
//     setSaving(true);
//     if (!agentId) {
//       sonnerToast.error("Champ Requis", {
//         description: "Veuillez sélectionner un agent.",
//       });
//       setSaving(false);
//       return;
//     }
//     if (!recordDate) {
//       sonnerToast.error("Champ Requis", {
//         description: "Veuillez sélectionner une date.",
//       });
//       setSaving(false);
//       return;
//     }
//     if (
//       formIncomes.filter((i) => !i._isMarkedForDeletion).length === 0 &&
//       formExpenses.filter((ex) => !ex._isMarkedForDeletion).length === 0
//     ) {
//       sonnerToast.warning("Fiche Vide", {
//         description: "Ajoutez au moins un revenu ou une dépense.",
//       });
//       setSaving(false);
//       return;
//     }
//     for (const exp of formExpenses) {
//       if (
//         !exp._isMarkedForDeletion &&
//         (!exp.name ||
//           Number.isNaN(parseFloat(String(exp.price))) ||
//           parseFloat(String(exp.price)) < 0)
//       ) {
//         sonnerToast.error("Dépense Invalide", {
//           description: `Vérifiez: ${exp.name || "Nouvelle Dépense"}.`,
//         });
//         setSaving(false);
//         return;
//       }
//     }

//     try {
//       let currentRecordId = recordId;
//       const recordPayload = {
//         agent_id: agentId,
//         record_date: recordDate.toISOString().split("T")[0],
//         notes: mainNotes || null,
//       };
//       if (isEditing && currentRecordId) {
//         const { error } = await supabase
//           .from("income_expense_records")
//           .update(recordPayload)
//           .eq("id", currentRecordId);
//         if (error) throw error;
//       } else {
//         const { data, error } = await supabase
//           .from("income_expense_records")
//           .insert(recordPayload)
//           .select("id")
//           .single();
//         if (error) throw error;
//         if (!data) throw new Error("Échec création fiche.");
//         currentRecordId = data.id;
//       }
//       if (!currentRecordId) throw new Error("ID de fiche manquant.");

//       const incomeOps = formIncomes.map((i) => {
//         if (i._isMarkedForDeletion && i.id)
//           return supabase.from("incomes").delete().eq("id", i.id);
//         else if (!i._isMarkedForDeletion && i.patient_result_id) {
//           const d: IncomeInsert = {
//             income_expense_record_id: currentRecordId!,
//             patient_result_id: i.patient_result_id,
//             notes: i.notes || null,
//           };
//           if (i.id && !i._isNew)
//             return supabase.from("incomes").update(d).eq("id", i.id);
//           else if (i._isNew) return supabase.from("incomes").insert(d);
//         }
//         return Promise.resolve({ data: null, error: null });
//       });
//       const expenseOps = formExpenses.map((ex) => {
//         if (ex._isMarkedForDeletion && ex.id)
//           return supabase.from("expenses").delete().eq("id", ex.id);
//         else if (!ex._isMarkedForDeletion && ex.name) {
//           const d: ExpenseInsert = {
//             income_expense_record_id: currentRecordId!,
//             name: ex.name,
//             price: parseFloat(String(ex.price)) || 0,
//             expense_date: ex.expense_date,
//             notes: ex.notes || null,
//           };
//           if (ex.id && !ex._isNew)
//             return supabase.from("expenses").update(d).eq("id", ex.id);
//           else if (ex._isNew) return supabase.from("expenses").insert(d);
//         }
//         return Promise.resolve({ data: null, error: null });
//       });

//       const results = await Promise.all(
//         [...incomeOps, ...expenseOps].filter((op) => op !== null)
//       );
//       let opError = false;
//       results.forEach((r) => {
//         if (r && r.error) {
//           console.error("Erreur opération:", r.error);
//           opError = true;
//         }
//       });
//       if (opError)
//         sonnerToast.warning("Certaines opérations ont échoué", {
//           description: "Veuillez vérifier.",
//         });
//       else sonnerToast.success("Fiche Enregistrée!");
//       navigate("/gestion-depenses");
//     } catch (error: any) {
//       console.error("Erreur enregistrement:", error);
//       sonnerToast.error("Erreur d'Enregistrement", {
//         description: error.message || "Erreur.",
//       });
//     } finally {
//       setSaving(false);
//     }
//   };

//   if (loading)
//     return (
//       <div className="container mx-auto p-8 text-center">Chargement...</div>
//     );

//   const allPatientResultsSelected =
//     todaysPatientResults.length > 0 &&
//     todaysPatientResults.every((pr) => pr.isSelected);
//   const somePatientResultsSelected = todaysPatientResults.some(
//     (pr) => pr.isSelected
//   );

//   const allRistournesSelected =
//     todaysRistournes.length > 0 && todaysRistournes.every((r) => r.isSelected);
//   const someRistournesSelected = todaysRistournes.some((r) => r.isSelected);

//   return (
//     <div className="container mx-auto p-4 md:p-8">
//       <form onSubmit={handleSubmit}>
//         <Card className="shadow-lg">
//           <CardHeader>
//             <CardTitle className="text-2xl font-bold">
//               {isEditing ? "Modifier Fiche" : "Créer Fiche Revenus/Dépenses"}
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-6 pt-6">
//             {/* Record Details ... (same as before) ... */}
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               <div>
//                 <Label htmlFor="agent">
//                   Agent <span className="text-red-500">*</span>
//                 </Label>
//                 <Select value={agentId} onValueChange={setAgentId} required>
//                   <SelectTrigger id="agent" className="w-full">
//                     <SelectValue placeholder="Sélectionner agent" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     {agents.map((a) => (
//                       <SelectItem key={a.id} value={a.id}>
//                         {a.name} {a.code ? `(${a.code})` : ""}
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>
//               <div>
//                 <Label htmlFor="recordDate">
//                   Date Fiche <span className="text-red-500">*</span>
//                 </Label>
//                 <Input
//                   type="date"
//                   id="recordDate"
//                   className="w-full"
//                   value={
//                     recordDate ? recordDate.toISOString().split("T")[0] : ""
//                   }
//                   onChange={(e) =>
//                     setRecordDate(
//                       e.target.value ? new Date(e.target.value) : undefined
//                     )
//                   }
//                   required
//                 />
//               </div>
//             </div>
//             <div>
//               <Label htmlFor="mainNotes" className="mb-2 ">
//                 Montant reçu
//               </Label>
//               <Input
//                 type="text"
//                 id="mainNotes"
//                 value={mainNotes}
//                 onChange={(e) => setMainNotes(e.target.value)}
//                 placeholder="Montant..."
//               />
//             </div>
//             <Separator className="my-8" />

//             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
//               {/* Incomes Section - Left */}
//               <div className="space-y-6">
//                 {" "}
//                 {/* ... (Income selection and added list, same as before) ... */}
//                 <h3 className="text-xl font-semibold flex items-center">
//                   <ListChecks className="mr-2 h-6 w-6 text-green-600" />{" "}
//                   Sélection Revenus (Résultats Patients du Jour)
//                 </h3>
//                 {todaysPatientResults.length === 0 && (
//                   <p className="text-sm text-gray-500">
//                     Aucun résultat patient pour aujourd'hui.
//                   </p>
//                 )}
//                 {todaysPatientResults.length > 0 && (
//                   /* ... UI for patient result selection ... */ <>
//                     <div className="flex items-center space-x-2 border p-2 rounded-md bg-slate-50">
//                       <Checkbox
//                         id="select-all-prs"
//                         checked={allPatientResultsSelected}
//                         onCheckedChange={(c) =>
//                           handleSelectAllPatientResults(Boolean(c))
//                         }
//                       />
//                       <Label htmlFor="select-all-prs" className="font-medium">
//                         {allPatientResultsSelected
//                           ? "Désélectionner Tout"
//                           : "Sélectionner Tout"}{" "}
//                         (
//                         {
//                           todaysPatientResults.filter((pr) => pr.isSelected)
//                             .length
//                         }
//                         /{todaysPatientResults.length})
//                       </Label>
//                     </div>
//                     <ScrollArea className=" w-full rounded-md border p-2 bg-slate-50">
//                       {" "}
//                       {/* Adjusted height */}
//                       <div className="space-y-2">
//                         {todaysPatientResults.map((pr) => (
//                           <div
//                             key={pr.id}
//                             className="flex items-center justify-between p-2 rounded hover:bg-slate-100"
//                           >
//                             <div className="flex items-center space-x-3">
//                               <Checkbox
//                                 id={`pr-${pr.id}`}
//                                 checked={!!pr.isSelected}
//                                 onCheckedChange={() =>
//                                   handlePatientResultSelectionChange(pr.id)
//                                 }
//                               />
//                               <Label
//                                 htmlFor={`pr-${pr.id}`}
//                                 className="text-sm cursor-pointer"
//                               >
//                                 {extractId(pr.patient?.patient_unique_id)}{" "}
//                                 {" - "}
//                                 {pr.patient?.full_name || "Patient Inconnu"}
//                               </Label>
//                             </div>
//                             <span className="text-sm font-medium text-green-700">
//                               {pr.calculated_income.toLocaleString("fr-FR")} XOF
//                             </span>
//                           </div>
//                         ))}
//                       </div>
//                     </ScrollArea>
//                     <Button
//                       type="button"
//                       onClick={handleAddSelectedPatientResultsToIncomes}
//                       disabled={!somePatientResultsSelected}
//                       className="w-full"
//                     >
//                       <UserPlus className="mr-2 h-4 w-4" /> Ajouter Sélection
//                       aux Revenus
//                     </Button>
//                   </>
//                 )}
//                 <Separator />
//                 <h4 className="text-lg font-medium">Revenus Ajoutés</h4>
//                 {formIncomes.filter((inc) => !inc._isMarkedForDeletion)
//                   .length === 0 && (
//                   <p className="text-sm text-gray-500">Aucun revenu.</p>
//                 )}
//                 <div className="space-y-3  overflow-y-auto pr-2">
//                   {formIncomes.map(
//                     (income, index) =>
//                       !income._isMarkedForDeletion /* ... UI for added income item ... */ && (
//                         <Card
//                           key={income.id || income._tempId}
//                           className="p-3 bg-green-50 border-green-200"
//                         >
//                           <div className="flex justify-between items-start">
//                             <div>
//                               <p className="font-medium text-sm">
//                                 {income._patientName}
//                               </p>
//                               <p className="text-xs text-green-700">
//                                 {(income._calculatedIncome ?? 0).toLocaleString(
//                                   "fr-FR"
//                                 )}{" "}
//                                 XOF
//                               </p>
//                             </div>
//                             <Button
//                               type="button"
//                               variant="ghost"
//                               size="icon"
//                               className="text-red-500 hover:bg-red-100 h-8 w-8"
//                               onClick={() => handleRemoveFormIncome(index)}
//                               title="Supprimer revenu"
//                             >
//                               <RadixTrashIcon className="h-4 w-4" />
//                             </Button>
//                           </div>
//                           <Input
//                             className="mt-2 text-xs"
//                             value={income.notes || ""}
//                             onChange={(e) =>
//                               handleFormIncomeNotesChange(index, e.target.value)
//                             }
//                             placeholder="Notes (optionnel)"
//                           />
//                         </Card>
//                       )
//                   )}
//                 </div>
//               </div>

//               {/* Expenses Section - Right */}
//               <div className="space-y-6">
//                 {/* Ristourne Selection Section */}
//                 <h3 className="text-xl font-semibold flex items-center">
//                   <DollarSign className="mr-2 h-6 w-6 text-orange-600" />{" "}
//                   Sélection Ristournes (Du Jour)
//                 </h3>
//                 {todaysRistournes.length === 0 && (
//                   <p className="text-sm text-gray-500">
//                     Aucune ristourne trouvée pour aujourd'hui.
//                   </p>
//                 )}
//                 {todaysRistournes.length > 0 && (
//                   <>
//                     <div className="flex items-center space-x-2 border p-2 rounded-md bg-slate-50">
//                       <Checkbox
//                         id="select-all-ristournes"
//                         checked={allRistournesSelected}
//                         onCheckedChange={(c) =>
//                           handleSelectAllRistournes(Boolean(c))
//                         }
//                       />
//                       <Label
//                         htmlFor="select-all-ristournes"
//                         className="font-medium"
//                       >
//                         {allRistournesSelected
//                           ? "Désélectionner Tout"
//                           : "Sélectionner Tout"}{" "}
//                         ({todaysRistournes.filter((r) => r.isSelected).length}/
//                         {todaysRistournes.length})
//                       </Label>
//                     </div>
//                     <ScrollArea className=" w-full rounded-md border p-2 bg-slate-50">
//                       {" "}
//                       {/* Adjusted height */}
//                       <div className="space-y-2">
//                         {todaysRistournes.map((r) => (
//                           <div
//                             key={r.id}
//                             className="flex items-center justify-between p-2 rounded hover:bg-slate-100"
//                           >
//                             <div className="flex items-center space-x-3">
//                               <Checkbox
//                                 id={`ristourne-${r.id}`}
//                                 checked={!!r.isSelected}
//                                 onCheckedChange={() =>
//                                   handleRistourneSelectionChange(r.id)
//                                 }
//                               />
//                               <Label
//                                 htmlFor={`ristourne-${r.id}`}
//                                 className="text-sm cursor-pointer"
//                               >
//                                 {r.doctor?.full_name || "Inconnu"}
//                               </Label>
//                             </div>
//                             <span className="text-sm font-medium text-orange-700">
//                               {(r.total_fee || 0).toLocaleString("fr-FR")} XOF
//                             </span>
//                           </div>
//                         ))}
//                       </div>
//                     </ScrollArea>
//                     <Button
//                       type="button"
//                       onClick={handleAddSelectedRistournesToExpenses}
//                       disabled={!someRistournesSelected}
//                       className="w-full"
//                     >
//                       <UserMinus className="mr-2 h-4 w-4" /> Ajouter Sélection
//                       aux Dépenses
//                     </Button>
//                   </>
//                 )}
//                 <Separator />

//                 {/* Manually Added/Edited Expenses Section */}
//                 <h4 className="text-lg font-medium flex items-center">
//                   <ClipboardPaste className="mr-2 h-5 w-5 text-red-600" />{" "}
//                   Dépenses Ajoutées/Manuelles
//                 </h4>
//                 {formExpenses.filter((exp) => !exp._isMarkedForDeletion)
//                   .length === 0 && (
//                   <p className="text-sm text-gray-500 mb-4">Aucune dépense.</p>
//                 )}
//                 <div className="space-y-4  overflow-y-auto pr-2">
//                   {formExpenses.map(
//                     (expense, index) =>
//                       !expense._isMarkedForDeletion && (
//                         <Card
//                           key={expense.id || expense._tempId}
//                           className="p-4 bg-red-50 border-red-200"
//                         >
//                           {/* ... (Expense item form fields - same as before, but now for all expenses) ... */}
//                           <div className="grid grid-cols-1 gap-3">
//                             <div className="flex justify-between items-center">
//                               <Label
//                                 htmlFor={`exp-name-${index}`}
//                                 className="text-sm font-medium"
//                               >
//                                 Nom Dépense{" "}
//                                 <span className="text-red-500">*</span>
//                               </Label>
//                               <Button
//                                 type="button"
//                                 variant="ghost"
//                                 size="icon"
//                                 className="text-red-500 hover:bg-red-100 h-8 w-8"
//                                 onClick={() => handleRemoveExpense(index)}
//                                 title="Supprimer dépense"
//                               >
//                                 <RadixTrashIcon className="h-4 w-4" />
//                               </Button>
//                             </div>
//                             <Input
//                               id={`exp-name-${index}`}
//                               value={expense.name}
//                               onChange={(e) =>
//                                 handleExpenseChange(
//                                   index,
//                                   "name",
//                                   e.target.value
//                                 )
//                               }
//                               placeholder="Ex: Fournitures"
//                               required
//                               disabled={!!expense._sourceRistourneId}
//                             />{" "}
//                             {/* Disable name if from ristourne */}
//                             <div className="grid grid-cols-2 gap-3">
//                               <div>
//                                 <Label
//                                   htmlFor={`exp-price-${index}`}
//                                   className="text-sm"
//                                 >
//                                   Montant (XOF){" "}
//                                   <span className="text-red-500">*</span>
//                                 </Label>
//                                 <Input
//                                   id={`exp-price-${index}`}
//                                   type="number"
//                                   value={expense.price}
//                                   onChange={(e) =>
//                                     handleExpenseChange(
//                                       index,
//                                       "price",
//                                       e.target.value
//                                     )
//                                   }
//                                   placeholder="0.00"
//                                   required
//                                   step="any"
//                                   min="0"
//                                   disabled={!!expense._sourceRistourneId}
//                                 />
//                               </div>{" "}
//                               {/* Disable price if from ristourne */}
//                               <div>
//                                 <Label
//                                   htmlFor={`exp-date-${index}`}
//                                   className="text-sm"
//                                 >
//                                   Date <span className="text-red-500">*</span>
//                                 </Label>
//                                 <Input
//                                   id={`exp-date-${index}`}
//                                   type="date"
//                                   value={expense.expense_date}
//                                   onChange={(e) =>
//                                     handleExpenseChange(
//                                       index,
//                                       "expense_date",
//                                       e.target.value
//                                     )
//                                   }
//                                   required
//                                 />
//                               </div>
//                             </div>
//                             <div>
//                               <Label
//                                 htmlFor={`exp-notes-${index}`}
//                                 className="text-sm"
//                               >
//                                 Notes (Dépense)
//                               </Label>
//                               <Input
//                                 id={`exp-notes-${index}`}
//                                 value={expense.notes || ""}
//                                 onChange={(e) =>
//                                   handleExpenseChange(
//                                     index,
//                                     "notes",
//                                     e.target.value
//                                   )
//                                 }
//                                 placeholder="Notes optionnelles"
//                               />
//                             </div>
//                           </div>
//                         </Card>
//                       )
//                   )}
//                 </div>
//                 <Button
//                   type="button"
//                   variant="outline"
//                   onClick={handleAddManualExpense}
//                   className="w-full"
//                 >
//                   <PlusIcon className="mr-2 h-4 w-4" /> Ajouter Dépense Manuelle
//                 </Button>
//               </div>
//             </div>
//           </CardContent>
//           <CardFooter className="border-t pt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
//             <Button
//               type="button"
//               variant="outline"
//               onClick={() => navigate("/gestion-depenses")}
//               disabled={saving}
//               className="w-full sm:w-auto"
//             >
//               <Cross2Icon className="mr-2 h-4 w-4" /> Annuler
//             </Button>
//             <Button
//               type="submit"
//               disabled={saving || loading}
//               className="w-full sm:w-auto"
//             >
//               <CheckIcon className="mr-2 h-4 w-4" />
//               {saving
//                 ? "Enregistrement..."
//                 : isEditing
//                 ? "Mettre à jour"
//                 : "Enregistrer"}
//             </Button>
//           </CardFooter>
//         </Card>
//       </form>
//     </div>
//   );
// }

// // with manual income feature
// // src/pages/IncomeExpenseFormPage.tsx

// // import React, { useState, useEffect, useCallback, useMemo } from "react";
// // import { useParams, useNavigate } from "react-router-dom";
// // import { supabase } from "@/lib/supabaseClient";
// // import { Database } from "@/lib/database.types";

// // import { Button } from "@/components/ui/button";
// // import { Input } from "@/components/ui/input";
// // import { Textarea } from "@/components/ui/textarea";
// // import { Label } from "@/components/ui/label";
// // import {
// //   Select,
// //   SelectContent,
// //   SelectItem,
// //   SelectTrigger,
// //   SelectValue,
// // } from "@/components/ui/select";
// // import {
// //   Card,
// //   CardContent,
// //   CardHeader,
// //   CardTitle,
// //   CardFooter,
// // } from "@/components/ui/card";
// // import { Separator } from "@/components/ui/separator";
// // import { Checkbox } from "@/components/ui/checkbox";
// // import { ScrollArea } from "@/components/ui/scroll-area";
// // import {
// //   TrashIcon as RadixTrashIcon,
// //   PlusIcon,
// //   CheckIcon,
// //   Cross2Icon,
// // } from "@radix-ui/react-icons";
// // import {
// //   UserPlus,
// //   ListChecks,
// //   ClipboardPaste,
// //   UserMinus,
// //   DollarSign,
// //   Edit3Icon,
// // } from "lucide-react"; // Added Edit3Icon for manual income
// // import { toast as sonnerToast } from "sonner";

// // // --- Type Definitions ---
// // type Agent = Database["public"]["Tables"]["agents"]["Row"];
// // type PatientResult = Database["public"]["Tables"]["patient_result"]["Row"] & {
// //   patient: { id: string; full_name: string | null } | null;
// // };
// // type Ristourne = Database["public"]["Tables"]["ristourne"]["Row"] & {
// //   doctor: { id: string; full_name: string | null } | null;
// // };

// // type IncomeExpenseRecord =
// //   Database["public"]["Tables"]["income_expense_records"]["Row"];
// // type IncomeInsert = Database["public"]["Tables"]["incomes"]["Insert"]; // Will now include manual fields
// // type IncomeRow = Database["public"]["Tables"]["incomes"]["Row"]; // Will now include manual fields
// // type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
// // type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];

// // // Updated FormIncome to handle both types
// // interface FormIncome extends Partial<IncomeRow> {
// //   patient_result_id?: string | null; // Now optional
// //   notes?: string | null;
// //   _patientName?: string; // For patient_result-linked income
// //   _calculatedIncome?: number; // For patient_result-linked income (normal_price + insurance_price)

// //   // Fields for manual income
// //   manual_income_name?: string | null;
// //   manual_income_amount?: number | string | null; // string for input, number for saving

// //   _isManual?: boolean; // Flag to distinguish type in UI and saving
// //   _tempId?: string;
// //   _isNew?: boolean;
// //   _isMarkedForDeletion?: boolean;
// // }

// // interface FormExpense extends Partial<ExpenseRow> {
// //   name: string;
// //   price: number | string;
// //   expense_date: string;
// //   notes?: string | null;
// //   _tempId?: string;
// //   _isNew?: boolean;
// //   _isMarkedForDeletion?: boolean;
// //   _sourceRistourneId?: string;
// // }
// // interface SelectablePatientResult extends PatientResult {
// //   isSelected?: boolean;
// //   calculated_income: number;
// // }
// // interface SelectableRistourne extends Ristourne {
// //   isSelected?: boolean;
// // }
// // // --- End Type Definitions ---

// // export default function IncomeExpenseFormPage() {
// //   const { recordId } = useParams<{ recordId?: string }>();
// //   const navigate = useNavigate();
// //   // ... (other state variables: isEditing, loading, saving, agentId, recordDate, mainNotes)
// //   const [isEditing, setIsEditing] = useState(false);
// //   const [loading, setLoading] = useState(true);
// //   const [saving, setSaving] = useState(false);
// //   const [agentId, setAgentId] = useState<string>("");
// //   const [recordDate, setRecordDate] = useState<Date | undefined>(new Date());
// //   const [mainNotes, setMainNotes] = useState<string>("");

// //   const [formIncomes, setFormIncomes] = useState<FormIncome[]>([]);
// //   const [formExpenses, setFormExpenses] = useState<FormExpense[]>([]);

// //   const [agents, setAgentsData] = useState<Agent[]>([]);
// //   const [todaysPatientResults, setTodaysPatientResults] = useState<
// //     SelectablePatientResult[]
// //   >([]);
// //   const [todaysRistournes, setTodaysRistournes] = useState<
// //     SelectableRistourne[]
// //   >([]);

// //   const todayIsoDate = useMemo(
// //     () => new Date().toISOString().split("T")[0],
// //     []
// //   );

// //   const fetchData = useCallback(async () => {
// //     setLoading(true);
// //     try {
// //       // ... (fetch agents, patient_results, ristournes - same as before)
// //       const agentPromise = supabase.from("agents").select("id, name, code");
// //       const patientResultPromise = supabase
// //         .from("patient_result")
// //         .select("*, patient!inner(id, full_name)")
// //         .gte("created_at", `${todayIsoDate}T00:00:00.000Z`)
// //         .lte("created_at", `${todayIsoDate}T23:59:59.999Z`);
// //       const ristournePromise = supabase
// //         .from("ristourne")
// //         .select("*, doctor!inner(id, full_name)")
// //         .gte("created_at", `${todayIsoDate}T00:00:00.000Z`)
// //         .lte("created_at", `${todayIsoDate}T23:59:59.999Z`);
// //       const [agentRes, patientResultRes, ristourneRes] = await Promise.all([
// //         agentPromise,
// //         patientResultPromise,
// //         ristournePromise,
// //       ]);
// //       if (agentRes.error) throw agentRes.error;
// //       setAgentsData(agentRes.data || []);
// //       if (patientResultRes.error) throw patientResultRes.error;
// //       const fetchedPatientResults = (
// //         (patientResultRes.data as PatientResult[]) || []
// //       ).map((pr) => ({
// //         ...pr,
// //         isSelected: false,
// //         calculated_income: (pr.normal_price || 0) + (pr.insurance_price || 0),
// //       }));
// //       setTodaysPatientResults(fetchedPatientResults);
// //       if (ristourneRes.error) throw ristourneRes.error;
// //       const fetchedRistournes = ((ristourneRes.data as Ristourne[]) || []).map(
// //         (r) => ({ ...r, isSelected: false })
// //       );
// //       setTodaysRistournes(fetchedRistournes);

// //       if (recordId) {
// //         setIsEditing(true);
// //         const recordRes = await supabase
// //           .from("income_expense_records")
// //           .select("*, incomes(*), expenses(*)")
// //           .eq("id", recordId)
// //           .single();
// //         if (recordRes.error) throw recordRes.error;
// //         if (recordRes.data) {
// //           const record = recordRes.data;
// //           setAgentId(record.agent_id);
// //           setRecordDate(
// //             record.record_date ? new Date(record.record_date) : undefined
// //           );
// //           setMainNotes(record.notes || "");

// //           const populatedIncomes = ((record.incomes as IncomeRow[]) || []).map(
// //             (inc) => {
// //               if (inc.patient_result_id) {
// //                 const originalPr =
// //                   fetchedPatientResults.find(
// //                     (p) => p.id === inc.patient_result_id
// //                   ) ||
// //                   patientResultRes.data?.find(
// //                     (p) => p.id === inc.patient_result_id
// //                   );
// //                 return {
// //                   ...inc,
// //                   _patientName:
// //                     originalPr?.patient?.full_name || "Patient Inconnu",
// //                   _calculatedIncome:
// //                     (originalPr?.normal_price || 0) +
// //                     (originalPr?.insurance_price || 0),
// //                   _isManual: false,
// //                 };
// //               } else {
// //                 // Manual income
// //                 return {
// //                   ...inc,
// //                   manual_income_name: inc.manual_income_name,
// //                   manual_income_amount: inc.manual_income_amount,
// //                   _isManual: true,
// //                 };
// //               }
// //             }
// //           );
// //           setFormIncomes(populatedIncomes);
// //           setTodaysPatientResults((prevResults) =>
// //             prevResults.map((pr) => ({
// //               ...pr,
// //               isSelected: populatedIncomes.some(
// //                 (fi) => !fi._isManual && fi.patient_result_id === pr.id
// //               ),
// //             }))
// //           );

// //           const loadedExpenses = ((record.expenses as ExpenseRow[]) || []).map(
// //             (exp) => ({
// //               ...exp,
// //               expense_date: exp.expense_date || todayIsoDate,
// //               price: exp.price || 0,
// //             })
// //           );
// //           setFormExpenses(loadedExpenses);
// //           setTodaysRistournes((prevRistournes) =>
// //             prevRistournes.map((r) => {
// //               const pName = `Ristourne de ${r.doctor?.full_name || "Inconnu"}`;
// //               return {
// //                 ...r,
// //                 isSelected: loadedExpenses.some(
// //                   (exp) =>
// //                     exp.name === pName && Number(exp.price) === r.total_fee
// //                 ),
// //               };
// //             })
// //           );
// //         }
// //       }
// //     } catch (error: any) {
// //       /* ... error handling ... */ console.error("Error fetching data:", error);
// //       sonnerToast.error("Erreur chargement", { description: error.message });
// //     } finally {
// //       setLoading(false);
// //     }
// //   }, [recordId, todayIsoDate]);

// //   useEffect(() => {
// //     fetchData();
// //   }, [fetchData]);

// //   // --- Patient Result (Income) Selection --- (Same as before)
// //   const handlePatientResultSelectionChange = (id: string) =>
// //     setTodaysPatientResults((prev) =>
// //       prev.map((pr) =>
// //         pr.id === id ? { ...pr, isSelected: !pr.isSelected } : pr
// //       )
// //     );
// //   const handleSelectAllPatientResults = (checked: boolean) =>
// //     setTodaysPatientResults((prev) =>
// //       prev.map((pr) => ({ ...pr, isSelected: checked }))
// //     );
// //   const handleAddSelectedPatientResultsToIncomes = () => {
// //     const newIncomesToAdd: FormIncome[] = [];
// //     todaysPatientResults.forEach((pr) => {
// //       if (
// //         pr.isSelected &&
// //         !formIncomes.some(
// //           (fi) =>
// //             !fi._isManual &&
// //             fi.patient_result_id === pr.id &&
// //             !fi._isMarkedForDeletion
// //         )
// //       ) {
// //         newIncomesToAdd.push({
// //           _tempId: `new_income_pr_${pr.id}_${Date.now()}`,
// //           patient_result_id: pr.id,
// //           _patientName: pr.patient?.full_name || "Patient Inconnu",
// //           _calculatedIncome: pr.calculated_income,
// //           notes: "",
// //           _isNew: true,
// //           _isManual: false,
// //         });
// //       }
// //     });
// //     if (newIncomesToAdd.length > 0) {
// //       setFormIncomes((prev) => [
// //         ...prev.filter((fi) => !fi._isMarkedForDeletion),
// //         ...newIncomesToAdd,
// //       ]);
// //       sonnerToast.info(
// //         `${newIncomesToAdd.length} revenu(s) patient ajouté(s).`
// //       );
// //     }
// //   };

// //   // --- Manual Income Handlers ---
// //   const handleAddManualIncome = () => {
// //     setFormIncomes([
// //       ...formIncomes,
// //       {
// //         _tempId: `new_income_manual_${Date.now()}`,
// //         manual_income_name: "",
// //         manual_income_amount: "", // Start with empty string for input
// //         notes: "",
// //         _isNew: true,
// //         _isManual: true,
// //       },
// //     ]);
// //   };

// //   // --- General Income Handlers (for both types) ---
// //   const handleFormIncomeChange = (
// //     index: number,
// //     field: keyof FormIncome,
// //     value: any
// //   ) => {
// //     const updatedIncomes = [...formIncomes];
// //     const incomeItem = { ...updatedIncomes[index] };
// //     (incomeItem as any)[field] = value;
// //     updatedIncomes[index] = incomeItem;
// //     setFormIncomes(updatedIncomes);
// //   };

// //   const handleRemoveFormIncome = (index: number) => {
// //     const updatedIncomes = [...formIncomes];
// //     const incomeToRemove = updatedIncomes[index];
// //     if (incomeToRemove._isNew) {
// //       updatedIncomes.splice(index, 1);
// //     } else {
// //       updatedIncomes[index]._isMarkedForDeletion = true;
// //     }
// //     setFormIncomes(updatedIncomes);
// //     if (!incomeToRemove._isManual && incomeToRemove.patient_result_id) {
// //       // Uncheck from patient result list if applicable
// //       setTodaysPatientResults((prevResults) =>
// //         prevResults.map((pr) =>
// //           pr.id === incomeToRemove.patient_result_id
// //             ? { ...pr, isSelected: false }
// //             : pr
// //         )
// //       );
// //     }
// //   };

// //   // --- Ristourne (Expense) Selection --- (Same as before)
// //   const handleRistourneSelectionChange = (id: string) =>
// //     setTodaysRistournes((prev) =>
// //       prev.map((r) => (r.id === id ? { ...r, isSelected: !r.isSelected } : r))
// //     );
// //   const handleSelectAllRistournes = (checked: boolean) =>
// //     setTodaysRistournes((prev) =>
// //       prev.map((r) => ({ ...r, isSelected: checked }))
// //     );
// //   const handleAddSelectedRistournesToExpenses = () => {
// //     /* ... (same as before) ... */
// //     const newExpensesToAdd: FormExpense[] = [];
// //     const currentDate = new Date().toISOString().split("T")[0];
// //     todaysRistournes.forEach((r) => {
// //       if (
// //         r.isSelected &&
// //         !formExpenses.some(
// //           (fe) => fe._sourceRistourneId === r.id && !fe._isMarkedForDeletion
// //         )
// //       ) {
// //         newExpensesToAdd.push({
// //           _tempId: `new_expense_ristourne_${r.id}_${Date.now()}`,
// //           name: `Ristourne de ${r.doctor?.full_name || "Docteur Inconnu"}`,
// //           price: r.total_fee || 0,
// //           expense_date: currentDate,
// //           notes: `Ristourne ID: ${r.id}`,
// //           _isNew: true,
// //           _sourceRistourneId: r.id,
// //         });
// //       }
// //     });
// //     if (newExpensesToAdd.length > 0) {
// //       setFormExpenses((prev) => [
// //         ...prev.filter((fe) => !fe._isMarkedForDeletion),
// //         ...newExpensesToAdd,
// //       ]);
// //       sonnerToast.info(
// //         `${newExpensesToAdd.length} ristourne(s) ajoutée(s) aux dépenses.`
// //       );
// //     }
// //   };

// //   // --- General Expense Handlers --- (Same as before)
// //   const handleAddManualExpense = () =>
// //     setFormExpenses([
// //       ...formExpenses,
// //       {
// //         _tempId: `new_expense_manual_${Date.now()}`,
// //         name: "",
// //         price: "",
// //         expense_date: todayIsoDate,
// //         notes: "",
// //         _isNew: true,
// //       },
// //     ]);
// //   const handleExpenseChange = (
// //     index: number,
// //     field: keyof FormExpense,
// //     value: any
// //   ) => {
// //     const updatedExpenses = [...formExpenses];
// //     (updatedExpenses[index] as any)[field] = value;
// //     setFormExpenses(updatedExpenses);
// //   };
// //   const handleRemoveExpense = (index: number) => {
// //     /* ... (same as before, ensures it unchecks from todaysRistournes) ... */
// //     const updatedExpenses = [...formExpenses];
// //     const expenseToRemove = updatedExpenses[index];
// //     if (expenseToRemove._isNew) {
// //       updatedExpenses.splice(index, 1);
// //     } else {
// //       updatedExpenses[index]._isMarkedForDeletion = true;
// //     }
// //     setFormExpenses(updatedExpenses);
// //     if (expenseToRemove._sourceRistourneId) {
// //       setTodaysRistournes((prevRistournes) =>
// //         prevRistournes.map((r) =>
// //           r.id === expenseToRemove._sourceRistourneId
// //             ? { ...r, isSelected: false }
// //             : r
// //         )
// //       );
// //     }
// //   };

// //   // --- Save Handler ---
// //   const handleSubmit = async (e: React.FormEvent) => {
// //     e.preventDefault();
// //     setSaving(true);
// //     // ... (initial checks for agentId, recordDate, empty form - same as before) ...
// //     if (!agentId) {
// //       sonnerToast.error("Champ Requis", {
// //         description: "Veuillez sélectionner un agent.",
// //       });
// //       setSaving(false);
// //       return;
// //     }
// //     if (!recordDate) {
// //       sonnerToast.error("Champ Requis", {
// //         description: "Veuillez sélectionner une date.",
// //       });
// //       setSaving(false);
// //       return;
// //     }
// //     if (
// //       formIncomes.filter((i) => !i._isMarkedForDeletion).length === 0 &&
// //       formExpenses.filter((ex) => !ex._isMarkedForDeletion).length === 0
// //     ) {
// //       sonnerToast.warning("Fiche Vide", {
// //         description: "Ajoutez au moins un revenu ou une dépense.",
// //       });
// //       setSaving(false);
// //       return;
// //     }

// //     // Validation for incomes (both types)
// //     for (const inc of formIncomes) {
// //       if (!inc._isMarkedForDeletion) {
// //         if (inc._isManual) {
// //           if (
// //             !inc.manual_income_name ||
// //             Number.isNaN(parseFloat(String(inc.manual_income_amount))) ||
// //             parseFloat(String(inc.manual_income_amount)) <= 0
// //           ) {
// //             sonnerToast.error("Revenu Manuel Invalide", {
// //               description: `Veuillez vérifier le nom et le montant du revenu manuel "${
// //                 inc.manual_income_name || "Nouveau Revenu Manuel"
// //               }".`,
// //             });
// //             setSaving(false);
// //             return;
// //           }
// //         } else {
// //           // Patient result linked income
// //           if (!inc.patient_result_id) {
// //             // Should not happen if selected properly
// //             sonnerToast.error("Revenu Patient Invalide", {
// //               description: "Un revenu lié à un patient est incorrect.",
// //             });
// //             setSaving(false);
// //             return;
// //           }
// //         }
// //       }
// //     }
// //     // Validation for expenses (same as before)
// //     for (const exp of formExpenses) {
// //       if (
// //         !exp._isMarkedForDeletion &&
// //         (!exp.name ||
// //           Number.isNaN(parseFloat(String(exp.price))) ||
// //           parseFloat(String(exp.price)) < 0)
// //       ) {
// //         sonnerToast.error("Dépense Invalide", {
// //           description: `Vérifiez: ${exp.name || "Nouvelle Dépense"}.`,
// //         });
// //         setSaving(false);
// //         return;
// //       }
// //     }

// //     try {
// //       let currentRecordId = recordId;
// //       const recordPayload = {
// //         agent_id: agentId,
// //         record_date: recordDate.toISOString().split("T")[0],
// //         notes: mainNotes || null,
// //       };
// //       // ... (Create/Update income_expense_records - same as before) ...
// //       if (isEditing && currentRecordId) {
// //         const { error } = await supabase
// //           .from("income_expense_records")
// //           .update(recordPayload)
// //           .eq("id", currentRecordId);
// //         if (error) throw error;
// //       } else {
// //         const { data, error } = await supabase
// //           .from("income_expense_records")
// //           .insert(recordPayload)
// //           .select("id")
// //           .single();
// //         if (error) throw error;
// //         if (!data) throw new Error("Échec création fiche.");
// //         currentRecordId = data.id;
// //       }
// //       if (!currentRecordId) throw new Error("ID de fiche manquant.");

// //       // UPDATED Income Operations
// //       const incomeOps = formIncomes.map((income) => {
// //         if (income._isMarkedForDeletion && income.id) {
// //           return supabase.from("incomes").delete().eq("id", income.id);
// //         } else if (!income._isMarkedForDeletion) {
// //           let incomeData: IncomeInsert;
// //           if (income._isManual) {
// //             incomeData = {
// //               // Manual income
// //               income_expense_record_id: currentRecordId!,
// //               patient_result_id: null, // Explicitly null
// //               manual_income_name: income.manual_income_name || "Revenu Manuel",
// //               manual_income_amount:
// //                 parseFloat(String(income.manual_income_amount)) || 0,
// //               notes: income.notes || null,
// //             };
// //           } else if (income.patient_result_id) {
// //             // Patient_result linked income
// //             incomeData = {
// //               income_expense_record_id: currentRecordId!,
// //               patient_result_id: income.patient_result_id,
// //               manual_income_name: null, // Ensure these are null for this type
// //               manual_income_amount: null,
// //               notes: income.notes || null,
// //             };
// //           } else {
// //             return Promise.resolve({
// //               data: null,
// //               error: { message: "Invalid income item data" },
// //             }); // Skip invalid item
// //           }

// //           if (income.id && !income._isNew) {
// //             // Update existing
// //             return supabase
// //               .from("incomes")
// //               .update(incomeData)
// //               .eq("id", income.id);
// //           } else if (income._isNew) {
// //             // Insert new
// //             return supabase.from("incomes").insert(incomeData);
// //           }
// //         }
// //         return Promise.resolve({ data: null, error: null }); // No action
// //       });

// //       // Expense Operations (same as before)
// //       const expenseOps = formExpenses.map((ex) => {
// //         /* ... */
// //       });

// //       const results = await Promise.all(
// //         [...incomeOps, ...expenseOps].filter((op) => op !== null)
// //       );
// //       // ... (Error handling and navigation - same as before) ...
// //       let opError = false;
// //       results.forEach((r) => {
// //         if (r && r.error) {
// //           console.error("Erreur opération:", r.error);
// //           opError = true;
// //         }
// //       });
// //       if (opError)
// //         sonnerToast.warning("Certaines opérations ont échoué", {
// //           description: "Veuillez vérifier.",
// //         });
// //       else sonnerToast.success("Fiche Enregistrée!");
// //       navigate("/gestion-depenses");
// //     } catch (error: any) {
// //       /* ... error handling ... */ console.error(
// //         "Erreur enregistrement:",
// //         error
// //       );
// //       sonnerToast.error("Erreur d'Enregistrement", {
// //         description: error.message || "Erreur.",
// //       });
// //     } finally {
// //       setSaving(false);
// //     }
// //   };

// //   // ... (loading state and other constants - same as before) ...
// //   if (loading)
// //     return (
// //       <div className="container mx-auto p-8 text-center">Chargement...</div>
// //     );
// //   const allPatientResultsSelected =
// //     todaysPatientResults.length > 0 &&
// //     todaysPatientResults.every((pr) => pr.isSelected);
// //   const somePatientResultsSelected = todaysPatientResults.some(
// //     (pr) => pr.isSelected
// //   );
// //   const allRistournesSelected =
// //     todaysRistournes.length > 0 && todaysRistournes.every((r) => r.isSelected);
// //   const someRistournesSelected = todaysRistournes.some((r) => r.isSelected);

// //   return (
// //     <div className="container mx-auto p-4 md:p-8">
// //       <form onSubmit={handleSubmit}>
// //         <Card className="shadow-lg">
// //           <CardHeader>
// //             <CardTitle className="text-2xl font-bold">
// //               {isEditing ? "Modifier Fiche" : "Créer Fiche Revenus/Dépenses"}
// //             </CardTitle>
// //           </CardHeader>
// //           <CardContent className="space-y-6 pt-6">
// //             {/* Record Details ... (same as before) ... */}
// //             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
// //               <div>
// //                 <Label htmlFor="agent">
// //                   Agent <span className="text-red-500">*</span>
// //                 </Label>
// //                 <Select value={agentId} onValueChange={setAgentId} required>
// //                   <SelectTrigger id="agent" className="w-full">
// //                     <SelectValue placeholder="Sélectionner agent" />
// //                   </SelectTrigger>
// //                   <SelectContent>
// //                     {agents.map((a) => (
// //                       <SelectItem key={a.id} value={a.id}>
// //                         {a.name} {a.code ? `(${a.code})` : ""}
// //                       </SelectItem>
// //                     ))}
// //                   </SelectContent>
// //                 </Select>
// //               </div>
// //               <div>
// //                 <Label htmlFor="recordDate">
// //                   Date Fiche <span className="text-red-500">*</span>
// //                 </Label>
// //                 <Input
// //                   type="date"
// //                   id="recordDate"
// //                   className="w-full"
// //                   value={
// //                     recordDate ? recordDate.toISOString().split("T")[0] : ""
// //                   }
// //                   onChange={(e) =>
// //                     setRecordDate(
// //                       e.target.value ? new Date(e.target.value) : undefined
// //                     )
// //                   }
// //                   required
// //                 />
// //               </div>
// //             </div>
// //             <div>
// //               <Label htmlFor="mainNotes">Notes Générales (Fiche)</Label>
// //               <Textarea
// //                 id="mainNotes"
// //                 value={mainNotes}
// //                 onChange={(e) => setMainNotes(e.target.value)}
// //                 placeholder="Notes additionnelles..."
// //               />
// //             </div>
// //             <Separator className="my-8" />

// //             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
// //               {/* Incomes Section - Left */}
// //               <div className="space-y-6">
// //                 <h3 className="text-xl font-semibold flex items-center">
// //                   <ListChecks className="mr-2 h-6 w-6 text-green-600" />{" "}
// //                   Sélection Revenus (Résultats Patients)
// //                 </h3>
// //                 {/* ... (Patient Result Selection UI - same as before) ... */}
// //                 {todaysPatientResults.length === 0 && (
// //                   <p className="text-sm text-gray-500">
// //                     Aucun résultat patient pour aujourd'hui.
// //                   </p>
// //                 )}
// //                 {todaysPatientResults.length > 0 && (
// //                   <>
// //                     {" "}
// //                     <div className="flex items-center space-x-2 border p-2 rounded-md bg-slate-50">
// //                       {" "}
// //                       <Checkbox
// //                         id="select-all-prs"
// //                         checked={allPatientResultsSelected}
// //                         onCheckedChange={(c) =>
// //                           handleSelectAllPatientResults(Boolean(c))
// //                         }
// //                       />{" "}
// //                       <Label htmlFor="select-all-prs" className="font-medium">
// //                         {allPatientResultsSelected
// //                           ? "Désélectionner Tout"
// //                           : "Sélectionner Tout"}{" "}
// //                         (
// //                         {
// //                           todaysPatientResults.filter((pr) => pr.isSelected)
// //                             .length
// //                         }
// //                         /{todaysPatientResults.length})
// //                       </Label>{" "}
// //                     </div>{" "}
// //                     <ScrollArea className="h-[180px] w-full rounded-md border p-2 bg-slate-50">
// //                       {" "}
// //                       {/* Adjusted height */}{" "}
// //                       <div className="space-y-2">
// //                         {todaysPatientResults.map((pr) => (
// //                           <div
// //                             key={pr.id}
// //                             className="flex items-center justify-between p-2 rounded hover:bg-slate-100"
// //                           >
// //                             {" "}
// //                             <div className="flex items-center space-x-3">
// //                               {" "}
// //                               <Checkbox
// //                                 id={`pr-${pr.id}`}
// //                                 checked={!!pr.isSelected}
// //                                 onCheckedChange={() =>
// //                                   handlePatientResultSelectionChange(pr.id)
// //                                 }
// //                               />{" "}
// //                               <Label
// //                                 htmlFor={`pr-${pr.id}`}
// //                                 className="text-sm cursor-pointer"
// //                               >
// //                                 {pr.patient?.full_name || "Patient Inconnu"}
// //                               </Label>{" "}
// //                             </div>{" "}
// //                             <span className="text-sm font-medium text-green-700">
// //                               {pr.calculated_income.toLocaleString("fr-FR")} XOF
// //                             </span>{" "}
// //                           </div>
// //                         ))}{" "}
// //                       </div>{" "}
// //                     </ScrollArea>{" "}
// //                     <Button
// //                       type="button"
// //                       onClick={handleAddSelectedPatientResultsToIncomes}
// //                       disabled={!somePatientResultsSelected}
// //                       className="w-full"
// //                     >
// //                       {" "}
// //                       <UserPlus className="mr-2 h-4 w-4" /> Ajouter Sélection
// //                       aux Revenus{" "}
// //                     </Button>
// //                   </>
// //                 )}

// //                 <Separator />
// //                 <h4 className="text-lg font-medium">Revenus Ajoutés</h4>
// //                 {formIncomes.filter((inc) => !inc._isMarkedForDeletion)
// //                   .length === 0 && (
// //                   <p className="text-sm text-gray-500">Aucun revenu.</p>
// //                 )}
// //                 <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
// //                   {formIncomes.map(
// //                     (income, index) =>
// //                       !income._isMarkedForDeletion && (
// //                         <Card
// //                           key={income.id || income._tempId}
// //                           className="p-3 bg-green-50 border-green-200"
// //                         >
// //                           {income._isManual ? (
// //                             // Manual Income Display/Edit
// //                             <div className="space-y-2">
// //                               <div className="flex justify-between items-center">
// //                                 <p className="text-sm font-semibold">
// //                                   Revenu Manuel
// //                                 </p>
// //                                 <Button
// //                                   type="button"
// //                                   variant="ghost"
// //                                   size="icon"
// //                                   className="text-red-500 hover:bg-red-100 h-8 w-8"
// //                                   onClick={() => handleRemoveFormIncome(index)}
// //                                   title="Supprimer revenu"
// //                                 >
// //                                   <RadixTrashIcon className="h-4 w-4" />
// //                                 </Button>
// //                               </div>
// //                               <div>
// //                                 <Label
// //                                   htmlFor={`manual-income-name-${index}`}
// //                                   className="text-xs"
// //                                 >
// //                                   Description{" "}
// //                                   <span className="text-red-500">*</span>
// //                                 </Label>
// //                                 <Input
// //                                   id={`manual-income-name-${index}`}
// //                                   value={income.manual_income_name || ""}
// //                                   onChange={(e) =>
// //                                     handleFormIncomeChange(
// //                                       index,
// //                                       "manual_income_name",
// //                                       e.target.value
// //                                     )
// //                                   }
// //                                   placeholder="Ex: Montant reçu"
// //                                   required
// //                                   className="text-sm"
// //                                 />
// //                               </div>
// //                               <div>
// //                                 <Label
// //                                   htmlFor={`manual-income-amount-${index}`}
// //                                   className="text-xs"
// //                                 >
// //                                   Montant (XOF){" "}
// //                                   <span className="text-red-500">*</span>
// //                                 </Label>
// //                                 <Input
// //                                   id={`manual-income-amount-${index}`}
// //                                   type="number"
// //                                   value={income.manual_income_amount || ""}
// //                                   onChange={(e) =>
// //                                     handleFormIncomeChange(
// //                                       index,
// //                                       "manual_income_amount",
// //                                       e.target.value
// //                                     )
// //                                   }
// //                                   placeholder="0.00"
// //                                   required
// //                                   step="any"
// //                                   min="0"
// //                                   className="text-sm"
// //                                 />
// //                               </div>
// //                             </div>
// //                           ) : (
// //                             // Patient-Result Linked Income Display
// //                             <div className="flex justify-between items-start">
// //                               <div>
// //                                 <p className="font-medium text-sm">
// //                                   {income._patientName}
// //                                 </p>
// //                                 <p className="text-xs text-green-700">
// //                                   {(
// //                                     income._calculatedIncome ?? 0
// //                                   ).toLocaleString("fr-FR")}{" "}
// //                                   XOF
// //                                 </p>
// //                               </div>
// //                               <Button
// //                                 type="button"
// //                                 variant="ghost"
// //                                 size="icon"
// //                                 className="text-red-500 hover:bg-red-100 h-8 w-8"
// //                                 onClick={() => handleRemoveFormIncome(index)}
// //                                 title="Supprimer revenu"
// //                               >
// //                                 <RadixTrashIcon className="h-4 w-4" />
// //                               </Button>
// //                             </div>
// //                           )}
// //                           <Label
// //                             htmlFor={`income-notes-${index}`}
// //                             className="text-xs mt-2 block"
// //                           >
// //                             Notes (Optionnel)
// //                           </Label>
// //                           <Input
// //                             id={`income-notes-${index}`}
// //                             className="mt-1 text-xs"
// //                             value={income.notes || ""}
// //                             onChange={(e) =>
// //                               handleFormIncomeChange(
// //                                 index,
// //                                 "notes",
// //                                 e.target.value
// //                               )
// //                             }
// //                             placeholder="Notes additionnelles"
// //                           />
// //                         </Card>
// //                       )
// //                   )}
// //                 </div>
// //                 <Button
// //                   type="button"
// //                   variant="outline"
// //                   onClick={handleAddManualIncome}
// //                   className="w-full"
// //                 >
// //                   <Edit3Icon className="mr-2 h-4 w-4" /> Ajouter un Revenu
// //                   Manuel
// //                 </Button>
// //               </div>

// //               {/* Expenses Section - Right */}
// //               <div className="space-y-6">
// //                 {" "}
// //                 {/* ... (Ristourne selection and added/manual expenses, same as before) ... */}
// //                 <h3 className="text-xl font-semibold flex items-center">
// //                   {" "}
// //                   <DollarSign className="mr-2 h-6 w-6 text-orange-600" />{" "}
// //                   Sélection Ristournes (Du Jour){" "}
// //                 </h3>
// //                 {todaysRistournes.length === 0 && (
// //                   <p className="text-sm text-gray-500">
// //                     Aucune ristourne trouvée pour aujourd'hui.
// //                   </p>
// //                 )}
// //                 {todaysRistournes.length > 0 && (
// //                   <>
// //                     {" "}
// //                     <div className="flex items-center space-x-2 border p-2 rounded-md bg-slate-50">
// //                       {" "}
// //                       <Checkbox
// //                         id="select-all-ristournes"
// //                         checked={allRistournesSelected}
// //                         onCheckedChange={(c) =>
// //                           handleSelectAllRistournes(Boolean(c))
// //                         }
// //                       />{" "}
// //                       <Label
// //                         htmlFor="select-all-ristournes"
// //                         className="font-medium"
// //                       >
// //                         {" "}
// //                         {allRistournesSelected
// //                           ? "Désélectionner Tout"
// //                           : "Sélectionner Tout"}{" "}
// //                         ({todaysRistournes.filter((r) => r.isSelected).length}/
// //                         {todaysRistournes.length}){" "}
// //                       </Label>{" "}
// //                     </div>{" "}
// //                     <ScrollArea className="h-[180px] w-full rounded-md border p-2 bg-slate-50">
// //                       {" "}
// //                       {/* Adjusted height */}{" "}
// //                       <div className="space-y-2">
// //                         {todaysRistournes.map((r) => (
// //                           <div
// //                             key={r.id}
// //                             className="flex items-center justify-between p-2 rounded hover:bg-slate-100"
// //                           >
// //                             {" "}
// //                             <div className="flex items-center space-x-3">
// //                               {" "}
// //                               <Checkbox
// //                                 id={`ristourne-${r.id}`}
// //                                 checked={!!r.isSelected}
// //                                 onCheckedChange={() =>
// //                                   handleRistourneSelectionChange(r.id)
// //                                 }
// //                               />{" "}
// //                               <Label
// //                                 htmlFor={`ristourne-${r.id}`}
// //                                 className="text-sm cursor-pointer"
// //                               >
// //                                 {" "}
// //                                 Dr. {r.doctor?.full_name || "Inconnu"}{" "}
// //                               </Label>{" "}
// //                             </div>{" "}
// //                             <span className="text-sm font-medium text-orange-700">
// //                               {" "}
// //                               {(r.total_fee || 0).toLocaleString(
// //                                 "fr-FR"
// //                               )} XOF{" "}
// //                             </span>{" "}
// //                           </div>
// //                         ))}{" "}
// //                       </div>{" "}
// //                     </ScrollArea>{" "}
// //                     <Button
// //                       type="button"
// //                       onClick={handleAddSelectedRistournesToExpenses}
// //                       disabled={!someRistournesSelected}
// //                       className="w-full"
// //                     >
// //                       {" "}
// //                       <UserMinus className="mr-2 h-4 w-4" /> Ajouter Sélection
// //                       aux Dépenses{" "}
// //                     </Button>{" "}
// //                   </>
// //                 )}
// //                 <Separator />
// //                 <h4 className="text-lg font-medium flex items-center">
// //                   {" "}
// //                   <ClipboardPaste className="mr-2 h-5 w-5 text-red-600" />{" "}
// //                   Dépenses Ajoutées/Manuelles{" "}
// //                 </h4>
// //                 {formExpenses.filter((exp) => !exp._isMarkedForDeletion)
// //                   .length === 0 && (
// //                   <p className="text-sm text-gray-500 mb-4">Aucune dépense.</p>
// //                 )}
// //                 <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
// //                   {formExpenses.map(
// //                     (expense, index) =>
// //                       !expense._isMarkedForDeletion && (
// //                         <Card
// //                           key={expense.id || expense._tempId}
// //                           className="p-4 bg-red-50 border-red-200"
// //                         >
// //                           {" "}
// //                           <div className="grid grid-cols-1 gap-3">
// //                             {" "}
// //                             <div className="flex justify-between items-center">
// //                               {" "}
// //                               <Label
// //                                 htmlFor={`exp-name-${index}`}
// //                                 className="text-sm font-medium"
// //                               >
// //                                 Nom Dépense{" "}
// //                                 <span className="text-red-500">*</span>
// //                               </Label>{" "}
// //                               <Button
// //                                 type="button"
// //                                 variant="ghost"
// //                                 size="icon"
// //                                 className="text-red-500 hover:bg-red-100 h-8 w-8"
// //                                 onClick={() => handleRemoveExpense(index)}
// //                                 title="Supprimer dépense"
// //                               >
// //                                 <RadixTrashIcon className="h-4 w-4" />
// //                               </Button>{" "}
// //                             </div>{" "}
// //                             <Input
// //                               id={`exp-name-${index}`}
// //                               value={expense.name}
// //                               onChange={(e) =>
// //                                 handleExpenseChange(
// //                                   index,
// //                                   "name",
// //                                   e.target.value
// //                                 )
// //                               }
// //                               placeholder="Ex: Fournitures"
// //                               required
// //                               disabled={!!expense._sourceRistourneId}
// //                             />{" "}
// //                             <div className="grid grid-cols-2 gap-3">
// //                               {" "}
// //                               <div>
// //                                 <Label
// //                                   htmlFor={`exp-price-${index}`}
// //                                   className="text-sm"
// //                                 >
// //                                   Montant (XOF){" "}
// //                                   <span className="text-red-500">*</span>
// //                                 </Label>
// //                                 <Input
// //                                   id={`exp-price-${index}`}
// //                                   type="number"
// //                                   value={expense.price}
// //                                   onChange={(e) =>
// //                                     handleExpenseChange(
// //                                       index,
// //                                       "price",
// //                                       e.target.value
// //                                     )
// //                                   }
// //                                   placeholder="0.00"
// //                                   required
// //                                   step="any"
// //                                   min="0"
// //                                   disabled={!!expense._sourceRistourneId}
// //                                 />
// //                               </div>{" "}
// //                               <div>
// //                                 <Label
// //                                   htmlFor={`exp-date-${index}`}
// //                                   className="text-sm"
// //                                 >
// //                                   Date <span className="text-red-500">*</span>
// //                                 </Label>
// //                                 <Input
// //                                   id={`exp-date-${index}`}
// //                                   type="date"
// //                                   value={expense.expense_date}
// //                                   onChange={(e) =>
// //                                     handleExpenseChange(
// //                                       index,
// //                                       "expense_date",
// //                                       e.target.value
// //                                     )
// //                                   }
// //                                   required
// //                                 />
// //                               </div>{" "}
// //                             </div>{" "}
// //                             <div>
// //                               <Label
// //                                 htmlFor={`exp-notes-${index}`}
// //                                 className="text-sm"
// //                               >
// //                                 Notes (Dépense)
// //                               </Label>
// //                               <Input
// //                                 id={`exp-notes-${index}`}
// //                                 value={expense.notes || ""}
// //                                 onChange={(e) =>
// //                                   handleExpenseChange(
// //                                     index,
// //                                     "notes",
// //                                     e.target.value
// //                                   )
// //                                 }
// //                                 placeholder="Notes optionnelles"
// //                               />
// //                             </div>{" "}
// //                           </div>{" "}
// //                         </Card>
// //                       )
// //                   )}
// //                 </div>
// //                 <Button
// //                   type="button"
// //                   variant="outline"
// //                   onClick={handleAddManualExpense}
// //                   className="w-full"
// //                 >
// //                   <PlusIcon className="mr-2 h-4 w-4" /> Ajouter Dépense Manuelle
// //                 </Button>
// //               </div>
// //             </div>
// //           </CardContent>
// //           <CardFooter className="border-t pt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
// //             <Button
// //               type="button"
// //               variant="outline"
// //               onClick={() => navigate("/gestion-depenses")}
// //               disabled={saving}
// //               className="w-full sm:w-auto"
// //             >
// //               <Cross2Icon className="mr-2 h-4 w-4" /> Annuler
// //             </Button>
// //             <Button
// //               type="submit"
// //               disabled={saving || loading}
// //               className="w-full sm:w-auto"
// //             >
// //               <CheckIcon className="mr-2 h-4 w-4" />
// //               {saving
// //                 ? "Enregistrement..."
// //                 : isEditing
// //                 ? "Mettre à jour"
// //                 : "Enregistrer"}
// //             </Button>
// //           </CardFooter>
// //         </Card>
// //       </form>
// //     </div>
// //   );
// // }

// ====================================================================================================================================
// src/pages/IncomeExpenseFormPage.tsx

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Database } from "@/lib/database.types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrashIcon as RadixTrashIcon,
  PlusIcon,
  CheckIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";
import {
  UserPlus,
  ListChecks,
  ClipboardPaste,
  UserMinus,
  DollarSign,
  Edit3Icon, // For manual income
  FilePlus2, // Alternative icon for manual income
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { extractId } from "@/lib/utils";

// --- Type Definitions ---
type Agent = Database["public"]["Tables"]["agents"]["Row"];
type PatientResult = Database["public"]["Tables"]["patient_result"]["Row"] & {
  patient: {
    id: string;
    full_name: string | null;
    patient_unique_id?: string | null;
  } | null; // Added patient_unique_id
};
type Ristourne = Database["public"]["Tables"]["ristourne"]["Row"] & {
  doctor: { id: string; full_name: string | null } | null;
};

type IncomeExpenseRecord =
  Database["public"]["Tables"]["income_expense_records"]["Row"];

// Ensure IncomeInsert and IncomeRow match your database.types.ts after schema changes
// These types should ideally come from your generated types.
type IncomeSchema = Database["public"]["Tables"]["incomes"];
type IncomeInsert = IncomeSchema["Insert"];
type IncomeRow = IncomeSchema["Row"];

type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];

// Updated FormIncome to handle both patient-linked and manual incomes
interface FormIncome extends Partial<IncomeRow> {
  // For patient_result-linked income
  patient_result_id?: string | null;
  _patientName?: string;
  _calculatedIncome?: number; // (normal_price + insurance_price)

  // Fields for manual income
  manual_income_name?: string | null;
  manual_income_amount?: number | string | null; // string for input, number for saving

  // Common fields
  notes?: string | null;

  // Internal flags
  _isManual?: boolean; // Flag to distinguish type in UI and saving
  _tempId?: string;
  _isNew?: boolean;
  _isMarkedForDeletion?: boolean;
}

interface FormExpense extends Partial<ExpenseRow> {
  name: string;
  price: number | string;
  expense_date: string;
  notes?: string | null;
  _tempId?: string;
  _isNew?: boolean;
  _isMarkedForDeletion?: boolean;
  _sourceRistourneId?: string;
}
interface SelectablePatientResult extends PatientResult {
  isSelected?: boolean;
  calculated_income: number;
}
interface SelectableRistourne extends Ristourne {
  isSelected?: boolean;
}
// --- End Type Definitions ---

export default function IncomeExpenseFormPage() {
  const { recordId } = useParams<{ recordId?: string }>();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [agentId, setAgentId] = useState<string>("");
  const [recordDate, setRecordDate] = useState<Date | undefined>(new Date());
  const [mainNotes, setMainNotes] = useState<string>(""); // This is for income_expense_records.notes

  const [formIncomes, setFormIncomes] = useState<FormIncome[]>([]);
  const [formExpenses, setFormExpenses] = useState<FormExpense[]>([]);

  const [agents, setAgentsData] = useState<Agent[]>([]);
  const [todaysPatientResults, setTodaysPatientResults] = useState<
    SelectablePatientResult[]
  >([]);
  const [todaysRistournes, setTodaysRistournes] = useState<
    SelectableRistourne[]
  >([]);

  const todayIsoDate = useMemo(
    () => new Date().toISOString().split("T")[0],
    []
  );
  const yesterdayIsoDate = useMemo(
    () => new Date(Date.now() - 86400000).toISOString().split("T")[0],
    []
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const agentPromise = supabase.from("agents").select("id, name, code");
      const patientResultPromise = supabase
        .from("patient_result")
        .select("*, patient!inner(id, full_name, patient_unique_id)") // Ensure patient_unique_id is selected
        .gte("created_at", `${yesterdayIsoDate}T00:00:00.000Z`)
        .lte("created_at", `${todayIsoDate}T23:59:59.999Z`)
        .order("created_at", { ascending: true });

      const ristournePromise = supabase
        .from("ristourne")
        .select("*, doctor!inner(id, full_name)")
        .gte("created_at", `${yesterdayIsoDate}T00:00:00.000Z`)
        .lte("created_at", `${todayIsoDate}T23:59:59.999Z`)
        .order("created_at", { ascending: true });

      const [agentRes, patientResultRes, ristourneRes] = await Promise.all([
        agentPromise,
        patientResultPromise,
        ristournePromise,
      ]);

      if (agentRes.error) throw agentRes.error;
      setAgentsData(agentRes.data || []);

      if (patientResultRes.error) throw patientResultRes.error;
      const fetchedPatientResults = (
        (patientResultRes.data as PatientResult[]) || []
      ).map((pr) => ({
        ...pr,
        isSelected: false,
        // TODO 2
        calculated_income:
          (pr.normal_price || 0) +
          (pr.insurance_price || 0) -
          (pr.unpaid_amount || 0),
      }));
      setTodaysPatientResults(fetchedPatientResults);

      if (ristourneRes.error) throw ristourneRes.error;
      const fetchedRistournes = ((ristourneRes.data as Ristourne[]) || []).map(
        (r) => ({ ...r, isSelected: false })
      );
      setTodaysRistournes(fetchedRistournes);

      if (recordId) {
        setIsEditing(true);
        const recordRes = await supabase
          .from("income_expense_records")
          .select("*, incomes(*), expenses(*)") // incomes will now have manual_ fields
          .eq("id", recordId)
          .single();
        if (recordRes.error) throw recordRes.error;

        if (recordRes.data) {
          const record = recordRes.data;
          setAgentId(record.agent_id);
          setRecordDate(
            record.record_date ? new Date(record.record_date) : undefined
          );
          setMainNotes(record.notes || ""); // For the record itself

          const populatedIncomes = ((record.incomes as IncomeRow[]) || []).map(
            (inc): FormIncome => {
              // Check if it's a patient-linked income
              if (inc.patient_result_id) {
                const originalPr =
                  fetchedPatientResults.find(
                    (p) => p.id === inc.patient_result_id
                  ) ||
                  patientResultRes.data?.find(
                    // Fallback if not in today's fetched (e.g. older record)
                    (p) => p.id === inc.patient_result_id
                  );
                return {
                  ...inc,
                  _patientName:
                    originalPr?.patient?.full_name || "Patient Archivé/Inconnu",
                  // TODO: change to also subtract unpaid_amount if it exists
                  _calculatedIncome:
                    (originalPr?.normal_price || 0) +
                    (originalPr?.insurance_price || 0),
                  _isManual: false, // Explicitly set
                };
              } else {
                // It's a manual income
                return {
                  ...inc,
                  manual_income_name: inc.manual_income_name,
                  manual_income_amount: inc.manual_income_amount, // Will be number from DB
                  _isManual: true, // Explicitly set
                };
              }
            }
          );
          setFormIncomes(populatedIncomes);

          // Mark today's patient results as selected if they are part of the loaded incomes
          setTodaysPatientResults((prevResults) =>
            prevResults.map((pr) => ({
              ...pr,
              isSelected: populatedIncomes.some(
                (fi) => !fi._isManual && fi.patient_result_id === pr.id
              ),
            }))
          );

          const loadedExpenses = ((record.expenses as ExpenseRow[]) || []).map(
            (exp) => ({
              ...exp,
              expense_date: exp.expense_date || todayIsoDate,
              price: exp.price || 0, // Ensure price is a number or valid string for input
            })
          );
          setFormExpenses(loadedExpenses);

          setTodaysRistournes((prevRistournes) =>
            prevRistournes.map((r) => {
              const potentialExpenseName = `Ristourne de ${
                r.doctor?.full_name || "Inconnu"
              }`;
              return {
                ...r,
                isSelected: loadedExpenses.some(
                  (exp) =>
                    exp.name === potentialExpenseName &&
                    Number(exp.price) === r.total_fee
                ),
              };
            })
          );
        }
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      sonnerToast.error("Erreur de chargement des données", {
        description: error.message || "Impossible de charger les données.",
      });
    } finally {
      setLoading(false);
    }
  }, [recordId, todayIsoDate, yesterdayIsoDate]); // Added yesterdayIsoDate

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Patient Result (Income) Selection ---
  const handlePatientResultSelectionChange = (id: string) =>
    setTodaysPatientResults((prev) =>
      prev.map((pr) =>
        pr.id === id ? { ...pr, isSelected: !pr.isSelected } : pr
      )
    );
  const handleSelectAllPatientResults = (checked: boolean) =>
    setTodaysPatientResults((prev) =>
      prev.map((pr) => ({ ...pr, isSelected: checked }))
    );
  const handleAddSelectedPatientResultsToIncomes = () => {
    const newIncomesToAdd: FormIncome[] = [];
    todaysPatientResults.forEach((pr) => {
      if (
        pr.isSelected &&
        !formIncomes.some(
          (fi) =>
            !fi._isManual && // Important: check it's not a manual one with same logic
            fi.patient_result_id === pr.id &&
            !fi._isMarkedForDeletion
        )
      ) {
        newIncomesToAdd.push({
          _tempId: `new_income_pr_${pr.id}_${Date.now()}`,
          patient_result_id: pr.id,
          _patientName: pr.patient?.full_name || "Patient Inconnu",
          _calculatedIncome: pr.calculated_income,
          notes: "",
          _isNew: true,
          _isManual: false, // This is a patient-linked income
        });
      }
    });
    if (newIncomesToAdd.length > 0) {
      setFormIncomes((prev) => [
        ...prev.filter((fi) => !fi._isMarkedForDeletion),
        ...newIncomesToAdd,
      ]);
      sonnerToast.info(
        `${newIncomesToAdd.length} revenu(s) patient ajouté(s).`
      );
    }
  };

  // --- Manual Income Handlers ---
  const handleAddManualIncome = () => {
    setFormIncomes((prevIncomes) => [
      ...prevIncomes,
      {
        _tempId: `new_income_manual_${Date.now()}`,
        manual_income_name: "",
        manual_income_amount: "", // Start with empty string for input type="number"
        notes: "",
        _isNew: true,
        _isManual: true, // This is a manual income
      },
    ]);
  };

  // --- General Income Handlers (for both patient-linked and manual) ---
  const handleFormIncomeChange = (
    index: number,
    field: keyof FormIncome,
    value: any
  ) => {
    setFormIncomes((prevIncomes) =>
      prevIncomes.map((income, i) => {
        if (i === index) {
          return { ...income, [field]: value };
        }
        return income;
      })
    );
  };

  const handleRemoveFormIncome = (index: number) => {
    const incomeToRemove = formIncomes[index];
    let updatedIncomes = [...formIncomes];

    if (incomeToRemove._isNew) {
      updatedIncomes.splice(index, 1);
    } else {
      updatedIncomes = updatedIncomes.map((inc, i) =>
        i === index ? { ...inc, _isMarkedForDeletion: true } : inc
      );
    }
    setFormIncomes(updatedIncomes);

    // If it was a patient-result-linked income, uncheck it from the selection list
    if (!incomeToRemove._isManual && incomeToRemove.patient_result_id) {
      setTodaysPatientResults((prevResults) =>
        prevResults.map((pr) =>
          pr.id === incomeToRemove.patient_result_id
            ? { ...pr, isSelected: false }
            : pr
        )
      );
    }
  };

  // --- Ristourne (Expense) Selection ---
  const handleRistourneSelectionChange = (id: string) => {
    setTodaysRistournes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isSelected: !r.isSelected } : r))
    );
  };
  const handleSelectAllRistournes = (checked: boolean) => {
    setTodaysRistournes((prev) =>
      prev.map((r) => ({ ...r, isSelected: checked }))
    );
  };
  const handleAddSelectedRistournesToExpenses = () => {
    const newExpensesToAdd: FormExpense[] = [];
    const currentDate = new Date().toISOString().split("T")[0];

    todaysRistournes.forEach((r) => {
      if (
        r.isSelected &&
        !formExpenses.some(
          (fe) => fe._sourceRistourneId === r.id && !fe._isMarkedForDeletion
        )
      ) {
        newExpensesToAdd.push({
          _tempId: `new_expense_ristourne_${r.id}_${Date.now()}`,
          name: `Ristourne de ${r.doctor?.full_name || "Docteur Inconnu"}`,
          price: r.total_fee || 0,
          expense_date: currentDate,
          notes: `Ristourne ID: ${r.id}`,
          _isNew: true,
          _sourceRistourneId: r.id,
        });
      }
    });

    if (newExpensesToAdd.length > 0) {
      setFormExpenses((prev) => [
        ...prev.filter((fe) => !fe._isMarkedForDeletion),
        ...newExpensesToAdd,
      ]);
      sonnerToast.info(
        `${newExpensesToAdd.length} ristourne(s) ajoutée(s) aux dépenses.`
      );
    }
  };

  // --- General Expense Handlers ---
  const handleAddManualExpense = () => {
    setFormExpenses((prevExpenses) => [
      ...prevExpenses,
      {
        _tempId: `new_expense_manual_${Date.now()}`,
        name: "",
        price: "", // Start with empty string
        expense_date: todayIsoDate,
        notes: "",
        _isNew: true,
      },
    ]);
  };
  const handleExpenseChange = (
    index: number,
    field: keyof FormExpense,
    value: any
  ) => {
    setFormExpenses((prevExpenses) =>
      prevExpenses.map((expense, i) => {
        if (i === index) {
          return { ...expense, [field]: value };
        }
        return expense;
      })
    );
  };
  const handleRemoveExpense = (index: number) => {
    const expenseToRemove = formExpenses[index];
    let updatedExpenses = [...formExpenses];

    if (expenseToRemove._isNew) {
      updatedExpenses.splice(index, 1);
    } else {
      updatedExpenses = updatedExpenses.map((exp, i) =>
        i === index ? { ...exp, _isMarkedForDeletion: true } : exp
      );
    }
    setFormExpenses(updatedExpenses);

    if (expenseToRemove._sourceRistourneId) {
      setTodaysRistournes((prevRistournes) =>
        prevRistournes.map((r) =>
          r.id === expenseToRemove._sourceRistourneId
            ? { ...r, isSelected: false }
            : r
        )
      );
    }
  };

  // --- Save Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (!agentId || !recordDate) {
      sonnerToast.error("Champs Requis", {
        description: "Veuillez sélectionner un agent et une date.",
      });
      setSaving(false);
      return;
    }
    const activeIncomes = formIncomes.filter((i) => !i._isMarkedForDeletion);
    const activeExpenses = formExpenses.filter(
      (ex) => !ex._isMarkedForDeletion
    );

    if (activeIncomes.length === 0 && activeExpenses.length === 0) {
      sonnerToast.warning("Fiche Vide", {
        description: "Ajoutez au moins un revenu ou une dépense.",
      });
      setSaving(false);
      return;
    }

    // Validation for incomes
    for (const inc of activeIncomes) {
      if (inc._isManual) {
        if (
          !inc.manual_income_name?.trim() ||
          Number.isNaN(parseFloat(String(inc.manual_income_amount))) ||
          parseFloat(String(inc.manual_income_amount)) <= 0
        ) {
          sonnerToast.error("Revenu Manuel Invalide", {
            description: `Veuillez vérifier le nom et le montant du revenu manuel: "${
              inc.manual_income_name || "Nouveau Revenu Manuel"
            }". Le montant doit être positif.`,
          });
          setSaving(false);
          return;
        }
      } else if (!inc.patient_result_id) {
        sonnerToast.error("Revenu Patient Invalide", {
          description:
            "Un revenu lié à un patient est incorrect (ID patient manquant).",
        });
        setSaving(false);
        return;
      }
    }

    // Validation for expenses
    for (const exp of activeExpenses) {
      if (
        !exp.name?.trim() ||
        Number.isNaN(parseFloat(String(exp.price))) ||
        parseFloat(String(exp.price)) < 0 // Allow 0 for expenses if needed, or change to <= 0
      ) {
        sonnerToast.error("Dépense Invalide", {
          description: `Vérifiez le nom et le montant de la dépense: "${
            exp.name || "Nouvelle Dépense"
          }". Le montant ne peut être négatif.`,
        });
        setSaving(false);
        return;
      }
    }

    try {
      let currentRecordId = recordId;
      const recordPayload = {
        agent_id: agentId,
        record_date: recordDate.toISOString().split("T")[0],
        notes: mainNotes.trim() || null, // For the main record
      };

      if (isEditing && currentRecordId) {
        const { error } = await supabase
          .from("income_expense_records")
          .update(recordPayload)
          .eq("id", currentRecordId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("income_expense_records")
          .insert(recordPayload)
          .select("id")
          .single();
        if (error) throw error;
        if (!data) throw new Error("Échec de la création de la fiche.");
        currentRecordId = data.id;
      }
      if (!currentRecordId)
        throw new Error(
          "ID de fiche principal manquant après création/mise à jour."
        );

      // Income Operations
      const incomeOps = formIncomes.map((income) => {
        if (income._isMarkedForDeletion && income.id) {
          return supabase.from("incomes").delete().eq("id", income.id);
        } else if (!income._isMarkedForDeletion) {
          let incomeData: IncomeInsert;
          if (income._isManual) {
            incomeData = {
              income_expense_record_id: currentRecordId!,
              patient_result_id: null,
              manual_income_name:
                income.manual_income_name?.trim() || "Revenu Manuel",
              manual_income_amount:
                parseFloat(String(income.manual_income_amount)) || 0,
              notes: income.notes?.trim() || null,
            };
          } else if (income.patient_result_id) {
            incomeData = {
              income_expense_record_id: currentRecordId!,
              patient_result_id: income.patient_result_id,
              manual_income_name: null,
              manual_income_amount: null,
              notes: income.notes?.trim() || null,
            };
          } else {
            // This case should be caught by validation, but as a safeguard:
            console.warn("Skipping invalid income item:", income);
            return Promise.resolve({
              data: null,
              error: { message: "Invalid income item structure" } as any,
            });
          }

          if (income.id && !income._isNew) {
            return supabase
              .from("incomes")
              .update(incomeData)
              .eq("id", income.id);
          } else if (income._isNew) {
            return supabase.from("incomes").insert(incomeData);
          }
        }
        return Promise.resolve({ data: null, error: null });
      });

      // Expense Operations
      const expenseOps = formExpenses.map((ex) => {
        if (ex._isMarkedForDeletion && ex.id) {
          return supabase.from("expenses").delete().eq("id", ex.id);
        } else if (!ex._isMarkedForDeletion && ex.name?.trim()) {
          const expenseData: ExpenseInsert = {
            income_expense_record_id: currentRecordId!,
            name: ex.name.trim(),
            price: parseFloat(String(ex.price)) || 0,
            expense_date: ex.expense_date, // Already a string in 'YYYY-MM-DD'
            notes: ex.notes?.trim() || null,
          };
          if (ex.id && !ex._isNew) {
            return supabase
              .from("expenses")
              .update(expenseData)
              .eq("id", ex.id);
          } else if (ex._isNew) {
            return supabase.from("expenses").insert(expenseData);
          }
        }
        return Promise.resolve({ data: null, error: null });
      });

      const results = await Promise.all(
        [...incomeOps, ...expenseOps].filter(
          (op) => op !== null && op !== undefined
        ) // Filter out undefined promises
      );

      let opError = false;
      results.forEach((r) => {
        if (r && r.error) {
          console.error("Erreur opération BDD:", r.error);
          opError = true;
        }
      });

      if (opError) {
        sonnerToast.warning(
          "Certaines opérations ont échoué lors de la sauvegarde des détails.",
          {
            description: "Veuillez vérifier la console pour les erreurs.",
          }
        );
      } else {
        sonnerToast.success("Fiche Enregistrée avec succès!");
        navigate("/gestion-depenses");
      }
    } catch (error: any) {
      console.error("Erreur d'enregistrement globale:", error);
      sonnerToast.error("Erreur d'Enregistrement", {
        description: error.message || "Une erreur inattendue est survenue.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="container mx-auto p-8 text-center">
        Chargement des données...
      </div>
    );

  const allPatientResultsSelected =
    todaysPatientResults.length > 0 &&
    todaysPatientResults.every((pr) => pr.isSelected);
  const somePatientResultsSelected = todaysPatientResults.some(
    (pr) => pr.isSelected
  );
  const allRistournesSelected =
    todaysRistournes.length > 0 && todaysRistournes.every((r) => r.isSelected);
  const someRistournesSelected = todaysRistournes.some((r) => r.isSelected);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <form onSubmit={handleSubmit}>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">
              {isEditing
                ? "Modifier Fiche Revenus/Dépenses"
                : "Créer Fiche Revenus/Dépenses"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="agent">
                  Agent <span className="text-red-500">*</span>
                </Label>
                <Select value={agentId} onValueChange={setAgentId} required>
                  <SelectTrigger id="agent" className="w-full">
                    <SelectValue placeholder="Sélectionner un agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} {a.code ? `(${a.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="recordDate">
                  Date de la Fiche <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  id="recordDate"
                  className="w-full"
                  value={
                    recordDate ? recordDate.toISOString().split("T")[0] : ""
                  }
                  onChange={(e) =>
                    setRecordDate(
                      e.target.value ? new Date(e.target.value) : undefined
                    )
                  }
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="mainNotes">Notes</Label>
              <Textarea // Changed from Textarea for consistency if it's just an amount or short note
                id="mainNotes"
                value={mainNotes}
                onChange={(e) => setMainNotes(e.target.value)}
                placeholder="Ex: note générale..."
              />
            </div>
            <Separator className="my-8" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Incomes Section - Left */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold flex items-center">
                  <ListChecks className="mr-2 h-6 w-6 text-green-600" />{" "}
                  Sélection Revenus (Résultats Patients)
                </h3>
                {todaysPatientResults.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Aucun résultat patient pour la période sélectionnée.
                  </p>
                )}
                {todaysPatientResults.length > 0 && (
                  <>
                    <div className="flex items-center space-x-2 border p-2 rounded-md bg-slate-50">
                      <Checkbox
                        id="select-all-prs"
                        checked={allPatientResultsSelected}
                        onCheckedChange={(c) =>
                          handleSelectAllPatientResults(Boolean(c))
                        }
                      />
                      <Label htmlFor="select-all-prs" className="font-medium">
                        {allPatientResultsSelected
                          ? "Désélectionner Tout"
                          : "Sélectionner Tout"}{" "}
                        (
                        {
                          todaysPatientResults.filter((pr) => pr.isSelected)
                            .length
                        }
                        /{todaysPatientResults.length})
                      </Label>
                    </div>
                    <ScrollArea className=" w-full rounded-md border p-2 bg-slate-50">
                      <div className="space-y-2">
                        {todaysPatientResults.map((pr) => (
                          <div
                            key={pr.id}
                            className="flex items-center justify-between p-2 rounded hover:bg-slate-100"
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`pr-${pr.id}`}
                                checked={!!pr.isSelected}
                                onCheckedChange={() =>
                                  handlePatientResultSelectionChange(pr.id)
                                }
                              />
                              <Label
                                htmlFor={`pr-${pr.id}`}
                                className="text-sm cursor-pointer"
                              >
                                {extractId(pr.patient?.patient_unique_id)} -{" "}
                                {pr.patient?.full_name || "Patient Inconnu"}
                              </Label>
                            </div>
                            <span className="text-sm font-medium text-green-700">
                              {pr.calculated_income.toLocaleString("fr-FR")} XOF
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <Button
                      type="button"
                      onClick={handleAddSelectedPatientResultsToIncomes}
                      disabled={!somePatientResultsSelected}
                      className="w-full"
                    >
                      <UserPlus className="mr-2 h-4 w-4" /> Ajouter Sélection
                      Patient aux Revenus
                    </Button>
                  </>
                )}

                <Separator />
                <h4 className="text-lg font-medium">
                  Revenus Ajoutés à la Fiche
                </h4>
                {formIncomes.filter((inc) => !inc._isMarkedForDeletion)
                  .length === 0 && (
                  <p className="text-sm text-gray-500">Aucun revenu ajouté.</p>
                )}
                <div className="space-y-3  overflow-y-auto pr-2">
                  {formIncomes.map(
                    (income, index) =>
                      !income._isMarkedForDeletion && (
                        <Card
                          key={income.id || income._tempId}
                          className="p-3 bg-green-50 border-green-200 shadow-sm"
                        >
                          {income._isManual ? (
                            // Manual Income Form Fields
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <p className="text-sm font-semibold text-green-800">
                                  Revenu Manuel
                                </p>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:bg-red-100 h-7 w-7"
                                  onClick={() => handleRemoveFormIncome(index)}
                                  title="Supprimer ce revenu manuel"
                                >
                                  <RadixTrashIcon className="h-4 w-4" />
                                </Button>
                              </div>
                              <div>
                                <Label
                                  htmlFor={`manual-income-name-${index}`}
                                  className="text-xs"
                                >
                                  Description{" "}
                                  <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id={`manual-income-name-${index}`}
                                  value={income.manual_income_name || ""}
                                  onChange={(e) =>
                                    handleFormIncomeChange(
                                      index,
                                      "manual_income_name",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Ex: Vente produit X, Service Y"
                                  required
                                  className="text-sm h-9"
                                />
                              </div>
                              <div>
                                <Label
                                  htmlFor={`manual-income-amount-${index}`}
                                  className="text-xs"
                                >
                                  Montant (XOF){" "}
                                  <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id={`manual-income-amount-${index}`}
                                  type="number"
                                  value={income.manual_income_amount || ""}
                                  onChange={(e) =>
                                    handleFormIncomeChange(
                                      index,
                                      "manual_income_amount",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0.00"
                                  required
                                  step="any"
                                  min="0"
                                  className="text-sm h-9"
                                />
                              </div>
                            </div>
                          ) : (
                            // Patient-Result Linked Income Display
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm text-green-800">
                                  {income._patientName}
                                </p>
                                <p className="text-xs text-green-600">
                                  {(
                                    income._calculatedIncome ?? 0
                                  ).toLocaleString("fr-FR")}{" "}
                                  XOF (Automatique)
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:bg-red-100 h-7 w-7"
                                onClick={() => handleRemoveFormIncome(index)}
                                title="Supprimer ce revenu patient"
                              >
                                <RadixTrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {/* Common Notes field for both types of income */}
                          <div className="mt-2">
                            <Label
                              htmlFor={`income-notes-${index}`}
                              className="text-xs"
                            >
                              Notes (Revenu)
                            </Label>
                            <Input
                              id={`income-notes-${index}`}
                              className="mt-1 text-xs h-8"
                              value={income.notes || ""}
                              onChange={(e) =>
                                handleFormIncomeChange(
                                  index,
                                  "notes",
                                  e.target.value
                                )
                              }
                              placeholder="Notes additionnelles pour ce revenu"
                            />
                          </div>
                        </Card>
                      )
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddManualIncome}
                  className="w-full"
                >
                  <FilePlus2 className="mr-2 h-4 w-4" /> Ajouter un Revenu
                  Manuel à la Fiche
                </Button>
              </div>

              {/* Expenses Section - Right */}
              <div className="space-y-6">
                <h3 className="text-xl font-semibold flex items-center">
                  <DollarSign className="mr-2 h-6 w-6 text-orange-600" />{" "}
                  Sélection Ristournes (Du Jour)
                </h3>
                {todaysRistournes.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Aucune ristourne trouvée pour la période.
                  </p>
                )}
                {todaysRistournes.length > 0 && (
                  <>
                    <div className="flex items-center space-x-2 border p-2 rounded-md bg-slate-50">
                      <Checkbox
                        id="select-all-ristournes"
                        checked={allRistournesSelected}
                        onCheckedChange={(c) =>
                          handleSelectAllRistournes(Boolean(c))
                        }
                      />
                      <Label
                        htmlFor="select-all-ristournes"
                        className="font-medium"
                      >
                        {allRistournesSelected
                          ? "Désélectionner Tout"
                          : "Sélectionner Tout"}{" "}
                        ({todaysRistournes.filter((r) => r.isSelected).length}/
                        {todaysRistournes.length})
                      </Label>
                    </div>
                    <ScrollArea className=" w-full rounded-md border p-2 bg-slate-50">
                      <div className="space-y-2">
                        {todaysRistournes.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between p-2 rounded hover:bg-slate-100"
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={`ristourne-${r.id}`}
                                checked={!!r.isSelected}
                                onCheckedChange={() =>
                                  handleRistourneSelectionChange(r.id)
                                }
                              />
                              <Label
                                htmlFor={`ristourne-${r.id}`}
                                className="text-sm cursor-pointer"
                              >
                                Dr. {r.doctor?.full_name || "Inconnu"}
                              </Label>
                            </div>
                            <span className="text-sm font-medium text-orange-700">
                              {(r.total_fee || 0).toLocaleString("fr-FR")} XOF
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <Button
                      type="button"
                      onClick={handleAddSelectedRistournesToExpenses}
                      disabled={!someRistournesSelected}
                      className="w-full"
                    >
                      <UserMinus className="mr-2 h-4 w-4" /> Ajouter Sélection
                      Ristourne aux Dépenses
                    </Button>
                  </>
                )}
                <Separator />

                <h4 className="text-lg font-medium flex items-center">
                  <ClipboardPaste className="mr-2 h-5 w-5 text-red-600" />{" "}
                  Dépenses Ajoutées/Manuelles
                </h4>
                {formExpenses.filter((exp) => !exp._isMarkedForDeletion)
                  .length === 0 && (
                  <p className="text-sm text-gray-500 mb-4">
                    Aucune dépense ajoutée.
                  </p>
                )}
                <div className="space-y-4  overflow-y-auto pr-2">
                  {formExpenses.map(
                    (expense, index) =>
                      !expense._isMarkedForDeletion && (
                        <Card
                          key={expense.id || expense._tempId}
                          className="p-4 bg-red-50 border-red-200 shadow-sm"
                        >
                          <div className="grid grid-cols-1 gap-3">
                            <div className="flex justify-between items-center">
                              <Label
                                htmlFor={`exp-name-${index}`}
                                className="text-sm font-medium text-red-800"
                              >
                                Nom Dépense{" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:bg-red-100 h-7 w-7"
                                onClick={() => handleRemoveExpense(index)}
                                title="Supprimer cette dépense"
                              >
                                <RadixTrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                            <Input
                              id={`exp-name-${index}`}
                              value={expense.name}
                              onChange={(e) =>
                                handleExpenseChange(
                                  index,
                                  "name",
                                  e.target.value
                                )
                              }
                              placeholder="Ex: Achat de fournitures"
                              required
                              disabled={!!expense._sourceRistourneId}
                              className="text-sm h-9"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label
                                  htmlFor={`exp-price-${index}`}
                                  className="text-xs"
                                >
                                  Montant (XOF){" "}
                                  <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id={`exp-price-${index}`}
                                  type="number"
                                  value={expense.price}
                                  onChange={(e) =>
                                    handleExpenseChange(
                                      index,
                                      "price",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0.00"
                                  required
                                  step="any"
                                  min="0"
                                  disabled={!!expense._sourceRistourneId}
                                  className="text-sm h-9"
                                />
                              </div>
                              <div>
                                <Label
                                  htmlFor={`exp-date-${index}`}
                                  className="text-xs"
                                >
                                  Date <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id={`exp-date-${index}`}
                                  type="date"
                                  value={expense.expense_date}
                                  onChange={(e) =>
                                    handleExpenseChange(
                                      index,
                                      "expense_date",
                                      e.target.value
                                    )
                                  }
                                  required
                                  className="text-sm h-9"
                                />
                              </div>
                            </div>
                            <div>
                              <Label
                                htmlFor={`exp-notes-${index}`}
                                className="text-xs"
                              >
                                Notes (Dépense)
                              </Label>
                              <Input
                                id={`exp-notes-${index}`}
                                value={expense.notes || ""}
                                onChange={(e) =>
                                  handleExpenseChange(
                                    index,
                                    "notes",
                                    e.target.value
                                  )
                                }
                                placeholder="Notes optionnelles pour cette dépense"
                                className="text-xs h-8"
                              />
                            </div>
                          </div>
                        </Card>
                      )
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddManualExpense}
                  className="w-full"
                >
                  <PlusIcon className="mr-2 h-4 w-4" /> Ajouter Dépense Manuelle
                  à la Fiche
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/gestion-depenses")}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              <Cross2Icon className="mr-2 h-4 w-4" /> Annuler
            </Button>
            <Button
              type="submit"
              disabled={saving || loading}
              className="w-full sm:w-auto"
            >
              <CheckIcon className="mr-2 h-4 w-4" />
              {saving
                ? "Enregistrement..."
                : isEditing
                ? "Mettre à jour la Fiche"
                : "Enregistrer la Fiche"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
