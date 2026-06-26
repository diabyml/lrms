-- Invoice/facture system with AMO-aware pricing.

alter table public.test_type
  add column if not exists normal_price numeric(10,2) not null default 0,
  add column if not exists insurance_price numeric(10,2);

alter table public.test_parameter
  add column if not exists "order" integer not null default 0;

alter table public.patient_result
  add column if not exists "isFree" boolean default false,
  add column if not exists notes text,
  add column if not exists unpaid_amount numeric(10,2);

comment on column public.test_type.normal_price is 'Default normal price used when creating invoices.';
comment on column public.test_type.insurance_price is 'Default AMO/insurance price. Null means not covered.';

create sequence if not exists public.invoice_number_seq;

create table if not exists public.invoice (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default (
    'FAC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.invoice_number_seq')::text, 5, '0')
  ),
  patient_id uuid not null references public.patient(id) on delete restrict,
  doctor_id uuid not null references public.doctor(id) on delete restrict,
  patient_result_id uuid not null references public.patient_result(id) on delete restrict,
  has_insurance boolean not null default false,
  subtotal numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  remaining_amount numeric(10,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.invoice_item (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoice(id) on delete cascade,
  test_type_id uuid not null references public.test_type(id) on delete restrict,
  test_name text not null,
  normal_price numeric(10,2) not null default 0,
  insurance_price numeric(10,2),
  applied_price numeric(10,2) not null default 0,
  price_source text not null check (price_source in ('normal', 'amo')),
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_invoice_created_at on public.invoice(created_at desc);
create index if not exists idx_invoice_patient_id on public.invoice(patient_id);
create index if not exists idx_invoice_doctor_id on public.invoice(doctor_id);
create index if not exists idx_invoice_patient_result_id on public.invoice(patient_result_id);
create index if not exists idx_invoice_item_invoice_id on public.invoice_item(invoice_id);
create index if not exists idx_invoice_item_test_type_id on public.invoice_item(test_type_id);

alter table public.invoice enable row level security;
alter table public.invoice_item enable row level security;

drop policy if exists "Allow all access for authenticated users" on public.invoice;
create policy "Allow all access for authenticated users" on public.invoice
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "Allow all access for authenticated users" on public.invoice_item;
create policy "Allow all access for authenticated users" on public.invoice_item
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create or replace function public.create_invoice_with_result(
  p_patient jsonb,
  p_doctor_id uuid,
  p_test_type_ids uuid[],
  p_has_insurance boolean,
  p_discount_amount numeric,
  p_amount_paid numeric,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_patient_unique_id text;
  v_patient_result_id uuid;
  v_invoice_id uuid;
  v_test_type public.test_type%rowtype;
  v_param record;
  v_param_id uuid;
  v_param_count integer;
  v_normal_total numeric(10,2) := 0;
  v_insurance_total numeric(10,2) := 0;
  v_subtotal numeric(10,2) := 0;
  v_discount numeric(10,2) := greatest(coalesce(p_discount_amount, 0), 0);
  v_amount_paid numeric(10,2) := greatest(coalesce(p_amount_paid, 0), 0);
  v_total numeric(10,2);
  v_remaining numeric(10,2);
  v_payment_status text;
  v_applied_price numeric(10,2);
  v_price_source text;
begin
  if p_doctor_id is null then
    raise exception 'Doctor is required';
  end if;

  if p_test_type_ids is null or array_length(p_test_type_ids, 1) is null then
    raise exception 'At least one test type is required';
  end if;

  if nullif(trim(coalesce(p_patient->>'patient_unique_id', '')), '') is null then
    raise exception 'Patient unique id is required';
  end if;

  if nullif(trim(coalesce(p_patient->>'full_name', '')), '') is null then
    raise exception 'Patient full name is required';
  end if;

  for v_test_type in
    select *
    from public.test_type
    where id = any(p_test_type_ids)
    order by name
  loop
    if p_has_insurance and v_test_type.insurance_price is not null then
      v_applied_price := coalesce(v_test_type.insurance_price, 0);
      v_price_source := 'amo';
      v_insurance_total := v_insurance_total + v_applied_price;
    else
      v_applied_price := coalesce(v_test_type.normal_price, 0);
      v_price_source := 'normal';
      v_normal_total := v_normal_total + v_applied_price;
    end if;

    v_subtotal := v_subtotal + v_applied_price;
  end loop;

  if not found then
    raise exception 'No valid test types were found';
  end if;

  v_discount := least(v_discount, v_subtotal);
  v_total := greatest(v_subtotal - v_discount, 0);
  v_remaining := greatest(v_total - v_amount_paid, 0);
  v_payment_status := case
    when v_total <= v_amount_paid then 'paid'
    when v_amount_paid > 0 then 'partial'
    else 'unpaid'
  end;

  v_patient_unique_id := trim(p_patient->>'patient_unique_id') || '#' || gen_random_uuid()::text;

  insert into public.patient (
    patient_unique_id,
    full_name,
    date_of_birth,
    gender,
    phone
  ) values (
    v_patient_unique_id,
    upper(trim(p_patient->>'full_name')),
    nullif(p_patient->>'date_of_birth', '')::date,
    nullif(p_patient->>'gender', ''),
    nullif(trim(coalesce(p_patient->>'phone', '')), '')
  )
  returning id into v_patient_id;

  insert into public.patient_result (
    patient_id,
    doctor_id,
    result_date,
    status,
    normal_price,
    insurance_price,
    unpaid_amount,
    paid_status,
    notes
  ) values (
    v_patient_id,
    p_doctor_id,
    now(),
    'pending',
    v_normal_total,
    v_insurance_total,
    v_remaining,
    'unpaid',
    p_notes
  )
  returning id into v_patient_result_id;

  insert into public.invoice (
    patient_id,
    doctor_id,
    patient_result_id,
    has_insurance,
    subtotal,
    discount_amount,
    total,
    amount_paid,
    remaining_amount,
    payment_status,
    notes
  ) values (
    v_patient_id,
    p_doctor_id,
    v_patient_result_id,
    coalesce(p_has_insurance, false),
    v_subtotal,
    v_discount,
    v_total,
    v_amount_paid,
    v_remaining,
    v_payment_status,
    p_notes
  )
  returning id into v_invoice_id;

  for v_test_type in
    select *
    from public.test_type
    where id = any(p_test_type_ids)
    order by name
  loop
    if p_has_insurance and v_test_type.insurance_price is not null then
      v_applied_price := coalesce(v_test_type.insurance_price, 0);
      v_price_source := 'amo';
    else
      v_applied_price := coalesce(v_test_type.normal_price, 0);
      v_price_source := 'normal';
    end if;

    insert into public.invoice_item (
      invoice_id,
      test_type_id,
      test_name,
      normal_price,
      insurance_price,
      applied_price,
      price_source
    ) values (
      v_invoice_id,
      v_test_type.id,
      v_test_type.name,
      coalesce(v_test_type.normal_price, 0),
      v_test_type.insurance_price,
      v_applied_price,
      v_price_source
    );

    select count(*) into v_param_count
    from public.test_parameter
    where test_type_id = v_test_type.id;

    if v_param_count = 0 then
      insert into public.test_parameter (test_type_id, name, "order")
      values (v_test_type.id, v_test_type.name, 0)
      returning id into v_param_id;

      insert into public.result_value (patient_result_id, test_parameter_id, value)
      values (v_patient_result_id, v_param_id, '0');
    else
      for v_param in
        select id
        from public.test_parameter
        where test_type_id = v_test_type.id
        order by "order", name
      loop
        insert into public.result_value (patient_result_id, test_parameter_id, value)
        values (v_patient_result_id, v_param.id, '0');
      end loop;
    end if;
  end loop;

  return v_invoice_id;
end;
$$;

grant execute on function public.create_invoice_with_result(jsonb, uuid, uuid[], boolean, numeric, numeric, text) to authenticated;
