// src/pages/RistourneFormPage.tsx
import React, { useState, useEffect, FormEvent, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase, Tables } from "../lib/supabaseClient";

// --- date-fns Import ---
import { format } from "date-fns";

// --- Shadcn/ui Imports ---
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

// --- Icons ---
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  Save,
  Calculator,
  Info,
  Settings,
} from "lucide-react";

// --- Types ---
type Doctor = Tables<"doctor">;
type DoctorFeeConfig = Tables<"doctor_fee_config">;
type PatientResult = Tables<"patient_result"> & {
  patient: Tables<"patient">;
};

interface PatientResultWithFee extends PatientResult {
  calculatedFee: number;
  isSelected: boolean;
  isSelectedInitial?: boolean;
}

import "./RistourneFormPage.print.css";

const RistourneFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { ristourneId } = useParams<{ ristourneId: string }>();
  const isEditMode = Boolean(ristourneId);

  // --- State ---
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [doctorFeeConfig, setDoctorFeeConfig] =
    useState<DoctorFeeConfig | null>(null);
  const [normalPricePercentage, setNormalPricePercentage] =
    useState<number>(40);
  const [insurancePricePercentage, setInsurancePricePercentage] =
    useState<number>(100);
  const [savingFeeConfig, setSavingFeeConfig] = useState(false);
  const [patientResults, setPatientResults] = useState<PatientResultWithFee[]>(
    []
  );
  const [notes, setNotes] = useState<string>("");
  const [totalFee, setTotalFee] = useState<number>(0);
  const [status, setStatus] = useState<string>("pending");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Status Options ---
  const statusOptions = [
    { value: "pending", label: "En attente" },
    { value: "paid", label: "Payé" },
    // { value: "cancelled", label: "Annulé" }
  ];

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const { data, error } = await supabase.from("doctor").select("*");
        if (error) {
          setError("Erreur lors du chargement des médecins");
          console.error("Error fetching doctors:", error);
          return;
        }
        setDoctors(data || []);

        // If in edit mode, fetch the ristourne data
        if (isEditMode && ristourneId) {
          const { data: ristourneData, error: ristourneError } = await supabase
            .from("ristourne")
            .select(
              `
              *,
              doctor:doctor_id(*),
              ristourne_patient_result(
                *,
                patient_result:patient_result_id(
                  *,
                  patient:patient_id(*)
                )
              )
            `
            )
            .eq("id", ristourneId)
            .single();

          if (ristourneError) {
            setError("Erreur lors du chargement de la ristourne");
            console.error("Error fetching ristourne:", ristourneError);
            return;
          }

          if (ristourneData) {
            // Set doctor directly from the joined data
            setSelectedDoctor(ristourneData.doctor);
            setNotes(ristourneData.notes || "");
            setTotalFee(ristourneData.total_fee);
            setStatus(ristourneData.status);

            // Set selected patient results
            const patientResults = ristourneData.ristourne_patient_result.map(
              (rpr) => ({
                ...rpr.patient_result,
                calculatedFee: rpr.fee_amount,
                isSelected: true,
                isSelectedInitial: true,
                patient: rpr.patient_result.patient,
              })
            );
            setPatientResults(patientResults);

            // Fetch doctor fee config if doctor is available
            if (ristourneData.doctor) {
              const { data: feeConfigData } = await supabase
                .from("doctor_fee_config")
                .select("*")
                .eq("doctor_id", ristourneData.doctor.id)
                .order("effective_date", { ascending: false })
                .limit(1)
                .single();

              if (feeConfigData) {
                setDoctorFeeConfig(feeConfigData);
                setNormalPricePercentage(feeConfigData.normal_price_percentage);
                setInsurancePricePercentage(
                  feeConfigData.insurance_price_percentage
                );
                // Load all patient results with existing ones marked as selected
                await loadPatientResults(
                  ristourneData.doctor.id,
                  feeConfigData,
                  patientResults
                );
              }
            }
          }
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Une erreur est survenue lors du chargement des données");
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, [isEditMode, ristourneId]);

  // --- Calculations ---
  const calculateFee = (
    result: PatientResult,
    config: DoctorFeeConfig
  ): number => {
    const normalFee = result.normal_price
      ? (result.normal_price * config.normal_price_percentage) / 100
      : 0;

    const insuranceFee = result.insurance_price
      ? (result.insurance_price * config.insurance_price_percentage) / 100
      : 0;

    return Math.round(normalFee + insuranceFee);
  };

  const recalculateFeesAndTotal = useCallback(
    (results: PatientResultWithFee[], config: DoctorFeeConfig | null) => {
      if (!config) return results;

      const updatedResults = results.map((result) => ({
        ...result,
        calculatedFee: calculateFee(result, config),
      }));

      const total = updatedResults
        .filter((r) => r.isSelected)
        .reduce((sum, r) => sum + r.calculatedFee, 0);

      setTotalFee(total);
      return updatedResults;
    },
    []
  );

  // --- Handlers ---
  const handleResultSelection = (resultId: string, isSelected: boolean) => {
    setPatientResults((current) => {
      const updated = current.map((result) =>
        result.id === resultId ? { ...result, isSelected } : result
      );

      if (doctorFeeConfig) {
        const total = updated
          .filter((r) => r.isSelected)
          .reduce((sum, r) => sum + r.calculatedFee, 0);
        setTotalFee(total);
      }

      return updated;
    });
  };

  const handleSaveFeeConfig = async () => {
    if (!selectedDoctor) return;

    setSavingFeeConfig(true);
    try {
      const newConfig = {
        doctor_id: selectedDoctor.id,
        normal_price_percentage: normalPricePercentage,
        insurance_price_percentage: insurancePricePercentage,
        effective_date: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("doctor_fee_config")
        .insert(newConfig)
        .select()
        .single();

      if (error) throw error;

      setDoctorFeeConfig(data);
      setPatientResults((current) => recalculateFeesAndTotal(current, data));
      // Refetch patient results with new config
      await loadPatientResults(
        selectedDoctor.id,
        data,
        patientResults.filter((r) => r.isSelected)
      );
    } catch (err: any) {
      console.error("Error saving fee config:", err);
      setError(
        err.message ||
          "Une erreur est survenue lors de la sauvegarde de la configuration"
      );
    } finally {
      setSavingFeeConfig(false);
    }
  };

  const loadPatientResults = async (
    doctorId: string,
    config: DoctorFeeConfig,
    existingResults?: PatientResultWithFee[]
  ) => {
    let idsToInclude: string[] = [];
    if (existingResults && existingResults.length > 0) {
      idsToInclude = existingResults.map((r) => r.id);
    }

    // --- NEW LOGIC: Find results that are paid or pending in other ristournes ---
    let excludeResultIds: string[] = [];
    if (isEditMode && ristourneId) {
      // Fetch all patient_result_ids that are paid/pending in other ristournes
      const { data: lockedResults, error: lockedError } = await supabase
        .from("ristourne_patient_result")
        .select("patient_result_id, ristourne(status, id)");
      if (!lockedError && Array.isArray(lockedResults)) {
        excludeResultIds = lockedResults
          .filter(
            (r: any) =>
              r.ristourne &&
              ["paid", "pending"].includes(r.ristourne.status) &&
              r.ristourne.id !== ristourneId
          )
          .map((r: any) => r.patient_result_id);
      }
    } else {
      // In create mode, exclude all paid/pending results
      const { data: lockedResults, error: lockedError } = await supabase
        .from("ristourne_patient_result")
        .select("patient_result_id, ristourne(status)");
      if (!lockedError && Array.isArray(lockedResults)) {
        excludeResultIds = lockedResults
          .filter(
            (r: any) =>
              r.ristourne && ["paid", "pending"].includes(r.ristourne.status)
          )
          .map((r: any) => r.patient_result_id);
      }
    }

    // Fetch all unpaid results, and also any paid results that are part of the current ristourne
    let query = supabase
      .from("patient_result")
      .select("*, patient:patient_id(*)");

    // exclude patient_result where isFree is true
    query = query.eq("isFree", false);

    if (idsToInclude.length > 0) {
      // In edit mode: unpaid OR (paid AND id in selected)
      query = query.or(
        `paid_status.eq.unpaid,or(paid_status.eq.paid,id.in.(${idsToInclude.join(
          ","
        )}))`
      );
      query = query.eq("doctor_id", doctorId);
    } else {
      // In create mode: only unpaid
      query = query.eq("doctor_id", doctorId).eq("paid_status", "unpaid");
    }

    if (excludeResultIds.length > 0) {
      // Always allow those already selected in this ristourne (idsToInclude)
      const idsToReallyExclude = excludeResultIds.filter(
        (id) => !idsToInclude.includes(id)
      );
      if (idsToReallyExclude.length > 0) {
        query = query.not("id", "in", `(${idsToReallyExclude.join(",")})`);
      }
    }

    const { data, error } = await query;

    if (error) {
      setError("Erreur lors du chargement des résultats");
      console.error("Error fetching patient results:", error);
      return;
    }

    // Create a map of existing results for quick lookup
    const existingResultsMap = new Map(
      existingResults?.map((r) => [r.id, r]) || []
    );

    const resultsWithFee = (data || []).map((result) => {
      const existingResult = existingResultsMap.get(result.id);
      return {
        ...result,
        calculatedFee:
          existingResult?.calculatedFee || calculateFee(result, config),
        isSelected: Boolean(existingResult),
      };
    });

    setPatientResults(resultsWithFee);
    // Calculate total for selected results
    const total = resultsWithFee
      .filter((r) => r.isSelected)
      .reduce((sum, r) => sum + r.calculatedFee, 0);
    setTotalFee(total);
  };

  useEffect(() => {
    const fetchDoctorFeeConfig = async (doctorId: string) => {
      const { data, error } = await supabase
        .from("doctor_fee_config")
        .select("*")
        .eq("doctor_id", doctorId)
        .order("effective_date", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        setError("Erreur lors du chargement de la configuration des frais");
        console.error("Error fetching doctor fee config:", error);
        return;
      }

      if (data) {
        setDoctorFeeConfig(data);
        setNormalPricePercentage(data.normal_price_percentage);
        setInsurancePricePercentage(data.insurance_price_percentage);
        await loadPatientResults(doctorId, data, patientResults);
      } else {
        setDoctorFeeConfig(null);
        setNormalPricePercentage(40);
        setInsurancePricePercentage(100);
        setPatientResults([]);
      }
    };

    if (selectedDoctor) {
      fetchDoctorFeeConfig(selectedDoctor.id);
    } else {
      setDoctorFeeConfig(null);
      setPatientResults([]);
      setTotalFee(0);
    }
  }, [selectedDoctor]);

  const handleDoctorChange = (doctorId: string) => {
    const doctor = doctors.find((d) => d.id === doctorId);
    setSelectedDoctor(doctor || null);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor) {
      setError("Veuillez sélectionner un médecin");
      return;
    }

    const selectedResults = patientResults.filter((r) => r.isSelected);

    setSubmitting(true);
    setError(null);

    try {
      // Find previously selected but now unselected (only in edit mode)
      if (isEditMode) {
        const previouslySelectedIds = patientResults
          .filter((r) => r.isSelectedInitial)
          .map((r) => r.id);
        const nowUnselectedIds = previouslySelectedIds.filter(
          (id) => !selectedResults.some((r) => r.id === id)
        );
        if (nowUnselectedIds.length > 0) {
          // Update their paid_status to 'unpaid'
          await supabase
            .from("patient_result")
            .update({ paid_status: "unpaid" })
            .in("id", nowUnselectedIds);
        }
      }

      const { data, error } = await supabase.rpc("handle_ristourne_upsert", {
        p_ristourne_id: ristourneId || null,
        p_doctor_id: selectedDoctor.id,
        p_notes: notes,
        p_total_fee: totalFee,
        p_status: status,
        p_patient_results: selectedResults.map((result) => ({
          patient_result_id: result.id,
          fee_amount: result.calculatedFee,
        })),
      });

      if (error) throw error;

      // Navigate back to list with success message
      navigate("/ristournes", {
        state: {
          message: `Ristourne ${
            isEditMode ? "modifiée" : "créée"
          } avec succès.`,
        },
      });
    } catch (err: any) {
      console.error("Error saving ristourne:", err);
      setError(err.message || "Une erreur est survenue lors de la sauvegarde");
    } finally {
      setSubmitting(false);
    }
  };

  // Mark which results were initially selected (for edit mode)
  useEffect(() => {
    if (isEditMode && patientResults.length > 0) {
      setPatientResults((current) =>
        current.map((r) => ({
          ...r,
          isSelectedInitial: r.isSelectedInitial ?? r.isSelected,
        }))
      );
    }
  }, [isEditMode, patientResults.length]);

  // --- Select All State ---
  const allSelected =
    patientResults.length > 0 && patientResults.every((r) => r.isSelected);
  const someSelected = patientResults.some((r) => r.isSelected);

  const handleSelectAllChange = (checked: boolean) => {
    setPatientResults((current) =>
      current.map((result) => ({ ...result, isSelected: checked }))
    );
    if (doctorFeeConfig) {
      const total = patientResults
        .map((r) => ({ ...r, isSelected: checked }))
        .filter((r) => r.isSelected)
        .reduce((sum, r) => sum + r.calculatedFee, 0);
      setTotalFee(total);
    }
  };

  // --- Loading State ---
  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="ristourne-print-root container mx-auto p-4 space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center gap-2 print:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/ristournes")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isEditMode ? "Modifier" : "Nouvelle"} Ristourne
        </h1>
        <Button
          variant="default"
          className="ml-auto"
          onClick={() => window.print()}
        >
          Imprimer
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Print-only section: Doctor name and selected paid results */}
      <div className="ristourne-print-summary  hidden print:block">
        <h1>Ristourne: {selectedDoctor?.full_name || "-"}</h1>
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Date</th>
              <th>Prix</th>
              <th>Prix AMO</th>
              <th>Montant</th>
            </tr>
          </thead>
          <tbody>
            {patientResults.filter(
              (r) => r.isSelected && r.paid_status === "paid"
            ).length === 0 ? (
              <tr>
                <td colSpan={5}>Aucun résultat payé sélectionné</td>
              </tr>
            ) : (
              patientResults
                .filter((r) => r.isSelected && r.paid_status === "paid")
                .map((result) => (
                  <tr key={result.id}>
                    <td>{result.patient.full_name}</td>
                    <td>
                      {result.result_date
                        ? format(new Date(result.result_date), "dd/MM/yyyy")
                        : ""}
                    </td>
                    <td>{result.normal_price?.toLocaleString()} </td>
                    <td>{result.insurance_price?.toLocaleString()} </td>
                    <td>{result.calculatedFee.toLocaleString()} </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-end">
          <Badge variant="secondary" className="text-lg px-4 py-2">
            Total: {totalFee.toLocaleString()} FCFA
          </Badge>
        </div>
      </div>

      {/* Main Form (hide in print) */}
      <form
        className="ristourne-print-area print:hidden"
        onSubmit={handleSubmit}
      >
        {/* Doctor Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Sélection du Médecin</CardTitle>
            <CardDescription>
              Sélectionnez le médecin pour lequel vous souhaitez créer une
              ristourne
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedDoctor?.id}
              onValueChange={handleDoctorChange}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un médecin..." />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Fee Configuration */}
        {selectedDoctor && (
          <Card>
            <CardHeader>
              <CardTitle>Configuration des Frais</CardTitle>
              <CardDescription>
                {doctorFeeConfig
                  ? "Modifier la configuration des frais du médecin"
                  : "Créer une nouvelle configuration des frais pour le médecin"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="normalPrice">Pourcentage Prix Normal</Label>
                  <Input
                    id="normalPrice"
                    type="number"
                    min="0"
                    max="100"
                    value={normalPricePercentage}
                    onChange={(e) =>
                      setNormalPricePercentage(Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insurancePrice">
                    Pourcentage Prix Assurance
                  </Label>
                  <Input
                    id="insurancePrice"
                    type="number"
                    min="0"
                    max="100"
                    value={insurancePricePercentage}
                    onChange={(e) =>
                      setInsurancePricePercentage(Number(e.target.value))
                    }
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                onClick={handleSaveFeeConfig}
                disabled={savingFeeConfig}
              >
                {savingFeeConfig && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                {doctorFeeConfig ? "Mettre à jour" : "Enregistrer"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Patient Results Selection */}
        {selectedDoctor && doctorFeeConfig && (
          <Card>
            <CardHeader>
              <CardTitle>Sélection des Résultats</CardTitle>
              <CardDescription>
                Sélectionnez les résultats à inclure dans la ristourne
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        {/* Select All Checkbox */}
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected && !allSelected}
                          onCheckedChange={(checked) =>
                            handleSelectAllChange(!!checked)
                          }
                          disabled={submitting || patientResults.length === 0}
                          aria-label="Tout sélectionner"
                        />
                      </TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Prix Normal</TableHead>
                      <TableHead>Prix Assurance</TableHead>
                      <TableHead className="text-right">
                        Frais Calculés
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patientResults.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          Aucun résultat non payé trouvé pour ce médecin
                        </TableCell>
                      </TableRow>
                    ) : (
                      patientResults.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell>
                            <Checkbox
                              checked={result.isSelected}
                              onCheckedChange={(checked) =>
                                handleResultSelection(
                                  result.id,
                                  checked as boolean
                                )
                              }
                              disabled={submitting}
                            />
                          </TableCell>
                          <TableCell>{result.patient.full_name}</TableCell>
                          <TableCell>
                            {result.result_date
                              ? format(
                                  new Date(result.result_date),
                                  "dd/MM/yyyy"
                                )
                              : ""}
                          </TableCell>
                          <TableCell>
                            {result.normal_price?.toLocaleString()} FCFA
                          </TableCell>
                          <TableCell>
                            {result.insurance_price?.toLocaleString()} FCFA
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {result.calculatedFee.toLocaleString()} FCFA
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Total Fee */}
              <div className="mt-4 flex justify-end items-center gap-2 print:block">
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  Total: {totalFee.toLocaleString()} FCFA
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Statut</CardTitle>
            <CardDescription>
              Sélectionnez le statut de la ristourne
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un statut" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              Ajoutez des notes ou commentaires optionnels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes ou commentaires..."
              disabled={submitting}
            />
          </CardContent>
        </Card>

        {/* Form Actions */}
        <Card>
          <CardFooter className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/ristournes")}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting || !doctorFeeConfig}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Enregistrer
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
};

export default RistourneFormPage;
