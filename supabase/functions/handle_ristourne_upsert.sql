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
