import React, { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useParams } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";

type ReceiptVerification = {
  invoice_number: string;
  created_at: string;
  total: number | string;
  payment_status: string;
  patient_reference: string | null;
  patient_initials: string | null;
};

const paymentLabel: Record<string, string> = {
  paid: "Payee",
  partial: "Partielle",
  unpaid: "Non payee",
};

const formatCurrency = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const ReceiptVerificationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [receipt, setReceipt] = useState<ReceiptVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const verifyReceipt = async () => {
      setLoading(true);
      setInvalid(false);

      const { data, error } = await supabase.rpc("verify_invoice_receipt", {
        p_token: token || "",
      });

      if (!isMounted) return;

      if (error || !data) {
        setReceipt(null);
        setInvalid(true);
      } else {
        setReceipt(data as ReceiptVerification);
        setInvalid(false);
      }

      setLoading(false);
    };

    verifyReceipt();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <main className="min-h-screen overflow-y-auto bg-slate-50 px-4 py-8 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col justify-center">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-700 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Verification recu
            </p>
            <h1 className="text-2xl font-semibold tracking-normal">
              Clinique Declic Sante
            </h1>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-3 rounded-md border bg-white p-5 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
            <p className="font-medium">Verification du recu...</p>
          </div>
        )}

        {!loading && receipt && (
          <div className="rounded-md border bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-700" />
              <div>
                <h2 className="text-xl font-semibold">Recu authentique</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Ce recu correspond a une facture enregistree dans le systeme.
                </p>
              </div>
            </div>

            <dl className="grid gap-3 border-t pt-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Facture</dt>
                <dd className="font-mono font-semibold">
                  {receipt.invoice_number}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Date</dt>
                <dd className="font-medium">
                  {format(parseISO(receipt.created_at), "dd/MM/yyyy HH:mm", {
                    locale: fr,
                  })}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Total</dt>
                <dd className="font-mono font-semibold">
                  {formatCurrency(receipt.total)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Paiement</dt>
                <dd className="font-medium">
                  {paymentLabel[receipt.payment_status] ||
                    receipt.payment_status}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-500">Patient</dt>
                <dd className="text-right font-medium">
                  {[receipt.patient_reference, receipt.patient_initials]
                    .filter(Boolean)
                    .join(" / ") || "-"}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {!loading && invalid && (
          <Alert variant="destructive" className="bg-white">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Recu introuvable ou non authentique</AlertTitle>
            <AlertDescription>
              Aucune facture valide ne correspond a ce QR code.
            </AlertDescription>
          </Alert>
        )}
      </section>
    </main>
  );
};

export default ReceiptVerificationPage;
