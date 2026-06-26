-- Faster atomic save for patient results and result values.

create or replace function public.save_patient_result_with_values(
  p_result_id uuid default null,
  p_patient_id uuid default null,
  p_doctor_id uuid default null,
  p_result_date timestamp with time zone default null,
  p_normal_price numeric default null,
  p_insurance_price numeric default null,
  p_unpaid_amount numeric default null,
  p_is_free boolean default false,
  p_notes text default null,
  p_values_to_delete uuid[] default '{}'::uuid[],
  p_values_to_update jsonb default '[]'::jsonb,
  p_values_to_insert jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result_id uuid;
begin
  if p_patient_id is null then
    raise exception 'Patient is required';
  end if;

  if p_doctor_id is null then
    raise exception 'Doctor is required';
  end if;

  if p_result_date is null then
    raise exception 'Result date is required';
  end if;

  if p_result_id is null then
    insert into public.patient_result (
      patient_id,
      doctor_id,
      result_date,
      normal_price,
      insurance_price,
      unpaid_amount,
      "isFree",
      notes
    ) values (
      p_patient_id,
      p_doctor_id,
      p_result_date,
      p_normal_price,
      p_insurance_price,
      p_unpaid_amount,
      coalesce(p_is_free, false),
      p_notes
    )
    returning id into v_result_id;
  else
    update public.patient_result
    set
      patient_id = p_patient_id,
      doctor_id = p_doctor_id,
      result_date = p_result_date,
      normal_price = p_normal_price,
      insurance_price = p_insurance_price,
      unpaid_amount = p_unpaid_amount,
      "isFree" = coalesce(p_is_free, false),
      notes = p_notes
    where id = p_result_id
    returning id into v_result_id;

    if v_result_id is null then
      raise exception 'Patient result not found: %', p_result_id;
    end if;
  end if;

  if p_values_to_delete is not null and array_length(p_values_to_delete, 1) is not null then
    delete from public.result_value
    where id = any(p_values_to_delete)
      and patient_result_id = v_result_id;
  end if;

  if p_values_to_update is not null and jsonb_array_length(p_values_to_update) > 0 then
    update public.result_value as rv
    set
      test_parameter_id = incoming.test_parameter_id,
      value = incoming.value
    from jsonb_to_recordset(p_values_to_update) as incoming(
      id uuid,
      test_parameter_id uuid,
      value text
    )
    where rv.id = incoming.id
      and rv.patient_result_id = v_result_id;
  end if;

  if p_values_to_insert is not null and jsonb_array_length(p_values_to_insert) > 0 then
    insert into public.result_value (
      patient_result_id,
      test_parameter_id,
      value
    )
    select
      v_result_id,
      incoming.test_parameter_id,
      incoming.value
    from jsonb_to_recordset(p_values_to_insert) as incoming(
      test_parameter_id uuid,
      value text
    );
  end if;

  return v_result_id;
end;
$$;

grant execute on function public.save_patient_result_with_values(
  uuid,
  uuid,
  uuid,
  timestamp with time zone,
  numeric,
  numeric,
  numeric,
  boolean,
  text,
  uuid[],
  jsonb,
  jsonb
) to authenticated;
