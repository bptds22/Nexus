-- ════════════════════════════════════════════════════════════════════════════
-- Badges NLS + GP — RETRAIT (l'inverse d'operation.sql). Inclus par prod/rollback.sql et par
-- prod/rejeu-blanc.sql (\ir), DANS leur transaction.
--
-- Cible : les 10 identifiants écrits dans admin_operations BADGES_NLS_GP_NEXUS, rien d'autre.
-- Deux modes, choisis par les faits, jamais par le lanceur :
--   · SUPPRESSION — aucun des 10 n'a jamais été posé sur un athlète : les 10 lignes partent,
--     le catalogue redevient exactement celui d'avant ;
--   · DÉSACTIVATION — au moins une pose existe (vivante ou retirée) : on ne supprime pas (la
--     cascade emporterait les poses et leur trace) ; actif = false les retire de TOUTES les
--     lectures (fiches, cartes, choix du partenaire filtrent sur actif).
-- Une trace BADGES_NLS_GP_NEXUS_RETIRES dit le mode. Les fichiers du bucket restent : les
-- retirer avec televerser-icones.mjs --retirer, en mode SUPPRESSION seulement.
-- ════════════════════════════════════════════════════════════════════════════

do $ret$
declare
  v_ids   uuid[];
  v_poses int;
  v_mode  text;
  n       int;
begin
  select array(select jsonb_array_elements_text(details->'badge_ids')::uuid)
    into v_ids
    from public.admin_operations where operation = 'BADGES_NLS_GP_NEXUS';
  if coalesce(cardinality(v_ids), 0) <> 10 then
    raise exception 'NEXUS: trace BADGES_NLS_GP_NEXUS absente ou incomplète — rien à retirer';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'BADGES_NLS_GP_NEXUS_RETIRES') then
    raise exception 'NEXUS: retrait déjà fait (BADGES_NLS_GP_NEXUS_RETIRES)';
  end if;
  select count(*) into n from public.partner_badges where id = any (v_ids);
  if n <> 10 then
    raise exception 'NEXUS: % des 10 badges encore en base, attendu 10', n;
  end if;

  select count(*) into v_poses from public.partner_athlete_badges where partner_badge_id = any (v_ids);

  if v_poses = 0 then
    v_mode := 'SUPPRESSION';
    delete from public.partner_badges where id = any (v_ids);
  else
    v_mode := 'DESACTIVATION';
    update public.partner_badges set actif = false, updated_at = now() where id = any (v_ids);
  end if;
  get diagnostics n = row_count;
  if n <> 10 then
    raise exception 'NEXUS: % ligne(s) touchée(s), attendu 10', n;
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('BADGES_NLS_GP_NEXUS_RETIRES',
          'Retrait des 10 badges NLS + GP du catalogue Nexus (mode ' || v_mode || ').',
          jsonb_build_object('mode', v_mode, 'badge_ids', to_jsonb(v_ids), 'poses', v_poses),
          (select id from public.users where email = 'bptds22@gmail.com' and role = 'ADMIN'));

  raise notice 'NEXUS: retrait des 10 badges — mode %, % pose(s) trouvée(s)', v_mode, v_poses;
end $ret$;
