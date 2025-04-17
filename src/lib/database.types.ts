export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      category: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      doctor: {
        Row: {
          bio: string | null
          created_at: string
          full_name: string
          hospital: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          full_name: string
          hospital?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          full_name?: string
          hospital?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      doctor_fee_config: {
        Row: {
          id: string
          doctor_id: string
          normal_price_percentage: number
          insurance_price_percentage: number
          effective_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          doctor_id: string
          normal_price_percentage: number
          insurance_price_percentage: number
          effective_date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          doctor_id?: string
          normal_price_percentage?: number
          insurance_price_percentage?: number
          effective_date?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_fee_config_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor"
            referencedColumns: ["id"]
          }
        ]
      }
      patient: {
        Row: {
          created_at: string
          date_of_birth: string | null
          full_name: string
          gender: string | null
          id: string
          patient_unique_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          gender?: string | null
          id?: string
          patient_unique_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          patient_unique_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patient_result: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          patient_id: string
          result_date: string
          status: string
          normal_price: number | null
          insurance_price: number | null
          paid_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          patient_id: string
          result_date: string
          status?: string
          normal_price?: number | null
          insurance_price?: number | null
          paid_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          patient_id?: string
          result_date?: string
          status?: string
          normal_price?: number | null
          insurance_price?: number | null
          paid_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_result_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_result_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          }
        ]
      }
      print_header_config: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city_postal_code: string | null
          created_at: string
          email: string | null
          id: string
          lab_name: string | null
          logo_url: string | null
          phone: string | null
          selected_template: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city_postal_code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lab_name?: string | null
          logo_url?: string | null
          phone?: string | null
          selected_template?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city_postal_code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lab_name?: string | null
          logo_url?: string | null
          phone?: string | null
          selected_template?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      result_value: {
        Row: {
          created_at: string
          id: string
          patient_result_id: string
          test_parameter_id: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_result_id: string
          test_parameter_id: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_result_id?: string
          test_parameter_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_value_patient_result_id_fkey"
            columns: ["patient_result_id"]
            isOneToOne: false
            referencedRelation: "patient_result"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_value_test_parameter_id_fkey"
            columns: ["test_parameter_id"]
            isOneToOne: false
            referencedRelation: "test_parameter"
            referencedColumns: ["id"]
          }
        ]
      }
      ristourne: {
        Row: {
          id: string
          doctor_id: string
          created_date: string
          status: string
          total_fee: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          doctor_id: string
          created_date?: string
          status?: string
          total_fee?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          doctor_id?: string
          created_date?: string
          status?: string
          total_fee?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ristourne_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctor"
            referencedColumns: ["id"]
          }
        ]
      }
      ristourne_patient_result: {
        Row: {
          id: string
          ristourne_id: string
          patient_result_id: string
          fee_amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ristourne_id: string
          patient_result_id: string
          fee_amount: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ristourne_id?: string
          patient_result_id?: string
          fee_amount?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ristourne_patient_result_patient_result_id_fkey"
            columns: ["patient_result_id"]
            isOneToOne: false
            referencedRelation: "patient_result"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ristourne_patient_result_ristourne_id_fkey"
            columns: ["ristourne_id"]
            isOneToOne: false
            referencedRelation: "ristourne"
            referencedColumns: ["id"]
          }
        ]
      }
      test_parameter: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          reference_range: string | null
          test_type_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          reference_range?: string | null
          test_type_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          reference_range?: string | null
          test_type_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_parameter_test_type_id_fkey"
            columns: ["test_type_id"]
            isOneToOne: false
            referencedRelation: "test_type"
            referencedColumns: ["id"]
          }
        ]
      }
      test_type: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
export type CompositeTypes<T extends keyof Database['public']['CompositeTypes']> = Database['public']['CompositeTypes'][T]
