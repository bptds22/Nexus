-- Clôture des alertes v1 NOUVELLES_EQUIPES dont 100 % des équipes sont en base (GO BP 2026-10-09).
-- Transaction gardée : l'ensemble recalculé doit être EXACTEMENT la liste attendue (16 ids,
-- relevé 2026-10-09). Sinon : exception, rien n'est écrit. Les 16 autres restent ouvertes.
-- Rollback : 3-rollback.sql.
begin;

do $$
declare
  attendus uuid[] := array[
    '8292e20f-b89f-4518-a622-91933ab7fad3', '034a439b-e5c2-4504-91a5-3c8d0ddcd348',
    '31347fe8-a332-4713-9b75-1615cd787e0b', '16352943-7e5f-4691-963e-e6b269c49b85',
    '7011a4eb-5d75-48ec-bed7-87a968c5d2c4', '9c96616a-c134-40de-a7c7-538459ea331a',
    '494c2abf-0381-4ca4-bbd0-396965baf3c4', '23203497-23ae-4c9a-bd87-29a2e62e263d',
    '05b2fa8c-ff2a-474e-ace6-1642c521d325', '2fb1847c-d94b-4799-a605-e9e415221d06',
    'fc9bc897-7dc8-4113-94e9-8bfd9ad9f88e', 'a573b0d1-c990-4689-80e6-037cccd45cf4',
    '76c7c10b-42dd-4d32-b5b1-26ebb63650db', 'ef3a7768-503b-4e4f-b98a-64c9dd3d8fc2',
    '73e13f81-6788-43a8-8eaa-7093e7ea04e5', '19181b54-2615-47c6-a7f2-b281b180b875'
  ]::uuid[];
  attendus_tries uuid[];
  complets uuid[];
  ouvertes_avant int;
  ouvertes_apres int;
  nb int;
  admin uuid;
  cles jsonb;
  v_note text := 'Clôture du 2026-10-09 (GO BP) : 100 % des équipes de l''alerte sont en base '
            || '(lots RSEQ 2026 du 2026-10-08, scripts/rseq-equipes-2026/). Rien d''autre n''a été écrit.';
begin
  select array_agg(x order by x) into attendus_tries from unnest(attendus) x;

  select id into admin from public.users where email = 'bptds22@gmail.com';
  if admin is null then raise exception 'NEXUS: compte admin introuvable'; end if;

  select count(*) into ouvertes_avant from public.rseq_sync_alerts
   where statut = 'OUVERTE' and type = 'NOUVELLES_EQUIPES';

  -- Ensemble recalculé : alertes ouvertes dont chaque équipe a son rseq_team_id en base.
  with e as (
    select a.id, x->>'rseq_team_id' as rid
      from public.rseq_sync_alerts a, jsonb_array_elements(a.payload->'equipes') x
     where a.statut = 'OUVERTE' and a.type = 'NOUVELLES_EQUIPES'),
  p as (
    select e.id, count(*) as n, count(t.id) as presentes
      from e left join public.teams t on t.rseq_team_id::text = e.rid
     group by 1)
  select array_agg(id order by id) into complets from p where n > 0 and presentes = n;

  -- Comparaison COMPLÈTE de la liste triée, jamais par inclusion.
  if complets is distinct from attendus_tries then
    raise exception 'NEXUS: ensemble à clore = %, attendu %', complets, attendus_tries;
  end if;

  select jsonb_agg(jsonb_build_object('id', id, 'cle', cle, 'statut_avant', statut,
                                      'traite_le_avant', traite_le, 'traite_par_avant', traite_par,
                                      'note_avant', note) order by cle)
    into cles from public.rseq_sync_alerts where id = any (attendus);

  update public.rseq_sync_alerts
     set statut = 'TRAITEE', traite_le = now(), traite_par = admin, note = v_note
   where id = any (attendus) and statut = 'OUVERTE' and type = 'NOUVELLES_EQUIPES';
  get diagnostics nb = row_count;
  if nb <> 16 then raise exception 'NEXUS: % alertes closes, attendu 16', nb; end if;

  select count(*) into ouvertes_apres from public.rseq_sync_alerts
   where statut = 'OUVERTE' and type = 'NOUVELLES_EQUIPES';
  if ouvertes_apres <> ouvertes_avant - 16 then
    raise exception 'NEXUS: ouvertes % → %, attendu −16', ouvertes_avant, ouvertes_apres;
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('ALERTES_RSEQ_V1_CLOSES',
          'Alertes NOUVELLES_EQUIPES v1 closes : toutes leurs équipes sont en base (GO BP 2026-10-09)',
          jsonb_build_object('nb', nb, 'ouvertes_avant', ouvertes_avant, 'ouvertes_apres', ouvertes_apres,
                             'alertes', cles, 'rollback', 'scripts/rseq-alertes-v1/3-rollback.sql'),
          admin);

  raise notice 'NEXUS: % alertes closes ; NOUVELLES_EQUIPES ouvertes % → %', nb, ouvertes_avant, ouvertes_apres;
end $$;

commit;
