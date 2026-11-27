-- CV Ready: initial schema
-- Run with the Supabase CLI (`supabase db push`) or paste into the Supabase SQL editor.
--
-- Security model: the bot server talks to Supabase with the service-role key, which bypasses RLS.
-- RLS is switched ON with no policies, so the public anon key can read/write nothing.

create table public.users (
  id                     uuid primary key default gen_random_uuid(),
  wa_id                  text not null unique,          -- WhatsApp number, digits only (needed to message them)
  preferred_language     text,                          -- what they chose, e.g. 'st'
  ui_language            text not null default 'en',    -- what the bot replies in
  consent_version        text,
  consented_at           timestamptz,
  references_on_request  boolean not null default false,
  completed_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.profiles (
  user_id     uuid primary key references public.users(id) on delete cascade,
  first_name  text,
  surname     text,
  area        text,
  email       text,
  updated_at  timestamptz not null default now()
);

create table public.education (
  user_id        uuid primary key references public.users(id) on delete cascade,
  matric_status  text check (matric_status in ('completed', 'studying', 'not_completed')),
  school         text,
  year           int,
  highest_grade  text,
  updated_at     timestamptz not null default now()
);

create table public.qualifications (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references public.users(id) on delete cascade,
  position  int not null,
  name      text not null,
  year      int
);
create index on public.qualifications (user_id);

create table public.experiences (
  id                    bigint generated always as identity primary key,
  user_id               uuid not null references public.users(id) on delete cascade,
  position              int not null,
  title                 text not null,
  place                 text not null,
  dates                 text not null,
  description           text not null,   -- what the user typed
  description_polished  text,            -- filled in later by the AI rewrite step
  created_at            timestamptz not null default now()
);
create index on public.experiences (user_id);

create table public.skills (
  user_id     uuid primary key references public.users(id) on delete cascade,
  items       text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

create table public.cv_references (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.users(id) on delete cascade,
  position      int not null,
  name          text not null,
  phone         text not null,
  relationship  text not null
);
create index on public.cv_references (user_id);

-- Proof that deletions happened, without keeping the number itself (sha256 hash only).
create table public.deletion_log (
  id          bigint generated always as identity primary key,
  wa_id_hash  text not null,
  deleted_at  timestamptz not null default now()
);

alter table public.users          enable row level security;
alter table public.profiles       enable row level security;
alter table public.education      enable row level security;
alter table public.qualifications enable row level security;
alter table public.experiences    enable row level security;
alter table public.skills         enable row level security;
alter table public.cv_references  enable row level security;
alter table public.deletion_log   enable row level security;

-- Replaces one CV section in a single transaction (so an EDIT never leaves half-old, half-new data).
create or replace function public.save_section(p_user_id uuid, p_section text, p_data jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_section = 'details' then
    insert into profiles (user_id, first_name, surname, area, email, updated_at)
    values (p_user_id, p_data->>'firstName', p_data->>'surname', p_data->>'area', nullif(p_data->>'email', ''), now())
    on conflict (user_id) do update
      set first_name = excluded.first_name, surname = excluded.surname,
          area = excluded.area, email = excluded.email, updated_at = now();

  elsif p_section = 'education' then
    insert into education (user_id, matric_status, school, year, highest_grade, updated_at)
    values (p_user_id, p_data->>'matric', p_data->>'school', (p_data->>'year')::int, p_data->>'highestGrade', now())
    on conflict (user_id) do update
      set matric_status = excluded.matric_status, school = excluded.school, year = excluded.year,
          highest_grade = excluded.highest_grade, updated_at = now();
    delete from qualifications where user_id = p_user_id;
    insert into qualifications (user_id, position, name, year)
    select p_user_id, (x.ord - 1)::int, x.e->>'name', (x.e->>'year')::int
    from jsonb_array_elements(coalesce(p_data->'extras', '[]'::jsonb)) with ordinality as x(e, ord);

  elsif p_section = 'experience' then
    delete from experiences where user_id = p_user_id;
    insert into experiences (user_id, position, title, place, dates, description)
    select p_user_id, (x.ord - 1)::int, x.e->>'title', x.e->>'place', x.e->>'dates', x.e->>'description'
    from jsonb_array_elements(coalesce(p_data, '[]'::jsonb)) with ordinality as x(e, ord);

  elsif p_section = 'skills' then
    insert into skills (user_id, items, updated_at)
    values (p_user_id, array(select jsonb_array_elements_text(coalesce(p_data, '[]'::jsonb))), now())
    on conflict (user_id) do update set items = excluded.items, updated_at = now();

  elsif p_section = 'references' then
    delete from cv_references where user_id = p_user_id;
    insert into cv_references (user_id, position, name, phone, relationship)
    select p_user_id, (x.ord - 1)::int, x.e->>'name', x.e->>'phone', x.e->>'relationship'
    from jsonb_array_elements(coalesce(p_data->'items', '[]'::jsonb)) with ordinality as x(e, ord);
    update users set references_on_request = coalesce((p_data->>'onRequest')::boolean, false) where id = p_user_id;

  else
    raise exception 'Unknown CV section: %', p_section;
  end if;

  update users set updated_at = now() where id = p_user_id;
end;
$$;

revoke execute on function public.save_section(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_section(uuid, text, jsonb) to service_role;
