-- ═══════════════════════════════════════════════════════════════════════════
-- W0.3 — media_partners : anon ne lit plus que la vitrine publique.
--
-- Avant : « Public read approved partners » (TO public, status = 'APPROVED',
-- 20260520170000) + le SELECT de table que Supabase accorde à anon → un
-- visiteur anonyme lisait TOUTES les colonnes des partenaires approuvés,
-- contact_email et contact_name compris.
--
-- Forme : privilège de COLONNE, en liste blanche. Une colonne ajoutée demain
-- n'est pas lisible par anon tant qu'elle n'est pas nommée ici.
--
-- Ce que les pages publiques lisent (relevé 2026-10-13) :
--   app/components/PartnerCarousel.tsx (accueil) → id, organization_name,
--     logo_url, card_image_url, tier, category, homepage_order ;
--     filtres status, show_on_homepage
--   app/partenaires/[id]/page.tsx → id, organization_name, logo_url,
--     card_image_url, description, about_text, website_url, instagram_handle,
--     tiktok_handle, facebook_url, x_url, youtube_url, linkedin_url
--
-- Hors portée (volontairement) : le rôle authenticated garde le SELECT de
-- table — l'admin et le partenaire lisent leurs lignes en select("*"). Un
-- utilisateur connecté NON partenaire lit donc encore contact_* des
-- partenaires approuvés : à traiter avec la policy, pas ici.
-- ═══════════════════════════════════════════════════════════════════════════

revoke select on public.media_partners from anon;

grant select (
  id, organization_name, logo_url, card_image_url,
  tier, category, homepage_order, show_on_homepage, status,
  description, about_text, website_url, instagram_handle, tiktok_handle,
  facebook_url, x_url, youtube_url, linkedin_url
) on public.media_partners to anon;

-- Gate : anon n'a AUCUN SELECT de table, et ses colonnes lisibles sont
-- exactement la liste ci-dessus (comparaison complète, jamais par inclusion).
do $$
declare
  vus text[];
  veut text[] := array[
    'about_text', 'card_image_url', 'category', 'description', 'facebook_url',
    'homepage_order', 'id', 'instagram_handle', 'linkedin_url', 'logo_url',
    'organization_name', 'show_on_homepage', 'status', 'tier', 'tiktok_handle',
    'website_url', 'x_url', 'youtube_url'
  ];
begin
  if exists (select 1 from information_schema.table_privileges
              where table_schema = 'public' and table_name = 'media_partners'
                and grantee in ('anon', 'PUBLIC') and privilege_type = 'SELECT') then
    raise exception 'NEXUS: anon/PUBLIC a encore le SELECT de table sur media_partners';
  end if;
  select array_agg(a.attname::text order by a.attname::text) into vus
    from pg_attribute a
   where a.attrelid = 'public.media_partners'::regclass
     and a.attnum > 0 and not a.attisdropped
     and has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT');
  if vus is distinct from veut then
    raise exception 'NEXUS: colonnes lisibles par anon = %, attendu %', vus, veut;
  end if;
end $$;
