

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."doctor_bilan_stat" AS (
	"doctor_id" "uuid",
	"doctor_full_name" "text",
	"bilan_count" bigint
);


ALTER TYPE "public"."doctor_bilan_stat" OWNER TO "postgres";


CREATE TYPE "public"."income_expense_summary_stat" AS (
	"total_period_income" numeric,
	"total_period_expenses" numeric,
	"net_period_profit" numeric
);


ALTER TYPE "public"."income_expense_summary_stat" OWNER TO "postgres";


CREATE TYPE "public"."test_type_stat" AS (
	"test_type_id" "uuid",
	"test_type_name" "text",
	"usage_count" bigint
);


ALTER TYPE "public"."test_type_stat" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_bilans_per_doctor"("target_date" "date", "top_n" integer DEFAULT 5) RETURNS SETOF "public"."doctor_bilan_stat"
    LANGUAGE "plpgsql"
    AS $$
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
END; $$;


ALTER FUNCTION "public"."get_daily_bilans_per_doctor"("target_date" "date", "top_n" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_common_test_types"("target_date" "date", "top_n" integer DEFAULT 5) RETURNS SETOF "public"."test_type_stat"
    LANGUAGE "plpgsql"
    AS $$
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
END; $$;


ALTER FUNCTION "public"."get_daily_common_test_types"("target_date" "date", "top_n" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_income_expense_summary"("target_date" "date") RETURNS SETOF "public"."income_expense_summary_stat"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_daily_income_expense_summary"("target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_insights"("target_date" "date") RETURNS TABLE("bilan_count" bigint, "total_revenue" numeric, "total_normal_price" numeric, "total_insurance_price" numeric)
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."get_daily_insights"("target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_new_patients_count"("target_date" "date") RETURNS TABLE("new_patient_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_day_bounds(target_date);
    RETURN QUERY SELECT COUNT(id) FROM public.patient WHERE created_at >= v_start_time AND created_at <= v_end_time;
END; $$;


ALTER FUNCTION "public"."get_daily_new_patients_count"("target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_ristourne_generated"("target_date" "date") RETURNS TABLE("total_ristourne_fee" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_day_bounds(target_date);
    RETURN QUERY SELECT COALESCE(SUM(total_fee), 0) FROM public.ristourne
    WHERE created_at >= v_start_time AND created_at <= v_end_time;
    -- AND status = 'paid' -- Optional: if you only want to count paid ristournes
END; $$;


ALTER FUNCTION "public"."get_daily_ristourne_generated"("target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_unpaid_insights"("target_date" "date") RETURNS TABLE("total_unpaid_amount" numeric)
    LANGUAGE "plpgsql"
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
      AND pr.unpaid_amount > 0; -- Only consider rows with an unpaid amount
END;
$$;


ALTER FUNCTION "public"."get_daily_unpaid_insights"("target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_unpaid_total"("target_date" "date") RETURNS TABLE("total_unpaid_amount" numeric)
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."get_daily_unpaid_total"("target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_day_bounds"("target_date" "date") RETURNS TABLE("start_time" timestamp with time zone, "end_time" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY SELECT
        target_date::timestamptz,
        (target_date + INTERVAL '1 day' - INTERVAL '1 microsecond')::timestamptz;
END;
$$;


ALTER FUNCTION "public"."get_day_bounds"("target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_month_bounds"("year_num" integer, "month_num" integer) RETURNS TABLE("start_time" timestamp with time zone, "end_time" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    first_day_of_month DATE;
BEGIN
    first_day_of_month := MAKE_DATE(year_num, month_num, 1);
    RETURN QUERY SELECT
        first_day_of_month::timestamptz,
        (DATE_TRUNC('month', first_day_of_month) + INTERVAL '1 month' - INTERVAL '1 microsecond')::timestamptz;
END;
$$;


ALTER FUNCTION "public"."get_month_bounds"("year_num" integer, "month_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_bilans_per_doctor"("year_num" integer, "month_num" integer, "top_n" integer DEFAULT 5) RETURNS SETOF "public"."doctor_bilan_stat"
    LANGUAGE "plpgsql"
    AS $$
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
END; $$;


ALTER FUNCTION "public"."get_monthly_bilans_per_doctor"("year_num" integer, "month_num" integer, "top_n" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_common_test_types"("year_num" integer, "month_num" integer, "top_n" integer DEFAULT 5) RETURNS SETOF "public"."test_type_stat"
    LANGUAGE "plpgsql"
    AS $$
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
END; $$;


ALTER FUNCTION "public"."get_monthly_common_test_types"("year_num" integer, "month_num" integer, "top_n" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_income_expense_summary"("year_num" integer, "month_num" integer) RETURNS SETOF "public"."income_expense_summary_stat"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_monthly_income_expense_summary"("year_num" integer, "month_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_insights"("year_num" integer, "month_num" integer) RETURNS TABLE("bilan_count" bigint, "total_revenue" numeric, "total_normal_price" numeric, "total_insurance_price" numeric)
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."get_monthly_insights"("year_num" integer, "month_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_new_patients_count"("year_num" integer, "month_num" integer) RETURNS TABLE("new_patient_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_month_bounds(year_num, month_num);
    RETURN QUERY SELECT COUNT(id) FROM public.patient WHERE created_at >= v_start_time AND created_at <= v_end_time;
END; $$;


ALTER FUNCTION "public"."get_monthly_new_patients_count"("year_num" integer, "month_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_ristourne_generated"("year_num" integer, "month_num" integer) RETURNS TABLE("total_ristourne_fee" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_month_bounds(year_num, month_num);
    RETURN QUERY SELECT COALESCE(SUM(total_fee), 0) FROM public.ristourne
    WHERE created_at >= v_start_time AND created_at <= v_end_time;
END; $$;


ALTER FUNCTION "public"."get_monthly_ristourne_generated"("year_num" integer, "month_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_unpaid_insights"("year_num" integer, "month_num" integer) RETURNS TABLE("total_unpaid_amount" numeric)
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."get_monthly_unpaid_insights"("year_num" integer, "month_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_unpaid_total"("year_num" integer, "month_num" integer) RETURNS TABLE("total_unpaid_amount" numeric)
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."get_monthly_unpaid_total"("year_num" integer, "month_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_year_bounds"("year_num" integer) RETURNS TABLE("start_time" timestamp with time zone, "end_time" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    first_day_of_year DATE;
BEGIN
    first_day_of_year := MAKE_DATE(year_num, 1, 1);
    RETURN QUERY SELECT
        first_day_of_year::timestamptz,
        (DATE_TRUNC('year', first_day_of_year) + INTERVAL '1 year' - INTERVAL '1 microsecond')::timestamptz;
END;
$$;


ALTER FUNCTION "public"."get_year_bounds"("year_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_yearly_bilans_per_doctor"("year_num" integer, "top_n" integer DEFAULT 5) RETURNS SETOF "public"."doctor_bilan_stat"
    LANGUAGE "plpgsql"
    AS $$
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
END; $$;


ALTER FUNCTION "public"."get_yearly_bilans_per_doctor"("year_num" integer, "top_n" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_yearly_common_test_types"("year_num" integer, "top_n" integer DEFAULT 5) RETURNS SETOF "public"."test_type_stat"
    LANGUAGE "plpgsql"
    AS $$
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
END; $$;


ALTER FUNCTION "public"."get_yearly_common_test_types"("year_num" integer, "top_n" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_yearly_income_expense_summary"("year_num" integer) RETURNS SETOF "public"."income_expense_summary_stat"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_yearly_income_expense_summary"("year_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_yearly_insights"("year_num" integer) RETURNS TABLE("bilan_count" bigint, "total_revenue" numeric, "total_normal_price" numeric, "total_insurance_price" numeric)
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."get_yearly_insights"("year_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_yearly_new_patients_count"("year_num" integer) RETURNS TABLE("new_patient_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_year_bounds(year_num);
    RETURN QUERY SELECT COUNT(id) FROM public.patient WHERE created_at >= v_start_time AND created_at <= v_end_time;
END; $$;


ALTER FUNCTION "public"."get_yearly_new_patients_count"("year_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_yearly_ristourne_generated"("year_num" integer) RETURNS TABLE("total_ristourne_fee" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE v_start_time timestamptz; v_end_time timestamptz;
BEGIN
    SELECT start_time, end_time INTO v_start_time, v_end_time FROM get_year_bounds(year_num);
    RETURN QUERY SELECT COALESCE(SUM(total_fee), 0) FROM public.ristourne
    WHERE created_at >= v_start_time AND created_at <= v_end_time;
END; $$;


ALTER FUNCTION "public"."get_yearly_ristourne_generated"("year_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_yearly_unpaid_insights"("year_num" integer) RETURNS TABLE("total_unpaid_amount" numeric)
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."get_yearly_unpaid_insights"("year_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_yearly_unpaid_total"("year_num" integer) RETURNS TABLE("total_unpaid_amount" numeric)
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."get_yearly_unpaid_total"("year_num" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_ristourne_upsert"("p_ristourne_id" "uuid" DEFAULT NULL::"uuid", "p_doctor_id" "uuid" DEFAULT NULL::"uuid", "p_notes" "text" DEFAULT NULL::"text", "p_total_fee" numeric DEFAULT 0, "p_patient_results" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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

    RETURN v_ristourne_id;
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;


ALTER FUNCTION "public"."handle_ristourne_upsert"("p_ristourne_id" "uuid", "p_doctor_id" "uuid", "p_notes" "text", "p_total_fee" numeric, "p_patient_results" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_ristourne_upsert"("p_ristourne_id" "uuid" DEFAULT NULL::"uuid", "p_doctor_id" "uuid" DEFAULT NULL::"uuid", "p_notes" "text" DEFAULT NULL::"text", "p_total_fee" numeric DEFAULT 0, "p_status" "text" DEFAULT 'pending'::"text", "p_patient_results" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_ristourne_upsert"("p_ristourne_id" "uuid", "p_doctor_id" "uuid", "p_notes" "text", "p_total_fee" numeric, "p_status" "text", "p_patient_results" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."abbre-models" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "description" "text"
);


ALTER TABLE "public"."abbre-models" OWNER TO "postgres";


ALTER TABLE "public"."abbre-models" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."abbre-models_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."abbre_models" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."abbre_models" OWNER TO "postgres";


COMMENT ON TABLE "public"."abbre_models" IS 'Stores abbreviation models, identified by a unique name and an optional description.';



COMMENT ON COLUMN "public"."abbre_models"."id" IS 'Unique identifier for the abbreviation model (Primary Key).';



COMMENT ON COLUMN "public"."abbre_models"."name" IS 'The unique name of the abbreviation model. This name is used as a suffix in test_type names.';



COMMENT ON COLUMN "public"."abbre_models"."description" IS 'An optional longer description of the abbreviation model.';



COMMENT ON COLUMN "public"."abbre_models"."created_at" IS 'Timestamp of when the abbreviation model was created.';



CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


COMMENT ON TABLE "public"."agents" IS 'Stores information about agents who record income/expenses.';



COMMENT ON COLUMN "public"."agents"."name" IS 'Full name of the agent.';



COMMENT ON COLUMN "public"."agents"."code" IS 'Unique identifying code for the agent.';



CREATE TABLE IF NOT EXISTS "public"."anapath" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "result_id" "uuid" NOT NULL,
    "diagnostic_clinique" "text",
    "biopsie_chirurgicale" "text",
    "fixateur_utilise" "text",
    "etude_macroscopique" "text",
    "etude_histologique" "text",
    "conclusion" "text",
    "bottom_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."anapath" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."antibiotique_model" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "antibiotiques" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."antibiotique_model" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."atbs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."atbs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."atbs_result" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "result_id" "uuid",
    "nature_prelement" "text",
    "souche" "text",
    "description" "text" DEFAULT 'S = sensible      I = intermédiaire   R = résistant'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."atbs_result" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."atbs_result_atb" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "atbs_result_id" "uuid",
    "atb_id" "uuid",
    "sensible" boolean DEFAULT false,
    "intermediaire" boolean DEFAULT false,
    "resistant" boolean DEFAULT false
);


ALTER TABLE "public"."atbs_result_atb" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."autres_models" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."autres_models" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."autres_result_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "result_id" "uuid" NOT NULL,
    "model_id" "uuid",
    "content" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."autres_result_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."category" OWNER TO "postgres";


COMMENT ON TABLE "public"."category" IS 'Stores categories for grouping Test Types (e.g., Hématologie, Biochimie).';



CREATE TABLE IF NOT EXISTS "public"."doctor" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "hospital" "text",
    "bio" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."doctor" OWNER TO "postgres";


COMMENT ON TABLE "public"."doctor" IS 'Represents a referring or ordering physician.';



COMMENT ON COLUMN "public"."doctor"."hospital" IS 'Name of the primary hospital/clinic';



COMMENT ON COLUMN "public"."doctor"."bio" IS 'Brief description or notes about the doctor';



CREATE TABLE IF NOT EXISTS "public"."doctor_fee_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "normal_price_percentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "insurance_price_percentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "effective_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "percentage_range" CHECK ((("normal_price_percentage" >= (0)::numeric) AND ("normal_price_percentage" <= (100)::numeric) AND (("insurance_price_percentage" >= (0)::numeric) AND ("insurance_price_percentage" <= (100)::numeric))))
);


ALTER TABLE "public"."doctor_fee_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."doctor_fee_config" IS 'Stores referral fee percentages for doctors';



COMMENT ON COLUMN "public"."doctor_fee_config"."normal_price_percentage" IS 'Percentage of normal price to be given as referral fee';



COMMENT ON COLUMN "public"."doctor_fee_config"."insurance_price_percentage" IS 'Percentage of insurance price to be given as referral fee';



COMMENT ON COLUMN "public"."doctor_fee_config"."effective_date" IS 'When this fee configuration becomes effective';



CREATE TABLE IF NOT EXISTS "public"."ecb" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "result_id" "uuid" NOT NULL,
    "model_id" "uuid",
    "title" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY "public"."ecb" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecb" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ecb_model" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "structure" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY "public"."ecb_model" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecb_model" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ecb_section" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecb_id" "uuid" NOT NULL,
    "section_title" "text" NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY "public"."ecb_section" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecb_section" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ecb_value" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "value" "text",
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY "public"."ecb_value" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecb_value" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "income_expense_record_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "expense_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "expenses_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


COMMENT ON TABLE "public"."expenses" IS 'Individual expense items.';



COMMENT ON COLUMN "public"."expenses"."income_expense_record_id" IS 'The parent income/expense record this expense belongs to.';



COMMENT ON COLUMN "public"."expenses"."name" IS 'Description of the expense.';



COMMENT ON COLUMN "public"."expenses"."price" IS 'Cost of the expense.';



COMMENT ON COLUMN "public"."expenses"."expense_date" IS 'Date the expense was incurred.';



CREATE TABLE IF NOT EXISTS "public"."hemoculture_observation_model" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "fields_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hemoculture_observation_model" OWNER TO "postgres";


COMMENT ON TABLE "public"."hemoculture_observation_model" IS 'Templates for Hémoculture observation/culture structured text fields.';



COMMENT ON COLUMN "public"."hemoculture_observation_model"."fields_json" IS 'Defines the fields: [{"id":"uuid", "label":"Field Name", "type":"textarea", "order":0, "defaultValue":""}, ...]';



CREATE TABLE IF NOT EXISTS "public"."income_expense_records" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "record_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."income_expense_records" OWNER TO "postgres";


COMMENT ON TABLE "public"."income_expense_records" IS 'A container for a set of incomes and expenses recorded by an agent for a specific period/event.';



COMMENT ON COLUMN "public"."income_expense_records"."agent_id" IS 'The agent who created this record.';



COMMENT ON COLUMN "public"."income_expense_records"."record_date" IS 'The date this income/expense record pertains to.';



CREATE TABLE IF NOT EXISTS "public"."incomes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "income_expense_record_id" "uuid" NOT NULL,
    "patient_result_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "manual_income_name" "text",
    "manual_income_amount" numeric(10,2),
    CONSTRAINT "chk_income_type" CHECK (((("patient_result_id" IS NOT NULL) AND ("manual_income_name" IS NULL) AND ("manual_income_amount" IS NULL)) OR (("patient_result_id" IS NULL) AND ("manual_income_name" IS NOT NULL) AND ("manual_income_amount" IS NOT NULL))))
);


ALTER TABLE "public"."incomes" OWNER TO "postgres";


COMMENT ON TABLE "public"."incomes" IS 'Individual income items, linked to a patient result.';



COMMENT ON COLUMN "public"."incomes"."income_expense_record_id" IS 'The parent income/expense record this income belongs to.';



COMMENT ON COLUMN "public"."incomes"."patient_result_id" IS 'The patient result that generated this income.';



CREATE TABLE IF NOT EXISTS "public"."patient_result" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "result_date" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "normal_price" numeric(10,2),
    "insurance_price" numeric(10,2),
    "paid_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "isFree" boolean DEFAULT false,
    "notes" "text",
    "unpaid_amount" numeric(10,2),
    "selected_antibiotique_model_id" "uuid"
);


ALTER TABLE "public"."patient_result" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient_result" IS 'Represents a specific instance of testing for a patient, associated with a doctor.';



COMMENT ON COLUMN "public"."patient_result"."result_date" IS 'When the result was finalized/reported';



COMMENT ON COLUMN "public"."patient_result"."description" IS 'Additional notes or observations about the patient result';



COMMENT ON COLUMN "public"."patient_result"."normal_price" IS 'Regular price for the test';



COMMENT ON COLUMN "public"."patient_result"."insurance_price" IS 'Insurance coverage price for the test';



COMMENT ON COLUMN "public"."patient_result"."paid_status" IS 'Payment status: paid, unpaid, partial';



CREATE OR REPLACE VIEW "public"."income_expense_record_summary" AS
 SELECT "ier"."id",
    "ier"."agent_id",
    "a"."name" AS "agent_name",
    "a"."code" AS "agent_code",
    "ier"."record_date",
    "ier"."notes",
    "ier"."created_at",
    "ier"."updated_at",
    COALESCE(( SELECT "sum"(((COALESCE("pr"."normal_price", (0)::numeric) + COALESCE("pr"."insurance_price", (0)::numeric)) - COALESCE("pr"."unpaid_amount"))) AS "sum"
           FROM ("public"."incomes" "inc"
             JOIN "public"."patient_result" "pr" ON (("inc"."patient_result_id" = "pr"."id")))
          WHERE ("inc"."income_expense_record_id" = "ier"."id")), (0)::numeric) AS "total_income",
    COALESCE(( SELECT "sum"("exp"."price") AS "sum"
           FROM "public"."expenses" "exp"
          WHERE ("exp"."income_expense_record_id" = "ier"."id")), (0)::numeric) AS "total_expense",
    (COALESCE(( SELECT "sum"(((COALESCE("pr"."normal_price", (0)::numeric) + COALESCE("pr"."insurance_price", (0)::numeric)) - COALESCE("pr"."unpaid_amount"))) AS "sum"
           FROM ("public"."incomes" "inc"
             JOIN "public"."patient_result" "pr" ON (("inc"."patient_result_id" = "pr"."id")))
          WHERE ("inc"."income_expense_record_id" = "ier"."id")), (0)::numeric) - COALESCE(( SELECT "sum"("exp"."price") AS "sum"
           FROM "public"."expenses" "exp"
          WHERE ("exp"."income_expense_record_id" = "ier"."id")), (0)::numeric)) AS "net_income"
   FROM ("public"."income_expense_records" "ier"
     JOIN "public"."agents" "a" ON (("ier"."agent_id" = "a"."id")));


ALTER TABLE "public"."income_expense_record_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_unique_id" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "date_of_birth" "date",
    "gender" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."patient" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient" IS 'Represents an individual whose tests are being processed.';



COMMENT ON COLUMN "public"."patient"."patient_unique_id" IS 'e.g., MRN or lab-specific ID';



COMMENT ON COLUMN "public"."patient"."gender" IS 'e.g., Male, Female, Other, Prefer not to say';



CREATE TABLE IF NOT EXISTS "public"."patient_antibiogram_set" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_result_id" "uuid" NOT NULL,
    "source_antibiotique_model_id" "uuid" NOT NULL,
    "results_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."patient_antibiogram_set" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient_antibiogram_set" IS 'Stores a complete set of antibiotic S/I/R results for a patient_result FOR A SPECIFIC MODEL, as a JSONB array, templated from an antibiotique_model.';



COMMENT ON COLUMN "public"."patient_antibiogram_set"."description" IS 'Instance-specific description for this antibiogram set, initially copied from the source model but can be overridden.';



CREATE TABLE IF NOT EXISTS "public"."patient_hemoculture_observation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_result_id" "uuid" NOT NULL,
    "source_model_id" "uuid" NOT NULL,
    "results_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "overall_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."patient_hemoculture_observation" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient_hemoculture_observation" IS 'Stores structured text results for Hémoculture observation/culture part.';



COMMENT ON COLUMN "public"."patient_hemoculture_observation"."source_model_id" IS 'The hemoculture_observation_model used as a template.';



COMMENT ON COLUMN "public"."patient_hemoculture_observation"."results_json" IS 'Actual values for the fields defined in the source model.';



CREATE TABLE IF NOT EXISTS "public"."print_header_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lab_name" "text",
    "address_line1" "text",
    "address_line2" "text",
    "city_postal_code" "text",
    "phone" "text",
    "email" "text",
    "website" "text",
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "selected_template" "text" DEFAULT 'template1'::"text"
);


ALTER TABLE "public"."print_header_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."print_header_config" IS 'Stores configuration for the printable/PDF result header.';



COMMENT ON COLUMN "public"."print_header_config"."logo_url" IS 'Public URL of the logo image stored in Supabase Storage.';



COMMENT ON COLUMN "public"."print_header_config"."selected_template" IS 'Identifier for the chosen print header layout template (e.g., template1, template2).';



CREATE TABLE IF NOT EXISTS "public"."protidogramme" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "result_id" "uuid" NOT NULL,
    "image" "text",
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."protidogramme" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."result_column_widths" (
    "id" integer NOT NULL,
    "param_width" integer NOT NULL,
    "value_width" integer NOT NULL,
    "unit_width" integer NOT NULL,
    "ref_width" integer NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."result_column_widths" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."result_column_widths_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."result_column_widths_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."result_column_widths_id_seq" OWNED BY "public"."result_column_widths"."id";



CREATE TABLE IF NOT EXISTS "public"."result_value" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_result_id" "uuid" NOT NULL,
    "test_parameter_id" "uuid" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."result_value" OWNER TO "postgres";


COMMENT ON TABLE "public"."result_value" IS 'Stores the actual measured value for a specific parameter within a specific PatientResult.';



COMMENT ON COLUMN "public"."result_value"."value" IS 'Storing as text allows flexibility for numeric/non-numeric results';



CREATE TABLE IF NOT EXISTS "public"."ristourne" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "total_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ristourne" OWNER TO "postgres";


COMMENT ON TABLE "public"."ristourne" IS 'Represents a referral fee collection for a doctor';



COMMENT ON COLUMN "public"."ristourne"."status" IS 'Status of the ristourne: pending, approved, paid';



COMMENT ON COLUMN "public"."ristourne"."total_fee" IS 'Total referral fee amount';



CREATE TABLE IF NOT EXISTS "public"."ristourne_patient_result" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ristourne_id" "uuid" NOT NULL,
    "patient_result_id" "uuid" NOT NULL,
    "fee_amount" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ristourne_patient_result" OWNER TO "postgres";


COMMENT ON TABLE "public"."ristourne_patient_result" IS 'Links patient results to ristournes and stores individual fee amounts';



CREATE TABLE IF NOT EXISTS "public"."settings" (
    "ristourne_access_code" "text"
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skip_range_check" (
    "id" integer NOT NULL,
    "value" "text" NOT NULL,
    "type" "text" NOT NULL,
    CONSTRAINT "skip_range_check_type_check" CHECK (("type" = ANY (ARRAY['category'::"text", 'test_type'::"text"])))
);


ALTER TABLE "public"."skip_range_check" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."skip_range_check_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."skip_range_check_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."skip_range_check_id_seq" OWNED BY "public"."skip_range_check"."id";



CREATE TABLE IF NOT EXISTS "public"."test_parameter" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_type_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text",
    "reference_range" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."test_parameter" OWNER TO "postgres";


COMMENT ON TABLE "public"."test_parameter" IS 'Represents a specific measurement within a TestType (e.g., Hemoglobin, Cholesterol).';



COMMENT ON COLUMN "public"."test_parameter"."unit" IS 'e.g., g/dL, mg/dL';



COMMENT ON COLUMN "public"."test_parameter"."reference_range" IS 'e.g., 13.5-17.5, <200';



COMMENT ON COLUMN "public"."test_parameter"."description" IS 'Optional detailed explanation for the parameter or its range. Can contain plain text, HTML, or Markdown';



COMMENT ON COLUMN "public"."test_parameter"."order" IS 'Determines the display order of parameters within a test type';



CREATE TABLE IF NOT EXISTS "public"."test_type" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."test_type" OWNER TO "postgres";


COMMENT ON TABLE "public"."test_type" IS 'Represents a category of test performed by the lab (e.g., CBC, Lipid Panel).';



COMMENT ON COLUMN "public"."test_type"."description" IS 'Detailed description of the test type, including purpose, preparation instructions, or other relevant information';



CREATE TABLE IF NOT EXISTS "public"."tests" (
    "id" integer NOT NULL,
    "title" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_completed" boolean DEFAULT false
);


ALTER TABLE "public"."tests" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."tests_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."tests_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tests_id_seq" OWNED BY "public"."tests"."id";



CREATE TABLE IF NOT EXISTS "public"."vhb" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "result_id" "uuid" NOT NULL,
    "value" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vhb" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vih" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "result_id" "uuid" NOT NULL,
    "value" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vih" OWNER TO "postgres";


ALTER TABLE ONLY "public"."result_column_widths" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."result_column_widths_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."skip_range_check" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."skip_range_check_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tests" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tests_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."abbre-models"
    ADD CONSTRAINT "abbre-models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."abbre_models"
    ADD CONSTRAINT "abbre_models_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."abbre_models"
    ADD CONSTRAINT "abbre_models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anapath"
    ADD CONSTRAINT "anapath_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anapath"
    ADD CONSTRAINT "anapath_result_id_key" UNIQUE ("result_id");



ALTER TABLE ONLY "public"."antibiotique_model"
    ADD CONSTRAINT "antibiotique_model_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."antibiotique_model"
    ADD CONSTRAINT "antibiotique_model_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."atbs"
    ADD CONSTRAINT "atbs_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."atbs"
    ADD CONSTRAINT "atbs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."atbs_result_atb"
    ADD CONSTRAINT "atbs_result_atb_atbs_result_id_atb_id_key" UNIQUE ("atbs_result_id", "atb_id");



ALTER TABLE ONLY "public"."atbs_result_atb"
    ADD CONSTRAINT "atbs_result_atb_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."atbs_result"
    ADD CONSTRAINT "atbs_result_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."autres_models"
    ADD CONSTRAINT "autres_models_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."autres_result_content"
    ADD CONSTRAINT "autres_result_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category"
    ADD CONSTRAINT "category_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."category"
    ADD CONSTRAINT "category_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doctor_fee_config"
    ADD CONSTRAINT "doctor_fee_config_doctor_id_effective_date_key" UNIQUE ("doctor_id", "effective_date");



ALTER TABLE ONLY "public"."doctor_fee_config"
    ADD CONSTRAINT "doctor_fee_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doctor"
    ADD CONSTRAINT "doctor_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecb_model"
    ADD CONSTRAINT "ecb_model_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecb"
    ADD CONSTRAINT "ecb_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecb_section"
    ADD CONSTRAINT "ecb_section_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecb_value"
    ADD CONSTRAINT "ecb_value_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hemoculture_observation_model"
    ADD CONSTRAINT "hemoculture_observation_model_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."hemoculture_observation_model"
    ADD CONSTRAINT "hemoculture_observation_model_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."income_expense_records"
    ADD CONSTRAINT "income_expense_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_antibiogram_set"
    ADD CONSTRAINT "patient_antibiogram_set_patient_result_id_source_antibiotiq_key" UNIQUE ("patient_result_id", "source_antibiotique_model_id");



ALTER TABLE ONLY "public"."patient_antibiogram_set"
    ADD CONSTRAINT "patient_antibiogram_set_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_hemoculture_observation"
    ADD CONSTRAINT "patient_hemoculture_observation_patient_result_id_key" UNIQUE ("patient_result_id");



ALTER TABLE ONLY "public"."patient_hemoculture_observation"
    ADD CONSTRAINT "patient_hemoculture_observation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient"
    ADD CONSTRAINT "patient_patient_unique_id_key" UNIQUE ("patient_unique_id");



ALTER TABLE ONLY "public"."patient"
    ADD CONSTRAINT "patient_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_result"
    ADD CONSTRAINT "patient_result_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."print_header_config"
    ADD CONSTRAINT "print_header_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."protidogramme"
    ADD CONSTRAINT "protidogramme_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."protidogramme"
    ADD CONSTRAINT "protidogramme_result_id_unique" UNIQUE ("result_id");



ALTER TABLE ONLY "public"."result_column_widths"
    ADD CONSTRAINT "result_column_widths_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."result_value"
    ADD CONSTRAINT "result_value_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ristourne_patient_result"
    ADD CONSTRAINT "ristourne_patient_result_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ristourne_patient_result"
    ADD CONSTRAINT "ristourne_patient_result_ristourne_id_patient_result_id_key" UNIQUE ("ristourne_id", "patient_result_id");



ALTER TABLE ONLY "public"."ristourne"
    ADD CONSTRAINT "ristourne_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skip_range_check"
    ADD CONSTRAINT "skip_range_check_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_parameter"
    ADD CONSTRAINT "test_parameter_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_type"
    ADD CONSTRAINT "test_type_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."test_type"
    ADD CONSTRAINT "test_type_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vhb"
    ADD CONSTRAINT "vhb_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vih"
    ADD CONSTRAINT "vih_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_autres_result_content_model_id" ON "public"."autres_result_content" USING "btree" ("model_id");



CREATE INDEX "idx_autres_result_content_result_id" ON "public"."autres_result_content" USING "btree" ("result_id");



CREATE INDEX "idx_doctor_fee_config_doctor_id" ON "public"."doctor_fee_config" USING "btree" ("doctor_id");



CREATE INDEX "idx_expenses_record_id" ON "public"."expenses" USING "btree" ("income_expense_record_id");



CREATE INDEX "idx_income_expense_records_agent_id" ON "public"."income_expense_records" USING "btree" ("agent_id");



CREATE INDEX "idx_income_expense_records_record_date" ON "public"."income_expense_records" USING "btree" ("record_date");



CREATE INDEX "idx_incomes_patient_result_id" ON "public"."incomes" USING "btree" ("patient_result_id");



CREATE INDEX "idx_incomes_record_id" ON "public"."incomes" USING "btree" ("income_expense_record_id");



CREATE INDEX "idx_patient_antibiogram_set_model_id" ON "public"."patient_antibiogram_set" USING "btree" ("source_antibiotique_model_id");



CREATE INDEX "idx_patient_antibiogram_set_pr_id" ON "public"."patient_antibiogram_set" USING "btree" ("patient_result_id");



CREATE INDEX "idx_patient_hemoculture_observation_model_id" ON "public"."patient_hemoculture_observation" USING "btree" ("source_model_id");



CREATE INDEX "idx_patient_hemoculture_observation_pr_id" ON "public"."patient_hemoculture_observation" USING "btree" ("patient_result_id");



CREATE INDEX "idx_patient_result_doctor_id" ON "public"."patient_result" USING "btree" ("doctor_id");



CREATE INDEX "idx_patient_result_patient_id" ON "public"."patient_result" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_result_result_date" ON "public"."patient_result" USING "btree" ("result_date");



CREATE INDEX "idx_result_value_patient_result_id" ON "public"."result_value" USING "btree" ("patient_result_id");



CREATE INDEX "idx_result_value_test_parameter_id" ON "public"."result_value" USING "btree" ("test_parameter_id");



CREATE INDEX "idx_ristourne_doctor_id" ON "public"."ristourne" USING "btree" ("doctor_id");



CREATE INDEX "idx_ristourne_patient_result_patient_result_id" ON "public"."ristourne_patient_result" USING "btree" ("patient_result_id");



CREATE INDEX "idx_ristourne_patient_result_ristourne_id" ON "public"."ristourne_patient_result" USING "btree" ("ristourne_id");



CREATE INDEX "idx_test_parameter_test_type_id" ON "public"."test_parameter" USING "btree" ("test_type_id");



CREATE INDEX "idx_test_type_category_id" ON "public"."test_type" USING "btree" ("category_id");



CREATE UNIQUE INDEX "unique_vhb_result_id" ON "public"."vhb" USING "btree" ("result_id");



CREATE UNIQUE INDEX "unique_vih_result_id" ON "public"."vih" USING "btree" ("result_id");



CREATE OR REPLACE TRIGGER "set_timestamp_agents" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_timestamp_antibiotique_model" BEFORE UPDATE ON "public"."antibiotique_model" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_category" BEFORE UPDATE ON "public"."category" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_doctor" BEFORE UPDATE ON "public"."doctor" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_doctor_fee_config" BEFORE UPDATE ON "public"."doctor_fee_config" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_expenses" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_timestamp_hemoculture_observation_model" BEFORE UPDATE ON "public"."hemoculture_observation_model" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_income_expense_records" BEFORE UPDATE ON "public"."income_expense_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_timestamp_incomes" BEFORE UPDATE ON "public"."incomes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_timestamp_patient" BEFORE UPDATE ON "public"."patient" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_patient_antibiogram_set" BEFORE UPDATE ON "public"."patient_antibiogram_set" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_patient_hemoculture_observation" BEFORE UPDATE ON "public"."patient_hemoculture_observation" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_patient_result" BEFORE UPDATE ON "public"."patient_result" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_print_header_config" BEFORE UPDATE ON "public"."print_header_config" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_result_value" BEFORE UPDATE ON "public"."result_value" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_ristourne" BEFORE UPDATE ON "public"."ristourne" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_ristourne_patient_result" BEFORE UPDATE ON "public"."ristourne_patient_result" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_test_parameter" BEFORE UPDATE ON "public"."test_parameter" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_test_type" BEFORE UPDATE ON "public"."test_type" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_update_atbs_result_updated_at" BEFORE UPDATE ON "public"."atbs_result" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."anapath"
    ADD CONSTRAINT "anapath_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "public"."patient_result"("id");



ALTER TABLE ONLY "public"."atbs_result_atb"
    ADD CONSTRAINT "atbs_result_atb_atb_id_fkey" FOREIGN KEY ("atb_id") REFERENCES "public"."atbs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atbs_result_atb"
    ADD CONSTRAINT "atbs_result_atb_atbs_result_id_fkey" FOREIGN KEY ("atbs_result_id") REFERENCES "public"."atbs_result"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."atbs_result"
    ADD CONSTRAINT "atbs_result_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "public"."patient_result"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."autres_result_content"
    ADD CONSTRAINT "autres_result_content_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."autres_models"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."autres_result_content"
    ADD CONSTRAINT "autres_result_content_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "public"."patient_result"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doctor_fee_config"
    ADD CONSTRAINT "doctor_fee_config_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ecb"
    ADD CONSTRAINT "ecb_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ecb"
    ADD CONSTRAINT "ecb_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."ecb_model"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ecb"
    ADD CONSTRAINT "ecb_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "public"."patient_result"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ecb_section"
    ADD CONSTRAINT "ecb_section_ecb_id_fkey" FOREIGN KEY ("ecb_id") REFERENCES "public"."ecb"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ecb_value"
    ADD CONSTRAINT "ecb_value_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."ecb_section"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_income_expense_record_id_fkey" FOREIGN KEY ("income_expense_record_id") REFERENCES "public"."income_expense_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_type"
    ADD CONSTRAINT "fk_test_type_category" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."income_expense_records"
    ADD CONSTRAINT "income_expense_records_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_income_expense_record_id_fkey" FOREIGN KEY ("income_expense_record_id") REFERENCES "public"."income_expense_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incomes"
    ADD CONSTRAINT "incomes_patient_result_id_fkey" FOREIGN KEY ("patient_result_id") REFERENCES "public"."patient_result"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patient_antibiogram_set"
    ADD CONSTRAINT "patient_antibiogram_set_patient_result_id_fkey" FOREIGN KEY ("patient_result_id") REFERENCES "public"."patient_result"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_antibiogram_set"
    ADD CONSTRAINT "patient_antibiogram_set_source_antibiotique_model_id_fkey" FOREIGN KEY ("source_antibiotique_model_id") REFERENCES "public"."antibiotique_model"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patient_hemoculture_observation"
    ADD CONSTRAINT "patient_hemoculture_observation_patient_result_id_fkey" FOREIGN KEY ("patient_result_id") REFERENCES "public"."patient_result"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_hemoculture_observation"
    ADD CONSTRAINT "patient_hemoculture_observation_source_model_id_fkey" FOREIGN KEY ("source_model_id") REFERENCES "public"."hemoculture_observation_model"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patient_result"
    ADD CONSTRAINT "patient_result_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patient_result"
    ADD CONSTRAINT "patient_result_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."patient_result"
    ADD CONSTRAINT "patient_result_selected_antibiotique_model_id_fkey" FOREIGN KEY ("selected_antibiotique_model_id") REFERENCES "public"."antibiotique_model"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."protidogramme"
    ADD CONSTRAINT "protidogramme_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "public"."patient_result"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."result_value"
    ADD CONSTRAINT "result_value_patient_result_id_fkey" FOREIGN KEY ("patient_result_id") REFERENCES "public"."patient_result"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."result_value"
    ADD CONSTRAINT "result_value_test_parameter_id_fkey" FOREIGN KEY ("test_parameter_id") REFERENCES "public"."test_parameter"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ristourne"
    ADD CONSTRAINT "ristourne_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ristourne_patient_result"
    ADD CONSTRAINT "ristourne_patient_result_patient_result_id_fkey" FOREIGN KEY ("patient_result_id") REFERENCES "public"."patient_result"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ristourne_patient_result"
    ADD CONSTRAINT "ristourne_patient_result_ristourne_id_fkey" FOREIGN KEY ("ristourne_id") REFERENCES "public"."ristourne"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_parameter"
    ADD CONSTRAINT "test_parameter_test_type_id_fkey" FOREIGN KEY ("test_type_id") REFERENCES "public"."test_type"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."vhb"
    ADD CONSTRAINT "vhb_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "public"."patient_result"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vih"
    ADD CONSTRAINT "vih_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "public"."patient_result"("id") ON DELETE CASCADE;



CREATE POLICY "Allow all access for authenticated users" ON "public"."antibiotique_model" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."category" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."doctor" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."doctor_fee_config" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."hemoculture_observation_model" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."patient" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."patient_antibiogram_set" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."patient_hemoculture_observation" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."patient_result" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."print_header_config" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."result_value" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."ristourne" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."ristourne_patient_result" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."test_parameter" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all access for authenticated users" ON "public"."test_type" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all authenticated users (autres_models)" ON "public"."autres_models" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all authenticated users (autres_result_content)" ON "public"."autres_result_content" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated delete" ON "public"."anapath" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated insert" ON "public"."anapath" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated read" ON "public"."anapath" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated update" ON "public"."anapath" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow delete access to authenticated users" ON "public"."doctor_fee_config" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow delete access to authenticated users" ON "public"."ristourne" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow delete access to authenticated users" ON "public"."ristourne_patient_result" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow delete for authenticated" ON "public"."protidogramme" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow insert access to authenticated users" ON "public"."doctor_fee_config" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow insert access to authenticated users" ON "public"."ristourne" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow insert access to authenticated users" ON "public"."ristourne_patient_result" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow insert for authenticated" ON "public"."protidogramme" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."doctor_fee_config" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."ristourne" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."ristourne_patient_result" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow select for authenticated" ON "public"."protidogramme" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow update access to authenticated users" ON "public"."doctor_fee_config" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow update access to authenticated users" ON "public"."ristourne" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow update access to authenticated users" ON "public"."ristourne_patient_result" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow update for authenticated" ON "public"."protidogramme" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can DELETE" ON "public"."ecb" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can DELETE" ON "public"."ecb_model" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can DELETE" ON "public"."ecb_section" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can DELETE" ON "public"."ecb_value" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can INSERT" ON "public"."ecb" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can INSERT" ON "public"."ecb_model" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can INSERT" ON "public"."ecb_section" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can INSERT" ON "public"."ecb_value" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can SELECT" ON "public"."ecb" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can SELECT" ON "public"."ecb_model" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can SELECT" ON "public"."ecb_section" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can SELECT" ON "public"."ecb_value" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can UPDATE" ON "public"."ecb" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can UPDATE" ON "public"."ecb_model" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can UPDATE" ON "public"."ecb_section" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can UPDATE" ON "public"."ecb_value" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can delete" ON "public"."atbs" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete" ON "public"."atbs_result" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete" ON "public"."atbs_result_atb" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can do anything on vhb" ON "public"."vhb" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can do anything on vih" ON "public"."vih" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert" ON "public"."atbs" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert" ON "public"."atbs_result" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert" ON "public"."atbs_result_atb" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can select" ON "public"."atbs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can select" ON "public"."atbs_result" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can select" ON "public"."atbs_result_atb" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update" ON "public"."atbs" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update" ON "public"."atbs_result" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update" ON "public"."atbs_result_atb" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."anapath" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."antibiotique_model" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."atbs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."atbs_result" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."atbs_result_atb" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."autres_models" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."autres_result_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."category" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doctor" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doctor_fee_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecb" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecb_model" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecb_section" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ecb_value" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hemoculture_observation_model" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_antibiogram_set" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_hemoculture_observation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_result" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."print_header_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."protidogramme" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."result_value" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ristourne" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ristourne_patient_result" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_parameter" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_type" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vhb" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vih" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."get_daily_bilans_per_doctor"("target_date" "date", "top_n" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_bilans_per_doctor"("target_date" "date", "top_n" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_bilans_per_doctor"("target_date" "date", "top_n" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_common_test_types"("target_date" "date", "top_n" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_common_test_types"("target_date" "date", "top_n" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_common_test_types"("target_date" "date", "top_n" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_income_expense_summary"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_income_expense_summary"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_income_expense_summary"("target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_insights"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_insights"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_insights"("target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_new_patients_count"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_new_patients_count"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_new_patients_count"("target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_ristourne_generated"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_ristourne_generated"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_ristourne_generated"("target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_unpaid_insights"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_unpaid_insights"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_unpaid_insights"("target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_daily_unpaid_total"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_daily_unpaid_total"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_daily_unpaid_total"("target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_day_bounds"("target_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_day_bounds"("target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_day_bounds"("target_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_month_bounds"("year_num" integer, "month_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_month_bounds"("year_num" integer, "month_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_month_bounds"("year_num" integer, "month_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_bilans_per_doctor"("year_num" integer, "month_num" integer, "top_n" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_bilans_per_doctor"("year_num" integer, "month_num" integer, "top_n" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_bilans_per_doctor"("year_num" integer, "month_num" integer, "top_n" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_common_test_types"("year_num" integer, "month_num" integer, "top_n" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_common_test_types"("year_num" integer, "month_num" integer, "top_n" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_common_test_types"("year_num" integer, "month_num" integer, "top_n" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_income_expense_summary"("year_num" integer, "month_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_income_expense_summary"("year_num" integer, "month_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_income_expense_summary"("year_num" integer, "month_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_insights"("year_num" integer, "month_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_insights"("year_num" integer, "month_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_insights"("year_num" integer, "month_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_new_patients_count"("year_num" integer, "month_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_new_patients_count"("year_num" integer, "month_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_new_patients_count"("year_num" integer, "month_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_ristourne_generated"("year_num" integer, "month_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_ristourne_generated"("year_num" integer, "month_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_ristourne_generated"("year_num" integer, "month_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_unpaid_insights"("year_num" integer, "month_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_unpaid_insights"("year_num" integer, "month_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_unpaid_insights"("year_num" integer, "month_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_unpaid_total"("year_num" integer, "month_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_unpaid_total"("year_num" integer, "month_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_unpaid_total"("year_num" integer, "month_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_year_bounds"("year_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_year_bounds"("year_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_year_bounds"("year_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_yearly_bilans_per_doctor"("year_num" integer, "top_n" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_yearly_bilans_per_doctor"("year_num" integer, "top_n" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_yearly_bilans_per_doctor"("year_num" integer, "top_n" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_yearly_common_test_types"("year_num" integer, "top_n" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_yearly_common_test_types"("year_num" integer, "top_n" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_yearly_common_test_types"("year_num" integer, "top_n" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_yearly_income_expense_summary"("year_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_yearly_income_expense_summary"("year_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_yearly_income_expense_summary"("year_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_yearly_insights"("year_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_yearly_insights"("year_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_yearly_insights"("year_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_yearly_new_patients_count"("year_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_yearly_new_patients_count"("year_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_yearly_new_patients_count"("year_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_yearly_ristourne_generated"("year_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_yearly_ristourne_generated"("year_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_yearly_ristourne_generated"("year_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_yearly_unpaid_insights"("year_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_yearly_unpaid_insights"("year_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_yearly_unpaid_insights"("year_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_yearly_unpaid_total"("year_num" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_yearly_unpaid_total"("year_num" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_yearly_unpaid_total"("year_num" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_ristourne_upsert"("p_ristourne_id" "uuid", "p_doctor_id" "uuid", "p_notes" "text", "p_total_fee" numeric, "p_patient_results" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_ristourne_upsert"("p_ristourne_id" "uuid", "p_doctor_id" "uuid", "p_notes" "text", "p_total_fee" numeric, "p_patient_results" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_ristourne_upsert"("p_ristourne_id" "uuid", "p_doctor_id" "uuid", "p_notes" "text", "p_total_fee" numeric, "p_patient_results" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_ristourne_upsert"("p_ristourne_id" "uuid", "p_doctor_id" "uuid", "p_notes" "text", "p_total_fee" numeric, "p_status" "text", "p_patient_results" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."handle_ristourne_upsert"("p_ristourne_id" "uuid", "p_doctor_id" "uuid", "p_notes" "text", "p_total_fee" numeric, "p_status" "text", "p_patient_results" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_ristourne_upsert"("p_ristourne_id" "uuid", "p_doctor_id" "uuid", "p_notes" "text", "p_total_fee" numeric, "p_status" "text", "p_patient_results" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



























GRANT ALL ON TABLE "public"."abbre-models" TO "anon";
GRANT ALL ON TABLE "public"."abbre-models" TO "authenticated";
GRANT ALL ON TABLE "public"."abbre-models" TO "service_role";



GRANT ALL ON SEQUENCE "public"."abbre-models_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."abbre-models_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."abbre-models_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."abbre_models" TO "anon";
GRANT ALL ON TABLE "public"."abbre_models" TO "authenticated";
GRANT ALL ON TABLE "public"."abbre_models" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."anapath" TO "anon";
GRANT ALL ON TABLE "public"."anapath" TO "authenticated";
GRANT ALL ON TABLE "public"."anapath" TO "service_role";



GRANT ALL ON TABLE "public"."antibiotique_model" TO "anon";
GRANT ALL ON TABLE "public"."antibiotique_model" TO "authenticated";
GRANT ALL ON TABLE "public"."antibiotique_model" TO "service_role";



GRANT ALL ON TABLE "public"."atbs" TO "anon";
GRANT ALL ON TABLE "public"."atbs" TO "authenticated";
GRANT ALL ON TABLE "public"."atbs" TO "service_role";



GRANT ALL ON TABLE "public"."atbs_result" TO "anon";
GRANT ALL ON TABLE "public"."atbs_result" TO "authenticated";
GRANT ALL ON TABLE "public"."atbs_result" TO "service_role";



GRANT ALL ON TABLE "public"."atbs_result_atb" TO "anon";
GRANT ALL ON TABLE "public"."atbs_result_atb" TO "authenticated";
GRANT ALL ON TABLE "public"."atbs_result_atb" TO "service_role";



GRANT ALL ON TABLE "public"."autres_models" TO "anon";
GRANT ALL ON TABLE "public"."autres_models" TO "authenticated";
GRANT ALL ON TABLE "public"."autres_models" TO "service_role";



GRANT ALL ON TABLE "public"."autres_result_content" TO "anon";
GRANT ALL ON TABLE "public"."autres_result_content" TO "authenticated";
GRANT ALL ON TABLE "public"."autres_result_content" TO "service_role";



GRANT ALL ON TABLE "public"."category" TO "anon";
GRANT ALL ON TABLE "public"."category" TO "authenticated";
GRANT ALL ON TABLE "public"."category" TO "service_role";



GRANT ALL ON TABLE "public"."doctor" TO "anon";
GRANT ALL ON TABLE "public"."doctor" TO "authenticated";
GRANT ALL ON TABLE "public"."doctor" TO "service_role";



GRANT ALL ON TABLE "public"."doctor_fee_config" TO "anon";
GRANT ALL ON TABLE "public"."doctor_fee_config" TO "authenticated";
GRANT ALL ON TABLE "public"."doctor_fee_config" TO "service_role";



GRANT ALL ON TABLE "public"."ecb" TO "anon";
GRANT ALL ON TABLE "public"."ecb" TO "authenticated";
GRANT ALL ON TABLE "public"."ecb" TO "service_role";



GRANT ALL ON TABLE "public"."ecb_model" TO "anon";
GRANT ALL ON TABLE "public"."ecb_model" TO "authenticated";
GRANT ALL ON TABLE "public"."ecb_model" TO "service_role";



GRANT ALL ON TABLE "public"."ecb_section" TO "anon";
GRANT ALL ON TABLE "public"."ecb_section" TO "authenticated";
GRANT ALL ON TABLE "public"."ecb_section" TO "service_role";



GRANT ALL ON TABLE "public"."ecb_value" TO "anon";
GRANT ALL ON TABLE "public"."ecb_value" TO "authenticated";
GRANT ALL ON TABLE "public"."ecb_value" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."hemoculture_observation_model" TO "anon";
GRANT ALL ON TABLE "public"."hemoculture_observation_model" TO "authenticated";
GRANT ALL ON TABLE "public"."hemoculture_observation_model" TO "service_role";



GRANT ALL ON TABLE "public"."income_expense_records" TO "anon";
GRANT ALL ON TABLE "public"."income_expense_records" TO "authenticated";
GRANT ALL ON TABLE "public"."income_expense_records" TO "service_role";



GRANT ALL ON TABLE "public"."incomes" TO "anon";
GRANT ALL ON TABLE "public"."incomes" TO "authenticated";
GRANT ALL ON TABLE "public"."incomes" TO "service_role";



GRANT ALL ON TABLE "public"."patient_result" TO "anon";
GRANT ALL ON TABLE "public"."patient_result" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_result" TO "service_role";



GRANT ALL ON TABLE "public"."income_expense_record_summary" TO "anon";
GRANT ALL ON TABLE "public"."income_expense_record_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."income_expense_record_summary" TO "service_role";



GRANT ALL ON TABLE "public"."patient" TO "anon";
GRANT ALL ON TABLE "public"."patient" TO "authenticated";
GRANT ALL ON TABLE "public"."patient" TO "service_role";



GRANT ALL ON TABLE "public"."patient_antibiogram_set" TO "anon";
GRANT ALL ON TABLE "public"."patient_antibiogram_set" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_antibiogram_set" TO "service_role";



GRANT ALL ON TABLE "public"."patient_hemoculture_observation" TO "anon";
GRANT ALL ON TABLE "public"."patient_hemoculture_observation" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_hemoculture_observation" TO "service_role";



GRANT ALL ON TABLE "public"."print_header_config" TO "anon";
GRANT ALL ON TABLE "public"."print_header_config" TO "authenticated";
GRANT ALL ON TABLE "public"."print_header_config" TO "service_role";



GRANT ALL ON TABLE "public"."protidogramme" TO "anon";
GRANT ALL ON TABLE "public"."protidogramme" TO "authenticated";
GRANT ALL ON TABLE "public"."protidogramme" TO "service_role";



GRANT ALL ON TABLE "public"."result_column_widths" TO "anon";
GRANT ALL ON TABLE "public"."result_column_widths" TO "authenticated";
GRANT ALL ON TABLE "public"."result_column_widths" TO "service_role";



GRANT ALL ON SEQUENCE "public"."result_column_widths_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."result_column_widths_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."result_column_widths_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."result_value" TO "anon";
GRANT ALL ON TABLE "public"."result_value" TO "authenticated";
GRANT ALL ON TABLE "public"."result_value" TO "service_role";



GRANT ALL ON TABLE "public"."ristourne" TO "anon";
GRANT ALL ON TABLE "public"."ristourne" TO "authenticated";
GRANT ALL ON TABLE "public"."ristourne" TO "service_role";



GRANT ALL ON TABLE "public"."ristourne_patient_result" TO "anon";
GRANT ALL ON TABLE "public"."ristourne_patient_result" TO "authenticated";
GRANT ALL ON TABLE "public"."ristourne_patient_result" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."skip_range_check" TO "anon";
GRANT ALL ON TABLE "public"."skip_range_check" TO "authenticated";
GRANT ALL ON TABLE "public"."skip_range_check" TO "service_role";



GRANT ALL ON SEQUENCE "public"."skip_range_check_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."skip_range_check_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."skip_range_check_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."test_parameter" TO "anon";
GRANT ALL ON TABLE "public"."test_parameter" TO "authenticated";
GRANT ALL ON TABLE "public"."test_parameter" TO "service_role";



GRANT ALL ON TABLE "public"."test_type" TO "anon";
GRANT ALL ON TABLE "public"."test_type" TO "authenticated";
GRANT ALL ON TABLE "public"."test_type" TO "service_role";



GRANT ALL ON TABLE "public"."tests" TO "anon";
GRANT ALL ON TABLE "public"."tests" TO "authenticated";
GRANT ALL ON TABLE "public"."tests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vhb" TO "anon";
GRANT ALL ON TABLE "public"."vhb" TO "authenticated";
GRANT ALL ON TABLE "public"."vhb" TO "service_role";



GRANT ALL ON TABLE "public"."vih" TO "anon";
GRANT ALL ON TABLE "public"."vih" TO "authenticated";
GRANT ALL ON TABLE "public"."vih" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
