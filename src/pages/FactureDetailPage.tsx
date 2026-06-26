import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertCircle, ArrowLeft, Printer } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import { extractId } from "@/lib/utils";

type InvoiceDetail = {
  id: string;
  invoice_number: string;
  created_at: string;
  has_insurance: boolean;
  subtotal: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  remaining_amount: number;
  payment_status: string;
  notes: string | null;
  patient: {
    full_name: string | null;
    patient_unique_id: string | null;
    date_of_birth: string | null;
    gender: string | null;
    phone: string | null;
  } | null;
  doctor: {
    full_name: string | null;
    hospital: string | null;
    phone: string | null;
  } | null;
  invoice_item: Array<{
    id: string;
    test_name: string;
    normal_price: number;
    insurance_price: number | null;
    applied_price: number;
    price_source: string;
  }>;
};

type HeaderConfig = {
  lab_name: string | null;
  logo_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city_postal_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const paymentLabel: Record<string, string> = {
  paid: "PAYÉE",
  partial: "PARTIELLE",
  unpaid: "NON PAYÉE",
};

const FactureDetailPage: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError(null);

    const [invoiceRes, headerRes] = await Promise.all([
      supabase
        .from("invoice")
        .select(
          `
          *,
          patient:patient_id(full_name, patient_unique_id, date_of_birth, gender, phone),
          doctor:doctor_id(full_name, hospital, phone),
          invoice_item(*)
        `
        )
        .eq("id", invoiceId)
        .single(),
      supabase.from("print_header_config").select("*").limit(1).maybeSingle(),
    ]);

    if (invoiceRes.error) {
      setError(invoiceRes.error.message);
      setInvoice(null);
    } else {
      setInvoice(invoiceRes.data as unknown as InvoiceDetail);
    }

    if (!headerRes.error) {
      setHeaderConfig(headerRes.data as HeaderConfig | null);
    }

    setLoading(false);
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-9 w-32 print:hidden" />
        <Skeleton className="h-[620px] w-full" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/factures">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </Link>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            {error || "Facture introuvable."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <style>{`
        /* Screen: ensure header text is solid black */
        .thermal-invoice .invoice-print-header,
        .thermal-invoice .invoice-print-header h1,
        .thermal-invoice .invoice-print-header p,
        .thermal-invoice .invoice-print-header div {
          color: #000 !important;
        }

        @media print {
          @page { size: 80mm auto; margin: 3mm; margin-top: 0mm; }
          body { background: white !important; }

          /* --- Base: Roboto Condensed Regular 9pt --- */
          .thermal-invoice {
            width: 72mm !important;
            max-width: 72mm !important;
            margin: 0 auto !important;
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            color: #000 !important;
            background: #fff !important;
            font-family: "Roboto Condensed", sans-serif !important;
            font-size: 9pt !important;
            font-weight: 400 !important;
            line-height: 1.25 !important;
          }

          /* --- Print header container --- */
          .thermal-invoice .invoice-print-header {
            display: block !important;
            margin: 0 0 2mm 0 !important;
            padding: 0 !important;
            text-align: center !important;
            color: #000 !important;
          }

          /* Business name: Roboto Condensed Bold 16pt */
          .thermal-invoice .invoice-print-header h1 {
            font-family: "Roboto Condensed", sans-serif !important;
            font-weight: 700 !important;
            font-size: 16pt !important;
            margin: 0 0 1mm 0 !important;
            color: #000 !important;
          }

          /* Lab contact details: Roboto Condensed Medium 9pt */
          .thermal-invoice .invoice-print-header p,
          .thermal-invoice .invoice-print-header div {
            font-family: "Roboto Condensed", sans-serif !important;
            font-weight: 500 !important;
            font-size: 9pt !important;
            color: #000 !important;
          }

          /* Logo image (unchanged layout) */
          .thermal-invoice .invoice-print-header img {
            display: block !important;
            margin: 0 auto 1mm auto !important;
            max-height: 14mm !important;
            max-width: 32mm !important;
            object-fit: contain !important;
          }

          /* Patient info & analyses: Roboto Condensed Regular 9pt */
          .thermal-invoice .invoice-section-patient,
          .thermal-invoice .invoice-section-analyses {
            font-family: "Roboto Condensed", sans-serif !important;
            font-weight: 400 !important;
            font-size: 9pt !important;
          }

          /* Section labels ("Patient:", "Analyses:"): Roboto Condensed Medium 9pt */
          .thermal-invoice .invoice-section-patient .font-bold,
          .thermal-invoice .invoice-section-analyses .font-bold {
            font-weight: 500 !important;
          }

          /* Totals section base */
          .thermal-invoice .invoice-section-totals {
            font-size: 10pt !important;
          }

          /* "Total:" label: Roboto Condensed Bold 10pt */
          .thermal-invoice .invoice-section-totals > .flex:first-child span:first-child {
            font-family: "Roboto Condensed", sans-serif !important;
            font-weight: 700 !important;
            font-size: 10pt !important;
          }

          /* Total amount value: Roboto Mono Bold 13pt */
          .thermal-invoice .invoice-section-totals > .flex:first-child span:last-child {
            font-family: "Roboto Mono", monospace !important;
            font-weight: 700 !important;
            font-size: 13pt !important;
          }

          /* Remaining row (label + amount): Roboto Mono Bold 10pt */
          .thermal-invoice .invoice-remaining {
            font-family: "Roboto Mono", monospace !important;
            font-weight: 700 !important;
            font-size: 10pt !important;
          }

          /* "Merci pour votre confiance": Roboto Condensed Regular 9pt */
          .thermal-invoice footer p:first-child {
            font-family: "Roboto Condensed", sans-serif !important;
            font-weight: 400 !important;
            font-size: 9pt !important;
          }

          /* Date: Roboto Condensed Regular 8.5pt */
          .thermal-invoice footer p:last-child {
            font-family: "Roboto Condensed", sans-serif !important;
            font-weight: 400 !important;
            font-size: 8.5pt !important;
          }

          /* Solid black on all text */
          .thermal-invoice p,
          .thermal-invoice div,
          .thermal-invoice h1,
          .thermal-invoice span,
          .thermal-invoice footer,
          .thermal-invoice section {
            color: #000 !important;
          }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link to="/factures">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux factures
          </Button>
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimer
        </Button>
      </div>

      <article className="thermal-invoice mx-auto w-full max-w-[340px] rounded-lg border bg-white p-3 pt-0 font-condensed text-[11px] leading-tight shadow-sm">
        <header className="report-header invoice-print-header text-center">
          {headerConfig?.logo_url && (
            <img
              src={headerConfig.logo_url}
              alt="Logo laboratoire"
              className="mx-auto mb-1 h-14 max-w-32 object-contain"
            />
          )}
          <h1 className="text-sm font-bold uppercase">
            {/* {headerConfig?.lab_name || "Laboratoire"} */}
            DECLIC SANTE
          </h1>
          <div className="mt-1 space-y-0.5 text-[10px] leading-tight">
            <p>LABORATOIRE D’ANALYSE Sis  à Medina Coura </p>
            <p>TEL :92 90 69 64/67 73 73 50</p>
            {/* {headerConfig?.address_line1 && <p>{headerConfig.address_line1}</p>}
            {headerConfig?.address_line2 && <p>{headerConfig.address_line2}</p>}
            {headerConfig?.city_postal_code && (
              <p>{headerConfig.city_postal_code}</p>
            )}
            {headerConfig?.phone && <p>Tél: {headerConfig.phone}</p>}
            {headerConfig?.email && <p>{headerConfig.email}</p>}
            {headerConfig?.website && <p>{headerConfig.website}</p>} */}
          </div>
        </header>

        <div className="my-2 border-t border-dashed border-black" />

        <section className="invoice-section-patient space-y-1 leading-tight">
          <p>
            <span className="font-bold">Patient:</span>{" "}
            {invoice.patient?.full_name || "-"}
          </p>
          <p>ID: {extractId(invoice.patient?.patient_unique_id || "") || "-"}</p>
          {invoice.patient?.phone && <p>Tél: {invoice.patient.phone}</p>}
          <p>AMO: {invoice.has_insurance ? "Oui" : "Non"}</p>
        </section>

        <div className="my-2 border-t border-dashed border-black" />

        <section className="invoice-section-analyses leading-tight">
          <p>
            <span className="font-bold">Analyses:</span>{" "}
            {invoice.invoice_item.map((item) => item.test_name.split("#")[0].trim()).join(", ")}
          </p>
        </section>

        <div className="my-2 border-t border-dashed border-black" />

        <section className="invoice-section-totals space-y-1">
          <div className="flex gap-2 items-center text-sm font-bold">
            <span>Total:</span>
            <span className="font-mono">{formatCurrency(invoice.total)}</span>
          </div>
          {Number(invoice.remaining_amount || 0) > 0 && (
            <div className="invoice-remaining flex items-center gap-2 font-bold font-mono">
              <span>Restant:</span>
              <span>{formatCurrency(invoice.remaining_amount)}</span>
            </div>
          )}
        </section>

        {invoice.notes && (
          <>
            <div className="my-2 border-t border-dashed border-black" />
            <p className="leading-tight">Note: {invoice.notes}</p>
          </>
        )}

        <div className="my-2 border-t border-dashed border-black" />

        <footer className="text-center">
          <p className="mt-1 text-[10px]">Merci pour votre confiance</p>
          <p className="mt-0.5 text-[8px]">
            {format(parseISO(invoice.created_at), "dd/MM/yyyy HH:mm", {
              locale: fr,
            })}
          </p>
        </footer>
      </article>
    </div>
  );
};

export default FactureDetailPage;
