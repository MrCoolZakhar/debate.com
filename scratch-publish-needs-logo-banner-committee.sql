-- Publishing needs a logo, a banner and a committee (owner, Peter, 22 Nov 2026).
--
-- APPLIED 22 Nov 2026 from Claude Code (Peter's choice "Random banner only"):
--   every organiser conference with no banner (171, listings untouched) got a random bundled preset:
--   update conferences set banner_url = '/banners/preset-' || (1 + floor(random()*5))::int || '.jpg'
--    where coalesce(listed_by,'organiser') <> 'gavelling' and nullif(btrim(coalesce(banner_url,'')),'') is null;
--   Spread: preset-1 31, preset-2 39, preset-3 33, preset-4 28, preset-5 40.
--   UNDO (only rows still on a preset): section U at the bottom.
--
-- NOT APPLIED, for the chat's Supabase work. The client already refuses (src/lib/publishReadiness.ts:
-- the creation wizard, the manage header's Publish, the Settings switch). These make the database agree.

-- A. The old 3-day automatic go-live publishes only conferences that meet the same bar.
create or replace function public.publish_due_conferences()
 returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare r record; v_done int := 0;
begin
  for r in
    select c.id from conferences c
     where c.auto_publish_at is not null and c.auto_publish_at <= now()
       and not coalesce(c.is_public, false) and c.status = 'private'
       and coalesce(c.listed_by, 'organiser') <> 'gavelling'
       and nullif(btrim(coalesce(c.logo_url, '')), '') is not null
       and nullif(btrim(coalesce(c.banner_url, '')), '') is not null
       and exists (select 1 from conference_committees cc where cc.conference_id = c.id)
  loop
    begin
      update conferences set is_public = true, status = 'public', auto_publish_at = null
       where id = r.id and not coalesce(is_public, false);
      if found then v_done := v_done + 1; end if;
    exception when others then
      raise warning 'publish_due_conferences: % not published: %', r.id, sqlerrm;
    end;
  end loop;
  return v_done;
end $function$;

-- B. (Owners decide) Refuse is_public false -> true without a logo, a banner and a committee, for
-- organiser conferences only (listings and demos exempt). Already-public conferences are untouched.
-- Add its sentence to CONSTRAINT_MESSAGES (src/lib/friendlyError.ts) under 'publish_needs_basics'.
-- create or replace function public.guard_publish_needs_basics() returns trigger language plpgsql as $$
-- begin
--   if new.is_public and not coalesce(old.is_public, false)
--      and coalesce(new.listed_by, 'organiser') <> 'gavelling' and not coalesce(new.is_demo, false)
--      and ( nullif(btrim(coalesce(new.logo_url, '')), '') is null
--         or nullif(btrim(coalesce(new.banner_url, '')), '') is null
--         or not exists (select 1 from conference_committees cc where cc.conference_id = new.id) ) then
--     raise exception 'publish_needs_basics' using errcode = 'P0001';
--   end if;
--   return new;
-- end $$;
-- create trigger trg_guard_publish_needs_basics before update of is_public on public.conferences
--   for each row execute function public.guard_publish_needs_basics();

-- U. Undo the banner backfill (only the rows that are still on a preset).
-- update conferences set banner_url = null
--  where banner_url like '/banners/preset-%' and id in (
--  'c138b197-57f2-414f-9208-eab05a255a37','bf57c3ab-67a9-4e18-8575-687acd958420','ea828f37-901f-4dba-9d0f-85beafaf41ac','bece3115-ec1b-41df-8541-1798952a327d','0e96d73a-15e7-4929-a083-afa80ae0f98a','d5244f74-40a7-468c-a385-99ee234018c8','88fa48ce-c1cf-4814-9e2a-222f2266ca80','02719e95-50e1-4f10-b213-f622a5e96769','7a426589-0236-4d28-87fe-a4630a1cf7c6','09bd37a4-fe78-4a75-b278-864fdda000f0',
--  '2c66e6d6-d8be-4879-9024-745e939ab3e3','5b8ac9ee-bb6c-4d8a-83a4-6a805ced9cbc','144998ee-096c-4641-a186-4672f5fb6e77','2a4d46d0-a124-4c81-9d91-c804ecd90d10','6c617088-5de5-42ee-94bb-64e6df7a690c','65e9b450-b601-46b9-8282-d76cd7413db8','c4062afe-a834-47f8-acdf-5bc3167458a5','fe31e5f1-54e0-4cbb-9ec7-6d4900778b99','ca22bee7-4997-4fa0-817f-5b81968c4284','cf0dd91a-4886-4bf9-b271-ff80d56dcbda',
--  'f9b98196-10be-47ab-afe9-7c013ffd1aba','b350bf19-0daf-4a71-aef7-725d6d58404b','ff838d31-c179-43a0-b5d7-e45dccc3a919','7af6fcc9-dd3f-481b-a4fe-14a2be62d9ee','15be4b34-98b4-4523-9481-824b6ef98209','69079155-4d0e-437f-8760-b7105af365bc','5962715b-4b70-4be4-af73-5dd7bff33d57','7e686316-17b5-49a8-bde3-0a7d30b31648','03d343f5-ca90-4cf5-b9d8-c09cd09551a2','97346652-f253-4db6-8610-1c94abf70ccf',
--  '8e8d07aa-ad2c-4afc-81c1-18a660d70dcc','cb538174-782d-4c0a-b101-13d682396bf5','7e55e9f5-f0ea-4b8f-a3b5-4b7c1861ccef','4eb2b521-9ba9-4df5-bcd5-878bc86acde0','bb1dbc6a-390f-46a6-88b7-0125f4a75b4f','0edf48dc-2f7d-4ab2-8261-132383532476','985e74ac-8f6d-476c-820a-8038d6b48e01','5fe23aac-c148-4bc3-a2f9-c7c0005b0aff','bb148691-cf8c-4fa9-afef-23f9c2c511a8','6252ab8d-c990-44a2-8192-090f01e5fb33',
--  '0656190f-5b85-40bd-b119-cf0a899d967c','9c260923-cdda-4349-a2f8-ce40f33544f9','00751fc8-9048-4b8d-ad7c-20b518491ea4','5d3b0e91-4115-485f-b0e3-e1656a8c2c4a','2cf10e83-90ba-41d7-a2d1-4b87cf24638f','ff3f842f-06e7-49d2-a7de-fe3d360c2af7','ad73cff4-7cfc-4e2e-9fc5-bff332617ef4','ccd75227-f549-4e25-8dd4-2055709b517f','e9450954-0046-4418-b852-fdc21cc7bb24','1b9718fa-dae8-4272-a3f7-25728cf2c969',
--  '356f8539-87a6-42ab-bf94-2b8eb199318d','8ef41777-ba4a-4a80-af3b-f3cb47fd9130','3aa84e85-d6b9-4d78-8a83-959a80f48fc7','b8f37bea-cf20-4ad0-a46b-3a4a211f1794','9d0bf8ef-1439-493e-b32e-7171830ca528','3aee65c3-c3bd-4f6a-81b8-49b8e045ff05','0f464fb7-8269-48f4-8474-997d2ee8f69c','2a5e44b2-fff4-484e-ab6b-c5a89a7f399f','e9760d30-bd53-43ea-a23b-231f3f4af73d','88f84fa3-bc1a-4073-93f2-77e9ce4d341f',
--  'b112a677-3928-4fea-84dd-d834883a88cf','192b2d0a-a4b8-4cba-9f7c-c3fa24ad83c8','c9794b78-da56-4a42-ad7f-51e669d366f7','a1563409-467b-45ef-a6d5-86f1700304aa','c2c559f9-8aca-4182-adc1-8920947ce432','21cbcb6c-b914-4ce1-9b79-204c0a6af096','8fdaa01c-e7bb-4cc6-8c83-8650205eff67','1d56a098-a68e-432a-b402-c46585222684','ffbf2e34-3296-4a9c-8346-f37aa50821b7','2d598596-69dc-4044-8456-a029f762360b',
--  '47d71c3d-5422-4d4c-a7a5-497165e5dda8','e31819bb-f740-4dce-9d3e-ad14ef7174f2','524bb8fa-50ac-4a71-be90-3e1a7964c8de','b66e8079-4acf-4976-8a1c-8d8959651d67','4956ae51-a161-4995-b352-a9a60d19a430','d47b5ee3-e10f-4136-998c-1a687dd26c5e','84e6535f-761a-482e-afc3-de48eeb98e41','1bb3e8d2-f3f7-40dc-a89d-b868ec7edc88','3c4e0b14-9959-4d56-8c28-6315f06e6512','ba18e108-e8ae-4908-998a-2723a8f55a01',
--  '5540e31c-ab79-4b4c-9d78-41f907ba4808','274c7e3d-b537-4779-9898-1c373db3c03c','08d5f6e2-edbb-4d19-8634-633e6be3fa3c','ef8482b2-ca48-49a0-9632-ba2a1a4b826f','4fcd08c0-6b33-4a3b-8665-c84d1ba7ab43','11a68393-2306-4c91-a502-5883d94a92e0','55207c0a-771a-402b-9517-30f180871f91','4970c9fd-ffc1-468a-96c5-89a8529bdd9f','d02f47ba-23b8-4beb-9b8b-f134a72ab66d','6a4a03e3-3dc9-48a6-9d8f-a26126f6705b',
--  '74ef0f54-eb12-4d09-b375-5c1e6108630f','a1b0bdbd-6d5d-4c92-9483-4b19fc43c221','bfefc23e-302a-43ca-9f20-92b47e410b9d','d04da0c6-40fb-4ca8-bee8-39b51dfd3660','d41dd2bd-1eda-4d1d-96dc-960d950d317c','00357e69-62a1-4a5e-b408-ad23ec409709','f28a2281-dd43-4795-8745-fbb138949d90','6048b5eb-0227-4988-a378-37d1a8fc3c28','ff0c915b-164e-4c69-9908-b101f6515e3a','70e7eb7f-18f9-48ba-b3b7-c5d9ffe06dbe',
--  'e2342949-ef4f-4a8c-a11b-99cf4e75a41e','72575132-a2f4-4d96-98b0-ee77e745151b','27b25969-9996-4fbd-bcd9-826a300b1b51','88853e30-1a57-468c-a58d-2138e1e0e752','f203f7d8-0734-49c9-a7ce-906f549deac8','a995e994-d461-490c-bd2b-9b90fd43ea1c','e5c83caf-d9b9-4270-909b-4e9a32d04d27','6474682e-dfe2-4f3d-954e-fb6b95cdd495','cc5e0de8-a8e6-4f4a-9028-2475927b76bd','c904d7bc-95da-45d9-b884-1cd6e37ca71c',
--  'f2eb3513-8125-4ea2-81e0-99047df911ea','5e96079f-6bd5-4b26-9e48-dbfd978fcc02','f8005d61-8212-4c09-bc53-79d81dcbbdfb','02c8d802-5eb3-422a-98f1-90b4dc380818','1aab1a5a-3d89-4d21-b457-5d7df24f1faf','c51b3dad-4911-4f19-882e-37664cf3a5a8','16f1eab1-d4bf-4654-be12-03154071bbf2','0107e073-3ac4-4fbd-bcbe-4c37697cf980','b0284bae-1e3c-4733-95c5-f2c0e6492500','a735c899-1d75-4c5c-abfe-3d81083d39b0',
--  'cb93aad2-0b73-468e-8477-f5d540d7df5a','7263d7f0-bbc6-466a-996d-89c4c4648c5a','f0a0ff73-1af7-4ed2-9ed8-925e49a658d3','ab966566-f74f-407c-a4cf-f830ee411ac5','567d961e-0fb4-4c75-895a-d9f875bba428','75132952-18b1-449c-a372-5736b8da6e6f','b79f88ca-5ab4-4fb9-93ae-c0dc48075773','f8f7e3da-41f4-4a7f-847c-2bf9ef1ee543','cbc65065-bba0-4f6a-9ab6-89128c0aeb30','36e893ab-fbc4-4f35-ba85-ed49e79578f2',
--  'f935f1e1-1b04-4af7-8f7f-28233d9a2159','0ff06230-40cc-48f2-aff5-cde63bd5565c','9fcf7ac5-ea04-4973-95a3-693faf895474','825e634f-618a-4cd3-b966-5e4375c67fd7','93517941-bcd7-44a5-bf1f-1476fb7f7c9f','fcd41d86-26bb-4538-b266-387d4dc6feca','f3b4e105-3144-49bb-8481-85bf017904ee','45ed37e1-7a2c-4aad-b72f-b86ee0b35882','339fa0b7-674a-4048-b0e5-62b6a5e218c9','a27c9d3c-2fc3-4bab-a3b5-234d491ef9af',
--  '3532381d-1a9e-4ed9-877e-cfb277485ed9','e785fb6f-a2d4-4a71-961a-1848b94ab9ec','1f5e3f39-2699-4ff0-b114-637296be2154','82b7d38a-5be0-45fb-b889-aa2212eda70f','e802aa74-c0d7-4954-bd0d-cd5a5a959bbf','b1c24bc0-da73-455a-8906-2781e3286a59','b8e395c3-25ba-4ea6-a988-565437d90b7c','0f32a019-846d-4360-a43e-b31c93db5974','65dea017-d872-4d2d-a39b-3dd38042d290','85290300-84ae-4c44-a281-231c297300a2',
--  'e393d61c-84df-4c2e-a1ad-f3d07504c39b','b56af250-256c-4e21-ae28-8518806ae854','591f90b4-205c-48aa-8943-eb4410165c63','54fdecd8-2651-4710-902d-939b4c2bf4e0','7f8f12c0-975c-4fe4-b38a-45e4e03be5ec','760c3cdf-381c-4914-a5a6-4de7d59b52f3','67b08fb3-902e-4131-a45e-1f6509fb1339','4341a0ea-ffa3-4df6-9dce-7605b9a73163','d6acad9f-9807-48a5-a73b-61b48263599c','36c9dbc3-c395-4836-b194-2b2e4f4afc0b',
--  'ea40e793-8deb-434d-8775-6f23b7fa23d4','7e91b4dc-f359-4d06-b2b1-a348c4135c01','51f5d88a-4e28-4e34-9c20-384dd83cf9c9','4d4c39c2-e879-4b07-8abf-8ba9905b5aff','69ebac6d-6f9e-4138-a418-9600c5bac3a5','e5c4c84a-6d83-43b4-a141-aef58ab5f283','5f431077-e128-4d04-8cf3-3896756c0576','f88cfa8b-6c3d-4340-9d8e-ed96262f285e','340593fa-885a-4543-bd0a-5afe656ab847','19a662f6-7108-46c9-b0bd-71d141668b91',
--  'e61645be-acfe-4976-ba82-bc0f14224205'
-- );
