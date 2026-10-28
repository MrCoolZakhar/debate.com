-- ─────────────────────────────────────────────────────────────────────────────
-- NOT APPLIED. Owner sends.
--
-- Harvard WorldMUN 2027: apply-now campaign to every Gavelling user who is not
-- connected to WorldMUN. Written 28 Oct 2026 by a Claude Code run that may not
-- change the database; nothing here has been run, and no email was queued.
--
-- Rendered email: showcase/WorldMUN campaign email.html (send before 1 Nov) and
-- "showcase/WorldMUN campaign email (after 1 Nov).html" (send from 2 Nov).
--
-- READ FIRST
--  * The live campaign engine (scratch-email-campaigns.sql, applied 8 Oct) has
--    only the audiences 'everyone' and 'announcement', and
--    _email_campaign_candidates() ignores the audience column: today EVERY
--    campaign goes to every confirmed account. So a WorldMUN-only send needs
--    section 1 first (a new audience, and the candidate function reads it).
--    It keeps 'everyone' exactly as it is. This is the chat's Supabase work.
--  * Section 2 is the insert (started_at NULL = nothing sends).
--  * Section 3 is the audience as a plain query, in both versions, with counts.
--  * Section 4 is the run book, all commented.
--  * Pacing, as for every campaign: at most 100 per run and 120 minus the rows
--    created in the last 10 minutes; the cron email-campaigns runs every 10
--    minutes, so 5,435 people take about 9 hours (3,229 about 5.5 hours).
--    Start it in the morning, and for the 1 Nov copy start it by 30 Oct so
--    the send cannot run past midnight on 1 November.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. A WorldMUN audience (needs the chat's Supabase work) ──────────────────
-- Adds a conference-scoped audience: every account that _email_campaign_candidates
-- already allows (not demo, email CONFIRMED, notify_email_marketing not false,
-- valid address, not on the global unsubscribe list via email_is_opted_out, not a
-- failed address, not already sent this campaign) MINUS anyone tied to the
-- conference: an application of any status by user_id or invited_email (imported
-- people who never signed up), the organiser and every conference_organizers row,
-- a chair of any committee, a pending or answered chair or organiser invite.
-- 'conference-nonapplicants-18' also drops people who will be under the
-- conference's minimum age (conferences.min_age, 18) on its start date; an
-- unknown date of birth is kept.
begin;

alter table public.email_campaigns add column if not exists audience_conference_id uuid references public.conferences(id);
alter table public.email_campaigns drop constraint if exists email_campaigns_audience_check;
alter table public.email_campaigns add constraint email_campaigns_audience_check
  check (audience in ('everyone', 'announcement', 'conference-nonapplicants', 'conference-nonapplicants-18'));
alter table public.email_campaigns add constraint email_campaigns_audience_conference_check
  check (audience not like 'conference-nonapplicants%' or audience_conference_id is not null);

create or replace function public._email_campaign_candidates(p_campaign uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, lower(btrim(p.email))
    from profiles p
    join auth.users u on u.id = p.id
    join email_campaigns c on c.id = p_campaign
    left join conferences wm on wm.id = c.audience_conference_id
   where not p.is_demo
     and u.email_confirmed_at is not null
     and coalesce(p.notify_email_marketing, true)
     and p.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     and not exists (select 1 from email_campaign_recipients r
                      where r.campaign_id = p_campaign and not r.is_test
                        and (r.user_id = p.id or lower(r.email) = lower(btrim(p.email))))
     and not public.email_is_opted_out(p.email)
     and not public.email_address_failed(p.email)
     and (
       c.audience in ('everyone', 'announcement')
       or (
         c.audience in ('conference-nonapplicants', 'conference-nonapplicants-18')
         and wm.id is not null
         and not exists (select 1 from applications a where a.conference_id = wm.id
                          and (a.user_id = p.id or lower(btrim(a.invited_email)) = lower(btrim(p.email))))
         and not exists (select 1 from conference_organizers o where o.conference_id = wm.id and o.user_id = p.id)
         and wm.organizer_id is distinct from p.id
         and not exists (select 1 from conference_committees cc where cc.conference_id = wm.id and p.id = any(cc.chair_user_ids))
         and not exists (select 1 from conference_chair_invites i where i.conference_id = wm.id
                          and (i.invited_user_id = p.id or lower(btrim(i.email)) = lower(btrim(p.email))))
         and not exists (select 1 from conference_organizer_invites i where i.conference_id = wm.id
                          and (i.invited_user_id = p.id or lower(btrim(i.email)) = lower(btrim(p.email))))
         and (c.audience = 'conference-nonapplicants'
              or p.date_of_birth is null
              or p.date_of_birth <= (wm.start_date - make_interval(years => coalesce(wm.min_age, 18)))::date)
       )
     )
   order by md5(p_campaign::text || p.id::text)
$$;
revoke all on function public._email_campaign_candidates(uuid) from public, anon, authenticated;

commit;

-- ── 2. The campaign (started_at NULL: registers the copy only) ───────────────
-- Variant A: for a send on or before 1 Nov 2026 ("$150 until 1 November").
-- Subject options (pick one, edit the subject below if you prefer the other):
--   1. Riga, 14 to 18 March: apply to Harvard WorldMUN 2027
--   2. WorldMUN 2027 is in Riga, and the price is $150 until 1 November
-- Preheader (hidden text inside the body): "Riga, 14 to 18 March 2027. Applying on Gavelling is free, and you pay only after you are accepted."
insert into public.email_campaigns
  (slug, subject, from_name, reply_to, body_html, body_text, links, audience, audience_conference_id, per_run, started_at)
values (
  $nl$worldmun-2027-apply$nl$,
  $nl$Riga, 14 to 18 March: apply to Harvard WorldMUN 2027$nl$,
  'Peter at Gavelling',
  'wearegavelling@gmail.com',
  $nl$<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>Riga, 14 to 18 March: apply to Harvard WorldMUN 2027</title>
<style>
@media (max-width:600px){
  .h1{font-size:30px!important}
  .h2{font-size:20px!important}
  .pad{padding:20px 16px!important}
  .inner{padding-left:4px!important;padding-right:4px!important}
}
</style></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Riga, 14 to 18 March 2027. Applying on Gavelling is free, and you pay only after you are accepted.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr>
<td class="pad" align="center" style="padding:28px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr>
<td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1C1410;">

  <a href="https://gavelling.com/r/{{CLICK_TOKEN}}/home" style="text-decoration:none;">
    <img src="https://gavelling.com/gavelling-lockup.png" width="156" alt="Gavelling" style="display:block;width:156px;height:auto;margin:0 0 26px;border:0;">
  </a>

  <!-- Hero: Riga, with the conference logo over its lower edge -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#E4DCC8" style="background-color:#E4DCC8;line-height:0;font-size:0;border-radius:18px;">
    <a href="https://gavelling.com/r/{{CLICK_TOKEN}}/conference" style="text-decoration:none;"><img src="https://luruhkwrgisytejswlas.supabase.co/storage/v1/render/image/public/conference-assets/banners/d9cda4bb-5a39-4882-8812-e83ba8fe0be2-1784993657399.webp?width=1200&height=300&resize=cover" width="560" alt="Riga, Latvia, seen from above: the Dom cathedral and the Daugava river" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:18px;"></a>
  </td></tr>
  <tr><td align="center" style="padding:0;line-height:0;font-size:0;">
    <div style="margin-top:-38px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
        <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-radius:50%;padding:4px;box-shadow:0 3px 10px rgba(10,24,16,0.22);line-height:0;font-size:0;">
          <img src="https://luruhkwrgisytejswlas.supabase.co/storage/v1/object/public/conference-assets/logos/d9cda4bb-5a39-4882-8812-e83ba8fe0be2-1784159591121.png" width="72" height="72" alt="Harvard WorldMUN logo" style="display:block;width:72px;height:72px;border:0;border-radius:50%;">
        </td></tr></table>
    </div>
  </td></tr></table>

  <p style="margin:16px 0 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;color:#8A6414;">Harvard WorldMUN 2027</p>
  <h1 class="h1" style="margin:0 0 18px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:36px;line-height:1.12;font-weight:bold;color:#1C1410;">
    Come to Riga for <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:normal;color:#B6871F;">WorldMUN</span>
  </h1>

  <!-- The price line (variant) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>
    <td bgcolor="#F6F1E4" style="background-color:#F6F1E4;border-left:4px solid #B6871F;border-radius:0 14px 14px 0;padding:16px 20px;font-family:Arial,Helvetica,sans-serif;">
      <div style="font-size:19px;line-height:1.3;font-weight:bold;color:#1B3828;">The delegate price is $150 until 1&nbsp;November.</div>
      <div style="font-size:14px;line-height:1.55;color:#4A4238;padding-top:6px;">It steps up to $165 on 2&nbsp;November. Applying is free, and you pay only after you are accepted.</div>
    </td></tr></table>

  <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#4A4238;">WorldMUN travels to a new city every year. In March 2027 it comes to Riga for five days of committees with about 1,000 university students from around the world. It is the first WorldMUN in Eastern Europe since Budapest in 1997, and applications are open on Gavelling.</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;border-top:1px solid #ECE5D6;border-bottom:1px solid #ECE5D6;">
    <tr><td valign="middle" style="padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">When</td><td valign="middle" align="right" style="padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">14 to 18 March 2027</td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">Where</td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">Riga, Latvia</td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">Format</td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">In person, university level</td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">Age</td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">18 or over</td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">Delegates</td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">About 1,000 expected</td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">Apply by</td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">14 February 2027</td></tr>
  </table>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 40px;"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#1B3828" style="background-color:#1B3828;border-radius:12px;"><a href="https://gavelling.com/r/{{CLICK_TOKEN}}/apply" target="_blank" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px;">Apply now</a></td></tr></table>
  </td></tr></table>

  <!-- How paying works -->
  <p class="h2" style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.25;font-weight:bold;color:#1C1410;">How Paying Works</p>
  <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#4A4238;">Applying costs nothing. Gavelling covers the application credit for WorldMUN, so you can apply for free.</p>
  <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#4A4238;">You pay the conference fee only after WorldMUN accepts you. The fee is the price step that is current on the day you pay, so the sooner you are accepted and pay, the longer you stay on the step you saw.</p>
  <p style="margin:0 0 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#4A4238;">If you are not accepted, you never pay a fee.</p>

  <!-- Timeline with payments -->
  <p class="h2" style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.25;font-weight:bold;color:#1C1410;">Price Steps And Dates</p>
  <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#4A4238;">Delegate and head delegate fees, in US dollars.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;border:1px solid #ECE5D6;border-radius:14px;border-collapse:separate;">
    <tr><td valign="middle" style="padding:12px 12px 12px 18px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;line-height:1.3;color:#8C7E6E;">Priority 1</div><div style="font-size:13px;line-height:1.4;color:#8C7E6E;padding-top:2px;">17 July to 4 October, ended</div></td><td valign="middle" align="right" style="padding:12px 14px 12px 0;font-family:Arial,Helvetica,sans-serif;text-align:right;"><span style="font-size:16px;line-height:1.2;color:#8C7E6E;text-decoration:line-through;">$125</span></td></tr><tr><td valign="middle" bgcolor="#F6F1E4" style="background-color:#F6F1E4;border-left:4px solid #B6871F;border-top:1px solid #ECE5D6;padding:14px 12px 14px 14px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:16px;line-height:1.3;font-weight:bold;color:#1B3828;">Priority 2<span style="font-size:11px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#8A6414;">&nbsp;&nbsp;Current price</span></div><div style="font-size:13px;line-height:1.4;color:#4A4238;padding-top:2px;">5 October to 1 November</div></td><td valign="middle" align="right" bgcolor="#F6F1E4" style="background-color:#F6F1E4;border-top:1px solid #ECE5D6;padding:14px 14px 14px 0;font-family:Arial,Helvetica,sans-serif;text-align:right;"><span style="font-size:24px;line-height:1.2;font-weight:bold;color:#1B3828;">$150</span></td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:12px 12px 12px 18px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;line-height:1.3;font-weight:bold;color:#1C1410;">Priority 3</div><div style="font-size:13px;line-height:1.4;color:#4A4238;padding-top:2px;">2 November to 1 December</div></td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:12px 14px 12px 0;font-family:Arial,Helvetica,sans-serif;text-align:right;"><span style="font-size:18px;line-height:1.2;font-weight:bold;color:#1C1410;">$165</span></td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:12px 12px 12px 18px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;line-height:1.3;font-weight:bold;color:#1C1410;">Regular</div><div style="font-size:13px;line-height:1.4;color:#4A4238;padding-top:2px;">2 December to 14 February</div></td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:12px 14px 12px 0;font-family:Arial,Helvetica,sans-serif;text-align:right;"><span style="font-size:18px;line-height:1.2;font-weight:bold;color:#1C1410;">$195</span></td></tr><tr><td colspan="2" valign="middle" style="border-top:1px solid #ECE5D6;padding:12px 12px 12px 18px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;line-height:1.3;font-weight:bold;color:#1C1410;">Applications close: 14 February 2027</div><div style="font-size:13px;line-height:1.4;color:#4A4238;padding-top:2px;">Last day to apply</div></td></tr><tr><td colspan="2" valign="middle" style="border-top:1px solid #ECE5D6;padding:12px 12px 12px 18px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;line-height:1.3;font-weight:bold;color:#1C1410;">WorldMUN in Riga</div><div style="font-size:13px;line-height:1.4;color:#4A4238;padding-top:2px;">14 to 18 March 2027</div></td></tr>
  </table>
  <p style="margin:0 0 34px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#4A4238;">Faculty advisors pay $90 and observers pay $85, whatever the date. <a href="https://gavelling.com/r/{{CLICK_TOKEN}}/advisor" style="color:#1B3828;font-weight:bold;text-decoration:underline;">Apply as a faculty advisor</a> or <a href="https://gavelling.com/r/{{CLICK_TOKEN}}/observer" style="color:#1B3828;font-weight:bold;text-decoration:underline;">apply as an observer</a>.</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 36px;background:#F6F1E4;border-radius:18px;"><tr>
  <td align="center" style="padding:28px 26px;">
    <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:1.25;font-weight:bold;color:#1B3828;">Ready To Apply?</p>
    <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#4A4238;">It takes a few minutes, and you can see your status on Gavelling as soon as you send it.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#1B3828" style="background-color:#1B3828;border-radius:12px;"><a href="https://gavelling.com/r/{{CLICK_TOKEN}}/apply" target="_blank" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px;">Apply now</a></td></tr></table></td></tr></table>
    <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#4A4238;"><a href="https://gavelling.com/r/{{CLICK_TOKEN}}/conference" style="color:#1B3828;font-weight:bold;text-decoration:underline;">See the conference page</a></p>
  </td></tr></table>

  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#4A4238;">See you in committee,</p>
  <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;"><strong style="color:#1C1410;">Peter and Christian</strong><br>
    <span style="color:#55483C;">Founders of Gavelling</span></p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:34px 0 0;border-top:1px solid #ECE5D6;"><tr>
  <td style="padding:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8C7E6E;">
    <a href="https://www.instagram.com/wearegavelling/" style="color:#8C7E6E;font-weight:bold;">Instagram</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="https://www.linkedin.com/company/gavelling/" style="color:#8C7E6E;font-weight:bold;">LinkedIn</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="https://gavelling.com/r/{{CLICK_TOKEN}}/home" style="color:#8C7E6E;font-weight:bold;">gavelling.com</a><br>
    You are receiving this because you have a Gavelling account. <a href="{{UNSUBSCRIBE_URL}}" style="color:#8C7E6E;">Unsubscribe</a><br>
    GAVELLING LTD &middot; Registered in England &amp; Wales no. 17337652 &middot; Registered office: Flat 33 Doughty Court, Prusom Street, London, England, E1W 3RT
  </td></tr></table>

</td></tr></table>
</td></tr></table>
</body></html>
$nl$,
  $nl$Harvard WorldMUN 2027
Come to Riga for WorldMUN

The delegate price is $150 until 1 November.
It steps up to $165 on 2 November. Applying is free, and you pay only after you are accepted.

WorldMUN travels to a new city every year. In March 2027 it comes to Riga for five days of committees with about 1,000 university students from around the world. It is the first WorldMUN in Eastern Europe since Budapest in 1997, and applications are open on Gavelling.

When: 14 to 18 March 2027
Where: Riga, Latvia
Format: In person, university level
Age: 18 or over
Delegates: About 1,000 expected
Apply by: 14 February 2027

Apply now: https://gavelling.com/r/{{CLICK_TOKEN}}/apply

HOW PAYING WORKS
Applying costs nothing. Gavelling covers the application credit for WorldMUN, so you can apply for free.
You pay the conference fee only after WorldMUN accepts you. The fee is the price step that is current on the day you pay, so the sooner you are accepted and pay, the longer you stay on the step you saw.
If you are not accepted, you never pay a fee.

PRICE STEPS AND DATES (delegate and head delegate fees, in US dollars)
  Priority 1: $125, 17 July to 4 October (ended)
  Priority 2: $150, 5 October to 1 November (current price)
  Priority 3: $165, 2 November to 1 December
  Regular: $195, 2 December to 14 February
  Applications close: 14 February 2027
  WorldMUN in Riga: 14 to 18 March 2027

Faculty advisors pay $90 and observers pay $85, whatever the date.
Apply as a faculty advisor: https://gavelling.com/r/{{CLICK_TOKEN}}/advisor
Apply as an observer: https://gavelling.com/r/{{CLICK_TOKEN}}/observer

See the conference page: https://gavelling.com/r/{{CLICK_TOKEN}}/conference

See you in committee,
Peter and Christian
Founders of Gavelling

gavelling.com: https://gavelling.com/r/{{CLICK_TOKEN}}/home
You are receiving this because you have a Gavelling account.
Unsubscribe: {{UNSUBSCRIBE_URL}}
GAVELLING LTD, Registered in England & Wales no. 17337652. Registered office: Flat 33 Doughty Court, Prusom Street, London, England, E1W 3RT$nl$,
  $nl${"home": "https://gavelling.com/", "apply": "https://gavelling.com/conferences/worldmun/apply", "conference": "https://gavelling.com/conferences/worldmun", "advisor": "https://gavelling.com/conferences/worldmun/apply?role=faculty-advisor", "observer": "https://gavelling.com/conferences/worldmun/apply?role=observer"}$nl$::jsonb,
  'conference-nonapplicants',            -- or 'conference-nonapplicants-18' (owner chooses, see section 2)
  'd9cda4bb-5a39-4882-8812-e83ba8fe0be2',
  100,
  null                                   -- NULL: nothing is queued until the owner sets started_at
)
on conflict (slug) do update
   set subject = excluded.subject, body_html = excluded.body_html, body_text = excluded.body_text,
       links = excluded.links, audience = excluded.audience, audience_conference_id = excluded.audience_conference_id
 where public.email_campaigns.started_at is null;

-- Variant B: for a send from 2 Nov 2026 ("$165 until 1 December"). Use INSTEAD of
-- variant A (never both): uncomment this one and leave A out.
-- Subject options: 1. Riga, 14 to 18 March: apply to Harvard WorldMUN 2027
--                  2. WorldMUN 2027 is in Riga, and the price is $165 until 1 December
-- insert into public.email_campaigns
--   (slug, subject, from_name, reply_to, body_html, body_text, links, audience, audience_conference_id, per_run, started_at)
-- values (
--   $nl$worldmun-2027-apply$nl$,
--   $nl$Riga, 14 to 18 March: apply to Harvard WorldMUN 2027$nl$,
--   'Peter at Gavelling',
--   'wearegavelling@gmail.com',
--   $nl$<!doctype html>
-- <html lang="en"><head>
-- <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
-- <meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
-- <title>Riga, 14 to 18 March: apply to Harvard WorldMUN 2027</title>
-- <style>
-- @media (max-width:600px){
--   .h1{font-size:30px!important}
--   .h2{font-size:20px!important}
--   .pad{padding:20px 16px!important}
--   .inner{padding-left:4px!important;padding-right:4px!important}
-- }
-- </style></head>
-- <body style="margin:0;padding:0;background:#ffffff;">
-- <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Riga, 14 to 18 March 2027. Applying on Gavelling is free, and you pay only after you are accepted.</div>
-- <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr>
-- <td class="pad" align="center" style="padding:28px 16px;">
-- <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr>
-- <td style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1C1410;">
-- 
--   <a href="https://gavelling.com/r/{{CLICK_TOKEN}}/home" style="text-decoration:none;">
--     <img src="https://gavelling.com/gavelling-lockup.png" width="156" alt="Gavelling" style="display:block;width:156px;height:auto;margin:0 0 26px;border:0;">
--   </a>
-- 
--   <!-- Hero: Riga, with the conference logo over its lower edge -->
--   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#E4DCC8" style="background-color:#E4DCC8;line-height:0;font-size:0;border-radius:18px;">
--     <a href="https://gavelling.com/r/{{CLICK_TOKEN}}/conference" style="text-decoration:none;"><img src="https://luruhkwrgisytejswlas.supabase.co/storage/v1/render/image/public/conference-assets/banners/d9cda4bb-5a39-4882-8812-e83ba8fe0be2-1784993657399.webp?width=1200&height=300&resize=cover" width="560" alt="Riga, Latvia, seen from above: the Dom cathedral and the Daugava river" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:18px;"></a>
--   </td></tr>
--   <tr><td align="center" style="padding:0;line-height:0;font-size:0;">
--     <div style="margin-top:-38px;">
--       <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
--         <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-radius:50%;padding:4px;box-shadow:0 3px 10px rgba(10,24,16,0.22);line-height:0;font-size:0;">
--           <img src="https://luruhkwrgisytejswlas.supabase.co/storage/v1/object/public/conference-assets/logos/d9cda4bb-5a39-4882-8812-e83ba8fe0be2-1784159591121.png" width="72" height="72" alt="Harvard WorldMUN logo" style="display:block;width:72px;height:72px;border:0;border-radius:50%;">
--         </td></tr></table>
--     </div>
--   </td></tr></table>
-- 
--   <p style="margin:16px 0 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;color:#8A6414;">Harvard WorldMUN 2027</p>
--   <h1 class="h1" style="margin:0 0 18px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:36px;line-height:1.12;font-weight:bold;color:#1C1410;">
--     Come to Riga for <span style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:normal;color:#B6871F;">WorldMUN</span>
--   </h1>
-- 
--   <!-- The price line (variant) -->
--   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr>
--     <td bgcolor="#F6F1E4" style="background-color:#F6F1E4;border-left:4px solid #B6871F;border-radius:0 14px 14px 0;padding:16px 20px;font-family:Arial,Helvetica,sans-serif;">
--       <div style="font-size:19px;line-height:1.3;font-weight:bold;color:#1B3828;">The delegate price is $165 until 1&nbsp;December.</div>
--       <div style="font-size:14px;line-height:1.55;color:#4A4238;padding-top:6px;">It steps up to $195 on 2&nbsp;December. Applying is free, and you pay only after you are accepted.</div>
--     </td></tr></table>
-- 
--   <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#4A4238;">WorldMUN travels to a new city every year. In March 2027 it comes to Riga for five days of committees with about 1,000 university students from around the world. It is the first WorldMUN in Eastern Europe since Budapest in 1997, and applications are open on Gavelling.</p>
-- 
--   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;border-top:1px solid #ECE5D6;border-bottom:1px solid #ECE5D6;">
--     <tr><td valign="middle" style="padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">When</td><td valign="middle" align="right" style="padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">14 to 18 March 2027</td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">Where</td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">Riga, Latvia</td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">Format</td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">In person, university level</td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">Age</td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">18 or over</td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">Delegates</td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">About 1,000 expected</td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:11px 12px 11px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#4A4238;">Apply by</td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:11px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.4;font-weight:bold;color:#1C1410;text-align:right;">14 February 2027</td></tr>
--   </table>
-- 
--   <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 40px;"><tr><td align="center">
--     <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#1B3828" style="background-color:#1B3828;border-radius:12px;"><a href="https://gavelling.com/r/{{CLICK_TOKEN}}/apply" target="_blank" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px;">Apply now</a></td></tr></table>
--   </td></tr></table>
-- 
--   <!-- How paying works -->
--   <p class="h2" style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.25;font-weight:bold;color:#1C1410;">How Paying Works</p>
--   <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#4A4238;">Applying costs nothing. Gavelling covers the application credit for WorldMUN, so you can apply for free.</p>
--   <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#4A4238;">You pay the conference fee only after WorldMUN accepts you. The fee is the price step that is current on the day you pay, so the sooner you are accepted and pay, the longer you stay on the step you saw.</p>
--   <p style="margin:0 0 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#4A4238;">If you are not accepted, you never pay a fee.</p>
-- 
--   <!-- Timeline with payments -->
--   <p class="h2" style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.25;font-weight:bold;color:#1C1410;">Price Steps And Dates</p>
--   <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#4A4238;">Delegate and head delegate fees, in US dollars.</p>
--   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;border:1px solid #ECE5D6;border-radius:14px;border-collapse:separate;">
--     <tr><td valign="middle" style="padding:12px 12px 12px 18px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;line-height:1.3;color:#8C7E6E;">Priority 1</div><div style="font-size:13px;line-height:1.4;color:#8C7E6E;padding-top:2px;">17 July to 4 October, ended</div></td><td valign="middle" align="right" style="padding:12px 14px 12px 0;font-family:Arial,Helvetica,sans-serif;text-align:right;"><span style="font-size:16px;line-height:1.2;color:#8C7E6E;text-decoration:line-through;">$125</span></td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:12px 12px 12px 18px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;line-height:1.3;color:#8C7E6E;">Priority 2</div><div style="font-size:13px;line-height:1.4;color:#8C7E6E;padding-top:2px;">5 October to 1 November, ended</div></td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:12px 14px 12px 0;font-family:Arial,Helvetica,sans-serif;text-align:right;"><span style="font-size:16px;line-height:1.2;color:#8C7E6E;text-decoration:line-through;">$150</span></td></tr><tr><td valign="middle" bgcolor="#F6F1E4" style="background-color:#F6F1E4;border-left:4px solid #B6871F;border-top:1px solid #ECE5D6;padding:14px 12px 14px 14px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:16px;line-height:1.3;font-weight:bold;color:#1B3828;">Priority 3<span style="font-size:11px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#8A6414;">&nbsp;&nbsp;Current price</span></div><div style="font-size:13px;line-height:1.4;color:#4A4238;padding-top:2px;">2 November to 1 December</div></td><td valign="middle" align="right" bgcolor="#F6F1E4" style="background-color:#F6F1E4;border-top:1px solid #ECE5D6;padding:14px 14px 14px 0;font-family:Arial,Helvetica,sans-serif;text-align:right;"><span style="font-size:24px;line-height:1.2;font-weight:bold;color:#1B3828;">$165</span></td></tr><tr><td valign="middle" style="border-top:1px solid #ECE5D6;padding:12px 12px 12px 18px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;line-height:1.3;font-weight:bold;color:#1C1410;">Regular</div><div style="font-size:13px;line-height:1.4;color:#4A4238;padding-top:2px;">2 December to 14 February</div></td><td valign="middle" align="right" style="border-top:1px solid #ECE5D6;padding:12px 14px 12px 0;font-family:Arial,Helvetica,sans-serif;text-align:right;"><span style="font-size:18px;line-height:1.2;font-weight:bold;color:#1C1410;">$195</span></td></tr><tr><td colspan="2" valign="middle" style="border-top:1px solid #ECE5D6;padding:12px 12px 12px 18px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;line-height:1.3;font-weight:bold;color:#1C1410;">Applications close: 14 February 2027</div><div style="font-size:13px;line-height:1.4;color:#4A4238;padding-top:2px;">Last day to apply</div></td></tr><tr><td colspan="2" valign="middle" style="border-top:1px solid #ECE5D6;padding:12px 12px 12px 18px;font-family:Arial,Helvetica,sans-serif;"><div style="font-size:15px;line-height:1.3;font-weight:bold;color:#1C1410;">WorldMUN in Riga</div><div style="font-size:13px;line-height:1.4;color:#4A4238;padding-top:2px;">14 to 18 March 2027</div></td></tr>
--   </table>
--   <p style="margin:0 0 34px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#4A4238;">Faculty advisors pay $90 and observers pay $85, whatever the date. <a href="https://gavelling.com/r/{{CLICK_TOKEN}}/advisor" style="color:#1B3828;font-weight:bold;text-decoration:underline;">Apply as a faculty advisor</a> or <a href="https://gavelling.com/r/{{CLICK_TOKEN}}/observer" style="color:#1B3828;font-weight:bold;text-decoration:underline;">apply as an observer</a>.</p>
-- 
--   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 36px;background:#F6F1E4;border-radius:18px;"><tr>
--   <td align="center" style="padding:28px 26px;">
--     <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:1.25;font-weight:bold;color:#1B3828;">Ready To Apply?</p>
--     <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#4A4238;">It takes a few minutes, and you can see your status on Gavelling as soon as you send it.</p>
--     <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#1B3828" style="background-color:#1B3828;border-radius:12px;"><a href="https://gavelling.com/r/{{CLICK_TOKEN}}/apply" target="_blank" style="display:inline-block;padding:14px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px;">Apply now</a></td></tr></table></td></tr></table>
--     <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#4A4238;"><a href="https://gavelling.com/r/{{CLICK_TOKEN}}/conference" style="color:#1B3828;font-weight:bold;text-decoration:underline;">See the conference page</a></p>
--   </td></tr></table>
-- 
--   <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#4A4238;">See you in committee,</p>
--   <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;"><strong style="color:#1C1410;">Peter and Christian</strong><br>
--     <span style="color:#55483C;">Founders of Gavelling</span></p>
-- 
--   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:34px 0 0;border-top:1px solid #ECE5D6;"><tr>
--   <td style="padding:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8C7E6E;">
--     <a href="https://www.instagram.com/wearegavelling/" style="color:#8C7E6E;font-weight:bold;">Instagram</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="https://www.linkedin.com/company/gavelling/" style="color:#8C7E6E;font-weight:bold;">LinkedIn</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="https://gavelling.com/r/{{CLICK_TOKEN}}/home" style="color:#8C7E6E;font-weight:bold;">gavelling.com</a><br>
--     You are receiving this because you have a Gavelling account. <a href="{{UNSUBSCRIBE_URL}}" style="color:#8C7E6E;">Unsubscribe</a><br>
--     GAVELLING LTD &middot; Registered in England &amp; Wales no. 17337652 &middot; Registered office: Flat 33 Doughty Court, Prusom Street, London, England, E1W 3RT
--   </td></tr></table>
-- 
-- </td></tr></table>
-- </td></tr></table>
-- </body></html>
-- $nl$,
--   $nl$Harvard WorldMUN 2027
-- Come to Riga for WorldMUN
-- 
-- The delegate price is $165 until 1 December.
-- It steps up to $195 on 2 December. Applying is free, and you pay only after you are accepted.
-- 
-- WorldMUN travels to a new city every year. In March 2027 it comes to Riga for five days of committees with about 1,000 university students from around the world. It is the first WorldMUN in Eastern Europe since Budapest in 1997, and applications are open on Gavelling.
-- 
-- When: 14 to 18 March 2027
-- Where: Riga, Latvia
-- Format: In person, university level
-- Age: 18 or over
-- Delegates: About 1,000 expected
-- Apply by: 14 February 2027
-- 
-- Apply now: https://gavelling.com/r/{{CLICK_TOKEN}}/apply
-- 
-- HOW PAYING WORKS
-- Applying costs nothing. Gavelling covers the application credit for WorldMUN, so you can apply for free.
-- You pay the conference fee only after WorldMUN accepts you. The fee is the price step that is current on the day you pay, so the sooner you are accepted and pay, the longer you stay on the step you saw.
-- If you are not accepted, you never pay a fee.
-- 
-- PRICE STEPS AND DATES (delegate and head delegate fees, in US dollars)
--   Priority 1: $125, 17 July to 4 October (ended)
--   Priority 2: $150, 5 October to 1 November (ended)
--   Priority 3: $165, 2 November to 1 December (current price)
--   Regular: $195, 2 December to 14 February
--   Applications close: 14 February 2027
--   WorldMUN in Riga: 14 to 18 March 2027
-- 
-- Faculty advisors pay $90 and observers pay $85, whatever the date.
-- Apply as a faculty advisor: https://gavelling.com/r/{{CLICK_TOKEN}}/advisor
-- Apply as an observer: https://gavelling.com/r/{{CLICK_TOKEN}}/observer
-- 
-- See the conference page: https://gavelling.com/r/{{CLICK_TOKEN}}/conference
-- 
-- See you in committee,
-- Peter and Christian
-- Founders of Gavelling
-- 
-- gavelling.com: https://gavelling.com/r/{{CLICK_TOKEN}}/home
-- You are receiving this because you have a Gavelling account.
-- Unsubscribe: {{UNSUBSCRIBE_URL}}
-- GAVELLING LTD, Registered in England & Wales no. 17337652. Registered office: Flat 33 Doughty Court, Prusom Street, London, England, E1W 3RT$nl$,
--   $nl${"home": "https://gavelling.com/", "apply": "https://gavelling.com/conferences/worldmun/apply", "conference": "https://gavelling.com/conferences/worldmun", "advisor": "https://gavelling.com/conferences/worldmun/apply?role=faculty-advisor", "observer": "https://gavelling.com/conferences/worldmun/apply?role=observer"}$nl$::jsonb,
--   'conference-nonapplicants',            -- or 'conference-nonapplicants-18' (owner chooses, see section 2)
--   'd9cda4bb-5a39-4882-8812-e83ba8fe0be2',
--   100,
--   null                                   -- NULL: nothing is queued until the owner sets started_at
-- )
-- on conflict (slug) do update
--    set subject = excluded.subject, body_html = excluded.body_html, body_text = excluded.body_text,
--        links = excluded.links, audience = excluded.audience, audience_conference_id = excluded.audience_conference_id
--  where public.email_campaigns.started_at is null;
-- 
-- ── 3. The audience as a plain query (SELECT only; counts as of 28 Oct 2026) ──
-- Same rules as section 1. Run each count on its own to check before sending.
--
--   everyone with a usable address (the base)                  5,646
--   minus anyone tied to WorldMUN (applied by user_id or
--   invited_email: 203; plus organiser, team, chairs, invites)   -211
--   VERSION 1, all non-applicants                               5,435
--   VERSION 2, 18 or over on 14 Mar 2027 (born on or before
--   14 Mar 2009; unknown date of birth kept)                    3,229
--        of which 2,306 have a known date of birth of 18+ and 923 have none;
--        2,206 are under 18 and left out.
--   VERSION 3 (for information): version 2 without anyone who says
--   high school as their education level                        2,245
--
-- with wm as (select id, start_date, coalesce(min_age, 18) min_age, organizer_id from conferences where slug = 'worldmun'),
-- base as (
--   select p.id, lower(btrim(p.email)) email, p.date_of_birth
--     from profiles p join auth.users u on u.id = p.id
--    where not p.is_demo and u.email_confirmed_at is not null
--      and coalesce(p.notify_email_marketing, true)
--      and p.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
--      and not public.email_is_opted_out(p.email)        -- global unsubscribe (email_optouts, scope all)
--      and not public.email_address_failed(p.email)      -- bounced or unsendable addresses
-- ),
-- aud as (
--   select b.* from base b, wm
--    where not exists (select 1 from applications a where a.conference_id = wm.id
--                       and (a.user_id = b.id or lower(btrim(a.invited_email)) = b.email))
--      and not exists (select 1 from conference_organizers o where o.conference_id = wm.id and o.user_id = b.id)
--      and wm.organizer_id is distinct from b.id
--      and not exists (select 1 from conference_committees cc where cc.conference_id = wm.id and b.id = any(cc.chair_user_ids))
--      and not exists (select 1 from conference_chair_invites i where i.conference_id = wm.id
--                       and (i.invited_user_id = b.id or lower(btrim(i.email)) = b.email))
--      and not exists (select 1 from conference_organizer_invites i where i.conference_id = wm.id
--                       and (i.invited_user_id = b.id or lower(btrim(i.email)) = b.email))
-- )
-- select count(*) as version_1_all,
--        count(*) filter (where date_of_birth is null
--                            or date_of_birth <= (select (start_date - make_interval(years => min_age))::date from wm)) as version_2_18plus
--   from aud;

-- ── 4. Run book (all commented; the owner runs these) ─────────────────────────
-- Preview: queue_email_campaign(slug) defaults to p_preview = true. Its body
-- (read 28 Oct 2026) returns BEFORE the first write: it reads email_campaigns,
-- counts email_outbox rows, counts _email_campaign_candidates() and returns a
-- jsonb with the counts and five sample addresses. It does not call
-- unsubscribe_token_for, inserts nothing, and sends nothing. NEVER pass false:
-- p_preview false queues real email.
-- select public.queue_email_campaign('worldmun-2027-apply');
--
-- Test: ONE copy to the team inbox. CALLING THIS SENDS (to that address only; a
-- test row never blocks the real send). Prefix "[Test] " is added to the subject.
-- select public.queue_email_campaign_test('worldmun-2027-apply', 'wearegavelling@gmail.com');
--
-- Choose the audience before starting (default in the insert is version 1):
-- update public.email_campaigns set audience = 'conference-nonapplicants-18'
--  where slug = 'worldmun-2027-apply' and started_at is null;
--
-- Start (the email-campaigns cron then queues up to 100 every 10 minutes):
-- update public.email_campaigns set started_at = now() where slug = 'worldmun-2027-apply' and started_at is null;
--
-- Pause / resume:
-- update public.email_campaigns set paused_at = now()  where slug = 'worldmun-2027-apply';
-- update public.email_campaigns set paused_at = null   where slug = 'worldmun-2027-apply';
-- Stop everything: select public.email_pause('why');   -- see CLAUDE.md section 6
--
-- Report: select public.admin_email_campaign_report('worldmun-2027-apply');  -- platform admin session
