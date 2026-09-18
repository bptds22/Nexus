-- 20260918192106_rseq_sync_runs_mode
--
-- APPLIQUÉE en PROD le 2026-09-18 via MCP apply_migration, sur GO de BP.
-- Nom de fichier aligné sur la version RÉELLE assignée par MCP (rédigée sous
-- 20260918165007). 8 journaux existants passés en mode 'passe', colonne sans défaut vérifiée en prod.
--
-- VEILLE RSEQ SECONDAIRE — complément du lot 2 (journal).
-- LOCAL SEULEMENT. À appliquer en prod dans la même fenêtre que le lot 1
-- (20260918192044) et le redéploiement de `rseq-weekly-sync`.
--
-- Le lot 2 ajoute un mode `?mode=decouverte` à l'edge function. Ses passages
-- s'inscrivent dans rseq_sync_runs comme les passes — sans cette colonne, une
-- découverte y serait indiscernable d'une passe secondaire qui n'aurait lu
-- aucun match. `detail` porte ce qui n'a pas de colonne : nouvelles et
-- modifiées pour la découverte, ligues non traitées quand le fusible saute.
--
-- `mode` SANS valeur par défaut, comme `?secteur=` et `p_secteur` (décision BP
-- 2026-09-18 : explicite partout). Les lignes existantes sont toutes des passes
-- collégiales : elles reçoivent 'passe', puis le défaut est retiré.
--
-- Additif et compatible avec la fonction déployée aujourd'hui ? NON pour
-- l'insertion (NOT NULL sans défaut) — sans importance, puisque ce fichier
-- part dans la même fenêtre que le redéploiement.

alter table public.rseq_sync_runs
  add column mode   text  not null default 'passe',
  add column detail jsonb not null default '{}'::jsonb;

alter table public.rseq_sync_runs
  alter column mode drop default,
  add constraint rseq_sync_runs_mode_chk check (mode in ('passe', 'decouverte'));

comment on column public.rseq_sync_runs.mode is
  'passe (GetLeagueDiffusion par ligue) ou decouverte (GetLeagueList, catalogue). Sans defaut : l''appelant le dit.';
comment on column public.rseq_sync_runs.detail is
  'Compteurs propres au mode. decouverte : appels, nouvelles, modifiees, par_sport. '
  'Passe PARTIAL : ligues_non_traitees, fusible_s.';
comment on column public.rseq_sync_runs.statut is
  'RUNNING -> DONE | PARTIAL | ERROR. PARTIAL = le fusible (330 s) a arrete la passe avant la fin ; '
  'une alerte PASSE_PARTIELLE est levee. ERROR = aucune ligue traitee (ou decouverte vide).';

do $$
declare v_n int;
begin
  select count(*) into v_n from public.rseq_sync_runs where mode is distinct from 'passe';
  if v_n <> 0 then
    raise exception 'NEXUS: % journal(aux) sans mode ''passe'' apres ajout de la colonne', v_n;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'rseq_sync_runs'
                and column_name = 'mode' and column_default is not null) then
    raise exception 'NEXUS: rseq_sync_runs.mode a garde une valeur par defaut';
  end if;
end $$;
