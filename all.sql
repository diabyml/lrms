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