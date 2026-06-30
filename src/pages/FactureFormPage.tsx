import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import {
  AlertCircle,
  ArrowLeft,
  BadgePercent,
  CalendarIcon,
  Camera,
  FileText,
  Loader2,
  Mic,
  RefreshCcw,
  Receipt,
  ScanText,
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
import {
  getDisplayTestName,
  InvoicePickerProfile,
  InvoiceTestPicker,
} from "@/components/invoice/InvoiceTestPicker";
import { supabase, Tables } from "@/lib/supabaseClient";
import { extractId, generateId, validateId } from "@/lib/utils";

type Doctor = Pick<Tables<"doctor">, "id" | "full_name" | "hospital">;
type TestType = Pick<
  Tables<"test_type">,
  | "id"
  | "name"
  | "code"
  | "normal_price"
  | "insurance_price"
  | "is_active"
  | "is_orderable"
  | "include_in_invoice_description"
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
  code?: string | null;
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
  isFreeInvoice?: boolean;
  isHalfPayInvoice?: boolean;
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

type InvoiceEditPayload = {
  id: string;
  doctor_id: string;
  has_insurance: boolean;
  subtotal: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  patient: {
    full_name: string | null;
    patient_unique_id: string | null;
    date_of_birth: string | null;
    gender: string | null;
    phone: string | null;
  } | null;
  patient_result: {
    isFree: boolean | null;
  } | null;
  invoice_item: Array<{
    test_type_id: string;
    applied_price: number;
    test_type: TestType | null;
  }>;
};

type TestProfilePayload = {
  id: string;
  name: string;
  description: string | null;
  test_profile_item: Array<{
    sort_order: number;
    test_type: TestType | null;
  }>;
};

type SmartInvoiceProvider =
  | "gemini"
  | "deepseek"
  | "openrouter"
  | "openai-compatible"
  | "local"
  | "cloud";

type SmartInputMode = "text" | "scan";
type OcrWorker = Awaited<
  ReturnType<typeof import("tesseract.js").createWorker>
>;

const SMART_AI_PROVIDER = (
  (import.meta.env.VITE_SMART_INVOICE_PROVIDER as string | undefined) ||
  (import.meta.env.VITE_SMART_INVOICE_MODE as string | undefined) ||
  "openai-compatible"
).toLowerCase() as SmartInvoiceProvider;
const SMART_AI_ENDPOINT = import.meta.env.VITE_SMART_INVOICE_ENDPOINT as
  | string
  | undefined;
const SMART_AI_API_KEY = import.meta.env.VITE_SMART_INVOICE_API_KEY as
  | string
  | undefined;
const SMART_AI_MODEL =
  (import.meta.env.VITE_SMART_INVOICE_MODEL as string | undefined) ||
  (SMART_AI_PROVIDER === "gemini"
    ? "gemini-1.5-flash"
    : SMART_AI_PROVIDER === "deepseek"
      ? "deepseek-chat"
      : SMART_AI_PROVIDER === "openrouter"
        ? "openrouter/free"
        : "qwen3.5:9b");
const SMART_AI_TIMEOUT_MS = 45_000;
const SMART_AI_IS_CONFIGURED =
  SMART_AI_PROVIDER === "gemini" ||
  SMART_AI_PROVIDER === "deepseek" ||
  SMART_AI_PROVIDER === "openrouter"
    ? Boolean(SMART_AI_API_KEY)
    : Boolean(SMART_AI_ENDPOINT);
const SMART_AI_BADGE_TEXT = `${SMART_AI_PROVIDER} / ${SMART_AI_MODEL} ${
  SMART_AI_IS_CONFIGURED ? "configuré" : "non configuré"
}`;

type SmartInvoicePrompt = {
  systemPrompt: string;
  userPrompt: string;
};

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDefaultAppliedPrice = (test: TestType, hasInsurance: boolean) =>
  hasInsurance && test.insurance_price != null
    ? Number(test.insurance_price || 0)
    : Number(test.normal_price || 0);

const almostEqual = (left: number, right: number) =>
  Math.abs(Number(left || 0) - Number(right || 0)) < 0.01;

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeCode = (value: string | null | undefined) =>
  normalizeText(value || "");

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

const topCandidates = <
  T extends { id: string; name?: string; full_name?: string; code?: string | null },
>(
  query: string,
  items: T[]
): SmartCandidate[] =>
  items
    .map((item) => ({
      id: item.id,
      name: item.name || item.full_name || "",
      code: item.code,
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

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(String(value || ""));
  if (["true", "oui", "yes", "1", "vrai"].includes(normalized)) return true;
  if (["false", "non", "no", "0", "faux"].includes(normalized)) return false;
  return undefined;
};

const normalizeGender = (value: unknown): string | undefined => {
  const normalized = normalizeText(String(value || ""));
  if (["male", "homme", "masculin", "m"].includes(normalized)) return "Male";
  if (["female", "femme", "feminin", "f"].includes(normalized)) return "Female";
  if (normalized) return "Other";
  return undefined;
};

const readResponseText = async (response: Response) => {
  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(
      `Erreur assistant IA (${response.status})${
        body ? " : " + body.slice(0, 300) : ""
      }`
    );
  }
  return body;
};

const extractSmartInvoiceJson = (content: string) => {
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    throw new Error(
      "La réponse du modèle n'est pas un JSON valide. Réessayez avec une instruction plus simple."
    );
  }
};

const callOpenAiCompatibleSmartInvoice = async (
  prompt: SmartInvoicePrompt,
  signal: AbortSignal
) => {
  if (!SMART_AI_ENDPOINT) {
    throw new Error(
      "Configurez VITE_SMART_INVOICE_ENDPOINT pour utiliser l'assistant IA."
    );
  }

  const response = await fetch(SMART_AI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: SMART_AI_MODEL,
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt },
      ],
      temperature: 0.1,
      stream: false,
    }),
    signal,
  });

  const responseText = await readResponseText(response);
  const data = JSON.parse(responseText);
  const content =
    data?.choices?.[0]?.message?.content ||
    data?.response ||
    data?.message?.content ||
    "";
  if (!content) {
    throw new Error("Réponse vide du modèle.");
  }
  return String(content);
};

const callGeminiSmartInvoice = async (
  prompt: SmartInvoicePrompt,
  signal: AbortSignal
) => {
  if (!SMART_AI_API_KEY) {
    throw new Error("Configurez VITE_SMART_INVOICE_API_KEY pour Gemini.");
  }

  const model = encodeURIComponent(SMART_AI_MODEL);
  const key = encodeURIComponent(SMART_AI_API_KEY);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: prompt.systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt.userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
      signal,
    }
  );

  const responseText = await readResponseText(response);
  const data = JSON.parse(responseText);
  const content =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("") || "";
  if (!content) {
    throw new Error("Réponse vide de Gemini.");
  }
  return content;
};

const callDeepSeekSmartInvoice = async (
  prompt: SmartInvoicePrompt,
  signal: AbortSignal
) => {
  if (!SMART_AI_API_KEY) {
    throw new Error("Configurez VITE_SMART_INVOICE_API_KEY pour DeepSeek.");
  }

  const response = await fetch(
    SMART_AI_ENDPOINT || "https://api.deepseek.com/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SMART_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: SMART_AI_MODEL,
        messages: [
          { role: "system", content: prompt.systemPrompt },
          { role: "user", content: prompt.userPrompt },
        ],
        temperature: 0.1,
        stream: false,
        response_format: { type: "json_object" },
      }),
      signal,
    }
  );

  const responseText = await readResponseText(response);
  const data = JSON.parse(responseText);
  const content = data?.choices?.[0]?.message?.content || "";
  if (!content) {
    throw new Error("Réponse vide de DeepSeek.");
  }
  return content;
};

const callOpenRouterSmartInvoice = async (
  prompt: SmartInvoicePrompt,
  signal: AbortSignal
) => {
  if (!SMART_AI_API_KEY) {
    throw new Error("Configurez VITE_SMART_INVOICE_API_KEY pour OpenRouter.");
  }

  const response = await fetch(
    SMART_AI_ENDPOINT || "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SMART_AI_API_KEY}`,
        "HTTP-Referer": window.location.origin,
        "X-Title": "LRMS SmartInvoice",
      },
      body: JSON.stringify({
        model: SMART_AI_MODEL,
        messages: [
          { role: "system", content: prompt.systemPrompt },
          { role: "user", content: prompt.userPrompt },
        ],
        temperature: 0.1,
        stream: false,
        response_format: { type: "json_object" },
      }),
      signal,
    }
  );

  const responseText = await readResponseText(response);
  const data = JSON.parse(responseText);
  const content = data?.choices?.[0]?.message?.content || "";
  if (!content) {
    throw new Error("Réponse vide d'OpenRouter.");
  }
  return content;
};

const callSmartInvoiceProvider = (
  prompt: SmartInvoicePrompt,
  signal: AbortSignal
) => {
  if (SMART_AI_PROVIDER === "gemini") {
    return callGeminiSmartInvoice(prompt, signal);
  }
  if (SMART_AI_PROVIDER === "deepseek") {
    return callDeepSeekSmartInvoice(prompt, signal);
  }
  if (SMART_AI_PROVIDER === "openrouter") {
    return callOpenRouterSmartInvoice(prompt, signal);
  }
  if (
    SMART_AI_PROVIDER === "openai-compatible" ||
    SMART_AI_PROVIDER === "local" ||
    SMART_AI_PROVIDER === "cloud"
  ) {
    return callOpenAiCompatibleSmartInvoice(prompt, signal);
  }
  throw new Error(
    `Provider SmartInvoice non supporté: ${SMART_AI_PROVIDER}. Utilisez gemini, deepseek, openrouter ou openai-compatible.`
  );
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
      asBoolean(source.hasInsurance) ??
      asBoolean(source.has_insurance) ??
      asBoolean(source.amo) ??
      asBoolean(source.insurance),
    isFreeInvoice:
      asBoolean(source.isFreeInvoice) ??
      asBoolean(source.is_free_invoice) ??
      asBoolean(source.freeInvoice) ??
      asBoolean(source.free_invoice) ??
      asBoolean(source.gratuit) ??
      asBoolean(source.isFree),
    isHalfPayInvoice:
      asBoolean(source.isHalfPayInvoice) ??
      asBoolean(source.is_half_pay_invoice) ??
      asBoolean(source.halfPayInvoice) ??
      asBoolean(source.half_pay_invoice) ??
      asBoolean(source.demiTarif) ??
      asBoolean(source.demi_tarif),
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
    const direct = testTypes.find(
      (test) =>
        normalizeText(test.name) === normalizeText(query) ||
        (test.code && normalizeCode(test.code) === normalizeCode(query))
    );
    const candidates = direct
      ? [{ id: direct.id, name: direct.name, code: direct.code, confidence: 1 }]
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
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const isEditMode = Boolean(invoiceId);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [testProfiles, setTestProfiles] = useState<InvoicePickerProfile[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>();
  const [selectedTestTypeIds, setSelectedTestTypeIds] = useState<string[]>([]);
  const [appliedPrices, setAppliedPrices] = useState<Record<string, string>>({});
  const [manualPriceTestIds, setManualPriceTestIds] = useState<Set<string>>(
    () => new Set()
  );
  const [patientPrefix, setPatientPrefix] = useState("");
  const [patientFirstName, setPatientFirstName] = useState("");
  const [patientLastName, setPatientLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<string | undefined>();
  const [phone, setPhone] = useState("");
  const [hasInsurance, setHasInsurance] = useState(false);
  const [isFreeInvoice, setIsFreeInvoice] = useState(false);
  const [isHalfPayInvoice, setIsHalfPayInvoice] = useState(false);
  const [discountAmount, setDiscountAmount] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [amountPaidTouched, setAmountPaidTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceAiEnabled, setInvoiceAiEnabled] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);
  const [smartMode, setSmartMode] = useState<SmartInputMode>("text");
  const [smartTranscript, setSmartTranscript] = useState("");
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [smartReview, setSmartReview] = useState<SmartInvoiceReview | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [smartOcrText, setSmartOcrText] = useState("");
  const [smartOcrLoading, setSmartOcrLoading] = useState(false);
  const [smartOcrProgress, setSmartOcrProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);

    const invoicePromise = invoiceId
      ? supabase
          .from("invoice")
          .select(
            `
            id,
            doctor_id,
            has_insurance,
            subtotal,
            discount_amount,
            total,
            amount_paid,
            notes,
            patient:patient_id(full_name, patient_unique_id, date_of_birth, gender, phone),
            patient_result:patient_result_id(isFree),
            invoice_item(
              test_type_id,
              applied_price,
              test_type:test_type_id(
                id,
                name,
                code,
                normal_price,
                insurance_price,
                is_active,
                is_orderable,
                include_in_invoice_description
              )
            )
          `
          )
          .eq("id", invoiceId)
          .single()
      : Promise.resolve({ data: null, error: null });
    const invoiceAiSettingsPromise = supabase
      .from("settings")
      .select("invoice_ai_enabled")
      .limit(1)
      .maybeSingle();

    const [doctorRes, testTypeRes, profileRes, invoiceRes, invoiceAiSettingsRes] =
      await Promise.all([
        supabase
          .from("doctor")
          .select("id, full_name, hospital")
          .order("full_name"),
        supabase
          .from("test_type")
          .select(
            "id, name, code, normal_price, insurance_price, is_active, is_orderable, include_in_invoice_description"
          )
          .eq("is_active", true)
          .eq("is_orderable", true)
          .order("name"),
        supabase
          .from("test_profile")
          .select(
            `
          id,
          name,
          description,
          test_profile_item(
            sort_order,
            test_type:test_type_id(
              id,
              name,
              code,
              normal_price,
              insurance_price,
              is_active,
              is_orderable,
              include_in_invoice_description
            )
          )
        `
          )
          .order("name"),
        invoicePromise,
        invoiceAiSettingsPromise,
      ]);

    setInvoiceAiEnabled(
      !invoiceAiSettingsRes.error &&
        invoiceAiSettingsRes.data?.invoice_ai_enabled === true
    );

    if (doctorRes.error) {
      setError(doctorRes.error.message);
    } else if (testTypeRes.error) {
      setError(testTypeRes.error.message);
    } else if (profileRes.error) {
      setError(profileRes.error.message);
    } else if (invoiceRes.error) {
      setError(invoiceRes.error.message);
    } else {
      setDoctors((doctorRes.data || []) as Doctor[]);
      const activeTestTypes = (testTypeRes.data || []) as TestType[];
      const invoice = invoiceRes.data as unknown as InvoiceEditPayload | null;
      const invoiceTests =
        invoice?.invoice_item
          ?.map((item) => item.test_type)
          .filter(Boolean) as TestType[] | undefined;
      const mergedTests = new Map<string, TestType>();
      [...activeTestTypes, ...(invoiceTests || [])].forEach((test) => {
        mergedTests.set(test.id, test);
      });

      setTestTypes(
        [...mergedTests.values()].sort((left, right) =>
          left.name.localeCompare(right.name)
        )
      );
      setTestProfiles(
        ((profileRes.data || []) as unknown as TestProfilePayload[]).map(
          (profile) => ({
            id: profile.id,
            name: profile.name,
            description: profile.description,
            tests: (profile.test_profile_item || [])
              .slice()
              .sort((left, right) => left.sort_order - right.sort_order)
              .map((item) => item.test_type)
              .filter(
                (test): test is TestType =>
                  Boolean(test?.is_active && test?.is_orderable)
              ),
          })
        )
      );

      if (invoice) {
        const fullName = invoice.patient?.full_name || "";
        const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
        setPatientFirstName(nameParts[0] || "");
        setPatientLastName(nameParts.slice(1).join(" ") || "");
        setPatientPrefix(extractId(invoice.patient?.patient_unique_id || ""));
        setDateOfBirth(invoice.patient?.date_of_birth || "");
        setGender(invoice.patient?.gender || undefined);
        setPhone(invoice.patient?.phone || "");
        setSelectedDoctorId(invoice.doctor_id);
        setSelectedTestTypeIds(
          (invoice.invoice_item || []).map((item) => item.test_type_id)
        );
        setAppliedPrices(
          Object.fromEntries(
            (invoice.invoice_item || []).map((item) => [
              item.test_type_id,
              String(item.applied_price ?? 0),
            ])
          )
        );
        setManualPriceTestIds(
          new Set((invoice.invoice_item || []).map((item) => item.test_type_id))
        );
        setHasInsurance(invoice.has_insurance);
        setDiscountAmount(String(invoice.discount_amount || 0));
        setAmountPaid(String(invoice.amount_paid || 0));
        setAmountPaidTouched(true);
        const savedSubtotal = Number(invoice.subtotal || 0);
        const savedDiscount = Number(invoice.discount_amount || 0);
        const savedTotal = Number(invoice.total || 0);
        const savedAsFree =
          Boolean(invoice.patient_result?.isFree) ||
          (savedSubtotal > 0 &&
            savedDiscount >= savedSubtotal &&
            almostEqual(savedTotal, 0));
        setIsFreeInvoice(savedAsFree);
        setIsHalfPayInvoice(
          !savedAsFree &&
            savedSubtotal > 0 &&
            almostEqual(savedDiscount, savedSubtotal / 2)
        );
        setNotes(invoice.notes || "");
      }
    }

    setLoadingInitial(false);
  }, [invoiceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const testsById = useMemo(
    () => new Map(testTypes.map((test) => [test.id, test])),
    [testTypes]
  );

  const selectedTests = useMemo(
    () =>
      selectedTestTypeIds
        .map((id) => testsById.get(id))
        .filter(Boolean) as TestType[],
    [selectedTestTypeIds, testsById]
  );

  useEffect(() => {
    setAppliedPrices((current) => {
      let changed = false;
      const selectedIdSet = new Set(selectedTestTypeIds);
      const next: Record<string, string> = {};

      selectedTestTypeIds.forEach((testId) => {
        const test = testsById.get(testId);
        if (!test) return;
        if (current[testId] === undefined) {
          next[testId] = String(getDefaultAppliedPrice(test, hasInsurance));
          changed = true;
        } else {
          next[testId] = current[testId];
        }
      });

      Object.keys(current).forEach((testId) => {
        if (!selectedIdSet.has(testId)) changed = true;
      });

      return changed ? next : current;
    });

    setManualPriceTestIds((current) => {
      const selectedIdSet = new Set(selectedTestTypeIds);
      const next = new Set(
        [...current].filter((testId) => selectedIdSet.has(testId))
      );
      return next.size === current.size ? current : next;
    });
  }, [hasInsurance, selectedTestTypeIds, testsById]);

  useEffect(() => {
    setAppliedPrices((current) => {
      let changed = false;
      const next = { ...current };

      selectedTestTypeIds.forEach((testId) => {
        if (manualPriceTestIds.has(testId)) return;
        const test = testsById.get(testId);
        if (!test) return;
        const defaultPrice = String(getDefaultAppliedPrice(test, hasInsurance));
        if (next[testId] !== defaultPrice) {
          next[testId] = defaultPrice;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [hasInsurance, manualPriceTestIds, selectedTestTypeIds, testsById]);

  const totals = useMemo(() => {
    let normalTotal = 0;
    let insuranceTotal = 0;
    const subtotal = selectedTests.reduce((sum, test) => {
      const applied = Math.max(toNumber(appliedPrices[test.id] || "0"), 0);
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
  }, [amountPaid, appliedPrices, discountAmount, hasInsurance, selectedTests]);

  useEffect(() => {
    if (isFreeInvoice) {
      const nextDiscount = String(totals.subtotal);
      setDiscountAmount((current) =>
        current === nextDiscount ? current : nextDiscount
      );
      setAmountPaid((current) => (current === "0" ? current : "0"));
      setAmountPaidTouched(true);
      return;
    }

    if (isHalfPayInvoice) {
      const nextDiscount = String(totals.subtotal / 2);
      const nextAmountPaid = String(Math.max(totals.subtotal / 2, 0));
      setDiscountAmount((current) =>
        current === nextDiscount ? current : nextDiscount
      );
      setAmountPaid((current) =>
        current === nextAmountPaid ? current : nextAmountPaid
      );
      setAmountPaidTouched(true);
    }
  }, [isFreeInvoice, isHalfPayInvoice, totals.subtotal]);

  const handleSelectedTestIdsChange = (ids: string[]) => {
    setSelectedTestTypeIds(ids);
  };

  const handleAppliedPriceChange = (testId: string, value: string) => {
    setAppliedPrices((current) => ({ ...current, [testId]: value }));
    setManualPriceTestIds((current) => new Set([...current, testId]));
  };

  const handleFreeInvoiceChange = (checked: boolean) => {
    setIsFreeInvoice(checked);
    if (checked) {
      setIsHalfPayInvoice(false);
    }
  };

  const handleHalfPayInvoiceChange = (checked: boolean) => {
    setIsHalfPayInvoice(checked);
    if (checked) {
      setIsFreeInvoice(false);
    }
  };

  useEffect(() => {
    if (!amountPaidTouched) {
      setAmountPaid(String(totals.total));
    }
  }, [amountPaidTouched, totals.total]);

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

  const cameraSupported = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    []
  );

  const stopCamera = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = async () => {
    if (!cameraSupported) {
      setSmartError("La caméra n'est pas disponible dans ce navigateur.");
      return;
    }

    stopCamera();
    setCameraStarting(true);
    setSmartError(null);
    setCapturedImage(null);
    setSmartOcrText("");
    setSmartReview(null);

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setSmartError(
        err?.name === "NotAllowedError"
          ? "Permission caméra refusée. Autorisez la caméra puis réessayez."
          : "Impossible de démarrer la caméra."
      );
      stopCamera();
    } finally {
      setCameraStarting(false);
    }
  };

  const captureCameraImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      setSmartError("La caméra n'est pas prête. Réessayez dans un instant.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setSmartError("Impossible de capturer l'image.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.9));
    setSmartOcrText("");
    setSmartOcrProgress(0);
    setSmartReview(null);
    setSmartError(null);
    stopCamera();
  };

  const retakeCameraImage = () => {
    setCapturedImage(null);
    setSmartOcrText("");
    setSmartOcrProgress(0);
    setSmartReview(null);
    void startCamera();
  };

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

  const analyzeSmartInvoiceText = async (
    sourceText: string,
    emptyMessage = "Dictez ou saisissez une instruction de facture."
  ) => {
    const trimmedText = sourceText.trim();
    if (!trimmedText) {
      setSmartError(emptyMessage);
      return;
    }

    setSmartLoading(true);
    setSmartError(null);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const systemPrompt = [
        "Tu es un assistant de facturation pour laboratoire médical.",
        "Analyse la transcription et extrait les informations au format JSON strict.",
        "N'invente pas d'information absente de la transcription.",
        "",
        "Champs attendus :",
        '- patient.firstName : prénom (string)',
        '- patient.lastName : nom (string)',
        '- patient.phone : téléphone (string)',
        '- patient.dateOfBirth : date YYYY-MM-DD (string)',
        '- patient.gender : "Male", "Female" ou "Other"',
        '- doctor.name : nom du médecin mentionné (string)',
        "- tests : tableau d'examens [{ name: string }]",
        "- hasInsurance : true si AMO/assurance, false sinon (boolean)",
        "- isFreeInvoice : true si la facture est gratuite/gratuit/ne paie pas (boolean)",
        "- isHalfPayInvoice : true si demi tarif/moitié/payer la moitié (boolean)",
        "- discountAmount : remise (number)",
        "- amountPaid : montant payé (number)",
        "- notes : notes additionnelles (string)",
        "",
        "Règles :",
        "- Si gratuit et demi tarif sont tous les deux mentionnés, gratuit gagne.",
        "- Si gratuit ou demi tarif est mentionné, remplis le booléen correspondant même si discountAmount est absent.",
        "- Pour une remise en montant, mets discountAmount au montant numérique.",
        "- Pour AMO/couvert/assuré, mets hasInsurance à true.",
        "",
        "Réponds UNIQUEMENT avec l'objet JSON. Pas de markdown, pas de texte autour.",
      ].join("\n");

      const userPrompt = [
        `Transcription : """${trimmedText}"""`,
        "",
        "Extrait uniquement les informations présentes dans la transcription.",
      ].join("\n");

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), SMART_AI_TIMEOUT_MS);

      const content = await callSmartInvoiceProvider(
        { systemPrompt, userPrompt },
        controller.signal
      );
      const parsed = extractSmartInvoiceJson(content);
      setSmartReview(buildSmartReview(parsed, doctors, testTypes));
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setSmartError(
          "Délai dépassé (45s). Le modèle " +
            SMART_AI_MODEL +
            " est peut-être trop lent. Essayez un modèle plus rapide."
        );
      } else {
        setSmartError(err?.message || "Impossible d'analyser la facture.");
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setSmartLoading(false);
    }
  };

  const handleSmartAnalyze = () => {
    void analyzeSmartInvoiceText(smartTranscript);
  };

  const recognizeCapturedImage = async () => {
    if (!capturedImage) {
      setSmartError("Capturez d'abord le papier du patient.");
      return "";
    }

    setSmartOcrLoading(true);
    setSmartOcrProgress(0);
    setSmartError(null);

    let worker: OcrWorker | null = null;

    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("fra+eng", undefined, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setSmartOcrProgress(Math.round(message.progress * 100));
          }
        },
      });
      const result = await worker.recognize(capturedImage);
      const text = result.data.text.trim();
      if (!text) {
        throw new Error("Impossible de lire le papier.");
      }
      setSmartOcrText(text);
      return text;
    } catch (err: any) {
      setSmartError(err?.message || "Impossible de lire le papier.");
      return "";
    } finally {
      await worker?.terminate().catch(() => undefined);
      setSmartOcrLoading(false);
    }
  };

  const handleSmartAnalyzeScan = async () => {
    const ocrText = smartOcrText.trim() || (await recognizeCapturedImage());
    if (!ocrText.trim()) return;
    await analyzeSmartInvoiceText(
      ocrText,
      "Impossible de lire le papier. Corrigez le texte OCR puis réessayez."
    );
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

  const handleSmartModeChange = (mode: SmartInputMode) => {
    setSmartMode(mode);
    setSmartError(null);
    setSmartReview(null);
    if (mode === "text") {
      stopCamera();
      setCapturedImage(null);
      setSmartOcrText("");
      setSmartOcrProgress(0);
      return;
    }
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const resetSmartInvoice = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopCamera();
    setSmartMode("text");
    setIsListening(false);
    setSmartTranscript("");
    setSmartLoading(false);
    setSmartError(null);
    setSmartReview(null);
    setCapturedImage(null);
    setSmartOcrText("");
    setSmartOcrLoading(false);
    setSmartOcrProgress(0);
  };

  const handleSmartOpenChange = (open: boolean) => {
    setSmartOpen(open);
    if (!open) {
      resetSmartInvoice();
    }
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

    if (draft.isFreeInvoice) {
      setIsFreeInvoice(true);
      setIsHalfPayInvoice(false);
      setDiscountAmount(String(totals.subtotal));
      setAmountPaid("0");
      setAmountPaidTouched(true);
    } else if (draft.isHalfPayInvoice) {
      setIsHalfPayInvoice(true);
      setIsFreeInvoice(false);
      setDiscountAmount(String(totals.subtotal / 2));
      setAmountPaid(String(Math.max(totals.subtotal / 2, 0)));
      setAmountPaidTouched(true);
    } else {
      if (typeof draft.isFreeInvoice === "boolean") setIsFreeInvoice(false);
      if (typeof draft.isHalfPayInvoice === "boolean") setIsHalfPayInvoice(false);
      if (draft.discountAmount !== undefined) {
        setDiscountAmount(String(draft.discountAmount));
      }
      if (draft.amountPaid !== undefined) {
        setAmountPaidTouched(true);
        setAmountPaid(String(draft.amountPaid));
      }
    }
    if (draft.notes) setNotes(draft.notes);
    if (smartReview.doctor.doctorId) setSelectedDoctorId(smartReview.doctor.doctorId);

    const matchedTestIds = smartReview.tests
      .filter((match) => match.selected && match.testTypeId)
      .map((match) => match.testTypeId as string);
    if (matchedTestIds.length > 0) {
      setSelectedTestTypeIds((current) => [...new Set([...current, ...matchedTestIds])]);
    }

    handleSmartOpenChange(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (isEditMode && !invoiceId) {
      setError("Facture introuvable.");
      return;
    }
    if (!isEditMode && !validateId(patientPrefix.trim())) {
      setError("L'ID patient doit commencer par 0 suivi d'un nombre.");
      return;
    }
    if (isEditMode && !patientPrefix.trim()) {
      setError("L'ID patient est requis.");
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
    const invalidPriceTest = selectedTests.find((test) => {
      const price = Number(appliedPrices[test.id]);
      return !Number.isFinite(price) || price < 0;
    });
    if (invalidPriceTest) {
      setError(
        `Le prix appliqué est invalide pour ${getDisplayTestName(
          invalidPriceTest.name
        )}.`
      );
      return;
    }

    setSubmitting(true);

    const patientPayload = {
      patient_unique_id: isEditMode
        ? patientPrefix.trim()
        : generateId(patientPrefix.trim()),
      full_name: `${patientFirstName.trim()} ${patientLastName.trim()}`,
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      phone: phone.trim() || null,
    };

    const submitDiscount = isFreeInvoice
      ? totals.subtotal
      : isHalfPayInvoice
        ? totals.subtotal / 2
        : totals.discount;
    const submitTotal = Math.max(totals.subtotal - submitDiscount, 0);
    const submitAmountPaid = isFreeInvoice
      ? 0
      : isHalfPayInvoice
        ? submitTotal
        : totals.paid;

    const rpcArgs = {
      p_patient: patientPayload,
      p_doctor_id: selectedDoctorId,
      p_items: selectedTests.map((test) => ({
        test_type_id: test.id,
        applied_price: Math.max(toNumber(appliedPrices[test.id] || "0"), 0),
      })),
      p_has_insurance: hasInsurance,
      p_discount_amount: submitDiscount,
      p_amount_paid: submitAmountPaid,
      p_notes: notes.trim() || null,
      p_is_free: isFreeInvoice,
      p_is_half_pay: isHalfPayInvoice,
    };

    const { data, error: rpcError } = isEditMode
      ? await supabase.rpc("update_invoice_with_result", {
          p_invoice_id: invoiceId as string,
          ...rpcArgs,
        })
      : await supabase.rpc("create_invoice_with_result", rpcArgs);

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
    <div className="mx-auto max-w-6xl space-y-5 pb-96">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to={isEditMode && invoiceId ? `/factures/${invoiceId}` : "/factures"}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isEditMode ? "Retour à la facture" : "Retour aux factures"}
          </Button>
        </Link>
        {invoiceAiEnabled && (
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
        )}
      </div>

      {invoiceAiEnabled && (
        <Dialog open={smartOpen} onOpenChange={handleSmartOpenChange}>
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

            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={smartMode === "text" ? "default" : "outline"}
                    onClick={() => handleSmartModeChange("text")}
                    disabled={smartLoading || smartOcrLoading}
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    Dicter / saisir
                  </Button>
                  <Button
                    type="button"
                    variant={smartMode === "scan" ? "default" : "outline"}
                    onClick={() => handleSmartModeChange("scan")}
                    disabled={smartLoading || smartOcrLoading}
                  >
                    <ScanText className="mr-2 h-4 w-4" />
                    Scanner papier
                  </Button>
                </div>
                <Badge variant={SMART_AI_IS_CONFIGURED ? "secondary" : "outline"}>
                  {SMART_AI_BADGE_TEXT}
                </Badge>
              </div>

              {smartMode === "text" ? (
                <div className="space-y-2">
                  <Label htmlFor="smartTranscript">Instruction</Label>
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
              ) : (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border bg-muted">
                    <div className="relative flex aspect-video items-center justify-center">
                      {capturedImage ? (
                        <img
                          src={capturedImage}
                          alt="Papier patient capturé"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <video
                          ref={videoRef}
                          className="h-full w-full object-contain"
                          autoPlay
                          muted
                          playsInline
                        />
                      )}
                      {!cameraActive && !capturedImage && (
                        <div className="absolute flex flex-col items-center gap-2 text-sm text-muted-foreground">
                          <Camera className="h-8 w-8" />
                          Placez le papier patient face à la caméra.
                        </div>
                      )}
                    </div>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />

                  <div className="flex flex-wrap gap-2">
                    {!cameraActive && !capturedImage && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={startCamera}
                        disabled={cameraStarting || smartLoading || smartOcrLoading}
                      >
                        {cameraStarting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="mr-2 h-4 w-4" />
                        )}
                        Démarrer caméra
                      </Button>
                    )}
                    {cameraActive && (
                      <Button
                        type="button"
                        onClick={captureCameraImage}
                        disabled={cameraStarting || smartLoading || smartOcrLoading}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Capturer
                      </Button>
                    )}
                    {capturedImage && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={retakeCameraImage}
                        disabled={smartLoading || smartOcrLoading}
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Reprendre
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={handleSmartAnalyzeScan}
                      disabled={
                        smartLoading ||
                        smartOcrLoading ||
                        (!capturedImage && !smartOcrText.trim())
                      }
                    >
                      {smartLoading || smartOcrLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Analyser la photo
                    </Button>
                  </div>

                  {smartOcrLoading && (
                    <p className="text-sm text-muted-foreground">
                      Lecture OCR... {smartOcrProgress}%
                    </p>
                  )}

                  {(capturedImage || smartOcrText) && (
                    <div className="space-y-2">
                      <Label htmlFor="smartOcrText">Texte lu sur le papier</Label>
                      <Textarea
                        id="smartOcrText"
                        value={smartOcrText}
                        onChange={(event) => setSmartOcrText(event.target.value)}
                        rows={5}
                        placeholder="Le texte OCR apparaîtra ici. Corrigez les noms ou tests si nécessaire avant l'analyse."
                        disabled={smartLoading || smartOcrLoading}
                      />
                    </div>
                  )}
                </div>
              )}
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
                    {(smartReview.draft.phone ||
                      smartReview.draft.dateOfBirth ||
                      smartReview.draft.gender) && (
                      <p className="text-xs text-muted-foreground">
                        {[
                          smartReview.draft.phone,
                          smartReview.draft.dateOfBirth,
                          smartReview.draft.gender,
                        ]
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
                                  <span>{candidate.name}</span>
                                  {candidate.code && (
                                    <Badge
                                      variant="outline"
                                      className="ml-2 font-mono text-[10px]"
                                    >
                                      {candidate.code}
                                    </Badge>
                                  )}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-5">
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
                    <span className="text-muted-foreground">Gratuit</span>
                    <p className="font-medium">
                      {smartReview.draft.isFreeInvoice === undefined
                        ? "-"
                        : smartReview.draft.isFreeInvoice
                          ? "Oui"
                          : "Non"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Demi tarif</span>
                    <p className="font-medium">
                      {smartReview.draft.isHalfPayInvoice === undefined
                        ? "-"
                        : smartReview.draft.isHalfPayInvoice
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
              onClick={() => handleSmartOpenChange(false)}
            >
              Fermer
            </Button>
            <Button
              type="button"
              onClick={handleApplySmartDraft}
              disabled={!smartReview || smartLoading || smartOcrLoading}
            >
              Appliquer au brouillon
            </Button>
          </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
                  {isEditMode ? "ID patient" : "Préfixe ID"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="patientPrefix"
                  value={patientPrefix}
                  onChange={(event) => setPatientPrefix(event.target.value)}
                  placeholder={isEditMode ? "Ex: 021-27-0626" : "Ex: 021"}
                  disabled={submitting}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {isEditMode
                    ? "Le suffixe technique de la facture est conservé automatiquement."
                    : `ID généré: ${
                        validateId(patientPrefix)
                          ? generateId(patientPrefix)
                          : "Saisir un préfixe valide"
                      }`}
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <Checkbox
                    id="isFreeInvoice"
                    checked={isFreeInvoice}
                    onCheckedChange={(checked) =>
                      handleFreeInvoiceChange(Boolean(checked))
                    }
                    disabled={submitting}
                  />
                  <Label htmlFor="isFreeInvoice" className="font-medium">
                    Facture gratuite
                  </Label>
                </div>
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <Checkbox
                    id="isHalfPayInvoice"
                    checked={isHalfPayInvoice}
                    onCheckedChange={(checked) =>
                      handleHalfPayInvoiceChange(Boolean(checked))
                    }
                    disabled={submitting}
                  />
                  <Label htmlFor="isHalfPayInvoice" className="font-medium">
                    Demi tarif
                  </Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Examens <span className="text-destructive">*</span>
                </Label>
                <InvoiceTestPicker
                  tests={testTypes}
                  profiles={testProfiles}
                  selectedTestIds={selectedTestTypeIds}
                  onSelectedTestIdsChange={handleSelectedTestIdsChange}
                  disabled={submitting}
                />
              </div>
              {selectedTests.length > 0 && (
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-[minmax(0,1fr)_88px_88px_112px] items-center gap-3 bg-muted px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
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
                        className="grid grid-cols-[minmax(0,1fr)_88px_88px_112px] items-center gap-3 border-t px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 font-medium">
                          {getDisplayTestName(test.name)}
                        </span>
                        <span className="text-right tabular-nums">
                          {formatCurrency(test.normal_price)}
                        </span>
                        <span className="text-right tabular-nums">
                          {test.insurance_price == null
                            ? "-"
                            : formatCurrency(test.insurance_price)}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={appliedPrices[test.id] ?? String(applied ?? 0)}
                          onChange={(event) =>
                            handleAppliedPriceChange(test.id, event.target.value)
                          }
                          disabled={submitting}
                          className="h-8 w-full text-right tabular-nums"
                          aria-label={`Prix appliqué ${getDisplayTestName(
                            test.name
                          )}`}
                        />
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
                  disabled={submitting || isFreeInvoice || isHalfPayInvoice}
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
                  disabled={submitting || isFreeInvoice}
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
                {isFreeInvoice ? (
                  <div className="flex justify-between text-lg font-bold">
                    <span>Facture gratuite</span>
                    <span>GRATUIT</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(totals.total)}</span>
                  </div>
                )}
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
                {isEditMode ? "Mettre à jour la facture" : "Créer la facture"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
};

export default FactureFormPage;
