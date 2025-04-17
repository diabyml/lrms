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