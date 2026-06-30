-- Optional unique test code used for fast invoice selection.

alter table public.test_type
  add column if not exists code text;

update public.test_type
set code = null
where code is not null
  and nullif(trim(code), '') is null;

create unique index if not exists test_type_code_normalized_key
  on public.test_type (lower(trim(code)))
  where nullif(trim(code), '') is not null;

comment on column public.test_type.code is 'Optional unique code used to identify and select a test type.';
