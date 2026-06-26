-- Fast server-side patients list pagination/search/filter.

create extension if not exists pg_trgm with schema public;

create index if not exists idx_patient_created_at_desc
  on public.patient(created_at desc);

create index if not exists idx_patient_result_doctor_patient
  on public.patient_result(doctor_id, patient_id);

create index if not exists idx_patient_full_name_trgm
  on public.patient using gin (full_name gin_trgm_ops);

create index if not exists idx_patient_unique_id_trgm
  on public.patient using gin (patient_unique_id gin_trgm_ops);

create index if not exists idx_patient_phone_trgm
  on public.patient using gin (phone gin_trgm_ops);

create or replace function public.get_patients_page(
  p_search text default null,
  p_doctor_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 20
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_offset integer;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_pattern text;
  v_patients jsonb;
  v_total_count bigint;
begin
  v_offset := (v_page - 1) * v_page_size;
  v_pattern := case when v_search is null then null else '%' || v_search || '%' end;

  with filtered as (
    select
      p.id,
      p.patient_unique_id,
      p.full_name,
      p.date_of_birth,
      p.gender,
      p.phone,
      p.created_at
    from public.patient p
    where (
      v_search is null
      or p.full_name ilike v_pattern
      or p.patient_unique_id ilike v_pattern
      or coalesce(p.phone, '') ilike v_pattern
    )
    and (
      p_doctor_id is null
      or exists (
        select 1
        from public.patient_result pr
        where pr.patient_id = p.id
          and pr.doctor_id = p_doctor_id
      )
    )
  ),
  counted as (
    select count(*) as total_count
    from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, full_name asc, id asc
    offset v_offset
    limit v_page_size
  )
  select
    coalesce(
      jsonb_agg(to_jsonb(paged) order by paged.created_at desc, paged.full_name asc, paged.id asc)
        filter (where paged.id is not null),
      '[]'::jsonb
    ),
    coalesce(max(counted.total_count), 0)
  into v_patients, v_total_count
  from counted
  left join paged on true;

  return jsonb_build_object(
    'patients', v_patients,
    'totalCount', v_total_count
  );
end;
$$;

grant execute on function public.get_patients_page(text, uuid, integer, integer) to authenticated;
