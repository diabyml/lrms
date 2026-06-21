import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Printer,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type AmoResultRecord,
  type AmoResultValueRecord,
  type AmoVhbRecord,
  buildBilanAmoJson,
  downloadJson,
} from "@/lib/bilanAmoJson";
import { supabase } from "@/lib/supabaseClient";
import { specializedResultsClient } from "@/lib/specializedResultsClient";
import { extractId } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1000;
const EXPORT_BATCH_SIZE = 1000;
const VALUE_ID_BATCH_SIZE = 100;

const RESULT_SELECT = `
  id,
  patient_id,
  doctor_id,
  result_date,
  status,
  normal_price,
  insurance_price,
  description,
  patient:patient_id (
    id,
    patient_unique_id,
    full_name,
    date_of_birth,
    gender,
    phone
  ),
  doctor:doctor_id (
    id,
    full_name,
    phone,
    hospital
  )
`;

const RESULT_VALUE_SELECT = `
  patient_result_id,
  value,
  test_parameter:test_parameter_id (
    id,
    name,
    unit,
    reference_range,
    order,
    test_type:test_type_id (
      id,
      name,
      description,
      category:category_id (id, name)
    )
  )
`;

const getFirstDayOfCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
};

const localDateStartToIso = (dateValue: string) => {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));

const formatCurrency = (amount: number | null) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 2,
  }).format(amount || 0);

const todayForFilename = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getStatusVariant = (
  status: string
): "default" | "secondary" | "outline" => {
  switch (status.toLowerCase()) {
    case "fini":
    case "completed":
      return "default";
    case "attente":
    case "pending":
      return "outline";
    default:
      return "secondary";
  }
};

const BilanAmoPage = () => {
  const [results, setResults] = useState<AmoResultRecord[]>([]);
  const [startDate, setStartDate] = useState(getFirstDayOfCurrentMonth);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pageSizeInput, setPageSizeInput] = useState(
    String(DEFAULT_PAGE_SIZE)
  );
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportingResultId, setExportingResultId] = useState<string | null>(
    null
  );

  const totalPages = Math.ceil(totalCount / pageSize);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = supabase
        .from("patient_result")
        .select(RESULT_SELECT, { count: "exact" })
        .gt("insurance_price", 0)
        .order("result_date", { ascending: true })
        .range(from, to);

      if (startDate) {
        query = query.gte("result_date", localDateStartToIso(startDate));
      }

      const { data, error: queryError, count } = await query;
      if (queryError) throw queryError;

      setResults((data || []) as unknown as AmoResultRecord[]);
      setTotalCount(count || 0);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Impossible de charger les bilans AMO.";
      setError(message);
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, startDate]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const fetchResultValues = async (resultIds: string[]) => {
    const allValues: AmoResultValueRecord[] = [];

    for (let index = 0; index < resultIds.length; index += VALUE_ID_BATCH_SIZE) {
      const idBatch = resultIds.slice(index, index + VALUE_ID_BATCH_SIZE);
      const { data, error: valuesError } = await supabase
        .from("result_value")
        .select(RESULT_VALUE_SELECT)
        .in("patient_result_id", idBatch);

      if (valuesError) throw valuesError;
      allValues.push(...((data || []) as unknown as AmoResultValueRecord[]));
    }

    return allValues;
  };

  const fetchVhbRows = async (resultIds: string[]) => {
    const allVhbRows: AmoVhbRecord[] = [];

    for (let index = 0; index < resultIds.length; index += VALUE_ID_BATCH_SIZE) {
      const idBatch = resultIds.slice(index, index + VALUE_ID_BATCH_SIZE);
      const { data, error: vhbError } = await specializedResultsClient
        .from("vhb")
        .select("id, result_id, value")
        .in("result_id", idBatch);

      if (vhbError) throw vhbError;
      allVhbRows.push(...((data || []) as unknown as AmoVhbRecord[]));
    }

    return allVhbRows;
  };

  const exportResults = async (
    records: AmoResultRecord[],
    filename: string
  ) => {
    const resultIds = records.map((result) => result.id);
    const [values, vhbRows] = await Promise.all([
      fetchResultValues(resultIds),
      fetchVhbRows(resultIds),
    ]);
    downloadJson(buildBilanAmoJson(records, values, vhbRows), filename);
  };

  const handleExportResult = async (result: AmoResultRecord) => {
    setExportError(null);
    setExportingResultId(result.id);

    try {
      await exportResults([result], `bilan-amo-${result.id}.json`);
    } catch (caughtError) {
      setExportError(
        caughtError instanceof Error
          ? caughtError.message
          : "Impossible d'exporter ce résultat."
      );
    } finally {
      setExportingResultId(null);
    }
  };

  const fetchAllFilteredResults = async () => {
    const allResults: AmoResultRecord[] = [];
    let from = 0;
    let expectedCount: number | null = null;

    while (true) {
      let query = supabase
        .from("patient_result")
        .select(RESULT_SELECT, { count: "exact" })
        .gt("insurance_price", 0)
        .order("result_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + EXPORT_BATCH_SIZE - 1);

      if (startDate) {
        query = query.gte("result_date", localDateStartToIso(startDate));
      }

      const { data, error: queryError, count } = await query;
      if (queryError) throw queryError;

      const batch = (data || []) as unknown as AmoResultRecord[];
      allResults.push(...batch);
      expectedCount ??= count ?? 0;

      if (
        batch.length === 0 ||
        allResults.length >= expectedCount ||
        batch.length < EXPORT_BATCH_SIZE
      ) {
        break;
      }
      from += EXPORT_BATCH_SIZE;
    }

    return allResults;
  };

  const handleExportAll = async () => {
    setExportError(null);
    setExportingAll(true);

    try {
      const allResults = await fetchAllFilteredResults();
      await exportResults(
        allResults,
        `bilan-amo-${todayForFilename()}.json`
      );
    } catch (caughtError) {
      setExportError(
        caughtError instanceof Error
          ? caughtError.message
          : "Impossible d'exporter les bilans AMO."
      );
    } finally {
      setExportingAll(false);
    }
  };

  const summary = useMemo(() => {
    if (!totalCount) return "Aucun résultat";
    const first = (page - 1) * pageSize + 1;
    const last = Math.min(page * pageSize, totalCount);
    return `${first}-${last} sur ${totalCount} résultats`;
  }, [page, pageSize, totalCount]);

  const applyPageSize = () => {
    const requestedSize = Number.parseInt(pageSizeInput, 10);
    const nextPageSize = Number.isFinite(requestedSize)
      ? Math.min(Math.max(requestedSize, 1), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    setPageSizeInput(String(nextPageSize));
    setPageSize(nextPageSize);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <ShieldCheck className="h-7 w-7" />
            Bilan AMO
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Résultats avec une prise en charge assurance supérieure à zéro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
          >
            <Link
              to={`/bilan-amo/print${
                startDate
                  ? `?startDate=${encodeURIComponent(startDate)}`
                  : ""
              }`}
              aria-disabled={loading || totalCount === 0}
              tabIndex={loading || totalCount === 0 ? -1 : undefined}
              className={
                loading || totalCount === 0
                  ? "pointer-events-none opacity-50"
                  : undefined
              }
            >
              <Printer />
              Tout imprimer
            </Link>
          </Button>
          <Button
            onClick={handleExportAll}
            disabled={loading || exportingAll || totalCount === 0}
          >
            <FileDown className={exportingAll ? "animate-pulse" : ""} />
            {exportingAll ? "Export en cours..." : "Exporter tout"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-end">
        <div className="w-full space-y-2 sm:max-w-xs">
          <label htmlFor="amo-start-date" className="text-sm font-medium">
            Date de début
          </label>
          <Input
            id="amo-start-date"
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button variant="outline" onClick={fetchResults} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Actualiser
        </Button>
        <div className="w-full space-y-2 sm:w-36">
          <label htmlFor="amo-page-size" className="text-sm font-medium">
            Résultats par page
          </label>
          <Input
            id="amo-page-size"
            type="number"
            min={1}
            max={MAX_PAGE_SIZE}
            value={pageSizeInput}
            onChange={(event) => setPageSizeInput(event.target.value)}
            onBlur={applyPageSize}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyPageSize();
                event.currentTarget.blur();
              }
            }}
            disabled={loading}
          />
        </div>
        <div className="rounded-md border bg-background px-4 py-2 sm:ml-auto">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total bilans AMO
          </p>
          <p className="text-2xl font-bold tabular-nums">
            {loading ? "..." : totalCount.toLocaleString("fr-FR")}
          </p>
        </div>
      </div>

      {exportError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Erreur d'export</AlertTitle>
          <AlertDescription>{exportError}</AlertDescription>
        </Alert>
      )}

      {error && !loading && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            <span>{error}</span>
            <Button variant="link" className="h-auto p-0" onClick={fetchResults}>
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-2 rounded-lg border p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !error ? (
        <div className="overflow-hidden rounded-lg border bg-background">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Médecin</TableHead>
                  <TableHead>Assurance</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length ? (
                  results.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(result.result_date)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {result.patient?.full_name || "Patient inconnu"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {result.patient?.patient_unique_id
                            ? extractId(result.patient.patient_unique_id)
                            : result.patient_id}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {result.doctor?.full_name || "Médecin inconnu"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {result.doctor?.hospital ||
                            "Établissement non renseigné"}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {formatCurrency(result.insurance_price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(result.status)}>
                          {result.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/results/${result.id}`}>
                              <Printer />
                              <span className="hidden xl:inline">Imprimer</span>
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportResult(result)}
                            disabled={
                              exportingAll || exportingResultId === result.id
                            }
                          >
                            <Download
                              className={
                                exportingResultId === result.id
                                  ? "animate-pulse"
                                  : ""
                              }
                            />
                            <span className="hidden xl:inline">Exporter</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-28 text-center text-muted-foreground"
                    >
                      Aucun bilan AMO ne correspond à cette période.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>{summary}</span>
            <span>
              Page {totalPages ? page : 0} sur {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft />
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= totalPages}
              >
                Suivant
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BilanAmoPage;
