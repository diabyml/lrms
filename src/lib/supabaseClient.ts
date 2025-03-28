// src/lib/supabaseClient.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Import the generated Database types
import { Database } from "./database.types"; // Adjust path if you saved the types elsewhere

// Retrieve environment variables
const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey: string | undefined = import.meta.env
  .VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL and Anon Key are required. Check your .env file."
  );
}

// Create and export the Supabase client instance, now strongly typed!
// Pass the Database interface as a generic type argument to createClient
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);

// Define a type alias for Table rows for easier use (Optional but recommended)
// This allows you to easily type variables that hold data from specific tables.
// Example: type PatientRow = Tables<'patient'>;
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
// Add types for Views, Functions etc. if needed in the same way
