-- Rollback de 20261016020000_push_a5_ouverture.sql — une transaction.
-- Rend les fonctions d'A4a octet pour octet. Les notifications déjà créées (y compris
-- PARTENAIRE_BADGE / PARTENAIRE_EVALUATION_RECUE) restent : la contrainte d'origine revient
-- NOT VALID, elle refuse les nouveaux types sans toucher aux lignes existantes.
begin;

create or replace function public.push_traiter_file(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  g          record;
  v_ids      bigint[];
  v_n        integer;
  v_titre    text;
  v_texte    text;
  v_envoi    bigint;
  v_collapse text;
  v_envoyes  integer := 0;
  v_elements integer := 0;
  v_annules  integer := 0;
  v_pref     integer := 0;
  v_jeton    integer := 0;
  v_k        integer;
begin
  if public.push_heure_calme(p_maintenant) then
    return jsonb_build_object('heures_calmes', true,
                              'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
  end if;

  -- Carte partenaire qui n'attend plus de réponse (caduque, confirmée, infirmée) : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
   where f.statut = 'EN_ATTENTE' and f.genre = 'CARTE_PARTENAIRE'
     and not exists (
       select 1
         from public.athlete_notifications n
         join public.partenaire_prospects_rapprochements r
           on r.carte_id::text = n.metadata->>'carte_id' and r.athlete_id = n.athlete_id
        where n.id::text = f.detail->>'notification_id'
          and not coalesce((n.metadata->>'caduque')::boolean, false)
          and r.statut = 'PROPOSE');
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  -- Compte qui n'est plus actif : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
    from public.users u
   where f.statut = 'EN_ATTENTE' and u.id = f.user_id and u.status <> 'ACTIF'::public.account_status;
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  for g in
    select f.user_id, f.cle, max(f.categorie) as categorie, max(f.genre) as genre,
           max(f.source_nom) as source_nom
      from public.push_file f
     where f.statut = 'EN_ATTENTE'
     group by f.user_id, f.cle
    having min(f.cree_le) <= p_maintenant - interval '10 minutes'
     order by min(f.cree_le)
  loop
    select array_agg(s.id order by s.id) into v_ids
      from (select id from public.push_file
             where statut = 'EN_ATTENTE' and user_id = g.user_id and cle = g.cle
             for update skip locked) s;
    if v_ids is null then
      continue;
    end if;
    v_n := array_length(v_ids, 1);

    if exists (select 1 from public.push_preferences p
                where p.user_id = g.user_id and p.categorie = g.categorie and not p.actif) then
      update public.push_file set statut = 'PREFERENCE', traite_le = p_maintenant where id = any (v_ids);
      v_pref := v_pref + v_n;
      continue;
    end if;

    if not exists (select 1 from public.device_tokens d where d.user_id = g.user_id) then
      update public.push_file set statut = 'SANS_JETON', traite_le = p_maintenant where id = any (v_ids);
      v_jeton := v_jeton + v_n;
      continue;
    end if;

    select t.titre, t.texte into v_titre, v_texte
      from public.push_textes(g.genre, g.source_nom, v_n,
                              (select f.detail->>'libelle' from public.push_file f where f.id = v_ids[1])) t;

    insert into public.push_envois (user_id, categorie, cle, titre, texte, collapse_id, nb_elements, envoye_le)
    values (g.user_id, g.categorie, g.cle, v_titre, v_texte, 'nx-en-attente', v_n, p_maintenant)
    returning id into v_envoi;
    -- Une carte proposée de nouveau remplace son push précédent ; le reste ne remplace rien.
    v_collapse := case when g.genre = 'CARTE_PARTENAIRE' then 'nx-' || g.cle else 'nx-envoi-' || v_envoi end;
    update public.push_envois set collapse_id = v_collapse where id = v_envoi;

    perform public.push_to_user(g.user_id, v_titre, v_texte,
              jsonb_build_object('type', 'announcement', 'categorie', g.categorie, 'envoi_id', v_envoi),
              v_collapse);

    update public.push_file set statut = 'ENVOYE', traite_le = p_maintenant, envoi_id = v_envoi
     where id = any (v_ids);
    v_envoyes := v_envoyes + 1;
    v_elements := v_elements + v_n;
  end loop;

  -- Purge : la file traitée est gardée 90 jours, le journal 180.
  delete from public.push_file where statut <> 'EN_ATTENTE' and traite_le < p_maintenant - interval '90 days';
  delete from public.push_envois where envoye_le < p_maintenant - interval '180 days';

  return jsonb_build_object('heures_calmes', false, 'pushs', v_envoyes, 'elements', v_elements,
                            'annules', v_annules, 'preference', v_pref, 'sans_jeton', v_jeton,
                            'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
end;
$$;

create or replace function public.push_mettre_en_file(p_athlete uuid, p_categorie text, p_genre text, p_cle text,
                                           p_source_nom text, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  insert into public.push_file (user_id, categorie, genre, cle, source_nom, detail)
  select a.user_id, p_categorie, p_genre, p_cle, nullif(btrim(coalesce(p_source_nom, '')), ''),
         coalesce(p_detail, '{}'::jsonb)
    from public.athletes a
   where a.id = p_athlete and a.user_id is not null;
exception when others then
  raise warning 'push_mettre_en_file: % pour athlète % — %', p_genre, p_athlete, SQLERRM;
end;
$$;

create or replace function public.push_sur_evaluation_coach()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  -- La cote globale est calculée par calc_cote_globale (BEFORE) : un push quand elle apparaît ou
  -- change, jamais pour une écriture qui ne la touche pas (miroir des distinctions, commentaires).
  if NEW.cote_globale is not null
     and (tg_op = 'INSERT' or NEW.cote_globale is distinct from OLD.cote_globale) then
    perform public.push_mettre_en_file(NEW.athlete_id, 'BADGES_EVALUATIONS', 'EVALUATION_COACH',
              'eval:coach:' || coalesce(NEW.coach_id::text, '-'),
              public.coach_nommable(NEW.coach_id)->>'nom', '{}'::jsonb);
  end if;
  return null;
exception when others then
  raise warning 'push_sur_evaluation_coach: %', SQLERRM;
  return null;
end;
$$;

drop function public.push_destination(text);

alter table public.athlete_notifications drop constraint athlete_notifications_type_check;
alter table public.athlete_notifications add constraint athlete_notifications_type_check
  check (type = any (array['PROFILE_VIEWED', 'ADDED_TO_FAVORITES', 'SUGGESTION_APPROVED', 'SUGGESTION_REJECTED', 'COACH_REPORT_UPDATED', 'COACH_VERIFIED', 'COACH_MODIFIED_PROFILE', 'COACH_DISTINCTION_ADDED', 'COACH_EVALUATION_UPDATED', 'PROFILE_MILESTONE', 'PROFILE_TIP', 'ADMIN_BROADCAST', 'TEAM_INVITATION', 'SCHOOL_CLAIM_REJECTED', 'COACH_CLAIMED', 'AMBASSADEUR_PALIER_3', 'AMBASSADEUR_PALIER_5', 'PARTENAIRE_EVALUATION'])) not valid;

delete from supabase_migrations.schema_migrations where version = '20261016020000';

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.push_mettre_en_file(uuid,text,text,text,text,jsonb)'::regprocedure)
       is distinct from '59788585bc8844cbc0f714ba8d01034e'
     or (select md5(prosrc) from pg_proc where oid = 'public.push_traiter_file(timestamptz)'::regprocedure)
       is distinct from 'd3449a69b0e21a4eb6dbdb1630835275'
     or (select md5(prosrc) from pg_proc where oid = 'public.push_sur_evaluation_coach()'::regprocedure)
       is distinct from '33085a230937a93adea444b1de560a60' then
    raise exception 'NEXUS: rollback A5 — les fonctions ne sont pas revenues à A4a';
  end if;
end $$;

commit;
