-- ═══════════════════════════════════════════════════════════════════════════
-- W0.6a — partenaires_vitrine() : la vitrine publique des partenaires, en RPC.
--
-- ÉTAPE 1 sur 2 (expand). Additif seul : rien n'est retiré ici. 094806 ferme
-- ensuite la lecture directe de media_partners aux connectés non concernés ;
-- le carrousel de l'accueil, qui tourne AVEC la session de l'usager, doit donc
-- lire par cette RPC AVANT que 094806 ne s'applique.
--
-- Colonnes : exactement les 18 que anon peut lire depuis 094802, rien d'autre.
-- Une colonne ajoutée à media_partners n'apparaît pas ici sans être nommée.
-- Lignes : status = 'APPROVED' seulement (même règle que l'ancienne policy
-- « Public read approved partners »).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.partenaires_vitrine()
returns table (
  id uuid, organization_name text, logo_url text, card_image_url text,
  tier text, category text, homepage_order integer, show_on_homepage boolean, status text,
  description text, about_text text, website_url text, instagram_handle text,
  tiktok_handle text, facebook_url text, x_url text, youtube_url text, linkedin_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select mp.id, mp.organization_name, mp.logo_url, mp.card_image_url,
         mp.tier, mp.category, mp.homepage_order, mp.show_on_homepage, mp.status,
         mp.description, mp.about_text, mp.website_url, mp.instagram_handle,
         mp.tiktok_handle, mp.facebook_url, mp.x_url, mp.youtube_url, mp.linkedin_url
    from public.media_partners mp
   where mp.status = 'APPROVED';
$$;

revoke all on function public.partenaires_vitrine() from public;
grant execute on function public.partenaires_vitrine() to anon, authenticated, service_role;

-- Gate ACL : liste complète triée.
do $$
declare
  f oid := 'public.partenaires_vitrine()'::regprocedure;
  vus text[];
  veut text[] := array['anon', 'authenticated', 'postgres', 'service_role'];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL = %, attendu %', vus, veut;
  end if;
end $$;
