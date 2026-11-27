-- Platform gifts: gift Unlimited to any account, reusing the crisis gift pop-up and email (owner, 25 Nov 2026).
-- A crisis_gifts row with crisis_id null is a platform gift. The unique (crisis_id, user_id) index stays: NULL rows never
-- collide, so one account may hold several platform gifts.

alter table public.crisis_gifts alter column crisis_id drop not null;
alter table public.crisis_gifts add column if not exists note text;

-- The pop-up needs the days to word the gift.
create or replace function public.my_open_crisis_gift()
returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select jsonb_build_object('id', g.id, 'crisis_id', g.crisis_id, 'code', g.code, 'amount', p.amount,
    'saved', g.saved_at is not null, 'activated', false, 'expires_at', p.expires_at)
  from crisis_gifts g join promo_codes p on p.id = g.promo_code_id
  where g.user_id = auth.uid() and g.activated_at is null and g.saved_at is null
    and p.active and (p.expires_at is null or p.expires_at > now())
  order by g.created_at desc limit 1
$$;

-- Every gift the caller can still activate, saved or not (the "Your gift" card on Manage account, Promo code).
-- A code already claimed on the Promo code page is left out: it is spent.
create or replace function public.my_gifts()
returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'crisis_id', g.crisis_id, 'code', g.code, 'amount', p.amount,
      'saved', g.saved_at is not null, 'expires_at', p.expires_at) order by g.created_at desc), '[]'::jsonb)
  from crisis_gifts g join promo_codes p on p.id = g.promo_code_id
  where g.user_id = auth.uid() and g.activated_at is null
    and p.active and (p.expires_at is null or p.expires_at > now())
    and not exists (select 1 from promo_claims c where c.promo_code_id = p.id)
$$;
revoke all on function public.my_gifts() from public, anon;
grant execute on function public.my_gifts() to authenticated;

-- The gift email (owner, 25 Nov 2026, third version): a light letter from Peter in a white card on ivory, his photo at the
-- top, the code in a soft gold box, signed in italic. One image, no emoji. (Gmail's Promotions tab is driven mostly by the
-- List-Unsubscribe headers send-emails adds to every email, not by this design.)
create or replace function public._platform_gift_email(p_first text, p_label text, p_code text)
returns jsonb language sql immutable set search_path to 'public', 'pg_temp' as $$
  select jsonb_build_object(
    'subject', 'A thank you from Peter',
    'body', 'Hi ' || p_first || ', I wanted to say thank you for being part of Gavelling, so I have put ' || p_label
      || ' of Gavelling Unlimited on your account, on the house. Your code is ' || p_code
      || '. Open gavelling.com, sign in with this email and a scratch card will be waiting for you. Peter',
    'html', '<div style="margin:0;padding:28px 14px;background:#EDE7D8;font-family:Inter,''Helvetica Neue'',Arial,sans-serif;color:#1C1410">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;margin:0 auto;background:#FFFFFF;border-radius:20px">
<tr><td style="padding:26px 26px 24px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td valign="middle" style="padding-right:12px"><img src="https://gavelling.com/PeterPic.jpg" width="48" height="48" alt="Peter Zakhar" style="display:block;border-radius:50%;object-fit:cover"></td>
    <td valign="middle"><div style="font-size:15px;font-weight:700;line-height:1.3">Peter Zakhar</div><div style="font-size:13px;color:#5A5046;line-height:1.3">Founder, Gavelling</div></td>
  </tr></table>
  <p style="margin:22px 0 0;font-size:15.5px;line-height:1.65">Hi ' || p_first || ',</p>
  <p style="margin:12px 0 0;font-size:15.5px;line-height:1.65">I wanted to say thank you for being part of Gavelling, so I have put <b>' || p_label || ' of Gavelling Unlimited</b> on your account, on the house.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;background:#FBF6E4;border:1.5px dashed #C9A640;border-radius:14px"><tr>
    <td style="padding:14px 18px">
      <div style="font-size:12.5px;color:#8A6B1E;font-weight:600">Your code</div>
      <div style="margin-top:2px;font:700 22px Menlo,Consolas,monospace;letter-spacing:.06em;color:#1C1410">' || p_code || '</div>
    </td>
    <td align="right" style="padding:14px 18px;font-size:13px;line-height:1.4;color:#5A5046">' || p_label || ' free<br>use it within a year</td>
  </tr></table>
  <p style="margin:18px 0 0;font-size:15.5px;line-height:1.65"><a href="https://gavelling.com/" style="color:#1B3828;font-weight:700;text-decoration:underline">Open Gavelling</a> and sign in with this email. A little scratch card will be waiting for you: scratch it, press Activate, and that is it.</p>
  <p style="margin:12px 0 0;font-size:15.5px;line-height:1.65">Unlimited gets you discounted conferences, the premium articles on debate, crisis and chairing, and paid chairing jobs on the Job Board.</p>
  <p style="margin:12px 0 0;font-size:15.5px;line-height:1.65">If you have a minute, hit reply and tell me how your MUN season is going. I read every one.</p>
  <p style="margin:20px 0 0;font-family:Georgia,''Times New Roman'',serif;font-style:italic;font-size:22px;color:#1B3828">Peter</p>
</td></tr>
</table>
<p style="max-width:500px;margin:12px auto 0;text-align:center;font-size:12px;color:#857A6C">You can also type the code in on Manage account, Promo code.</p>
</div>')
$$;
revoke all on function public._platform_gift_email(text, text, text) from public, anon, authenticated;

-- Service role and SQL only. Creates the single-use code, the gift row and Peter's email.
create or replace function public.admin_gift_unlimited(p_email text, p_days int, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_uid uuid; v_email text; v_promo uuid; v_code text; v_gift uuid; v_label text; v_first text; v_mail jsonb;
begin
  if p_days is null or p_days < 1 or p_days > 3650 then
    return jsonb_build_object('ok', false, 'message', 'Days must be between 1 and 3650');
  end if;
  select id, email into v_uid, v_email from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'No user with that email'); end if;

  v_code := 'GIFT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into promo_codes(code, grant_kind, amount, max_claims, claimed_count, expires_at, active, note)
  values (v_code, 'unlimited_days', p_days, 1, 0, now() + interval '1 year', true, coalesce(p_note, 'Platform gift'))
  returning id into v_promo;
  insert into crisis_gifts(crisis_id, user_id, promo_code_id, code, note)
  values (null, v_uid, v_promo, v_code, p_note) returning id into v_gift;

  -- 60 -> 2 months, 30 -> 1 month, otherwise days (the pop-up words it the same way: src/lib/gifts.ts).
  v_label := case
    when p_days % 30 = 0 then (p_days / 30)::text || case when p_days = 30 then ' month' else ' months' end
    else p_days::text || case when p_days = 1 then ' day' else ' days' end end;
  select nullif(split_part(trim(coalesce(display_name, '')), ' ', 1), '') into v_first from profiles where id = v_uid;
  v_first := replace(replace(replace(coalesce(v_first, 'there'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  v_mail := _platform_gift_email(v_first, v_label, v_code);

  insert into email_outbox(conference_id, recipient_email, subject, body, body_html, from_name, from_address, reply_to, personal)
  values (null, v_email, v_mail->>'subject', v_mail->>'body', v_mail->>'html',
    'Peter from Gavelling', 'peter@mail.gavelling.com', 'info@gavelling.com', true);

  return jsonb_build_object('ok', true, 'gift_id', v_gift, 'code', v_code);
end $$;
revoke all on function public.admin_gift_unlimited(text, int, text) from public, anon, authenticated;

-- my_unlimited_status: one more field, 'source' ('gift' for gift_ / promo: rows, else 'stripe'; null with no plan).
-- How the status is resolved is unchanged.
create or replace function public.my_unlimited_status()
returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  with cur as (
    select s.*
    from subscriptions s
    where s.owner_user_id = auth.uid()
      and s.conference_id is null
      and s.plan like 'unlimited%'
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
    order by (s.status = 'active') desc, s.current_period_end desc nulls first
    limit 1
  ), last_paid as (
    select s.plan, s.current_period_end
    from subscriptions s
    where s.owner_user_id = auth.uid()
      and s.conference_id is null
      and s.plan in ('unlimited_monthly', 'unlimited_yearly')
      and s.current_period_end is not null
      and s.current_period_end <= now()
      and s.current_period_end > now() - interval '180 days'
    order by s.current_period_end desc
    limit 1
  )
  select case when auth.uid() is null then
    jsonb_build_object('status', 'none', 'plan', null, 'current_period_end', null,
      'on_stripe', false, 'renews', false, 'cancel_at_period_end', false,
      'can_cancel', false, 'can_resume', false, 'lapsed_plan', null, 'lapsed_at', null, 'source', null)
  else coalesce((
    select jsonb_build_object(
      'status', case
        when c.status = 'trialing' or c.plan = 'unlimited_trial' then 'trial'
        when c.plan ilike '%year%' or c.plan ilike '%annual%' then 'annual'
        else 'monthly' end,
      'plan', c.plan,
      'current_period_end', c.current_period_end,
      'on_stripe', coalesce(c.stripe_subscription_id like 'sub\_%', false),
      'renews', coalesce(c.stripe_subscription_id like 'sub\_%', false) and not c.cancel_at_period_end,
      'cancel_at_period_end', c.cancel_at_period_end,
      'can_cancel', coalesce(c.stripe_subscription_id like 'sub\_%', false) and not c.cancel_at_period_end
                    and c.plan in ('unlimited_monthly', 'unlimited_yearly'),
      'can_resume', coalesce(c.stripe_subscription_id like 'sub\_%', false) and c.cancel_at_period_end,
      'lapsed_plan', null, 'lapsed_at', null,
      'source', case when c.stripe_subscription_id like 'gift\_%' or c.stripe_subscription_id like 'promo:%' then 'gift' else 'stripe' end)
    from cur c
  ), (
    select jsonb_build_object('status', 'none', 'plan', null, 'current_period_end', null,
      'on_stripe', false, 'renews', false, 'cancel_at_period_end', false,
      'can_cancel', false, 'can_resume', false,
      'lapsed_plan', (select plan from last_paid), 'lapsed_at', (select current_period_end from last_paid), 'source', null)
  )) end;
$function$;

-- Personal one-to-one emails (owner, 25 Nov 2026, applied as migration email_outbox_personal_flag): email_outbox.personal
-- (default false). send-emails v20 (source: supabase-functions/send-emails/index.ts) sends a personal row WITHOUT the
-- List-Unsubscribe / List-Unsubscribe-Post headers, which made Gmail file the gift under Promotions even as a plain letter.
-- admin_gift_unlimited now inserts its email with personal = true. Never set personal on a broadcast or a campaign.
alter table public.email_outbox add column if not exists personal boolean not null default false;
