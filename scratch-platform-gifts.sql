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

-- Service role and SQL only. Creates the single-use code, the gift row and Peter's email.
create or replace function public.admin_gift_unlimited(p_email text, p_days int, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_uid uuid; v_email text; v_promo uuid; v_code text; v_gift uuid; v_label text; v_first text; v_html text;
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

  v_html := '<div style="margin:0;padding:32px 12px;background:#EDE7D8;font-family:Inter,Arial,sans-serif;color:#1C1410">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto">
<tr><td align="center" style="padding-bottom:0">
  <span style="display:inline-block;padding:10px 20px;border-radius:999px;background:#6A1919;background-image:linear-gradient(165deg,#9A2A2A 0%,#6A1919 52%,#3A0E0F 100%);color:#FFF4E6;font-weight:800;font-size:15px;position:relative;top:14px">A Gift For You</span>
</td></tr>
<tr><td style="background:#FFFFFF;background-image:linear-gradient(180deg,#FBEDE7 0%,#FFFFFF 150px);border-radius:22px;border-top:4px solid #8E2424;padding:26px 22px 22px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="64" valign="top"><img src="https://gavelling.com/PeterPic.jpg" width="56" height="56" alt="Peter Zakhar" style="display:block;border-radius:50%;border:3px solid #FFFFFF;object-fit:cover"></td>
    <td valign="middle" style="padding-left:10px">
      <div style="font-size:11.5px;font-weight:800;color:#8E2424">From the Gavelling team</div>
      <div style="font-size:16px;font-weight:800;margin-top:2px">Peter Zakhar</div>
      <div style="font-size:12.5px;font-weight:600;color:#4E463C;margin-top:2px">Founder, Gavelling</div>
    </td>
    <td width="46" valign="top" align="right"><img src="https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Rocket/3D/rocket_3d.png" width="44" height="44" alt=""></td>
  </tr></table>
  <p style="margin:16px 0 0;font-size:14.5px;line-height:1.6;color:#4E463C">Hi ' || v_first || ',<br><br>This one is from me: ' || v_label || ' of Gavelling Unlimited, on the house. Thank you for being part of Gavelling.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border:1.5px solid #B8952E;border-radius:18px;background:#FFFFFF">
    <tr><td style="padding:14px 18px 12px;background:#FBF4DC;border-bottom:1.5px dashed #B8952E;border-radius:18px 18px 0 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="58"><img src="https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Wrapped%20gift/3D/wrapped_gift_3d.png" width="48" height="48" alt=""></td>
        <td><div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#B8952E">Gavelling Unlimited</div><div style="font-size:26px;font-weight:800;line-height:1.1;color:#8E2424">' || v_label || ' free</div></td>
        <td align="right" style="font-size:12px;font-weight:600;color:#4E463C">Use any time<br>in the next year<div style="margin-top:3px;font:700 12.5px Menlo,monospace;letter-spacing:.06em;color:#1C1410">' || v_code || '</div></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:12px 18px 14px;font-size:13.5px;line-height:1.9">
      <b>Discounted conferences</b> <span style="color:#4E463C">across Gavelling</span><br>
      <b>Premium articles</b> <span style="color:#4E463C">on debate, crisis and chairing</span><br>
      <b>Paid chairing opportunities</b> <span style="color:#4E463C">on the Job Board</span><br>
      <span style="color:#857A6C;font-size:12.5px">And more on the way</span>
    </td></tr>
  </table>
  <p style="margin:14px 0 0;text-align:center;font-size:14.5px"><a href="https://gavelling.com/" style="color:#8E2424;font-weight:800;text-decoration:underline">Open Gavelling to activate it</a></p>
  <p style="margin:6px 0 0;text-align:center;font-size:12.5px;color:#857A6C">Sign in with this email address. You can also enter the code on Manage account, Promo code.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#F8ECE8;border-radius:14px"><tr>
    <td width="52" style="padding:10px 0 10px 12px"><img src="https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/Speech%20balloon/3D/speech_balloon_3d.png" width="36" height="36" alt=""></td>
    <td style="padding:10px 12px;font-size:13.5px;line-height:1.45;color:#4E463C"><b style="color:#1C1410">Questions?</b> Just reply to this email or write to <a href="mailto:info@gavelling.com" style="color:#1C1410;font-weight:700;text-decoration:underline">info@gavelling.com</a></td>
  </tr></table>
</td></tr>
</table>
</div>';

  insert into email_outbox(conference_id, recipient_email, subject, body, body_html, from_name, from_address, reply_to)
  values (null, v_email, 'A gift for you: ' || v_label || ' of Gavelling Unlimited',
    'Your gift: ' || v_label || ' of Gavelling Unlimited. Your code is ' || v_code || '. Open gavelling.com to scratch your voucher and activate it.',
    v_html, 'Peter from Gavelling', 'peter@mail.gavelling.com', 'info@gavelling.com');

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
