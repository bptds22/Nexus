-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK de 20261026150000_relance_consentement_v2.sql
--
-- Remet consentement_partenaire_v2_pousser(text) dans son état de 20261018150000 (corps recopié
-- à l'identique : md5 sans \r = 1b1dde69…, vérifié en fin de fichier), retire
-- consentement_partenaire_v2_relancer et la colonne relance_le.
--
-- Refuse si une relance est déjà partie (relance_le non vide) : la retirer d'abord avec
-- docs/relance-consentement-v2/4-rollback-relance.sql, sinon on effacerait la trace d'un envoi.
-- push_le est conservée : l'ancienne fonction la lit et l'écrit de la même façon.
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.consentement_partenaire_v2_pousser(text, uuid)') is null
     or to_regprocedure('public.consentement_partenaire_v2_relancer(text, uuid)') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'consentement_partenaire_v2'
                       and column_name = 'relance_le') then
    raise exception 'NEXUS: 20261026150000 n''est pas en place — rien à défaire';
  end if;
  if exists (select 1 from public.consentement_partenaire_v2 where relance_le is not null) then
    raise exception 'NEXUS: une relance est déjà partie (relance_le non vide) — la défaire d''abord (4-rollback-relance.sql)';
  end if;
end $$;

drop function public.consentement_partenaire_v2_relancer(text, uuid);
drop function public.consentement_partenaire_v2_pousser(text, uuid);
alter table public.consentement_partenaire_v2 drop column relance_le;

-- ── Corps de 20261018150000, à l'identique ───────────────────────────────────
create function public.consentement_partenaire_v2_pousser(p_confirmer text)
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
  if p_confirmer is distinct from 'ENVOYER ' || v_n then
    raise exception 'NEXUS: confirmation attendue « ENVOYER % »', v_n;
  end if;
  if public.push_heure_calme(now()) then
    raise exception 'NEXUS: heures calmes (21 h – 8 h) — rien n''est envoyé';
  end if;

  for v_r in select * from _cibles_v2 loop
    perform public.push_to_user(
      v_r.user_id,
      'Nouveau : tes vidéos et tes réseaux',
      'Choisis si les partenaires de Nexus peuvent voir tes vidéos et tes réseaux sociaux.',
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

revoke all on function public.consentement_partenaire_v2_pousser(text) from public, anon, authenticated;
grant execute on function public.consentement_partenaire_v2_pousser(text) to service_role;

-- ── Gardes d'après ───────────────────────────────────────────────────────────
do $$
declare
  vus text[];
begin
  if (select md5(replace(prosrc, E'\r', '')) from pg_proc
       where oid = 'public.consentement_partenaire_v2_pousser(text)'::regprocedure)
     is distinct from '1b1dde6903bfc8d1b63d7ed6c31fec2f' then
    raise exception 'NEXUS: le corps restauré de consentement_partenaire_v2_pousser diffère de l''original';
  end if;
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.consentement_partenaire_v2_pousser(text)'::regprocedure;
  if vus is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL consentement_partenaire_v2_pousser = %, attendu {postgres,service_role}', vus;
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.consentement_partenaire_v2_pousser(text)'::regprocedure)
     or (select proconfig from pg_proc where oid = 'public.consentement_partenaire_v2_pousser(text)'::regprocedure)
        is distinct from array['search_path=public', 'row_security=off'] then
    raise exception 'NEXUS: consentement_partenaire_v2_pousser n''est plus SECURITY DEFINER ou a perdu son search_path';
  end if;
  if to_regprocedure('public.consentement_partenaire_v2_relancer(text, uuid)') is not null
     or to_regprocedure('public.consentement_partenaire_v2_pousser(text, uuid)') is not null
     or exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'consentement_partenaire_v2'
                   and column_name = 'relance_le') then
    raise exception 'NEXUS: un objet de 20261026150000 subsiste';
  end if;
end $$;
