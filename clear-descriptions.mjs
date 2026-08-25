import { createClient } from "@supabase/supabase-js";

const email = process.env.SUPABASE_EMAIL;
const password = process.env.SUPABASE_PASSWORD;

if (!email || !password) {
  console.error("Usage: SUPABASE_EMAIL=... SUPABASE_PASSWORD=... node clear-descriptions.mjs");
  process.exit(1);
}

const url = "https://efcjjznamgufzomtylru.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmY2pqem5hbWd1ZnpvbXR5bHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NjYsImV4cCI6MjA3NDM4Njg2Nn0.3pGpGEfItxyrOWzUOL1BJBi-OOzpNKBKlPoQaJPA8xQ";

const supabase = createClient(url, anonKey);
console.log("Signing in...");
const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });

if (authErr) { console.error("Login failed:", authErr.message); process.exit(1); }
console.log("Logged in as:", authData.user.email);

const cutoff = new Date();
cutoff.setMonth(cutoff.getMonth() - 2);
const cutoffStr = cutoff.toISOString();
console.log("Cutoff date:", cutoffStr.split("T")[0]);

console.log("Counting...");
const { count, error: countErr } = await supabase
  .from("patient_result")
  .select("*", { count: "exact", head: true })
  .lt("result_date", cutoffStr);

if (countErr) { console.error("Count error:", countErr.message); process.exit(1); }
console.log("Rows older than 2 months:", count);

if (count === 0) { console.log("Nothing to update."); process.exit(0); }

console.log("Updating...");
const { error: updateErr } = await supabase
  .from("patient_result")
  .update({ description: null })
  .lt("result_date", cutoffStr);

if (updateErr) { console.error("Update error:", updateErr.message); process.exit(1); }

console.log("Done. description set to NULL for", count, "rows.");
