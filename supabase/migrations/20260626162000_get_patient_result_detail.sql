-- Fast result detail payload for /results/:resultId.

create index if not exists idx_test_type_category_id
  on public.test_type(category_id);

create or replace function public.get_patient_result_detail(p_result_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.patient_result%rowtype;
  v_patient jsonb;
  v_doctor jsonb;
  v_header_config jsonb;
  v_column_widths jsonb;
  v_skip_range_check jsonb;
  v_grouped_results jsonb;
begin
  select *
  into v_result
  from public.patient_result
  where id = p_result_id;

  if not found then
    raise exception 'Result not found';
  end if;

  select to_jsonb(p)
  into v_patient
  from public.patient p
  where p.id = v_result.patient_id;

  select to_jsonb(d)
  into v_doctor
  from public.doctor d
  where d.id = v_result.doctor_id;

  select to_jsonb(phc)
  into v_header_config
  from public.print_header_config phc
  order by phc.updated_at desc nulls last, phc.created_at desc nulls last
  limit 1;

  select to_jsonb(rcw)
  into v_column_widths
  from public.result_column_widths rcw
  order by rcw.updated_at desc nulls last
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'value', src.value,
        'type', src.type
      )
      order by src.type, src.value
    ),
    '[]'::jsonb
  )
  into v_skip_range_check
  from public.skip_range_check src;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category',
        to_jsonb(category_rows),
        'testTypes',
        (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'testType',
                to_jsonb(test_type_rows) || jsonb_build_object('category', null),
                'parameters',
                (
                  select coalesce(
                    jsonb_agg(
                      to_jsonb(tp) ||
                      jsonb_build_object(
                        'resultValue', rv.value,
                        'test_type', null
                      )
                      order by tp."order", tp.name
                    ),
                    '[]'::jsonb
                  )
                  from public.result_value rv
                  join public.test_parameter tp on tp.id = rv.test_parameter_id
                  where rv.patient_result_id = p_result_id
                    and tp.test_type_id = test_type_rows.id
                )
              )
              order by test_type_rows.name
            ),
            '[]'::jsonb
          )
          from (
            select distinct tt.*
            from public.result_value rv
            join public.test_parameter tp on tp.id = rv.test_parameter_id
            join public.test_type tt on tt.id = tp.test_type_id
            where rv.patient_result_id = p_result_id
              and tt.category_id = category_rows.id
          ) test_type_rows
        )
      )
      order by category_rows.name
    ),
    '[]'::jsonb
  )
  into v_grouped_results
  from (
    select distinct c.*
    from public.result_value rv
    join public.test_parameter tp on tp.id = rv.test_parameter_id
    join public.test_type tt on tt.id = tp.test_type_id
    join public.category c on c.id = tt.category_id
    where rv.patient_result_id = p_result_id
  ) category_rows;

  return jsonb_build_object(
    'result', to_jsonb(v_result),
    'patient', v_patient,
    'doctor', v_doctor,
    'headerConfig', v_header_config,
    'columnWidths', v_column_widths,
    'skipRangeCheck', v_skip_range_check,
    'groupedResults', v_grouped_results
  );
end;
$$;

grant execute on function public.get_patient_result_detail(uuid) to authenticated;
