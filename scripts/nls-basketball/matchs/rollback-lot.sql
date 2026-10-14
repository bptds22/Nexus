-- ============================================================================
-- NLS Premier League S02 — ROLLBACK du DERNIER lot de matchs (NLS_MATCHS_IMPORT)
-- TEXTE À RELIRE — NE PAS APPLIQUER EN PROD SANS LE GO DE BP.
-- ============================================================================
-- Défait UN lot, le plus récent non encore défait, d'après son journal :
--   · supprime les matchs que CE lot a insérés (et eux seuls) ;
--   · remet les anciennes valeurs des matchs que ce lot a modifiés ;
--   · ne touche à rien d'autre (les retraits signalés n'ont rien écrit).
-- Refusé, sans rien écrire, si :
--   · un match inséré par le lot a disparu, ou a été ajouté au calendrier d'un
--     recruteur ou d'un partenaire (matchs_ajoutes* — ON DELETE CASCADE les
--     effacerait en silence) ;
--   · un match modifié ne porte plus les valeurs que le lot lui a données
--     (une passe ou une main l'a touché depuis).
-- Pour défaire plusieurs lots : relancer, du plus récent au plus ancien.
-- Écrit une ligne admin_operations NLS_MATCHS_ROLLBACK (details.lot = id du lot).
do $$
declare
  v_bp uuid; v_op uuid; v_d jsonb; v_lot int;
  n_ins int; n_mod int; n_del int; n_upd int; n_base0 int; n_base1 int; v_txt text;
begin
  select id into v_bp from public.users where email = 'bptds22@gmail.com';

  select o.id, o.details into v_op, v_d from public.admin_operations o
   where o.operation = 'NLS_MATCHS_IMPORT'
     and o.id::text not in (select r.details->>'lot' from public.admin_operations r where r.operation = 'NLS_MATCHS_ROLLBACK')
   order by (o.details->>'lot_no')::int desc limit 1;
  if v_op is null then raise exception 'NEXUS: aucun lot NLS_MATCHS_IMPORT à défaire'; end if;
  v_lot := (v_d->>'lot_no')::int;
  n_ins := jsonb_array_length(v_d->'inseres');
  n_mod := jsonb_array_length(v_d->'modifies');

  -- gardes
  select string_agg(e->>'cle', ' ; ') into v_txt from jsonb_array_elements(v_d->'inseres') e
   where not exists (select 1 from public.games g where g.id = (e->>'id')::uuid and g.source_nom = 'NLS');
  if v_txt is not null then raise exception 'NEXUS: lot % — match(s) inséré(s) introuvable(s) : %', v_lot, v_txt; end if;

  select string_agg(e->>'cle', ' ; ') into v_txt from jsonb_array_elements(v_d->'inseres') e
   where exists (select 1 from public.matchs_ajoutes m where m.game_id = (e->>'id')::uuid)
      or exists (select 1 from public.matchs_ajoutes_partenaire m where m.game_id = (e->>'id')::uuid);
  if v_txt is not null then raise exception 'NEXUS: lot % — match(s) déjà ajouté(s) à un calendrier : % — rollback refusé', v_lot, v_txt; end if;

  select string_agg(e->>'cle', ' ; ') into v_txt from jsonb_array_elements(v_d->'modifies') e
   where not exists (select 1 from public.games g where g.id = (e->>'id')::uuid
     and g.game_date is not distinct from (e->'apres'->>'game_date')::date
     and g.game_time is not distinct from e->'apres'->>'game_time'
     and g.venue is not distinct from e->'apres'->>'venue'
     and g.home_score is not distinct from (e->'apres'->>'home_score')::int
     and g.visitor_score is not distinct from (e->'apres'->>'visitor_score')::int
     and g.is_played is not distinct from (e->'apres'->>'is_played')::boolean
     -- côtés : vérifiés quand le journal les porte (inversion possible)
     and (not (e->'apres' ? 'home_team_id')
          or (g.home_team_id is not distinct from (e->'apres'->>'home_team_id')::uuid
              and g.visitor_team_id is not distinct from (e->'apres'->>'visitor_team_id')::uuid
              and g.home_name_raw is not distinct from e->'apres'->>'home_name_raw'
              and g.visitor_name_raw is not distinct from e->'apres'->>'visitor_name_raw')));
  if v_txt is not null then raise exception 'NEXUS: lot % — match(s) touché(s) depuis le lot : % — rollback refusé', v_lot, v_txt; end if;

  select count(*) into n_base0 from public.games where source_nom = 'NLS';

  delete from public.games g using jsonb_array_elements(v_d->'inseres') e
   where g.id = (e->>'id')::uuid and g.source_nom = 'NLS';
  get diagnostics n_del = row_count;

  update public.games g set
         game_date = (e->'avant'->>'game_date')::date, game_time = e->'avant'->>'game_time',
         venue = e->'avant'->>'venue',
         home_score = (e->'avant'->>'home_score')::int, visitor_score = (e->'avant'->>'visitor_score')::int,
         is_played = (e->'avant'->>'is_played')::boolean, collecte_le = (e->'avant'->>'collecte_le')::timestamptz,
         home_team_id = coalesce((e->'avant'->>'home_team_id')::uuid, g.home_team_id),
         visitor_team_id = coalesce((e->'avant'->>'visitor_team_id')::uuid, g.visitor_team_id),
         home_name_raw = coalesce(e->'avant'->>'home_name_raw', g.home_name_raw),
         visitor_name_raw = coalesce(e->'avant'->>'visitor_name_raw', g.visitor_name_raw),
         updated_at = now()
    from jsonb_array_elements(v_d->'modifies') e
   where g.id = (e->>'id')::uuid;
  get diagnostics n_upd = row_count;

  select count(*) into n_base1 from public.games where source_nom = 'NLS';
  if n_del <> n_ins or n_upd <> n_mod or n_base1 <> n_base0 - n_ins then
    raise exception 'NEXUS: garde échouée — supprimés %/%, restaurés %/%, base NLS % -> %', n_del, n_ins, n_upd, n_mod, n_base0, n_base1; end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('NLS_MATCHS_ROLLBACK', 'Rollback du lot ' || v_lot || ' des matchs NLS',
          jsonb_build_object('lot', v_op, 'lot_no', v_lot, 'supprimes', v_d->'inseres', 'restaures', v_d->'modifies'), v_bp);

  raise notice 'NEXUS NLS rollback : lot % défait — % supprimé(s), % restauré(s) ; base NLS % -> %', v_lot, n_del, n_upd, n_base0, n_base1;
end $$;
