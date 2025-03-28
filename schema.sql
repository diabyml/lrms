-- --------------------------------------------------
-- Enable UUID generation
-- --------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- Supabase typically has this enabled, but uncomment if needed.

-- --------------------------------------------------
-- Table: Doctor
-- --------------------------------------------------
CREATE TABLE public.doctor (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    phone text NULL,
    hospital text NULL,
    bio text NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add comments for clarity
COMMENT ON TABLE public.doctor IS 'Represents a referring or ordering physician.';
COMMENT ON COLUMN public.doctor.hospital IS 'Name of the primary hospital/clinic';
COMMENT ON COLUMN public.doctor.bio IS 'Brief description or notes about the doctor';

-- --------------------------------------------------
-- Table: Patient
-- --------------------------------------------------
CREATE TABLE public.patient (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_unique_id text UNIQUE NOT NULL,
    full_name text NOT NULL,
    date_of_birth date NULL,
    gender text NULL,
    phone text NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add comments for clarity
COMMENT ON TABLE public.patient IS 'Represents an individual whose tests are being processed.';
COMMENT ON COLUMN public.patient.patient_unique_id IS 'e.g., MRN or lab-specific ID';
COMMENT ON COLUMN public.patient.gender IS 'e.g., Male, Female, Other, Prefer not to say';

-- --------------------------------------------------
-- Table: TestType
-- --------------------------------------------------
CREATE TABLE public.test_type (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add comments for clarity
COMMENT ON TABLE public.test_type IS 'Represents a category of test performed by the lab (e.g., CBC, Lipid Panel).';

-- --------------------------------------------------
-- Table: TestParameter
-- --------------------------------------------------
CREATE TABLE public.test_parameter (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    test_type_id uuid NOT NULL REFERENCES public.test_type(id) ON DELETE RESTRICT, -- Prevent deleting TestType if parameters exist
    name text NOT NULL,
    unit text NULL,
    reference_range text NULL,
    description text NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add index for faster lookups by test_type_id
CREATE INDEX idx_test_parameter_test_type_id ON public.test_parameter(test_type_id);

-- Add comments for clarity
COMMENT ON TABLE public.test_parameter IS 'Represents a specific measurement within a TestType (e.g., Hemoglobin, Cholesterol).';
COMMENT ON COLUMN public.test_parameter.unit IS 'e.g., g/dL, mg/dL';
COMMENT ON COLUMN public.test_parameter.reference_range IS 'e.g., 13.5-17.5, <200';
COMMENT ON COLUMN public.test_parameter.description IS 'Optional detailed explanation for the parameter or its range. Can contain plain text, HTML, or Markdown';


-- --------------------------------------------------
-- Table: PatientResult
-- --------------------------------------------------
CREATE TABLE public.patient_result (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES public.patient(id) ON DELETE RESTRICT, -- Prevent deleting patient if results exist
    doctor_id uuid NOT NULL REFERENCES public.doctor(id) ON DELETE RESTRICT,   -- Prevent deleting doctor if results exist
    result_date timestamp with time zone NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add indexes for faster lookups
CREATE INDEX idx_patient_result_patient_id ON public.patient_result(patient_id);
CREATE INDEX idx_patient_result_doctor_id ON public.patient_result(doctor_id);
CREATE INDEX idx_patient_result_result_date ON public.patient_result(result_date);

-- Add comments for clarity
COMMENT ON TABLE public.patient_result IS 'Represents a specific instance of testing for a patient, associated with a doctor.';
COMMENT ON COLUMN public.patient_result.result_date IS 'When the result was finalized/reported';

-- --------------------------------------------------
-- Table: ResultValue
-- --------------------------------------------------
CREATE TABLE public.result_value (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_result_id uuid NOT NULL REFERENCES public.patient_result(id) ON DELETE CASCADE, -- If a PatientResult is deleted, cascade delete its values
    test_parameter_id uuid NOT NULL REFERENCES public.test_parameter(id) ON DELETE RESTRICT, -- Prevent deleting parameter if values exist
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add indexes for faster lookups
CREATE INDEX idx_result_value_patient_result_id ON public.result_value(patient_result_id);
CREATE INDEX idx_result_value_test_parameter_id ON public.result_value(test_parameter_id);

-- Add comments for clarity
COMMENT ON TABLE public.result_value IS 'Stores the actual measured value for a specific parameter within a specific PatientResult.';
COMMENT ON COLUMN public.result_value.value IS 'Storing as text allows flexibility for numeric/non-numeric results';


-- --------------------------------------------------
-- Trigger Function for updated_at
-- --------------------------------------------------
-- Create a function that updates the updated_at column
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to all tables that have updated_at
CREATE TRIGGER set_timestamp_doctor
BEFORE UPDATE ON public.doctor
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_patient
BEFORE UPDATE ON public.patient
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_test_type
BEFORE UPDATE ON public.test_type
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_test_parameter
BEFORE UPDATE ON public.test_parameter
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_patient_result
BEFORE UPDATE ON public.patient_result
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_result_value
BEFORE UPDATE ON public.result_value
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();


-- --------------------------------------------------
-- Row Level Security (RLS) - Basic Policies for MVP
-- --------------------------------------------------
-- Enable RLS for all tables
ALTER TABLE public.doctor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_parameter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_value ENABLE ROW LEVEL SECURITY;

-- Create policies allowing authenticated users full access (MVP assumption: one lab context)
CREATE POLICY "Allow all access for authenticated users" ON public.doctor FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.patient FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.test_type FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.test_parameter FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.patient_result FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated users" ON public.result_value FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- --------------------------------------------------
-- End of Script
-- --------------------------------------------------