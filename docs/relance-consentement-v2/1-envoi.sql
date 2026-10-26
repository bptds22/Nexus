-- ════════════════════════════════════════════════════════════════════════════
-- Relance consentement partenaires v2 — PUSH 1 (décisions BP 2026-10-26)
-- Prérequis : 20261026150000_relance_consentement_v2 appliquée.
--
-- UNE transaction gardée : aperçu → arrêt si le nombre n'est pas exactement :attendu →
-- envoi « ENVOYER :attendu » → vérifications → une ligne admin_operations.
-- Une garde qui échoue annule TOUT, pushes comprises : pg_net n'envoie qu'au commit.
--
--   Campagne : psql -v attendu=<nombre lu dans l'aperçu juste avant> -f 1-envoi.sql
--   Un seul athlète (test) : psql -v attendu=1 -v athlete=<athlete_id> -f 1-envoi.sql
--
-- Idempotent : push_le est posée par athlète, un second passage trouve 0 cible et s'arrête.
-- Les refusés (refuse_le) sont exclus par la requête de la fonction ET revérifiés ici.
-- Annulation : 3-rollback-envoi.sql avec l'id admin_operations affiché à la fin.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\if :{?attendu}
\else
  \echo 'NEXUS: passer -v attendu=<nombre exact>'
  \quit
\endif
\if :{?athlete}
\else
  \set athlete ''
\endif

begin;
select set_config('nexus.attendu', :'attendu', true),
       set_config('nexus.athlete', :'athlete', true);

do $$
declare
  v_attendu int  := current_setting('nexus.attendu')::int;
  v_ath     uuid := nullif(current_setting('nexus.athlete'), '')::uuid;
  v         jsonb;
  v_avant   uuid[];
  v_nouv    uuid[];
  v_n       int;
  v_op      uuid;
begin
  -- Relevé d'avant : les lignes existantes (l'annulation ne supprimera que celles créées ici).
  select coalesce(array_agg(athlete_id), '{}') into v_avant from public.consentement_partenaire_v2;

  v := public.consentement_partenaire_v2_pousser(null, v_ath);
  raise notice 'NEXUS: aperçu = %', v;
  if (v->>'cibles')::int is distinct from v_attendu then
    raise exception 'NEXUS: % cibles, attendu % — rien n''est envoyé', v->>'cibles', v_attendu;
  end if;
  if (v->>'heures_calmes')::boolean then
    raise exception 'NEXUS: heures calmes (21 h – 8 h) — rien n''est envoyé';
  end if;

  v := public.consentement_partenaire_v2_pousser('ENVOYER ' || v_attendu, v_ath);
  if (v->>'envoyes')::int is distinct from v_attendu then
    raise exception 'NEXUS: % envoyés, attendu %', v->>'envoyes', v_attendu;
  end if;

  -- Vérifications d'après.
  select count(*) into v_n from public.consentement_partenaire_v2 where push_le = now();
  if v_n <> v_attendu then
    raise exception 'NEXUS: % lignes portent push_le de cette transaction, attendu %', v_n, v_attendu;
  end if;
  if exists (select 1 from public.consentement_partenaire_v2 where push_le = now() and refuse_le is not null) then
    raise exception 'NEXUS: un athlète qui a refusé a été visé';
  end if;
  if exists (select 1 from public.consentement_partenaire_v2
              where push_le = now() and public.consentement_partenaire_v2_valide(athlete_id)) then
    raise exception 'NEXUS: un athlète qui a déjà accepté la v2 a été visé';
  end if;

  select coalesce(array_agg(athlete_id order by athlete_id), '{}') into v_nouv
    from public.consentement_partenaire_v2
   where push_le = now() and not (athlete_id = any (v_avant));

  insert into public.admin_operations (operation, motif, details, par)
  values ('CONSENTEMENT_V2_PUSH',
          'Relance consentement partenaires v2 — push 1 (décisions BP D1–D3, 2026-10-26)',
          jsonb_build_object('envoyes', v_attendu, 'push_le', now(), 'athlete', v_ath,
                             'lignes_creees', to_jsonb(v_nouv)),
          (select id from public.users where email = 'bptds22@gmail.com'))
  returning id into v_op;
  raise notice 'NEXUS: % pushs envoyées, admin_operations %', v_attendu, v_op;
end $$;

commit;
