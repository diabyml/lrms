import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Select from "react-select";
import {
  AlertCircle,
  ArrowLeft,
  BadgePercent,
  CalendarIcon,
  FileText,
  Loader2,
  Receipt,
  ShieldCheck,
  Stethoscope,
  UserPlus,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select as UiSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase, Tables } from "@/lib/supabaseClient";
import { generateId, validateId } from "@/lib/utils";

type Doctor = Pick<Tables<"doctor">, "id" | "full_name" | "hospital">;
type TestType = Pick<
  Tables<"test_type">,
  "id" | "name" | "normal_price" | "insurance_price"
>;

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const FactureFormPage: React.FC = () => {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>();
  const [selectedTestTypeIds, setSelectedTestTypeIds] = useState<string[]>([]);
  const [patientPrefix, setPatientPrefix] = useState("");
  const [patientFirstName, setPatientFirstName] = useState("");
  const [patientLastName, setPatientLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<string | undefined>();
  const [phone, setPhone] = useState("");
  const [hasInsurance, setHasInsurance] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [amountPaidTouched, setAmountPaidTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);

    const [doctorRes, testTypeRes] = await Promise.all([
      supabase
        .from("doctor")
        .select("id, full_name, hospital")
        .order("full_name"),
      supabase
        .from("test_type")
        .select("id, name, normal_price, insurance_price")
        .order("name"),
    ]);

    if (doctorRes.error) {
      setError(doctorRes.error.message);
    } else if (testTypeRes.error) {
      setError(testTypeRes.error.message);
    } else {
      setDoctors((doctorRes.data || []) as Doctor[]);
      setTestTypes((testTypeRes.data || []) as TestType[]);
    }

    setLoadingInitial(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedTests = useMemo(
    () => testTypes.filter((test) => selectedTestTypeIds.includes(test.id)),
    [selectedTestTypeIds, testTypes]
  );

  const totals = useMemo(() => {
    let normalTotal = 0;
    let insuranceTotal = 0;
    const subtotal = selectedTests.reduce((sum, test) => {
      const applied =
        hasInsurance && test.insurance_price != null
          ? Number(test.insurance_price || 0)
          : Number(test.normal_price || 0);
      if (hasInsurance && test.insurance_price != null) {
        insuranceTotal += applied;
      } else {
        normalTotal += applied;
      }
      return sum + applied;
    }, 0);
    const discount = Math.min(Math.max(toNumber(discountAmount), 0), subtotal);
    const total = Math.max(subtotal - discount, 0);
    const paid = Math.max(toNumber(amountPaid), 0);
    const remaining = Math.max(total - paid, 0);
    const status =
      paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

    return {
      normalTotal,
      insuranceTotal,
      subtotal,
      discount,
      total,
      paid,
      remaining,
      status,
    };
  }, [amountPaid, discountAmount, hasInsurance, selectedTests]);

  useEffect(() => {
    if (!amountPaidTouched) {
      setAmountPaid(String(totals.total));
    }
  }, [amountPaidTouched, totals.total]);

  const testOptions = useMemo(
    () =>
      testTypes.map((test) => ({
        value: test.id,
        label: `${test.name} · ${formatCurrency(test.normal_price)}${
          test.insurance_price != null
            ? ` · AMO ${formatCurrency(test.insurance_price)}`
            : ""
        }`,
      })),
    [testTypes]
  );

  const doctorOptions = useMemo(
    () =>
      doctors.map((doctor) => ({
        value: doctor.id,
        label: `${doctor.full_name}${
          doctor.hospital ? ` (${doctor.hospital})` : ""
        }`,
      })),
    [doctors]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!validateId(patientPrefix.trim())) {
      setError("L'ID patient doit commencer par 0 suivi d'un nombre.");
      return;
    }
    if (!patientFirstName.trim() || !patientLastName.trim()) {
      setError("Le prénom et le nom du patient sont requis.");
      return;
    }
    if (!selectedDoctorId) {
      setError("Veuillez sélectionner un médecin.");
      return;
    }
    if (selectedTestTypeIds.length === 0) {
      setError("Veuillez sélectionner au moins un type de test.");
      return;
    }

    setSubmitting(true);

    const { data, error: rpcError } = await supabase.rpc(
      "create_invoice_with_result",
      {
        p_patient: {
          patient_unique_id: generateId(patientPrefix.trim()),
          full_name: `${patientFirstName.trim()} ${patientLastName.trim()}`,
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
          phone: phone.trim() || null,
        },
        p_doctor_id: selectedDoctorId,
        p_test_type_ids: selectedTestTypeIds,
        p_has_insurance: hasInsurance,
        p_discount_amount: totals.discount,
        p_amount_paid: totals.paid,
        p_notes: notes.trim() || null,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }

    navigate(`/factures/${data}`);
  };

  if (loadingInitial) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link to="/factures">
        <Button variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux factures
        </Button>
      </Link>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <UserPlus className="h-5 w-5 text-primary" />
                Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="patientPrefix">
                  Préfixe ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="patientPrefix"
                  value={patientPrefix}
                  onChange={(event) => setPatientPrefix(event.target.value)}
                  placeholder="Ex: 021"
                  disabled={submitting}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  ID généré:{" "}
                  {validateId(patientPrefix)
                    ? generateId(patientPrefix)
                    : "Saisir un préfixe valide"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientFirstName">
                  Prénom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="patientFirstName"
                  value={patientFirstName}
                  onChange={(event) => setPatientFirstName(event.target.value)}
                  placeholder="Prénom du patient"
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientLastName">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="patientLastName"
                  value={patientLastName}
                  onChange={(event) => setPatientLastName(event.target.value)}
                  placeholder="Nom du patient"
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date de naissance</Label>
                <div className="relative">
                  <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(event) => setDateOfBirth(event.target.value)}
                    className="pl-10"
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Genre</Label>
                <UiSelect value={gender} onValueChange={setGender}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Homme</SelectItem>
                    <SelectItem value="Female">Femme</SelectItem>
                    <SelectItem value="Other">Autre</SelectItem>
                  </SelectContent>
                </UiSelect>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Téléphone"
                  disabled={submitting}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Stethoscope className="h-5 w-5 text-primary" />
                Médecin et bilans
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>
                  Médecin <span className="text-destructive">*</span>
                </Label>
                <Select
                  options={doctorOptions}
                  value={
                    doctorOptions.find(
                      (option) => option.value === selectedDoctorId
                    ) || null
                  }
                  onChange={(option) => setSelectedDoctorId(option?.value)}
                  placeholder="Rechercher un médecin..."
                  isDisabled={submitting}
                />
              </div>
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Checkbox
                  id="hasInsurance"
                  checked={hasInsurance}
                  onCheckedChange={(checked) => setHasInsurance(!!checked)}
                  disabled={submitting}
                />
                <Label
                  htmlFor="hasInsurance"
                  className="flex items-center gap-2 font-medium"
                >
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Patient couvert AMO
                </Label>
              </div>
              <div className="space-y-2">
                <Label>
                  Types de tests <span className="text-destructive">*</span>
                </Label>
                <Select
                  isMulti
                  options={testOptions}
                  value={testOptions.filter((option) =>
                    selectedTestTypeIds.includes(option.value)
                  )}
                  onChange={(options) =>
                    setSelectedTestTypeIds(
                      options.map((option) => option.value)
                    )
                  }
                  placeholder="Rechercher et sélectionner des tests..."
                  isDisabled={submitting}
                />
              </div>
              {selectedTests.length > 0 && (
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-[1fr_90px_90px_90px] gap-2 bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                    <span>Test</span>
                    <span className="text-right">Normal</span>
                    <span className="text-right">AMO</span>
                    <span className="text-right">Appliqué</span>
                  </div>
                  {selectedTests.map((test) => {
                    const covered = hasInsurance && test.insurance_price != null;
                    const applied = covered
                      ? test.insurance_price
                      : test.normal_price;
                    return (
                      <div
                        key={test.id}
                        className="grid grid-cols-[1fr_90px_90px_90px] gap-2 border-t px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{test.name}</span>
                        <span className="text-right">
                          {formatCurrency(test.normal_price)}
                        </span>
                        <span className="text-right">
                          {test.insurance_price == null
                            ? "-"
                            : formatCurrency(test.insurance_price)}
                        </span>
                        <span className="text-right font-semibold">
                          {formatCurrency(applied)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BadgePercent className="h-5 w-5 text-primary" />
                Paiement
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discount">Remise</Label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(event) => setDiscountAmount(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amountPaid">Montant payé</Label>
                <Input
                  id="amountPaid"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(event) => {
                    setAmountPaidTouched(true);
                    setAmountPaid(event.target.value);
                  }}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Notes optionnelles"
                  disabled={submitting}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Receipt className="h-5 w-5 text-primary" />
                Résumé facture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prix normaux</span>
                  <span>{formatCurrency(totals.normalTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AMO appliqué</span>
                  <span>{formatCurrency(totals.insuranceTotal)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remise</span>
                  <span>- {formatCurrency(totals.discount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payé</span>
                  <span>{formatCurrency(totals.paid)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Restant</span>
                  <span>{formatCurrency(totals.remaining)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Créer la facture
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
};

export default FactureFormPage;
