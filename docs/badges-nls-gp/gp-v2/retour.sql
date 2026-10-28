-- ════════════════════════════════════════════════════════════════════════════
-- Badges GP v2 — RETOUR aux icônes v1 (l'inverse d'operation.sql). Inclus (\ir) par
-- gp-v2/rollback.sql et gp-v2/rejeu-blanc.sql, DANS leur transaction.
--
-- Lit les 5 changements de la trace BADGES_GP_ICONES_V2 ; chaque ligne doit pointer ENCORE sur
-- la v2, et l'ancien fichier v1 doit être présent dans le stockage. Après l'apply, les v1 sont
-- supprimés : un vrai retour exige d'abord de les redéposer
--   (televerser-icones.mjs --fichiers gp-prospect.png,gp-top50.png,gp-top25.png,gp-top10.png,gp-mvp.png --envoyer).
-- Trace : BADGES_GP_ICONES_V2_RETOUR.
-- ════════════════════════════════════════════════════════════════════════════

do $ret$
declare
  v_chg jsonb;
  c     jsonb;
  n     int;
begin
  select details->'changements' into v_chg from public.admin_operations where operation = 'BADGES_GP_ICONES_V2';
  if coalesce(jsonb_array_length(v_chg), 0) <> 5 then
    raise exception 'NEXUS: trace BADGES_GP_ICONES_V2 absente ou incomplète — rien à défaire';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'BADGES_GP_ICONES_V2_RETOUR') then
    raise exception 'NEXUS: retour déjà fait (BADGES_GP_ICONES_V2_RETOUR)';
  end if;

  for c in select * from jsonb_array_elements(v_chg)
  loop
    if not exists (select 1 from storage.objects o
                    where o.bucket_id = 'partner-badges' and o.name = c->>'avant'
                      and o.metadata->>'mimetype' = 'image/png') then
      raise exception 'NEXUS: ancien fichier % absent — le redéposer avant le retour', c->>'avant';
    end if;
    update public.partner_badges
       set icone_path = c->>'avant', updated_at = now()
     where id = (c->>'id')::uuid and icone_path = c->>'apres';
    get diagnostics n = row_count;
    if n <> 1 then
      raise exception 'NEXUS: « % » ne pointe plus sur % — retour refusé', c->>'libelle', c->>'apres';
    end if;
  end loop;

  insert into public.admin_operations (operation, motif, details, par)
  values ('BADGES_GP_ICONES_V2_RETOUR',
          'Badges GP : retour aux 5 icônes v1.',
          jsonb_build_object('changements', v_chg),
          (select id from public.users where email = 'bptds22@gmail.com' and role = 'ADMIN'));

  raise notice 'NEXUS: 5 badges GP revenus aux fichiers v1';
end $ret$;
