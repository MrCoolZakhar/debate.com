-- Founder reports (owner, 16 Nov 2026)
--
-- 1. The daily numbers email, redesigned and cut down to what matters every day:
--    critical problems first (red), then the day in tiles, the conferences added
--    (organisers' and Gavelling listings, with flags), imported delegates and how
--    many still have not registered, money in, and a short "Keep an eye on" list.
--    It folds in the money check (12:10) and the error, cron and email health
--    signals, so one email says whether anything is wrong.
-- 2. A monthly report on the 1st (08:00 UTC) about the month before, compared
--    with the month before that, with a written analysis.
--
-- Moved out of the daily email (they change slowly; the monthly carries them):
-- what organisers say they want, public / private split, active of total,
-- outstanding money per currency, Stripe Connect not complete, unconfirmed
-- accounts (and the three oldest addresses: no personal data in the email any
-- more), the auth failure breakdown, email sent / pending counts.
--
-- APPLIED 16 Nov 2026 from Claude Code with Peter's one-off approval (migration
-- founder_reports_daily_redesign_and_monthly, then the leaderless fee rule patched in).
-- Safe to re-run. Nothing here sends on apply. Test sends go only to the team
-- inbox: select public.compose_daily_platform_report('wearegavelling@gmail.com');
--                select public.compose_monthly_platform_report('wearegavelling@gmail.com');
-- A test is marked [Test] and skips the once-a-day / once-a-month guard.
-- Rollback: drop the two new compose functions, rename
-- compose_daily_platform_report_v2() back, unschedule monthly-platform-report.

-- ── Keep the current daily composer for rollback ─────────────────────────────
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'compose_daily_platform_report'
                and pg_get_function_identity_arguments(p.oid) = '') then
    alter function public.compose_daily_platform_report() rename to compose_daily_platform_report_v2;
  end if;
end $$;

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Country name (as stored on conferences / profiles) to ISO 3166 alpha-2, only
-- when a round flag exists for it in the email assets.
create or replace function public.rpt_iso2(p_country text)
returns text language sql stable security definer set search_path to 'public', 'storage', 'pg_temp' as $$
  select coalesce(
    (select upper(substring(o.name from 'flags/([a-z]{2})\.png'))
       from storage.objects o
      where o.bucket_id = 'email-assets' and o.name ~ '^flags/[a-z]{2}\.png$'
        and lower(public.admin_iso2_country(upper(substring(o.name from 'flags/([a-z]{2})\.png')))) = lower(btrim(coalesce(p_country, '')))
      limit 1),
    case lower(btrim(coalesce(p_country, '')))
      when 'czech republic' then 'CZ' when 'hong kong' then 'HK' when 'turkey' then 'TR'
      when 'usa' then 'US' when 'united states of america' then 'US' when 'uk' then 'GB'
      when 'great britain' then 'GB' when 'england' then 'GB' when 'scotland' then 'GB' end)
$$;

create or replace function public.rpt_n(p bigint)
returns text language sql immutable as $$ select to_char(coalesce(p, 0), 'FM999,999,990') $$;

create or replace function public.rpt_money(p_cur text, p_cents numeric)
returns text language sql immutable as $$
  select upper(p_cur) || ' ' || to_char(p_cents / 100.0, 'FM999,999,990.00')
$$;

-- A round flag (or a plain disc when there is none), 24px.
create or replace function public.rpt_flag(p_country text, p_size int default 24)
returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select coalesce(
    public.gavelling_email_flag_html_v2(public.rpt_iso2(p_country), p_size, coalesce(p_country, '')),
    '<div style="width:' || p_size || 'px;height:' || p_size || 'px;border-radius:50%;background-color:#E4DCC8;"></div>')
$$;

-- One section: icon, title, then its content.
create or replace function public.rpt_section(p_icon text, p_title text, p_inner text)
returns text language sql immutable as $$
  select '<tr><td class="e-pad" style="padding:28px 32px 0 32px;">'
    || '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
    || '<td valign="middle" style="padding-right:10px;line-height:0;">' || public.gavelling_email_icon_html_v2(p_icon, 28) || '</td>'
    || '<td valign="middle" class="e-ink" style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;font-size:17px;line-height:1.3;font-weight:bold;color:#1C1410;">' || public.gavelling_email_esc(p_title) || '</td>'
    || '</tr></table>'
    || '<div style="padding-top:12px;">' || coalesce(p_inner, '') || '</div></td></tr>'
$$;

-- A list row: picture, bold title (may contain a link), soft line under it, an
-- optional figure on the right. Title / sub / right are trusted HTML.
create or replace function public.rpt_row(p_img text, p_title text, p_sub text, p_right text default null, p_first boolean default false)
returns text language sql immutable as $$
  select '<tr>'
    || '<td valign="middle" width="38" class="e-hair" style="width:38px;padding:10px 0;' || case when p_first then '' else 'border-top:1px solid #EDE6D6;' end || 'line-height:0;">' || coalesce(p_img, '') || '</td>'
    || '<td valign="middle" class="e-hair" style="padding:10px 8px 10px 4px;' || case when p_first then '' else 'border-top:1px solid #EDE6D6;' end || 'font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;">'
    || '<div class="e-ink" style="font-size:15px;line-height:1.35;font-weight:bold;color:#1C1410;">' || coalesce(p_title, '') || '</div>'
    || case when nullif(p_sub, '') is not null then '<div class="e-soft" style="font-size:13px;line-height:1.45;color:#574B40;padding-top:1px;">' || p_sub || '</div>' else '' end
    || '</td>'
    || '<td valign="middle" align="right" class="e-hair e-ink" style="padding:10px 0;' || case when p_first then '' else 'border-top:1px solid #EDE6D6;' end || 'font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#1B3828;white-space:nowrap;">' || coalesce(p_right, '') || '</td>'
    || '</tr>'
$$;

create or replace function public.rpt_list(p_rows text)
returns text language sql immutable as $$
  select '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' || coalesce(p_rows, '') || '</table>'
$$;

-- A plain line of text inside a section.
create or replace function public.rpt_line(p_html text)
returns text language sql immutable as $$
  select '<p class="e-soft" style="margin:0 0 8px 0;font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.55;color:#574B40;">' || p_html || '</p>'
$$;

-- The tiles: [{icon, value, label, sub}], two to a row, stacked on a phone.
create or replace function public.rpt_tiles(p jsonb)
returns text language plpgsql immutable as $$
declare v_out text := ''; v_i int := 0; t jsonb; v_cell text;
begin
  for t in select * from jsonb_array_elements(p) loop
    v_cell := '<td valign="top" width="50%" class="e-stack" style="width:50%;padding:0 ' || case when v_i % 2 = 0 then '6px 12px 0' else '0 12px 6px' end || ';">'
      || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-pass" bgcolor="#F6F2E8" style="background-color:#F6F2E8;border-radius:14px;">'
      || '<tr><td style="padding:14px 16px;font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;">'
      || '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
      || '<td valign="middle" style="padding-right:8px;line-height:0;">' || public.gavelling_email_icon_html_v2(t->>'icon', 24) || '</td>'
      || '<td valign="middle" class="e-soft" style="font-size:12.5px;line-height:1.3;font-weight:bold;color:#574B40;">' || public.gavelling_email_esc(t->>'label') || '</td>'
      || '</tr></table>'
      || '<div class="e-accent" style="font-size:26px;line-height:1.15;font-weight:bold;color:#1B3828;padding-top:8px;">' || public.gavelling_email_esc(t->>'value') || '</div>'
      || case when nullif(t->>'sub', '') is not null then '<div class="e-soft" style="font-size:12.5px;line-height:1.4;color:#574B40;padding-top:3px;">' || (t->>'sub') || '</div>' else '' end
      || '</td></tr></table></td>';
    if v_i % 2 = 0 then v_out := v_out || '<tr>' || v_cell; else v_out := v_out || v_cell || '</tr>'; end if;
    v_i := v_i + 1;
  end loop;
  if v_i % 2 = 1 then v_out := v_out || '<td width="50%" class="e-stack" style="width:50%;">&nbsp;</td></tr>'; end if;
  return '<tr><td class="e-pad" style="padding:24px 32px 0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' || v_out || '</table></td></tr>';
end $$;

-- The status box at the top: red with every critical problem, or green "all clear".
create or replace function public.rpt_alerts(p_items text[], p_clear_line text)
returns text language plpgsql immutable as $$
declare v_rows text := ''; v_i int := 0; v_item text;
begin
  if coalesce(array_length(p_items, 1), 0) = 0 then
    return '<tr><td class="e-pad" style="padding:22px 32px 0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E8F1EA" style="background-color:#E8F1EA;border-radius:14px;"><tr>'
      || '<td valign="middle" width="40" style="width:40px;padding:14px 0 14px 16px;line-height:0;">' || public.gavelling_email_icon_html_v2('done', 28) || '</td>'
      || '<td valign="middle" style="padding:14px 16px 14px 10px;font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.45;font-weight:bold;color:#1B3828;">' || public.gavelling_email_esc(p_clear_line) || '</td>'
      || '</tr></table></td></tr>';
  end if;
  foreach v_item in array p_items loop
    v_rows := v_rows || '<tr><td valign="top" width="22" style="width:22px;padding:' || case when v_i = 0 then '0' else '8px' end || ' 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#B42318;">&#9679;</td>'
      || '<td valign="top" style="padding:' || case when v_i = 0 then '0' else '8px' end || ' 0 0 0;font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.5;color:#5C1610;">' || v_item || '</td></tr>';
    v_i := v_i + 1;
  end loop;
  return '<tr><td class="e-pad" style="padding:22px 32px 0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FDECEA" style="background-color:#FDECEA;border:1px solid #F5C2BC;border-radius:14px;"><tr><td style="padding:16px 18px;">'
    || '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
    || '<td valign="middle" style="padding-right:10px;"><div style="width:26px;height:26px;border-radius:50%;background-color:#B42318;color:#FFFFFF;font-family:Helvetica,Arial,sans-serif;font-size:17px;line-height:26px;font-weight:bold;text-align:center;">!</div></td>'
    || '<td valign="middle" style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.3;font-weight:bold;color:#B42318;">'
    || case when v_i = 1 then '1 critical problem' else v_i || ' critical problems' end || '</td></tr></table>'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">' || v_rows || '</table>'
    || '</td></tr></table></td></tr>';
end $$;

-- "Keep an eye on": amber bullets, only things that may need a person.
create or replace function public.rpt_watch(p_items text[])
returns text language plpgsql immutable as $$
declare v_rows text := ''; v_i int := 0; v_item text;
begin
  if coalesce(array_length(p_items, 1), 0) = 0 then return ''; end if;
  foreach v_item in array p_items loop
    v_rows := v_rows || '<tr><td valign="top" width="20" style="width:20px;padding:' || case when v_i = 0 then '0' else '9px' end || ' 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#B6871F;">&#9679;</td>'
      || '<td valign="top" class="e-ink" style="padding:' || case when v_i = 0 then '0' else '9px' end || ' 0 0 0;font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.55;color:#241E17;">' || v_item || '</td></tr>';
    v_i := v_i + 1;
  end loop;
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-pass" bgcolor="#FBF6E6" style="background-color:#FBF6E6;border-left:3px solid #C9A63A;border-radius:0 12px 12px 0;"><tr><td style="padding:14px 16px;">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' || v_rows || '</table></td></tr></table>';
end $$;

-- The whole email: ivory page, white card, Gavelling mark, title and date,
-- the body rows, one button, a short footer. No unsubscribe: internal only.
create or replace function public.rpt_shell(p_title text, p_chip text, p_preheader text, p_body text, p_cta_label text, p_cta_url text, p_footer text)
returns text language sql immutable as $$
select
'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="x-apple-disable-message-reformatting">'
|| '<meta name="format-detection" content="telephone=no,address=no,email=no,date=no"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">'
|| '<title>' || public.gavelling_email_esc(p_title) || '</title>'
|| '<style>:root{color-scheme:light dark;}body{margin:0;padding:0;-webkit-text-size-adjust:100%;}img{border:0;outline:none;text-decoration:none;}a{text-decoration:none;}'
|| '@media only screen and (max-width:620px){.e-pad{padding-left:18px !important;padding-right:18px !important;}.e-stack{display:block !important;width:100% !important;padding:0 0 12px 0 !important;}}'
|| '@media (prefers-color-scheme: dark){body,.e-page{background-color:#0E0D0A !important;}.e-card{background-color:#232019 !important;border-color:#3A352A !important;}.e-pass{background-color:#1B1811 !important;}.e-hair{border-color:#3A352A !important;}'
|| '.e-ink,.e-ink a,.e-ink strong{color:#F3EFE6 !important;}.e-soft,.e-soft a{color:#CFC7B8 !important;}.e-muted,.e-muted a{color:#A79D8D !important;}.e-accent{color:#D9E4DC !important;}.e-btn{background-color:#2F5A40 !important;}}'
|| '[data-ogsc] .e-page{background-color:#0E0D0A !important;}[data-ogsc] .e-card{background-color:#232019 !important;}[data-ogsc] .e-pass{background-color:#1B1811 !important;}[data-ogsc] .e-ink,[data-ogsc] .e-ink a{color:#F3EFE6 !important;}[data-ogsc] .e-soft{color:#CFC7B8 !important;}[data-ogsc] .e-accent{color:#D9E4DC !important;}'
|| '</style></head><body class="e-page" style="margin:0;padding:0;background-color:#EDE7D8;">'
|| '<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">' || public.gavelling_email_esc(coalesce(p_preheader, '')) || repeat('&#8199;&#65279;&#847; ', 6) || '</div>'
|| '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-page" bgcolor="#EDE7D8" style="background-color:#EDE7D8;"><tr><td align="center" style="padding:20px 10px 36px 10px;">'
|| '<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->'
|| '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;"><tr><td>'
|| '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="e-card" bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #E4DCC8;border-radius:18px;box-shadow:0 18px 40px -24px rgba(27,56,40,0.3);">'
|| '<tr><td class="e-pad" style="padding:26px 32px 0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
|| '<td valign="middle" width="44" style="width:44px;line-height:0;"><img src="https://luruhkwrgisytejswlas.supabase.co/storage/v1/object/public/session-documents/email-assets/tile-gavelling.png" width="40" height="40" alt="Gavelling" style="display:block;width:40px;height:40px;border:0;border-radius:50%;" /></td>'
|| '<td valign="middle" style="padding-left:12px;font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;">'
|| '<div class="e-accent" style="font-size:22px;line-height:1.2;font-weight:bold;color:#1B3828;">' || public.gavelling_email_esc(p_title) || '</div>'
|| '<div class="e-soft" style="font-size:13px;line-height:1.4;color:#574B40;padding-top:2px;">' || public.gavelling_email_esc(p_chip) || '</div></td>'
|| '<td valign="middle" align="right" style="font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;font-size:11px;line-height:1;font-weight:bold;letter-spacing:0.08em;color:#7A5812;"><span style="display:inline-block;padding:6px 10px;background-color:#F6EBC4;border-radius:999px;">FOUNDERS</span></td>'
|| '</tr></table></td></tr>'
|| p_body
|| case when nullif(p_cta_url, '') is not null then
     '<tr><td align="center" class="e-pad" style="padding:30px 32px 30px 32px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#1B3828" class="e-btn" style="background-color:#1B3828;border-radius:999px;">'
     || '<a href="' || public.gavelling_email_esc(p_cta_url) || '" target="_blank" style="display:inline-block;padding:14px 34px;font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;font-size:15px;line-height:20px;font-weight:bold;color:#EED98A;text-decoration:none;border-radius:999px;">' || public.gavelling_email_esc(p_cta_label) || '</a>'
     || '</td></tr></table></td></tr>'
   else '<tr><td style="height:30px;line-height:30px;font-size:0;">&nbsp;</td></tr>' end
|| '</table></td></tr>'
|| '<tr><td align="center" class="e-muted" style="padding:18px 20px 0 20px;font-family:''Helvetica Neue'',Helvetica,Arial,sans-serif;font-size:11.5px;line-height:1.7;color:#6E6456;">' || public.gavelling_email_esc(coalesce(p_footer, '')) || '</td></tr>'
|| '</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>'
$$;

-- A conference row for the lists: flag, acronym linked to its page, then name, place and dates.
create or replace function public.rpt_conf_row(p_id uuid, p_first boolean, p_right text default null)
returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select public.rpt_row(
    public.rpt_flag(c.country, 26),
    '<a href="https://gavelling.com/conferences/' || c.slug || '" target="_blank" class="e-ink" style="color:#1C1410;text-decoration:underline;">'
      || public.gavelling_email_esc(coalesce(nullif(btrim(c.acronym), ''), c.full_name)) || '</a>'
      || case when not c.is_public then ' <span style="font-size:11px;font-weight:bold;color:#7A5812;">PRIVATE</span>' else '' end,
    public.gavelling_email_esc(concat_ws(' · ',
      nullif(c.full_name, coalesce(c.acronym, '')),
      nullif(concat_ws(', ', nullif(btrim(coalesce(c.city, '')), ''), nullif(btrim(coalesce(c.country, '')), '')), ''),
      coalesce(public.gavelling_email_dates_label(c.start_date, c.end_date, c.dates_tbd), case when c.dates_tbd then 'Dates to be decided' end))),
    p_right, p_first)
  from conferences c where c.id = p_id
$$;

-- ── The daily report: content only, writes nothing ───────────────────────────
create or replace function public.daily_platform_report_content()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_active uuid[];
  v_profiles int; v_profiles_24 int;
  v_apps_24 int; v_acc_24 int; v_awaiting int; v_awaiting_30 int;
  v_imp_24 int; v_imp_all int; v_imp_reg int; v_unreg int; v_unreg_confs int; v_unreg_rows text := '';
  v_org_n int; v_lst_n int; v_org_rows text := ''; v_lst_rows text := '';
  v_money_in text; v_money_manual text; v_refunds int;
  v_crit text[] := '{}'; v_watch text[] := '{}';
  v_paused boolean; v_fail_other int; v_fail_addr int; v_stuck int; v_money_subject text; v_bursts int;
  v_cron text; v_cron_blips int; v_cron_worst int;
  v_blocked int; v_blocked_msg text; v_degraded int; v_uerr int; v_uerr_people int;
  v_auth_real int; v_batches_7d int; v_oldest_batch int; v_leaderless int; v_domains text;
  v_body text; v_txt text; v_subject text; v_pre text; r record; v_i int;
begin
  select coalesce(array_agg(c.id), '{}') into v_active from conferences c
   where public.is_active_conference(c.id) and not coalesce(c.is_demo, false);

  select count(*), count(*) filter (where created_at > now() - interval '24 hours') into v_profiles, v_profiles_24 from profiles;

  select count(*) filter (where a.submitted_at > now() - interval '24 hours' and a.claim_token is null),
         count(*) filter (where a.decided_at > now() - interval '24 hours' and a.status in ('accepted', 'assigned', 'checked-in')),
         count(*) filter (where a.status = 'submitted'),
         count(*) filter (where a.status = 'submitted' and a.submitted_at < now() - interval '30 days')
    into v_apps_24, v_acc_24, v_awaiting, v_awaiting_30
    from applications a where a.conference_id = any(v_active);

  -- Imported delegates: an import carries a claim token from insert; claiming
  -- sets user_id. Unregistered = still no account, not turned down or withdrawn,
  -- at a conference that has not ended.
  select count(*) filter (where a.submitted_at > now() - interval '24 hours'),
         count(*), count(*) filter (where a.user_id is not null),
         count(*) filter (where a.user_id is null and a.invited_email is not null and a.status not in ('rejected', 'withdrawn') and coalesce(c.end_date, current_date) >= current_date),
         count(distinct a.conference_id) filter (where a.user_id is null and a.invited_email is not null and a.status not in ('rejected', 'withdrawn') and coalesce(c.end_date, current_date) >= current_date)
    into v_imp_24, v_imp_all, v_imp_reg, v_unreg, v_unreg_confs
    from applications a join conferences c on c.id = a.conference_id
   where a.claim_token is not null and not coalesce(c.is_demo, false);

  v_i := 0;
  for r in select a.conference_id, count(*) n from applications a join conferences c on c.id = a.conference_id
            where a.claim_token is not null and a.user_id is null and a.invited_email is not null
              and a.status not in ('rejected', 'withdrawn') and coalesce(c.end_date, current_date) >= current_date and not coalesce(c.is_demo, false)
            group by 1 order by 2 desc limit 3 loop
    v_unreg_rows := v_unreg_rows || public.rpt_conf_row(r.conference_id, v_i = 0, public.rpt_n(r.n) || ' waiting');
    v_i := v_i + 1;
  end loop;

  -- Conferences added in 24 hours.
  select count(*) into v_org_n from conferences c where c.listed_by = 'organiser' and c.created_at > now() - interval '24 hours' and not coalesce(c.is_demo, false);
  select count(*) into v_lst_n from conferences c where c.listed_by = 'gavelling' and c.created_at > now() - interval '24 hours';
  v_i := 0;
  for r in select c.id from conferences c where c.listed_by = 'organiser' and c.created_at > now() - interval '24 hours' and not coalesce(c.is_demo, false) order by c.created_at loop
    v_org_rows := v_org_rows || public.rpt_conf_row(r.id, v_i = 0); v_i := v_i + 1;
  end loop;
  v_i := 0;
  for r in select c.id from conferences c where c.listed_by = 'gavelling' and c.created_at > now() - interval '24 hours' order by c.country, c.start_date limit 40 loop
    v_lst_rows := v_lst_rows || public.rpt_conf_row(r.id, v_i = 0); v_i := v_i + 1;
  end loop;

  -- Money in, 24 hours, never summed across currencies.
  select coalesce(string_agg(public.rpt_money(t.cur, t.total), ', ' order by t.total desc), 'none')
    into v_money_in
    from (select p.currency cur, sum(p.amount_cents)::numeric total from payments p join invoices i on i.id = p.invoice_id
           where i.conference_id = any(v_active) and p.status = 'succeeded' and p.method = 'stripe' and p.amount_cents > 0
             and p.created_at > now() - interval '24 hours' group by 1) t;
  select coalesce(string_agg(public.rpt_money(t.cur, t.total), ', ' order by t.total desc), 'none')
    into v_money_manual
    from (select p.currency cur, sum(p.amount_cents)::numeric total from payments p join invoices i on i.id = p.invoice_id
           where i.conference_id = any(v_active) and p.status = 'succeeded' and p.method <> 'stripe' and p.amount_cents > 0
             and p.created_at > now() - interval '24 hours' group by 1) t;
  select count(*) into v_refunds from payments p where p.amount_cents < 0 and p.created_at > now() - interval '24 hours';

  -- ── Critical ──
  select coalesce(paused, false) into v_paused from email_sending_paused limit 1;
  if v_paused then v_crit := v_crit || '<strong>Email is paused.</strong> Nothing is leaving the outbox until someone runs email_resume().'; end if;

  select count(*) filter (where status = 'failed' and coalesce(error, '') not like 'Invalid recipient address%'),
         count(*) filter (where status = 'failed' and coalesce(error, '') like 'Invalid recipient address%')
    into v_fail_other, v_fail_addr
    from email_outbox where updated_at > now() - interval '24 hours';
  if v_fail_other > 0 then v_crit := v_crit || ('<strong>' || public.rpt_n(v_fail_other) || ' emails failed</strong> in 24 hours for a reason other than a bad address.'); end if;

  select count(*) into v_stuck from email_outbox where status = 'pending' and coalesce(send_after, created_at) < now() - interval '1 hour';
  if v_stuck > 50 then v_crit := v_crit || ('<strong>' || public.rpt_n(v_stuck) || ' emails are stuck</strong>: due over an hour ago and still not sent.'); end if;

  select subject into v_money_subject from email_outbox where subject like 'Money check:%' and created_at > now() - interval '24 hours' order by created_at desc limit 1;
  if v_money_subject is not null then v_crit := v_crit || ('<strong>' || public.gavelling_email_esc(v_money_subject) || '.</strong> The details are in its own email to the team inbox.'); end if;

  select count(*) into v_bursts from email_burst_alerts where created_at > now() - interval '24 hours';
  if v_bursts > 0 then v_crit := v_crit || ('<strong>Email burst alarm</strong> went off ' || v_bursts || ' time' || case when v_bursts = 1 then '' else 's' end || ' in 24 hours.'); end if;

  -- Background jobs: failing often, or failing on their latest run.
  with runs as (
    select j.jobname, d.status, d.start_time, row_number() over (partition by j.jobid order by d.start_time desc) rn
      from cron.job_run_details d join cron.job j on j.jobid = d.jobid
     where d.start_time > now() - interval '24 hours' and j.active),
  agg as (select jobname, count(*) n, count(*) filter (where status = 'failed') f, bool_or(rn = 1 and status = 'failed') last_failed from runs group by 1)
  select string_agg(case when f * 5 >= n or last_failed then jobname || ' (' || f || ' of ' || n || ' runs failed)' end, ', ' order by f desc),
         count(*) filter (where f > 0 and not (f * 5 >= n or last_failed)),
         coalesce(max(f) filter (where not (f * 5 >= n or last_failed)), 0)
    into v_cron, v_cron_blips, v_cron_worst from agg;
  if v_cron is not null then v_crit := v_crit || ('<strong>Background jobs failing:</strong> ' || public.gavelling_email_esc(v_cron) || '.'); end if;

  select count(*), (select left(message, 90) from crash_alerts where severity = 'blocked' and last_seen > now() - interval '24 hours' order by occurrences desc limit 1)
    into v_blocked, v_blocked_msg from crash_alerts where severity = 'blocked' and last_seen > now() - interval '24 hours';
  if v_blocked > 0 then v_crit := v_crit || ('<strong>' || v_blocked || ' error' || case when v_blocked = 1 then '' else 's' end || ' stopped people finishing something</strong>, the most frequent: "' || public.gavelling_email_esc(v_blocked_msg) || '".'); end if;

  select count(*) filter (where coalesce(shown_reason, '') <> 'recovered' and not had_session) into v_auth_real
    from auth_flow_failures where created_at > now() - interval '24 hours';
  if v_auth_real >= 10 then v_crit := v_crit || ('<strong>' || v_auth_real || ' people hit a dead end signing in</strong> in 24 hours.'); end if;

  -- ── Keep an eye on ──
  if v_lst_n < 30 then
    v_watch := v_watch || case when v_lst_n = 0 then '<strong>No listings added</strong> in 24 hours. Check that the daily listings job ran on Peter''s Mac.'
                               else 'The listings job added <strong>' || v_lst_n || ' of 30</strong>. Below 30 means it is running out of dated candidates.' end;
  end if;
  if v_awaiting_30 > 0 then v_watch := v_watch || ('<strong>' || public.rpt_n(v_awaiting_30) || ' applications</strong> have waited over 30 days for a decision.'); end if;

  select count(*) filter (where coalesce(pb.proof_uploaded_at, pb.created_at) < now() - interval '7 days'),
         coalesce(max(extract(day from now() - coalesce(pb.proof_uploaded_at, pb.created_at)))::int, 0)
    into v_batches_7d, v_oldest_batch from payment_batches pb where pb.conference_id = any(v_active) and pb.status = 'pending';
  if v_batches_7d > 0 then v_watch := v_watch || ('<strong>' || v_batches_7d || ' payment proofs</strong> have waited over a week for an organiser (oldest ' || v_oldest_batch || ' days).'); end if;

  select count(*) filter (where severity = 'degraded') into v_degraded from crash_alerts where last_seen > now() - interval '24 hours';
  select count(*), count(distinct coalesce(user_id::text, visitor)) into v_uerr, v_uerr_people
    from user_error_reports where created_at > now() - interval '24 hours' and expected is not true;
  if v_uerr > 0 or v_degraded > 0 then
    v_watch := v_watch || ('<strong>' || v_uerr || ' unexpected errors</strong> for ' || v_uerr_people || ' people'
      || case when v_degraded > 0 then ', and ' || v_degraded || ' that made a page work worse' else '' end || '.');
  end if;
  if v_fail_addr > 0 then v_watch := v_watch || (public.rpt_n(v_fail_addr) || ' emails bounced on a bad address.'); end if;
  if v_cron_blips > 0 then v_watch := v_watch || (v_cron_blips || ' background jobs had brief failures (at most ' || v_cron_worst || ' runs each), recovered on their own.'); end if;

  select count(*) into v_leaderless from (
    select soc.id from societies soc join conferences c on c.id = soc.conference_id
      left join applications a on a.society_id = soc.id
     where soc.conference_id = any(v_active) and soc.advisor_user_id is null
       and exists (select 1 from application_surcharges s where s.conference_id = soc.conference_id and s.applies_to = 'per_delegation' and s.active and s.amount_cents > 0)
     group by soc.id
    having count(*) filter (where a.status not in ('rejected', 'withdrawn')) > 0
       and count(*) filter (where a.role in ('head-delegate', 'faculty-advisor') and a.status not in ('rejected', 'withdrawn')) = 0) l;
  if v_leaderless > 0 then v_watch := v_watch || ('<strong>' || v_leaderless || ' delegations</strong> with a delegation fee to pay have members but no head delegate or advisor.'); end if;

  select string_agg(d.domain || ' (' || d.stuck || ' of ' || d.n || ')', ', ' order by d.stuck desc) into v_domains
    from (select split_part(u.email, '@', 2) domain, count(*) n, count(*) filter (where u.email_confirmed_at is null) stuck
            from auth.users u
           where u.raw_app_meta_data->>'provider' = 'email' and u.deleted_at is null
             and u.email not ilike '%@example.com' and u.email not ilike '%@gavellingtest.com' and u.email not ilike '%@gavelling.com'
             and u.created_at > now() - interval '45 days'
           group by 1 having count(*) >= 3 and count(*) filter (where u.email_confirmed_at is null) * 2 > count(*)) d;
  if v_domains is not null then v_watch := v_watch || ('Sign-up emails mostly not confirmed at ' || public.gavelling_email_esc(v_domains) || '. Their mail server may be blocking us.'); end if;

  -- ── Assemble ──
  v_subject := case when coalesce(array_length(v_crit, 1), 0) > 0
                    then 'Gavelling daily: ' || array_length(v_crit, 1) || ' critical, ' || to_char(current_date, 'FMDD Mon')
                    else 'Gavelling daily numbers, ' || to_char(current_date, 'FMDD Mon YYYY') end;
  v_pre := public.rpt_n(v_profiles_24) || ' new people, ' || public.rpt_n(v_apps_24) || ' applications, '
    || (v_org_n + v_lst_n) || ' conferences added, ' || public.rpt_n(v_unreg) || ' imported delegates not registered';

  v_body := public.rpt_alerts(v_crit, 'Nothing critical. Email, payments, jobs and sign-in all look healthy.')
    || public.rpt_tiles(jsonb_build_array(
         jsonb_build_object('icon', 'secretariat', 'label', 'New people', 'value', '+' || public.rpt_n(v_profiles_24), 'sub', public.rpt_n(v_profiles) || ' in total'),
         jsonb_build_object('icon', 'applications', 'label', 'Applications', 'value', public.rpt_n(v_apps_24), 'sub', public.rpt_n(v_acc_24) || ' accepted, ' || public.rpt_n(v_awaiting) || ' waiting'),
         jsonb_build_object('icon', 'invites', 'label', 'Imported delegates', 'value', '+' || public.rpt_n(v_imp_24), 'sub', '<strong>' || public.rpt_n(v_unreg) || '</strong> not registered yet'),
         jsonb_build_object('icon', 'globe', 'label', 'Conferences added', 'value', public.rpt_n(v_org_n + v_lst_n), 'sub', v_org_n || ' by organisers, ' || v_lst_n || ' listings')))
    || case when v_org_n > 0 then public.rpt_section('publish', 'New From Organisers', public.rpt_list(v_org_rows)) else '' end
    || case when v_lst_n > 0 then public.rpt_section('page', 'Listings Added', public.rpt_list(v_lst_rows)
            || case when v_lst_n > 40 then public.rpt_line('And ' || (v_lst_n - 40) || ' more.') else '' end) else '' end
    || public.rpt_section('invites', 'Imported Delegates',
         public.rpt_line('<strong class="e-ink" style="color:#1C1410;">' || public.rpt_n(v_unreg) || '</strong> imported delegates have not made an account yet, at '
           || v_unreg_confs || ' conference' || case when v_unreg_confs = 1 then '' else 's' end || '. '
           || public.rpt_n(v_imp_reg) || ' of ' || public.rpt_n(v_imp_all) || ' ever imported have registered ('
           || case when v_imp_all > 0 then round(100.0 * v_imp_reg / v_imp_all)::text else '0' end || '%).')
         || case when v_unreg_rows <> '' then public.rpt_list(v_unreg_rows) else '' end)
    || public.rpt_section('payments', 'Money In',
         public.rpt_line('By card through Gavelling: <strong class="e-ink" style="color:#1C1410;">' || v_money_in || '</strong>')
         || public.rpt_line('Recorded by organisers: <strong class="e-ink" style="color:#1C1410;">' || v_money_manual || '</strong>'
            || case when v_refunds > 0 then '. Refunds: ' || v_refunds else '' end))
    || case when coalesce(array_length(v_watch, 1), 0) > 0 then public.rpt_section('clock', 'Keep an Eye On', public.rpt_watch(v_watch)) else '' end;

  v_txt := 'Gavelling daily numbers, ' || to_char(now(), 'FMDD Mon YYYY HH24:MI') || ' UTC' || chr(10) || chr(10)
    || case when coalesce(array_length(v_crit, 1), 0) > 0
            then 'CRITICAL' || chr(10) || regexp_replace(array_to_string(v_crit, chr(10)), '<[^>]+>', '', 'g') || chr(10) || chr(10)
            else 'Nothing critical.' || chr(10) || chr(10) end
    || 'New people: +' || v_profiles_24 || ' (' || v_profiles || ' total)' || chr(10)
    || 'Applications in 24h: ' || v_apps_24 || ', accepted ' || v_acc_24 || ', waiting ' || v_awaiting || chr(10)
    || 'Imported delegates: +' || v_imp_24 || ', not registered yet ' || v_unreg || chr(10)
    || 'Conferences added: ' || v_org_n || ' by organisers, ' || v_lst_n || ' listings' || chr(10)
    || 'Money in by card: ' || v_money_in || chr(10) || 'Recorded by organisers: ' || v_money_manual || chr(10)
    || case when coalesce(array_length(v_watch, 1), 0) > 0
            then chr(10) || 'KEEP AN EYE ON' || chr(10) || regexp_replace(array_to_string(v_watch, chr(10)), '<[^>]+>', '', 'g') else '' end;

  return jsonb_build_object(
    'subject', v_subject, 'text', v_txt, 'critical', coalesce(array_length(v_crit, 1), 0),
    'html', public.rpt_shell('Daily Numbers', to_char(now(), 'FMDay FMDD Mon YYYY') || ', ' || to_char(now(), 'HH24:MI') || ' UTC', v_pre, v_body,
                             'Open the admin console', 'https://gavelling.com/admin',
                             'Internal report for the Gavelling founders. Active conferences only; demo conferences never count; money is never added across currencies.'));
end $$;

-- ── The daily composer (cron daily-platform-report, 13:00 UTC) ───────────────
create or replace function public.compose_daily_platform_report(p_test_to text default null)
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_to text := coalesce(nullif(btrim(p_test_to), ''), 'wearegavelling@gmail.com'); r jsonb;
begin
  if p_test_to is null and exists (
    select 1 from email_outbox where recipient_email = v_to
       and (subject like 'Gavelling daily numbers%' or subject like 'Gavelling daily:%')
       and created_at >= date_trunc('day', now())) then
    return 0;
  end if;
  r := public.daily_platform_report_content();
  insert into email_outbox (conference_id, recipient_application_id, recipient_email, subject, body, body_html, status)
  values (null, null, v_to, case when p_test_to is not null then '[Test] ' else '' end || (r->>'subject'), r->>'text', r->>'html', 'pending');
  return 1;
end $$;

-- ── The monthly report: content only, writes nothing ─────────────────────────
-- p_month: any day in the month to report (default: last month).
create or replace function public.monthly_platform_report_content(p_month date default null)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare
  m0 timestamptz := date_trunc('month', coalesce(p_month, (date_trunc('month', now()) - interval '1 day')::date));
  m1 timestamptz := m0 + interval '1 month';
  p0 timestamptz := m0 - interval '1 month';
  v_label text := to_char(m0, 'FMMonth YYYY');
  v_prev text := to_char(p0, 'FMMonth');
  -- this month / last month
  pr int; pr_p int; oc int; oc_p int; op int; ls int; ls_p int; ap int; ap_p int; ac int; ac_p int; rj int;
  im int; im_p int; imr int; ima int; unreg int; v_med numeric; v_med_p numeric;
  em int; emf int; ue int; ue_p int; bl int; v_awaiting int; v_awaiting_30 int;
  v_pay_n int; v_pay_manual int; v_money_card text; v_money_manual text; v_refund text; v_outstanding text;
  v_top_share numeric; v_top_name text; v_unconf int; v_money_days int; v_bursts int;
  v_insights text[] := '{}'; v_good text[] := '{}';
  v_rows text; v_i int; r record; v_body text; v_txt text; v_intent jsonb; v_intent_mix text; v_traffic text;
begin
  select count(*) filter (where created_at >= m0 and created_at < m1), count(*) filter (where created_at >= p0 and created_at < m0) into pr, pr_p from profiles;
  select count(*) filter (where listed_by = 'organiser' and created_at >= m0 and created_at < m1 and not coalesce(is_demo, false)),
         count(*) filter (where listed_by = 'organiser' and created_at >= p0 and created_at < m0 and not coalesce(is_demo, false)),
         count(*) filter (where listed_by = 'organiser' and created_at >= m0 and created_at < m1 and not coalesce(is_demo, false) and is_public),
         count(*) filter (where listed_by = 'gavelling' and created_at >= m0 and created_at < m1),
         count(*) filter (where listed_by = 'gavelling' and created_at >= p0 and created_at < m0)
    into oc, oc_p, op, ls, ls_p from conferences;

  select count(*) filter (where a.submitted_at >= m0 and a.submitted_at < m1 and a.claim_token is null),
         count(*) filter (where a.submitted_at >= p0 and a.submitted_at < m0 and a.claim_token is null),
         count(*) filter (where a.decided_at >= m0 and a.decided_at < m1 and a.status in ('accepted', 'assigned', 'checked-in')),
         count(*) filter (where a.decided_at >= p0 and a.decided_at < m0 and a.status in ('accepted', 'assigned', 'checked-in')),
         count(*) filter (where a.decided_at >= m0 and a.decided_at < m1 and a.status = 'rejected'),
         count(*) filter (where a.claim_token is not null and a.submitted_at >= m0 and a.submitted_at < m1),
         count(*) filter (where a.claim_token is not null and a.submitted_at >= p0 and a.submitted_at < m0),
         count(*) filter (where a.claim_token is not null and a.submitted_at >= m0 and a.submitted_at < m1 and a.user_id is not null),
         count(*) filter (where a.claim_token is not null),
         count(*) filter (where a.claim_token is not null and a.user_id is null and a.invited_email is not null and a.status not in ('rejected', 'withdrawn') and coalesce(c.end_date, current_date) >= current_date),
         count(*) filter (where a.status = 'submitted' and coalesce(c.end_date, current_date) >= current_date),
         count(*) filter (where a.status = 'submitted' and coalesce(c.end_date, current_date) >= current_date and a.submitted_at < now() - interval '30 days')
    into ap, ap_p, ac, ac_p, rj, im, im_p, imr, ima, unreg, v_awaiting, v_awaiting_30
    from applications a join conferences c on c.id = a.conference_id where not coalesce(c.is_demo, false);

  select percentile_cont(0.5) within group (order by extract(epoch from a.decided_at - a.submitted_at) / 86400.0)
         filter (where a.decided_at >= m0 and a.decided_at < m1),
         percentile_cont(0.5) within group (order by extract(epoch from a.decided_at - a.submitted_at) / 86400.0)
         filter (where a.decided_at >= p0 and a.decided_at < m0)
    into v_med, v_med_p
    from applications a where a.decided_at is not null and a.submitted_at is not null and a.claim_token is null
     and a.decided_at >= p0 and a.decided_at < m1 and a.decided_at > a.submitted_at;

  -- Money, per currency.
  select count(*) filter (where p.amount_cents > 0), count(*) filter (where p.amount_cents > 0 and p.method <> 'stripe')
    into v_pay_n, v_pay_manual from payments p where p.status = 'succeeded' and p.created_at >= m0 and p.created_at < m1;
  select coalesce(string_agg(public.rpt_money(t.cur, t.total) || ' (' || t.n || ')', ', ' order by t.total desc), 'none') into v_money_card
    from (select currency cur, sum(amount_cents)::numeric total, count(*) n from payments
           where status = 'succeeded' and method = 'stripe' and amount_cents > 0 and created_at >= m0 and created_at < m1 group by 1) t;
  select coalesce(string_agg(public.rpt_money(t.cur, t.total) || ' (' || t.n || ')', ', ' order by t.total desc), 'none') into v_money_manual
    from (select currency cur, sum(amount_cents)::numeric total, count(*) n from payments
           where status = 'succeeded' and method <> 'stripe' and amount_cents > 0 and created_at >= m0 and created_at < m1 group by 1) t;
  select coalesce(string_agg(public.rpt_money(t.cur, -t.total) || ' (' || t.n || ')', ', ' order by t.total), 'none') into v_refund
    from (select currency cur, sum(amount_cents)::numeric total, count(*) n from payments
           where status = 'succeeded' and amount_cents < 0 and created_at >= m0 and created_at < m1 group by 1) t;
  select coalesce(string_agg(public.rpt_money(t.cur, t.total), ', ' order by t.total desc), 'none') into v_outstanding
    from (select i.currency cur, sum(i.amount_cents - coalesce(i.amount_paid_cents, 0))::numeric total
            from invoices i join conferences c on c.id = i.conference_id
           where i.status in ('open', 'partial') and not coalesce(c.is_demo, false) and coalesce(c.end_date, current_date) >= current_date
             and exists (select 1 from applications oa where oa.id = i.application_id and oa.status in ('accepted', 'assigned', 'checked-in'))
           group by 1) t;

  select count(*) filter (where status = 'sent'), count(*) filter (where status = 'failed') into em, emf
    from email_outbox where created_at >= m0 and created_at < m1;
  select count(*) filter (where created_at >= m0 and created_at < m1), count(*) filter (where created_at >= p0 and created_at < m0)
    into ue, ue_p from user_error_reports where expected is not true and created_at >= p0 and created_at < m1;
  select count(*) into bl from crash_alerts where severity = 'blocked' and last_seen >= m0 and first_seen < m1;
  select count(distinct created_at::date) into v_money_days from email_outbox where subject like 'Money check:%' and created_at >= m0 and created_at < m1;
  select count(*) into v_bursts from email_burst_alerts where created_at >= m0 and created_at < m1;
  select count(*) into v_unconf from auth.users u where u.email_confirmed_at is null and u.deleted_at is null
     and u.email not ilike '%@example.com' and u.email not ilike '%@gavellingtest.com' and u.email not ilike '%@gavelling.com';

  -- The conference with the most applications this month, and its share.
  select coalesce(c.acronym, c.full_name), 100.0 * count(*) / nullif(ap, 0) into v_top_name, v_top_share
    from applications a join conferences c on c.id = a.conference_id
   where a.submitted_at >= m0 and a.submitted_at < m1 and a.claim_token is null and not coalesce(c.is_demo, false)
   group by c.id, c.acronym, c.full_name order by count(*) desc limit 1;

  -- ── What it means ──
  if pr_p > 0 and pr < pr_p * 0.8 then v_insights := v_insights || ('<strong>Sign-ups fell ' || round(100 - 100.0 * pr / pr_p) || '%</strong> (' || public.rpt_n(pr_p) || ' in ' || v_prev || ', ' || public.rpt_n(pr) || ' now). Check whether a campaign or a big conference drove ' || v_prev || '.'); end if;
  if pr_p > 0 and pr >= pr_p * 1.25 then v_good := v_good || ('Sign-ups grew ' || round(100.0 * pr / pr_p - 100) || '% (' || public.rpt_n(pr_p) || ' to ' || public.rpt_n(pr) || ').'); end if;
  if ap_p > 0 and ap < ap_p * 0.8 then v_insights := v_insights || ('<strong>Applications fell ' || round(100 - 100.0 * ap / ap_p) || '%</strong> (' || public.rpt_n(ap_p) || ' to ' || public.rpt_n(ap) || '). Part of this is seasonal; the rest is fewer conferences open for applications.'); end if;
  if ap_p > 0 and ap >= ap_p * 1.25 then v_good := v_good || ('Applications grew ' || round(100.0 * ap / ap_p - 100) || '% (' || public.rpt_n(ap_p) || ' to ' || public.rpt_n(ap) || ').'); end if;
  if oc_p > 0 and oc < oc_p * 0.8 then v_insights := v_insights || ('<strong>Organisers created ' || round(100 - 100.0 * oc / oc_p) || '% fewer conferences</strong> (' || oc_p || ' to ' || oc || '). This is the number that turns into paying participants later.'); end if;
  if oc > 0 and op * 2 < oc then v_insights := v_insights || ('<strong>' || (oc - op) || ' of ' || oc || ' new conferences are still not public.</strong> Most organisers stop before publishing; the set-up nudges and the logo step are where they drop.'); end if;
  if v_top_share >= 35 then v_insights := v_insights || ('<strong>' || public.gavelling_email_esc(v_top_name) || ' brought ' || round(v_top_share) || '% of all applications.</strong> The month leans on one conference; losing it would show straight away.'); end if;
  if ima > 0 and imr * 2 < im and im >= 20 then v_insights := v_insights || ('<strong>Only ' || round(100.0 * imr / im) || '% of the delegates imported this month have registered</strong> (' || imr || ' of ' || im || '). ' || public.rpt_n(unreg) || ' imported delegates are still waiting overall; the claim reminders are the lever.'); end if;
  if v_med is not null and v_med > 7 then v_insights := v_insights || ('<strong>Organisers took ' || round(v_med, 1) || ' days</strong> (the median) to decide on an application' || case when v_med_p is not null then ', ' || case when v_med > v_med_p then 'slower than' else 'faster than' end || ' ' || round(v_med_p, 1) || ' in ' || v_prev else '' end || '. Applicants who wait over a week drift away.'); end if;
  if v_awaiting_30 > 0 then v_insights := v_insights || ('<strong>' || public.rpt_n(v_awaiting_30) || ' of ' || public.rpt_n(v_awaiting) || ' undecided applications are over 30 days old.</strong> Those organisers need a nudge or have stopped using the page.'); end if;
  if v_pay_n >= 20 and v_pay_manual * 10 >= v_pay_n * 7 then v_insights := v_insights || ('<strong>' || round(100.0 * v_pay_manual / v_pay_n) || '% of payments were recorded by hand</strong> rather than paid by card. Most money still moves outside Gavelling, which is where card set-up help pays off.'); end if;
  if em > 0 and emf * 50 > em then v_insights := v_insights || ('<strong>' || round(100.0 * emf / em, 1) || '% of emails failed</strong> (' || public.rpt_n(emf) || '). Above 2% hurts how inbox providers treat every Gavelling email.'); end if;
  if ue_p > 0 and ue > ue_p * 1.5 then v_insights := v_insights || ('<strong>Unexpected errors rose ' || round(100.0 * ue / ue_p - 100) || '%</strong> (' || ue_p || ' to ' || ue || '). Worth a look in /admin before it shows up in support.'); end if;
  if v_money_days > 0 then v_insights := v_insights || ('The money check found problems on <strong>' || v_money_days || ' day' || case when v_money_days = 1 then '' else 's' end || '</strong>. Each one is an invoice that disagreed with its payments.'); end if;
  if ls > 0 and ls_p > 0 and ls < ls_p * 0.6 then v_insights := v_insights || ('Listings slowed to ' || ls || ' (from ' || ls_p || '): the job is running out of dated candidates.'); end if;
  if ac_p > 0 and ac >= ac_p * 1.25 then v_good := v_good || ('Acceptances grew to ' || public.rpt_n(ac) || ' (from ' || public.rpt_n(ac_p) || ').'); end if;
  if ls > 0 then v_good := v_good || (ls || ' conferences listed by Gavelling, each one a page that can be claimed.'); end if;

  -- ── Lists ──
  v_body := public.rpt_tiles(jsonb_build_array(
      jsonb_build_object('icon', 'secretariat', 'label', 'New people', 'value', public.rpt_n(pr), 'sub', public.rpt_n(pr_p) || ' in ' || v_prev),
      jsonb_build_object('icon', 'applications', 'label', 'Applications', 'value', public.rpt_n(ap), 'sub', public.rpt_n(ap_p) || ' in ' || v_prev || ', ' || public.rpt_n(ac) || ' accepted'),
      jsonb_build_object('icon', 'publish', 'label', 'Organiser conferences', 'value', public.rpt_n(oc), 'sub', oc_p || ' in ' || v_prev || ', ' || op || ' public'),
      jsonb_build_object('icon', 'page', 'label', 'Listings added', 'value', public.rpt_n(ls), 'sub', ls_p || ' in ' || v_prev),
      jsonb_build_object('icon', 'invites', 'label', 'Imported delegates', 'value', public.rpt_n(im), 'sub', imr || ' registered, ' || public.rpt_n(unreg) || ' waiting overall'),
      jsonb_build_object('icon', 'email', 'label', 'Emails sent', 'value', public.rpt_n(em), 'sub', public.rpt_n(emf) || ' failed')))
    || public.rpt_section('questions', 'What the Month Says',
         case when coalesce(array_length(v_insights, 1), 0) > 0 then public.rpt_watch(v_insights) else public.rpt_line('No warning signs this month.') end
         || case when coalesce(array_length(v_good, 1), 0) > 0 then '<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>' || public.rpt_line('<strong class="e-ink" style="color:#1B3828;">Going well:</strong> ' || array_to_string(v_good, ' ')) else '' end);

  v_rows := ''; v_i := 0;
  for r in select a.conference_id, count(*) n from applications a join conferences c on c.id = a.conference_id
            where a.submitted_at >= m0 and a.submitted_at < m1 and a.claim_token is null and not coalesce(c.is_demo, false)
            group by 1 order by 2 desc limit 5 loop
    v_rows := v_rows || public.rpt_conf_row(r.conference_id, v_i = 0, public.rpt_n(r.n)); v_i := v_i + 1;
  end loop;
  if v_rows <> '' then v_body := v_body || public.rpt_section('award', 'Most Applications', public.rpt_list(v_rows)); end if;

  v_rows := ''; v_i := 0;
  for r in select c.country, count(*) n, count(*) filter (where c.listed_by = 'organiser') org from conferences c
            where c.created_at >= m0 and c.created_at < m1 and not coalesce(c.is_demo, false) and c.country is not null
            group by 1 order by 2 desc limit 6 loop
    v_rows := v_rows || public.rpt_row(public.rpt_flag(r.country, 26), public.gavelling_email_esc(r.country),
      case when r.org > 0 then r.org || ' by organisers, ' || (r.n - r.org) || ' listings' else 'listings' end, public.rpt_n(r.n), v_i = 0);
    v_i := v_i + 1;
  end loop;
  if v_rows <> '' then v_body := v_body || public.rpt_section('globe', 'Where New Conferences Came From', public.rpt_list(v_rows)); end if;

  v_rows := ''; v_i := 0;
  for r in select p.nationality, count(*) n from applications a join profiles p on p.id = a.user_id join conferences c on c.id = a.conference_id
            where a.submitted_at >= m0 and a.submitted_at < m1 and a.claim_token is null and not coalesce(c.is_demo, false) and nullif(btrim(p.nationality), '') is not null
            group by 1 order by 2 desc limit 6 loop
    v_rows := v_rows || public.rpt_row(public.rpt_flag(r.nationality, 26), public.gavelling_email_esc(r.nationality), null, public.rpt_n(r.n), v_i = 0);
    v_i := v_i + 1;
  end loop;
  if v_rows <> '' then v_body := v_body || public.rpt_section('seats', 'Where Applicants Came From', public.rpt_list(v_rows)); end if;

  select coalesce(string_agg(t.src || ' ' || t.n, ', ' order by t.n desc), 'none') into v_traffic
    from (select coalesce(nullif(a.traffic_source, ''), 'unknown') src, count(*) n from applications a
           where a.submitted_at >= m0 and a.submitted_at < m1 and a.claim_token is null group by 1 order by 2 desc limit 6) t;
  v_intent := public.platform_intent_mix();
  select coalesce(string_agg((o.val ->> 'name') || ' ' || (o.val ->> 'n'), ', ' order by o.ord), 'none') into v_intent_mix
    from jsonb_array_elements(v_intent -> 'options') with ordinality as o(val, ord);

  v_body := v_body
    || public.rpt_section('payments', 'Money',
         public.rpt_line('Paid by card: <strong class="e-ink" style="color:#1C1410;">' || v_money_card || '</strong>')
         || public.rpt_line('Recorded by organisers: <strong class="e-ink" style="color:#1C1410;">' || v_money_manual || '</strong>')
         || public.rpt_line('Refunded: ' || v_refund)
         || public.rpt_line('Still owed by accepted people at upcoming conferences: ' || v_outstanding))
    || public.rpt_section('live', 'Health',
         public.rpt_line('Unexpected errors: <strong class="e-ink" style="color:#1C1410;">' || ue || '</strong> (' || ue_p || ' in ' || v_prev || '). Errors that blocked someone: ' || bl || '. Money check problem days: ' || v_money_days || '. Email burst alarms: ' || v_bursts || '.')
         || public.rpt_line('Accounts that never confirmed their email: ' || public.rpt_n(v_unconf) || '.'))
    || public.rpt_section('chairs', 'How People Find Us and What Organisers Want',
         public.rpt_line('Where this month''s applicants came from: ' || public.gavelling_email_esc(v_traffic) || '.')
         || public.rpt_line('What organisers say they use Gavelling for: ' || public.gavelling_email_esc(v_intent_mix) || '.'));

  v_txt := 'Gavelling, ' || v_label || chr(10) || chr(10)
    || 'New people ' || pr || ' (' || pr_p || ' in ' || v_prev || ')' || chr(10)
    || 'Applications ' || ap || ' (' || ap_p || '), accepted ' || ac || chr(10)
    || 'Organiser conferences ' || oc || ' (' || oc_p || '), public ' || op || chr(10)
    || 'Listings ' || ls || ' (' || ls_p || ')' || chr(10)
    || 'Imported delegates ' || im || ', registered ' || imr || ', waiting overall ' || unreg || chr(10)
    || 'Emails sent ' || em || ', failed ' || emf || chr(10) || chr(10)
    || 'WHAT THE MONTH SAYS' || chr(10) || regexp_replace(coalesce(array_to_string(v_insights, chr(10)), ''), '<[^>]+>', '', 'g') || chr(10)
    || regexp_replace(coalesce(array_to_string(v_good, ' '), ''), '<[^>]+>', '', 'g') || chr(10) || chr(10)
    || 'Money by card: ' || v_money_card || chr(10) || 'Recorded by organisers: ' || v_money_manual || chr(10) || 'Refunded: ' || v_refund;

  return jsonb_build_object('subject', 'Gavelling in ' || v_label, 'text', v_txt,
    'html', public.rpt_shell(v_label, 'Monthly report, compared with ' || v_prev,
      public.rpt_n(pr) || ' new people, ' || public.rpt_n(ap) || ' applications, ' || oc || ' organiser conferences', v_body,
      'Open the admin console', 'https://gavelling.com/admin',
      'Internal report for the Gavelling founders. Demo conferences never count; money is never added across currencies.'));
end $$;

-- ── The monthly composer (cron monthly-platform-report, 08:00 UTC on the 1st) ─
create or replace function public.compose_monthly_platform_report(p_test_to text default null, p_month date default null)
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_to text := coalesce(nullif(btrim(p_test_to), ''), 'wearegavelling@gmail.com'); r jsonb;
begin
  r := public.monthly_platform_report_content(p_month);
  if p_test_to is null and exists (select 1 from email_outbox where recipient_email = v_to and subject = r->>'subject') then
    return 0;
  end if;
  insert into email_outbox (conference_id, recipient_application_id, recipient_email, subject, body, body_html, status)
  values (null, null, v_to, case when p_test_to is not null then '[Test] ' else '' end || (r->>'subject'), r->>'text', r->>'html', 'pending');
  return 1;
end $$;

-- Nobody but the database (cron) and the service role may run these: the
-- composers take an address, and the content functions read platform data.
do $$ declare f text; begin
  foreach f in array array[
    'public.compose_daily_platform_report(text)', 'public.compose_monthly_platform_report(text, date)',
    'public.daily_platform_report_content()', 'public.monthly_platform_report_content(date)',
    'public.rpt_iso2(text)', 'public.rpt_flag(text, integer)', 'public.rpt_conf_row(uuid, boolean, text)'] loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
  end loop;
end $$;

-- Monthly schedule: 08:00 UTC on the 1st.
select cron.unschedule(jobid) from cron.job where jobname = 'monthly-platform-report';
select cron.schedule('monthly-platform-report', '0 8 1 * *', $$select public.compose_monthly_platform_report()$$);
