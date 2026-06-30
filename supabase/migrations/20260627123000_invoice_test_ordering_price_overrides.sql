-- Invoice test availability flags and per-invoice price overrides.

alter table public.test_type
  add column if not exists is_active boolean not null default true,
  add column if not exists is_orderable boolean not null default true,
  add column if not exists include_in_invoice_description boolean not null default true;

update public.test_type
set is_active = true,
    is_orderable = true,
    include_in_invoice_description = true;

comment on column public.test_type.is_active is 'Whether this test type is active in the catalog.';
comment on column public.test_type.is_orderable is 'Whether this test type can be selected on new invoices.';
comment on column public.test_type.include_in_invoice_description is 'Whether no-parameter tests are added to patient result description during invoice creation.';

drop function if exists public.create_invoice_with_result(jsonb, uuid, jsonb, boolean, numeric, numeric, text);
drop function if exists public.update_invoice_with_result(uuid, jsonb, uuid, jsonb, boolean, numeric, numeric, text);
drop function if exists public.create_invoice_with_result(jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean);
drop function if exists public.update_invoice_with_result(uuid, jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean);

create or replace function public.create_invoice_with_result(
  p_patient jsonb,
  p_doctor_id uuid,
  p_items jsonb,
  p_has_insurance boolean,
  p_discount_amount numeric,
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
  v_patient_id uuid;
  v_patient_unique_id text;
  v_patient_result_id uuid;
  v_invoice_id uuid;
  v_invoice_item record;
  v_param record;
  v_param_count integer;
  v_pending_test_names text[] := array[]::text[];
  v_selected_test_type_ids uuid[];
  v_item_count integer;
  v_distinct_item_count integer;
  v_valid_test_count integer;
  v_normal_total numeric(10,2) := 0;
  v_insurance_total numeric(10,2) := 0;
  v_subtotal numeric(10,2) := 0;
  v_discount numeric(10,2) := greatest(coalesce(p_discount_amount, 0), 0);
  v_amount_paid numeric(10,2) := greatest(coalesce(p_amount_paid, 0), 0);
  v_total numeric(10,2);
  v_remaining numeric(10,2);
  v_payment_status text;
  v_price_source text;
begin
  if p_doctor_id is null then
    raise exception 'Doctor is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one test type is required';
  end if;

  if nullif(trim(coalesce(p_patient->>'patient_unique_id', '')), '') is null then
    raise exception 'Patient unique id is required';
  end if;

  if nullif(trim(coalesce(p_patient->>'full_name', '')), '') is null then
    raise exception 'Patient full name is required';
  end if;

  select count(*),
         count(distinct item.test_type_id),
         array_agg(item.test_type_id order by item.test_type_id)
  into v_item_count, v_distinct_item_count, v_selected_test_type_ids
  from jsonb_to_recordset(p_items) as item(test_type_id uuid, applied_price numeric);

  if v_item_count = 0 then
    raise exception 'At least one test type is required';
  end if;

  if v_distinct_item_count <> v_item_count then
    raise exception 'Duplicate test types are not allowed';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(test_type_id uuid, applied_price numeric)
    where item.test_type_id is null
      or item.applied_price is null
      or item.applied_price < 0
  ) then
    raise exception 'Every invoice item requires a valid test type and non-negative price';
  end if;

  select count(*)
  into v_valid_test_count
  from jsonb_to_recordset(p_items) as item(test_type_id uuid, applied_price numeric)
  join public.test_type tt on tt.id = item.test_type_id
  where tt.is_active = true
    and tt.is_orderable = true;

  if v_valid_test_count <> v_item_count then
    raise exception 'One or more selected tests are inactive or not orderable';
  end if;

  for v_invoice_item in
    select tt.*, item.applied_price as item_applied_price
    from jsonb_to_recordset(p_items) as item(test_type_id uuid, applied_price numeric)
    join public.test_type tt on tt.id = item.test_type_id
    order by tt.name
  loop
    if p_has_insurance and v_invoice_item.insurance_price is not null then
      v_insurance_total := v_insurance_total + v_invoice_item.item_applied_price;
    else
      v_normal_total := v_normal_total + v_invoice_item.item_applied_price;
    end if;

    v_subtotal := v_subtotal + v_invoice_item.item_applied_price;
  end loop;

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
    notes,
    "isFree"
  ) values (
    v_patient_id,
    p_doctor_id,
    now(),
    'pending',
    v_normal_total,
    v_insurance_total,
    v_remaining,
    'unpaid',
    p_notes,
    coalesce(p_is_free, false)
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

  for v_invoice_item in
    select tt.*, item.applied_price as item_applied_price
    from jsonb_to_recordset(p_items) as item(test_type_id uuid, applied_price numeric)
    join public.test_type tt on tt.id = item.test_type_id
    order by tt.name
  loop
    if p_has_insurance and v_invoice_item.insurance_price is not null then
      v_price_source := 'amo';
    else
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
      v_invoice_item.id,
      v_invoice_item.name,
      coalesce(v_invoice_item.normal_price, 0),
      v_invoice_item.insurance_price,
      v_invoice_item.item_applied_price,
      v_price_source
    );

    select count(*) into v_param_count
    from public.test_parameter
    where test_type_id = v_invoice_item.id;

    if v_param_count = 0 then
      if v_invoice_item.include_in_invoice_description then
        v_pending_test_names := array_append(v_pending_test_names, v_invoice_item.name);
      end if;
    else
      for v_param in
        select id
        from public.test_parameter
        where test_type_id = v_invoice_item.id
        order by "order", name
      loop
        insert into public.result_value (patient_result_id, test_parameter_id, value)
        values (v_patient_result_id, v_param.id, '0');
      end loop;
    end if;
  end loop;

  if array_length(v_pending_test_names, 1) is not null then
    update public.patient_result
    set description = 'NB: ' || array_to_string(v_pending_test_names, ', ') || ' en cours...'
    where id = v_patient_result_id;
  end if;

  return v_invoice_id;
end;
$$;

create or replace function public.update_invoice_with_result(
  p_invoice_id uuid,
  p_patient jsonb,
  p_doctor_id uuid,
  p_items jsonb,
  p_has_insurance boolean,
  p_discount_amount numeric,
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
  v_invoice public.invoice%rowtype;
  v_existing_patient_unique_id text;
  v_patient_unique_id text;
  v_invoice_item record;
  v_param record;
  v_param_count integer;
  v_pending_test_names text[] := array[]::text[];
  v_selected_test_type_ids uuid[];
  v_item_count integer;
  v_distinct_item_count integer;
  v_valid_test_count integer;
  v_normal_total numeric(10,2) := 0;
  v_insurance_total numeric(10,2) := 0;
  v_subtotal numeric(10,2) := 0;
  v_discount numeric(10,2) := greatest(coalesce(p_discount_amount, 0), 0);
  v_amount_paid numeric(10,2) := greatest(coalesce(p_amount_paid, 0), 0);
  v_total numeric(10,2);
  v_remaining numeric(10,2);
  v_payment_status text;
  v_price_source text;
  v_active_ristourne_link_count integer;
  v_removed_entered_result_value_count integer;
  v_affected_ristourne_ids uuid[] := array[]::uuid[];
begin
  select *
  into v_invoice
  from public.invoice
  where id = p_invoice_id;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if p_doctor_id is null then
    raise exception 'Doctor is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one test type is required';
  end if;

  if nullif(trim(coalesce(p_patient->>'patient_unique_id', '')), '') is null then
    raise exception 'Patient unique id is required';
  end if;

  if nullif(trim(coalesce(p_patient->>'full_name', '')), '') is null then
    raise exception 'Patient full name is required';
  end if;

  select count(*),
         count(distinct item.test_type_id),
         array_agg(item.test_type_id order by item.test_type_id)
  into v_item_count, v_distinct_item_count, v_selected_test_type_ids
  from jsonb_to_recordset(p_items) as item(test_type_id uuid, applied_price numeric);

  if v_item_count = 0 then
    raise exception 'At least one test type is required';
  end if;

  if v_distinct_item_count <> v_item_count then
    raise exception 'Duplicate test types are not allowed';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(test_type_id uuid, applied_price numeric)
    where item.test_type_id is null
      or item.applied_price is null
      or item.applied_price < 0
  ) then
    raise exception 'Every invoice item requires a valid test type and non-negative price';
  end if;

  select count(*)
  into v_valid_test_count
  from jsonb_to_recordset(p_items) as item(test_type_id uuid, applied_price numeric)
  join public.test_type tt on tt.id = item.test_type_id;

  if v_valid_test_count <> v_item_count then
    raise exception 'No valid test types were found';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(test_type_id uuid, applied_price numeric)
    join public.test_type tt on tt.id = item.test_type_id
    left join public.invoice_item existing_item
      on existing_item.invoice_id = v_invoice.id
     and existing_item.test_type_id = item.test_type_id
    where existing_item.id is null
      and (tt.is_active = false or tt.is_orderable = false)
  ) then
    raise exception 'One or more newly selected tests are inactive or not orderable';
  end if;

  select count(*)
  into v_active_ristourne_link_count
  from public.ristourne_patient_result rpr
  join public.ristourne r on r.id = rpr.ristourne_id
  where rpr.patient_result_id = v_invoice.patient_result_id
    and r.status in ('paid', 'pending');

  if v_active_ristourne_link_count > 0
    and p_doctor_id is distinct from v_invoice.doctor_id
    and coalesce(p_is_half_pay, false) = false then
    raise exception 'Impossible de modifier le médecin: le résultat est déjà lié à une ristourne active.';
  end if;

  select count(*)
  into v_removed_entered_result_value_count
  from public.invoice_item ii
  join public.test_parameter tp on tp.test_type_id = ii.test_type_id
  join public.result_value rv
    on rv.test_parameter_id = tp.id
   and rv.patient_result_id = v_invoice.patient_result_id
  where ii.invoice_id = v_invoice.id
    and not (ii.test_type_id = any(v_selected_test_type_ids))
    and trim(coalesce(rv.value, '')) not in ('', '0');

  if v_removed_entered_result_value_count > 0 then
    raise exception 'Impossible de retirer cet examen de la facture: des valeurs de résultat ont déjà été saisies. Veuillez d''abord corriger ou supprimer ces valeurs.';
  end if;

  for v_invoice_item in
    select tt.*, item.applied_price as item_applied_price
    from jsonb_to_recordset(p_items) as item(test_type_id uuid, applied_price numeric)
    join public.test_type tt on tt.id = item.test_type_id
    order by tt.name
  loop
    if p_has_insurance and v_invoice_item.insurance_price is not null then
      v_insurance_total := v_insurance_total + v_invoice_item.item_applied_price;
    else
      v_normal_total := v_normal_total + v_invoice_item.item_applied_price;
    end if;

    v_subtotal := v_subtotal + v_invoice_item.item_applied_price;
  end loop;

  v_discount := least(v_discount, v_subtotal);
  v_total := greatest(v_subtotal - v_discount, 0);
  v_remaining := greatest(v_total - v_amount_paid, 0);
  v_payment_status := case
    when v_total <= v_amount_paid then 'paid'
    when v_amount_paid > 0 then 'partial'
    else 'unpaid'
  end;

  select patient_unique_id
  into v_existing_patient_unique_id
  from public.patient
  where id = v_invoice.patient_id;

  if position('#' in trim(p_patient->>'patient_unique_id')) > 0 then
    v_patient_unique_id := trim(p_patient->>'patient_unique_id');
  elsif position('#' in coalesce(v_existing_patient_unique_id, '')) > 0 then
    v_patient_unique_id := trim(p_patient->>'patient_unique_id') || substring(v_existing_patient_unique_id from '#.*$');
  else
    v_patient_unique_id := trim(p_patient->>'patient_unique_id');
  end if;

  update public.patient
  set patient_unique_id = v_patient_unique_id,
      full_name = upper(trim(p_patient->>'full_name')),
      date_of_birth = nullif(p_patient->>'date_of_birth', '')::date,
      gender = nullif(p_patient->>'gender', ''),
      phone = nullif(trim(coalesce(p_patient->>'phone', '')), ''),
      updated_at = now()
  where id = v_invoice.patient_id;

  update public.patient_result
  set doctor_id = p_doctor_id,
      normal_price = v_normal_total,
      insurance_price = v_insurance_total,
      unpaid_amount = v_remaining,
      "isFree" = coalesce(p_is_free, false),
      notes = p_notes,
      updated_at = now()
  where id = v_invoice.patient_result_id;

  update public.invoice
  set doctor_id = p_doctor_id,
      has_insurance = coalesce(p_has_insurance, false),
      subtotal = v_subtotal,
      discount_amount = v_discount,
      total = v_total,
      amount_paid = v_amount_paid,
      remaining_amount = v_remaining,
      payment_status = v_payment_status,
      notes = p_notes,
      updated_at = now()
  where id = v_invoice.id;

  if coalesce(p_is_half_pay, false) then
    select coalesce(array_agg(distinct r.id), array[]::uuid[])
    into v_affected_ristourne_ids
    from public.ristourne_patient_result rpr
    join public.ristourne r on r.id = rpr.ristourne_id
    where rpr.patient_result_id = v_invoice.patient_result_id
      and r.status in ('paid', 'pending');

    delete from public.ristourne_patient_result rpr
    using public.ristourne r
    where r.id = rpr.ristourne_id
      and rpr.patient_result_id = v_invoice.patient_result_id
      and r.status in ('paid', 'pending');

    update public.ristourne r
    set total_fee = coalesce((
          select sum(rpr.fee_amount)
          from public.ristourne_patient_result rpr
          where rpr.ristourne_id = r.id
        ), 0),
        updated_at = now()
    where r.id = any(v_affected_ristourne_ids);

    update public.patient_result pr
    set paid_status = 'unpaid',
        updated_at = now()
    where pr.id = v_invoice.patient_result_id
      and not exists (
        select 1
        from public.ristourne_patient_result rpr
        join public.ristourne r on r.id = rpr.ristourne_id
        where rpr.patient_result_id = pr.id
          and r.status in ('paid', 'pending')
      );
  end if;

  delete from public.result_value rv
  using public.test_parameter tp
  where rv.test_parameter_id = tp.id
    and rv.patient_result_id = v_invoice.patient_result_id
    and trim(coalesce(rv.value, '')) in ('', '0')
    and exists (
      select 1
      from public.invoice_item ii
      where ii.invoice_id = v_invoice.id
        and ii.test_type_id = tp.test_type_id
    )
    and not (tp.test_type_id = any(v_selected_test_type_ids));

  delete from public.invoice_item
  where invoice_id = v_invoice.id;

  for v_invoice_item in
    select tt.*, item.applied_price as item_applied_price
    from jsonb_to_recordset(p_items) as item(test_type_id uuid, applied_price numeric)
    join public.test_type tt on tt.id = item.test_type_id
    order by tt.name
  loop
    if p_has_insurance and v_invoice_item.insurance_price is not null then
      v_price_source := 'amo';
    else
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
      v_invoice.id,
      v_invoice_item.id,
      v_invoice_item.name,
      coalesce(v_invoice_item.normal_price, 0),
      v_invoice_item.insurance_price,
      v_invoice_item.item_applied_price,
      v_price_source
    );

    select count(*)
    into v_param_count
    from public.test_parameter
    where test_type_id = v_invoice_item.id;

    if v_param_count = 0 then
      if v_invoice_item.include_in_invoice_description then
        v_pending_test_names := array_append(v_pending_test_names, v_invoice_item.name);
      end if;
    else
      for v_param in
        select id
        from public.test_parameter
        where test_type_id = v_invoice_item.id
        order by "order", name
      loop
        insert into public.result_value (patient_result_id, test_parameter_id, value)
        select v_invoice.patient_result_id, v_param.id, '0'
        where not exists (
          select 1
          from public.result_value rv
          where rv.patient_result_id = v_invoice.patient_result_id
            and rv.test_parameter_id = v_param.id
        );
      end loop;
    end if;
  end loop;

  if array_length(v_pending_test_names, 1) is not null then
    update public.patient_result
    set description = 'NB: ' || array_to_string(v_pending_test_names, ', ') || ' en cours...',
        updated_at = now()
    where id = v_invoice.patient_result_id;
  end if;

  return v_invoice.id;
end;
$$;

grant execute on function public.create_invoice_with_result(jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean, boolean) to authenticated;
grant execute on function public.update_invoice_with_result(uuid, jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean, boolean) to authenticated;
