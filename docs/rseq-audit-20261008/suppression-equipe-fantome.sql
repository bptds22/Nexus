-- EXÉCUTÉ en prod le 2026-10-08 17:26:56 UTC (GO BP) : 1 carte, 1 équipe, 1 ligne admin_operations.
-- PARTIE 3 — Suppression de l'équipe fantôme Greaves + de la carte prospect de test qui la référence.
-- NE PAS EXÉCUTER sans le GO de BP. Transaction gardée : exactement 1 carte, 1 équipe, 1 ligne
-- admin_operations, sinon RIEN n'est écrit.
--
-- Relevé prod 2026-10-08 (lecture seule) :
--   équipe 85db3d30-974e-460b-83f6-5560d24612d7 — « Football », Académie adventiste Greaves,
--     Juvénile Masculin AAA, saison 2025-2026 (et non 2026), rseq_team_id null, créée 2026-06-29 02:52 UTC.
--     0 team_athletes, 0 team_coaches, 0 match, 0 users.primary_team_id, 0 invitation, 0 page,
--     0 fanion, 0 événement, 0 besoin, 0 jeton, 0 classement, 0 alerte, 0 revendication.
--   carte e7d97996-cd22-4fdb-b7dc-7a86860f3f97 — « adrian test », créée 2026-10-07 20:49 UTC par
--     nexus.recruteur@nexussports.ca, unité Nexus Collégial × Basketball, étape IDENTIFIE.
--     Dépendants : 1 ligne cartes_prospect_journal (CASCADE) ; 0 note, 0 liste, 0 invitation,
--     0 rappel, 0 rapprochement. Le trigger trg_carte_z_suppression écrit 1 ligne
--     cartes_prospect_suppressions (motif RETRAIT).
-- Ordre : la carte d'abord (sa FK team_id est ON DELETE SET NULL : supprimer l'équipe d'abord
-- réécrirait la carte au lieu de la laisser disparaître).
do $$
declare
  v_bp uuid;
  v_equipe constant uuid := '85db3d30-974e-460b-83f6-5560d24612d7';
  v_carte  constant uuid := 'e7d97996-cd22-4fdb-b7dc-7a86860f3f97';
  n_carte int; n_equipe int; n_journal int; n_ops_avant int; n_ops_apres int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';

  -- Gardes de contenu : on supprime ce qu'on a relevé, rien d'autre.
  perform 1 from public.teams t join public.schools s on s.id = t.school_id
   where t.id = v_equipe and s.name = 'Académie adventiste Greaves' and t.rseq_team_id is null;
  if not found then raise exception 'NEXUS: équipe % introuvable ou modifiée', v_equipe; end if;
  if exists (select 1 from public.team_athletes where team_id = v_equipe)
     or exists (select 1 from public.team_coaches where team_id = v_equipe)
     or exists (select 1 from public.games where home_team_id = v_equipe or visitor_team_id = v_equipe)
     or exists (select 1 from public.users where primary_team_id = v_equipe)
     or exists (select 1 from public.cartes_prospect where team_id = v_equipe and id <> v_carte) then
    raise exception 'NEXUS: l''équipe % a des dépendants nouveaux — rien écrit', v_equipe;
  end if;
  perform 1 from public.cartes_prospect c join public.users u on u.id = c.cree_par
   where c.id = v_carte and c.team_id = v_equipe and u.email = 'nexus.recruteur@nexussports.ca';
  if not found then raise exception 'NEXUS: carte % introuvable ou modifiée', v_carte; end if;

  select count(*) into n_ops_avant from public.admin_operations;
  select count(*) into n_journal from public.cartes_prospect_journal where carte_id = v_carte;

  delete from public.cartes_prospect where id = v_carte;
  get diagnostics n_carte = row_count;
  delete from public.teams where id = v_equipe;
  get diagnostics n_equipe = row_count;

  insert into public.admin_operations (operation, motif, details, par)
  values ('SUPPRESSION_EQUIPE_FANTOME',
          'Équipe fantôme Greaves (créée à la main, 0 athlète, 0 coach, 0 match) et carte prospect de test qui la référençait',
          jsonb_build_object('team_id', v_equipe, 'ecole', 'Académie adventiste Greaves',
                             'carte_id', v_carte, 'carte_journal_cascade', n_journal),
          v_bp);
  select count(*) into n_ops_apres from public.admin_operations;

  if n_carte <> 1 or n_equipe <> 1 or n_ops_apres - n_ops_avant <> 1 then
    raise exception 'NEXUS: garde échouée (cartes %, équipes %, ops +%) — rien écrit',
      n_carte, n_equipe, n_ops_apres - n_ops_avant;
  end if;
  raise notice 'OK : 1 carte, 1 équipe supprimées (journal de carte en cascade : %), 1 ligne admin_operations', n_journal;
end $$;
