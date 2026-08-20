-- 20260820024703_fix_partner_card_downloads_partner_id_resolution
--
-- Appliquee en PROD le 2026-08-19 via MCP apply_migration. Nom de fichier
-- aligne sur la version REELLE. Chercher par `name`, jamais par `version`.
--
-- C'EST LA DEFINITION VIVANTE de partner_card_downloads_list.
--
-- CORRECTIF de 20260820024416, applique quelques minutes plus tot le meme jour.
--
-- BUG : le filtre s'ecrivait `d.partner_id = (select auth.uid())`. FAUX.
-- partner_card_downloads.partner_id est une FK vers media_partners(id), PAS
-- vers auth.users(id) :
--   partner_card_downloads_partner_id_fkey FOREIGN KEY (partner_id)
--     REFERENCES media_partners(id) ON DELETE CASCADE
--
-- La fonction ne pouvait donc JAMAIS rendre de ligne — historique vide en
-- permanence, sans erreur. Exactement le mode de panne muette que tout ce
-- chantier cherche a eliminer, reintroduit par distraction.
--
-- DETECTE parce que la table contenait une ligne avec partner_id = f3751302-…
-- (l'id media_partners de bpdesfosses@gmail.com) alors que son auth.uid() est
-- 011ef8c9-…. La fonction rendait 0 la ou on attendait 1.
--
-- Le predicat correct est celui que porte deja la policy RLS de la table,
-- « Partners read own download history » — repris a l'identique plutot que
-- d'en inventer un second.
--
-- PREUVES (JWT reels, prod) :
--   bpdesfosses (1 telechargement) ..... 1 ligne, identite presente (Alexy / Football)
--   lespritsportif (0 telechargement) .. 0 ligne  <- isolation entre partenaires

create or replace function public.partner_card_downloads_list(p_limit integer default 50)
returns table (
  id uuid,
  format text,
  downloaded_at timestamptz,
  athlete_id uuid,
  athlete_first_name text,
  athlete_last_name text,
  athlete_photo_url text,
  athlete_sport_nom text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select
    d.id,
    d.format,
    d.downloaded_at,
    d.athlete_id,
    case when public.is_partner_eligible_athlete(d.athlete_id) then a.first_name end,
    case when public.is_partner_eligible_athlete(d.athlete_id) then a.last_name  end,
    case when public.is_partner_eligible_athlete(d.athlete_id) then a.photo_url  end,
    case when public.is_partner_eligible_athlete(d.athlete_id) then s.nom        end
  from public.partner_card_downloads d
  left join public.athletes a on a.id = d.athlete_id
  left join public.sports   s on s.id = a.sport_id
  where public.is_approved_partner(null)
    -- partner_id -> media_partners(id), resolu depuis auth.uid(). Predicat
    -- repris a l'identique de la policy « Partners read own download history ».
    and d.partner_id in (
      select mp.id from public.media_partners mp
      where mp.user_id = (select auth.uid())
    )
  order by d.downloaded_at desc
  limit coalesce(p_limit, 50);
$fn$;

comment on function public.partner_card_downloads_list(integer) is
$c$Historique des cartes telechargees par le partenaire appelant. Remplace la
lecture directe de partner_card_downloads avec embed athletes, qui dependait de
la policy « Approved partners read opted-in athletes » supprimee au point 5b(d)
— sans quoi l'historique serait devenu une liste de cartes sans nom ni photo,
en silence.

partner_card_downloads.partner_id est une FK vers media_partners(id), PAS vers
auth.users(id) : le filtre resout donc auth.uid() -> media_partners.id, avec le
meme predicat que la policy RLS de la table. La premiere version de cette
fonction comparait partner_id a auth.uid() directement et ne rendait jamais
rien.

L'identite de l'athlete n'est projetee que s'il est TOUJOURS partenaire-
eligible ; sinon la ligne subsiste avec des champs NULL — la trace est
preservee sans divulguer un profil redevenu invisible.

NE PROJETTE JAMAIS : date_naissance, email, telephone, nom_parent,
telephone_parent, moyenne_generale, notes_coach, rapport_entraineur.$c$;

revoke all on function public.partner_card_downloads_list(integer) from public;
revoke all on function public.partner_card_downloads_list(integer) from anon;
grant execute on function public.partner_card_downloads_list(integer) to authenticated;
