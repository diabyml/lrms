-- Safer and faster ristourne form helpers.

create index if not exists idx_ristourne_patient_result_result_ristourne
  on public.ristourne_patient_result(patient_result_id, ristourne_id);

create index if not exists idx_patient_result_doctor_paid_date
  on public.patient_result(doctor_id, paid_status, result_date desc);

create or replace function public.get_ristourne_form_results(
  p_doctor_id uuid,
  p_ristourne_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_results jsonb;
begin
  if p_doctor_id is null then
    raise exception 'Doctor is required';
  end if;

  select coalesce(
    jsonb_agg(
      to_jsonb(pr) ||
      jsonb_build_object(
        'patient', to_jsonb(p),
        'fee_amount', current_rpr.fee_amount,
        'isSelected', current_rpr.patient_result_id is not null,
        'isSelectedInitial', current_rpr.patient_result_id is not null
      )
      order by pr.result_date desc nulls last, pr.created_at desc, pr.id desc
    ),
    '[]'::jsonb
  )
  into v_results
  from public.patient_result pr
  join public.patient p on p.id = pr.patient_id
  left join public.ristourne_patient_result current_rpr
    on current_rpr.patient_result_id = pr.id
   and current_rpr.ristourne_id = p_ristourne_id
  where pr.doctor_id = p_doctor_id
    and coalesce(pr."isFree", false) = false
    and not exists (
      select 1
      from public.invoice i
      where i.patient_result_id = pr.id
        and coalesce(pr."isFree", false) = false
        and coalesce(i.subtotal, 0) > 0
        and abs(coalesce(i.discount_amount, 0) - (coalesce(i.subtotal, 0) / 2)) < 0.01
        and abs(coalesce(i.total, 0) - (coalesce(i.subtotal, 0) / 2)) < 0.01
    )
    and (
      pr.paid_status = 'unpaid'
      or current_rpr.patient_result_id is not null
    )
    and not exists (
      select 1
      from public.ristourne_patient_result rpr
      join public.ristourne r on r.id = rpr.ristourne_id
      where rpr.patient_result_id = pr.id
        and rpr.ristourne_id is distinct from p_ristourne_id
        and r.status in ('paid', 'pending')
    );

  return v_results;
end;
$$;

drop function if exists public.handle_ristourne_upsert(uuid, uuid, text, numeric, text, jsonb);

create or replace function public.handle_ristourne_upsert(
  p_ristourne_id uuid,
  p_doctor_id uuid,
  p_notes text,
  p_total_fee numeric,
  p_status text,
  p_patient_results jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ristourne_id uuid;
  v_new_result_ids uuid[];
  v_old_result_ids uuid[];
begin
  if p_doctor_id is null then
    raise exception 'Doctor is required';
  end if;

  if p_status is null or p_status not in ('paid', 'pending', 'cancelled') then
    raise exception 'Invalid ristourne status';
  end if;

  if p_patient_results is null
    or jsonb_typeof(p_patient_results) <> 'array'
    or jsonb_array_length(p_patient_results) = 0 then
    raise exception 'At least one patient result is required';
  end if;

  select coalesce(array_agg(distinct x.patient_result_id), array[]::uuid[])
  into v_new_result_ids
  from jsonb_to_recordset(p_patient_results) as x(
    patient_result_id uuid,
    fee_amount numeric
  );

  if p_ristourne_id is null then
    insert into public.ristourne (
      doctor_id,
      notes,
      total_fee,
      status
    ) values (
      p_doctor_id,
      p_notes,
      greatest(coalesce(p_total_fee, 0), 0),
      p_status
    )
    returning id into v_ristourne_id;
  else
    select id
    into v_ristourne_id
    from public.ristourne
    where id = p_ristourne_id
    for update;

    if not found then
      raise exception 'Ristourne not found';
    end if;

    select coalesce(array_agg(patient_result_id), array[]::uuid[])
    into v_old_result_ids
    from public.ristourne_patient_result
    where ristourne_id = v_ristourne_id;

    update public.patient_result pr
    set paid_status = 'unpaid'
    where pr.id = any(v_old_result_ids)
      and not (pr.id = any(v_new_result_ids))
      and not exists (
        select 1
        from public.ristourne_patient_result rpr
        join public.ristourne r on r.id = rpr.ristourne_id
        where rpr.patient_result_id = pr.id
          and rpr.ristourne_id <> v_ristourne_id
          and r.status in ('paid', 'pending')
      );

    delete from public.ristourne_patient_result
    where ristourne_id = v_ristourne_id
      and not (patient_result_id = any(v_new_result_ids));

    update public.ristourne
    set
      doctor_id = p_doctor_id,
      notes = p_notes,
      total_fee = greatest(coalesce(p_total_fee, 0), 0),
      status = p_status
    where id = v_ristourne_id;
  end if;

  if exists (
    select 1
    from public.patient_result pr
    where pr.id = any(v_new_result_ids)
      and pr.doctor_id <> p_doctor_id
  ) then
    raise exception 'All selected results must belong to the selected doctor';
  end if;

  if exists (
    select 1
    from public.patient_result pr
    where pr.id = any(v_new_result_ids)
      and coalesce(pr."isFree", false) = true
  ) then
    raise exception 'Free patient results cannot be added to a ristourne';
  end if;

  if exists (
    select 1
    from public.patient_result pr
    join public.invoice i on i.patient_result_id = pr.id
    where pr.id = any(v_new_result_ids)
      and coalesce(pr."isFree", false) = false
      and coalesce(i.subtotal, 0) > 0
      and abs(coalesce(i.discount_amount, 0) - (coalesce(i.subtotal, 0) / 2)) < 0.01
      and abs(coalesce(i.total, 0) - (coalesce(i.subtotal, 0) / 2)) < 0.01
  ) then
    raise exception 'Demi tarif patient results cannot be added to a ristourne';
  end if;

  if exists (
    select 1
    from public.ristourne_patient_result rpr
    join public.ristourne r on r.id = rpr.ristourne_id
    where rpr.patient_result_id = any(v_new_result_ids)
      and rpr.ristourne_id is distinct from v_ristourne_id
      and r.status in ('paid', 'pending')
  ) then
    raise exception 'One or more selected results are already linked to another active ristourne';
  end if;

  insert into public.ristourne_patient_result (
    ristourne_id,
    patient_result_id,
    fee_amount
  )
  select
    v_ristourne_id,
    x.patient_result_id,
    greatest(coalesce(x.fee_amount, 0), 0)
  from jsonb_to_recordset(p_patient_results) as x(
    patient_result_id uuid,
    fee_amount numeric
  )
  on conflict (ristourne_id, patient_result_id)
  do update set fee_amount = excluded.fee_amount;

  update public.patient_result
  set paid_status = case when p_status in ('paid', 'pending') then 'paid' else 'unpaid' end
  where id = any(v_new_result_ids);

  return v_ristourne_id;
end;
$$;

grant execute on function public.get_ristourne_form_results(uuid, uuid) to authenticated;
grant execute on function public.handle_ristourne_upsert(uuid, uuid, text, numeric, text, jsonb) to authenticated;
