-- APPLIED 12 Oct 2026 as migration conference_drafts. The reminder cron is NOT scheduled (needs Peter's go).
-- ============================================================================
-- scratch-conference-drafts.sql   (12 Oct 2026)   NOT APPLIED. Peter applies it.
--
-- Drafts for the conference creation wizard (/conferences/new), saved on the
-- server as the organiser goes, so leaving, reloading or switching device never
-- loses a half-listed conference, plus four reminder emails to finish it.
--
--   conference_drafts                  the table (RLS on, NO policies, NO grants:
--                                      only the RPCs below touch it)
--   save_conference_draft(token, email, data, step)       anon + authenticated
--   load_conference_draft(token)                           anon + authenticated
--   stop_conference_draft_reminders(token)                 anon + authenticated
--   delete_conference_draft(token)                         anon + authenticated
--   my_conference_drafts()                                 authenticated
--   claim_conference_drafts()                              authenticated
--   finish_conference_draft(token, conference_id)          authenticated
--   conference_draft_reminder_render(id, stage, unsub)     owner only
--   queue_conference_draft_reminders(p_preview default TRUE, p_limit)  owner /
--                                      service role only. TRUE inserts NOTHING.
--                                      FALSE SENDS.
--
-- WHO OWNS A DRAFT
--   * A signed-out visitor's draft is keyed by a random 64-hex token minted by
--     the server on the first save and kept in the browser (localStorage
--     `gavelling-conference-draft`). The email they typed is where reminders go.
--   * A draft is CLAIMED by an account (user_id set) only:
--       - by the browser token: a signed-in caller saving or loading with the
--         token of an unclaimed draft, or
--       - by a VERIFIED email: claim_conference_drafts() takes unclaimed drafts
--         whose email equals the caller's auth.users.email with
--         email_confirmed_at set.
--     Never by a typed email alone.
--   * Once claimed, only that account can load, save, finish or delete it.
--
-- TOKEN SECURITY (the /drafts/[token] model, adapted)
--   The token is the only credential of an UNCLAIMED draft, so load by token
--   returns the answers (that is the whole point: the email link reopens the
--   wizard on any device). A CLAIMED draft opened with a token by anyone but
--   its owner returns only a masked email and `sign_in`, never the answers.
--   stop_conference_draft_reminders is safe on GET (mail scanners): it only
--   sets reminder_opt_out. Deleting needs the token AND (unclaimed, or the
--   owner signed in).
--
-- ABUSE LIMITS (an anonymous form that makes us email an address)
--   * data: a JSON object, at most 512 KB as text; step 0..20.
--   * per token: at most 240 saves in any 10 minutes (autosave is 1 s
--     debounced), at most 5 email changes in the draft's life.
--   * per email: at most 3 new drafts in 24 hours, at most 5 open drafts.
--   * platform: at most 500 new ANONYMOUS drafts per hour.
--   * reminders: only drafts that carry a conference name, at most 4 ever per
--     draft, never to an opted-out / failed address, never to an account that
--     turned reminders off, and the global 2-per-hour cap trigger still applies.
--     A stranger can still type someone else's address; they get at most 4
--     emails, each with a one-click stop and the global unsubscribe.
-- ============================================================================

begin;

create table if not exists public.conference_drafts (
  id                     uuid primary key default gen_random_uuid(),
  token                  text not null unique check (token ~ '^[0-9a-f]{64}$'),
  email                  text check (email is null or (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  user_id                uuid references auth.users(id) on delete set null,
  data                   jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  step                   int not null default 0 check (step between 0 and 20),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_conference_id  uuid references public.conferences(id) on delete set null,
  finished_at            timestamptz,
  deleted_at             timestamptz,
  reminder_stage         int not null default 0 check (reminder_stage between 0 and 4),
  last_reminder_at       timestamptz,
  reminder_opt_out       boolean not null default false,
  reminders_log          jsonb not null default '[]'::jsonb,   -- [{stage, at, outbox_id}]
  email_changes          int not null default 0,
  save_window_start      timestamptz not null default now(),
  save_window_count      int not null default 0
);

create index if not exists conference_drafts_user_idx  on public.conference_drafts (user_id) where finished_at is null and deleted_at is null;
create index if not exists conference_drafts_email_idx on public.conference_drafts (lower(email)) where finished_at is null and deleted_at is null;
create index if not exists conference_drafts_due_idx   on public.conference_drafts (updated_at) where finished_at is null and deleted_at is null and reminder_stage < 4;

alter table public.conference_drafts enable row level security;
revoke all on public.conference_drafts from public, anon, authenticated;

-- ── helpers ────────────────────────────────────────────────────────────────

create or replace function public._conference_draft_new_token()
returns text language sql volatile set search_path = public, pg_temp as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;
revoke all on function public._conference_draft_new_token() from public, anon, authenticated;

create or replace function public._conference_draft_mask(p_email text)
returns text language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then null
    else left(split_part(p_email, '@', 1), 1) || '***@' || split_part(p_email, '@', 2)
  end;
$$;
revoke all on function public._conference_draft_mask(text) from public, anon, authenticated;

-- The caller's verified email, or null.
create or replace function public._conference_draft_verified_email()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select lower(btrim(u.email)) from auth.users u
   where u.id = auth.uid() and u.email_confirmed_at is not null and u.email is not null;
$$;
revoke all on function public._conference_draft_verified_email() from public, anon, authenticated;

-- ── save ───────────────────────────────────────────────────────────────────

create or replace function public.save_conference_draft(
  p_token text, p_email text, p_data jsonb, p_step int
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_acct  text;
  r       public.conference_drafts%rowtype;
  v_token text;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'This draft could not be saved.');
  end if;
  if octet_length(p_data::text) > 524288 then
    return jsonb_build_object('ok', false, 'reason', 'too_large', 'message', 'This draft is too large to save. Remove some seats or committees and try again.');
  end if;
  if p_step is null or p_step < 0 or p_step > 20 then
    return jsonb_build_object('ok', false, 'reason', 'invalid', 'message', 'This draft could not be saved.');
  end if;
  if v_email <> '' and (length(v_email) > 254 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    return jsonb_build_object('ok', false, 'reason', 'bad_email', 'message', 'Enter a valid email address.');
  end if;

  -- A signed-in caller's drafts always go to their account address.
  if v_uid is not null then
    select lower(btrim(email)) into v_acct from auth.users where id = v_uid;
    if v_acct is not null then v_email := v_acct; end if;
  end if;

  -- ── first save: mint the draft ──
  if p_token is null or btrim(p_token) = '' then
    if v_email = '' then
      return jsonb_build_object('ok', false, 'reason', 'email_required', 'message', 'Enter your email so we can save your conference.');
    end if;
    perform pg_advisory_xact_lock(hashtext('conference_draft_email:' || v_email));
    if (select count(*) from conference_drafts
         where lower(email) = v_email and created_at > now() - interval '24 hours') >= 3 then
      return jsonb_build_object('ok', false, 'reason', 'rate_limited', 'message', 'Too many new drafts for this email today. Continue one you already started, or try again tomorrow.');
    end if;
    if (select count(*) from conference_drafts
         where lower(email) = v_email and finished_at is null and deleted_at is null) >= 5 then
      return jsonb_build_object('ok', false, 'reason', 'too_many', 'message', 'This email already has 5 unfinished conferences. Finish or delete one first.');
    end if;
    if v_uid is null and (select count(*) from conference_drafts
         where user_id is null and created_at > now() - interval '1 hour') >= 500 then
      return jsonb_build_object('ok', false, 'reason', 'busy', 'message', 'We could not save your draft just now. Please try again in a few minutes.');
    end if;
    v_token := public._conference_draft_new_token();
    insert into conference_drafts (token, email, user_id, data, step, save_window_count)
    values (v_token, v_email, v_uid, p_data, p_step, 1)
    returning * into r;
    return jsonb_build_object('ok', true, 'token', r.token, 'created', true, 'updated_at', r.updated_at);
  end if;

  -- ── later saves ──
  select * into r from conference_drafts where token = btrim(p_token) for update;
  if r.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'This draft no longer exists.');
  end if;
  if r.finished_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'finished', 'message', 'This conference has already been created.');
  end if;
  if r.deleted_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'deleted', 'message', 'This draft was deleted.');
  end if;
  if r.user_id is not null and (v_uid is null or r.user_id <> v_uid) then
    return jsonb_build_object('ok', false, 'reason', case when v_uid is null then 'sign_in' else 'not_yours' end,
      'message', case when v_uid is null then 'Sign in to keep working on this draft.' else 'This draft belongs to another account.' end);
  end if;

  -- per-token rate limit (10-minute window)
  if r.save_window_start < now() - interval '10 minutes' then
    r.save_window_start := now(); r.save_window_count := 0;
  end if;
  if r.save_window_count >= 240 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited', 'message', 'Saving too often. Your changes will save in a moment.');
  end if;

  -- email change (signed-out only; a claimed draft follows its account)
  if v_uid is null and v_email <> '' and v_email is distinct from lower(coalesce(r.email, '')) then
    if r.email_changes >= 5 then
      return jsonb_build_object('ok', false, 'reason', 'rate_limited', 'message', 'This draft''s email cannot be changed again.');
    end if;
    r.email := v_email;
    r.email_changes := r.email_changes + 1;
    r.reminder_stage := 0;
    r.last_reminder_at := null;
  end if;

  -- claim by the browser token
  if v_uid is not null and r.user_id is null then
    r.user_id := v_uid;
    if v_email <> '' then r.email := v_email; end if;
  end if;

  update conference_drafts
     set data = p_data, step = p_step, updated_at = now(),
         email = r.email, email_changes = r.email_changes, user_id = r.user_id,
         reminder_stage = r.reminder_stage, last_reminder_at = r.last_reminder_at,
         save_window_start = r.save_window_start, save_window_count = r.save_window_count + 1
   where id = r.id
  returning * into r;
  return jsonb_build_object('ok', true, 'token', r.token, 'created', false, 'updated_at', r.updated_at);
end $$;

-- ── load ───────────────────────────────────────────────────────────────────

create or replace function public.load_conference_draft(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_acct text;
  r public.conference_drafts%rowtype;
  v_slug text;
begin
  if p_token is null or btrim(p_token) !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'This draft no longer exists.');
  end if;
  select * into r from conference_drafts where token = btrim(p_token) for update;
  if r.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'This draft no longer exists.');
  end if;
  if r.deleted_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'deleted', 'message', 'This draft was deleted.');
  end if;
  if r.finished_at is not null then
    if v_uid is not null and r.user_id = v_uid and r.created_conference_id is not null then
      select slug into v_slug from conferences where id = r.created_conference_id;
    end if;
    return jsonb_build_object('ok', false, 'reason', 'finished', 'slug', v_slug,
      'message', 'This conference has already been created.');
  end if;
  if r.user_id is not null and (v_uid is null or r.user_id <> v_uid) then
    return jsonb_build_object('ok', false,
      'reason', case when v_uid is null then 'sign_in' else 'not_yours' end,
      'email_masked', public._conference_draft_mask(r.email),
      'message', case when v_uid is null then 'Sign in to continue this draft.' else 'This draft belongs to another account.' end);
  end if;

  -- claim by the browser token
  if v_uid is not null and r.user_id is null then
    select lower(btrim(email)) into v_acct from auth.users where id = v_uid;
    update conference_drafts set user_id = v_uid, email = coalesce(v_acct, email)
     where id = r.id returning * into r;
  end if;

  return jsonb_build_object('ok', true, 'token', r.token, 'email', r.email, 'data', r.data,
    'step', r.step, 'updated_at', r.updated_at, 'claimed', r.user_id is not null);
end $$;

-- ── stop the reminders (safe on GET) ───────────────────────────────────────

create or replace function public.stop_conference_draft_reminders(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_already boolean;
begin
  if p_token is null or btrim(p_token) !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'This link is no longer valid.');
  end if;
  select id, reminder_opt_out into v_id, v_already from conference_drafts where token = btrim(p_token);
  if v_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'This link is no longer valid.');
  end if;
  update conference_drafts set reminder_opt_out = true where id = v_id;
  return jsonb_build_object('ok', true, 'already', v_already);
end $$;

-- ── delete ─────────────────────────────────────────────────────────────────

create or replace function public.delete_conference_draft(p_token text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); r public.conference_drafts%rowtype;
begin
  select * into r from conference_drafts where token = btrim(coalesce(p_token, '')) for update;
  if r.id is null or r.deleted_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'This draft no longer exists.');
  end if;
  if r.user_id is not null and (v_uid is null or r.user_id <> v_uid) then
    return jsonb_build_object('ok', false, 'reason', 'not_yours', 'message', 'Sign in with the account this draft belongs to.');
  end if;
  update conference_drafts
     set deleted_at = now(), data = '{}'::jsonb, reminder_opt_out = true
   where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

-- ── the caller's drafts (My conferences) ──────────────────────────────────

create or replace function public.my_conference_drafts()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'token', d.token,
           'full_name', nullif(btrim(d.data->>'fullName'), ''),
           'acronym', nullif(btrim(d.data->>'acronym'), ''),
           'logo_url', nullif(btrim(d.data->>'logoUrl'), ''),
           'step', d.step,
           'updated_at', d.updated_at,
           'created_at', d.created_at
         ) order by d.updated_at desc), '[]'::jsonb)
    from conference_drafts d
   where auth.uid() is not null
     and d.user_id = auth.uid()
     and d.finished_at is null and d.deleted_at is null;
$$;

-- ── claim by verified email ───────────────────────────────────────────────

create or replace function public.claim_conference_drafts()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_email text; v_n int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out', 'message', 'Sign in first.');
  end if;
  v_email := public._conference_draft_verified_email();
  if v_email is null then
    return jsonb_build_object('ok', true, 'claimed', 0, 'reason', 'unverified');
  end if;
  update conference_drafts
     set user_id = v_uid
   where user_id is null and lower(email) = v_email
     and finished_at is null and deleted_at is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'claimed', v_n);
end $$;

-- ── finish (the conference was created from it) ───────────────────────────

create or replace function public.finish_conference_draft(p_token text, p_conference_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); r public.conference_drafts%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out', 'message', 'Sign in first.');
  end if;
  if p_conference_id is null or not exists (
       select 1 from conferences c where c.id = p_conference_id
          and (c.organizer_id = v_uid or public.is_conference_organizer(c.id))) then
    return jsonb_build_object('ok', false, 'reason', 'denied', 'message', 'That conference is not yours.');
  end if;
  select * into r from conference_drafts where token = btrim(coalesce(p_token, '')) for update;
  if r.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'This draft no longer exists.');
  end if;
  if r.user_id is not null and r.user_id <> v_uid then
    return jsonb_build_object('ok', false, 'reason', 'not_yours', 'message', 'This draft belongs to another account.');
  end if;
  update conference_drafts
     set user_id = v_uid, finished_at = coalesce(finished_at, now()),
         created_conference_id = p_conference_id, data = '{}'::jsonb
   where id = r.id;
  return jsonb_build_object('ok', true);
end $$;

-- ── reminder copy ─────────────────────────────────────────────────────────
-- Four stages, each leading with a different TRUE benefit (CLAUDE.md §1, §3,
-- §4): 1 organisers pay nothing; 2 one place for applications, allocations and
-- payments; 3 live committee rooms with the free session tool; 4 a public page
-- and Spotlight on Explore. p_with_unsub false (preview) never mints an
-- unsubscribe token, because unsubscribe_token_for INSERTS into email_optouts.

create or replace function public.conference_draft_reminder_render(
  p_id uuid, p_stage int, p_with_unsub boolean default false
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.conference_drafts%rowtype;
  v_name text; v_link text; v_stop text; v_unsub text;
  v_subject text; v_heading text; v_paras text[]; v_cta text;
  v_text text; v_html text;
begin
  select * into r from conference_drafts where id = p_id;
  if r.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  -- The name is typed by whoever started the draft, and this email can reach
  -- an address they typed: keep it short and never a link (the house template
  -- escapes HTML already).
  v_name := coalesce(nullif(btrim(r.data->>'acronym'), ''), nullif(btrim(r.data->>'fullName'), ''));
  if v_name is null or length(v_name) > 60 or v_name ~* '(://|www\.|\.(com|net|org|io|ru|xyz)\M|@)' then
    v_name := 'your conference';
  end if;
  v_link := 'https://gavelling.com/conferences/new?draft=' || r.token;
  v_stop := v_link || '&stop=1';
  v_cta  := 'Finish listing ' || v_name;

  if p_stage = 1 then
    v_subject := 'Your conference is saved: finish listing ' || v_name;
    v_heading := v_name || ' is saved';
    v_paras := array[
      'You started listing ' || v_name || ' on Gavelling. Everything you filled in is saved, so you can pick up exactly where you left off, on any device.',
      'Listing your conference costs you nothing. Gavelling never charges organisers: no listing fee, no fee per delegate, and no platform fee on the payments delegates make to you.',
      'It takes a few more minutes to finish.'
    ];
  elsif p_stage = 2 then
    v_subject := 'Applications, allocations and payments in one place';
    v_heading := 'One place for your whole conference';
    v_paras := array[
      v_name || ' is still waiting for you on Gavelling.',
      'Once it is listed, delegates apply on your conference page, you allocate countries and committees from the same screen, and payments come in by card or by your own payment method, with every receipt in one place. No more spreadsheets.',
      'Your draft is saved, so it is only a few minutes to finish.'
    ];
  elsif p_stage = 3 then
    v_subject := 'Run every committee room live, for free';
    v_heading := 'Your committees, live on the day';
    v_paras := array[
      'Your draft of ' || v_name || ' is saved on Gavelling.',
      'Every committee you add gets its own live room. Chairs run roll call, the speakers list, motions, timers and voting from one laptop, delegates follow on their phones, and your secretariat can watch every room at once. The session tool is free.',
      'Finish listing your conference to set it up.'
    ];
  else
    v_subject := 'Last reminder: put ' || v_name || ' in front of delegates';
    v_heading := 'Get ' || v_name || ' seen';
    v_paras := array[
      'This is our last reminder about your draft of ' || v_name || '.',
      'A listed conference gets its own public page that delegates can find and apply through. You can also book a Spotlight to put it at the top of Explore, where delegates look for their next conference.',
      'Your answers are still saved. Finish whenever you are ready.'
    ];
  end if;

  v_paras := v_paras || array['Not listing it after all? Stop these reminders: ' || v_stop];

  if p_with_unsub then
    v_unsub := 'https://gavelling.com/unsubscribe?t=' || public.unsubscribe_token_for(r.email)::text;
  else
    v_unsub := 'https://gavelling.com/unsubscribe?t=<minted when sent>';
  end if;

  v_text := 'Hi,' || E'\n\n' || array_to_string(v_paras[1:array_length(v_paras,1)-1], E'\n\n')
         || E'\n\n' || v_cta || ': ' || v_link
         || E'\n\n' || 'Peter and Christian' || E'\n' || 'Founders of Gavelling'
         || E'\n\n--\n' || 'You are receiving this because you started listing a conference on Gavelling with this address.'
         || E'\n' || 'Stop reminders about this draft: ' || v_stop
         || E'\n' || 'Unsubscribe from all Gavelling email: ' || v_unsub || E'\n';

  -- The house template. Its footer carries gavelling_email_unsub_mark(), which
  -- the outbox render trigger replaces with this address's unsubscribe link.
  v_html := public.gavelling_email_html(null, v_heading, v_paras, null, v_cta, v_link, null, null, null);

  return jsonb_build_object('ok', true, 'stage', p_stage, 'recipient_email', r.email,
    'subject', v_subject, 'body', v_text, 'body_html', v_html);
end $$;
revoke all on function public.conference_draft_reminder_render(uuid, int, boolean) from public, anon, authenticated;

-- ── the reminder queue ────────────────────────────────────────────────────
-- Stage k is due when the draft has not been edited for:
--   1: 1 hour   2: 1 day   3: 4 days   4: 10 days
-- and (from stage 2) the previous reminder went out at least 20 hours ago.
-- p_preview TRUE (the default) inserts NOTHING and mints no unsubscribe
-- token: it returns counts per stage and up to 5 rendered samples.
-- p_preview FALSE SENDS (email_outbox rows) and advances reminder_stage.

create or replace function public.queue_conference_draft_reminders(
  p_preview boolean default true, p_limit int default 100
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d record;
  v_render jsonb;
  v_outbox uuid;
  v_n int := 0;
  v_by_stage jsonb := '{"1":0,"2":0,"3":0,"4":0}'::jsonb;
  v_sample jsonb := '[]'::jsonb;
begin
  for d in
    select cd.id, cd.email, cd.reminder_stage + 1 as stage
      from conference_drafts cd
     where cd.finished_at is null
       and cd.deleted_at is null
       and cd.reminder_opt_out = false
       and cd.reminder_stage < 4
       and cd.email is not null
       and nullif(btrim(cd.data->>'fullName'), '') is not null
       and cd.updated_at <= now() - case cd.reminder_stage
             when 0 then interval '1 hour'
             when 1 then interval '1 day'
             when 2 then interval '4 days'
             else interval '10 days' end
       and (cd.reminder_stage = 0 or cd.last_reminder_at is null
            or cd.last_reminder_at <= now() - interval '20 hours')
       and not public.email_is_opted_out(cd.email)
       and not public.email_address_failed(cd.email)
       -- an account that turned reminders off
       and not exists (select 1 from profiles p
                        where lower(p.email) = lower(cd.email)
                          and coalesce(p.notify_email_reminders, true) = false)
       -- already created this conference another way (same owner, same name)
       and not exists (select 1 from conferences c
                        where c.created_at >= cd.created_at
                          and lower(btrim(c.full_name)) = lower(btrim(cd.data->>'fullName'))
                          and (c.organizer_id = cd.user_id
                               or c.organizer_id in (select p.id from profiles p where lower(p.email) = lower(cd.email))))
     order by cd.updated_at asc
     limit greatest(1, least(coalesce(p_limit, 100), 500))
  loop
    v_render := public.conference_draft_reminder_render(d.id, d.stage, not p_preview);
    if not coalesce((v_render->>'ok')::boolean, false) then continue; end if;

    v_n := v_n + 1;
    v_by_stage := jsonb_set(v_by_stage, array[d.stage::text], to_jsonb((v_by_stage->>d.stage::text)::int + 1));

    if p_preview then
      if jsonb_array_length(v_sample) < 5 then
        v_sample := v_sample || jsonb_build_array(jsonb_build_object(
          'draft_id', d.id, 'stage', d.stage, 'to', v_render->>'recipient_email',
          'subject', v_render->>'subject', 'body', v_render->>'body'));
      end if;
      continue;   -- PREVIEW: nothing is inserted, nothing is updated
    end if;

    insert into email_outbox (conference_id, recipient_email, subject, body, body_html, status,
                              reply_to, from_name, from_address)
    values (null, v_render->>'recipient_email', v_render->>'subject', v_render->>'body',
            v_render->>'body_html', 'pending',
            'wearegavelling@gmail.com', 'Peter at Gavelling', 'peter@mail.gavelling.com')
    returning id into v_outbox;

    update conference_drafts
       set reminder_stage = d.stage, last_reminder_at = now(),
           reminders_log = reminders_log || jsonb_build_array(jsonb_build_object('stage', d.stage, 'at', now(), 'outbox_id', v_outbox))
     where id = d.id;
  end loop;

  return jsonb_build_object('ok', true, 'preview', p_preview, 'count', v_n,
    'by_stage', v_by_stage, 'sample', case when p_preview then v_sample else '[]'::jsonb end);
end $$;

-- ── grants ────────────────────────────────────────────────────────────────

revoke all on function public.save_conference_draft(text, text, jsonb, int)   from public;
revoke all on function public.load_conference_draft(text)                     from public;
revoke all on function public.stop_conference_draft_reminders(text)           from public;
revoke all on function public.delete_conference_draft(text)                   from public;
revoke all on function public.my_conference_drafts()                          from public, anon;
revoke all on function public.claim_conference_drafts()                       from public, anon;
revoke all on function public.finish_conference_draft(text, uuid)             from public, anon;
revoke all on function public.queue_conference_draft_reminders(boolean, int)  from public, anon, authenticated;

grant execute on function public.save_conference_draft(text, text, jsonb, int)  to anon, authenticated;
grant execute on function public.load_conference_draft(text)                    to anon, authenticated;
grant execute on function public.stop_conference_draft_reminders(text)          to anon, authenticated;
grant execute on function public.delete_conference_draft(text)                  to anon, authenticated;
grant execute on function public.my_conference_drafts()                         to authenticated;
grant execute on function public.claim_conference_drafts()                      to authenticated;
grant execute on function public.finish_conference_draft(text, uuid)            to authenticated;
-- queue_conference_draft_reminders: owner (postgres / pg_cron) and service_role only.
grant execute on function public.queue_conference_draft_reminders(boolean, int) to service_role;

commit;

-- ============================================================================
-- ROLLED-BACK TEST BLOCK (after applying). It ends in a raised exception, so
-- everything it wrote is rolled back; seeing "ROLLBACK: all conference draft
-- checks passed" means every assert held. It never calls queue_conference_draft_reminders(false) and never inserts
-- into email_outbox: only the PREVIEW (which inserts nothing) is called.
-- ============================================================================
/*
do $test$
declare
  v_tok text; v_res jsonb; v_before bigint; v_after bigint; v_user uuid;
begin
  -- anon: the first save mints a token
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  v_res := public.save_conference_draft(null, 'gavelling.draft.preview.test@gmail.com',
             '{"fullName":"Test Model United Nations","acronym":"TMUN"}'::jsonb, 2);
  v_tok := v_res->>'token';
  assert v_tok ~ '^[0-9a-f]{64}$', 'token minted';
  assert (public.load_conference_draft(v_tok)->'data'->>'acronym') = 'TMUN', 'load by token';
  assert (public.save_conference_draft(v_tok, null, '[]'::jsonb, 2)->>'reason') = 'invalid', 'array refused';
  assert (public.save_conference_draft(v_tok, null, '{}'::jsonb, 99)->>'reason') = 'invalid', 'step refused';
  assert (public.save_conference_draft(v_tok, null, '{"fullName":"Test Model United Nations","acronym":"TMUN","city":"Oslo"}'::jsonb, 3)->>'ok') = 'true', 'second save';
  assert (public.load_conference_draft(repeat('a', 64))->>'reason') = 'not_found', 'unknown token';
  assert (public.save_conference_draft(null, 'gavelling.draft.preview.test@gmail.com', '{}'::jsonb, 1)->>'ok') = 'true', 'draft 2';
  assert (public.save_conference_draft(null, 'gavelling.draft.preview.test@gmail.com', '{}'::jsonb, 1)->>'ok') = 'true', 'draft 3';
  assert (public.save_conference_draft(null, 'gavelling.draft.preview.test@gmail.com', '{}'::jsonb, 1)->>'reason') = 'rate_limited', '3 a day';
  begin
    perform count(*) from public.conference_drafts;
    raise exception 'anon could read the table';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.queue_conference_draft_reminders(true);
    raise exception 'anon could call the queue';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- due for stage 1; the PREVIEW inserts nothing and changes nothing
  update public.conference_drafts set updated_at = now() - interval '2 hours' where token = v_tok;
  select count(*) into v_before from public.email_outbox;
  v_res := public.queue_conference_draft_reminders(true);
  select count(*) into v_after from public.email_outbox;
  assert v_before = v_after, 'preview inserted nothing';
  assert (v_res->'by_stage'->>'1')::int >= 1, 'stage 1 counted';
  assert (select reminder_stage from public.conference_drafts where token = v_tok) = 0, 'stage unchanged';
  raise notice 'preview sample: %', v_res->'sample'->0;

  -- the stop link takes it out of the queue
  perform public.stop_conference_draft_reminders(v_tok);
  assert (public.queue_conference_draft_reminders(true)->'by_stage'->>'1')::int = (v_res->'by_stage'->>'1')::int - 1, 'stopped';

  -- a claimed draft is never readable by its token alone
  select id into v_user from auth.users where email_confirmed_at is not null limit 1;
  update public.conference_drafts set user_id = v_user where token = v_tok;
  execute 'set local role anon';
  assert (public.load_conference_draft(v_tok)->>'reason') = 'sign_in', 'claimed needs sign in';
  assert not (public.load_conference_draft(v_tok) ? 'data'), 'no answers leak';
  assert (public.delete_conference_draft(v_tok)->>'reason') = 'not_yours', 'anon cannot delete';
  execute 'reset role';

  raise exception 'ROLLBACK: all conference draft checks passed';
end $test$;
*/

-- ============================================================================
-- CRON: NOT SCHEDULED. Needs Peter's explicit go. Preview first:
--   select public.queue_conference_draft_reminders();        -- inserts nothing
-- then, only with Peter's go:
-- select cron.schedule('conference-draft-reminders', '*/15 * * * *',
--   $$select public.queue_conference_draft_reminders(false, 100)$$);
-- Stop: select cron.unschedule('conference-draft-reminders');
-- ============================================================================
