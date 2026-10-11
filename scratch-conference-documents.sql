-- scratch-conference-documents.sql
-- DRAFT, NOT APPLIED. Conference-wide documents (Rules of Procedure, logistics,
-- schedules, code of conduct, anything else) that an organiser uploads once and
-- every accepted participant sees on the You tab of the conference page.
--
-- Why a new table and not study_guides:
--   * study_guides.conference_committee_id is NOT NULL and every one of its
--     three policies (organisers manage, assigned delegates read, chairs read)
--     resolves the conference THROUGH the committee. A null committee would
--     fail the organiser policy itself, so reusing it means rewriting all
--     three policies plus the release schedule (sg_publish_due) and the
--     release emails, which all assume a committee.
--   * the study-guides bucket is PUBLIC and its storage policies let any
--     signed-in user upload, update or delete any object in it. A Rules of
--     Procedure can be public-ish, but a logistics pack (hotel, phone numbers,
--     meeting points) should not be readable by anyone holding the URL.
--
-- So: a table `conference_documents`, a PRIVATE bucket `conference-documents`
-- (PDF, 10 MB), files read through short-lived signed URLs, and one helper that
-- answers "may the caller read this conference's documents" for both the table
-- and storage.
--
-- Who reads: the conference's organisers (and platform admins, through
-- is_conference_organizer), and anyone with an application to the conference in
-- accepted / assigned / checked-in (every role), or listed in a committee's
-- chair_user_ids. `visible_to` narrows a document to roles; empty = everyone
-- accepted. Nobody else, anon never.
-- Who writes: organisers only.
--
-- Storage path convention: conference-documents/<conference id>/<epoch>-<safe name>.pdf
-- (the client builds it with safeStorageKey(`${conferenceId}`, ...)). The first
-- folder is the conference id; the write policies read it from there.

begin;

-- ── Table ──────────────────────────────────────────────────────────────────
create table if not exists public.conference_documents (
  id              uuid primary key default gen_random_uuid(),
  conference_id   uuid not null references public.conferences(id) on delete cascade,
  title           text not null,
  kind            text not null default 'other',
  file_path       text,          -- object name in the conference-documents bucket
  file_name       text,          -- the name the organiser uploaded, for display
  file_size_bytes integer,
  url             text,          -- or a link (Google Drive, the conference site)
  visible_to      text[] not null default '{}',  -- empty = every accepted participant
  sort_order      integer not null default 0,
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint conference_documents_title_len check (char_length(btrim(title)) between 1 and 120),
  constraint conference_documents_kind_check check (kind in ('rop', 'logistics', 'schedule', 'code_of_conduct', 'other')),
  constraint conference_documents_one_source check ((file_path is null) <> (url is null)),
  constraint conference_documents_url_https check (url is null or (url ~* '^https://' and char_length(url) <= 1000)),
  constraint conference_documents_path_in_conference check (file_path is null or split_part(file_path, '/', 1) = conference_id::text),
  constraint conference_documents_visible_to_roles check (
    visible_to <@ array['delegate', 'head-delegate', 'faculty-advisor', 'observer', 'chair', 'secretariat', 'staff']::text[]
  )
);

create index if not exists conference_documents_conf_idx
  on public.conference_documents (conference_id, sort_order, created_at);

create or replace function public.conference_documents_touch()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists conference_documents_touch_t on public.conference_documents;
create trigger conference_documents_touch_t
  before update on public.conference_documents
  for each row execute function public.conference_documents_touch();

-- ── Who may read ───────────────────────────────────────────────────────────
-- True when the caller organises the conference, or holds an accepted /
-- assigned / checked-in application (any role) whose role is in p_visible_to
-- (empty = any role), or chairs one of its committees (counted as 'chair').
create or replace function public.can_read_conference_document(p_conference uuid, p_visible_to text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and (
    public.is_conference_organizer(p_conference)
    or exists (
      select 1 from applications a
      where a.conference_id = p_conference
        and a.user_id = auth.uid()
        and a.status in ('accepted', 'assigned', 'checked-in')
        and (
          coalesce(cardinality(p_visible_to), 0) = 0
          or a.role = any(p_visible_to)
          or (coalesce(a.is_head_delegate, false) and 'head-delegate' = any(p_visible_to))
        )
    )
    or exists (
      select 1 from conference_committees cc
      where cc.conference_id = p_conference
        and auth.uid() = any(cc.chair_user_ids)
        and (coalesce(cardinality(p_visible_to), 0) = 0 or 'chair' = any(p_visible_to))
    )
  )
$$;

revoke all on function public.can_read_conference_document(uuid, text[]) from public;
grant execute on function public.can_read_conference_document(uuid, text[]) to authenticated;

-- The storage twin: the object must belong to a document row the caller can read.
create or replace function public.conference_document_file_readable(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from conference_documents d
    where d.file_path = p_name
      and public.can_read_conference_document(d.conference_id, d.visible_to)
  )
$$;

revoke all on function public.conference_document_file_readable(text) from public;
grant execute on function public.conference_document_file_readable(text) to authenticated;

-- The conference id in the first folder of an object name, or null.
create or replace function public.conference_document_conference_id(p_name text)
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end
$$;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.conference_documents enable row level security;

revoke all on public.conference_documents from anon;
grant select, insert, update, delete on public.conference_documents to authenticated;

drop policy if exists "Organizers manage conference documents" on public.conference_documents;
create policy "Organizers manage conference documents"
  on public.conference_documents
  for all
  to authenticated
  using (public.is_conference_organizer(conference_id))
  with check (public.is_conference_organizer(conference_id));

drop policy if exists "Accepted participants read conference documents" on public.conference_documents;
create policy "Accepted participants read conference documents"
  on public.conference_documents
  for select
  to authenticated
  using (public.can_read_conference_document(conference_id, visible_to));

-- ── Storage ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('conference-documents', 'conference-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

drop policy if exists "Conference documents: organisers upload" on storage.objects;
create policy "Conference documents: organisers upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'conference-documents'
    and public.conference_document_conference_id(name) is not null
    and public.is_conference_organizer(public.conference_document_conference_id(name))
  );

drop policy if exists "Conference documents: organisers change" on storage.objects;
create policy "Conference documents: organisers change"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'conference-documents'
    and public.is_conference_organizer(public.conference_document_conference_id(name))
  )
  with check (
    bucket_id = 'conference-documents'
    and public.is_conference_organizer(public.conference_document_conference_id(name))
  );

drop policy if exists "Conference documents: organisers delete" on storage.objects;
create policy "Conference documents: organisers delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'conference-documents'
    and public.is_conference_organizer(public.conference_document_conference_id(name))
  );

-- Read (and so createSignedUrl): organisers of the folder's conference, or a
-- participant who can read the document row that points at this object.
drop policy if exists "Conference documents: organisers and participants read" on storage.objects;
create policy "Conference documents: organisers and participants read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'conference-documents'
    and (
      public.is_conference_organizer(public.conference_document_conference_id(name))
      or public.conference_document_file_readable(name)
    )
  );

commit;

-- ── Test (run on its own, ROLLED BACK) ────────────────────────────────────
-- Replace the four ids. Every statement runs inside one transaction that is
-- rolled back, so nothing remains.
--
-- begin;
--   -- an organiser of :conf inserts a document
--   select set_config('request.jwt.claims', json_build_object('sub', ':organiser_uid', 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   insert into conference_documents (conference_id, title, kind, url)
--     values (':conf', 'Rules of Procedure', 'rop', 'https://example.org/rop.pdf');
--   insert into conference_documents (conference_id, title, kind, url, visible_to)
--     values (':conf', 'Advisor briefing', 'logistics', 'https://example.org/fa.pdf', array['faculty-advisor']);
--   select count(*) as organiser_sees from conference_documents where conference_id = ':conf';          -- 2
--
--   -- an accepted delegate of :conf
--   reset role;
--   select set_config('request.jwt.claims', json_build_object('sub', ':accepted_delegate_uid', 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   select count(*) as delegate_sees from conference_documents where conference_id = ':conf';           -- 1 (not the advisor-only one)
--   insert into conference_documents (conference_id, title, url) values (':conf', 'x', 'https://x.org'); -- ERROR: RLS
--
--   -- someone with only a SUBMITTED application, or a stranger
--   reset role;
--   select set_config('request.jwt.claims', json_build_object('sub', ':stranger_uid', 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   select count(*) as stranger_sees from conference_documents where conference_id = ':conf';           -- 0
--
--   -- anon
--   reset role;
--   set local role anon;
--   select count(*) from conference_documents;                                                           -- ERROR: permission denied
--
--   -- a refused shape
--   reset role;
--   insert into conference_documents (conference_id, title, kind, url) values (':conf', 'Bad', 'rop', 'http://insecure.org'); -- conference_documents_url_https
-- rollback;
