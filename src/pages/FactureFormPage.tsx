import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import Select from "react-select";
import {
  AlertCircle,
  ArrowLeft,
  BadgePercent,
  CalendarIcon,
  FileText,
  Loader2,
  Mic,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserPlus,
  WandSparkles,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type SpeechRecognitionConstructor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

type SmartCandidate = {
  id: string;
  name: string;
  confidence: number;
};

type SmartTestMatch = {
  query: string;
  testTypeId: string | null;
  testTypeName: string | null;
  confidence: number;
  status: "accepted" | "uncertain" | "unresolved";
  selected: boolean;
  candidates: SmartCandidate[];
};

type SmartDoctorMatch = {
  query: string;
  doctorId: string | null;
  doctorName: string | null;
  confidence: number;
  status: "accepted" | "uncertain" | "unresolved";
  candidates: SmartCandidate[];
};

type SmartInvoiceDraft = {
  patientFirstName?: string;
  patientLastName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  doctorQuery?: string;
  doctorId?: string;
  testQueries: string[];
  testIds: string[];
  hasInsurance?: boolean;
  discountAmount?: number;
  amountPaid?: number;
  notes?: string;
};

type SmartInvoiceReview = {
  draft: SmartInvoiceDraft;
  doctor: SmartDoctorMatch;
  tests: SmartTestMatch[];
  raw: unknown;
};

const SMART_AI_ENDPOINT = import.meta.env.VITE_SMART_INVOICE_ENDPOINT as
  | string
  | undefined;
const SMART_AI_MODE =
  (import.meta.env.VITE_SMART_INVOICE_MODE as string | undefined) || "cloud";

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const levenshtein = (left: string, right: string) => {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
};

const scoreName = (query: string, candidate: string) => {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.includes(q) || q.includes(c)) return 0.88;

  const qTokens = new Set(q.split(" ").filter(Boolean));
  const cTokens = new Set(c.split(" ").filter(Boolean));
  const overlap = [...qTokens].filter((token) => cTokens.has(token)).length;
  const tokenScore = overlap / Math.max(qTokens.size, cTokens.size, 1);
  const distance = levenshtein(q, c);
  const editScore = 1 - distance / Math.max(q.length, c.length, 1);

  return Math.max(tokenScore * 0.9, editScore);
};

const topCandidates = <T extends { id: string; name?: string; full_name?: string }>(
  query: string,
  items: T[]
): SmartCandidate[] =>
  items
    .map((item) => ({
      id: item.id,
      name: item.name || item.full_name || "",
      confidence: scoreName(query, item.name || item.full_name || ""),
    }))
    .filter((candidate) => candidate.confidence >= 0.45)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 3);

const confidenceStatus = (confidence: number) => {
  if (confidence >= 0.8) return "accepted" as const;
  if (confidence >= 0.58) return "uncertain" as const;
  return "unresolved" as const;
};

const asNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const normalizeGender = (value: unknown): string | undefined => {
  const normalized = normalizeText(String(value || ""));
  if (["male", "homme", "masculin", "m"].includes(normalized)) return "Male";
  if (["female", "femme", "feminin", "f"].includes(normalized)) return "Female";
  if (normalized) return "Other";
  return undefined;
};

const normalizeAiDraft = (raw: any): SmartInvoiceDraft => {
  const source = raw?.draft || raw?.invoice || raw?.data || raw || {};
  const patient = source.patient || {};
  const doctor = source.doctor || {};
  const testItems = source.tests || source.testTypes || source.test_types || [];
  const testQueries = Array.isArray(testItems)
    ? testItems
        .map((item: any) =>
          typeof item === "string"
            ? item
            : item?.query || item?.name || item?.test_name || item?.label
        )
        .filter(Boolean)
        .map(String)
    : [];
  const testIds = Array.isArray(testItems)
    ? testItems
        .map((item: any) => (typeof item === "object" ? item?.id || item?.test_type_id : null))
        .filter(Boolean)
        .map(String)
    : [];

  return {
    patientFirstName:
      asString(patient.firstName) ||
      asString(patient.firstname) ||
      asString(patient.first_name) ||
      asString(source.patientFirstName) ||
      asString(source.patient_firstname),
    patientLastName:
      asString(patient.lastName) ||
      asString(patient.lastname) ||
      asString(patient.last_name) ||
      asString(source.patientLastName) ||
      asString(source.patient_lastname),
    phone: asString(patient.phone) || asString(source.phone),
    dateOfBirth:
      asString(patient.dateOfBirth) ||
      asString(patient.date_of_birth) ||
      asString(source.dateOfBirth) ||
      asString(source.date_of_birth),
    gender: normalizeGender(patient.gender || source.gender),
    doctorQuery:
      asString(doctor.name) ||
      asString(doctor.query) ||
      asString(source.doctorQuery) ||
      asString(source.doctor_query) ||
      asString(source.doctor),
    doctorId: asString(doctor.id) || asString(source.doctor_id),
    testQueries,
    testIds,
    hasInsurance:
      typeof source.hasInsurance === "boolean"
        ? source.hasInsurance
        : typeof source.has_insurance === "boolean"
          ? source.has_insurance
          : typeof source.amo === "boolean"
            ? source.amo
            : undefined,
    discountAmount:
      asNumber(source.discountAmount) || asNumber(source.discount_amount),
    amountPaid: asNumber(source.amountPaid) || asNumber(source.amount_paid),
    notes: asString(source.notes),
  };
};

const buildSmartReview = (
  raw: unknown,
  doctors: Doctor[],
  testTypes: TestType[]
): SmartInvoiceReview => {
  const draft = normalizeAiDraft(raw);
  const doctorById = draft.doctorId
    ? doctors.find((doctor) => doctor.id === draft.doctorId)
    : undefined;
  const doctorCandidates = topCandidates(draft.doctorQuery || "", doctors);
  const bestDoctor = doctorById
    ? { id: doctorById.id, name: doctorById.full_name, confidence: 1 }
    : doctorCandidates[0];
  const doctorConfidence = bestDoctor?.confidence || 0;

  const testsById = new Map(testTypes.map((test) => [test.id, test]));
  const queries = [
    ...draft.testIds
      .map((id) => testsById.get(id)?.name)
      .filter(Boolean)
      .map(String),
    ...draft.testQueries,
  ];
  const uniqueQueries = [...new Set(queries.map((query) => query.trim()).filter(Boolean))];
  const seenTestIds = new Set<string>();

  const tests = uniqueQueries.map((query) => {
    const direct = testTypes.find((test) => normalizeText(test.name) === normalizeText(query));
    const candidates = direct
      ? [{ id: direct.id, name: direct.name, confidence: 1 }]
      : topCandidates(query, testTypes);
    const best = candidates[0];
    const confidence = best?.confidence || 0;
    const status = confidenceStatus(confidence);
    const duplicate = best?.id ? seenTestIds.has(best.id) : false;
    if (best?.id && !duplicate) seenTestIds.add(best.id);

    return {
      query,
      testTypeId: best?.id && !duplicate && status !== "unresolved" ? best.id : null,
      testTypeName: best?.name && !duplicate && status !== "unresolved" ? best.name : null,
      confidence,
      status: duplicate ? "unresolved" : status,
      selected: Boolean(best?.id && !duplicate && status !== "unresolved"),
      candidates,
    } satisfies SmartTestMatch;
  });

  return {
    draft,
    doctor: {
      query: draft.doctorQuery || "",
      doctorId: bestDoctor?.id || null,
      doctorName: bestDoctor?.name || null,
      confidence: doctorConfidence,
      status: confidenceStatus(doctorConfidence),
      candidates: doctorCandidates,
    },
    tests,
    raw,
  };
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
  const [smartOpen, setSmartOpen] = useState(false);
  const [smartTranscript, setSmartTranscript] = useState("");
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [smartReview, setSmartReview] = useState<SmartInvoiceReview | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);

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

  const speechSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
    []
  );

  const handleSmartListen = () => {
    if (!speechSupported) {
      setSmartError("La dictée vocale n'est pas disponible dans ce navigateur.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const Recognition =
      ((window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition) as SpeechRecognitionConstructor;
    const recognition = new Recognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const text = Array.from(event.results || [])
        .map((result: any) => result?.[0]?.transcript || "")
        .join(" ")
        .trim();
      if (text) {
        setSmartTranscript((current) => [current, text].filter(Boolean).join(" "));
      }
    };
    recognition.onerror = () => {
      setSmartError("Impossible de récupérer la dictée vocale.");
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setSmartError(null);
    setIsListening(true);
    recognition.start();
  };

  const handleSmartAnalyze = async () => {
    if (!smartTranscript.trim()) {
      setSmartError("Dictez ou saisissez une instruction de facture.");
      return;
    }
    if (!SMART_AI_ENDPOINT) {
      setSmartError(
        "Configurez VITE_SMART_INVOICE_ENDPOINT pour utiliser l'assistant IA."
      );
      return;
    }

    setSmartLoading(true);
    setSmartError(null);

    try {
      const response = await fetch(SMART_AI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: SMART_AI_MODE,
          transcript: smartTranscript.trim(),
          doctors,
          testTypes,
          responseFormat: {
            patient: {
              firstName: "string",
              lastName: "string",
              phone: "string",
              dateOfBirth: "YYYY-MM-DD",
              gender: "Male|Female|Other",
            },
            doctor: { id: "string optional", name: "string" },
            tests: [{ id: "string optional", name: "string", query: "string" }],
            hasInsurance: "boolean",
            discountAmount: "number",
            amountPaid: "number",
            notes: "string",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur assistant IA (${response.status})`);
      }

      const contentType = response.headers.get("content-type") || "";
      const raw = contentType.includes("application/json")
        ? await response.json()
        : JSON.parse(await response.text());
      setSmartReview(buildSmartReview(raw, doctors, testTypes));
    } catch (err: any) {
      setSmartError(err?.message || "Impossible d'analyser la facture.");
    } finally {
      setSmartLoading(false);
    }
  };

  const updateSmartTestMatch = (query: string, testTypeId: string | null) => {
    setSmartReview((current) => {
      if (!current) return current;
      const test = testTypeId ? testTypes.find((item) => item.id === testTypeId) : null;
      return {
        ...current,
        tests: current.tests.map((match) =>
          match.query === query
            ? {
                ...match,
                testTypeId: test?.id || null,
                testTypeName: test?.name || null,
                selected: Boolean(test),
                status: test ? "accepted" : "unresolved",
                confidence: test ? Math.max(match.confidence, 0.8) : 0,
              }
            : match
        ),
      };
    });
  };

  const toggleSmartTest = (query: string, checked: boolean) => {
    setSmartReview((current) =>
      current
        ? {
            ...current,
            tests: current.tests.map((match) =>
              match.query === query ? { ...match, selected: checked } : match
            ),
          }
        : current
    );
  };

  const updateSmartDoctor = (doctorId: string | null) => {
    setSmartReview((current) => {
      if (!current) return current;
      const doctor = doctorId ? doctors.find((item) => item.id === doctorId) : null;
      return {
        ...current,
        doctor: {
          ...current.doctor,
          doctorId: doctor?.id || null,
          doctorName: doctor?.full_name || null,
          status: doctor ? "accepted" : "unresolved",
          confidence: doctor ? Math.max(current.doctor.confidence, 0.8) : 0,
        },
      };
    });
  };

  const handleApplySmartDraft = () => {
    if (!smartReview) return;

    const { draft } = smartReview;
    if (draft.patientFirstName) setPatientFirstName(draft.patientFirstName);
    if (draft.patientLastName) setPatientLastName(draft.patientLastName);
    if (draft.phone) setPhone(draft.phone);
    if (draft.dateOfBirth) setDateOfBirth(draft.dateOfBirth);
    if (draft.gender) setGender(draft.gender);
    if (typeof draft.hasInsurance === "boolean") setHasInsurance(draft.hasInsurance);
    if (draft.discountAmount !== undefined) setDiscountAmount(String(draft.discountAmount));
    if (draft.amountPaid !== undefined) {
      setAmountPaidTouched(true);
      setAmountPaid(String(draft.amountPaid));
    }
    if (draft.notes) setNotes(draft.notes);
    if (smartReview.doctor.doctorId) setSelectedDoctorId(smartReview.doctor.doctorId);

    const matchedTestIds = smartReview.tests
      .filter((match) => match.selected && match.testTypeId)
      .map((match) => match.testTypeId as string);
    if (matchedTestIds.length > 0) {
      setSelectedTestTypeIds((current) => [...new Set([...current, ...matchedTestIds])]);
    }

    setSmartOpen(false);
    setSmartError(null);
  };

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/factures">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux factures
          </Button>
        </Link>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => setSmartOpen(true)}
          className="w-full sm:w-auto"
        >
          <WandSparkles className="mr-2 h-4 w-4" />
          Smart invoice
        </Button>
      </div>

      <Dialog open={smartOpen} onOpenChange={setSmartOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Assistant facture intelligent
            </DialogTitle>
            <DialogDescription>
              Dictez ou saisissez la facture. L'assistant propose un brouillon,
              puis vous confirmez avant de remplir le formulaire.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {smartError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Assistant IA</AlertTitle>
                <AlertDescription>{smartError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="smartTranscript">Instruction</Label>
                <Badge variant={SMART_AI_ENDPOINT ? "secondary" : "outline"}>
                  {SMART_AI_MODE} {SMART_AI_ENDPOINT ? "configuré" : "non configuré"}
                </Badge>
              </div>
              <Textarea
                id="smartTranscript"
                value={smartTranscript}
                onChange={(event) => setSmartTranscript(event.target.value)}
                rows={5}
                placeholder="Ex: Facture pour Mamadou Traoré, docteur Coulibaly, NFS, CRP, glycémie, AMO, payé 15000"
                disabled={smartLoading}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSmartListen}
                  disabled={smartLoading}
                >
                  {isListening ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mic className="mr-2 h-4 w-4" />
                  )}
                  {isListening ? "Écoute..." : "Dicter"}
                </Button>
                <Button
                  type="button"
                  onClick={handleSmartAnalyze}
                  disabled={smartLoading || !smartTranscript.trim()}
                >
                  {smartLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Analyser
                </Button>
              </div>
            </div>

            {smartReview && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Patient</p>
                    <p className="text-sm text-muted-foreground">
                      {[smartReview.draft.patientFirstName, smartReview.draft.patientLastName]
                        .filter(Boolean)
                        .join(" ") || "Non détecté"}
                    </p>
                    {(smartReview.draft.phone || smartReview.draft.dateOfBirth) && (
                      <p className="text-xs text-muted-foreground">
                        {[smartReview.draft.phone, smartReview.draft.dateOfBirth]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Médecin</p>
                    {smartReview.doctor.doctorId ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            smartReview.doctor.status === "accepted"
                              ? "default"
                              : "outline"
                          }
                        >
                          {Math.round(smartReview.doctor.confidence * 100)}%
                        </Badge>
                        <span className="text-sm">{smartReview.doctor.doctorName}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-destructive">
                        Médecin non résolu
                      </p>
                    )}
                    {smartReview.doctor.candidates.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {smartReview.doctor.candidates.map((candidate) => (
                          <Button
                            key={candidate.id}
                            type="button"
                            size="sm"
                            variant={
                              candidate.id === smartReview.doctor.doctorId
                                ? "default"
                                : "outline"
                            }
                            onClick={() => updateSmartDoctor(candidate.id)}
                          >
                            {candidate.name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Tests détectés</p>
                  <div className="space-y-2">
                    {smartReview.tests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucun test détecté.
                      </p>
                    ) : (
                      smartReview.tests.map((match) => (
                        <div
                          key={match.query}
                          className="rounded-md border p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{match.query}</p>
                              {match.testTypeName ? (
                                <p className="text-muted-foreground">
                                  {match.testTypeName}
                                </p>
                              ) : (
                                <p className="text-destructive">Non résolu</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  match.status === "accepted"
                                    ? "default"
                                    : match.status === "uncertain"
                                      ? "outline"
                                      : "destructive"
                                }
                              >
                                {Math.round(match.confidence * 100)}%
                              </Badge>
                              <Checkbox
                                checked={match.selected}
                                disabled={!match.testTypeId}
                                onCheckedChange={(checked) =>
                                  toggleSmartTest(match.query, Boolean(checked))
                                }
                                aria-label={`Inclure ${match.query}`}
                              />
                            </div>
                          </div>
                          {match.candidates.length > 1 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {match.candidates.map((candidate) => (
                                <Button
                                  key={candidate.id}
                                  type="button"
                                  size="sm"
                                  variant={
                                    candidate.id === match.testTypeId
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() =>
                                    updateSmartTestMatch(match.query, candidate.id)
                                  }
                                >
                                  {candidate.name}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground">AMO</span>
                    <p className="font-medium">
                      {smartReview.draft.hasInsurance === undefined
                        ? "-"
                        : smartReview.draft.hasInsurance
                          ? "Oui"
                          : "Non"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Remise</span>
                    <p className="font-medium">
                      {smartReview.draft.discountAmount === undefined
                        ? "-"
                        : formatCurrency(smartReview.draft.discountAmount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payé</span>
                    <p className="font-medium">
                      {smartReview.draft.amountPaid === undefined
                        ? "-"
                        : formatCurrency(smartReview.draft.amountPaid)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSmartOpen(false)}
            >
              Fermer
            </Button>
            <Button
              type="button"
              onClick={handleApplySmartDraft}
              disabled={!smartReview || smartLoading}
            >
              Appliquer au brouillon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
