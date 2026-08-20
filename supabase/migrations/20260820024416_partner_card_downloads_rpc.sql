-- 20260820024416_partner_card_downloads_rpc
--
-- Appliquee en PROD le 2026-08-19 via MCP apply_migration. Nom de fichier
-- aligne sur la version REELLE. Chercher par `name`, jamais par `version`.
--
-- ⚠ BOGUEE — CORRIGEE PAR 20260820024703_fix_partner_card_downloads_partner_id_resolution
-- quelques minutes plus tard. Le filtre s'ecrivait ici
-- `d.partner_id = (select auth.uid())`, or partner_id est une FK vers
-- media_partners(id) et non vers auth.users(id) : la fonction ne rendait
-- JAMAIS de ligne. Ce fichier documente l'etat intermediaire ; la definition
-- VIVANTE est celle de la migration suivante.
--
-- POURQUOI CETTE FONCTION EXISTE
-- Surface manquee au balayage initial du lot 5b. /partenaire/telechargements
-- lisait partner_card_downloads avec un embed
-- `athletes(id, first_name, last_name, photo_url, sport_id, sports!sport_id(nom))`.
-- Cet embed dependait de la policy « Approved partners read opted-in athletes »,
-- supprimee au point 5b(d) : il rend desormais NULL. La page aurait continue de
-- lister les telechargements mais SANS nom, SANS photo, SANS sport — une panne
-- muette. Ce n'est pas `!inner` : les lignes restent, seul l'embed se vide.
--
-- PORTEE : l'historique est PROPRE a l'appelant. Un partenaire doit revoir ce
-- QU'IL a telecharge, meme si l'athlete a depuis retire son opt-in — retirer la
-- ligne reecrirait le passe. En revanche l'IDENTITE n'est projetee que si
-- l'athlete est TOUJOURS eligible : sinon la ligne subsiste avec des champs a
-- NULL, ce qui preserve la trace sans divulguer un profil redevenu invisible.

create or replace function public.partner_card_downloads_list(p_limit integer default 50)
returns table (
  id uuid, format text, downloaded_at timestamptz, athlete_id uuid,
  athlete_first_name text, athlete_last_name text,
  athlete_photo_url text, athlete_sport_nom text
)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $fn$
  select
    d.id, d.format, d.downloaded_at, d.athlete_id,
    case when public.is_partner_eligible_athlete(d.athlete_id) then a.first_name end,
    case when public.is_partner_eligible_athlete(d.athlete_id) then a.last_name  end,
    case when public.is_partner_eligible_athlete(d.athlete_id) then a.photo_url  end,
    case when public.is_partner_eligible_athlete(d.athlete_id) then s.nom        end
  from public.partner_card_downloads d
  left join public.athletes a on a.id = d.athlete_id
  left join public.sports   s on s.id = a.sport_id
  where public.is_approved_partner(null)
    and d.partner_id = (select auth.uid())   -- ⚠ FAUX, corrige en 20260820024703
  order by d.downloaded_at desc
  limit coalesce(p_limit, 50);
$fn$;

revoke all on function public.partner_card_downloads_list(integer) from public;
revoke all on function public.partner_card_downloads_list(integer) from anon;
grant execute on function public.partner_card_downloads_list(integer) to authenticated;
