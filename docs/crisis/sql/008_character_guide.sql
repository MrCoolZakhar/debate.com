-- Gavelling Crisis, part 8 (applied as crisis_part8_character_guide): a character guide per character.
alter table public.crisis_characters add column if not exists guide_url text;
alter table public.crisis_characters add column if not exists guide_name text check (guide_name is null or char_length(guide_name) <= 200);
