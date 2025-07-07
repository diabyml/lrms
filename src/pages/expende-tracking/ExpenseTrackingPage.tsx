// // src/pages/GestionDepensesPage.tsx (or your preferred location)

// import React, { useState, useEffect, useCallback } from "react";
// import { useNavigate } from "react-router-dom"; // Changed for Vite/React Router
// import { supabase } from "@/lib/supabaseClient"; // Adjust path as needed
// import { Database } from "@/lib/database.types"; // Adjust path as needed

// import { Button } from "@/components/ui/button";
// import {
//   Table,
//   TableHeader,
//   TableBody,
//   TableRow,
//   TableHead,
//   TableCell,
//   TableCaption,
// } from "@/components/ui/table";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import {
//   PlusCircledIcon,
//   Pencil2Icon,
//   EyeOpenIcon,
//   ChevronLeftIcon,
//   ChevronRightIcon,
//   // UsersIcon, // Example icon for the title
// } from "@radix-ui/react-icons"; // Or use lucide-react

// // Types (ensure these match your Supabase view/tables and generated types)
// type Agent = Database["public"]["Tables"]["agents"]["Row"]; // Assumes 'code' is part of the Row type
// type IncomeExpenseRecordSummary =
//   Database["public"]["Views"]["income_expense_record_summary"]["Row"];

// const ITEMS_PER_PAGE = 10;

// export default function GestionDepensesPage() {
//   const navigate = useNavigate(); // Changed for Vite/React Router
//   const [records, setRecords] = useState<IncomeExpenseRecordSummary[]>([]);
//   const [agents, setAgents] = useState<Agent[]>([]);
//   const [selectedAgentId, setSelectedAgentId] = useState<string | "all">("all");
//   const [currentPage, setCurrentPage] = useState(1);
//   const [totalCount, setTotalCount] = useState(0);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const fetchAgents = useCallback(async () => {
//     // Ensure your 'agents' table or select query includes 'code' if you display it
//     const { data, error } = await supabase
//       .from("agents")
//       .select("id, name, code");
//     if (error) {
//       console.error("Error fetching agents:", error);
//       setError("Impossible de charger les agents.");
//     } else {
//       setAgents(data || []);
//     }
//   }, []);

//   const fetchIncomeExpenseRecords = useCallback(async () => {
//     setLoading(true);
//     setError(null);

//     const from = (currentPage - 1) * ITEMS_PER_PAGE;
//     const to = from + ITEMS_PER_PAGE - 1;

//     // Query the VIEW (income_expense_record_summary)
//     let query = supabase
//       .from("income_expense_record_summary")
//       .select("*", { count: "exact" })
//       .order("record_date", { ascending: false })
//       .range(from, to);

//     if (selectedAgentId !== "all") {
//       query = query.eq("agent_id", selectedAgentId);
//     }

//     const { data, error: queryError, count } = await query;

//     if (queryError) {
//       console.error("Error fetching income/expense records:", queryError);
//       setError("Impossible de charger les fiches de revenus/dépenses.");
//       setRecords([]);
//     } else {
//       setRecords(data || []);
//       setTotalCount(count || 0);
//     }
//     setLoading(false);
//   }, [currentPage, selectedAgentId]);

//   useEffect(() => {
//     fetchAgents();
//   }, [fetchAgents]);

//   useEffect(() => {
//     fetchIncomeExpenseRecords();
//   }, [fetchIncomeExpenseRecords]);

//   const handleCreateNewRecord = () => {
//     navigate("/gestion-depenses/creer"); // Changed
//   };

//   const handleViewDetails = (recordId: string | undefined) => {
//     if (recordId) navigate(`/gestion-depenses/${recordId}`); // Changed
//   };

//   const handleModifyRecord = (recordId: string | undefined) => {
//     if (recordId) navigate(`/gestion-depenses/${recordId}/modifier`); // Changed
//   };

//   const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

//   return (
//     <div className="container mx-auto p-4 md:p-8 bg-gray-50 min-h-screen">
//       <Card className="shadow-lg">
//         <CardHeader className="border-b">
//           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
//             <div className="flex items-center space-x-3">
//               {/* <UsersIcon className="h-8 w-8 text-primary" /> */}
//               <CardTitle className="text-3xl font-bold text-gray-800">
//                 Gestion des Dépenses
//               </CardTitle>
//             </div>
//             <Button onClick={handleCreateNewRecord} size="lg">
//               <PlusCircledIcon className="mr-2 h-5 w-5" />
//               Créer une Fiche
//             </Button>
//           </div>
//         </CardHeader>
//         <CardContent className="pt-6">
//           <div className="mb-6">
//             <Select
//               value={selectedAgentId}
//               onValueChange={(value) => {
//                 setSelectedAgentId(value);
//                 setCurrentPage(1); // Reset to first page on filter change
//               }}
//             >
//               <SelectTrigger className="w-full sm:w-[280px] text-base py-3">
//                 <SelectValue placeholder="Filtrer par agent..." />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="all">Tous les agents</SelectItem>
//                 {agents.map((agent) => (
//                   <SelectItem key={agent.id} value={agent.id}>
//                     {agent.name}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//           </div>

//           {loading && <p className="text-center py-4">Chargement...</p>}
//           {error && <p className="text-center text-red-500 py-4">{error}</p>}

//           {!loading && !error && records.length === 0 && (
//             <p className="text-center text-gray-600 py-4">
//               Aucune fiche de revenus/dépenses trouvée.
//             </p>
//           )}

//           {!loading && !error && records.length > 0 && (
//             <>
//               <div className="overflow-x-auto">
//                 <Table>
//                   <TableCaption className="py-4">
//                     Page {currentPage} sur {totalPages > 0 ? totalPages : 1} (
//                     {totalCount} fiches au total)
//                   </TableCaption>
//                   <TableHeader>
//                     <TableRow className="bg-gray-100">
//                       <TableHead className="w-[150px] font-semibold text-gray-700">
//                         Date
//                       </TableHead>
//                       <TableHead className="font-semibold text-gray-700">
//                         Agent
//                       </TableHead>
//                       <TableHead className="text-right font-semibold text-gray-700">
//                         Total Revenus
//                       </TableHead>
//                       <TableHead className="text-right font-semibold text-gray-700">
//                         Total Dépenses
//                       </TableHead>
//                       <TableHead className="text-center font-semibold text-gray-700">
//                         Actions
//                       </TableHead>
//                     </TableRow>
//                   </TableHeader>
//                   <TableBody>
//                     {records.map((record) => (
//                       <TableRow key={record.id} className="hover:bg-gray-50">
//                         <TableCell>
//                           {record.record_date
//                             ? new Date(record.record_date).toLocaleDateString(
//                                 "fr-FR"
//                               )
//                             : "N/A"}
//                         </TableCell>
//                         <TableCell>{record.agent_name || "N/A"}</TableCell>
//                         <TableCell className="text-right text-green-600 font-medium">
//                           {record.total_income?.toLocaleString("fr-FR", {
//                             style: "currency",
//                             currency: "XOF",
//                           }) ?? "0 CFA"}
//                         </TableCell>
//                         <TableCell className="text-right text-red-600 font-medium">
//                           {record.total_expense?.toLocaleString("fr-FR", {
//                             style: "currency",
//                             currency: "XOF",
//                           }) ?? "0 CFA"}
//                         </TableCell>
//                         <TableCell className="text-center">
//                           <div className="flex justify-center space-x-2">
//                             <Button
//                               variant="outline"
//                               size="sm"
//                               onClick={() => handleViewDetails(record.id)}
//                               title="Voir Détails"
//                             >
//                               <EyeOpenIcon className="h-4 w-4" />
//                               <span className="sr-only sm:not-sr-only sm:ml-1">
//                                 Détails
//                               </span>
//                             </Button>
//                             {/* <Button
//                               variant="outline"
//                               size="sm"
//                               onClick={() => handleModifyRecord(record.id)}
//                               title="Modifier"
//                             >
//                               <Pencil2Icon className="h-4 w-4" />
//                               <span className="sr-only sm:not-sr-only sm:ml-1">
//                                 Modifier
//                               </span>
//                             </Button> */}
//                           </div>
//                         </TableCell>
//                       </TableRow>
//                     ))}
//                   </TableBody>
//                 </Table>
//               </div>

//               {/* Pagination Controls */}
//               <div className="flex items-center justify-between space-x-2 py-4 mt-6 border-t pt-6">
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={() =>
//                     setCurrentPage((prev) => Math.max(1, prev - 1))
//                   }
//                   disabled={currentPage <= 1 || loading}
//                 >
//                   <ChevronLeftIcon className="mr-1 h-4 w-4" />
//                   Précédent
//                 </Button>
//                 <span className="text-sm text-muted-foreground">
//                   Page {currentPage} / {totalPages > 0 ? totalPages : 1}
//                 </span>
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={() =>
//                     setCurrentPage((prev) =>
//                       Math.min(totalPages > 0 ? totalPages : 1, prev + 1)
//                     )
//                   }
//                   disabled={
//                     currentPage >= totalPages || loading || totalCount === 0
//                   }
//                 >
//                   Suivant
//                   <ChevronRightIcon className="ml-1 h-4 w-4" />
//                 </Button>
//               </div>
//             </>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// }

// src/pages/GestionDepensesPage.tsx

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom"; // Using useNavigate for Vite
import { supabase } from "@/lib/supabaseClient";
import { Database } from "@/lib/database.types";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PlusCircledIcon,
  Pencil2Icon, // Kept Pencil2Icon for modify button
  EyeOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArchiveIcon, // Using ArchiveIcon for a more descriptive title
} from "@radix-ui/react-icons";

// Types - IncomeExpenseRecordSummary should now include net_income
type Agent = Database["public"]["Tables"]["agents"]["Row"];
type IncomeExpenseRecordSummary =
  Database["public"]["Views"]["income_expense_record_summary"]["Row"];

const ITEMS_PER_PAGE = 10;

export default function GestionDepensesPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<IncomeExpenseRecordSummary[]>([]);
  const [agents, setAgentsData] = useState<Agent[]>([]); // Renamed from setAgents to avoid conflict
  const [selectedAgentId, setSelectedAgentId] = useState<string | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    const { data, error: agentError } = await supabase
      .from("agents")
      .select("id, name, code");
    if (agentError) {
      console.error("Error fetching agents:", agentError);
      setError("Impossible de charger les agents.");
    } else {
      setAgentsData(data || []);
    }
  }, []);

  const fetchIncomeExpenseRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from("income_expense_record_summary")
      .select("*", { count: "exact" }) // Select all columns from the view
      .order("record_date", { ascending: false })
      .order("created_at", { ascending: false }) // Secondary sort
      .range(from, to);

    if (selectedAgentId !== "all") {
      query = query.eq("agent_id", selectedAgentId);
    }

    const { data, error: queryError, count } = await query;

    if (queryError) {
      console.error("Error fetching income/expense records:", queryError);
      setError("Impossible de charger les fiches de revenus/dépenses.");
      setRecords([]);
    } else {
      setRecords(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [currentPage, selectedAgentId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    fetchIncomeExpenseRecords();
  }, [fetchIncomeExpenseRecords]);

  const handleCreateNewRecord = () => {
    navigate("/gestion-depenses/creer");
  };

  const handleViewDetails = (recordId: string | undefined | null) => {
    // Added null check
    if (recordId) navigate(`/gestion-depenses/${recordId}`); // Example details route
  };

  // const handleModifyRecord = (recordId: string | undefined | null) => {
  //   // Added null check
  //   if (recordId) navigate(`/gestion-depenses/modifier/${recordId}`);
  // };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "N/A";
    return amount.toLocaleString("fr-FR", {
      style: "currency",
      currency: "XOF",
    });
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-3">
              <ArchiveIcon className="h-8 w-8 text-primary" />{" "}
              {/* Updated Icon */}
              <CardTitle className="text-3xl font-bold text-gray-800">
                Gestion des Fiches de Caisse {/* Updated Title */}
              </CardTitle>
            </div>
            <Button onClick={handleCreateNewRecord} size="lg">
              <PlusCircledIcon className="mr-2 h-5 w-5" />
              Nouvelle Fiche
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6">
            <Select
              value={selectedAgentId}
              onValueChange={(value) => {
                setSelectedAgentId(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[280px] text-base py-3">
                <SelectValue placeholder="Filtrer par agent..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les agents</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} {agent.code ? `(${agent.code})` : ""}{" "}
                    {/* Display agent code */}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && (
            <p className="text-center py-4 text-gray-600">
              Chargement des fiches...
            </p>
          )}
          {error && <p className="text-center text-red-600 py-4">{error}</p>}

          {!loading && !error && records.length === 0 && (
            <p className="text-center text-gray-600 py-10">
              Aucune fiche trouvée.
            </p>
          )}

          {!loading && !error && records.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableCaption className="py-4 text-sm text-muted-foreground">
                    Page {currentPage} sur {totalPages > 0 ? totalPages : 1} (
                    {totalCount} fiches au total)
                  </TableCaption>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-100 transition-colors">
                      <TableHead className="font-semibold text-slate-700">
                        Date
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700">
                        Agent
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">
                        Total Revenus
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">
                        Total Dépenses
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">
                        Solde Net
                      </TableHead>{" "}
                      {/* <TableHead className="text-right font-semibold text-slate-700">
                        Précédent
                      </TableHead>
                      <TableHead className="text-right font-semibold text-slate-700">
                        Total
                      </TableHead> */}
                      {/* New Column */}
                      <TableHead className="text-center font-semibold text-slate-700">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-left">
                    {records.map((record) => (
                      <TableRow
                        key={record.id}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <TableCell className="py-3">
                          {record.record_date
                            ? new Date(record.record_date).toLocaleDateString(
                                "fr-FR",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "N/A"}
                        </TableCell>
                        <TableCell className="py-3">
                          {record.agent_name || "N/A"}
                        </TableCell>
                        <TableCell className="text-right py-3 text-green-600 font-medium">
                          {formatCurrency(record.total_income)}
                        </TableCell>
                        <TableCell className="text-right py-3 text-red-600 font-medium">
                          {formatCurrency(record.total_expense)}
                        </TableCell>
                        <TableCell
                          className={`text-right py-3 font-bold ${
                            (record.net_income ?? 0) >= 0
                              ? "text-blue-600"
                              : "text-orange-600"
                          }`}
                        >
                          {" "}
                          {/* New Cell */}
                          {formatCurrency(record.net_income)}
                        </TableCell>
                        {/* <TableCell
                          className={`text-right py-3 font-bold ${
                            (record.net_income ?? 0) >= 0
                              ? "text-blue-600"
                              : "text-orange-600"
                          }`}
                        >
                          {" "}
                          {Number(record.notes)
                            ? formatCurrency(Number(record.notes))
                            : formatCurrency(record.net_income)}
                        </TableCell> */}
                        {/* <TableCell
                          className={`text-right py-3 font-bold ${
                            (record.net_income ?? 0) >= 0
                              ? "text-blue-600"
                              : "text-orange-600"
                          }`}
                        >
                          {" "}
                          {Number(record.notes)
                            ? formatCurrency(
                                record.net_income + Number(record.notes)
                              )
                            : formatCurrency(record.net_income)}
                        </TableCell> */}
                        <TableCell className="text-center py-3">
                          <div className="flex justify-center items-center space-x-1 sm:space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 sm:px-3"
                              onClick={() => handleViewDetails(record.id)}
                              title="Voir Détails"
                            >
                              <EyeOpenIcon className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Détails</span>
                            </Button>
                            {/* <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 sm:px-3"
                              onClick={() => handleModifyRecord(record.id)}
                              title="Modifier"
                            >
                              <Pencil2Icon className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">Modifier</span>
                            </Button> */}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between space-x-2 py-4 mt-6 border-t pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage <= 1 || loading}
                >
                  <ChevronLeftIcon className="mr-1 h-4 w-4" />
                  Précédent
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} / {totalPages > 0 ? totalPages : 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(totalPages > 0 ? totalPages : 1, prev + 1)
                    )
                  }
                  disabled={
                    currentPage >= totalPages || loading || totalCount === 0
                  }
                >
                  Suivant
                  <ChevronRightIcon className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
