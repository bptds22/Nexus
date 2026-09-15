-- ═══════════════════════════════════════════════════════════════════════════
-- M5 — ambassadeur_mon_tableau : la PROJECTION, sans identité.
--
-- POURQUOI UNE PROJECTION PLUTÔT QU'UNE POLICY DE LECTURE
-- La tentation était d'ouvrir ambassadeur_revendications au parrain avec
-- `using (parrain_athlete_id = mon athlete)`. Ç'aurait été une faute : la
-- ligne porte `filleul_athlete_id` et `candidats`, c'est-à-dire l'IDENTITÉ de
-- mineurs que le parrain n'a pas le droit de lire — et qu'il ne peut lire
-- nulle part ailleurs, puisque la RLS de `athletes` ne lui donne QUE sa
-- propre ligne (vérifié en prod : « athletes can read own profile »).
--
-- Une telle policy aurait donc rouvert, par la bande, exactement ce que la
-- RLS ferme. C'est le motif du retrait des policies directes partenaire au
-- profit des projections SECURITY DEFINER (20260820023055) : la table reste
-- fermée, une fonction rend une vue appauvrie.
--
-- CE QUI SORT : ce que le parrain a TAPÉ LUI-MÊME (prénom, nom), le statut,
-- la date. Rien d'autre. Il ne peut donc rien apprendre qu'il ne sache déjà —
-- et surtout pas « cette personne existe sur Nexus » pour une ligne
-- EN_ATTENTE, dont le statut ne dit que « on vérifie ».
--
-- CE QUI NE SORT JAMAIS : filleul_athlete_id, candidats, methode. `methode`
-- est exclue volontairement : « courriel » signifierait « cette adresse a un
-- compte », ce qui est précisément l'oracle qu'on refuse.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ambassadeur_mon_tableau()
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_uid       uuid;
  v_parrain   uuid;
  v_confirmes int;
  v_jour      date;
  v_restant   int;
  v_paliers   jsonb;
  v_lignes    jsonb;
  v_badge     boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NEXUS: tu dois etre connecte.';
  end if;

  select a.id into v_parrain from public.athletes a where a.user_id = v_uid limit 1;
  if v_parrain is null then
    raise exception 'NEXUS: seul un athlete a un tableau d''ambassadeur.';
  end if;

  select count(*) into v_confirmes
    from public.ambassadeur_revendications
   where parrain_athlete_id = v_parrain and statut = 'CONFIRMEE';

  v_jour := (now() at time zone 'America/Montreal')::date;
  select greatest(0, 5 - coalesce(max(n), 0)) into v_restant
    from public.ambassadeur_tentatives
   where athlete_id = v_parrain and jour = v_jour;

  select coalesce(jsonb_agg(palier order by palier), '[]'::jsonb) into v_paliers
    from public.ambassadeur_paliers where athlete_id = v_parrain;

  -- Le badge est-il DÉJÀ posé ? L'écran a besoin de distinguer « débloqué mais
  -- pas porté » de « porté » — ce sont deux états, et la bascule doit savoir
  -- dans quel sens elle va.
  select exists (
    select 1 from public.athlete_badges ab
      join public.badges b on b.id = ab.badge_id
     where ab.athlete_id = v_parrain
       and b.code = 'ambassadeur'
       and ab.retire_le is null) into v_badge;

  -- La saisie du parrain, et rien de plus.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',      r.id,
           'prenom',  r.prenom,
           'nom',     r.nom,
           'statut',  r.statut,
           'le',      r.created_at) order by r.created_at desc), '[]'::jsonb)
    into v_lignes
    from public.ambassadeur_revendications r
   where r.parrain_athlete_id = v_parrain;

  return jsonb_build_object(
    'confirmes',        v_confirmes,
    'paliers',          v_paliers,
    'badge_debloque',   exists (select 1 from public.ambassadeur_paliers
                                 where athlete_id = v_parrain and palier = 5),
    'badge_porte',      v_badge,
    'recherches_restantes', v_restant,
    'revendications',   v_lignes);
end;
$fn$;

revoke all on function public.ambassadeur_mon_tableau() from public, anon;
grant execute on function public.ambassadeur_mon_tableau() to authenticated;

comment on function public.ambassadeur_mon_tableau() is
$c$Tableau de bord de l'athlète ambassadeur.

Ne rend QUE ce que le parrain a saisi lui-même, plus des compteurs. Ni
filleul_athlete_id, ni candidats, ni methode — `methode = courriel` dirait
« cette adresse a un compte sur Nexus », ce qui est l'oracle que tout ce
chantier refuse d'ouvrir.

La table reste fermée au parrain (une seule policy SELECT, is_admin()) :
cette fonction est son unique chemin de lecture.$c$;
