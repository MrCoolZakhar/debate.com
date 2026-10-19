-- Private CVs no longer 404 (owner, 19 Oct 2026). get_public_cv returns the
-- name and photo of a private CV with `private: true` and no entries, so every
-- link to a person (conference teams, avatars) lands on a page that says
-- "This MUN CV is private". Nationality and every entry stay hidden.
-- get_public_cv_by_prefix calls get_public_cv, so it follows.
create or replace function public.get_public_cv(p_user_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when p.cv_private then
    jsonb_build_object(
      'profile', jsonb_build_object(
        'id',           p.id,
        'display_name', p.display_name,
        'nationality',  null,
        'avatar_url',   p.avatar_url
      ),
      'entries', '[]'::jsonb,
      'private', true
    )
  else
    jsonb_build_object(
      'profile', jsonb_build_object(
        'id',           p.id,
        'display_name', p.display_name,
        'nationality',  case when p.cv_hide_nationality then null else p.nationality end,
        'avatar_url',   p.avatar_url
      ),
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',              e.id,
          'entry_type',      e.entry_type,
          'conference_name', e.conference_name,
          'committee',       e.committee,
          'allocation',      e.allocation,
          'expertise_level', e.expertise_level,
          'award',           e.award,
          'awards',          e.awards,
          'photos',          e.photos,
          'description',     e.description,
          'logo_url',        e.logo_url,
          'conference_id',   e.conference_id,
          'event_date',      e.event_date,
          'source',          e.source,
          'created_at',      e.created_at
        ) order by coalesce(e.event_date::timestamptz, e.created_at) desc)
        from mun_cv_entries e
        where e.user_id = p_user_id and not e.is_private
      ), '[]'::jsonb)
    )
  end
  from profiles p
  where p.id = p_user_id;
$function$;
