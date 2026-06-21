import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Printer } from "lucide-react";

import StandardResultPrintReport from "@/components/results/StandardResultPrintReport";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AmoResultRecord,
  type AmoResultValueRecord,
  type AmoVhbRecord,
  buildBilanAmoJson,
} from "@/lib/bilanAmoJson";
import { supabase, type Tables } from "@/lib/supabaseClient";
import { specializedResultsClient } from "@/lib/specializedResultsClient";

const RESULT_BATCH_SIZE = 1000;
const VALUE_ID_BATCH_SIZE = 100;

interface ProtidogrammeRecord {
  id: string;
  result_id: string;
  image: string | null;
  description: string | null;
}

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

const localDateStartToIso = (dateValue: string) => {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
};

const BilanAmoPrintPage = () => {
  const [searchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") || "";
  const [results, setResults] = useState<AmoResultRecord[]>([]);
  const [values, setValues] = useState<AmoResultValueRecord[]>([]);
  const [vhbRows, setVhbRows] = useState<AmoVhbRecord[]>([]);
  const [protidogrammes, setProtidogrammes] = useState<
    ProtidogrammeRecord[]
  >([]);
  const [headerConfig, setHeaderConfig] =
    useState<Tables<"print_header_config"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBulkPrintData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const allResults: AmoResultRecord[] = [];
      let from = 0;
      let expectedCount: number | null = null;

      while (true) {
        let query = supabase
          .from("patient_result")
          .select(RESULT_SELECT, { count: "exact" })
          .gt("insurance_price", 0)
          .order("result_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + RESULT_BATCH_SIZE - 1);

        if (startDate) {
          query = query.gte("result_date", localDateStartToIso(startDate));
        }

        const { data, error: resultsError, count } = await query;
        if (resultsError) throw resultsError;

        const batch = (data || []) as unknown as AmoResultRecord[];
        allResults.push(...batch);
        expectedCount ??= count ?? 0;
        if (
          batch.length === 0 ||
          allResults.length >= expectedCount ||
          batch.length < RESULT_BATCH_SIZE
        ) {
          break;
        }
        from += RESULT_BATCH_SIZE;
      }

      const allValues: AmoResultValueRecord[] = [];
      const allVhbRows: AmoVhbRecord[] = [];
      const allProtidogrammes: ProtidogrammeRecord[] = [];
      const resultIds = allResults.map((result) => result.id);
      for (
        let index = 0;
        index < resultIds.length;
        index += VALUE_ID_BATCH_SIZE
      ) {
        const idBatch = resultIds.slice(index, index + VALUE_ID_BATCH_SIZE);
        const [valuesResponse, vhbResponse, protidogrammeResponse] =
          await Promise.all([
            supabase
              .from("result_value")
              .select(RESULT_VALUE_SELECT)
              .in("patient_result_id", idBatch),
            specializedResultsClient
              .from("vhb")
              .select("id, result_id, value")
              .in("result_id", idBatch),
            specializedResultsClient
              .from("protidogramme")
              .select("id, result_id, image, description")
              .in("result_id", idBatch),
          ]);

        if (valuesResponse.error) throw valuesResponse.error;
        if (vhbResponse.error) throw vhbResponse.error;
        if (protidogrammeResponse.error) throw protidogrammeResponse.error;

        allValues.push(
          ...((valuesResponse.data || []) as unknown as AmoResultValueRecord[])
        );
        allVhbRows.push(
          ...((vhbResponse.data || []) as unknown as AmoVhbRecord[])
        );
        allProtidogrammes.push(
          ...((protidogrammeResponse.data ||
            []) as unknown as ProtidogrammeRecord[])
        );
      }

      const { data: config, error: configError } = await supabase
        .from("print_header_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (configError) throw configError;

      setResults(allResults);
      setValues(allValues);
      setVhbRows(allVhbRows);
      setProtidogrammes(allProtidogrammes);
      setHeaderConfig(config);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Impossible de préparer l'impression groupée."
      );
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  useEffect(() => {
    fetchBulkPrintData();
  }, [fetchBulkPrintData]);

  const groupedResults = useMemo(
    () => buildBilanAmoJson(results, values, vhbRows).results,
    [results, values, vhbRows]
  );

  const vhbByResult = useMemo(
    () => new Map(vhbRows.map((vhb) => [vhb.result_id, vhb] as const)),
    [vhbRows]
  );

  const protidogrammeByResult = useMemo(
    () =>
      new Map(
        protidogrammes.map((protidogramme) => [
          protidogramme.result_id,
          {
            id: protidogramme.id,
            description: protidogramme.description,
            imageUrl: protidogramme.image
              ? supabase.storage
                  .from("images")
                  .getPublicUrl(protidogramme.image).data.publicUrl
              : null,
          },
        ])
      ),
    [protidogrammes]
  );

  const handlePrint = useCallback(async () => {
    document.title = `bilan-amo-${new Date().toISOString().slice(0, 10)}`;
    if ("fonts" in document) {
      await document.fonts.ready;
    }
    const images = Array.from(document.images);
    await Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          })
      )
    );
    window.print();
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline">
          <Link to="/bilan-amo">
            <ArrowLeft />
            Retour au Bilan AMO
          </Link>
        </Button>
        <div className="text-sm text-muted-foreground">
          {results.length} rapport{results.length === 1 ? "" : "s"} à imprimer
        </div>
        <Button
          onClick={() => void handlePrint()}
          disabled={loading || Boolean(error) || results.length === 0}
        >
          <Printer />
          Imprimer
        </Button>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {error && !loading && (
        <Alert variant="destructive" className="print:hidden">
          <AlertCircle />
          <AlertTitle>Erreur d'impression</AlertTitle>
          <AlertDescription>
            {error}
            <Button
              variant="link"
              className="ml-2 h-auto p-0"
              onClick={fetchBulkPrintData}
            >
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && results.length === 0 && (
        <Alert className="print:hidden">
          <AlertTitle>Aucun résultat</AlertTitle>
          <AlertDescription>
            Aucun bilan AMO ne correspond à la date sélectionnée.
          </AlertDescription>
        </Alert>
      )}

      {!loading &&
        !error &&
        results.map((result, index) => (
          <StandardResultPrintReport
            key={result.id}
            result={result}
            categories={groupedResults[index]?.categories || []}
            headerConfig={headerConfig}
            vhb={vhbByResult.get(result.id) || null}
            protidogramme={protidogrammeByResult.get(result.id) || null}
          />
        ))}
    </div>
  );
};

export default BilanAmoPrintPage;
