-- ═══════════════════════════════════════════════════════════════════════════
-- W0.2 — media_partners : le partenaire ne modifie QUE ses colonnes de profil.
--
-- Avant : la policy « Partners update own profile » ne figeait que status et
-- show_on_homepage (partner_privileged_cols_unchanged, 20260520170000). Un
-- partenaire connecté pouvait réécrire lui-même tier, category, homepage_order,
-- approved_at/approved_by, card_image_url, contact_*, user_id…
--
-- Forme : LISTE BLANCHE. Le trigger compare la ligne entière moins les colonnes
-- permises ; toute autre différence lève 42501. Une colonne ajoutée demain
-- (ex. une permission « peut évaluer ») est donc BLOQUÉE PAR DÉFAUT pour le
-- partenaire — il faut l'ajouter ici, par écrit, pour la lui ouvrir.
--
-- Hors partenaire : admin (is_admin()) et rôles serveur (service_role,
-- postgres : routes /api/admin/partners/*, pg_cron) passent sans contrôle.
-- La policy et partner_privileged_cols_unchanged restent en place (défense en
-- profondeur ; aucun contrat retiré).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.media_partners_garde_colonnes()
returns trigger
language plpgsql
-- INVOKER, et c'est porteur : en DEFINER, current_user vaudrait le propriétaire
-- (postgres) et la garde laisserait tout passer. is_admin() est DEFINER de son côté.
security invoker
set search_path = public, pg_temp
as $$
declare
  -- Ce que l'écran partenaire écrit réellement (relevé 2026-10-13) :
  --   /partenaire/profil    → organization_name, description, about_text,
  --                           website_url, instagram_handle, tiktok_handle,
  --                           facebook_url, x_url, youtube_url, linkedin_url,
  --                           logo_url
  --   /partenaire/bienvenue → terms_accepted_at, terms_version,
  --                           password_reset_completed_at
  --   moddatetime           → updated_at
  permises constant text[] := array[
    'organization_name', 'description', 'about_text',
    'website_url', 'instagram_handle', 'tiktok_handle', 'facebook_url',
    'x_url', 'youtube_url', 'linkedin_url', 'logo_url',
    'terms_accepted_at', 'terms_version', 'password_reset_completed_at',
    'updated_at'
  ];
  changees text[];
begin
  -- Rôles serveur (service_role, postgres, cron) : hors périmètre de la garde.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  select array_agg(n.key order by n.key) into changees
    from jsonb_each(to_jsonb(new) - permises) n
    left join jsonb_each(to_jsonb(old) - permises) o using (key)
   where o.value is distinct from n.value;

  if changees is not null then
    raise exception 'NEXUS: colonnes réservées à l''admin : %', array_to_string(changees, ', ')
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.media_partners_garde_colonnes() from public, anon, authenticated;

drop trigger if exists trg_media_partners_garde_colonnes on public.media_partners;
create trigger trg_media_partners_garde_colonnes
  before update on public.media_partners
  for each row execute function public.media_partners_garde_colonnes();

-- Gate : le trigger existe, il est actif, et sa fonction n'est exécutable par
-- personne d'autre que le propriétaire et service_role (liste complète).
do $$
declare
  f oid := 'public.media_partners_garde_colonnes()'::regprocedure;
  vus text[];
  veut text[] := array['postgres', 'service_role'];
begin
  if not exists (select 1 from pg_trigger
                  where tgrelid = 'public.media_partners'::regclass
                    and tgname = 'trg_media_partners_garde_colonnes'
                    and tgenabled = 'O') then
    raise exception 'NEXUS: trigger trg_media_partners_garde_colonnes absent ou inactif';
  end if;
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL = %, attendu %', vus, veut;
  end if;
end $$;
