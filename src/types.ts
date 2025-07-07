// src/types.ts
export interface PatientResult {
  id: string; // Or number, depending on your Supabase schema
  normal_price: number | null;
  insurance_price: number | null;
  unpaid_amount: number | null;
  // ... other fields like created_at, patient_id, etc.
  [key: string]: any; // For other potential fields
}
