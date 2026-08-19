-- Apply invoice discounts to the patient-result price buckets used by ristournes.

alter table public.invoice
  add column if not exists discount_price_source text not null default 'amo'
  check (discount_price_source in ('amo', 'normal'));

comment on column public.invoice.discount_price_source is
  'Patient-result price bucket reduced first by the invoice discount.';

-- Keep the existing implementations as internal transaction-safe building blocks.
alter function public.create_invoice_with_result(jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean, boolean)
  rename to create_invoice_with_result_base;

alter function public.update_invoice_with_result(uuid, jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean, boolean)
  rename to update_invoice_with_result_base;

create or replace function public.apply_invoice_discount_to_result(
  p_invoice_id uuid,
  p_discount_price_source text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoice%rowtype;
  v_result public.patient_result%rowtype;
  v_discount numeric(10,2);
  v_primary_discount numeric(10,2);
  v_remaining_discount numeric(10,2);
  v_normal_price numeric(10,2);
  v_insurance_price numeric(10,2);
begin
  if p_discount_price_source not in ('amo', 'normal') then
    raise exception 'Discount price source must be amo or normal';
  end if;

  select * into v_invoice
  from public.invoice
  where id = p_invoice_id;

  if not found then
    raise exception 'Invoice not found';
  end if;

  select * into v_result
  from public.patient_result
  where id = v_invoice.patient_result_id;

  if not found then
    raise exception 'Patient result not found';
  end if;

  v_discount := least(
    greatest(coalesce(v_invoice.discount_amount, 0), 0),
    greatest(coalesce(v_result.normal_price, 0), 0) +
      greatest(coalesce(v_result.insurance_price, 0), 0)
  );
  v_normal_price := greatest(coalesce(v_result.normal_price, 0), 0);
  v_insurance_price := greatest(coalesce(v_result.insurance_price, 0), 0);

  if p_discount_price_source = 'amo' then
    v_primary_discount := least(v_discount, v_insurance_price);
    v_insurance_price := v_insurance_price - v_primary_discount;
    v_remaining_discount := v_discount - v_primary_discount;
    v_normal_price := greatest(v_normal_price - v_remaining_discount, 0);
  else
    v_primary_discount := least(v_discount, v_normal_price);
    v_normal_price := v_normal_price - v_primary_discount;
    v_remaining_discount := v_discount - v_primary_discount;
    v_insurance_price := greatest(v_insurance_price - v_remaining_discount, 0);
  end if;

  update public.invoice
  set discount_price_source = p_discount_price_source
  where id = v_invoice.id;

  update public.patient_result
  set normal_price = v_normal_price,
      insurance_price = v_insurance_price,
      updated_at = now()
  where id = v_invoice.patient_result_id;
end;
$$;

create or replace function public.create_invoice_with_result(
  p_patient jsonb,
  p_doctor_id uuid,
  p_items jsonb,
  p_has_insurance boolean,
  p_discount_amount numeric,
  p_amount_paid numeric,
  p_notes text default null,
  p_is_free boolean default false,
  p_is_half_pay boolean default false,
  p_discount_price_source text default 'amo'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
begin
  v_invoice_id := public.create_invoice_with_result_base(
    p_patient,
    p_doctor_id,
    p_items,
    p_has_insurance,
    p_discount_amount,
    p_amount_paid,
    p_notes,
    p_is_free,
    p_is_half_pay
  );

  perform public.apply_invoice_discount_to_result(
    v_invoice_id,
    coalesce(p_discount_price_source, 'amo')
  );

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
  p_is_half_pay boolean default false,
  p_discount_price_source text default 'amo'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoice%rowtype;
  v_previous_normal_price numeric(10,2);
  v_previous_insurance_price numeric(10,2);
  v_has_active_ristourne boolean;
  v_invoice_id uuid;
  v_adjusted_result public.patient_result%rowtype;
begin
  select * into v_invoice
  from public.invoice
  where id = p_invoice_id;

  if not found then
    raise exception 'Invoice not found';
  end if;

  select normal_price, insurance_price
  into v_previous_normal_price, v_previous_insurance_price
  from public.patient_result
  where id = v_invoice.patient_result_id;

  select exists (
    select 1
    from public.ristourne_patient_result rpr
    join public.ristourne r on r.id = rpr.ristourne_id
    where rpr.patient_result_id = v_invoice.patient_result_id
      and r.status in ('paid', 'pending')
  ) into v_has_active_ristourne;

  v_invoice_id := public.update_invoice_with_result_base(
    p_invoice_id,
    p_patient,
    p_doctor_id,
    p_items,
    p_has_insurance,
    p_discount_amount,
    p_amount_paid,
    p_notes,
    p_is_free,
    p_is_half_pay
  );

  perform public.apply_invoice_discount_to_result(
    v_invoice_id,
    coalesce(p_discount_price_source, 'amo')
  );

  select * into v_adjusted_result
  from public.patient_result
  where id = v_invoice.patient_result_id;

  if v_has_active_ristourne and (
    coalesce(v_adjusted_result.normal_price, 0) is distinct from coalesce(v_previous_normal_price, 0)
    or coalesce(v_adjusted_result.insurance_price, 0) is distinct from coalesce(v_previous_insurance_price, 0)
  ) then
    raise exception 'Impossible de modifier la remise ou les prix: le résultat est déjà lié à une ristourne active.';
  end if;

  return v_invoice_id;
end;
$$;

revoke all on function public.create_invoice_with_result_base(jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean, boolean) from public, authenticated;
revoke all on function public.update_invoice_with_result_base(uuid, jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean, boolean) from public, authenticated;
revoke all on function public.apply_invoice_discount_to_result(uuid, text) from public, authenticated;
revoke all on function public.create_invoice_with_result(jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean, boolean, text) from public;
revoke all on function public.update_invoice_with_result(uuid, jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean, boolean, text) from public;

grant execute on function public.create_invoice_with_result(jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean, boolean, text) to authenticated;
grant execute on function public.update_invoice_with_result(uuid, jsonb, uuid, jsonb, boolean, numeric, numeric, text, boolean, boolean, text) to authenticated;
