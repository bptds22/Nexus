-- Apply PROD de 20261026150000_relance_consentement_v2 (GO BP 2026-10-26), par le connecteur Supabase.
-- UN SEUL bloc DO = une seule instruction : toute garde qui échoue annule TOUT (migration,
-- inscription schema_migrations, admin_operations). Migration embarquée telle que git la stocke
-- (LF), md5 vérifié avant exécution.
do $nexus_apply$
declare
  contenu text := $nexus_mig$-- ════════════════════════════════════════════════════════════════════════════
-- 20261026150000 — Relance du consentement partenaires v2 (décisions BP, 2026-10-26)
--
-- Constat (prod, 2026-10-26) : consentement_partenaire_v2_pousser() n'a jamais été lancée
-- (push_le vide pour les 181 admissibles). Cible = 157 (150 jamais demandés + 7 en attente).
-- BP veut UNE push maintenant et UNE dernière à J+7 pour les non-répondants, pas plus.
--
-- Ce que fait cette migration — ADDITIVE :
--   · consentement_partenaire_v2.relance_le : la relance unique de J+7 (même rôle que push_le) ;
--   · consentement_partenaire_v2_pousser(p_confirmer, p_athlete DEFAULT NULL) : DROP + CREATE.
--       - p_athlete restreint la cible à UN athlète (test sur le compte nexus.onboarding) ;
--       - texte de la push décidé par BP (D1) ;
--       - « ENVOYER 0 » est refusé : un second passage n'envoie rien et le dit ;
--       - le reste du corps est celui de 20261018150000, à l'identique.
--     DROP + CREATE plutôt qu'une surcharge : avec (text) et (text, uuid DEFAULT NULL) côte à
--     côte, l'appel documenté consentement_partenaire_v2_pousser(null) devient ambigu.
--   · consentement_partenaire_v2_relancer(p_confirmer, p_athlete DEFAULT NULL) : la relance J+7.
--       Cible = a reçu la push il y a 7 jours ou plus, aucune relance, toujours sans v2, sans
--       « Non », sans demande au parent, « Plus tard » < 3, et N'A PAS répondu « Plus tard »
--       DEPUIS la push (un « Plus tard » est une réponse : la carte revient seule après 3 jours).
--   · Mêmes garde-fous que la push : aperçu sans argument, confirmation au nombre exact, refus
--     en heures calmes (21 h – 8 h), préférence « Rappels » respectée.
--   · AUCUNE cloche (décision BP D2) : la carte plein écran rejoint les comptes sans jeton.
--
-- ACL : postgres et service_role SEULEMENT, comme la fonction d'avant. Le DROP emporte l'ACL et
-- les default privileges de Supabase accorderaient EXECUTE à anon et authenticated : révoqués
-- explicitement, puis vérifiés en liste COMPLÈTE triée (jamais par inclusion).
--
-- Corps d'avant relevé en local ET en prod le 2026-10-26 (md5 sans \r) : 1b1dde69…
-- Rollback : supabase/rollback/20261026150000_rollback_relance_consentement_v2.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── Gardes d'avant ───────────────────────────────────────────────────────────
do $$
declare
  vus text[];
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'consentement_partenaire_v2'
                and column_name = 'relance_le') then
    raise exception 'NEXUS: 20261026150000 déjà appliquée (relance_le présente)';
  end if;
  if to_regprocedure('public.consentement_partenaire_v2_relancer(text, uuid)') is not null then
    raise exception 'NEXUS: 20261026150000 déjà appliquée (consentement_partenaire_v2_relancer présente)';
  end if;
  if to_regprocedure('public.consentement_partenaire_v2_pousser(text)') is null then
    raise exception 'NEXUS: consentement_partenaire_v2_pousser(text) absente';
  end if;
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc
       where oid = 'public.consentement_partenaire_v2_pousser(text)'::regprocedure)
     is distinct from '1b1dde6903bfc8d1b63d7ed6c31fec2f' then
    raise exception 'NEXUS: consentement_partenaire_v2_pousser a changé — recopier la version en place avant d''appliquer';
  end if;
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.consentement_partenaire_v2_pousser(text)'::regprocedure;
  if vus is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL d''avant consentement_partenaire_v2_pousser = %, attendu {postgres,service_role}', vus;
  end if;
  if to_regprocedure('public.push_to_user(uuid, text, text, jsonb, text)') is null
     or to_regprocedure('public.push_heure_calme(timestamptz)') is null
     or to_regprocedure('public.consentement_partenaire_v2_valide(uuid)') is null then
    raise exception 'NEXUS: push_to_user, push_heure_calme ou consentement_partenaire_v2_valide manque';
  end if;
end $$;

-- ── La relance unique de J+7 ─────────────────────────────────────────────────
alter table public.consentement_partenaire_v2 add column relance_le timestamptz;
comment on column public.consentement_partenaire_v2.relance_le is
  'La relance unique de la campagne v2, à J+7 de push_le (BP 2026-10-26). Jamais plus d''une.';

-- ── La push (texte BP D1, cible restreignable à un athlète) ──────────────────
-- À lancer à la main (docs/relance-consentement-v2/1-envoi.sql) :
--   select public.consentement_partenaire_v2_pousser(null);                 → aperçu (nombre), n'envoie rien
--   select public.consentement_partenaire_v2_pousser('ENVOYER 157');        → envoie, si 157 = le nombre exact
--   select public.consentement_partenaire_v2_pousser(null, '<athlete_id>'); → aperçu pour UN athlète
drop function public.consentement_partenaire_v2_pousser(text);

create function public.consentement_partenaire_v2_pousser(p_confirmer text, p_athlete uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_n   int;
  v_r   record;
  v_env int := 0;
begin
  -- Exécutable par postgres et service_role seulement (ACL vérifiée en fin de fichier).
  drop table if exists _cibles_v2;
  create temp table _cibles_v2 on commit drop as
    select a.id as athlete_id, a.user_id
      from public.athletes a
      join public.users u on u.id = a.user_id
      left join public.consentement_partenaire_v2 c on c.athlete_id = a.id
     where coalesce(u.onboarding_complete, false)
       and a.status in ('ACTIF', 'EN_ATTENTE')
       and (p_athlete is null or a.id = p_athlete)
       and not public.consentement_partenaire_v2_valide(a.id)
       and c.refuse_le is null
       and c.demande_parent_le is null
       and coalesce(c.plus_tard_nb, 0) < 3
       and c.push_le is null
       and not exists (select 1 from public.push_preferences pp
                        where pp.user_id = a.user_id and pp.categorie = 'RAPPELS' and not pp.actif);
  select count(*) into v_n from _cibles_v2;

  if p_confirmer is null then
    return jsonb_build_object('ok', true, 'mode', 'apercu', 'cibles', v_n,
                              'heures_calmes', public.push_heure_calme(now()));
  end if;
  if v_n = 0 then
    raise exception 'NEXUS: aucune cible — rien n''est envoyé (push déjà partie ?)';
  end if;
  if p_confirmer is distinct from 'ENVOYER ' || v_n then
    raise exception 'NEXUS: confirmation attendue « ENVOYER % »', v_n;
  end if;
  if public.push_heure_calme(now()) then
    raise exception 'NEXUS: heures calmes (21 h – 8 h) — rien n''est envoyé';
  end if;

  for v_r in select * from _cibles_v2 loop
    perform public.push_to_user(
      v_r.user_id,
      'L''Esprit Sportif et les partenaires de Nexus t''invitent',
      'Choisis si les partenaires peuvent voir tes vidéos et tes réseaux.',
      jsonb_build_object('type', 'announcement', 'nx_type', 'CONSENTEMENT_PARTENAIRES_V2',
                         'route', '/athlete/consentement-partenaires'),
      'consentement-partenaires-v2');
    insert into public.consentement_partenaire_v2 (athlete_id, push_le, maj_le)
    values (v_r.athlete_id, now(), now())
    on conflict (athlete_id) do update set push_le = now(), maj_le = now();
    v_env := v_env + 1;
  end loop;
  return jsonb_build_object('ok', true, 'mode', 'envoi', 'envoyes', v_env);
end $$;

-- ── La relance J+7, une seule ────────────────────────────────────────────────
--   select public.consentement_partenaire_v2_relancer(null);           → aperçu
--   select public.consentement_partenaire_v2_relancer('ENVOYER 120');  → envoie, si 120 = le nombre exact
create function public.consentement_partenaire_v2_relancer(p_confirmer text, p_athlete uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_n   int;
  v_r   record;
  v_env int := 0;
begin
  -- Exécutable par postgres et service_role seulement (ACL vérifiée en fin de fichier).
  drop table if exists _relances_v2;
  create temp table _relances_v2 on commit drop as
    select a.id as athlete_id, a.user_id
      from public.athletes a
      join public.users u on u.id = a.user_id
      join public.consentement_partenaire_v2 c on c.athlete_id = a.id
     where coalesce(u.onboarding_complete, false)
       and a.status in ('ACTIF', 'EN_ATTENTE')
       and (p_athlete is null or a.id = p_athlete)
       and not public.consentement_partenaire_v2_valide(a.id)
       and c.refuse_le is null
       and c.demande_parent_le is null
       and coalesce(c.plus_tard_nb, 0) < 3
       and c.push_le is not null
       and c.push_le <= now() - interval '7 days'
       and c.relance_le is null
       -- « Plus tard » depuis la push = a répondu : pas de relance.
       and (c.plus_tard_le is null or c.plus_tard_le < c.push_le)
       and not exists (select 1 from public.push_preferences pp
                        where pp.user_id = a.user_id and pp.categorie = 'RAPPELS' and not pp.actif);
  select count(*) into v_n from _relances_v2;

  if p_confirmer is null then
    return jsonb_build_object('ok', true, 'mode', 'apercu', 'cibles', v_n,
                              'heures_calmes', public.push_heure_calme(now()));
  end if;
  if v_n = 0 then
    raise exception 'NEXUS: aucune cible — rien n''est envoyé (relance déjà partie, ou J+7 pas atteint ?)';
  end if;
  if p_confirmer is distinct from 'ENVOYER ' || v_n then
    raise exception 'NEXUS: confirmation attendue « ENVOYER % »', v_n;
  end if;
  if public.push_heure_calme(now()) then
    raise exception 'NEXUS: heures calmes (21 h – 8 h) — rien n''est envoyé';
  end if;

  for v_r in select * from _relances_v2 loop
    perform public.push_to_user(
      v_r.user_id,
      'L''Esprit Sportif et les partenaires de Nexus t''invitent',
      'Dernier rappel : tes vidéos et tes réseaux, c''est toi qui décides.',
      jsonb_build_object('type', 'announcement', 'nx_type', 'CONSENTEMENT_PARTENAIRES_V2',
                         'route', '/athlete/consentement-partenaires'),
      'consentement-partenaires-v2');
    update public.consentement_partenaire_v2
       set relance_le = now(), maj_le = now()
     where athlete_id = v_r.athlete_id;
    v_env := v_env + 1;
  end loop;
  return jsonb_build_object('ok', true, 'mode', 'envoi', 'envoyes', v_env);
end $$;

revoke all on function public.consentement_partenaire_v2_pousser(text, uuid)  from public, anon, authenticated;
revoke all on function public.consentement_partenaire_v2_relancer(text, uuid) from public, anon, authenticated;
grant execute on function public.consentement_partenaire_v2_pousser(text, uuid)  to service_role;
grant execute on function public.consentement_partenaire_v2_relancer(text, uuid) to service_role;

comment on function public.consentement_partenaire_v2_pousser(text, uuid) is
  'Push unique de la campagne v2 (push_le). Aperçu sans argument, envoi sur « ENVOYER <n> » exact. p_athlete : un seul athlète. Interne (BP 2026-10-26).';
comment on function public.consentement_partenaire_v2_relancer(text, uuid) is
  'Relance unique à J+7 de la push v2 (relance_le), non-répondants seulement. Aperçu sans argument, envoi sur « ENVOYER <n> » exact. Interne (BP 2026-10-26).';

-- ── Gardes d'après : ACL complète (jamais par inclusion), définitions intactes ──
do $$
declare
  f   record;
  vus text[];
begin
  if to_regprocedure('public.consentement_partenaire_v2_pousser(text)') is not null then
    raise exception 'NEXUS: l''ancienne signature consentement_partenaire_v2_pousser(text) existe encore';
  end if;
  for f in
    select * from (values
      ('public.consentement_partenaire_v2_pousser(text, uuid)'),
      ('public.consentement_partenaire_v2_relancer(text, uuid)')
    ) as t(sig)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f.sig::regprocedure;
    if vus is distinct from array['postgres', 'service_role'] then
      raise exception 'NEXUS: ACL % = %, attendu {postgres,service_role}', f.sig, vus;
    end if;
    if not (select prosecdef from pg_proc where oid = f.sig::regprocedure)
       or (select proconfig from pg_proc where oid = f.sig::regprocedure)
          is distinct from array['search_path=public', 'row_security=off'] then
      raise exception 'NEXUS: % n''est pas SECURITY DEFINER ou a perdu son search_path', f.sig;
    end if;
  end loop;

  select array_agg(t.g order by t.g) into vus
    from pg_class c,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.consentement_partenaire_v2'::regclass;
  if vus is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL consentement_partenaire_v2 = %', vus;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'consentement_partenaire_v2'
                    and column_name = 'relance_le') then
    raise exception 'NEXUS: relance_le manque';
  end if;
end $$;
$nexus_mig$;
  v_max   text;
  v_avant jsonb;
  vus     text[];
  f       text;
begin
  if extract(isodow from now() at time zone 'America/Toronto') = 2
     or (extract(isodow from now() at time zone 'America/Toronto') = 3
         and extract(hour from now() at time zone 'America/Toronto') < 5) then
    raise exception 'NEXUS: pas de prod le mardi, ni le mercredi avant 5 h';
  end if;
  if md5(contenu) <> 'fd1db3e37af294ab6c9b7e5f819b73c0' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', md5(contenu);
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261026150000') then
    raise exception 'NEXUS: version 20261026150000 déjà inscrite';
  end if;
  select max(version) into v_max from supabase_migrations.schema_migrations;
  if v_max >= '20261026150000' then
    raise exception 'NEXUS: 20261026150000 pas après la dernière version (%)', v_max;
  end if;

  -- Relevé d'avant (agrégats).
  select jsonb_build_object(
           'total', count(*),
           'accepte_v2', count(*) filter (where x.v2),
           'refuse_v2', count(*) filter (where not x.v2 and x.refuse_le is not null),
           'en_attente', count(*) filter (where not x.v2 and x.refuse_le is null and x.a_ligne),
           'jamais_demande', count(*) filter (where not x.v2 and x.refuse_le is null and not x.a_ligne),
           'push_envoyes', count(*) filter (where x.push_le is not null))
    into v_avant
    from (select public.consentement_partenaire_v2_valide(a.id) as v2, c.refuse_le, c.push_le,
                 c.athlete_id is not null as a_ligne
            from public.athletes a
            join public.users u on u.id = a.user_id
            left join public.consentement_partenaire_v2 c on c.athlete_id = a.id
           where coalesce(u.onboarding_complete, false) and a.status in ('ACTIF', 'EN_ATTENTE')) x;

  -- La migration (ses propres gardes : md5 1b1dde69… du corps d'avant, ACL avant/après).
  execute contenu;

  -- Gardes d'après, en plus de celles de la migration.
  foreach f in array array['public.consentement_partenaire_v2_pousser(text, uuid)',
                           'public.consentement_partenaire_v2_relancer(text, uuid)'] loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f::regprocedure;
    if vus is distinct from array['postgres', 'service_role'] then
      raise exception 'NEXUS: ACL % = %', f, vus;
    end if;
    if has_function_privilege('anon', f, 'EXECUTE') or has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception 'NEXUS: anon ou authenticated peut exécuter %', f;
    end if;
  end loop;

  insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
  values ('20261026150000', 'relance_consentement_v2', array[contenu], 'bptds22@gmail.com');

  insert into public.admin_operations (operation, motif, details, par)
  values ('MIGRATION_RELANCE_CONSENTEMENT_V2',
          'Relance consentement partenaires v2 : relance_le, pousser(p_athlete) aux textes BP, relancer J+7 (GO BP 2026-10-26)',
          jsonb_build_object(
            'version', '20261026150000',
            'fichier', 'supabase/migrations/20261026150000_relance_consentement_v2.sql',
            'rollback', 'supabase/rollback/20261026150000_rollback_relance_consentement_v2.sql',
            'md5_fichier', 'fd1db3e37af294ab6c9b7e5f819b73c0',
            'md5_rollback', '88804003322c5ea525b37d361bc0e01b',
            'voie', 'connecteur Supabase, un seul bloc DO',
            'banc_local', '2026-10-26 : 0 échec',
            'stats_avant', v_avant),
          (select id from public.users where email = 'bptds22@gmail.com'));

  if (select count(*) from supabase_migrations.schema_migrations where version = '20261026150000') <> 1
     or (select count(*) from public.admin_operations where operation = 'MIGRATION_RELANCE_CONSENTEMENT_V2') <> 1 then
    raise exception 'NEXUS: inscription schema_migrations ou admin_operations absente ou en double';
  end if;
end $nexus_apply$;
