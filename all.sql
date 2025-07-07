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




-- ====================================================================
-- Script to add Category table and link Test Types
-- ====================================================================

DO $$
DECLARE
    hematologie_id UUID;
    biochimie_id UUID;
    endocrinologie_id UUID;
    non_categorise_id UUID;
BEGIN
    -- 1. Create the Category Table
    -- ==================================
    RAISE NOTICE '1. Creating public.category table...';
    CREATE TABLE IF NOT EXISTS public.category (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text UNIQUE NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        updated_at timestamp with time zone DEFAULT now() NOT NULL
    );
    COMMENT ON TABLE public.category IS 'Stores categories for grouping Test Types (e.g., Hématologie, Biochimie).';
    RAISE NOTICE ' -> public.category table created.';

    -- 2. Add category_id column to test_type table (initially nullable)
    -- ==================================
    RAISE NOTICE '2. Adding category_id column to public.test_type...';
    -- Check if column exists before adding to make script potentially re-runnable
    DO $alter$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'test_type' AND column_name = 'category_id'
        ) THEN
            ALTER TABLE public.test_type
            ADD COLUMN category_id uuid NULL;
            RAISE NOTICE ' -> category_id column added.';
        ELSE
            RAISE NOTICE ' -> category_id column already exists.';
        END IF;
    END $alter$;


    -- 3. Insert Initial Categories (French)
    -- ==================================
    RAISE NOTICE '3. Inserting initial categories...';
    INSERT INTO public.category (name) VALUES
    ('Hématologie'),          -- Hematology
    ('Biochimie'),            -- Biochemistry/Chemistry
    ('Endocrinologie'),       -- Endocrinology
    ('Immunologie'),          -- Immunology (Example)
    ('Microbiologie'),        -- Microbiology (Example)
    ('Non Catégorisé')        -- Fallback category
    ON CONFLICT (name) DO NOTHING; -- Avoid errors if categories already exist

    -- Get IDs of inserted categories for later use
    SELECT id INTO hematologie_id FROM public.category WHERE name = 'Hématologie';
    SELECT id INTO biochimie_id FROM public.category WHERE name = 'Biochimie';
    SELECT id INTO endocrinologie_id FROM public.category WHERE name = 'Endocrinologie';
    SELECT id INTO non_categorise_id FROM public.category WHERE name = 'Non Catégorisé';
    RAISE NOTICE ' -> Initial categories inserted/verified.';


    -- 4. Update existing test_type records with appropriate category_id
    -- ==================================
    RAISE NOTICE '4. Updating existing test_types with category_id...';
    UPDATE public.test_type
    SET category_id = hematologie_id
    WHERE name = 'Numération Formule Sanguine' AND category_id IS NULL; -- Update only if not already set

    UPDATE public.test_type
    SET category_id = biochimie_id
    WHERE name IN ('Bilan Lipidique', 'Ionogramme Sanguin') AND category_id IS NULL;

    UPDATE public.test_type
    SET category_id = endocrinologie_id
    WHERE name = 'Bilan Thyroïdien' AND category_id IS NULL;

    -- Optional: Assign remaining NULLs to 'Non Catégorisé'
    UPDATE public.test_type
    SET category_id = non_categorise_id
    WHERE category_id IS NULL;
    RAISE NOTICE ' -> Existing test_types updated.';


    -- 5. Add Foreign Key Constraint and Index
    -- ==================================
    RAISE NOTICE '5. Adding Foreign Key constraint and index...';
     -- Add FK Constraint (check if exists first)
    DO $fk$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_schema = 'public' AND table_name = 'test_type' AND constraint_name = 'fk_test_type_category'
        ) THEN
            ALTER TABLE public.test_type
            ADD CONSTRAINT fk_test_type_category
            FOREIGN KEY (category_id) REFERENCES public.category(id) ON DELETE RESTRICT; -- Prevent deleting category if test types exist
            RAISE NOTICE ' -> Foreign key constraint fk_test_type_category added.';
        ELSE
            RAISE NOTICE ' -> Foreign key constraint fk_test_type_category already exists.';
        END IF;
    END $fk$;

    -- Add Index (check if exists first)
    DO $idx$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = 'idx_test_type_category_id' AND n.nspname = 'public'
        ) THEN
            CREATE INDEX idx_test_type_category_id ON public.test_type(category_id);
            RAISE NOTICE ' -> Index idx_test_type_category_id created.';
        ELSE
            RAISE NOTICE ' -> Index idx_test_type_category_id already exists.';
        END IF;
    END $idx$;


    -- 6. Alter category_id column to be NOT NULL
    -- ==================================
    -- Run this only after confirming all rows are populated
    RAISE NOTICE '6. Setting category_id column to NOT NULL...';
    ALTER TABLE public.test_type
    ALTER COLUMN category_id SET NOT NULL;
    RAISE NOTICE ' -> category_id column set to NOT NULL.';


    -- 7. Apply updated_at trigger to category table
    -- ==================================
    RAISE NOTICE '7. Applying trigger_set_timestamp to category table...';
     -- Ensure the trigger function exists (it should from previous steps)
    DO $trig_check$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp') THEN
             RAISE EXCEPTION 'Trigger function trigger_set_timestamp not found. Please ensure it is created.';
        END IF;
    END $trig_check$;

    -- Create or replace the trigger on the category table
    DROP TRIGGER IF EXISTS set_timestamp_category ON public.category; -- Drop if exists to ensure clean state
    CREATE TRIGGER set_timestamp_category
    BEFORE UPDATE ON public.category
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();
    RAISE NOTICE ' -> Trigger applied to category table.';


    -- 8. Enable RLS and Add Basic Policy for Category Table
    -- ==================================
    RAISE NOTICE '8. Enabling RLS and adding policy for category table...';
    ALTER TABLE public.category ENABLE ROW LEVEL SECURITY;

    -- Allow authenticated users to read/write categories (adjust if needed)
    CREATE POLICY "Allow all access for authenticated users" ON public.category
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
    RAISE NOTICE ' -> RLS enabled and policy added for category table.';


    RAISE NOTICE 'Schema update complete.';

END $$;

-- Optional: Verification queries
-- SELECT c.name as category_name, tt.name as test_type_name
-- FROM public.test_type tt
-- JOIN public.category c ON tt.category_id = c.id
-- ORDER BY c.name, tt.name;

-- SELECT * from public.category;




-- Create the print header config table
CREATE TABLE IF NOT EXISTS public.print_header_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_name text NULL,
    address_line1 text NULL,
    address_line2 text NULL,
    city_postal_code text NULL,
    phone text NULL,
    email text NULL,
    website text NULL,
    logo_url text NULL, -- Public URL from Supabase Storage
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.print_header_config IS 'Stores configuration for the printable/PDF result header.';
COMMENT ON COLUMN public.print_header_config.logo_url IS 'Public URL of the logo image stored in Supabase Storage.';

-- Apply updated_at trigger (assuming function exists)
DROP TRIGGER IF EXISTS set_timestamp_print_header_config ON public.print_header_config;
CREATE TRIGGER set_timestamp_print_header_config
BEFORE UPDATE ON public.print_header_config
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Enable RLS and Add Basic Policy
ALTER TABLE public.print_header_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for authenticated users" ON public.print_header_config
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Optional: Ensure only one row can exist (if strictly single config)
-- Could use a constraint on a dummy column with a fixed value, or handle via application logic
-- For MVP, application logic (fetch first/upsert specific ID) is simpler.


-- Add selected_template column to print_header_config
ALTER TABLE public.print_header_config
ADD COLUMN IF NOT EXISTS selected_template TEXT NULL DEFAULT 'template1'; -- Default to 'template1'

COMMENT ON COLUMN public.print_header_config.selected_template IS 'Identifier for the chosen print header layout template (e.g., template1, template2).';

-- You may need to grant usage/select on the updated table again depending on your RLS policies
-- Example: GRANT SELECT, UPDATE, INSERT ON public.print_header_config TO authenticated;

-- THEN REGENERATE DATABASE TYPES!
-- npx supabase gen types typescript --linked > src/lib/database.types.ts


ALTER TABLE public.test_parameter ADD COLUMN "order" integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.test_parameter.order IS 'Determines the display order of parameters within a test type';


-- Add description field
ALTER TABLE public.test_type ADD COLUMN description text;
COMMENT ON COLUMN public.test_type.description IS 'Detailed description of the test type, including purpose, preparation instructions, or other relevant information';

-- Add description field
ALTER TABLE public.patient_result ADD COLUMN description text;
COMMENT ON COLUMN public.patient_result.description IS 'Additional notes or observations about the patient result';


-- Add pricing columns to patient_result table
ALTER TABLE public.patient_result 
ADD COLUMN normal_price decimal(10,2) NULL,
ADD COLUMN insurance_price decimal(10,2) NULL,
ADD COLUMN paid_status text NOT NULL DEFAULT 'unpaid';

COMMENT ON COLUMN public.patient_result.normal_price IS 'Regular price for the test';
COMMENT ON COLUMN public.patient_result.insurance_price IS 'Insurance coverage price for the test';
COMMENT ON COLUMN public.patient_result.paid_status IS 'Payment status: paid, unpaid, partial';

-- Create ristourne (referral fee) table
CREATE TABLE public.ristourne (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL REFERENCES public.doctor(id) ON DELETE RESTRICT,
    created_date timestamp with time zone DEFAULT now() NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    total_fee decimal(10,2) NOT NULL DEFAULT 0,
    notes text NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.ristourne IS 'Represents a referral fee collection for a doctor';
COMMENT ON COLUMN public.ristourne.status IS 'Status of the ristourne: pending, approved, paid';
COMMENT ON COLUMN public.ristourne.total_fee IS 'Total referral fee amount';

-- Create junction table for ristourne_patient_results
CREATE TABLE public.ristourne_patient_result (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ristourne_id uuid NOT NULL REFERENCES public.ristourne(id) ON DELETE CASCADE,
    patient_result_id uuid NOT NULL REFERENCES public.patient_result(id) ON DELETE RESTRICT,
    fee_amount decimal(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(ristourne_id, patient_result_id)
);

COMMENT ON TABLE public.ristourne_patient_result IS 'Links patient results to ristournes and stores individual fee amounts';



-- Create doctor fee configuration table
CREATE TABLE public.doctor_fee_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL REFERENCES public.doctor(id) ON DELETE RESTRICT,
    normal_price_percentage decimal(5,2) NOT NULL DEFAULT 0,
    insurance_price_percentage decimal(5,2) NOT NULL DEFAULT 0,
    effective_date timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT percentage_range CHECK (
        normal_price_percentage BETWEEN 0 AND 100 AND
        insurance_price_percentage BETWEEN 0 AND 100
    ),
    UNIQUE(doctor_id, effective_date)
);

COMMENT ON TABLE public.doctor_fee_config IS 'Stores referral fee percentages for doctors';
COMMENT ON COLUMN public.doctor_fee_config.normal_price_percentage IS 'Percentage of normal price to be given as referral fee';
COMMENT ON COLUMN public.doctor_fee_config.insurance_price_percentage IS 'Percentage of insurance price to be given as referral fee';
COMMENT ON COLUMN public.doctor_fee_config.effective_date IS 'When this fee configuration becomes effective';

-- Create index for faster lookups
CREATE INDEX idx_doctor_fee_config_doctor_id ON public.doctor_fee_config(doctor_id);

-- Add trigger for updated_at
CREATE TRIGGER set_timestamp_doctor_fee_config
    BEFORE UPDATE ON public.doctor_fee_config
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

-- Enable RLS
ALTER TABLE public.doctor_fee_config ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all access for authenticated users" ON public.doctor_fee_config 
    FOR ALL USING (auth.role() = 'authenticated') 
    WITH CHECK (auth.role() = 'authenticated');

-- Create indexes for faster lookups
CREATE INDEX idx_ristourne_doctor_id ON public.ristourne(doctor_id);
CREATE INDEX idx_ristourne_patient_result_ristourne_id ON public.ristourne_patient_result(ristourne_id);
CREATE INDEX idx_ristourne_patient_result_patient_result_id ON public.ristourne_patient_result(patient_result_id);

-- Add triggers for updated_at
CREATE TRIGGER set_timestamp_ristourne
    BEFORE UPDATE ON public.ristourne
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_ristourne_patient_result
    BEFORE UPDATE ON public.ristourne_patient_result
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();

-- Enable RLS for new tables
ALTER TABLE public.ristourne ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ristourne_patient_result ENABLE ROW LEVEL SECURITY;

-- Create policies for new tables
CREATE POLICY "Allow all access for authenticated users" ON public.ristourne 
    FOR ALL USING (auth.role() = 'authenticated') 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow all access for authenticated users" ON public.ristourne_patient_result 
    FOR ALL USING (auth.role() = 'authenticated') 
    WITH CHECK (auth.role() = 'authenticated');



    -- Function to handle ristourne creation/update with patient results
CREATE OR REPLACE FUNCTION handle_ristourne_upsert(
    p_ristourne_id uuid DEFAULT NULL,
    p_doctor_id uuid DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_total_fee numeric DEFAULT 0,
    p_patient_results jsonb DEFAULT '[]'::jsonb -- Array of {patient_result_id, fee_amount}
) RETURNS void AS $$
DECLARE
    v_ristourne_id uuid;
    v_result jsonb;
BEGIN
    -- Start transaction
    BEGIN
        -- If ristourne_id is provided, update existing ristourne
        IF p_ristourne_id IS NOT NULL THEN
            -- Update ristourne
            UPDATE ristourne
            SET 
                doctor_id = p_doctor_id,
                notes = p_notes,
                total_fee = p_total_fee,
                updated_at = NOW()
            WHERE id = p_ristourne_id
            RETURNING id INTO v_ristourne_id;

            -- Delete existing ristourne_patient_result entries
            DELETE FROM ristourne_patient_result
            WHERE ristourne_id = v_ristourne_id;
        ELSE
            -- Create new ristourne
            INSERT INTO ristourne (
                doctor_id,
                created_date,
                status,
                total_fee,
                notes,
                created_at,
                updated_at
            ) VALUES (
                p_doctor_id,
                CURRENT_DATE,
                'pending',
                p_total_fee,
                p_notes,
                NOW(),
                NOW()
            ) RETURNING id INTO v_ristourne_id;
        END IF;

        -- Insert new ristourne_patient_result entries
        FOR v_result IN SELECT * FROM jsonb_array_elements(p_patient_results)
        LOOP
            INSERT INTO ristourne_patient_result (
                ristourne_id,
                patient_result_id,
                fee_amount,
                created_at,
                updated_at
            ) VALUES (
                v_ristourne_id,
                (v_result->>'patient_result_id')::uuid,
                (v_result->>'fee_amount')::numeric,
                NOW(),
                NOW()
            );

            -- Update patient_result paid_status
            UPDATE patient_result
            SET paid_status = 'pending'
            WHERE id = (v_result->>'patient_result_id')::uuid;
        END LOOP;

        -- Commit transaction
        COMMIT;
    EXCEPTION WHEN OTHERS THEN
        -- Rollback transaction on error
        ROLLBACK;
        RAISE;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Enable RLS on ristourne tables
ALTER TABLE ristourne ENABLE ROW LEVEL SECURITY;
ALTER TABLE ristourne_patient_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_fee_config ENABLE ROW LEVEL SECURITY;

-- Policies for ristourne table
CREATE POLICY "Allow read access to authenticated users"
    ON ristourne
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert access to authenticated users"
    ON ristourne
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow update access to authenticated users"
    ON ristourne
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow delete access to authenticated users"
    ON ristourne
    FOR DELETE
    TO authenticated
    USING (true);

-- Policies for ristourne_patient_result table
CREATE POLICY "Allow read access to authenticated users"
    ON ristourne_patient_result
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert access to authenticated users"
    ON ristourne_patient_result
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow update access to authenticated users"
    ON ristourne_patient_result
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow delete access to authenticated users"
    ON ristourne_patient_result
    FOR DELETE
    TO authenticated
    USING (true);

-- Policies for doctor_fee_config table
CREATE POLICY "Allow read access to authenticated users"
    ON doctor_fee_config
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert access to authenticated users"
    ON doctor_fee_config
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow update access to authenticated users"
    ON doctor_fee_config
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow delete access to authenticated users"
    ON doctor_fee_config
    FOR DELETE
    TO authenticated
    USING (true);




-- Drop existing function
DROP FUNCTION IF EXISTS handle_ristourne_upsert(uuid,uuid,text,numeric,text,jsonb);

-- Function to handle ristourne creation/update with patient results
CREATE OR REPLACE FUNCTION handle_ristourne_upsert(
    p_ristourne_id uuid DEFAULT NULL,
    p_doctor_id uuid DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_total_fee numeric DEFAULT 0,
    p_status text DEFAULT 'pending',
    p_patient_results jsonb DEFAULT '[]'::jsonb -- Array of {patient_result_id, fee_amount}
) RETURNS uuid AS $$
DECLARE
    v_ristourne_id uuid;
    v_result jsonb;
BEGIN
    -- If ristourne_id is provided, update existing ristourne
    IF p_ristourne_id IS NOT NULL THEN
        -- Update ristourne
        UPDATE ristourne
        SET 
            doctor_id = p_doctor_id,
            notes = p_notes,
            total_fee = p_total_fee,
            status = p_status,
            updated_at = NOW()
        WHERE id = p_ristourne_id
        RETURNING id INTO v_ristourne_id;

        -- Set paid_status = 'unpaid' for previously linked patient_results that are no longer selected
        UPDATE patient_result
        SET paid_status = 'unpaid'
        WHERE id IN (
          SELECT patient_result_id
          FROM ristourne_patient_result
          WHERE ristourne_id = v_ristourne_id
        )
        AND id NOT IN (
          SELECT (v_result2->>'patient_result_id')::uuid
          FROM jsonb_array_elements(p_patient_results) AS v_result2
        );

        -- Delete existing ristourne_patient_result entries
        DELETE FROM ristourne_patient_result
        WHERE ristourne_id = v_ristourne_id;
    ELSE
        -- Create new ristourne
        INSERT INTO ristourne (
            doctor_id,
            created_date,
            status,
            total_fee,
            notes,
            created_at,
            updated_at
        ) VALUES (
            p_doctor_id,
            CURRENT_DATE,
            p_status,
            p_total_fee,
            p_notes,
            NOW(),
            NOW()
        ) RETURNING id INTO v_ristourne_id;
    END IF;

    -- Insert new ristourne_patient_result entries
    FOR v_result IN SELECT * FROM jsonb_array_elements(p_patient_results)
    LOOP
        INSERT INTO ristourne_patient_result (
            ristourne_id,
            patient_result_id,
            fee_amount,
            created_at,
            updated_at
        ) VALUES (
            v_ristourne_id,
            (v_result->>'patient_result_id')::uuid,
            (v_result->>'fee_amount')::numeric,
            NOW(),
            NOW()
        );

        -- Update patient_result paid_status to match ristourne status
        UPDATE patient_result
        SET paid_status = p_status
        WHERE id = (v_result->>'patient_result_id')::uuid;
    END LOOP;

    RETURN v_ristourne_id;
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



CREATE TABLE settings (
    ristourne_access_code TEXT
);



create table result_column_widths (
  id serial primary key,
  param_width int not null,
  value_width int not null,
  unit_width int not null,
  ref_width int not null,
  updated_at timestamp default now()
);






-- v2
CREATE TABLE skip_range_check (
    id SERIAL PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('category', 'test_type'))
);

-- Example inserts:
INSERT INTO skip_range_check (value, type) VALUES
('ELECTROPHORESE DE L’HEMOGLOBINE', 'category'),
('EXAMEN CYTOBACTERIOLOGIQUE DES URINES', 'category'),
('Groupe/RH', 'test_type');







-- --------------------------------------------------------------------------------
-- v3
ALTER TABLE patient_result
ADD COLUMN isFree BOOLEAN DEFAULT FALSE;

ALTER TABLE public.patient_result
ADD COLUMN IF NOT EXISTS notes text;






-- abbre-models
CREATE TABLE public.abbre_models (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Optional: Add a comment to the table for clarity
COMMENT ON TABLE public.abbre_models IS 'Stores abbreviation models, identified by a unique name and an optional description.';

-- Optional: Add comments to columns
COMMENT ON COLUMN public.abbre_models.id IS 'Unique identifier for the abbreviation model (Primary Key).';
COMMENT ON COLUMN public.abbre_models.name IS 'The unique name of the abbreviation model. This name is used as a suffix in test_type names.';
COMMENT ON COLUMN public.abbre_models.description IS 'An optional longer description of the abbreviation model.';
COMMENT ON COLUMN public.abbre_models.created_at IS 'Timestamp of when the abbreviation model was created.';

-- Optional: If you want to enable Row Level Security (RLS) on this table (common in Supabase)
-- ALTER TABLE public.abbre_models ENABLE ROW LEVEL SECURITY;

-- Example Policies (you'd need to define these based on your app's auth rules):
-- Allow public read-only access
-- CREATE POLICY "Allow public read access" ON public.abbre_models
-- FOR SELECT USING (true);

-- Allow authenticated users to insert
-- CREATE POLICY "Allow authenticated insert" ON public.abbre_models
-- FOR INSERT TO authenticated WITH CHECK (true);

-- Allow users to update their own models (if you had a user_id foreign key)
-- Or allow admin role to update
-- CREATE POLICY "Allow admin update" ON public.abbre_models
-- FOR UPDATE USING (auth.role() = 'service_role' OR (SELECT current_user_is_admin())); -- (requires a helper function current_user_is_admin)

-- Allow admin role to delete
-- CREATE POLICY "Allow admin delete" ON public.abbre_models
-- FOR DELETE USING (auth.role() = 'service_role' OR (SELECT current_user_is_admin()));






-- expense tracking
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- PRE-EXISTING TABLE (Assumed Structure for patient_result)
-- You DO NOT need to run this if your patient_result table already exists.
-- This is just for context of how the 'incomes' table will reference it.
-- -----------------------------------------------------------------------------

-- CREATE TABLE IF NOT EXISTS public.patient_result (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     patient_id UUID NOT NULL, -- Assuming this FKs to a 'patients' table
--     normal_price DECIMAL(10, 2) NOT NULL,
--     insurance_price DECIMAL(10, 2),
--     -- other existing fields ...
--     created_at TIMESTAMPTZ DEFAULT NOW(),
--     updated_at TIMESTAMPTZ DEFAULT NOW()
-- );
-- -- Example: If patient_id references a patients table
-- -- ALTER TABLE public.patient_result
-- --   ADD CONSTRAINT fk_patient FOREIGN KEY (patient_id) REFERENCES public.patients(id);

-- -- Disable RLS for patient_result if it's not already
-- -- ALTER TABLE public.patient_result DISABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- NEW TABLES
-- -----------------------------------------------------------------------------

-- Helper function to automatically update 'updated_at' timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Agents Table
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL, -- Agent code should be unique
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.agents DISABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_timestamp_agents
BEFORE UPDATE ON public.agents
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.agents IS 'Stores information about agents who record income/expenses.';
COMMENT ON COLUMN public.agents.name IS 'Full name of the agent.';
COMMENT ON COLUMN public.agents.code IS 'Unique identifying code for the agent.';

-- 2. Income/Expense Records Table (Overall Record by an Agent)
CREATE TABLE IF NOT EXISTS public.income_expense_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE RESTRICT, -- Prevent deleting an agent if they have records
    record_date DATE DEFAULT CURRENT_DATE NOT NULL, -- Date the record pertains to
    notes TEXT, -- Optional notes for the overall record
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.income_expense_records DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_income_expense_records_agent_id ON public.income_expense_records(agent_id);
CREATE INDEX idx_income_expense_records_record_date ON public.income_expense_records(record_date);

CREATE TRIGGER set_timestamp_income_expense_records
BEFORE UPDATE ON public.income_expense_records
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.income_expense_records IS 'A container for a set of incomes and expenses recorded by an agent for a specific period/event.';
COMMENT ON COLUMN public.income_expense_records.agent_id IS 'The agent who created this record.';
COMMENT ON COLUMN public.income_expense_records.record_date IS 'The date this income/expense record pertains to.';

-- 3. Incomes Table
CREATE TABLE IF NOT EXISTS public.incomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    income_expense_record_id UUID NOT NULL REFERENCES public.income_expense_records(id) ON DELETE CASCADE, -- If record is deleted, incomes associated are deleted
    patient_result_id UUID NOT NULL REFERENCES public.patient_result(id) ON DELETE RESTRICT, -- Prevent deleting patient_result if linked to an income
    -- The actual income amount will be derived from patient_result.normal_price or patient_result.insurance_price
    -- You might add a column here to specify WHICH price was used, e.g., 'price_type' (ENUM: 'normal', 'insurance')
    -- or just decide this at the application level. For simplicity, I'm omitting it.
    notes TEXT, -- Optional notes specific to this income item
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.incomes DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_incomes_record_id ON public.incomes(income_expense_record_id);
CREATE INDEX idx_incomes_patient_result_id ON public.incomes(patient_result_id);

CREATE TRIGGER set_timestamp_incomes
BEFORE UPDATE ON public.incomes
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.incomes IS 'Individual income items, linked to a patient result.';
COMMENT ON COLUMN public.incomes.income_expense_record_id IS 'The parent income/expense record this income belongs to.';
COMMENT ON COLUMN public.incomes.patient_result_id IS 'The patient result that generated this income.';

-- 4. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    income_expense_record_id UUID NOT NULL REFERENCES public.income_expense_records(id) ON DELETE CASCADE, -- If record is deleted, expenses associated are deleted
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0), -- Price of the expense
    expense_date DATE DEFAULT CURRENT_DATE NOT NULL, -- Date the expense was incurred
    notes TEXT, -- Optional notes specific to this expense item
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_expenses_record_id ON public.expenses(income_expense_record_id);

CREATE TRIGGER set_timestamp_expenses
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.expenses IS 'Individual expense items.';
COMMENT ON COLUMN public.expenses.income_expense_record_id IS 'The parent income/expense record this expense belongs to.';
COMMENT ON COLUMN public.expenses.name IS 'Description of the expense.';
COMMENT ON COLUMN public.expenses.price IS 'Cost of the expense.';
COMMENT ON COLUMN public.expenses.expense_date IS 'Date the expense was incurred.';

-- -----------------------------------------------------------------------------
-- Example Usage (Conceptual - Not part of the DDL)
-- -----------------------------------------------------------------------------

-- -- 1. Assume patient_result with id '...' exists and has normal_price = 100.00
-- -- INSERT INTO public.patient_result (id, patient_id, normal_price, insurance_price) VALUES
-- -- ('your-patient-result-id-1', 'patient-uuid-1', 100.00, 80.00),
-- -- ('your-patient-result-id-2', 'patient-uuid-2', 150.00, 120.00);

-- -- 2. Create an Agent
-- -- INSERT INTO public.agents (name, code) VALUES ('John Doe', 'AGENT001') RETURNING id;
-- -- Let's say this returns agent_id 'agent-john-doe-uuid'

-- -- 3. Agent creates an Income/Expense Record
-- -- INSERT INTO public.income_expense_records (agent_id, record_date, notes)
-- -- VALUES ('agent-john-doe-uuid', '2023-10-27', 'Daily takings and expenses for clinic A') RETURNING id;
-- -- Let's say this returns income_expense_record_id 'record-xyz-uuid'

-- -- 4. Add Incomes to that record
-- -- (The application would decide whether to use normal_price or insurance_price from patient_result)
-- -- INSERT INTO public.incomes (income_expense_record_id, patient_result_id, notes)
-- -- VALUES ('record-xyz-uuid', 'your-patient-result-id-1', 'Consultation fee');

-- -- INSERT INTO public.incomes (income_expense_record_id, patient_result_id, notes)
-- -- VALUES ('record-xyz-uuid', 'your-patient-result-id-2', 'Lab test fee');

-- -- 5. Add Expenses to that record
-- -- INSERT INTO public.expenses (income_expense_record_id, name, price, expense_date, notes)
-- -- VALUES ('record-xyz-uuid', 'Office Supplies', 25.50, '2023-10-27', 'Stationery purchase');

-- -- INSERT INTO public.expenses (income_expense_record_id, name, price, expense_date, notes)
-- -- VALUES ('record-xyz-uuid', 'Coffee for staff', 15.00, '2023-10-27', '');

-- -- To calculate net for 'record-xyz-uuid':
-- -- SELECT
-- --     SUM(pr.normal_price) AS total_income -- Or pr.insurance_price, or a COALESCE(pr.insurance_price, pr.normal_price)
-- -- FROM public.incomes i
-- -- JOIN public.patient_result pr ON i.patient_result_id = pr.id
-- -- WHERE i.income_expense_record_id = 'record-xyz-uuid';

-- -- SELECT
-- --     SUM(e.price) AS total_expense
-- -- FROM public.expenses e
-- -- WHERE e.income_expense_record_id = 'record-xyz-uuid';

-- First, DROP the existing view if it exists, to replace it
DROP VIEW IF EXISTS public.income_expense_record_summary;

-- Then, CREATE OR REPLACE the new version of the view
CREATE OR REPLACE VIEW public.income_expense_record_summary AS
SELECT
    ier.id,
    ier.agent_id,
    a.name AS agent_name,
    a.code AS agent_code,
    ier.record_date,
    ier.notes,
    ier.created_at,
    ier.updated_at,
    COALESCE(
        (SELECT SUM(
            -- Income is normal_price + insurance_price
            (COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0))
         )
         FROM public.incomes inc
         JOIN public.patient_result pr ON inc.patient_result_id = pr.id
         WHERE inc.income_expense_record_id = ier.id),
        0
    ) AS total_income,
    COALESCE(
        (SELECT SUM(exp.price)
         FROM public.expenses exp
         WHERE exp.income_expense_record_id = ier.id),
        0
    ) AS total_expense,
    -- Calculate Net Income (Remaining Income)
    (
        COALESCE(
            (SELECT SUM( (COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0)) )
             FROM public.incomes inc
             JOIN public.patient_result pr ON inc.patient_result_id = pr.id
             WHERE inc.income_expense_record_id = ier.id),
            0
        )
        -
        COALESCE(
            (SELECT SUM(exp.price)
             FROM public.expenses exp
             WHERE exp.income_expense_record_id = ier.id),
            0
        )
    ) AS net_income -- Or remaining_income
FROM
    public.income_expense_records ier
JOIN
    public.agents a ON ier.agent_id = a.id;

-- Ensure the role querying the view has SELECT permission
GRANT SELECT ON public.income_expense_record_summary TO authenticated;
-- (And on underlying tables, though if RLS is disabled on them, this might already be covered)

-- Set the owner (optional, but good practice)
ALTER VIEW public.income_expense_record_summary OWNER TO postgres;


-- 1. Make patient_result_id nullable
ALTER TABLE public.incomes
  ALTER COLUMN patient_result_id DROP NOT NULL;

-- 2. Add columns for manual income details
ALTER TABLE public.incomes
  ADD COLUMN IF NOT EXISTS manual_income_name TEXT,
  ADD COLUMN IF NOT EXISTS manual_income_amount DECIMAL(10, 2);

-- (Optional: Add a check constraint to ensure one type of income is provided)
-- ALTER TABLE public.incomes
--   ADD CONSTRAINT chk_income_source CHECK (
--     (patient_result_id IS NOT NULL AND manual_income_name IS NULL AND manual_income_amount IS NULL) OR
--     (patient_result_id IS NULL AND manual_income_name IS NOT NULL AND manual_income_amount IS NOT NULL)
--   );
-- Be careful with existing data if you add this check constraint immediately.

-- 3. Update the Supabase View 'income_expense_record_summary'
DROP VIEW IF EXISTS public.income_expense_record_summary; -- Drop if exists

CREATE OR REPLACE VIEW public.income_expense_record_summary AS
SELECT
    ier.id,
    ier.agent_id,
    a.name AS agent_name,
    a.code AS agent_code,
    ier.record_date,
    ier.notes,
    ier.created_at,
    ier.updated_at,
    -- Updated total_income calculation
    COALESCE(
        (SELECT SUM(
            CASE
                WHEN inc.patient_result_id IS NOT NULL THEN (COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0))
                ELSE COALESCE(inc.manual_income_amount, 0)
            END
         )
         FROM public.incomes inc
         LEFT JOIN public.patient_result pr ON inc.patient_result_id = pr.id -- Use LEFT JOIN now
         WHERE inc.income_expense_record_id = ier.id),
        0
    ) AS total_income,
    COALESCE(
        (SELECT SUM(exp.price)
         FROM public.expenses exp
         WHERE exp.income_expense_record_id = ier.id),
        0
    ) AS total_expense,
    -- Updated net_income calculation
    (
        COALESCE(
            (SELECT SUM(
                CASE
                    WHEN inc.patient_result_id IS NOT NULL THEN (COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0))
                    ELSE COALESCE(inc.manual_income_amount, 0)
                END
             )
             FROM public.incomes inc
             LEFT JOIN public.patient_result pr ON inc.patient_result_id = pr.id
             WHERE inc.income_expense_record_id = ier.id),
            0
        )
        -
        COALESCE(
            (SELECT SUM(exp.price)
             FROM public.expenses exp
             WHERE exp.income_expense_record_id = ier.id),
            0
        )
    ) AS net_income
FROM
    public.income_expense_records ier
JOIN
    public.agents a ON ier.agent_id = a.id;

GRANT SELECT ON public.income_expense_record_summary TO authenticated;
ALTER VIEW public.income_expense_record_summary OWNER TO postgres;



ALTER TABLE public.incomes
ADD CONSTRAINT chk_income_type
CHECK (
    (patient_result_id IS NOT NULL AND manual_income_name IS NULL AND manual_income_amount IS NULL)
    OR
    (patient_result_id IS NULL AND manual_income_name IS NOT NULL AND manual_income_amount IS NOT NULL)
);







-- unpaid column add

ALTER TABLE public.patient_result 
ADD COLUMN unpaid_amount decimal(10,2) NULL;





-- ===============================================stats
-- ====================================================================
-- STEP 1: Drop all existing helper and insight functions (if they exist)
-- This ensures a clean slate if signatures changed.
-- ====================================================================

DROP FUNCTION IF EXISTS public.get_daily_insights(date);
DROP FUNCTION IF EXISTS public.get_monthly_insights(integer, integer);
DROP FUNCTION IF EXISTS public.get_yearly_insights(integer);

-- Drop helper functions as well, in case their return types or definitions need updating
DROP FUNCTION IF EXISTS public.get_day_bounds(date);
DROP FUNCTION IF EXISTS public.get_month_bounds(integer, integer);
DROP FUNCTION IF EXISTS public.get_year_bounds(integer);

-- ====================================================================
-- STEP 2: Recreate Helper Functions
-- ====================================================================

-- Helper to get start and end of a day
CREATE OR REPLACE FUNCTION get_day_bounds(target_date DATE)
RETURNS TABLE(start_time timestamptz, end_time timestamptz) AS $$
BEGIN
    RETURN QUERY SELECT
        target_date::timestamptz,
        (target_date + INTERVAL '1 day' - INTERVAL '1 microsecond')::timestamptz;
END;
$$ LANGUAGE plpgsql;

-- Helper to get start and end of a month
CREATE OR REPLACE FUNCTION get_month_bounds(year_num INT, month_num INT)
RETURNS TABLE(start_time timestamptz, end_time timestamptz) AS $$
DECLARE
    first_day_of_month DATE;
BEGIN
    first_day_of_month := MAKE_DATE(year_num, month_num, 1);
    RETURN QUERY SELECT
        first_day_of_month::timestamptz,
        (DATE_TRUNC('month', first_day_of_month) + INTERVAL '1 month' - INTERVAL '1 microsecond')::timestamptz;
END;
$$ LANGUAGE plpgsql;

-- Helper to get start and end of a year
CREATE OR REPLACE FUNCTION get_year_bounds(year_num INT)
RETURNS TABLE(start_time timestamptz, end_time timestamptz) AS $$
DECLARE
    first_day_of_year DATE;
BEGIN
    first_day_of_year := MAKE_DATE(year_num, 1, 1);
    RETURN QUERY SELECT
        first_day_of_year::timestamptz,
        (DATE_TRUNC('year', first_day_of_year) + INTERVAL '1 year' - INTERVAL '1 microsecond')::timestamptz;
END;
$$ LANGUAGE plpgsql;


-- Function for Daily Stats
CREATE OR REPLACE FUNCTION get_daily_insights(target_date DATE)
RETURNS TABLE (
    bilan_count BIGINT,
    total_revenue NUMERIC,
    total_normal_price NUMERIC,
    total_insurance_price NUMERIC
)
AS $$
DECLARE
    v_start_time timestamptz;
    v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_day_bounds(target_date);

    RETURN QUERY
    SELECT
        COUNT(pr.id) AS bilan_count,
        COALESCE(SUM(COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0)), 0) AS total_revenue,
        COALESCE(SUM(pr.normal_price), 0) AS total_normal_price,
        COALESCE(SUM(pr.insurance_price), 0) AS total_insurance_price
    FROM public.patient_result pr
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time;
END;
$$ LANGUAGE plpgsql;

-- Function for Monthly Stats
CREATE OR REPLACE FUNCTION get_monthly_insights(year_num INT, month_num INT)
RETURNS TABLE (
    bilan_count BIGINT,
    total_revenue NUMERIC,
    total_normal_price NUMERIC,
    total_insurance_price NUMERIC
)
AS $$
DECLARE
    v_start_time timestamptz;
    v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_month_bounds(year_num, month_num);

    RETURN QUERY
    SELECT
        COUNT(pr.id) AS bilan_count,
        COALESCE(SUM(COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0)), 0) AS total_revenue,
        COALESCE(SUM(pr.normal_price), 0) AS total_normal_price,
        COALESCE(SUM(pr.insurance_price), 0) AS total_insurance_price
    FROM public.patient_result pr
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time;
END;
$$ LANGUAGE plpgsql;

-- Function for Yearly Stats
CREATE OR REPLACE FUNCTION get_yearly_insights(year_num INT)
RETURNS TABLE (
    bilan_count BIGINT,
    total_revenue NUMERIC,
    total_normal_price NUMERIC,
    total_insurance_price NUMERIC
)
AS $$
DECLARE
    v_start_time timestamptz;
    v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_year_bounds(year_num);

    RETURN QUERY
    SELECT
        COUNT(pr.id) AS bilan_count,
        COALESCE(SUM(COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0)), 0) AS total_revenue,
        COALESCE(SUM(pr.normal_price), 0) AS total_normal_price,
        COALESCE(SUM(pr.insurance_price), 0) AS total_insurance_price
    FROM public.patient_result pr
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time;
END;
$$ LANGUAGE plpgsql;




-- Function for Daily Unpaid Total
CREATE OR REPLACE FUNCTION get_daily_unpaid_total(target_date DATE)
RETURNS TABLE (
    total_unpaid_amount NUMERIC
)
AS $$
DECLARE
    v_start_time timestamptz;
    v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_day_bounds(target_date);

    RETURN QUERY
    SELECT
        COALESCE(SUM(pr.unpaid_amount), 0) AS total_unpaid_amount
    FROM public.patient_result pr
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time
      AND pr.unpaid_amount > 0; -- Only sum actual unpaid amounts
END;
$$ LANGUAGE plpgsql;

-- Function for Monthly Unpaid Total
CREATE OR REPLACE FUNCTION get_monthly_unpaid_total(year_num INT, month_num INT)
RETURNS TABLE (
    total_unpaid_amount NUMERIC
)
AS $$
DECLARE
    v_start_time timestamptz;
    v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_month_bounds(year_num, month_num);

    RETURN QUERY
    SELECT
        COALESCE(SUM(pr.unpaid_amount), 0) AS total_unpaid_amount
    FROM public.patient_result pr
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time
      AND pr.unpaid_amount > 0;
END;
$$ LANGUAGE plpgsql;

-- Function for Yearly Unpaid Total
CREATE OR REPLACE FUNCTION get_yearly_unpaid_total(year_num INT)
RETURNS TABLE (
    total_unpaid_amount NUMERIC
)
AS $$
DECLARE
    v_start_time timestamptz;
    v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_year_bounds(year_num);

    RETURN QUERY
    SELECT
        COALESCE(SUM(pr.unpaid_amount), 0) AS total_unpaid_amount
    FROM public.patient_result pr
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time
      AND pr.unpaid_amount > 0;
END;
$$ LANGUAGE plpgsql;



-- ================================================================================================
-- PATIENTS REGISTERED (NEWLY CREATED IN PERIOD)
-- ================================================================================================
CREATE OR REPLACE FUNCTION get_daily_new_patients_count(target_date DATE)
RETURNS TABLE (new_patient_count BIGINT) AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_day_bounds(target_date);
    RETURN QUERY SELECT COUNT(id) FROM public.patient WHERE created_at >= v_start_time AND created_at <= v_end_time;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_monthly_new_patients_count(year_num INT, month_num INT)
RETURNS TABLE (new_patient_count BIGINT) AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_month_bounds(year_num, month_num);
    RETURN QUERY SELECT COUNT(id) FROM public.patient WHERE created_at >= v_start_time AND created_at <= v_end_time;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_yearly_new_patients_count(year_num INT)
RETURNS TABLE (new_patient_count BIGINT) AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_year_bounds(year_num);
    RETURN QUERY SELECT COUNT(id) FROM public.patient WHERE created_at >= v_start_time AND created_at <= v_end_time;
END; $$ LANGUAGE plpgsql;

-- ================================================================================================
-- BILANS PER DOCTOR (TOP N)
-- ================================================================================================
-- We'll need a custom type for the return
CREATE TYPE doctor_bilan_stat AS (
    doctor_id UUID,
    doctor_full_name TEXT,
    bilan_count BIGINT
);

CREATE OR REPLACE FUNCTION get_daily_bilans_per_doctor(target_date DATE, top_n INT DEFAULT 5)
RETURNS SETOF doctor_bilan_stat AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_day_bounds(target_date);
    RETURN QUERY
    SELECT pr.doctor_id, d.full_name AS doctor_full_name, COUNT(pr.id) AS bilan_count
    FROM public.patient_result pr
    JOIN public.doctor d ON pr.doctor_id = d.id
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time
    GROUP BY pr.doctor_id, d.full_name
    ORDER BY bilan_count DESC
    LIMIT top_n;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_monthly_bilans_per_doctor(year_num INT, month_num INT, top_n INT DEFAULT 5)
RETURNS SETOF doctor_bilan_stat AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_month_bounds(year_num, month_num);
     RETURN QUERY
    SELECT pr.doctor_id, d.full_name AS doctor_full_name, COUNT(pr.id) AS bilan_count
    FROM public.patient_result pr
    JOIN public.doctor d ON pr.doctor_id = d.id
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time
    GROUP BY pr.doctor_id, d.full_name
    ORDER BY bilan_count DESC
    LIMIT top_n;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_yearly_bilans_per_doctor(year_num INT, top_n INT DEFAULT 5)
RETURNS SETOF doctor_bilan_stat AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_year_bounds(year_num);
     RETURN QUERY
    SELECT pr.doctor_id, d.full_name AS doctor_full_name, COUNT(pr.id) AS bilan_count
    FROM public.patient_result pr
    JOIN public.doctor d ON pr.doctor_id = d.id
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time
    GROUP BY pr.doctor_id, d.full_name
    ORDER BY bilan_count DESC
    LIMIT top_n;
END; $$ LANGUAGE plpgsql;

-- ================================================================================================
-- MOST COMMON TEST TYPES (TOP N)
-- This one is a bit more complex as it involves patient_result -> result_value -> test_parameter -> test_type
-- ================================================================================================
CREATE TYPE test_type_stat AS (
    test_type_id UUID,
    test_type_name TEXT,
    usage_count BIGINT
);

CREATE OR REPLACE FUNCTION get_daily_common_test_types(target_date DATE, top_n INT DEFAULT 5)
RETURNS SETOF test_type_stat AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_day_bounds(target_date);
    RETURN QUERY
    SELECT tt.id AS test_type_id, tt.name AS test_type_name, COUNT(DISTINCT pr.id) AS usage_count
    FROM public.patient_result pr
    JOIN public.result_value rv ON pr.id = rv.patient_result_id
    JOIN public.test_parameter tp ON rv.test_parameter_id = tp.id
    JOIN public.test_type tt ON tp.test_type_id = tt.id
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time
    GROUP BY tt.id, tt.name
    ORDER BY usage_count DESC
    LIMIT top_n;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_monthly_common_test_types(year_num INT, month_num INT, top_n INT DEFAULT 5)
RETURNS SETOF test_type_stat AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_month_bounds(year_num, month_num);
    RETURN QUERY
    SELECT tt.id AS test_type_id, tt.name AS test_type_name, COUNT(DISTINCT pr.id) AS usage_count
    FROM public.patient_result pr
    JOIN public.result_value rv ON pr.id = rv.patient_result_id
    JOIN public.test_parameter tp ON rv.test_parameter_id = tp.id
    JOIN public.test_type tt ON tp.test_type_id = tt.id
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time
    GROUP BY tt.id, tt.name
    ORDER BY usage_count DESC
    LIMIT top_n;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_yearly_common_test_types(year_num INT, top_n INT DEFAULT 5)
RETURNS SETOF test_type_stat AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_year_bounds(year_num);
     RETURN QUERY
    SELECT tt.id AS test_type_id, tt.name AS test_type_name, COUNT(DISTINCT pr.id) AS usage_count
    FROM public.patient_result pr
    JOIN public.result_value rv ON pr.id = rv.patient_result_id
    JOIN public.test_parameter tp ON rv.test_parameter_id = tp.id
    JOIN public.test_type tt ON tp.test_type_id = tt.id
    WHERE pr.created_at >= v_start_time AND pr.created_at <= v_end_time
    GROUP BY tt.id, tt.name
    ORDER BY usage_count DESC
    LIMIT top_n;
END; $$ LANGUAGE plpgsql;


-- ================================================================================================
-- RISTOURNE (REFERRAL FEES) GENERATED
-- This assumes ristourne.total_fee is the value for a *processed* ristourne.
-- We'll sum total_fee of ristournes created in the period.
-- ================================================================================================
CREATE OR REPLACE FUNCTION get_daily_ristourne_generated(target_date DATE)
RETURNS TABLE (total_ristourne_fee NUMERIC) AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_day_bounds(target_date);
    RETURN QUERY SELECT COALESCE(SUM(total_fee), 0) FROM public.ristourne
    WHERE created_at >= v_start_time AND created_at <= v_end_time;
    -- AND status = 'paid' -- Optional: if you only want to count paid ristournes
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_monthly_ristourne_generated(year_num INT, month_num INT)
RETURNS TABLE (total_ristourne_fee NUMERIC) AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_month_bounds(year_num, month_num);
    RETURN QUERY SELECT COALESCE(SUM(total_fee), 0) FROM public.ristourne
    WHERE created_at >= v_start_time AND created_at <= v_end_time;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_yearly_ristourne_generated(year_num INT)
RETURNS TABLE (total_ristourne_fee NUMERIC) AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_year_bounds(year_num);
    RETURN QUERY SELECT COALESCE(SUM(total_fee), 0) FROM public.ristourne
    WHERE created_at >= v_start_time AND created_at <= v_end_time;
END; $$ LANGUAGE plpgsql;



-- ================================================================================================
-- INCOME VS. EXPENSES (Based on income_expense_records.record_date)
-- ================================================================================================
-- We need a return type for this
CREATE TYPE income_expense_summary_stat AS (
    total_period_income NUMERIC,
    total_period_expenses NUMERIC,
    net_period_profit NUMERIC
);

-- Function for Daily Income/Expense Summary
CREATE OR REPLACE FUNCTION get_daily_income_expense_summary(target_date DATE)
RETURNS SETOF income_expense_summary_stat AS $$
DECLARE
    v_start_date DATE := target_date;
    v_end_date DATE := target_date; -- For daily, start and end are the same for record_date
BEGIN
    RETURN QUERY
    WITH period_records AS (
        SELECT id FROM public.income_expense_records
        WHERE record_date >= v_start_date AND record_date <= v_end_date
    ),
    period_incomes AS (
        SELECT
            COALESCE(SUM(
                CASE
                    WHEN i.patient_result_id IS NOT NULL THEN COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0)
                    ELSE COALESCE(i.manual_income_amount, 0)
                END
            ), 0) AS total_income
        FROM public.incomes i
        LEFT JOIN public.patient_result pr ON i.patient_result_id = pr.id
        WHERE i.income_expense_record_id IN (SELECT id FROM period_records)
    ),
    period_expenses AS (
        SELECT
            COALESCE(SUM(e.price), 0) AS total_expenses
        FROM public.expenses e
        WHERE e.income_expense_record_id IN (SELECT id FROM period_records)
    )
    SELECT
        pi.total_income AS total_period_income,
        pe.total_expenses AS total_period_expenses,
        (pi.total_income - pe.total_expenses) AS net_period_profit
    FROM period_incomes pi, period_expenses pe;
END;
$$ LANGUAGE plpgsql;

-- Function for Monthly Income/Expense Summary
CREATE OR REPLACE FUNCTION get_monthly_income_expense_summary(year_num INT, month_num INT)
RETURNS SETOF income_expense_summary_stat AS $$
DECLARE
    v_start_date DATE := MAKE_DATE(year_num, month_num, 1);
    v_end_date DATE := (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
BEGIN
    RETURN QUERY
    WITH period_records AS (
        SELECT id FROM public.income_expense_records
        WHERE record_date >= v_start_date AND record_date <= v_end_date
    ),
    period_incomes AS (
        SELECT
            COALESCE(SUM(
                CASE
                    WHEN i.patient_result_id IS NOT NULL THEN COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0)
                    ELSE COALESCE(i.manual_income_amount, 0)
                END
            ), 0) AS total_income
        FROM public.incomes i
        LEFT JOIN public.patient_result pr ON i.patient_result_id = pr.id
        WHERE i.income_expense_record_id IN (SELECT id FROM period_records)
    ),
    period_expenses AS (
        SELECT
            COALESCE(SUM(e.price), 0) AS total_expenses
        FROM public.expenses e
        WHERE e.income_expense_record_id IN (SELECT id FROM period_records)
    )
    SELECT
        pi.total_income AS total_period_income,
        pe.total_expenses AS total_period_expenses,
        (pi.total_income - pe.total_expenses) AS net_period_profit
    FROM period_incomes pi, period_expenses pe;
END;
$$ LANGUAGE plpgsql;

-- Function for Yearly Income/Expense Summary
CREATE OR REPLACE FUNCTION get_yearly_income_expense_summary(year_num INT)
RETURNS SETOF income_expense_summary_stat AS $$
DECLARE
    v_start_date DATE := MAKE_DATE(year_num, 1, 1);
    v_end_date DATE := MAKE_DATE(year_num, 12, 31);
BEGIN
    RETURN QUERY
    WITH period_records AS (
        SELECT id FROM public.income_expense_records
        WHERE record_date >= v_start_date AND record_date <= v_end_date
    ),
    period_incomes AS (
        SELECT
            COALESCE(SUM(
                CASE
                    WHEN i.patient_result_id IS NOT NULL THEN COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0)
                    ELSE COALESCE(i.manual_income_amount, 0)
                END
            ), 0) AS total_income
        FROM public.incomes i
        LEFT JOIN public.patient_result pr ON i.patient_result_id = pr.id
        WHERE i.income_expense_record_id IN (SELECT id FROM period_records)
    ),
    period_expenses AS (
        SELECT
            COALESCE(SUM(e.price), 0) AS total_expenses
        FROM public.expenses e
        WHERE e.income_expense_record_id IN (SELECT id FROM period_records)
    )
    SELECT
        pi.total_income AS total_period_income,
        pe.total_expenses AS total_period_expenses,
        (pi.total_income - pe.total_expenses) AS net_period_profit
    FROM period_incomes pi, period_expenses pe;
END;
$$ LANGUAGE plpgsql;











-- ===============================================================================================
-- antibiotique
-- --------------------------------------------------
-- Table: antibiotique_model
-- (As defined in the previous message - includes 'antibiotiques' JSONB with default s, i, r states)
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.antibiotique_model (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    description text NULL,
    antibiotiques jsonb DEFAULT '[]'::jsonb NOT NULL, -- [{"id":"u1","name":"DrugA","order":0,"s":true,"i":false,"r":false}, ...]
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
-- ... (triggers and RLS as before) ...
DROP TRIGGER IF EXISTS set_timestamp_antibiotique_model ON public.antibiotique_model;
CREATE TRIGGER set_timestamp_antibiotique_model
BEFORE UPDATE ON public.antibiotique_model
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
ALTER TABLE public.antibiotique_model ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.antibiotique_model;
CREATE POLICY "Allow all access for authenticated users" ON public.antibiotique_model
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');


-- --------------------------------------------------
-- Table: patient_antibiogram_set
-- Each row represents results from ONE antibiotique_model applied to ONE patient_result.
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_antibiogram_set (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_result_id uuid NOT NULL REFERENCES public.patient_result(id) ON DELETE CASCADE,
    source_antibiotique_model_id uuid NOT NULL REFERENCES public.antibiotique_model(id) ON DELETE RESTRICT,
    -- results_json will store:
    -- [{"id":"u1","name":"DrugA","order":0,"s":true,"i":false,"r":false}, {"id":"u2","name":"DrugB","order":1,"s":false,"i":false,"r":true}, ...]
    -- where s, i, r are the PATIENT'S ACTUAL results for that drug from that model set.
    results_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text NULL, -- Overall notes for this specific set of antibiogram results
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    -- This UNIQUE constraint ensures a patient_result can only have results from a specific model applied ONCE.
    -- If you re-apply the same model, you'd update the existing record.
    UNIQUE (patient_result_id, source_antibiotique_model_id)
);
-- ... (comments, indexes, triggers, RLS as before) ...
COMMENT ON TABLE public.patient_antibiogram_set IS 'Stores a complete set of antibiotic S/I/R results for a patient_result FOR A SPECIFIC MODEL, as a JSONB array, templated from an antibiotique_model.';
DROP INDEX IF EXISTS idx_patient_antibiogram_set_pr_id;
DROP INDEX IF EXISTS idx_patient_antibiogram_set_model_id;
CREATE INDEX idx_patient_antibiogram_set_pr_id ON public.patient_antibiogram_set(patient_result_id);
CREATE INDEX idx_patient_antibiogram_set_model_id ON public.patient_antibiogram_set(source_antibiotique_model_id);
DROP TRIGGER IF EXISTS set_timestamp_patient_antibiogram_set ON public.patient_antibiogram_set;
CREATE TRIGGER set_timestamp_patient_antibiogram_set
BEFORE UPDATE ON public.patient_antibiogram_set
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
ALTER TABLE public.patient_antibiogram_set ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.patient_antibiogram_set;
CREATE POLICY "Allow all access for authenticated users" ON public.patient_antibiogram_set
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');


-- The patient_result.selected_antibiotique_model_id column becomes less important
-- if you always manage selections through patient_antibiogram_set.
-- You might keep it as a "primary" or "first selected" model for quick display,
-- or remove it if the UI will always present a list of applied models.
-- For now, I'll leave it as it doesn't hurt, but its role diminishes.
ALTER TABLE public.patient_result
ADD COLUMN IF NOT EXISTS selected_antibiotique_model_id uuid NULL REFERENCES public.antibiotique_model(id) ON DELETE SET NULL;


-- First, DROP the existing view if it exists, to replace it
DROP VIEW IF EXISTS public.income_expense_record_summary;

-- Then, CREATE OR REPLACE the new version of the view
CREATE OR REPLACE VIEW public.income_expense_record_summary AS
SELECT
    ier.id,
    ier.agent_id,
    a.name AS agent_name,
    a.code AS agent_code,
    ier.record_date,
    ier.notes,
    ier.created_at,
    ier.updated_at,
    COALESCE(
        (SELECT SUM(
            -- Income is normal_price + insurance_price
            (COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0)) - coalesce(pr.unpaid_amount)
         )
         FROM public.incomes inc
         JOIN public.patient_result pr ON inc.patient_result_id = pr.id
         WHERE inc.income_expense_record_id = ier.id),
        0
    ) AS total_income,
    COALESCE(
        (SELECT SUM(exp.price)
         FROM public.expenses exp
         WHERE exp.income_expense_record_id = ier.id),
        0
    ) AS total_expense,
    -- Calculate Net Income (Remaining Income)
    (
        COALESCE(
            (SELECT SUM( (COALESCE(pr.normal_price, 0) + COALESCE(pr.insurance_price, 0)) - coalesce(pr.unpaid_amount) )
             FROM public.incomes inc
             JOIN public.patient_result pr ON inc.patient_result_id = pr.id
             WHERE inc.income_expense_record_id = ier.id),
            0
        )
        -
        COALESCE(
            (SELECT SUM(exp.price)
             FROM public.expenses exp
             WHERE exp.income_expense_record_id = ier.id),
            0
        )
    ) AS net_income -- Or remaining_income
FROM
    public.income_expense_records ier
JOIN
    public.agents a ON ier.agent_id = a.id;

-- Ensure the role querying the view has SELECT permission
GRANT SELECT ON public.income_expense_record_summary TO authenticated;
-- (And on underlying tables, though if RLS is disabled on them, this might already be covered)

-- Set the owner (optional, but good practice)
ALTER VIEW public.income_expense_record_summary OWNER TO postgres;


ALTER TABLE public.patient_antibiogram_set
ADD COLUMN IF NOT EXISTS description text NULL;

COMMENT ON COLUMN public.patient_antibiogram_set.description IS 'Instance-specific description for this antibiogram set, initially copied from the source model but can be overridden.';



-- hemoculture
-- --------------------------------------------------
-- Table: hemoculture_observation_model
-- Description: Defines a named template for Hémoculture observation/culture fields.
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hemoculture_observation_model (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    description text NULL,
    -- JSONB array defining fields: [{"id":"uuid","label":"Aspect du Bouillon","type":"textarea","order":0, "defaultValue":""}, ...]
    fields_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.hemoculture_observation_model IS 'Templates for Hémoculture observation/culture structured text fields.';
COMMENT ON COLUMN public.hemoculture_observation_model.fields_json IS 'Defines the fields: [{"id":"uuid", "label":"Field Name", "type":"textarea", "order":0, "defaultValue":""}, ...]';

-- Trigger & RLS
DROP TRIGGER IF EXISTS set_timestamp_hemoculture_observation_model ON public.hemoculture_observation_model;
CREATE TRIGGER set_timestamp_hemoculture_observation_model
BEFORE UPDATE ON public.hemoculture_observation_model
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

ALTER TABLE public.hemoculture_observation_model ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.hemoculture_observation_model;
CREATE POLICY "Allow all access for authenticated users" ON public.hemoculture_observation_model
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');


-- --------------------------------------------------
-- Table: patient_hemoculture_observation
-- Description: Stores the actual observation/culture text values for a patient_result,
--              based on a selected hemoculture_observation_model.
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_hemoculture_observation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- This is the ID of this specific observation set
    patient_result_id uuid NOT NULL REFERENCES public.patient_result(id) ON DELETE CASCADE,
    source_model_id uuid NOT NULL REFERENCES public.hemoculture_observation_model(id) ON DELETE RESTRICT,
    -- JSONB array storing values: [{"field_id":"uuid_from_model","label":"Aspect...","value":"Trouble","order":0}, ...]
    results_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    overall_notes text NULL, -- General notes for this observation set
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (patient_result_id) -- Typically, one set of Hémoculture observations per patient_result. Adjust if multiple are possible.
);

COMMENT ON TABLE public.patient_hemoculture_observation IS 'Stores structured text results for Hémoculture observation/culture part.';
COMMENT ON COLUMN public.patient_hemoculture_observation.source_model_id IS 'The hemoculture_observation_model used as a template.';
COMMENT ON COLUMN public.patient_hemoculture_observation.results_json IS 'Actual values for the fields defined in the source model.';

-- Indexes
DROP INDEX IF EXISTS idx_patient_hemoculture_observation_pr_id;
DROP INDEX IF EXISTS idx_patient_hemoculture_observation_model_id;
CREATE INDEX idx_patient_hemoculture_observation_pr_id ON public.patient_hemoculture_observation(patient_result_id);
CREATE INDEX idx_patient_hemoculture_observation_model_id ON public.patient_hemoculture_observation(source_model_id);

-- Trigger & RLS
DROP TRIGGER IF EXISTS set_timestamp_patient_hemoculture_observation ON public.patient_hemoculture_observation;
CREATE TRIGGER set_timestamp_patient_hemoculture_observation
BEFORE UPDATE ON public.patient_hemoculture_observation
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

ALTER TABLE public.patient_hemoculture_observation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.patient_hemoculture_observation;
CREATE POLICY "Allow all access for authenticated users" ON public.patient_hemoculture_observation
FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');