import { type SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";

interface SpecializedResultsDatabase {
  public: {
    Tables: {
      vhb: {
        Row: {
          id: string;
          result_id: string;
          value: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          result_id: string;
          value?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          result_id?: string;
          value?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      protidogramme: {
        Row: {
          id: string;
          result_id: string;
          image: string | null;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          result_id: string;
          image?: string | null;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          result_id?: string;
          image?: string | null;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export const specializedResultsClient =
  supabase as unknown as SupabaseClient<SpecializedResultsDatabase>;
