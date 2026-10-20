-- The Store visit joins the blue checkmark, and the checkmark emails are
-- rewritten (Peter, 20 Oct 2026). Applied from Claude Code with Peter's
-- approval (migration checkmark_store_and_email_copy). Kept as the record.
--
-- 1. conference_setup_status: verification_keys gains 'store' (seven steps).
--    The 22 conferences verified on 20 Oct 2026 keep their checkmark without
--    a Store visit: they are listed in checkmark_store_exempt (owner: "keep
--    current ones").
-- 2. queue_checkmark_emails: the two reminders (60, 62) and the verified
--    email (61) mention the 300+ sponsor list; the verified email no longer
--    says unpublishing removes the mark (being public is not a step);
--    "the directory" is "Explore". New p_test_to sends ONE email (the first
--    match) to that address and records nothing.
-- Every replacement is checked: a sentence that does not match aborts.

create table if not exists public.checkmark_store_exempt (
  conference_id uuid primary key references public.conferences(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.checkmark_store_exempt enable row level security;
revoke all on public.checkmark_store_exempt from anon, authenticated;
insert into public.checkmark_store_exempt (conference_id)
select id from public.conferences where is_verified
on conflict do nothing;

do $do$
declare
  d text;
  pairs text[][];
  i int;
begin
  -- 1. conference_setup_status
  d := pg_get_functiondef('public.conference_setup_status(uuid)'::regprocedure);
  pairs := array[
    [$a$array['page','committees','applications','financials','communications','chairs'];$a$,
     $a$array['page','committees','applications','financials','communications','chairs','store'];$a$],
    [$a$   where not (i->>'done')::boolean and (i->>'key') = any (v_ver_keys);$a$,
     $a$   where not (i->>'done')::boolean and (i->>'key') = any (v_ver_keys)
     and not ((i->>'key') = 'store'
              and exists (select 1 from checkmark_store_exempt e where e.conference_id = c.id));$a$]
  ];
  for i in 1 .. array_length(pairs, 1) loop
    if position(pairs[i][1] in d) = 0 then raise exception 'setup_status: no match for %', left(pairs[i][1], 60); end if;
    d := replace(d, pairs[i][1], pairs[i][2]);
  end loop;
  execute d;

  -- 2. queue_checkmark_emails
  d := pg_get_functiondef('public.queue_checkmark_emails(uuid,boolean)'::regprocedure);
  pairs := array[
    [$a$public.queue_checkmark_emails(p_only uuid DEFAULT NULL::uuid, p_preview boolean DEFAULT false)$a$,
     $a$public.queue_checkmark_emails(p_only uuid DEFAULT NULL::uuid, p_preview boolean DEFAULT false, p_test_to text DEFAULT NULL::text)$a$],
    [$a$'**' || v_name || '** has earned its **blue checkmark**. Every set-up stage is done, so the mark now sits beside your name on the directory, on your public page and on your honour roll.',$a$,
     $a$'**' || v_name || '** has earned its **blue checkmark**. Every set-up step is done, so the mark now sits beside your name on Explore, on your public page and on your honour roll.',$a$],
    [$a$'To a delegate it says one thing: **this conference is real, set up properly, and ready to take them**. That matters most to people who have never heard of you.',$a$,
     $a$'To a delegate it says one thing: **this conference is real, set up properly and ready to take them**. That matters most to people who have never heard of you.',
          'Your checkmark also unlocks our list of **300+ MUN sponsors**: Red Bull, Coca-Cola, Mercedes-Benz, Starbucks, Deloitte, Turkish Airlines and hundreds more, each with the conferences it backed. It comes in its own email, so look out for it.',$a$],
    [$a$'The mark stays while your set-up stays complete. Unpublishing your page or removing your payment method takes it away. Finishing that step brings it straight back.'$a$,
     $a$'The mark stays while your set-up stays complete. If a step comes undone, for example your payment set-up is removed, the mark goes until that step is finished again.'$a$],
    [$a$' has earned its blue checkmark on Gavelling. Every set-up stage is done, so the mark now sits beside your conference name on the directory and on your public page.' || chr(10) || chr(10)$a$,
     $a$' has earned its blue checkmark on Gavelling. Every set-up step is done, so the mark now sits beside your conference name on Explore and on your public page.' || chr(10) || chr(10)
          || 'Your checkmark also unlocks our list of 300+ MUN sponsors (Red Bull, Coca-Cola, Mercedes-Benz, Starbucks, Deloitte, Turkish Airlines and hundreds more). It comes in its own email.' || chr(10) || chr(10)$a$],
    [$a$then v_name || ' is about ' || v_minutes || ' minutes from its checkmark'$a$,
     $a$then v_name || ' is ' || v_minutes || ' minutes from its checkmark and 300+ MUN sponsors'$a$],
    [$a$else 'Still ' || v_minutes || ' minutes to the checkmark for ' || v_name end;$a$,
     $a$else 'Still ' || v_minutes || ' minutes to the checkmark and 300+ MUN sponsors for ' || v_name end;$a$],
    [$a$then 'Conferences on Gavelling earn a **blue checkmark** the moment their set-up is complete. It sits next to your name on the directory and on your public page. It is the first thing a delegate who has never heard of **' || v_name || '** looks for.'$a$,
     $a$then 'Conferences on Gavelling earn a **blue checkmark** the moment all seven set-up steps are done. It sits next to your name on Explore and on your public page, and it is the first thing a delegate who has never heard of **' || v_name || '** looks for.'$a$],
    [$a$'What is left comes to about **' || v_minutes$a$,
     $a$'The checkmark now comes with our list of **300+ MUN sponsors**: Red Bull, Coca-Cola, Mercedes-Benz, Starbucks, Deloitte, Barclays, Turkish Airlines and hundreds more, each with the conferences it backed and how. It lands in your inbox the moment you are verified.',
          'What is left comes to about **' || v_minutes$a$],
    [$a$' minutes from its blue checkmark on Gavelling.' || chr(10) || chr(10)$a$,
     $a$' minutes from its blue checkmark on Gavelling. The checkmark now comes with our list of 300+ MUN sponsors (Red Bull, Coca-Cola, Mercedes-Benz, Starbucks and hundreds more).' || chr(10) || chr(10)$a$],
    [$a$      if p_preview then
        v_sent := v_sent + 1;$a$,
     $a$      -- A test sends exactly one email (the first match) and records nothing.
      if p_test_to is not null then
        insert into email_outbox (conference_id, recipient_application_id, recipient_email, subject, body, body_html, status,
                                  from_name, from_address, reply_to)
        values (c.id, null, p_test_to, '[Test] ' || v_subject, v_txt, v_html, 'pending',
                'Peter at Gavelling', 'peter@mail.gavelling.com', 'wearegavelling@gmail.com');
        return jsonb_build_object('ok', true, 'test_to', p_test_to, 'kind', v_kind, 'subject', v_subject);
      end if;
      if p_preview then
        v_sent := v_sent + 1;$a$]
  ];
  for i in 1 .. array_length(pairs, 1) loop
    if position(pairs[i][1] in d) = 0 then raise exception 'checkmark_emails: no match for %', left(pairs[i][1], 60); end if;
    d := replace(d, pairs[i][1], pairs[i][2]);
  end loop;
  drop function public.queue_checkmark_emails(uuid, boolean);
  execute d;
end $do$;

revoke all on function public.queue_checkmark_emails(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.queue_checkmark_emails(uuid, boolean, text) to service_role;
