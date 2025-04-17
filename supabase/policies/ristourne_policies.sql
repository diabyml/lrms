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
