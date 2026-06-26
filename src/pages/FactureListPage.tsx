import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  PlusCircle,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabaseClient";
import { extractId } from "@/lib/utils";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  created_at: string;
  total: number;
  amount_paid: number;
  remaining_amount: number;
  payment_status: string;
  patient: { full_name: string | null; patient_unique_id: string | null } | null;
  doctor: { full_name: string | null } | null;
};

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const statusLabel: Record<string, string> = {
  paid: "Payée",
  partial: "Partielle",
  unpaid: "Non payée",
};

const statusVariant = (status: string) => {
  if (status === "paid") return "default";
  if (status === "partial") return "secondary";
  return "destructive";
};

const FactureListPage: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  );

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error: fetchError, count } = await supabase
      .from("invoice")
      .select(
        `
        id,
        invoice_number,
        created_at,
        total,
        amount_paid,
        remaining_amount,
        payment_status,
        patient:patient_id(full_name, patient_unique_id),
        doctor:doctor_id(full_name)
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (fetchError) {
      setError(fetchError.message);
      setInvoices([]);
    } else {
      setInvoices((data || []) as unknown as InvoiceRow[]);
      setTotalCount(count || 0);
    }

    setLoading(false);
  }, [page, pageSize]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <FileText className="h-6 w-6" />
          Factures
        </h1>
        <Link to="/factures/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nouvelle facture
          </Button>
        </Link>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3 rounded-lg border p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Médecin</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Restant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length > 0 ? (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(invoice.created_at), "Pp", {
                        locale: fr,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {invoice.patient?.full_name || "Patient inconnu"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {extractId(invoice.patient?.patient_unique_id || "")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {invoice.doctor?.full_name || "Médecin inconnu"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(invoice.amount_paid)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(invoice.remaining_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(invoice.payment_status)}>
                        {statusLabel[invoice.payment_status] ||
                          invoice.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/factures/${invoice.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Voir
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Aucune facture trouvée.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Page {page} sur {totalPages} · {totalCount} facture(s)
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages || loading}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FactureListPage;
