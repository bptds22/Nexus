-- ============================================================================
-- Rattrapage UNIQUE de l'avis au parent pour les premiers contacts passés
-- (avant 20261020170000). Même règle, même texte, même journal que le trigger :
-- une ligne AVISE par (athlète, unité) — ON CONFLICT DO NOTHING, rejouable sans
-- double envoi. Courriel + notification portail (+ push si compte réclamé, par
-- parent_contact_envoyer_push : heures calmes respectées).
--
-- Gardes (exception « NEXUS: » → rien n'est écrit, rien ne part) :
--   · compte admin trouvé (courriel passé par nexus.admin_email) ;
--   · lot jamais exécuté (admin_operations AVIS_PARENT_RATTRAPAGE) ;
--   · Vault configuré (parent_contact_configure) ;
--   · exactement __ATTENDU__ cas, aucun sous période sans contact aujourd'hui.
-- Les appels pg_net ne partent qu'au COMMIT.
-- ANNULATION : un courriel envoyé ne se rappelle pas. Les lignes AVISE restent
-- (journal) ; aucune autre écriture à défaire.
--
-- Usage :  select set_config('nexus.admin_email', '<courriel admin>', false);
--          puis ce bloc, avec __ATTENDU__ remplacé par le compte du relevé.
-- ============================================================================
do $$
declare
  c_attendu constant integer := __ATTENDU__;
  v_admin   uuid;
  r         record;
  v_n       integer;
  v_avis    uuid;
  v_token   text;
  v_req     bigint;
  v_lot     jsonb := '[]'::jsonb;
begin
  select id into v_admin from public.users
   where email = current_setting('nexus.admin_email', true) and role = 'ADMIN';
  if v_admin is null then raise exception 'NEXUS: compte admin introuvable (nexus.admin_email)'; end if;
  if exists (select 1 from public.admin_operations where operation = 'AVIS_PARENT_RATTRAPAGE') then
    raise exception 'NEXUS: rattrapage déjà exécuté';
  end if;
  if not public.parent_contact_configure() then
    raise exception 'NEXUS: EDGE_FUNCTIONS_URL / PARENT_CONTACT_SECRET absents du Vault';
  end if;

  create temp table _cas on commit drop as
  with premier as (
    select distinct on (c.athlete_id, coalesce('C:' || u.school_id::text, 'R:' || c.recruiter_id::text))
           c.athlete_id,
           coalesce('C:' || u.school_id::text, 'R:' || c.recruiter_id::text) as cle,
           m.id as message_id, m.created_at
      from public.conversations c
      join public.messages m on m.conversation_id = c.id and m.sender_id = c.recruiter_id
      left join public.users u on u.id = c.recruiter_id
     where c.conversation_type = 'RECRUTEUR_ATHLETE'
     order by c.athlete_id, coalesce('C:' || u.school_id::text, 'R:' || c.recruiter_id::text), m.created_at
  )
  select p.athlete_id, p.cle, p.message_id,
         nullif(btrim(a.parent_email), '') as declare_,
         pa.parent_user_id, nullif(btrim(pu.email), '') as compte
    from premier p
    join public.athletes a on a.id = p.athlete_id
    left join public.parent_athletes pa on pa.athlete_id = p.athlete_id
    left join public.users pu on pu.id = pa.parent_user_id
   where a.date_naissance is not null
     and (p.created_at at time zone 'America/Toronto')::date < a.date_naissance + interval '18 years'
     and coalesce(nullif(btrim(a.parent_email), ''), nullif(btrim(pu.email), '')) is not null
     and not exists (select 1 from public.parent_contact_avis v
                      where v.athlete_id = p.athlete_id and v.cle_unite = p.cle and v.statut = 'AVISE');

  select count(*) into v_n from _cas;
  if v_n <> c_attendu then
    raise exception 'NEXUS: % cas (attendu %) — refaire le relevé', v_n, c_attendu;
  end if;
  if exists (select 1 from _cas where public.is_messaging_blacked_out(athlete_id)) then
    raise exception 'NEXUS: un cas est sous période sans contact aujourd''hui — décision BP requise';
  end if;

  for r in select * from _cas loop
    insert into public.parent_contact_avis (athlete_id, cle_unite, statut, message_id, courriel_source, parent_user_id)
    values (r.athlete_id, r.cle, 'AVISE', r.message_id,
            case when r.declare_ is not null then 'DECLARE' else 'COMPTE' end, r.parent_user_id)
    on conflict (athlete_id, cle_unite) where statut = 'AVISE' do nothing
    returning id into v_avis;
    if v_avis is null then continue; end if;

    v_token := null;
    if r.parent_user_id is null then
      select i.token into v_token from public.parent_invitations i
       where i.athlete_id = r.athlete_id and i.claimed_at is null and i.expires_at > now()
       order by i.created_at desc limit 1;
    end if;
    v_req := public.parent_contact_appeler(jsonb_build_object(
      'mode', 'courriel', 'to', coalesce(r.declare_, r.compte), 'lang', 'fr', 'claim_token', v_token));
    if v_req is null then raise exception 'NEXUS: appel courriel impossible'; end if;
    update public.parent_contact_avis set courriel_request_id = v_req, courriel_statut = 'EN_FILE' where id = v_avis;

    if r.parent_user_id is not null then
      perform public.parent_contact_ecrire_portail(v_avis, true);
    end if;
    v_lot := v_lot || jsonb_build_object('avis_id', v_avis, 'portail', r.parent_user_id is not null);
  end loop;

  if jsonb_array_length(v_lot) <> c_attendu then
    raise exception 'NEXUS: % avis créés (attendu %)', jsonb_array_length(v_lot), c_attendu;
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('AVIS_PARENT_RATTRAPAGE',
          'Avis au parent pour les premiers contacts recruteur antérieurs à 20261020170000 (envoi unique)',
          jsonb_build_object('n', c_attendu, 'avis', v_lot), v_admin);
end $$;
