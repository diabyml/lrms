// supabase/functions/generate-pdf-puppeteer/index.ts
// (Paste into Supabase Dashboard Function Editor)

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import { render } from "https://deno.land/x/eta@v2.2.0/mod.ts"; // Eta templating

// --- OPTION A: Standard Deno Puppeteer Port ---
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
// --- END OPTION A ---

/* --- OPTION B: Using @sparticuz/chromium-deno (More Reliable) ---
// Requires more setup/understanding - uncomment and use if Option A fails on deploy
import puppeteer from "https://esm.sh/puppeteer-core@19.7.3"; // Use puppeteer-core
import chromium from "https://esm.sh/@sparticuz/chromium-deno@111.0.0"; // Import chromium

// Optional: Increase function timeout if needed (via project.toml or dashboard settings later)
// chromium.setHeadless(true); // Already default in sparticuz v111+
// --- END OPTION B --- */

// --- Basic Types (Define if not shared) ---
type PatientResult = Record<string, any>;
type Patient = Record<string, any>;
type Doctor = Record<string, any>;
type PrintConfig = Record<string, any>;
type Category = Record<string, any>;
type TestType = Record<string, any>;
type TestParameter = Record<string, any>;
interface GroupedTestType {
  testType: TestType;
  parameters: any[];
}
interface GroupedCategoryResult {
  category: Category;
  testTypes: GroupedTestType[];
}
// --- End Types ---

// --- CORS Headers ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Adjust for production
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Helpers (Date Format, Status Display, Basic Header HTML) ---
function formatDate(
  dateString: string | null | undefined,
  includeTime = false
): string {
  try {
    const d = new Date(dateString!);
    const o: Intl.DateTimeFormatOptions = { dateStyle: "medium" };
    if (includeTime) o.timeStyle = "short";
    return d.toLocaleString("fr-FR", o);
  } catch (e) {
    return "N/A";
  }
}
const displayStatus = (status: string | null): string => {
  switch (status?.toLowerCase()) {
    case "fini":
      return "Fini";
    case "en cours":
      return "En cours";
    case "attente":
      return "En attente";
    default:
      return status || "Inconnu";
  }
};
// Basic HTML header generator (same simple one)
async function getHeaderHtml(config: PrintConfig | null): Promise<string> {
  if (!config) return '<p style="color:red;">Config manquante</p>';
  const t = config.selected_template || "template1";
  let h = `<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #ccc;padding-bottom:10px;margin-bottom:15px;font-size:9pt;">`;
  if (t === "template1" || t === "template_smart_header") {
    h += `<div style="width:25%;">${
      config.logo_url
        ? `<img src="${config.logo_url}" style="max-height:50px;"/>`
        : ""
    }</div><div style="width:70%;text-align:right;"><p style="font-weight:bold;font-size:1.1em;color:#0054A6;">${
      config.lab_name || ""
    }</p><p>${config.address_line1 || ""}</p><p>${
      config.address_line2 || ""
    }</p><p>${config.city_postal_code || ""}</p><p>Tél: ${
      config.phone || ""
    }</p></div>`;
  } else {
    h += `<div style="width:100%;text-align:center;">${
      config.logo_url
        ? `<img src="${config.logo_url}" style="max-height:40px;margin-bottom:5px;"/><br/>`
        : ""
    }<p style="font-weight:bold;">${config.lab_name || ""}</p><p>${
      config.address_line1 || ""
    } ${config.city_postal_code || ""}</p><p>Tél: ${
      config.phone || ""
    }</p></div>`;
  }
  h += `</div>`;
  if (t === "template_smart_header") {
    h += `<div style="display:flex;justify-content:flex-end;margin:-5px 0 10px 0;"><span style="background-color:#0054A6;color:white;font-size:0.8em;padding:2px 8px;border-radius:3px;">RAPPORT DE RÉSULTATS</span></div>`;
  }
  return h;
}

// --- Main Function Logic ---
Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let browser = null; // Declare browser outside try for finally block

  try {
    const url = new URL(req.url);
    const resultId = url.searchParams.get("resultId");
    if (!resultId) throw new Error("ID du résultat manquant.");

    // --- Init Supabase Admin Client ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`PDF: Fetching data for resultId: ${resultId}`);
    // --- Fetch ALL data ---
    const [resultRes, headerRes, valuesRes] = await Promise.all([
      /* ... fetch result, header, values ... */
    ]);
    // Re-add fetches
    const [resultRes, headerRes, valuesRes] = await Promise.all([
      supabaseAdmin
        .from("patient_result")
        .select("*")
        .eq("id", resultId)
        .single(),
      supabaseAdmin
        .from("print_header_config")
        .select("*")
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("result_value")
        .select(
          `value, test_parameter: test_parameter_id (*, test_type: test_type_id (*, category: category_id (id, name)))`
        )
        .eq("patient_result_id", resultId),
    ]);
    if (resultRes.error) throw resultRes.error;
    if (!resultRes.data) throw new Error("Résultat non trouvé.");
    const result = resultRes.data;
    const headerConfig = headerRes?.data;
    const [patientRes, doctorRes] = await Promise.all([
      supabaseAdmin
        .from("patient")
        .select("*")
        .eq("id", result.patient_id)
        .single(),
      supabaseAdmin
        .from("doctor")
        .select("*")
        .eq("id", result.doctor_id)
        .single(),
    ]);
    const patient = patientRes?.data;
    const doctor = doctorRes?.data;
    const valuesData = valuesRes?.data || [];
    console.log(`PDF: Fetched ${valuesData.length} result values.`);

    // --- Process and group values ---
    const categoryMap = new Map<string, GroupedCategoryResult>();
    valuesData.forEach((rv: any) => {
      /* ... grouping logic ... */
    });
    // Re-add grouping logic
    valuesData.forEach((rv: Record<string, any>) => {
      const param = rv.test_parameter as any;
      if (param && param.test_type && param.test_type.category) {
        const categoryId = param.test_type.category.id;
        if (!categoryMap.has(categoryId)) {
          categoryMap.set(categoryId, {
            category: param.test_type.category,
            testTypes: [],
          });
        }
        const categoryGroup = categoryMap.get(categoryId)!;
        let testTypeGroup = categoryGroup.testTypes.find(
          (ttg) => ttg.testType.id === param.test_type.id
        );
        if (!testTypeGroup) {
          testTypeGroup = { testType: param.test_type, parameters: [] };
          categoryGroup.testTypes.push(testTypeGroup);
        }
        testTypeGroup.parameters.push({ ...param, resultValue: rv.value });
      }
    });
    categoryMap.forEach((cg) => {
      cg.testTypes.forEach((ttg) => {
        ttg.parameters.sort((a, b) => a.name.localeCompare(b.name));
      });
      cg.testTypes.sort((a, b) =>
        a.testType.name.localeCompare(b.testType.name)
      );
    });
    const groupedResults = Array.from(categoryMap.values()).sort((a, b) =>
      a.category.name.localeCompare(b.category.name)
    );
    console.log(`PDF: Processed ${groupedResults.length} categories.`);

    // --- Render HTML content using Eta ---
    // Read the template text (assuming it exists relative to the function)
    // NOTE: Accessing local files in dashboard editor might be tricky.
    // Consider embedding the template string directly or fetching it if needed.
    // For now, embedding a simplified version:
    const templateString = `
        <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport</title>
        <style>
          body { font-family: system-ui, sans-serif; font-size: 10pt; margin: 0; padding: 0; } /* System font */
          .report-page { padding: 1cm; width: 210mm; min-height: 297mm; box-sizing: border-box; background: white; } /* A4 size */
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid; }
          th, td { border: 1px solid #e2e8f0; padding: 4px 6px; text-align: left; font-size: 9pt; }
          th { background-color: #f7fafc; font-weight: 600; }
          h2 { font-size: 13pt; font-weight: 600; border-bottom: 1px solid #cbd5e1; margin-top: 16px; margin-bottom: 6px; }
          h3 { font-size: 11pt; font-weight: 600; margin-top: 12px; margin-bottom: 4px; }
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; font-size: 9pt; }
          .info-card { border: 1px solid #e2e8f0; padding: 8px; border-radius: 4px; }
          .info-card h4 { font-weight: 600; margin-bottom: 3px; font-size: 9pt; text-transform: uppercase; color: #4a5568; }
        </style>
        </head><body><div class="report-page">
        <%- /* Use raw output tag for HTML */ it.headerHtml %> <%# /* Render pre-generated header */ %>
        <hr style="margin: 15px 0; border-top: 1px solid #e2e8f0;"/>
        <div class="info-grid">
          <div class="info-card"><h4>Patient</h4><p>Nom: <%= it.patient?.full_name||'N/A' %></p><p>ID: <%= it.patient?.patient_unique_id||'N/A' %></p><p>Né(e): <%= it.formatDate(it.patient?.date_of_birth) %></p></div>
          <div class="info-card"><h4>Médecin</h4><p>Nom: <%= it.doctor?.full_name||'N/A' %></p><p>Tél: <%= it.doctor?.phone||'N/A' %></p><p>Hôpital: <%= it.doctor?.hospital||'N/A' %></p></div>
          <div class="info-card"><h4>Résultat</h4><p>Date: <%= it.formatDate(it.result?.result_date, true) %></p><p>Statut: <%= it.displayStatus(it.result?.status) %></p></div>
        </div>
        <% it.groupedResults.forEach(cg => { %>
          <div style="page-break-inside: avoid;">
            <h2><%= cg.category.name %></h2>
            <% cg.testTypes.forEach(ttg => { %>
              <div style="page-break-inside: avoid; margin-bottom: 8px;">
                <% const isSingle = ttg.parameters.length === 1; %>
                <% if (!isSingle) { %> <h3><%= ttg.testType.name %></h3> <% } %>
                <table>
                  <% if (!isSingle) { %> <thead><tr><th>Paramètre</th><th>Valeur</th><th>Unité</th><th>Réf.</th></tr></thead> <% } %>
                  <tbody>
                    <% if (ttg.parameters.length > 0) { %>
                      <% ttg.parameters.forEach(p => { %> <tr><td><%= p.name %></td><td><%= p.resultValue %></td><td><%= p.unit||'-' %></td><td style="color:#4a5568;"><%= p.reference_range||'-' %></td></tr> <% }) %>
                    <% } else { %> <tr><td colspan="4" style="text-align:center;font-style:italic;">(Aucun paramètre)</td></tr> <% } %>
                  </tbody>
                </table>
              </div>
            <% }) %>
          </div>
        <% }) %>
        </div></body></html>
     `;

    const headerHtml = await getHeaderHtml(headerConfig);
    // Render the template string using Eta
    const reportHtml = render(templateString, {
      headerHtml: headerHtml,
      patient: patient,
      doctor: doctor,
      result: result,
      groupedResults: groupedResults,
      displayStatus: displayStatus,
      formatDate: formatDate, // Pass helper functions
    }) as string; // Cast Eta result to string

    if (!reportHtml) throw new Error("Échec du rendu du modèle HTML.");
    console.log("PDF: HTML rendered.");

    // --- Generate PDF using Puppeteer ---
    console.log("PDF: Launching browser...");
    let pdfBuffer: Uint8Array | null = null;

    // --- CHOOSE OPTION A or B ---

    // // -- Option A: Deno Puppeteer Port --
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    /* // -- Option B: @sparticuz/chromium-deno --
     // Needs additional setup if download fails on deploy
     console.log("PDF: Getting executable path...");
     const executablePath = await chromium.executablePath();
     console.log(`PDF: Executable path: ${executablePath}`);
     if (!executablePath) {
         console.log("PDF: Chromium not found, attempting download...");
         // Optional: Download Chromium if not found. This adds startup time.
         // Adjust download path if needed (may not be writable in all environments)
         // await chromium.download();
         // executablePath = await chromium.executablePath();
         // if (!executablePath) {
             throw new Error("Chromium executable not found or download failed.");
         // }
     }
     browser = await puppeteer.launch({
         executablePath,
         headless: chromium.headless, // Use headless value from chromium module
         args: [...chromium.args, '--disable-dev-shm-usage', '--no-sandbox'], // Recommended args
         // May need to adjust viewport/defaultViewport
         // defaultViewport: chromium.defaultViewport,
     });
    // -- End Option B -- */

    console.log("PDF: Browser launched.");
    const page = await browser.newPage();
    console.log("PDF: Setting content...");
    // Set content directly - using template string with basic CSS
    await page.setContent(reportHtml, { waitUntil: "domcontentloaded" }); // Use domcontentloaded as there are no external network resources
    console.log("PDF: Generating PDF...");
    pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true, // To print background colors if any (like table headers)
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" }, // Standard margins
      // preferCSSPageSize: true, // Use CSS @page size if defined
    });
    console.log("PDF: PDF generated.");

    // --- Return PDF Response ---
    if (!pdfBuffer)
      throw new Error("Échec de la génération du PDF (buffer vide).");
    const filename = `Resultat_${
      patient?.full_name?.replace(/ /g, "_") || "Patient"
    }_${result?.result_date ? formatDate(result.result_date) : "date"}.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      status: 200,
    });
  } catch (error) {
    console.error("PDF Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error.message.includes("non trouvé") ? 404 : 500,
    });
  } finally {
    if (browser) {
      console.log("PDF: Closing browser...");
      await browser.close();
      console.log("PDF: Browser closed.");
    }
  }
});
