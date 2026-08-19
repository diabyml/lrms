-- Draft invoices are deliberately separate from invoices and patient results.
-- This makes them ineligible for receipts, payments, reports, and ristournes.

create table public.invoice_draft (
  id uuid primary key default gen_random_uuid(),
  patient jsonb not null,
  doctor_id uuid not null references public.doctor(id) on delete restrict,
  has_insurance boolean not null default false,
  subtotal numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  discount_price_source text not null default 'amo'
    check (discount_price_source in ('amo', 'normal')),
  total numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  remaining_amount numeric(10,2) not null default 0,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partial', 'paid')),
  notes text,
  is_free boolean not null default false,
  is_half_pay boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoice_draft_item (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.invoice_draft(id) on delete cascade,
  test_type_id uuid not null references public.test_type(id) on delete restrict,
  applied_price numeric(10,2) not null check (applied_price >= 0),
  unique (draft_id, test_type_id)
);

create index idx_invoice_draft_updated_at on public.invoice_draft(updated_at desc);
create index idx_invoice_draft_doctor_updated on public.invoice_draft(doctor_id, updated_at desc);
create index idx_invoice_draft_item_draft on public.invoice_draft_item(draft_id);

alter table public.invoice_draft enable row level security;
alter table public.invoice_draft_item enable row level security;

create policy "Authenticated users manage invoice drafts"
  on public.invoice_draft for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users manage invoice draft items"
  on public.invoice_draft_item for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create or replace function public.save_invoice_draft(
  p_draft_id uuid,
  p_patient jsonb,
  p_doctor_id uuid,
  p_items jsonb,
  p_has_insurance boolean,
  p_discount_amount numeric,
  p_discount_price_source text,
  p_amount_paid numeric,
  p_notes text default null,
  p_is_free boolean default false,
  p_is_half_pay boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_id uuid;
  v_item_count integer;
  v_distinct_count integer;
  v_valid_count integer;
  v_subtotal numeric(10,2);
  v_discount numeric(10,2);
  v_total numeric(10,2);
  v_paid numeric(10,2);
  v_remaining numeric(10,2);
  v_status text;
begin
  if nullif(trim(coalesce(p_patient->>'full_name', '')), '') is null then
    raise exception 'Patient full name is required';
  end if;
  if p_doctor_id is null then raise exception 'Doctor is required'; end if;
  if p_discount_price_source not in ('amo', 'normal') then
    raise exception 'Discount price source must be amo or normal';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one test type is required';
  end if;

  select count(*), count(distinct x.test_type_id), coalesce(sum(x.applied_price), 0)
  into v_item_count, v_distinct_count, v_subtotal
  from jsonb_to_recordset(p_items) x(test_type_id uuid, applied_price numeric);

  if v_item_count <> v_distinct_count or exists (
    select 1 from jsonb_to_recordset(p_items) x(test_type_id uuid, applied_price numeric)
    where x.test_type_id is null or x.applied_price is null or x.applied_price < 0
  ) then
    raise exception 'Draft items must be unique and have non-negative prices';
  end if;

  select count(*) into v_valid_count
  from jsonb_to_recordset(p_items) x(test_type_id uuid, applied_price numeric)
  join public.test_type tt on tt.id = x.test_type_id
  where tt.is_active and tt.is_orderable;
  if v_valid_count <> v_item_count then
    raise exception 'One or more selected tests are inactive or not orderable';
  end if;

  v_discount := least(greatest(coalesce(p_discount_amount, 0), 0), v_subtotal);
  v_total := greatest(v_subtotal - v_discount, 0);
  v_paid := greatest(coalesce(p_amount_paid, 0), 0);
  v_remaining := greatest(v_total - v_paid, 0);
  v_status := case when v_paid >= v_total then 'paid' when v_paid > 0 then 'partial' else 'unpaid' end;

  if p_draft_id is null then
    insert into public.invoice_draft (
      patient, doctor_id, has_insurance, subtotal, discount_amount,
      discount_price_source, total, amount_paid, remaining_amount,
      payment_status, notes, is_free, is_half_pay
    ) values (
      p_patient, p_doctor_id, coalesce(p_has_insurance, false), v_subtotal,
      v_discount, p_discount_price_source, v_total, v_paid, v_remaining,
      v_status, p_notes, coalesce(p_is_free, false), coalesce(p_is_half_pay, false)
    ) returning id into v_draft_id;
  else
    update public.invoice_draft set
      patient = p_patient, doctor_id = p_doctor_id,
      has_insurance = coalesce(p_has_insurance, false), subtotal = v_subtotal,
      discount_amount = v_discount, discount_price_source = p_discount_price_source,
      total = v_total, amount_paid = v_paid, remaining_amount = v_remaining,
      payment_status = v_status, notes = p_notes,
      is_free = coalesce(p_is_free, false), is_half_pay = coalesce(p_is_half_pay, false),
      updated_at = now()
    where id = p_draft_id returning id into v_draft_id;
    if v_draft_id is null then raise exception 'Draft not found'; end if;
    delete from public.invoice_draft_item where draft_id = v_draft_id;
  end if;

  insert into public.invoice_draft_item (draft_id, test_type_id, applied_price)
  select v_draft_id, x.test_type_id, x.applied_price
  from jsonb_to_recordset(p_items) x(test_type_id uuid, applied_price numeric);
  return v_draft_id;
end;
$$;

create or replace function public.finalize_invoice_draft(
  p_draft_id uuid,
  p_patient_unique_id text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.invoice_draft%rowtype;
  v_items jsonb;
  v_invoice_id uuid;
begin
  if trim(coalesce(p_patient_unique_id, '')) !~ '^0[0-9]+-[0-9]{2}-[0-9]{4}$' then
    raise exception 'A valid generated patient ID is required to finalize the draft';
  end if;

  select * into v_draft from public.invoice_draft where id = p_draft_id for update;
  if not found then raise exception 'Draft not found or already finalized'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'test_type_id', di.test_type_id,
    'applied_price', di.applied_price
  ) order by tt.name), '[]'::jsonb)
  into v_items
  from public.invoice_draft_item di
  join public.test_type tt on tt.id = di.test_type_id
  where di.draft_id = v_draft.id;

  v_invoice_id := public.create_invoice_with_result(
    v_draft.patient || jsonb_build_object('patient_unique_id', trim(p_patient_unique_id)),
    v_draft.doctor_id, v_items, v_draft.has_insurance,
    v_draft.discount_amount, v_draft.amount_paid, v_draft.notes,
    v_draft.is_free, v_draft.is_half_pay, v_draft.discount_price_source
  );

  delete from public.invoice_draft where id = v_draft.id;
  return v_invoice_id;
end;
$$;

create or replace function public.delete_invoice_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.invoice_draft where id = p_draft_id;
  if not found then raise exception 'Draft not found'; end if;
end;
$$;

create or replace function public.get_invoice_drafts_page(
  p_search text default null,
  p_doctor_id uuid default null,
  p_start_date date default null,
  p_end_date date default null,
  p_page integer default 1,
  p_page_size integer default 10
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := least(greatest(coalesce(p_page_size, 10), 1), 100);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_rows jsonb;
  v_count bigint;
begin
  with filtered as (
    select d.id, d.created_at, d.updated_at, d.total, d.amount_paid,
      d.remaining_amount, d.payment_status,
      jsonb_build_object('full_name', d.patient->>'full_name', 'phone', d.patient->>'phone') patient,
      jsonb_build_object('full_name', doc.full_name) doctor
    from public.invoice_draft d join public.doctor doc on doc.id = d.doctor_id
    where (v_search is null or d.patient->>'full_name' ilike '%' || v_search || '%'
      or coalesce(d.patient->>'phone', '') ilike '%' || v_search || '%')
      and (p_doctor_id is null or d.doctor_id = p_doctor_id)
      and (p_start_date is null or d.updated_at >= p_start_date::timestamp)
      and (p_end_date is null or d.updated_at < (p_end_date + 1)::timestamp)
  ), counted as (select count(*) total_count from filtered),
  paged as (select * from filtered order by updated_at desc, id desc
    offset (v_page - 1) * v_size limit v_size)
  select coalesce(jsonb_agg(to_jsonb(paged) order by updated_at desc) filter (where paged.id is not null), '[]'::jsonb),
    coalesce(max(counted.total_count), 0)
  into v_rows, v_count from counted left join paged on true;
  return jsonb_build_object('drafts', v_rows, 'totalCount', v_count);
end;
$$;

revoke all on function public.save_invoice_draft(uuid,jsonb,uuid,jsonb,boolean,numeric,text,numeric,text,boolean,boolean) from public;
revoke all on function public.finalize_invoice_draft(uuid,text) from public;
revoke all on function public.delete_invoice_draft(uuid) from public;
revoke all on function public.get_invoice_drafts_page(text,uuid,date,date,integer,integer) from public;
grant execute on function public.save_invoice_draft(uuid,jsonb,uuid,jsonb,boolean,numeric,text,numeric,text,boolean,boolean) to authenticated;
grant execute on function public.finalize_invoice_draft(uuid,text) to authenticated;
grant execute on function public.delete_invoice_draft(uuid) to authenticated;
grant execute on function public.get_invoice_drafts_page(text,uuid,date,date,integer,integer) to authenticated;
