// // src/components/app/insights/DataInsightsPage.tsx
// import { useState, useEffect, useCallback } from "react";
// import { supabase } from "@/lib/supabaseClient"; // Adjust path as needed
// import { Button } from "@/components/ui/button";
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
//   CardDescription,
// } from "@/components/ui/card";
// import { DatePicker } from "@/components/ui/date-picker";
// import {
//   Loader2,
//   TrendingUp,
//   FileText,
//   DollarSign,
//   ArrowLeft,
//   ArrowRight,
//   RefreshCw,
//   AlertOctagon,
//   CheckCircle,
//   Users,
//   User as DoctorIcon,
//   Activity,
//   Gift,
//   TrendingDown,
//   BarChartHorizontalBig,
//   PieChart as PieChartIcon,
// } from "lucide-react"; // Added PieChartIcon
// import { toast as sonnerToast } from "sonner";
// import {
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
//   ResponsiveContainer,
//   PieChart,
//   Pie,
//   Cell,
//   Legend as PieLegend,
// } from "recharts"; // Added PieChart, Pie, Cell from recharts

// // ... (Interfaces: BaseInsightData, UnpaidInsightData, etc. remain THE SAME)
// interface BaseInsightData {
//   bilan_count: number;
//   total_revenue_gross: number;
//   total_normal_price: number;
//   total_insurance_price: number;
// }
// interface UnpaidInsightData {
//   total_unpaid_amount: number;
// }
// interface NewPatientsData {
//   new_patient_count: number;
// }
// interface DoctorBilanStat {
//   doctor_id: string;
//   doctor_full_name: string;
//   bilan_count: number;
// }
// interface TestTypeStat {
//   test_type_id: string;
//   test_type_name: string;
//   usage_count: number;
// }
// interface RistourneGeneratedData {
//   total_ristourne_fee: number;
// }
// interface IncomeExpenseSummaryData {
//   total_period_income: number;
//   total_period_expenses: number;
//   net_period_profit: number;
// }
// interface InsightData
//   extends BaseInsightData,
//     UnpaidInsightData,
//     NewPatientsData,
//     RistourneGeneratedData,
//     IncomeExpenseSummaryData {
//   total_revenue_collected: number;
//   top_doctors_bilans: DoctorBilanStat[];
//   top_test_types: TestTypeStat[];
// }

// const CURRENCY_SYMBOL = "FCFA";
// const formatCurrency = (
//   amount: number | string | null | undefined,
//   addPlusSign = false
// ) => {
//   // ... (remains the same)
//   const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
//   if (numAmount === null || numAmount === undefined || isNaN(numAmount))
//     return `0 ${CURRENCY_SYMBOL}`;
//   const plusSign = addPlusSign && numAmount > 0 ? "+" : "";
//   return `${plusSign}${numAmount.toLocaleString("fr-FR")} ${CURRENCY_SYMBOL}`;
// };

// type PeriodType = "daily" | "monthly" | "yearly";
// const TOP_N_COUNT = 5;

// // ... (getYearOptions, monthOptions remain the same) ...
// const getYearOptions = (startYearOffset = 5, endYearOffset = 0) => {
//   const currentYear = new Date().getFullYear();
//   const years = [];
//   for (
//     let i = currentYear - startYearOffset;
//     i <= currentYear + endYearOffset;
//     i++
//   ) {
//     years.push({ value: i.toString(), label: i.toString() });
//   }
//   return years.reverse();
// };

// const monthOptions = [
//   { value: "1", label: "Janvier" },
//   { value: "2", label: "Février" },
//   { value: "3", label: "Mars" },
//   { value: "4", label: "Avril" },
//   { value: "5", label: "Mai" },
//   { value: "6", label: "Juin" },
//   { value: "7", label: "Juillet" },
//   { value: "8", label: "Août" },
//   { value: "9", label: "Septembre" },
//   { value: "10", label: "Octobre" },
//   { value: "11", label: "Novembre" },
//   { value: "12", label: "Décembre" },
// ];

// // Colors for Pie Chart
// const PIE_CHART_COLORS = ["#82ca9d", "#8884d8", "#ffc658", "#ff8042"];

// export function DataInsightsPage() {
//   // ... (all state variables: periodType, selectedDate, insights, loading, etc. remain the same) ...
//   const [periodType, setPeriodType] = useState<PeriodType>("daily");
//   const [selectedDate, setSelectedDate] = useState<Date | undefined>(
//     new Date()
//   );
//   const [selectedMonth, setSelectedMonth] = useState<string>(
//     (new Date().getMonth() + 1).toString()
//   );
//   const [selectedYear, setSelectedYear] = useState<string>(
//     new Date().getFullYear().toString()
//   );
//   const [insights, setInsights] = useState<InsightData | null>(null);
//   const [loading, setLoading] = useState(false);
//   const yearOptions = getYearOptions();

//   // ... (fetchInsights, useEffect, handlePeriodNavigation, CurrentPeriodDisplay remain THE SAME as the previous version) ...
//   const fetchInsights = useCallback(async () => {
//     if ((periodType === "daily" && !selectedDate) || !selectedYear) {
//       setInsights(null);
//       return;
//     }
//     setLoading(true);
//     setInsights(null);

//     let rpcNames = {
//       base: "",
//       unpaid: "",
//       newPatients: "",
//       bilansPerDoctor: "",
//       commonTestTypes: "",
//       ristourne: "",
//       incomeExpense: "",
//     };
//     let params: any = { top_n: TOP_N_COUNT };
//     const yearNum = parseInt(selectedYear);
//     const dateString =
//       periodType === "daily" && selectedDate
//         ? selectedDate.toISOString().split("T")[0]
//         : undefined;
//     const monthNum =
//       periodType === "monthly" ? parseInt(selectedMonth) : undefined;

//     switch (periodType) {
//       case "daily":
//         params = { ...params, target_date: dateString };
//         rpcNames = {
//           base: "get_daily_insights",
//           unpaid: "get_daily_unpaid_total",
//           newPatients: "get_daily_new_patients_count",
//           bilansPerDoctor: "get_daily_bilans_per_doctor",
//           commonTestTypes: "get_daily_common_test_types",
//           ristourne: "get_daily_ristourne_generated",
//           incomeExpense: "get_daily_income_expense_summary",
//         };
//         break;
//       case "monthly":
//         params = { ...params, year_num: yearNum, month_num: monthNum };
//         rpcNames = {
//           base: "get_monthly_insights",
//           unpaid: "get_monthly_unpaid_total",
//           newPatients: "get_monthly_new_patients_count",
//           bilansPerDoctor: "get_monthly_bilans_per_doctor",
//           commonTestTypes: "get_monthly_common_test_types",
//           ristourne: "get_monthly_ristourne_generated",
//           incomeExpense: "get_monthly_income_expense_summary",
//         };
//         break;
//       case "yearly":
//         params = { ...params, year_num: yearNum };
//         rpcNames = {
//           base: "get_yearly_insights",
//           unpaid: "get_yearly_unpaid_total",
//           newPatients: "get_yearly_new_patients_count",
//           bilansPerDoctor: "get_yearly_bilans_per_doctor",
//           commonTestTypes: "get_yearly_common_test_types",
//           ristourne: "get_yearly_ristourne_generated",
//           incomeExpense: "get_yearly_income_expense_summary",
//         };
//         break;
//     }

//     const baseParams =
//       periodType === "daily"
//         ? { target_date: params.target_date }
//         : periodType === "monthly"
//         ? { year_num: params.year_num, month_num: params.month_num }
//         : { year_num: params.year_num };
//     const listParams = params;

//     try {
//       const results = await Promise.all([
//         supabase.rpc(rpcNames.base, baseParams),
//         supabase.rpc(rpcNames.unpaid, baseParams),
//         supabase.rpc(rpcNames.newPatients, baseParams),
//         supabase.rpc(rpcNames.bilansPerDoctor, listParams),
//         supabase.rpc(rpcNames.commonTestTypes, listParams),
//         supabase.rpc(rpcNames.ristourne, baseParams),
//         supabase.rpc(rpcNames.incomeExpense, baseParams),
//       ]);

//       const [
//         baseRes,
//         unpaidRes,
//         newPatientsRes,
//         doctorsRes,
//         testsRes,
//         ristourneRes,
//         incomeExpenseRes,
//       ] = results;

//       const errors = results.map((r) => r.error).filter(Boolean);
//       if (errors.length > 0) {
//         errors.forEach((error) => console.error(`Erreur RPC:`, error));
//         sonnerToast.error(`Erreur de chargement des aperçus`, {
//           description: errors.map((e) => e.message).join("; "),
//         });
//         setInsights(null);
//       } else {
//         const rawBaseStats =
//           baseRes.data && baseRes.data.length > 0 ? baseRes.data[0] : null;
//         const rawUnpaidStats =
//           unpaidRes.data && unpaidRes.data.length > 0
//             ? unpaidRes.data[0]
//             : null;
//         const rawNewPatientsStats =
//           newPatientsRes.data && newPatientsRes.data.length > 0
//             ? newPatientsRes.data[0]
//             : null;
//         const topDoctors = (doctorsRes.data || []) as DoctorBilanStat[];
//         const topTests = (testsRes.data || []) as TestTypeStat[];
//         const rawRistourneStats =
//           ristourneRes.data && ristourneRes.data.length > 0
//             ? ristourneRes.data[0]
//             : null;
//         const rawIncomeExpenseStats =
//           incomeExpenseRes.data && incomeExpenseRes.data.length > 0
//             ? incomeExpenseRes.data[0]
//             : null;

//         const baseStats: BaseInsightData = rawBaseStats
//           ? {
//               bilan_count: rawBaseStats.bilan_count || 0,
//               total_revenue_gross: rawBaseStats.total_revenue || 0,
//               total_normal_price: rawBaseStats.total_normal_price || 0,
//               total_insurance_price: rawBaseStats.total_insurance_price || 0,
//             }
//           : {
//               bilan_count: 0,
//               total_revenue_gross: 0,
//               total_normal_price: 0,
//               total_insurance_price: 0,
//             };

//         const unpaidStats: UnpaidInsightData = rawUnpaidStats
//           ? { total_unpaid_amount: rawUnpaidStats.total_unpaid_amount || 0 }
//           : { total_unpaid_amount: 0 };

//         const newPatientsCount: NewPatientsData = rawNewPatientsStats
//           ? { new_patient_count: rawNewPatientsStats.new_patient_count || 0 }
//           : { new_patient_count: 0 };

//         const ristourneGenerated: RistourneGeneratedData = rawRistourneStats
//           ? { total_ristourne_fee: rawRistourneStats.total_ristourne_fee || 0 }
//           : { total_ristourne_fee: 0 };

//         const incomeExpenseData: IncomeExpenseSummaryData =
//           rawIncomeExpenseStats
//             ? {
//                 total_period_income:
//                   rawIncomeExpenseStats.total_period_income || 0,
//                 total_period_expenses:
//                   rawIncomeExpenseStats.total_period_expenses || 0,
//                 net_period_profit: rawIncomeExpenseStats.net_period_profit || 0,
//               }
//             : {
//                 total_period_income: 0,
//                 total_period_expenses: 0,
//                 net_period_profit: 0,
//               };

//         const collectedRevenue =
//           baseStats.total_revenue_gross - unpaidStats.total_unpaid_amount;

//         setInsights({
//           ...baseStats,
//           ...unpaidStats,
//           ...newPatientsCount,
//           ...ristourneGenerated,
//           ...incomeExpenseData,
//           total_revenue_collected: collectedRevenue >= 0 ? collectedRevenue : 0,
//           top_doctors_bilans: topDoctors,
//           top_test_types: topTests,
//         });
//       }
//     } catch (error: any) {
//       console.error(`Exception lors de la récupération des aperçus:`, error);
//       sonnerToast.error(`Erreur de chargement des aperçus`, {
//         description: error.message || "Une erreur inattendue s'est produite",
//       });
//       setInsights(null);
//     } finally {
//       setLoading(false);
//     }
//   }, [periodType, selectedDate, selectedMonth, selectedYear]);

//   useEffect(() => {
//     fetchInsights();
//   }, [fetchInsights]);

//   const handlePeriodNavigation = (direction: "prev" | "next") => {
//     let newDate = selectedDate ? new Date(selectedDate) : new Date();
//     let newMonth = parseInt(selectedMonth);
//     let newYear = parseInt(selectedYear);

//     switch (periodType) {
//       case "daily":
//         newDate.setDate(newDate.getDate() + (direction === "prev" ? -1 : 1));
//         setSelectedDate(newDate);
//         setSelectedMonth((newDate.getMonth() + 1).toString());
//         setSelectedYear(newDate.getFullYear().toString());
//         break;
//       case "monthly":
//         if (direction === "prev") {
//           newMonth--;
//           if (newMonth < 1) {
//             newMonth = 12;
//             newYear--;
//           }
//         } else {
//           newMonth++;
//           if (newMonth > 12) {
//             newMonth = 1;
//             newYear++;
//           }
//         }
//         setSelectedMonth(newMonth.toString());
//         setSelectedYear(newYear.toString());
//         break;
//       case "yearly":
//         newYear += direction === "prev" ? -1 : 1;
//         setSelectedYear(newYear.toString());
//         break;
//     }
//   };

//   const CurrentPeriodDisplay = () => {
//     if (!selectedYear) return null;
//     const yearNum = parseInt(selectedYear);
//     switch (periodType) {
//       case "daily":
//         return selectedDate
//           ? selectedDate.toLocaleDateString("fr-FR", {
//               weekday: "long",
//               year: "numeric",
//               month: "long",
//               day: "numeric",
//             })
//           : "Sélectionnez une date";
//       case "monthly":
//         const monthName =
//           monthOptions.find((m) => m.value === selectedMonth)?.label || "";
//         return `${monthName} ${yearNum}`;
//       case "yearly":
//         return `Année ${yearNum}`;
//       default:
//         return null;
//     }
//   };

//   // Data for Revenue Breakdown Pie Chart
//   const revenueBreakdownData = insights
//     ? [
//         { name: "Revenu Normal", value: insights.total_normal_price || 0 },
//         {
//           name: "Revenu Assurance",
//           value: insights.total_insurance_price || 0,
//         },
//       ].filter((item) => item.value > 0)
//     : []; // Filter out zero values for cleaner pie

//   return (
//     <div className="container mx-auto p-4 md:p-6 lg:p-8">
//       <h1 className="text-3xl font-bold mb-6 text-gray-800">
//         Aperçu des Données
//       </h1>

//       {/* Period Selection Card - remains the same */}
//       <Card className="mb-6 shadow-md">
//         <CardHeader>
//           <CardTitle>Sélection de la Période</CardTitle>
//           <CardDescription>
//             Choisissez la granularité et la période pour afficher les
//             statistiques.
//           </CardDescription>
//         </CardHeader>
//         <CardContent className="space-y-4 md:space-y-0 md:flex md:items-end md:space-x-4">
//           <div className="flex-1 space-y-1">
//             <label htmlFor="periodType" className="text-sm font-medium">
//               Type de Période
//             </label>
//             <Select
//               value={periodType}
//               onValueChange={(value) => setPeriodType(value as PeriodType)}
//             >
//               <SelectTrigger id="periodType">
//                 <SelectValue />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="daily">Journalier</SelectItem>
//                 <SelectItem value="monthly">Mensuel</SelectItem>
//                 <SelectItem value="yearly">Annuel</SelectItem>
//               </SelectContent>
//             </Select>
//           </div>
//           {periodType === "daily" && (
//             <div className="flex-1 space-y-1">
//               <label htmlFor="dailyDate" className="text-sm font-medium">
//                 Date
//               </label>
//               <DatePicker date={selectedDate} setDate={setSelectedDate} />
//             </div>
//           )}
//           {(periodType === "monthly" || periodType === "yearly") && (
//             <div className="flex-1 space-y-1">
//               <label htmlFor="yearSelect" className="text-sm font-medium">
//                 Année
//               </label>
//               <Select value={selectedYear} onValueChange={setSelectedYear}>
//                 <SelectTrigger id="yearSelect">
//                   <SelectValue />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {yearOptions.map((year) => (
//                     <SelectItem key={year.value} value={year.value}>
//                       {year.label}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>
//           )}
//           {periodType === "monthly" && (
//             <div className="flex-1 space-y-1">
//               <label htmlFor="monthSelect" className="text-sm font-medium">
//                 Mois
//               </label>
//               <Select value={selectedMonth} onValueChange={setSelectedMonth}>
//                 <SelectTrigger id="monthSelect">
//                   <SelectValue />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {monthOptions.map((month) => (
//                     <SelectItem key={month.value} value={month.value}>
//                       {month.label}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>
//           )}
//           <Button
//             onClick={fetchInsights}
//             variant="outline"
//             className="w-full md:w-auto shrink-0"
//           >
//             <RefreshCw className="mr-2 h-4 w-4" /> Charger
//           </Button>
//         </CardContent>
//       </Card>

//       {/* Period Navigation - remains the same */}
//       <div className="flex items-center justify-between mb-4">
//         <Button
//           variant="outline"
//           size="icon"
//           onClick={() => handlePeriodNavigation("prev")}
//           disabled={loading}
//         >
//           <ArrowLeft className="h-5 w-5" />
//         </Button>
//         <h2 className="text-xl font-semibold text-center text-slate-700">
//           <CurrentPeriodDisplay />
//         </h2>
//         <Button
//           variant="outline"
//           size="icon"
//           onClick={() => handlePeriodNavigation("next")}
//           disabled={loading}
//         >
//           <ArrowRight className="h-5 w-5" />
//         </Button>
//       </div>

//       {loading && (
//         <div className="flex justify-center items-center py-10">
//           {" "}
//           <Loader2 className="h-12 w-12 animate-spin text-sky-600" />{" "}
//         </div>
//       )}

//       {!loading && insights && (
//         <div className="space-y-8">
//           {/* Section 1: Income/Expense Summary (based on income_expense_records) */}
//           <Card className="shadow-xl">
//             <CardHeader>
//               <CardTitle className="text-xl flex items-center">
//                 <BarChartHorizontalBig className="h-6 w-6 mr-2 text-orange-500" />
//                 Résumé Financier (Enregistrements Journaliers)
//               </CardTitle>
//               <CardDescription>
//                 Basé sur les enregistrements de revenus/dépenses pour la
//                 période.
//               </CardDescription>
//             </CardHeader>
//             <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               <div className="p-4 rounded-lg bg-slate-50">
//                 <p className="text-sm font-medium text-slate-600">
//                   Revenus Période
//                 </p>
//                 <p className="text-2xl font-bold text-green-600">
//                   {formatCurrency(insights.total_period_income)}
//                 </p>
//               </div>
//               <div className="p-4 rounded-lg bg-slate-50">
//                 <p className="text-sm font-medium text-slate-600">
//                   Dépenses Période
//                 </p>
//                 <p className="text-2xl font-bold text-red-600">
//                   {formatCurrency(insights.total_period_expenses)}
//                 </p>
//               </div>
//               <div
//                 className={`p-4 rounded-lg ${
//                   insights.net_period_profit >= 0
//                     ? "bg-green-100"
//                     : "bg-red-100"
//                 }`}
//               >
//                 <p className="text-sm font-medium ${insights.net_period_profit >= 0 ? 'text-green-700' : 'text-red-700'}">
//                   Profit Net Période
//                 </p>
//                 <p
//                   className={`text-2xl font-bold ${
//                     insights.net_period_profit >= 0
//                       ? "text-green-700"
//                       : "text-red-700"
//                   }`}
//                 >
//                   {formatCurrency(insights.net_period_profit, true)}
//                 </p>
//               </div>
//             </CardContent>
//           </Card>

//           {/* Section 2: Patient & Bilan Activity */}
//           {/* ... (remains the same as previous version) ... */}
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//             <Card className="shadow-lg hover:shadow-xl transition-shadow">
//               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//                 <CardTitle className="text-sm font-medium">
//                   Nouveaux Patients
//                 </CardTitle>
//                 <Users className="h-5 w-5 text-indigo-500" />
//               </CardHeader>
//               <CardContent>
//                 <div className="text-3xl font-bold text-slate-800">
//                   {insights.new_patient_count}
//                 </div>
//                 <p className="text-xs text-muted-foreground pt-1">
//                   Patients enregistrés.
//                 </p>
//               </CardContent>
//             </Card>
//             <Card className="shadow-lg hover:shadow-xl transition-shadow">
//               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//                 <CardTitle className="text-sm font-medium">
//                   Nombre de Bilans
//                 </CardTitle>
//                 <FileText className="h-5 w-5 text-sky-500" />
//               </CardHeader>
//               <CardContent>
//                 <div className="text-3xl font-bold text-slate-800">
//                   {insights.bilan_count}
//                 </div>
//                 <p className="text-xs text-muted-foreground pt-1">
//                   Bilans (tests) traités.
//                 </p>
//               </CardContent>
//             </Card>
//             <Card className="shadow-lg hover:shadow-xl transition-shadow">
//               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//                 <CardTitle className="text-sm font-medium">
//                   Frais de Ristourne
//                 </CardTitle>
//                 <Gift className="h-5 w-5 text-amber-500" />
//               </CardHeader>
//               <CardContent>
//                 <div className="text-3xl font-bold text-slate-800">
//                   {formatCurrency(insights.total_ristourne_fee)}
//                 </div>
//                 <p className="text-xs text-muted-foreground pt-1">
//                   Total des frais de référence.
//                 </p>
//               </CardContent>
//             </Card>
//           </div>

//           {/* Section 3: Revenue from Bilans (Patient Results) & Breakdown Viz */}
//           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//             <Card className="lg:col-span-2 shadow-lg hover:shadow-xl transition-shadow">
//               {" "}
//               {/* Main revenue numbers card */}
//               <CardHeader>
//                 <CardTitle className="text-xl flex items-center">
//                   <DollarSign className="h-6 w-6 mr-2 text-green-500" />
//                   Revenus des Bilans
//                 </CardTitle>
//                 <CardDescription>
//                   Basé sur les prix des bilans patients.
//                 </CardDescription>
//               </CardHeader>
//               <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
//                 <div className="p-3 rounded-lg bg-blue-50">
//                   <p className="text-sm font-medium text-blue-700">
//                     Revenu Brut
//                   </p>
//                   <p className="text-2xl font-bold text-blue-600">
//                     {formatCurrency(insights.total_revenue_gross)}
//                   </p>
//                 </div>
//                 <div className="p-3 rounded-lg bg-red-50">
//                   <p className="text-sm font-medium text-red-700">Impayés</p>
//                   <p className="text-2xl font-bold text-red-600">
//                     {formatCurrency(insights.total_unpaid_amount)}
//                   </p>
//                 </div>
//                 <div className="p-3 rounded-lg bg-green-50">
//                   <p className="text-sm font-medium text-green-700">
//                     Revenu Net Collecté
//                   </p>
//                   <p className="text-2xl font-bold text-green-600">
//                     {formatCurrency(insights.total_revenue_collected)}
//                   </p>
//                 </div>
//               </CardContent>
//             </Card>

//             <Card className="shadow-lg hover:shadow-xl transition-shadow">
//               {" "}
//               {/* Pie chart card */}
//               <CardHeader>
//                 <CardTitle className="text-lg flex items-center">
//                   <PieChartIcon className="h-5 w-5 mr-2 text-cyan-600" />
//                   Répartition Revenu Brut
//                 </CardTitle>
//               </CardHeader>
//               <CardContent className="h-[250px] md:h-[200px] lg:h-auto">
//                 {" "}
//                 {/* Adjusted height */}
//                 {revenueBreakdownData.length > 0 ? (
//                   <ResponsiveContainer width="100%" height="100%">
//                     <PieChart>
//                       <Pie
//                         data={revenueBreakdownData}
//                         cx="50%"
//                         cy="50%"
//                         labelLine={false}
//                         outerRadius={80}
//                         fill="#8884d8"
//                         dataKey="value"
//                         label={({ name, percent }) =>
//                           `${name}: ${(percent * 100).toFixed(0)}%`
//                         }
//                       >
//                         {revenueBreakdownData.map((entry, index) => (
//                           <Cell
//                             key={`cell-${index}`}
//                             fill={
//                               PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]
//                             }
//                           />
//                         ))}
//                       </Pie>
//                       <Tooltip
//                         formatter={(value: number) => [
//                           formatCurrency(value),
//                           "Montant",
//                         ]}
//                       />
//                       <PieLegend />
//                     </PieChart>
//                   </ResponsiveContainer>
//                 ) : (
//                   <p className="text-slate-500 italic text-center pt-10">
//                     Aucun revenu à répartir.
//                   </p>
//                 )}
//               </CardContent>
//             </Card>
//           </div>

//           {/* Section 4: Top Lists (Doctors and Test Types) */}
//           {/* ... (remains the same as previous version) ... */}
//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//             <Card className="shadow-lg hover:shadow-xl transition-shadow">
//               <CardHeader>
//                 <CardTitle className="text-lg flex items-center">
//                   <DoctorIcon className="h-6 w-6 mr-2 text-teal-600" />
//                   Top {TOP_N_COUNT} Médecins par Bilans
//                 </CardTitle>
//               </CardHeader>
//               <CardContent>
//                 {insights.top_doctors_bilans.length > 0 ? (
//                   <ResponsiveContainer width="100%" height={300}>
//                     <BarChart
//                       data={insights.top_doctors_bilans}
//                       layout="vertical"
//                       margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
//                     >
//                       <CartesianGrid strokeDasharray="3 3" />
//                       <XAxis type="number" allowDecimals={false} />
//                       <YAxis
//                         dataKey="doctor_full_name"
//                         type="category"
//                         width={150}
//                         interval={0}
//                         tick={{ fontSize: 12 }}
//                       />
//                       <Tooltip
//                         formatter={(value: number) => [
//                           `${value} bilans`,
//                           "Nombre",
//                         ]}
//                       />
//                       <Legend />
//                       <Bar
//                         dataKey="bilan_count"
//                         name="Nb. Bilans"
//                         fill="#14b8a6"
//                       />
//                     </BarChart>
//                   </ResponsiveContainer>
//                 ) : (
//                   <p className="text-slate-500 italic">
//                     Aucune donnée de médecin pour cette période.
//                   </p>
//                 )}
//               </CardContent>
//             </Card>

//             <Card className="shadow-lg hover:shadow-xl transition-shadow">
//               <CardHeader>
//                 <CardTitle className="text-lg flex items-center">
//                   <Activity className="h-6 w-6 mr-2 text-purple-600" />
//                   Top {TOP_N_COUNT} Types de Tests
//                 </CardTitle>
//               </CardHeader>
//               <CardContent>
//                 {insights.top_test_types.length > 0 ? (
//                   <ResponsiveContainer width="100%" height={300}>
//                     <BarChart
//                       data={insights.top_test_types}
//                       layout="vertical"
//                       margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
//                     >
//                       <CartesianGrid strokeDasharray="3 3" />
//                       <XAxis type="number" allowDecimals={false} />
//                       <YAxis
//                         dataKey="test_type_name"
//                         type="category"
//                         width={150}
//                         interval={0}
//                         tick={{ fontSize: 12 }}
//                       />
//                       <Tooltip
//                         formatter={(value: number) => [
//                           `${value} utilisations`,
//                           "Nombre",
//                         ]}
//                       />
//                       <Legend />
//                       <Bar
//                         dataKey="usage_count"
//                         name="Nb. Utilisations"
//                         fill="#8b5cf6"
//                       />
//                     </BarChart>
//                   </ResponsiveContainer>
//                 ) : (
//                   <p className="text-slate-500 italic">
//                     Aucune donnée de type de test pour cette période.
//                   </p>
//                 )}
//               </CardContent>
//             </Card>
//           </div>
//         </div>
//       )}

//       {!loading && !insights && (
//         <Card className="text-center py-10 text-slate-500 bg-slate-50 p-6 rounded-lg shadow border border-slate-200">
//           {" "}
//           <CardContent>
//             {" "}
//             <p className="text-lg">Aucune donnée à afficher.</p>{" "}
//             <p className="text-sm mt-2">
//               Veuillez sélectionner une période et cliquer sur "Charger", ou il
//               n'y a pas de données pour les critères choisis.
//             </p>{" "}
//           </CardContent>{" "}
//         </Card>
//       )}
//     </div>
//   );
// }

// src/components/app/insights/DataInsightsPage.tsx
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient"; // Adjust path as needed
import { Button } from "@/components/ui/button";
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
  CardDescription,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Loader2,
  TrendingUp,
  FileText,
  DollarSign,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  AlertOctagon,
  CheckCircle,
  Users,
  User as DoctorIcon,
  Activity,
  Gift,
  TrendingDown,
  BarChartHorizontalBig,
  PieChart as PieChartIcon,
  Divide,
} from "lucide-react"; // Added Divide for separator
import { toast as sonnerToast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend as PieLegend,
} from "recharts";

// ... (Interfaces remain THE SAME as the previous version) ...
interface BaseInsightData {
  bilan_count: number;
  total_revenue_gross: number;
  total_normal_price: number;
  total_insurance_price: number;
}
interface UnpaidInsightData {
  total_unpaid_amount: number;
}
interface NewPatientsData {
  new_patient_count: number;
}
interface DoctorBilanStat {
  doctor_id: string;
  doctor_full_name: string;
  bilan_count: number;
}
interface TestTypeStat {
  test_type_id: string;
  test_type_name: string;
  usage_count: number;
}
interface RistourneGeneratedData {
  total_ristourne_fee: number;
}
interface IncomeExpenseSummaryData {
  total_period_income: number;
  total_period_expenses: number;
  net_period_profit: number;
}
interface InsightData
  extends BaseInsightData,
    UnpaidInsightData,
    NewPatientsData,
    RistourneGeneratedData,
    IncomeExpenseSummaryData {
  total_revenue_collected: number;
  top_doctors_bilans: DoctorBilanStat[];
  top_test_types: TestTypeStat[];
}

const CURRENCY_SYMBOL = "FCFA";
const formatCurrency = (
  amount: number | string | null | undefined,
  addPlusSign = false
) => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (numAmount === null || numAmount === undefined || isNaN(numAmount))
    return `0 ${CURRENCY_SYMBOL}`;
  const plusSign = addPlusSign && numAmount > 0 ? "+" : "";
  return `${plusSign}${numAmount.toLocaleString("fr-FR")} ${CURRENCY_SYMBOL}`;
};

type PeriodType = "daily" | "monthly" | "yearly";
const TOP_N_COUNT = 5;
const PIE_CHART_COLORS = ["#82ca9d", "#8884d8", "#ffc658", "#ff8042"];

// ... (getYearOptions, monthOptions remain the same) ...
const getYearOptions = (startYearOffset = 5, endYearOffset = 0) => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (
    let i = currentYear - startYearOffset;
    i <= currentYear + endYearOffset;
    i++
  ) {
    years.push({ value: i.toString(), label: i.toString() });
  }
  return years.reverse();
};

const monthOptions = [
  { value: "1", label: "Janvier" },
  { value: "2", label: "Février" },
  { value: "3", label: "Mars" },
  { value: "4", label: "Avril" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Juin" },
  { value: "7", label: "Juillet" },
  { value: "8", label: "Août" },
  { value: "9", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
];

export function DataInsightsPage() {
  const [periodType, setPeriodType] = useState<PeriodType>("daily");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    (new Date().getMonth() + 1).toString()
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const yearOptions = getYearOptions();

  // ... (fetchInsights, useEffect, handlePeriodNavigation, CurrentPeriodDisplay remain THE SAME as the previous version) ...
  const fetchInsights = useCallback(async () => {
    if ((periodType === "daily" && !selectedDate) || !selectedYear) {
      setInsights(null);
      return;
    }
    setLoading(true);
    setInsights(null);

    let rpcNames = {
      base: "",
      unpaid: "",
      newPatients: "",
      bilansPerDoctor: "",
      commonTestTypes: "",
      ristourne: "",
      incomeExpense: "",
    };
    let params: any = { top_n: TOP_N_COUNT };
    const yearNum = parseInt(selectedYear);
    const dateString =
      periodType === "daily" && selectedDate
        ? selectedDate.toISOString().split("T")[0]
        : undefined;
    const monthNum =
      periodType === "monthly" ? parseInt(selectedMonth) : undefined;

    switch (periodType) {
      case "daily":
        params = { ...params, target_date: dateString };
        rpcNames = {
          base: "get_daily_insights",
          unpaid: "get_daily_unpaid_total",
          newPatients: "get_daily_new_patients_count",
          bilansPerDoctor: "get_daily_bilans_per_doctor",
          commonTestTypes: "get_daily_common_test_types",
          ristourne: "get_daily_ristourne_generated",
          incomeExpense: "get_daily_income_expense_summary",
        };
        break;
      case "monthly":
        params = { ...params, year_num: yearNum, month_num: monthNum };
        rpcNames = {
          base: "get_monthly_insights",
          unpaid: "get_monthly_unpaid_total",
          newPatients: "get_monthly_new_patients_count",
          bilansPerDoctor: "get_monthly_bilans_per_doctor",
          commonTestTypes: "get_monthly_common_test_types",
          ristourne: "get_monthly_ristourne_generated",
          incomeExpense: "get_monthly_income_expense_summary",
        };
        break;
      case "yearly":
        params = { ...params, year_num: yearNum };
        rpcNames = {
          base: "get_yearly_insights",
          unpaid: "get_yearly_unpaid_total",
          newPatients: "get_yearly_new_patients_count",
          bilansPerDoctor: "get_yearly_bilans_per_doctor",
          commonTestTypes: "get_yearly_common_test_types",
          ristourne: "get_yearly_ristourne_generated",
          incomeExpense: "get_yearly_income_expense_summary",
        };
        break;
    }

    const baseParams =
      periodType === "daily"
        ? { target_date: params.target_date }
        : periodType === "monthly"
        ? { year_num: params.year_num, month_num: params.month_num }
        : { year_num: params.year_num };
    const listParams = params;

    try {
      const results = await Promise.all([
        supabase.rpc(rpcNames.base, baseParams),
        supabase.rpc(rpcNames.unpaid, baseParams),
        supabase.rpc(rpcNames.newPatients, baseParams),
        supabase.rpc(rpcNames.bilansPerDoctor, listParams),
        supabase.rpc(rpcNames.commonTestTypes, listParams),
        supabase.rpc(rpcNames.ristourne, baseParams),
        supabase.rpc(rpcNames.incomeExpense, baseParams),
      ]);

      const [
        baseRes,
        unpaidRes,
        newPatientsRes,
        doctorsRes,
        testsRes,
        ristourneRes,
        incomeExpenseRes,
      ] = results;

      const errors = results.map((r) => r.error).filter(Boolean);
      if (errors.length > 0) {
        errors.forEach((error) => console.error(`Erreur RPC:`, error));
        sonnerToast.error(`Erreur de chargement des aperçus`, {
          description: errors.map((e) => e.message).join("; "),
        });
        setInsights(null);
      } else {
        const rawBaseStats =
          baseRes.data && baseRes.data.length > 0 ? baseRes.data[0] : null;
        const rawUnpaidStats =
          unpaidRes.data && unpaidRes.data.length > 0
            ? unpaidRes.data[0]
            : null;
        const rawNewPatientsStats =
          newPatientsRes.data && newPatientsRes.data.length > 0
            ? newPatientsRes.data[0]
            : null;
        const topDoctors = (doctorsRes.data || []) as DoctorBilanStat[];
        const topTests = (testsRes.data || []) as TestTypeStat[];
        const rawRistourneStats =
          ristourneRes.data && ristourneRes.data.length > 0
            ? ristourneRes.data[0]
            : null;
        const rawIncomeExpenseStats =
          incomeExpenseRes.data && incomeExpenseRes.data.length > 0
            ? incomeExpenseRes.data[0]
            : null;

        const baseStats: BaseInsightData = rawBaseStats
          ? {
              bilan_count: rawBaseStats.bilan_count || 0,
              total_revenue_gross: rawBaseStats.total_revenue || 0,
              total_normal_price: rawBaseStats.total_normal_price || 0,
              total_insurance_price: rawBaseStats.total_insurance_price || 0,
            }
          : {
              bilan_count: 0,
              total_revenue_gross: 0,
              total_normal_price: 0,
              total_insurance_price: 0,
            };

        const unpaidStats: UnpaidInsightData = rawUnpaidStats
          ? { total_unpaid_amount: rawUnpaidStats.total_unpaid_amount || 0 }
          : { total_unpaid_amount: 0 };

        const newPatientsCount: NewPatientsData = rawNewPatientsStats
          ? { new_patient_count: rawNewPatientsStats.new_patient_count || 0 }
          : { new_patient_count: 0 };

        const ristourneGenerated: RistourneGeneratedData = rawRistourneStats
          ? { total_ristourne_fee: rawRistourneStats.total_ristourne_fee || 0 }
          : { total_ristourne_fee: 0 };

        const incomeExpenseData: IncomeExpenseSummaryData =
          rawIncomeExpenseStats
            ? {
                total_period_income:
                  rawIncomeExpenseStats.total_period_income || 0,
                total_period_expenses:
                  rawIncomeExpenseStats.total_period_expenses || 0,
                net_period_profit: rawIncomeExpenseStats.net_period_profit || 0,
              }
            : {
                total_period_income: 0,
                total_period_expenses: 0,
                net_period_profit: 0,
              };

        const collectedRevenue =
          baseStats.total_revenue_gross - unpaidStats.total_unpaid_amount;

        setInsights({
          ...baseStats,
          ...unpaidStats,
          ...newPatientsCount,
          ...ristourneGenerated,
          ...incomeExpenseData,
          total_revenue_collected: collectedRevenue >= 0 ? collectedRevenue : 0,
          top_doctors_bilans: topDoctors,
          top_test_types: topTests,
        });
      }
    } catch (error: any) {
      console.error(`Exception lors de la récupération des aperçus:`, error);
      sonnerToast.error(`Erreur de chargement des aperçus`, {
        description: error.message || "Une erreur inattendue s'est produite",
      });
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, [periodType, selectedDate, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handlePeriodNavigation = (direction: "prev" | "next") => {
    let newDate = selectedDate ? new Date(selectedDate) : new Date();
    let newMonth = parseInt(selectedMonth);
    let newYear = parseInt(selectedYear);

    switch (periodType) {
      case "daily":
        newDate.setDate(newDate.getDate() + (direction === "prev" ? -1 : 1));
        setSelectedDate(newDate);
        setSelectedMonth((newDate.getMonth() + 1).toString());
        setSelectedYear(newDate.getFullYear().toString());
        break;
      case "monthly":
        if (direction === "prev") {
          newMonth--;
          if (newMonth < 1) {
            newMonth = 12;
            newYear--;
          }
        } else {
          newMonth++;
          if (newMonth > 12) {
            newMonth = 1;
            newYear++;
          }
        }
        setSelectedMonth(newMonth.toString());
        setSelectedYear(newYear.toString());
        break;
      case "yearly":
        newYear += direction === "prev" ? -1 : 1;
        setSelectedYear(newYear.toString());
        break;
    }
  };

  const CurrentPeriodDisplay = () => {
    if (!selectedYear) return null;
    const yearNum = parseInt(selectedYear);
    switch (periodType) {
      case "daily":
        return selectedDate
          ? selectedDate.toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "Sélectionnez une date";
      case "monthly":
        const monthName =
          monthOptions.find((m) => m.value === selectedMonth)?.label || "";
        return `${monthName} ${yearNum}`;
      case "yearly":
        return `Année ${yearNum}`;
      default:
        return null;
    }
  };

  const revenueBreakdownData = insights
    ? [
        { name: "Revenu Normal", value: insights.total_normal_price || 0 },
        {
          name: "Revenu Assurance",
          value: insights.total_insurance_price || 0,
        },
      ].filter((item) => item.value > 0)
    : [];

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Aperçu des Données
      </h1>

      {/* Period Selection Card - remains the same */}
      <Card className="mb-6 shadow-md">
        <CardHeader>
          <CardTitle>Sélection de la Période</CardTitle>
          <CardDescription>
            Choisissez la granularité et la période pour afficher les
            statistiques.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-0 md:flex md:items-end md:space-x-4">
          <div className="flex-1 space-y-1">
            <label htmlFor="periodType" className="text-sm font-medium">
              Type de Période
            </label>
            <Select
              value={periodType}
              onValueChange={(value) => setPeriodType(value as PeriodType)}
            >
              <SelectTrigger id="periodType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Journalier</SelectItem>
                <SelectItem value="monthly">Mensuel</SelectItem>
                <SelectItem value="yearly">Annuel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodType === "daily" && (
            <div className="flex-1 space-y-1">
              <label htmlFor="dailyDate" className="text-sm font-medium">
                Date
              </label>
              <DatePicker date={selectedDate} setDate={setSelectedDate} />
            </div>
          )}
          {(periodType === "monthly" || periodType === "yearly") && (
            <div className="flex-1 space-y-1">
              <label htmlFor="yearSelect" className="text-sm font-medium">
                Année
              </label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger id="yearSelect">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {periodType === "monthly" && (
            <div className="flex-1 space-y-1">
              <label htmlFor="monthSelect" className="text-sm font-medium">
                Mois
              </label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="monthSelect">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            onClick={fetchInsights}
            variant="outline"
            className="w-full md:w-auto shrink-0"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Charger
          </Button>
        </CardContent>
      </Card>

      {/* Period Navigation - remains the same */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => handlePeriodNavigation("prev")}
          disabled={loading}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-semibold text-center text-slate-700">
          <CurrentPeriodDisplay />
        </h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => handlePeriodNavigation("next")}
          disabled={loading}
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-10">
          {" "}
          <Loader2 className="h-12 w-12 animate-spin text-sky-600" />{" "}
        </div>
      )}

      {!loading && insights && (
        <div className="space-y-8">
          {/* Section 1: Income/Expense Summary (based on income_expense_records) */}
          <Card className="shadow-xl">
            {/* ... (Income/Expense summary card remains the same) ... */}
            <CardHeader>
              <CardTitle className="text-xl flex items-center">
                <BarChartHorizontalBig className="h-6 w-6 mr-2 text-orange-500" />
                Résumé Financier (Enregistrements Journaliers)
              </CardTitle>
              <CardDescription>
                Basé sur les enregistrements de revenus/dépenses pour la
                période.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-slate-50">
                <p className="text-sm font-medium text-slate-600">
                  Revenus Période
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(insights.total_period_income)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50">
                <p className="text-sm font-medium text-slate-600">
                  Dépenses Période
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(insights.total_period_expenses)}
                </p>
              </div>
              <div
                className={`p-4 rounded-lg ${
                  insights.net_period_profit >= 0
                    ? "bg-green-100"
                    : "bg-red-100"
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    insights.net_period_profit >= 0
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  Profit Net Période
                </p>
                <p
                  className={`text-2xl font-bold ${
                    insights.net_period_profit >= 0
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {formatCurrency(insights.net_period_profit, true)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Patient & Bilan Activity */}
          {/* ... (Patient & Bilan Activity cards remain the same) ... */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Nouveaux Patients
                </CardTitle>
                <Users className="h-5 w-5 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-800">
                  {insights.new_patient_count}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Patients enregistrés.
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Nombre de Bilans
                </CardTitle>
                <FileText className="h-5 w-5 text-sky-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-800">
                  {insights.bilan_count}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Bilans (tests) traités.
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Frais de Ristourne
                </CardTitle>
                <Gift className="h-5 w-5 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-800">
                  {formatCurrency(insights.total_ristourne_fee)}
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Total des frais de référence.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Section 3: Revenue from Bilans (Patient Results) & Prominent Breakdown */}
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl flex items-center">
                <DollarSign className="h-6 w-6 mr-2 text-green-500" />
                Revenus des Bilans (Détail)
              </CardTitle>
              <CardDescription>
                Basé sur les prix des bilans patients pour la période
                sélectionnée.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm font-medium text-blue-700">
                    Revenu Brut Total (Bilans)
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(insights.total_revenue_gross)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm font-medium text-red-700">
                    Total Impayés (Bilans)
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(insights.total_unpaid_amount)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm font-medium text-green-700">
                    Revenu Net Collecté (Bilans)
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(insights.total_revenue_collected)}
                  </p>
                </div>
              </div>

              <hr className="my-4" />

              <div>
                <h3 className="text-lg font-semibold mb-3 text-slate-700 flex items-center">
                  <Divide className="h-5 w-5 mr-2 text-cyan-600" />
                  Répartition du Revenu Brut (Bilans)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-teal-50 border border-teal-200">
                    <p className="text-sm font-medium text-teal-700">
                      Part du Revenu Normal
                    </p>
                    <p className="text-2xl font-bold text-teal-600">
                      {formatCurrency(insights.total_normal_price)}
                    </p>
                    {insights.total_revenue_gross > 0 && (
                      <p className="text-xs text-muted-foreground">
                        (
                        {(
                          (insights.total_normal_price /
                            insights.total_revenue_gross) *
                          100
                        ).toFixed(1)}
                        %)
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                    <p className="text-sm font-medium text-purple-700">
                      Part du Revenu Assurance
                    </p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency(insights.total_insurance_price)}
                    </p>
                    {insights.total_revenue_gross > 0 && (
                      <p className="text-xs text-muted-foreground">
                        (
                        {(
                          (insights.total_insurance_price /
                            insights.total_revenue_gross) *
                          100
                        ).toFixed(1)}
                        %)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional: Keep Pie Chart if you want it, or remove if text is sufficient */}
              {revenueBreakdownData.length > 0 &&
                insights.total_revenue_gross > 0 && (
                  <div className="mt-6">
                    <h4 className="text-md font-semibold mb-2 text-slate-600 text-center">
                      Visualisation de la Répartition
                    </h4>
                    <div className="h-[250px] w-full max-w-md mx-auto">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={revenueBreakdownData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) =>
                              `${name.replace("Revenu ", "")}: ${(
                                percent * 100
                              ).toFixed(0)}%`
                            }
                          >
                            {revenueBreakdownData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  PIE_CHART_COLORS[
                                    index % PIE_CHART_COLORS.length
                                  ]
                                }
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [
                              formatCurrency(value),
                              "Montant",
                            ]}
                          />
                          <PieLegend
                            formatter={(value, entry) => (
                              <span style={{ color: entry.color }}>
                                {value}
                              </span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Section 4: Top Lists (Doctors and Test Types) */}
          {/* ... (remains the same as previous version) ... */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <DoctorIcon className="h-6 w-6 mr-2 text-teal-600" />
                  Top {TOP_N_COUNT} Médecins par Bilans
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.top_doctors_bilans.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={insights.top_doctors_bilans}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        dataKey="doctor_full_name"
                        type="category"
                        width={150}
                        interval={0}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `${value} bilans`,
                          "Nombre",
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="bilan_count"
                        name="Nb. Bilans"
                        fill="#14b8a6"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 italic">
                    Aucune donnée de médecin pour cette période.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Activity className="h-6 w-6 mr-2 text-purple-600" />
                  Top {TOP_N_COUNT} Types de Tests
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.top_test_types.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={insights.top_test_types}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        dataKey="test_type_name"
                        type="category"
                        width={150}
                        interval={0}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `${value} utilisations`,
                          "Nombre",
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="usage_count"
                        name="Nb. Utilisations"
                        fill="#8b5cf6"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 italic">
                    Aucune donnée de type de test pour cette période.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!loading && !insights && (
        <Card className="text-center py-10 text-slate-500 bg-slate-50 p-6 rounded-lg shadow border border-slate-200">
          {" "}
          <CardContent>
            {" "}
            <p className="text-lg">Aucune donnée à afficher.</p>{" "}
            <p className="text-sm mt-2">
              Veuillez sélectionner une période et cliquer sur "Charger", ou il
              n'y a pas de données pour les critères choisis.
            </p>{" "}
          </CardContent>{" "}
        </Card>
      )}
    </div>
  );
}
