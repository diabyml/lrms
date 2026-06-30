-- Public receipt verification by QR code.

alter table public.invoice
  add column if not exists verification_token text;

update public.invoice
set verification_token = replace(gen_random_uuid()::text, '-', '')
where verification_token is null
   or nullif(trim(verification_token), '') is null;

alter table public.invoice
  alter column verification_token set default replace(gen_random_uuid()::text, '-', ''),
  alter column verification_token set not null;

create unique index if not exists idx_invoice_verification_token
  on public.invoice(verification_token);

create or replace function public.verify_invoice_receipt(
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if nullif(trim(coalesce(p_token, '')), '') is null then
    return null;
  end if;

  select jsonb_build_object(
    'invoice_number', i.invoice_number,
    'created_at', i.created_at,
    'total', i.total,
    'payment_status', i.payment_status,
    'patient_reference', nullif(split_part(coalesce(p.patient_unique_id, ''), '#', 1), ''),
    'patient_initials', nullif((
      select string_agg(upper(left(name_part.part, 1)), '.')
      from regexp_split_to_table(trim(coalesce(p.full_name, '')), '\s+') as name_part(part)
      where name_part.part <> ''
    ), '')
  )
  into v_result
  from public.invoice i
  left join public.patient p on p.id = i.patient_id
  where i.verification_token = trim(p_token)
  limit 1;

  return v_result;
end;
$$;

grant execute on function public.verify_invoice_receipt(text) to anon;
grant execute on function public.verify_invoice_receipt(text) to authenticated;
