create table if not exists public.settings (
  ristourne_access_code text
);

alter table public.settings
  add column if not exists invoice_ai_enabled boolean not null default true,
  add column if not exists invoice_ai_access_code text;

update public.settings
set
  invoice_ai_enabled = coalesce(invoice_ai_enabled, true),
  invoice_ai_access_code = coalesce(invoice_ai_access_code, 'AI2026');

insert into public.settings (
  invoice_ai_enabled,
  invoice_ai_access_code
)
select
  true,
  'AI2026'
where not exists (
  select 1 from public.settings
);
