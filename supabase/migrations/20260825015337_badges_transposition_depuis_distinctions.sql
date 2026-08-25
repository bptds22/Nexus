-- ═══════════════════════════════════════════════════════════════
-- TRANSPOSITION — evaluations.distinctions → athlete_badges.
--
-- evaluations.distinctions n'est NI vidée NI supprimée : elle reste la source
-- que lit l'app 1.2 en magasin, désormais entretenue par le miroir.
--
-- ── OBSTACLE RENCONTRÉ, ET POURQUOI IL N'EST PAS CONTOURNÉ ───────
-- L'ancien badge `allstar` ne porte AUCUN détail : le catalogue de la 1.2 le
-- déclare `hasDetail: false`, l'écran n'en a jamais demandé. Il se transpose
-- vers `equipe-etoiles`, un honneur dont le contexte (le millésime) est
-- OBLIGATOIRE. Le trigger refuserait donc la ligne.
--
-- Trois issues, une seule honnête :
--   · inventer un millésime → écrire une information fausse sur un mineur
--     montrée à des recruteurs. Exclu.
--   · désarmer le trigger le temps de l'INSERT → la ligne violerait
--     l'invariant pour toujours, sans trace. Exclu.
--   · consigner que ces lignes viennent d'un format qui n'avait pas la
--     donnée, et les exempter NOMMÉMENT. Retenu.
--
-- D'où la colonne `origine`. Les lignes 'transposition' sont dispensées de
-- contexte ; toute saisie ultérieure ('saisie', le défaut) y reste soumise.
-- Le contexte manquant est REPÉRABLE et rattrapable :
--     select * from public.athlete_badges ab join public.badges b on b.id=ab.badge_id
--      where ab.origine='transposition' and b.requiert_contexte and ab.contexte is null;
-- ═══════════════════════════════════════════════════════════════

alter table public.athlete_badges
  add column origine text not null default 'saisie'
    check (origine in ('saisie','transposition'));

comment on column public.athlete_badges.origine is
$c$'saisie' = posé par un humain via l'application. 'transposition' = repris de
evaluations.distinctions par la migration badges_transposition_depuis_distinctions.

Les lignes 'transposition' sont DISPENSÉES du contexte obligatoire : l'ancien
format ne stockait pas de millésime pour `allstar`, et aucun n'a été inventé.$c$;

create or replace function public.badge_contexte_requis()
  returns trigger language plpgsql
  security definer set search_path to 'public'
as $function$
declare v_requis boolean; v_code text;
begin
  select requiert_contexte, code into v_requis, v_code
  from public.badges where id = new.badge_id;

  if v_requis is null then
    raise exception 'NEXUS: badge_id % inconnu au catalogue', new.badge_id;
  end if;

  -- AJOUT 2026-08-25 : les lignes reprises de l'ancien format échappent à
  -- l'exigence de contexte, que ce format ne pouvait pas satisfaire. Voir
  -- le commentaire de la colonne `origine`.
  if v_requis and new.origine <> 'transposition'
     and coalesce(btrim(new.contexte), '') = '' then
    raise exception 'NEXUS: le badge « % » exige un contexte (millésime, statistique…)', v_code;
  end if;

  return new;
end;
$function$;

-- ── La transposition proprement dite ─────────────────────────────
do $$
declare
  v_avant_badges int; v_apres_badges int;
  v_avant_entrees int; v_attendu int; v_orphelins int; v_liste text;
begin
  -- ÉTAT AVANT, dans la MÊME transaction que l'écriture : un comptage fait
  -- dans une session séparée pourrait décrire une base déjà modifiée par un
  -- coach travaillant en production pendant la migration.
  select count(*) into v_avant_badges from public.athlete_badges;

  select count(*) into v_avant_entrees
  from public.evaluations e
  cross join lateral jsonb_array_elements(coalesce(e.distinctions,'[]'::jsonb)) d(item);

  -- Codes anciens SANS correspondance : ils seraient perdus en silence.
  -- `progression` en fait partie — il n'a pas d'équivalent au nouveau
  -- catalogue et n'est délibérément pas transposé.
  select count(*), coalesce(string_agg(distinct code, ', '), '(aucun)')
    into v_orphelins, v_liste
  from (
    select d.item->>'badge' as code
    from public.evaluations e
    cross join lateral jsonb_array_elements(coalesce(e.distinctions,'[]'::jsonb)) d(item)
  ) s
  where s.code not in ('captain','allstar','mvp','team_leader','league_leader','custom');

  if v_orphelins > 0 then
    raise notice 'NEXUS: % entrée(s) sans correspondance, NON transposée(s) : %. Elles restent dans evaluations.distinctions mais seront effacées de cette colonne au premier passage du miroir.', v_orphelins, v_liste;
  end if;

  with source as (
    select e.athlete_id, e.coach_id, e.created_at,
           d.item->>'badge' as code_ancien,
           nullif(btrim(coalesce(d.item->>'detail','')), '') as detail
    from public.evaluations e
    cross join lateral jsonb_array_elements(coalesce(e.distinctions,'[]'::jsonb)) d(item)
  ),
  corr(code_ancien, code_neuf) as (
    values ('captain','capitaine'), ('allstar','equipe-etoiles'), ('mvp','mvp'),
           ('team_leader','leader-equipe'), ('league_leader','leader-ligue'),
           ('custom','nexus-x')
  ),
  apparie as (
    select s.athlete_id, b.id as badge_id, s.detail as contexte,
           s.coach_id, s.created_at,
           -- Un même badge posé par DEUX coachs sur le même athlète ne fait
           -- qu'une ligne. L'attribution revient au PREMIER qui l'a donné :
           -- c'est le seul choix défendable, et il est déterministe
           -- (coach_id départage une égalité de date).
           row_number() over (
             partition by s.athlete_id, b.id, s.detail
             order by s.created_at, s.coach_id
           ) as rn
    from source s
    join corr c on c.code_ancien = s.code_ancien
    join public.badges b on b.code = c.code_neuf
  )
  insert into public.athlete_badges
    (athlete_id, badge_id, contexte, attribue_par, created_at, origine)
  select athlete_id, badge_id, contexte, coach_id,
         created_at,   -- date d'ORIGINE, pas now() : l'historique est préservé
         'transposition'
  from apparie where rn = 1;

  get diagnostics v_attendu = row_count;
  select count(*) into v_apres_badges from public.athlete_badges;

  if v_apres_badges - v_avant_badges <> v_attendu then
    raise exception 'NEXUS: % lignes insérées mais delta de % — abandon', v_attendu, v_apres_badges - v_avant_badges;
  end if;

  raise notice 'NEXUS: transposition — % entrées distinctions lues, % orphelines, % badges créés (% -> %).',
    v_avant_entrees, v_orphelins, v_attendu, v_avant_badges, v_apres_badges;
end $$;