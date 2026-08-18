-- ═══════════════════════════════════════════════════════════════
-- get_active_blackout — la période qui couvre un athlète, ou rien.
--
-- POURQUOI. is_messaging_blacked_out ne rend qu'un booléen : le client sait
-- qu'il est bloqué, jamais pourquoi ni jusqu'à quand. Le message affiché est
-- donc resté générique (« période de restriction RSEQ en vigueur »), ce que
-- BLACKOUT_MESSAGE annonce lui-même comme provisoire.
--
-- PAS DE DUPLICATION DU PRÉDICAT — c'est le point important.
-- Recopier la règle ici en aurait fait DEUX implémentations condamnées à
-- diverger : le fuseau, l'inversion du NULL, les bornes inclusives auraient
-- dû rester synchronisés à la main. On inverse donc la dépendance :
--   get_active_blackout        porte le prédicat, une seule fois
--   is_messaging_blacked_out   devient « existe-t-il une telle période ? »
-- Son comportement est inchangé à la ligne près ; seule sa provenance change.
--
-- PLUSIEURS PÉRIODES QUI SE CHEVAUCHENT. On rend celle qui finit le PLUS
-- TARD : c'est la date qui intéresse le recruteur, puisqu'il reste bloqué
-- jusqu'à ce que la dernière soit close. Rendre la première expirée
-- afficherait une date de libération fausse.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.get_active_blackout(p_athlete uuid default null)
returns table (
  id         uuid,
  libelle    text,
  date_debut date,
  date_fin   date,
  sport_nom  text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select b.id, b.libelle, b.date_debut, b.date_fin, s.nom
  from public.blackout_periods b
  -- LEFT JOIN volontaire : si p_athlete est NULL ou introuvable, toutes les
  -- colonnes de `a` sont NULL et les tests ci-dessous rendent VRAI. Un
  -- athlète qu'on ne peut pas identifier est COUVERT, pas exempté.
  left join public.athletes a on a.id = p_athlete
  left join public.sports   s on s.id = b.sport_id
  where b.actif
    -- Fuseau explicite : current_date suivrait le TimeZone de la session
    -- (UTC sous PostgREST) et decalerait la frontiere d'une journee en
    -- soiree — le 14 mars a 20 h a Montreal, il est deja le 15 en UTC.
    and (now() at time zone 'America/Montreal')::date between b.date_debut and b.date_fin

    -- Sport : NULL cote periode = toutes disciplines.
    --         NULL cote athlete = couvert (meme regle que la promotion).
    and (b.sport_id is null or a.sport_id is null or a.sport_id = b.sport_id)

    -- Promotion. LE NULL N'EST PAS UNE PORTE DE SORTIE : un athlete dont
    -- annee_diplomation est inconnue est COUVERT par une periode bornee.
    and (
          (b.promo_min is null and b.promo_max is null)
       or a.annee_diplomation is null
       or (    (b.promo_min is null or a.annee_diplomation >= b.promo_min)
           and (b.promo_max is null or a.annee_diplomation <= b.promo_max))
    )
  order by b.date_fin desc, b.date_debut asc
  limit 1;
$function$;

comment on function public.get_active_blackout(uuid) is
  'Periode de silence RSEQ couvrant cet athlete aujourd hui, ou aucune ligne. Source UNIQUE du predicat ; is_messaging_blacked_out s appuie dessus. Si plusieurs periodes se chevauchent, rend celle qui finit le plus tard.';

revoke all on function public.get_active_blackout(uuid) from public, anon;
grant execute on function public.get_active_blackout(uuid) to authenticated;

-- ── is_messaging_blacked_out : même contrat, prédicat délégué.
--    Le trigger enforce_messaging_blackout et la policy
--    recruteur_athlete_conversations_insert continuent de l'appeler sans
--    rien savoir du changement.
create or replace function public.is_messaging_blacked_out(p_athlete uuid default null)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (select 1 from public.get_active_blackout(p_athlete));
$function$;

comment on function public.is_messaging_blacked_out(uuid) is
  'Vrai si une periode de silence RSEQ active couvre cet athlete. Delegue le predicat a get_active_blackout() — source unique.';
