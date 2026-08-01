create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
set search_path to 'public'
as $$
  select unaccent('public.unaccent'::regdictionary, $1)
$$;

create unique index if not exists subjects_user_name_unique
on public.subjects (user_id, lower(trim(immutable_unaccent(name))));
