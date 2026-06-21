import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useMemo } from "react";

import Footer from "@/components/Footer";
import Template1 from "@/components/print_header/Template1";
import Template2 from "@/components/print_header/Template2";
import Template3 from "@/components/print_header/Template3";
import Template4 from "@/components/print_header/Template4";
import {
  type AmoJsonCategory,
  type AmoResultRecord,
  type AmoVhbRecord,
} from "@/lib/bilanAmoJson";
import { type Tables } from "@/lib/supabaseClient";
import { extractId, extractTestTypeName } from "@/lib/utils";

type PrintHeaderConfig = Tables<"print_header_config">;

interface StandardResultPrintReportProps {
  result: AmoResultRecord;
  categories: AmoJsonCategory[];
  headerConfig: PrintHeaderConfig | null;
  vhb: AmoVhbRecord | null;
  protidogramme: {
    id: string;
    description: string | null;
    imageUrl: string | null;
  } | null;
}

const headerTemplates = {
  template1: Template1,
  template2: Template2,
  template3: Template3,
  template4: Template4,
};

const displayValue = (value: string | null | undefined) =>
  value || "Non renseigné";

const renderHtml = (value: string | null | undefined, fallback = "-") => ({
  __html: value || fallback,
});

const normalizeText = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const StandardResultPrintReport = ({
  result,
  categories,
  headerConfig,
  vhb,
  protidogramme,
}: StandardResultPrintReportProps) => {
  const templateId =
    headerConfig?.selected_template &&
    headerConfig.selected_template in headerTemplates
      ? (headerConfig.selected_template as keyof typeof headerTemplates)
      : "template1";
  const HeaderTemplate = headerTemplates[templateId];
  const patient = result.patient;
  const doctor = result.doctor;
  const printableCategories = useMemo(() => {
    if (!vhb) return categories;

    return categories
      .map((category) => ({
        ...category,
        test_types: category.test_types
          .map((testType) => ({
            ...testType,
            parameters: testType.parameters.filter((parameter) => {
              const isAutresCategory =
                normalizeText(category.name) === "AUTRES";
              const isRoutingParameter =
                normalizeText(parameter.name) === "POUR";
              const isVhbRoutingValue = normalizeText(
                parameter.value
              ).includes("VHB");

              return !(
                isAutresCategory &&
                isRoutingParameter &&
                isVhbRoutingValue
              );
            }),
          }))
          .filter((testType) => testType.parameters.length > 0),
      }))
      .filter((category) => category.test_types.length > 0);
  }, [categories, vhb]);

  const headerData = {
    logoUrl: headerConfig?.logo_url || null,
    labName: headerConfig?.lab_name,
    addressLine1: headerConfig?.address_line1,
    addressLine2: headerConfig?.address_line2,
    cityPostalCode: headerConfig?.city_postal_code,
    phone: headerConfig?.phone,
    email: headerConfig?.email,
    website: headerConfig?.website,
  };

  return (
    <article className="amo-bulk-report report-content bg-white">
      <div className="mb-4">
        {headerConfig ? (
          <HeaderTemplate data={headerData} isPreview={false} />
        ) : (
          <div className="border-b pb-3 text-center">
            <h1 className="text-xl font-bold">RAPPORT DE RÉSULTATS</h1>
          </div>
        )}
      </div>

      <div className="amo-report-identity mb-4 grid grid-cols-2 gap-4">
        <section className="rounded-md border border-slate-600 p-2 text-xs">
          <h2 className="mb-2 font-bold uppercase">Patient</h2>
          <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1">
            <dt>Nom prénom</dt>
            <dd className="font-semibold">{displayValue(patient?.full_name)}</dd>
            <dt>ID unique</dt>
            <dd className="font-semibold">
              {patient?.patient_unique_id
                ? extractId(patient.patient_unique_id)
                : result.patient_id}
            </dd>
            <dt>Date naissance</dt>
            <dd>
              {patient?.date_of_birth
                ? format(parseISO(patient.date_of_birth), "P", { locale: fr })
                : "Non renseignée"}
            </dd>
            <dt>Genre</dt>
            <dd>{displayValue(patient?.gender)}</dd>
            <dt>Téléphone</dt>
            <dd>{displayValue(patient?.phone)}</dd>
          </dl>
        </section>

        <section className="rounded-md border border-slate-600 p-2 text-xs">
          <h2 className="mb-2 font-bold uppercase">Médecin</h2>
          <dl className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1">
            <dt>Nom prénom</dt>
            <dd className="font-semibold">{displayValue(doctor?.full_name)}</dd>
            <dt>Téléphone</dt>
            <dd>{displayValue(doctor?.phone)}</dd>
            <dt>Provenance</dt>
            <dd>{displayValue(doctor?.hospital)}</dd>
            <dt>Date résultat</dt>
            <dd>
              {format(parseISO(result.result_date), "Pp", { locale: fr })}
            </dd>
            <dt>Statut</dt>
            <dd>{displayValue(result.status)}</dd>
          </dl>
        </section>
      </div>

      <div className="space-y-5">
        {printableCategories.length === 0 && !vhb && !protidogramme ? (
          <p className="rounded-md border p-6 text-center text-sm italic">
            Aucun résultat standard à afficher.
          </p>
        ) : (
          printableCategories.map((category) => (
            <section key={category.id} className="amo-report-category">
              <h2 className="mb-2 text-center text-lg font-bold uppercase">
                {category.name}
              </h2>
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="w-[38%]">Paramètre</th>
                    <th className="w-[22%]">Valeur</th>
                    <th className="w-[15%]">Unité</th>
                    <th className="w-[25%]">Réf.</th>
                  </tr>
                </thead>
                <tbody>
                  {category.test_types.map((testType) => (
                    <FragmentWithKey key={testType.id}>
                      {testType.parameters.length > 1 && (
                        <tr className="bg-gray-50">
                          <td colSpan={4} className="font-semibold">
                            {extractTestTypeName(testType.name)}
                          </td>
                        </tr>
                      )}
                      {testType.parameters.map((parameter) => (
                        <tr key={parameter.id}>
                          <td
                            className="font-medium"
                            dangerouslySetInnerHTML={renderHtml(parameter.name)}
                          />
                          <td>{parameter.value}</td>
                          <td
                            dangerouslySetInnerHTML={renderHtml(parameter.unit)}
                          />
                          <td
                            className="whitespace-pre-line"
                            dangerouslySetInnerHTML={renderHtml(
                              parameter.reference_range
                            )}
                          />
                        </tr>
                      ))}
                      {testType.description && (
                        <tr>
                          <td
                            colSpan={4}
                            className="text-xs"
                            dangerouslySetInnerHTML={{
                              __html: testType.description,
                            }}
                          />
                        </tr>
                      )}
                    </FragmentWithKey>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}
      </div>

      {vhb && (
        <section className="amo-specialized-section mt-8 text-black">
          <h2 className="mb-4 text-center text-2xl font-bold uppercase">
            Virologie
          </h2>
          <div className="mb-4 flex justify-between font-bold underline">
            <span>EXAMENS</span>
            <span>RÉSULTATS</span>
          </div>
          <h3 className="mb-6 text-lg font-bold underline">
            CHARGE VIRALE HEPATITE B
          </h3>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="font-semibold">Charge virale VHB</p>
              <p className="mt-1 text-xs">
                (Abbott m2000rt et m2000sp Technique PCR en temps réel)
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">
                {vhb.value || "Non renseigné"}
              </p>
            </div>
          </div>
        </section>
      )}

      {protidogramme && (
        <section className="amo-specialized-section mt-8 text-black">
          <h2 className="mb-4 text-center text-2xl font-bold uppercase">
            Protidogramme
          </h2>
          {protidogramme.imageUrl && (
            <img
              src={protidogramme.imageUrl}
              alt="Protidogramme"
              className="mx-auto mb-4 max-h-[450px] max-w-full rounded border object-contain"
            />
          )}
          {protidogramme.description && (
            <div className="whitespace-pre-line text-sm">
              {protidogramme.description}
            </div>
          )}
        </section>
      )}

      <div className="mt-4 text-sm">
        {result.description && (
          <div className="mb-4 font-bold whitespace-pre-line">
            {result.description}
          </div>
        )}
        <Footer date={result.result_date} />
      </div>
    </article>
  );
};

const FragmentWithKey = ({
  children,
}: {
  children: React.ReactNode;
}) => <>{children}</>;

export default StandardResultPrintReport;
