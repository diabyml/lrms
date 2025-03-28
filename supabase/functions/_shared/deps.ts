// supabase/functions/_shared/deps.ts
export { serve } from "https://deno.land/std@0.177.0/http/server.ts"; // Use std serve
export { createClient } from "https://esm.sh/@supabase/supabase-js@2";
export type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
export { render } from "https://deno.land/x/eta@v2.2.0/mod.ts"; // Eta templating

// --- OPTION A: Standard Deno Puppeteer Port (Try first) ---
export { default as puppeteer } from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
// --- If Option A fails on deploy, comment it out and uncomment Option B ---

/* --- OPTION B: Using @sparticuz/chromium-deno (More Reliable) ---
// You might need to adjust versions based on compatibility
export { default as puppeteer } from "https://esm.sh/puppeteer-core@19.7.3";
export { default as chromium } from "https://esm.sh/@sparticuz/chromium-deno@111.0.0"; // Or latest compatible
// --- END OPTION B --- */

// CORS headers helper
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Allow requests from any origin (adjust for production)
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
