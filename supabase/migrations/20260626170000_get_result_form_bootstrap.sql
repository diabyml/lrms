-- Fast bootstrap payload for result create/edit forms.

create or replace function public.get_result_form_bootstrap(
  p_patient_id uuid default null,
  p_result_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.patient_result%rowtype;
  v_patient public.patient%rowtype;
  v_doctors jsonb;
  v_categories jsonb;
  v_test_types jsonb;
  v_original_values jsonb := '[]'::jsonb;
  v_selected_test_types jsonb := '[]'::jsonb;
begin
  if p_patient_id is null and p_result_id is null then
    raise exception 'Patient id or result id is required';
  end if;

  if p_result_id is not null then
    select *
    into v_result
    from public.patient_result
    where id = p_result_id;

    if not found then
      raise exception 'Result not found';
    end if;

    select *
    into v_patient
    from public.patient
    where id = v_result.patient_id;
  else
    select *
    into v_patient
    from public.patient
    where id = p_patient_id;
  end if;

  if not found then
    raise exception 'Patient not found';
  end if;

  select coalesce(jsonb_agg(to_jsonb(d) order by d.full_name), '[]'::jsonb)
  into v_doctors
  from (
    select id, full_name
    from public.doctor
    order by full_name
  ) d;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.name), '[]'::jsonb)
  into v_categories
  from (
    select id, name
    from public.category
    order by name
  ) c;

  select coalesce(jsonb_agg(to_jsonb(tt) order by tt.name), '[]'::jsonb)
  into v_test_types
  from (
    select *
    from public.test_type
    order by name
  ) tt;

  if p_result_id is not null then
    select coalesce(jsonb_agg(to_jsonb(rv) order by rv.created_at, rv.id), '[]'::jsonb)
    into v_original_values
    from public.result_value rv
    where rv.patient_result_id = p_result_id;

    select coalesce(
      jsonb_agg(
        to_jsonb(tt) ||
        jsonb_build_object(
          'parameters',
          (
            select coalesce(
              jsonb_agg(
                to_jsonb(tp) ||
                jsonb_build_object(
                  'resultValue', coalesce(rv.value, ''),
                  'isVisible', true,
                  'originalValueId', rv.id,
                  'test_type', jsonb_build_object('id', tt.id, 'name', tt.name)
                )
                order by tp."order", tp.name
              ),
              '[]'::jsonb
            )
            from public.test_parameter tp
            left join public.result_value rv
              on rv.test_parameter_id = tp.id
             and rv.patient_result_id = p_result_id
            where tp.test_type_id = tt.id
          ),
          'loadingParams', false,
          'errorLoadingParams', false
        )
        order by tt.name
      ),
      '[]'::jsonb
    )
    into v_selected_test_types
    from (
      select distinct tt.*
      from public.result_value rv
      join public.test_parameter tp on tp.id = rv.test_parameter_id
      join public.test_type tt on tt.id = tp.test_type_id
      where rv.patient_result_id = p_result_id
    ) tt;
  end if;

  return jsonb_build_object(
    'patient', to_jsonb(v_patient),
    'doctors', v_doctors,
    'categories', v_categories,
    'testTypes', v_test_types,
    'result', case when p_result_id is null then null else to_jsonb(v_result) end,
    'selectedTestTypes', v_selected_test_types,
    'originalResultValues', v_original_values
  );
end;
$$;

grant execute on function public.get_result_form_bootstrap(uuid, uuid) to authenticated;
