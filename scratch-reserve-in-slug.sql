-- scratch-reserve-in-slug.sql (19 Oct 2026). APPLIED 19 Oct 2026 (migration reserve_in_conference_slug).
--
-- `/conferences/in/` is a static route (the country list and the hubs), so a
-- conference slug `in` would be shadowed forever. src/lib/conferenceSlug.ts
-- now reserves 'in' (RESERVED_CONFERENCE_SLUGS); this keeps its database twin
-- in step. `conference_slug_ladder()` filters through `conference_slug_push`,
-- whose reserved list is the only change: 'in' added, nothing else touched.
-- Checked before writing: no conference and no alias uses the slug 'in'.

create or replace function public.conference_slug_push(p_out text[], p_cand text)
 returns text[]
 language sql
 immutable
as $function$
  select case
    when p_cand is null or p_cand = ''                      then p_out
    when length(p_cand) > 60                                then p_out
    when p_cand !~ '^[a-z0-9][a-z0-9-]*$'                   then p_out
    when p_cand = any (array['explore','landing-lab','map','new','organise','organize',
                             'roles','in','all','search','directory','calendar','index'])
                                                            then p_out
    when p_cand = any (coalesce(p_out, '{}'::text[]))       then p_out
    else coalesce(p_out, '{}'::text[]) || p_cand
  end;
$function$;

-- Check (must return 0 rows): select * from conferences where slug = 'in';
