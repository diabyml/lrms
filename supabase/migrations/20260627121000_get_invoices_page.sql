-- Fast server-side invoice list pagination/search/filter.

create extension if not exists pg_trgm with schema public;

create index if not exists idx_invoice_created_at_desc
  on public.invoice(created_at desc);

create index if not exists idx_invoice_doctor_created_at
  on public.invoice(doctor_id, created_at desc);

create index if not exists idx_invoice_number_trgm
  on public.invoice using gin (invoice_number gin_trgm_ops);

create index if not exists idx_patient_full_name_trgm
  on public.patient using gin (full_name gin_trgm_ops);

create index if not exists idx_patient_unique_id_trgm
  on public.patient using gin (patient_unique_id gin_trgm_ops);

create or replace function public.get_invoices_page(
  p_search text default null,
  p_doctor_id uuid default null,
  p_start_date date default null,
  p_end_date date default null,
  p_page integer default 1,
  p_page_size integer default 10
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 100);
  v_offset integer;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_pattern text;
  v_invoices jsonb;
  v_total_count bigint;
begin
  v_offset := (v_page - 1) * v_page_size;
  v_pattern := case when v_search is null then null else '%' || v_search || '%' end;

  with filtered as (
    select
      i.id,
      i.invoice_number,
      i.created_at,
      i.total,
      i.amount_paid,
      i.remaining_amount,
      i.payment_status,
      jsonb_build_object(
        'full_name', p.full_name,
        'patient_unique_id', p.patient_unique_id
      ) as patient,
      jsonb_build_object(
        'full_name', d.full_name
      ) as doctor
    from public.invoice i
    join public.patient p on p.id = i.patient_id
    join public.doctor d on d.id = i.doctor_id
    where (
      v_search is null
      or i.invoice_number ilike v_pattern
      or p.full_name ilike v_pattern
      or p.patient_unique_id ilike v_pattern
    )
    and (
      p_doctor_id is null
      or i.doctor_id = p_doctor_id
    )
    and (
      p_start_date is null
      or i.created_at >= p_start_date::timestamp
    )
    and (
      p_end_date is null
      or i.created_at < (p_end_date + 1)::timestamp
    )
  ),
  counted as (
    select count(*) as total_count
    from filtered
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, invoice_number desc, id desc
    offset v_offset
    limit v_page_size
  )
  select
    coalesce(
      jsonb_agg(to_jsonb(paged) order by paged.created_at desc, paged.invoice_number desc, paged.id desc)
        filter (where paged.id is not null),
      '[]'::jsonb
    ),
    coalesce(max(counted.total_count), 0)
  into v_invoices, v_total_count
  from counted
  left join paged on true;

  return jsonb_build_object(
    'invoices', v_invoices,
    'totalCount', v_total_count
  );
end;
$$;

grant execute on function public.get_invoices_page(text, uuid, date, date, integer, integer) to authenticated;
