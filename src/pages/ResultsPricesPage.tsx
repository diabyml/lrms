// ResultsPricesPage
// src/components/app/bilans/BilanPrixRestantsPage.tsx
// import { useEffect, useState, useCallback } from "react";
// import { supabase } from "@/lib/supabaseClient"; // Adjust path as needed
// import { Database } from "@/lib/database.types"; // Adjust path as needed
// import { toast as sonnerToast } from "sonner";

// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Checkbox } from "@/components/ui/checkbox";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
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
// import {
//   Loader2,
//   Search,
//   FilterX,
//   RefreshCw,
//   FileWarning,
//   CalendarDays,
//   UserMd /* Or Stethoscope or another suitable icon */,
// } from "lucide-react"; // UserMd for doctor

// type PatientResultRow =
//   Database["public"]["Tables"]["patient_result"]["Row"] & {
//     patient: {
//       full_name: string | null;
//       patient_unique_id: string | null;
//     } | null;
//     doctor: { full_name: string | null } | null; // Doctor info is already part of the type
//   };

// type Doctor = Pick<
//   Database["public"]["Tables"]["doctor"]["Row"],
//   "id" | "full_name"
// >;

// const CURRENCY_SYMBOL = "FCFA";

// const formatCurrency = (amount: number | string | null | undefined) => {
//   const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
//   if (numAmount === null || numAmount === undefined || isNaN(numAmount))
//     return "-";
//   return `${numAmount.toLocaleString("fr-FR")} ${CURRENCY_SYMBOL}`;
// };

// const formatDate = (dateString: string | null | undefined) => {
//   if (!dateString) return "N/A";
//   try {
//     return new Date(dateString).toLocaleDateString("fr-FR", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//     });
//   } catch (e) {
//     return "Date invalide";
//   }
// };

// export default function ResultsPricesPage() {
//   const [results, setResults] = useState<PatientResultRow[]>([]);
//   const [doctors, setDoctors] = useState<Doctor[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const [searchTerm, setSearchTerm] = useState("");
//   const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>(
//     undefined
//   );
//   const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(true);

//   const [showPayDialog, setShowPayDialog] = useState(false);
//   const [selectedResultForPayment, setSelectedResultForPayment] =
//     useState<PatientResultRow | null>(null);
//   const [paying, setPaying] = useState(false);

//   const fetchDoctors = useCallback(async () => {
//     const { data, error: doctorError } = await supabase
//       .from("doctor")
//       .select("id, full_name")
//       .order("full_name");

//     if (doctorError) {
//       console.error("Erreur lors du chargement des médecins:", doctorError);
//       sonnerToast.error("Erreur de chargement des médecins", {
//         description: doctorError.message,
//       });
//     } else {
//       setDoctors(data || []);
//     }
//   }, []);

//   const fetchData = useCallback(async () => {
//     setLoading(true);
//     setError(null);

//     const selectString = `
//         id,
//         patient_id,
//         doctor_id,
//         result_date,
//         normal_price,
//         insurance_price,
//         unpaid_amount,
//         paid_status,
//         created_at,
//         patient!inner(
//           full_name,
//           patient_unique_id
//         ),
//         doctor:doctor_id (full_name)
//       `;
//     // doctor:doctor_id (full_name) is already here for fetching doctor name

//     let query = supabase
//       .from("patient_result")
//       .select(selectString.replace(/\s+/g, " ").trim())
//       .order("created_at", { ascending: false });

//     if (showOnlyUnpaid) {
//       query = query.gt("unpaid_amount", 0);
//     }

//     const trimmedSearchTerm = searchTerm.trim();
//     if (trimmedSearchTerm !== "") {
//       const searchPatternForPostgREST = `*${trimmedSearchTerm}*`;
//       query = query.or(
//         `full_name.ilike.${searchPatternForPostgREST},patient_unique_id.ilike.${searchPatternForPostgREST}`,
//         { foreignTable: "patient" }
//       );
//     }

//     if (selectedDoctorId && selectedDoctorId !== "ALL_DOCTORS") {
//       query = query.eq("doctor_id", selectedDoctorId);
//     }

//     const { data, error: fetchError } = await query;

//     if (fetchError) {
//       console.error("Erreur de chargement des bilans:", fetchError);
//       setError("Impossible de charger les données. Veuillez réessayer.");
//       sonnerToast.error("Erreur de chargement des bilans", {
//         description: fetchError.message,
//       });
//     } else {
//       setResults((data as PatientResultRow[]) || []);
//     }
//     setLoading(false);
//   }, [searchTerm, selectedDoctorId, showOnlyUnpaid]);

//   useEffect(() => {
//     fetchDoctors();
//   }, [fetchDoctors]);

//   useEffect(() => {
//     const handler = setTimeout(() => {
//       fetchData();
//     }, 300);

//     return () => {
//       clearTimeout(handler);
//     };
//   }, [fetchData]);

//   const handleOpenPayDialog = (result: PatientResultRow) => {
//     setSelectedResultForPayment(result);
//     setShowPayDialog(true);
//   };

//   const handleConfirmPayment = async () => {
//     if (!selectedResultForPayment) return;
//     setPaying(true);
//     const { error: updateError } = await supabase
//       .from("patient_result")
//       .update({ unpaid_amount: 0, paid_status: "paid" })
//       .eq("id", selectedResultForPayment.id);

//     setPaying(false);
//     setShowPayDialog(false);

//     if (updateError) {
//       console.error("Erreur lors de la mise à jour du paiement:", updateError);
//       sonnerToast.error("Erreur de paiement", {
//         description: `Le paiement n'a pas pu être enregistré: ${updateError.message}`,
//       });
//     } else {
//       sonnerToast.success("Paiement enregistré", {
//         description: `Le montant restant pour ${
//           selectedResultForPayment.patient?.full_name || "ce patient"
//         } a été mis à jour.`,
//       });
//       fetchData();
//     }
//     setSelectedResultForPayment(null);
//   };

//   const clearFilters = () => {
//     setSearchTerm("");
//     setSelectedDoctorId(undefined);
//     setShowOnlyUnpaid(true);
//   };

//   return (
//     <div className="container mx-auto p-4 md:p-6 lg:p-8">
//       <h1 className="text-3xl font-bold mb-6 text-gray-800">
//         Bilans - Prix - Restants
//       </h1>

//       {/* --- Filter Section (remains the same) --- */}
//       <div className="mb-6 p-4 border rounded-lg bg-slate-50 shadow">
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
//           <div className="space-y-1">
//             <label
//               htmlFor="searchPatient"
//               className="text-sm font-medium text-gray-700"
//             >
//               Rechercher (Nom, ID Patient)
//             </label>
//             <div className="relative">
//               <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//               <Input
//                 id="searchPatient"
//                 type="text"
//                 placeholder="Nom ou ID patient..."
//                 value={searchTerm}
//                 onChange={(e) => setSearchTerm(e.target.value)}
//                 className="pl-9 bg-white"
//               />
//             </div>
//           </div>

//           <div className="space-y-1">
//             <label
//               htmlFor="doctorFilter"
//               className="text-sm font-medium text-gray-700"
//             >
//               Filtrer par Médecin
//             </label>
//             <Select
//               value={selectedDoctorId || "ALL_DOCTORS"}
//               onValueChange={(value) =>
//                 setSelectedDoctorId(value === "ALL_DOCTORS" ? undefined : value)
//               }
//             >
//               <SelectTrigger id="doctorFilter" className="bg-white">
//                 <SelectValue placeholder="Tous les médecins" />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="ALL_DOCTORS">Tous les médecins</SelectItem>
//                 {doctors.map((doc) => (
//                   <SelectItem key={doc.id} value={doc.id}>
//                     {doc.full_name}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//           </div>

//           <div className="flex items-center space-x-2 pt-5 md:pt-0 md:self-center">
//             <Checkbox
//               id="showUnpaid"
//               checked={showOnlyUnpaid}
//               onCheckedChange={(checked) =>
//                 setShowOnlyUnpaid(checked as boolean)
//               }
//               className="border-gray-400"
//             />
//             <label
//               htmlFor="showUnpaid"
//               className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-700"
//             >
//               Seulement impayés {">"} 0
//             </label>
//           </div>
//           <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 md:items-end">
//             <Button onClick={fetchData} variant="outline" className="w-full">
//               <RefreshCw className="mr-2 h-4 w-4" /> Actualiser
//             </Button>
//             <Button
//               onClick={clearFilters}
//               variant="ghost"
//               className="w-full text-slate-600 hover:text-slate-800"
//             >
//               <FilterX className="mr-2 h-4 w-4" /> Effacer Filtres
//             </Button>
//           </div>
//         </div>
//       </div>

//       {/* --- Loading, Error, No Results States (remain the same) --- */}
//       {loading && (
//         <div className="flex flex-col justify-center items-center py-10 text-slate-600">
//           <Loader2 className="h-12 w-12 animate-spin text-sky-600 mb-3" />
//           <p className="text-lg">Chargement des données...</p>
//         </div>
//       )}
//       {!loading && error && (
//         <div className="text-center py-10 text-red-700 bg-red-50 p-6 rounded-lg shadow border border-red-200">
//           <FileWarning className="h-12 w-12 mx-auto mb-3 text-red-500" />
//           <p className="text-xl font-semibold mb-2">Erreur de chargement</p>
//           <p className="mb-4">{error}</p>
//           <Button onClick={fetchData} variant="destructive">
//             <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
//           </Button>
//         </div>
//       )}
//       {!loading && !error && results.length === 0 && (
//         <div className="text-center py-10 text-slate-500 bg-slate-50 p-6 rounded-lg shadow border border-slate-200">
//           <Search className="h-12 w-12 mx-auto mb-3 text-slate-400" />
//           <p className="text-xl font-semibold mb-2">Aucun résultat</p>
//           <p>Aucun bilan trouvé correspondant à vos critères.</p>
//         </div>
//       )}

//       {!loading && !error && results.length > 0 && (
//         <div className="border rounded-lg overflow-x-auto shadow bg-white">
//           <Table>
//             <TableHeader className="bg-slate-100">
//               <TableRow>
//                 <TableHead className="min-w-[150px] text-slate-700 font-semibold px-4 py-3">
//                   ID Patient
//                 </TableHead>
//                 <TableHead className="min-w-[130px] text-slate-700 font-semibold px-4 py-3">
//                   Date Bilan
//                 </TableHead>
//                 <TableHead className="min-w-[180px] text-slate-700 font-semibold px-4 py-3">
//                   Patient (Nom - Prénom)
//                 </TableHead>
//                 <TableHead className="min-w-[180px] text-slate-700 font-semibold px-4 py-3">
//                   Médecin Prescripteur
//                 </TableHead>{" "}
//                 {/* <-- ADDED HEADER */}
//                 <TableHead className="text-right min-w-[120px] text-slate-700 font-semibold px-4 py-3">
//                   Prix Normal
//                 </TableHead>
//                 <TableHead className="text-right min-w-[120px] text-slate-700 font-semibold px-4 py-3">
//                   Prix Assurance
//                 </TableHead>
//                 <TableHead className="text-right min-w-[120px] text-slate-700 font-semibold px-4 py-3">
//                   Restant
//                 </TableHead>
//                 <TableHead className="text-center min-w-[150px] text-slate-700 font-semibold px-4 py-3">
//                   Action
//                 </TableHead>
//               </TableRow>
//             </TableHeader>
//             <TableBody>
//               {results.map((result) => (
//                 <TableRow
//                   key={result.id}
//                   className="hover:bg-slate-50 border-b border-slate-200 last:border-b-0"
//                 >
//                   <TableCell className="font-medium text-slate-600 px-4 py-3 align-middle">
//                     {result.patient?.patient_unique_id || (
//                       <span className="italic text-slate-400">N/A</span>
//                     )}
//                   </TableCell>
//                   <TableCell className="text-slate-600 px-4 py-3 align-middle">
//                     <div className="flex items-center">
//                       <CalendarDays className="h-4 w-4 mr-2 text-slate-500" />
//                       {formatDate(result.result_date)}
//                     </div>
//                   </TableCell>
//                   <TableCell className="font-medium text-slate-800 px-4 py-3 align-middle">
//                     {result.patient?.full_name || (
//                       <span className="italic text-slate-500">N/A</span>
//                     )}
//                   </TableCell>
//                   <TableCell className="text-slate-700 px-4 py-3 align-middle">
//                     {" "}
//                     {/* <-- ADDED CELL */}
//                     <div className="flex items-center">
//                       {/* <UserMd className="h-4 w-4 mr-2 text-slate-500" /> UserMd might not be in default lucide, use another or omit */}
//                       {result.doctor?.full_name || (
//                         <span className="italic text-slate-500">N/A</span>
//                       )}
//                     </div>
//                   </TableCell>
//                   <TableCell className="text-right text-slate-700 px-4 py-3 align-middle">
//                     {formatCurrency(result.normal_price)}
//                   </TableCell>
//                   <TableCell className="text-right text-slate-700 px-4 py-3 align-middle">
//                     {formatCurrency(result.insurance_price)}
//                   </TableCell>
//                   <TableCell
//                     className={`text-right font-semibold px-4 py-3 align-middle ${
//                       result.unpaid_amount &&
//                       parseFloat(result.unpaid_amount.toString()) > 0
//                         ? "text-red-600"
//                         : "text-green-600"
//                     }`}
//                   >
//                     {formatCurrency(result.unpaid_amount)}
//                   </TableCell>
//                   <TableCell className="text-center px-4 py-3 align-middle">
//                     {result.unpaid_amount &&
//                     parseFloat(result.unpaid_amount.toString()) > 0 ? (
//                       <Button
//                         size="sm"
//                         variant="default"
//                         onClick={() => handleOpenPayDialog(result)}
//                         disabled={
//                           paying && selectedResultForPayment?.id === result.id
//                         }
//                         className="bg-sky-600 hover:bg-sky-700 text-white"
//                       >
//                         {paying &&
//                         selectedResultForPayment?.id === result.id ? (
//                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                         ) : null}
//                         Payer Restant
//                       </Button>
//                     ) : (
//                       <span className="text-sm text-green-600 italic">
//                         Payé
//                       </span>
//                     )}
//                   </TableCell>
//                 </TableRow>
//               ))}
//             </TableBody>
//           </Table>
//         </div>
//       )}

//       {/* --- Payment Dialog (remains the same) --- */}
//       <AlertDialog open={showPayDialog} onOpenChange={setShowPayDialog}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle>Confirmer le Paiement</AlertDialogTitle>
//             <AlertDialogDescription>
//               Voulez-vous vraiment marquer le montant restant de{" "}
//               <span className="font-semibold">
//                 {formatCurrency(selectedResultForPayment?.unpaid_amount)}
//               </span>{" "}
//               pour le patient{" "}
//               <span className="font-semibold">
//                 {selectedResultForPayment?.patient?.full_name || "N/A"}
//               </span>{" "}
//               (ID:{" "}
//               {selectedResultForPayment?.patient?.patient_unique_id || "N/A"})
//               comme payé ?
//               <br />
//               Cela mettra le montant restant à {formatCurrency(0)}.
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel disabled={paying}>Annuler</AlertDialogCancel>
//             <AlertDialogAction
//               onClick={handleConfirmPayment}
//               disabled={paying}
//               className="bg-green-600 hover:bg-green-700"
//             >
//               {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
//               Confirmer le Paiement
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>
//     </div>
//   );
// }

// =============================================================================
// searchable select
// src/components/app/bilans/BilanPrixRestantsPage.tsx
import { useEffect, useState, useCallback, useMemo } from "react"; // Added useMemo
import { supabase } from "@/lib/supabaseClient";
import { Database } from "@/lib/database.types";
import { toast as sonnerToast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
// Remove Select imports if no longer used elsewhere
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select';
import { Combobox } from "@/components/ui/combobox"; // <-- IMPORT OUR NEW COMBOBOX
import {
  Loader2,
  Search,
  FilterX,
  RefreshCw,
  FileWarning,
  CalendarDays,
  UserMd,
} from "lucide-react";
import { extractId } from "@/lib/utils";
import { EditPatientResultDialog } from "@/components/EditPatientResultDialog";

// ... (PatientResultRow, Doctor types, formatCurrency, formatDate remain the same) ...
type PatientResultRow =
  Database["public"]["Tables"]["patient_result"]["Row"] & {
    patient: {
      full_name: string | null;
      patient_unique_id: string | null;
    } | null;
    doctor: { full_name: string | null } | null;
  };

type DoctorOption = { value: string; label: string }; // For combobox

const CURRENCY_SYMBOL = "FCFA";

const formatCurrency = (amount: number | string | null | undefined) => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (numAmount === null || numAmount === undefined || isNaN(numAmount))
    return "-";
  return `${numAmount.toLocaleString("fr-FR")} ${CURRENCY_SYMBOL}`;
};

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return "Date invalide";
  }
};

export default function ResultsPricesPage() {
  const [results, setResults] = useState<PatientResultRow[]>([]);
  const [allDoctors, setAllDoctors] = useState<
    Database["public"]["Tables"]["doctor"]["Row"][]
  >([]); // Store original doctor data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>(
    undefined
  ); // This remains the actual filter value
  const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(false);

  const [showPayDialog, setShowPayDialog] = useState(false);
  const [selectedResultForPayment, setSelectedResultForPayment] =
    useState<PatientResultRow | null>(null);
  const [paying, setPaying] = useState(false);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPatientResult, setSelectedPatientResult] =
    useState<PatientResultRow | null>(null);

  // Memoize doctor options for the combobox
  const doctorOptions = useMemo((): DoctorOption[] => {
    const options = allDoctors.map((doc) => ({
      value: doc.id,
      label: doc.full_name || "Nom Inconnu",
    }));
    // Add "All Doctors" option at the beginning
    return [{ value: "ALL_DOCTORS", label: "Tous les médecins" }, ...options];
  }, [allDoctors]);

  const fetchDoctors = useCallback(async () => {
    const { data, error: doctorError } = await supabase
      .from("doctor")
      .select("id, full_name")
      .order("full_name");

    if (doctorError) {
      console.error("Erreur lors du chargement des médecins:", doctorError);
      sonnerToast.error("Erreur de chargement des médecins", {
        description: doctorError.message,
      });
    } else {
      setAllDoctors(data || []); // Store fetched doctors
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const selectString = `
        id,
        patient_id,
        doctor_id,
        result_date,
        normal_price,
        insurance_price,
        unpaid_amount,
        paid_status,
        created_at,
        patient!inner( 
          full_name,
          patient_unique_id
        ),
        doctor:doctor_id (full_name) 
      `;

    let query = supabase
      .from("patient_result")
      .select(selectString.replace(/\s+/g, " ").trim())
      .order("created_at", { ascending: false });

    if (showOnlyUnpaid) {
      query = query.gt("unpaid_amount", 0);
    }

    const trimmedSearchTerm = searchTerm.trim();
    if (trimmedSearchTerm !== "") {
      const searchPatternForPostgREST = `*${trimmedSearchTerm}*`;
      query = query.or(
        `full_name.ilike.${searchPatternForPostgREST},patient_unique_id.ilike.${searchPatternForPostgREST}`,
        { foreignTable: "patient" }
      );
    }

    // Use selectedDoctorId for filtering. "ALL_DOCTORS" means no doctor filter.
    if (selectedDoctorId && selectedDoctorId !== "ALL_DOCTORS") {
      query = query.eq("doctor_id", selectedDoctorId);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      console.error("Erreur de chargement des bilans:", fetchError);
      setError("Impossible de charger les données. Veuillez réessayer.");
      sonnerToast.error("Erreur de chargement des bilans", {
        description: fetchError.message,
      });
    } else {
      setResults((data as PatientResultRow[]) || []);
    }
    setLoading(false);
  }, [searchTerm, selectedDoctorId, showOnlyUnpaid]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchData();
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [fetchData]);

  const handleOpenPayDialog = (result: PatientResultRow) => {
    setSelectedResultForPayment(result);
    setShowPayDialog(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedResultForPayment) return;
    setPaying(true);
    // ... (payment logic remains the same)
    const { error: updateError } = await supabase
      .from("patient_result")
      .update({ unpaid_amount: 0 })
      .eq("id", selectedResultForPayment.id);

    setPaying(false);
    setShowPayDialog(false);

    if (updateError) {
      console.error("Erreur lors de la mise à jour du paiement:", updateError);
      sonnerToast.error("Erreur de paiement", {
        description: `Le paiement n'a pas pu être enregistré: ${updateError.message}`,
      });
    } else {
      sonnerToast.success("Paiement enregistré", {
        description: `Le montant restant pour ${
          selectedResultForPayment.patient?.full_name || "ce patient"
        } a été mis à jour.`,
      });
      fetchData();
    }
    setSelectedResultForPayment(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedDoctorId(undefined); // This will make Combobox show placeholder
    setShowOnlyUnpaid(true);
  };

  // edit prices dialog handlers
  const handleEdit = (result: PatientResultRow) => {
    setSelectedPatientResult(result);
    setIsEditDialogOpen(true);
  };

  const handleUpdateSuccess = () => {
    // refech this page datas
    // window.location.reload();
    fetchData();
  };

  return (
    <div className="">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Bilans - Prix - Restants
      </h1>

      <div className="mb-6 p-4 border rounded-lg bg-slate-50 shadow">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            {/* <label
              htmlFor="searchPatient"
              className="text-sm font-medium text-gray-700"
            >
              Rechercher (Nom, ID Patient)
            </label> */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="searchPatient"
                type="text"
                placeholder="Nom ou ID patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            {/* <label
              htmlFor="doctorFilter"
              className="text-sm font-medium text-gray-700"
            >
              Filtrer par Médecin
            </label> */}
            <Combobox
              options={doctorOptions}
              value={selectedDoctorId || "ALL_DOCTORS"} // Default to "ALL_DOCTORS" if undefined
              onValueChange={(value) => {
                setSelectedDoctorId(
                  value === "ALL_DOCTORS" ? undefined : value
                );
              }}
              placeholder="Tous les médecins"
              searchPlaceholder="Rechercher un médecin..."
              emptyStateMessage="Aucun médecin trouvé."
              className="bg-white"
              // popoverClassName="w-[300px]" // Example to make popover wider if needed
            />
          </div>

          <div className="flex items-center space-x-2 pt-5 md:pt-0 md:self-center">
            <Checkbox
              id="showUnpaid"
              checked={showOnlyUnpaid}
              onCheckedChange={(checked) =>
                setShowOnlyUnpaid(checked as boolean)
              }
              className="border-gray-400"
            />
            <label
              htmlFor="showUnpaid"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-700"
            >
              Seulement Restants
            </label>
          </div>
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 md:items-end">
            <Button onClick={fetchData} variant="outline" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Actualiser
            </Button>
            <Button
              onClick={clearFilters}
              variant="ghost"
              className="w-full text-slate-600 hover:text-slate-800"
            >
              <FilterX className="mr-2 h-4 w-4" /> Effacer Filtres
            </Button>
          </div>
        </div>
      </div>

      {/* ... Loading, Error, No Results, Table, and AlertDialog sections remain the same as previous version ... */}
      {loading && (
        <div className="flex flex-col justify-center items-center py-10 text-slate-600">
          <Loader2 className="h-12 w-12 animate-spin text-sky-600 mb-3" />
          <p className="text-lg">Chargement des données...</p>
        </div>
      )}
      {!loading && error && (
        <div className="text-center py-10 text-red-700 bg-red-50 p-6 rounded-lg shadow border border-red-200">
          <FileWarning className="h-12 w-12 mx-auto mb-3 text-red-500" />
          <p className="text-xl font-semibold mb-2">Erreur de chargement</p>
          <p className="mb-4">{error}</p>
          <Button onClick={fetchData} variant="destructive">
            <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
          </Button>
        </div>
      )}
      {!loading && !error && results.length === 0 && (
        <div className="text-center py-10 text-slate-500 bg-slate-50 p-6 rounded-lg shadow border border-slate-200">
          <Search className="h-12 w-12 mx-auto mb-3 text-slate-400" />
          <p className="text-xl font-semibold mb-2">Aucun résultat</p>
          <p>Aucun bilan trouvé correspondant à vos critères.</p>
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <div className="border rounded-lg overflow-x-auto shadow bg-white">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead className="min-w-[150px] text-slate-700 font-semibold px-4 py-3">
                  ID Patient
                </TableHead>
                <TableHead className="min-w-[130px] text-slate-700 font-semibold px-4 py-3">
                  Date Bilan
                </TableHead>
                <TableHead className="min-w-[180px] text-slate-700 font-semibold px-4 py-3">
                  Patient (Nom - Prénom)
                </TableHead>
                <TableHead className="min-w-[180px] text-slate-700 font-semibold px-4 py-3">
                  Médecin Prescripteur
                </TableHead>
                <TableHead className="text-right min-w-[120px] text-slate-700 font-semibold px-4 py-3">
                  Prix Normal
                </TableHead>
                <TableHead className="text-right min-w-[120px] text-slate-700 font-semibold px-4 py-3">
                  Prix Assurance
                </TableHead>
                <TableHead className="text-right min-w-[120px] text-slate-700 font-semibold px-4 py-3">
                  Restant
                </TableHead>
                <TableHead className="text-center min-w-[150px] text-slate-700 font-semibold px-4 py-3">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow
                  key={result.id}
                  className="hover:bg-slate-50 border-b border-slate-200 last:border-b-0"
                >
                  <TableCell className="font-medium text-slate-600 px-4 py-3 align-middle">
                    {extractId(result.patient?.patient_unique_id) || (
                      <span className="italic text-slate-400">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600 px-4 py-3 align-middle">
                    <div className="flex items-center">
                      <CalendarDays className="h-4 w-4 mr-2 text-slate-500" />
                      {formatDate(result.result_date)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-slate-800 px-4 py-3 align-middle">
                    {result.patient?.full_name || (
                      <span className="italic text-slate-500">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-700 px-4 py-3 align-middle">
                    <div className="flex items-center">
                      {/* <UserMd className="h-4 w-4 mr-2 text-slate-500" /> Consider an icon */}
                      {result.doctor?.full_name || (
                        <span className="italic text-slate-500">N/A</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-slate-700 px-4 py-3 align-middle">
                    {formatCurrency(result.normal_price)}
                  </TableCell>
                  <TableCell className="text-right text-slate-700 px-4 py-3 align-middle">
                    {formatCurrency(result.insurance_price)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold px-4 py-3 align-middle ${
                      result.unpaid_amount &&
                      parseFloat(result.unpaid_amount.toString()) > 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                    onClick={() => handleEdit(result)}
                  >
                    {formatCurrency(result.unpaid_amount)}
                  </TableCell>
                  <TableCell className="text-center px-4 py-3 align-middle">
                    {result.unpaid_amount &&
                    parseFloat(result.unpaid_amount.toString()) > 0 ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleOpenPayDialog(result)}
                        disabled={
                          paying && selectedResultForPayment?.id === result.id
                        }
                        className="bg-sky-600 hover:bg-sky-700 text-white"
                      >
                        {paying &&
                        selectedResultForPayment?.id === result.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Payer Restant
                      </Button>
                    ) : (
                      <span className="text-sm text-green-600 italic">
                        Payé
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le Paiement</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment marquer le montant restant de{" "}
              <span className="font-semibold">
                {formatCurrency(selectedResultForPayment?.unpaid_amount)}
              </span>{" "}
              pour le patient{" "}
              <span className="font-semibold">
                {selectedResultForPayment?.patient?.full_name || "N/A"}
              </span>{" "}
              (ID:{" "}
              {extractId(
                selectedResultForPayment?.patient?.patient_unique_id || ""
              ) || "N/A"}
              ) comme payé ?
              <br />
              Cela mettra le montant restant à {formatCurrency(0)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paying}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPayment}
              disabled={paying}
              className="bg-green-600 hover:bg-green-700"
            >
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer le Paiement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditPatientResultDialog
        open={isEditDialogOpen}
        setOpen={setIsEditDialogOpen}
        patientResult={selectedPatientResult}
        onUpdateSuccess={handleUpdateSuccess}
      />
    </div>
  );
}
