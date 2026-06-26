-- Fast patient detail payload for /patients/:patientId.

create index if not exists idx_patient_result_patient_date
  on public.patient_result(patient_id, result_date desc);

create or replace function public.get_patient_detail(p_patient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient public.patient%rowtype;
  v_results jsonb;
begin
  select *
  into v_patient
  from public.patient
  where id = p_patient_id;

  if not found then
    raise exception 'Patient not found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pr.id,
        'result_date', pr.result_date,
        'status', pr.status,
        'doctor',
        case
          when d.id is null then null
          else jsonb_build_object('full_name', d.full_name)
        end
      )
      order by pr.result_date desc nulls last, pr.created_at desc, pr.id desc
    ),
    '[]'::jsonb
  )
  into v_results
  from public.patient_result pr
  left join public.doctor d on d.id = pr.doctor_id
  where pr.patient_id = p_patient_id;

  return jsonb_build_object(
    'patient', to_jsonb(v_patient),
    'results', v_results
  );
end;
$$;

grant execute on function public.get_patient_detail(uuid) to authenticated;
