-- ════════════════════════════════════════════════════════════════════════════
-- Relance consentement partenaires v2 — RELANCE J+7, la dernière (décisions BP 2026-10-26)
-- Prérequis : 20261026150000 appliquée, 1-envoi.sql passé il y a 7 jours ou plus.
--
-- Même forme que 1-envoi.sql. Le nombre attendu se lit d'abord dans l'aperçu :
--   select public.consentement_partenaire_v2_relancer(null);
--   psql -v attendu=<n> -f 2-relance-j7.sql            (un seul athlète : -v athlete=<id>)
--
-- Ne vise que les non-répondants : toujours sans v2, sans « Non », sans demande au parent,
-- sans « Plus tard » depuis la push. Idempotent par relance_le.
-- Annulation : 4-rollback-relance.sql avec l'id admin_operations affiché à la fin.
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
  v_n       int;
  v_op      uuid;
begin
  v := public.consentement_partenaire_v2_relancer(null, v_ath);
  raise notice 'NEXUS: aperçu = %', v;
  if (v->>'cibles')::int is distinct from v_attendu then
    raise exception 'NEXUS: % cibles, attendu % — rien n''est envoyé', v->>'cibles', v_attendu;
  end if;
  if (v->>'heures_calmes')::boolean then
    raise exception 'NEXUS: heures calmes (21 h – 8 h) — rien n''est envoyé';
  end if;

  v := public.consentement_partenaire_v2_relancer('ENVOYER ' || v_attendu, v_ath);
  if (v->>'envoyes')::int is distinct from v_attendu then
    raise exception 'NEXUS: % envoyés, attendu %', v->>'envoyes', v_attendu;
  end if;

  select count(*) into v_n from public.consentement_partenaire_v2 where relance_le = now();
  if v_n <> v_attendu then
    raise exception 'NEXUS: % lignes portent relance_le de cette transaction, attendu %', v_n, v_attendu;
  end if;
  if exists (select 1 from public.consentement_partenaire_v2
              where relance_le = now()
                and (refuse_le is not null or demande_parent_le is not null
                     or push_le is null or push_le > now() - interval '7 days'
                     or plus_tard_le >= push_le
                     or public.consentement_partenaire_v2_valide(athlete_id))) then
    raise exception 'NEXUS: un athlète hors cible (a répondu, refusé, accepté ou pas encore à J+7) a été relancé';
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CONSENTEMENT_V2_RELANCE',
          'Relance consentement partenaires v2 — relance J+7, la dernière (décisions BP, 2026-10-26)',
          jsonb_build_object('envoyes', v_attendu, 'relance_le', now(), 'athlete', v_ath),
          (select id from public.users where email = 'bptds22@gmail.com'))
  returning id into v_op;
  raise notice 'NEXUS: % relances envoyées, admin_operations %', v_attendu, v_op;
end $$;

commit;
