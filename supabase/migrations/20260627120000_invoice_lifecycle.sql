-- Transactional invoice lifecycle helpers.

create or replace function public.cancel_invoice_with_result(
  p_invoice_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoice%rowtype;
  v_patient_result_count integer;
  v_entered_result_value_count integer;
  v_active_ristourne_link_count integer;
begin
  select *
  into v_invoice
  from public.invoice
  where id = p_invoice_id;

  if not found then
    raise exception 'Invoice not found';
  end if;

  select count(*)
  into v_patient_result_count
  from public.patient_result
  where patient_id = v_invoice.patient_id;

  if v_patient_result_count > 1 then
    raise exception 'Cannot cancel invoice because the linked patient has other results';
  end if;

  select count(*)
  into v_entered_result_value_count
  from public.result_value
  where patient_result_id = v_invoice.patient_result_id
    and trim(coalesce(value, '')) not in ('', '0');

  if v_entered_result_value_count > 0 then
    raise exception 'Impossible d''annuler cette facture: des valeurs de résultat ont déjà été saisies. Veuillez d''abord corriger ou supprimer ces valeurs avant d''annuler.';
  end if;

  select count(*)
  into v_active_ristourne_link_count
  from public.ristourne_patient_result rpr
  join public.ristourne r on r.id = rpr.ristourne_id
  where rpr.patient_result_id = v_invoice.patient_result_id
    and r.status in ('paid', 'pending');

  if v_active_ristourne_link_count > 0 then
    raise exception 'Impossible d''annuler cette facture: le résultat est déjà lié à une ristourne active.';
  end if;

  delete from public.invoice
  where id = v_invoice.id;

  delete from public.ristourne_patient_result
  where patient_result_id = v_invoice.patient_result_id;

  delete from public.patient_hemoculture_observation
  where patient_result_id = v_invoice.patient_result_id;

  delete from public.patient_antibiogram_set
  where patient_result_id = v_invoice.patient_result_id;

  delete from public.result_value
  where patient_result_id = v_invoice.patient_result_id;

  delete from public.patient_result
  where id = v_invoice.patient_result_id;

  delete from public.patient
  where id = v_invoice.patient_id;
end;
$$;

create or replace function public.pay_invoice_remaining(
  p_invoice_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoice%rowtype;
begin
  select *
  into v_invoice
  from public.invoice
  where id = p_invoice_id;

  if not found then
    raise exception 'Invoice not found';
  end if;

  update public.invoice
  set amount_paid = total,
      remaining_amount = 0,
      payment_status = 'paid',
      updated_at = now()
  where id = p_invoice_id;

  update public.patient_result
  set unpaid_amount = 0,
      updated_at = now()
  where id = v_invoice.patient_result_id;
end;
$$;

create or replace function public.update_invoice_with_result(
  p_invoice_id uuid,
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
  v_invoice public.invoice%rowtype;
  v_existing_patient_unique_id text;
  v_patient_unique_id text;
  v_test_type public.test_type%rowtype;
  v_param record;
  v_param_count integer;
  v_pending_test_names text[] := array[]::text[];
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
  v_active_ristourne_link_count integer;
  v_removed_entered_result_value_count integer;
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

  if p_test_type_ids is null or array_length(p_test_type_ids, 1) is null then
    raise exception 'At least one test type is required';
  end if;

  if nullif(trim(coalesce(p_patient->>'patient_unique_id', '')), '') is null then
    raise exception 'Patient unique id is required';
  end if;

  if nullif(trim(coalesce(p_patient->>'full_name', '')), '') is null then
    raise exception 'Patient full name is required';
  end if;

  select count(*)
  into v_active_ristourne_link_count
  from public.ristourne_patient_result rpr
  join public.ristourne r on r.id = rpr.ristourne_id
  where rpr.patient_result_id = v_invoice.patient_result_id
    and r.status in ('paid', 'pending');

  if v_active_ristourne_link_count > 0 and p_doctor_id is distinct from v_invoice.doctor_id then
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
    and not (ii.test_type_id = any(p_test_type_ids))
    and trim(coalesce(rv.value, '')) not in ('', '0');

  if v_removed_entered_result_value_count > 0 then
    raise exception 'Impossible de retirer cet examen de la facture: des valeurs de résultat ont déjà été saisies. Veuillez d''abord corriger ou supprimer ces valeurs.';
  end if;

  for v_test_type in
    select *
    from public.test_type
    where id = any(p_test_type_ids)
    order by name
  loop
    if p_has_insurance and v_test_type.insurance_price is not null then
      v_applied_price := coalesce(v_test_type.insurance_price, 0);
      v_insurance_total := v_insurance_total + v_applied_price;
    else
      v_applied_price := coalesce(v_test_type.normal_price, 0);
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
    and not (tp.test_type_id = any(p_test_type_ids));

  delete from public.invoice_item
  where invoice_id = v_invoice.id;

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
      v_invoice.id,
      v_test_type.id,
      v_test_type.name,
      coalesce(v_test_type.normal_price, 0),
      v_test_type.insurance_price,
      v_applied_price,
      v_price_source
    );

    select count(*)
    into v_param_count
    from public.test_parameter
    where test_type_id = v_test_type.id;

    if v_param_count = 0 then
      v_pending_test_names := array_append(v_pending_test_names, v_test_type.name);
    else
      for v_param in
        select id
        from public.test_parameter
        where test_type_id = v_test_type.id
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

grant execute on function public.cancel_invoice_with_result(uuid) to authenticated;
grant execute on function public.pay_invoice_remaining(uuid) to authenticated;
grant execute on function public.update_invoice_with_result(uuid, jsonb, uuid, uuid[], boolean, numeric, numeric, text) to authenticated;
