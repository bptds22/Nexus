-- Cote partenaire sur la carte, filtres « Mes athlètes », Loi 25 (retrait d'opt-in respecté partout)
-- et demande de visibilité au jeune. Décisions BP du 2026-10-16. UNE migration, un lot.
--
-- A. Cartes et « Mes athlètes »
--  · cotes_partenaires_athletes(uuid[]) : les évaluations partenaires d'un LOT d'athlètes (cartes :
--    favoris, fiche, aperçu). SECURITY INVOKER : délègue athlète par athlète à
--    evaluations_partenaires_athlete() — aucune règle propre, aucun nouvel accès.
--  · partenaire_mes_athletes() : DROP + CREATE, + poste / poste_abr (recherche), + badge_ref par
--    badge (filtre « Distinctions »). Corps W4d inchangé sinon.
--
-- B. Loi 25 — un retrait d'opt-in est respecté IMMÉDIATEMENT (décision BP)
--    Opt-in retiré (is_partner_eligible_athlete faux) = plus rien du partenaire n'est visible,
--    nulle part, pour personne d'autre que l'ADMIN. Les données restent en base : l'opt-in revient,
--    tout réapparaît. Lectures resserrées (corps d'origine + la seule condition d'admissibilité) :
--  · evaluations_partenaires_athlete (fiche, section et ligne ; et par délégation le lot A) ;
--  · badges_partenaires_athlete (badges partenaire sur la fiche) ;
--  · recruiter_search_athletes : le LATERAL partenaire → cote_partenaire, filtre « 4+ étoiles » et
--    tri lisent la même ligne, désormais vide sans opt-in actif ;
--  · partenaire_badges_nexus_admissibles : nommait le partenaire d'un badge déjà posé.
--    partenaire_mes_athletes était déjà gardée (partenaire_voit_athlete).
--
-- C. Demande de visibilité au jeune (cloche + push par la file A4a)
--    Les écritures partenaire directes (W2/W3/W3b) exigent déjà l'opt-in : le seul chemin par lequel
--    un partenaire évalue ou badge un jeune SANS opt-in actif est la carte prospect confirmée qui
--    attend (CONFIRMEE_ATTENTE_OPTIN, W4a). C'est donc là que la demande naît (trigger sur
--    partenaire_prospects, aucune fonction W4 redéfinie) :
--  · « {Partenaire} t'a évalué. » / « Accepte d'être visible des partenaires pour que ton
--    évaluation s'affiche. » — jamais la cote ni les badges ;
--  · UNE demande ouverte par (jeune, partenaire) ; une 2e carte du même partenaire s'y ajoute ;
--  · pas de doublon avec W4 : la notification de PROPOSITION de la carte (PARTENAIRE_EVALUATION,
--    « C'est toi ? ») est CONVERTIE en demande, pas doublée ; le push part par la file 10 min plus
--    tard et est ANNULÉ si le jeune a déjà accepté (dans l'écran de la carte, par exemple) ;
--  · jeune qui a RETIRÉ son opt-in : une seule demande après le retrait, tous partenaires confondus ;
--  · « Accepter » → accepter_visibilite_partenaire() : set_my_partner_visibility (chemin
--    existant) ; sous 14 ans, la demande part au parent (parent_notifications) au lieu d'activer.
--  · la demande se règle seule : ACCEPTEE à l'activation (paramètres, parent, carte), CADUQUE si
--    la carte disparaît sans activation.
--
-- Rollback : supabase/rollback/20261016170000_rollback_cote_partenaire_carte_mes_athletes.sql

do $$
begin
  if to_regprocedure('public.cotes_partenaires_athletes(uuid[])') is not null
     or to_regprocedure('public.accepter_visibilite_partenaire(uuid,text)') is not null then
    raise exception 'NEXUS: lot 20261016170000 déjà appliqué';
  end if;
  -- Chaque objet redéfini ou dont on dépend doit être EXACTEMENT celui relevé (local = prod,
  -- 2026-10-16 ; empreinte du corps sans retours chariot : la prod garde des CRLF).
  if exists (
    select 1
      from (values
        ('public.partenaire_mes_athletes()', '71a92e788d13bc85ee8d9d9baa675e30'),
        ('public.evaluations_partenaires_athlete(uuid)', '33d0544f27a8b62fa9e21902f2e62310'),
        ('public.badges_partenaires_athlete(uuid)', '6baa5e2d5c2f219a0bd1baac97f99e72'),
        ('public.partenaire_badges_nexus_admissibles(uuid)', 'd55783f816d54757ee2e18c94e7d3757'),
        ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', '957289faec17d8e027681a155ba80bc7'),
        ('public.push_textes(text,text,integer,text)', 'd8b270c9d129866b636e4d9ee1bbe8a3'),
        ('public.push_traiter_file(timestamptz)', '8e7bfc261e8041074486d5395f17b198'),
        ('public.set_my_partner_visibility(boolean,text)', '8c48d5b5e480a9690770678308aab5ba'),
        ('public.emit_parent_notification(uuid,text,text,text,jsonb)', 'fb08a829e1d2fcf0d0983eeaa50f98ec'),
        ('public.is_partner_eligible_athlete(uuid)', '1a196afeb23165c25ac7ac9dcc7855ad')
      ) as v(f, attendu)
     where (select md5(replace(p.prosrc, E'\r', '')) from pg_proc p where p.oid = to_regprocedure(v.f)) is distinct from v.attendu)
  then
    raise exception 'NEXUS: une fonction ne correspond pas au relevé — ne pas écraser une version inconnue';
  end if;
  if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'athlete_notifications_type_check')
       is distinct from 'f7c3e05c8d78780c77afe27967fedb61'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'parent_notifications_type_check')
       is distinct from '521852a6656bff4344aae982c7623209'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'push_file_genre_check')
       is distinct from '2e673d7536774b4c181d9897db778521' then
    raise exception 'NEXUS: contraintes de type des notifications / de la file ≠ relevé';
  end if;
end $$;

-- ═══ A. Cartes et « Mes athlètes » ══════════════════════════════════════════

-- A1. Cotes partenaires d'un lot d'athlètes (délégation pure à W2, donc à B1).
create function public.cotes_partenaires_athletes(p_athlete_ids uuid[])
returns table (id uuid, athlete_id uuid, organisation text, cote_globale numeric, updated_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, i.athlete_id, e.organisation, e.cote_globale, e.updated_at
    from (select distinct x as athlete_id from unnest(coalesce(p_athlete_ids, '{}'::uuid[])) as x where x is not null) i
    cross join lateral public.evaluations_partenaires_athlete(i.athlete_id) e
$$;

comment on function public.cotes_partenaires_athletes(uuid[]) is
  'Cartes : évaluations partenaires (organisation, cote, date) d''un lot d''athlètes. INVOKER : délègue à evaluations_partenaires_athlete(), aucune règle propre.';

revoke all on function public.cotes_partenaires_athletes(uuid[]) from public, anon, authenticated;
grant execute on function public.cotes_partenaires_athletes(uuid[]) to authenticated, service_role;

-- A2. « Mes athlètes » : la position et la référence des badges.
drop function public.partenaire_mes_athletes();

create function public.partenaire_mes_athletes()
returns table (
  athlete_id uuid, prenom text, nom text, sport text, ecole text,
  evaluation_id uuid, cote_globale numeric, evaluee_le timestamptz,
  badges jsonb, derniere_action timestamptz,
  poste text, poste_abr text)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with mes as (
    select mp.id from public.media_partners mp where mp.user_id = auth.uid()
  ), cibles as (
    select pe.athlete_id from public.partner_evaluations pe where pe.partner_id in (select id from mes)
    union
    select pab.athlete_id from public.partner_athlete_badges pab
     where pab.partner_id in (select id from mes) and pab.retire_le is null
  )
  select a.id, a.first_name, a.last_name, s.nom, sc.name,
         ev.id, ev.cote_globale, ev.updated_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'attribution_id', pab.id,
                    'badge_ref', coalesce(pab.badge_id, pab.partner_badge_id),
                    'libelle', coalesce(pb.libelle, b.libelle),
                    'nexus', pab.badge_id is not null,
                    'code', b.code,
                    'icone_path', pb.icone_path,
                    'masque', pab.masque_le is not null,
                    'le', pab.created_at) order by pab.created_at desc)
             from public.partner_athlete_badges pab
             left join public.partner_badges pb on pb.id = pab.partner_badge_id
             left join public.badges b on b.id = pab.badge_id
            where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null), '[]'::jsonb),
         greatest(ev.updated_at,
                  (select max(pab.created_at) from public.partner_athlete_badges pab
                    where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null)),
         po.nom, po.abreviation
    from cibles c
    join public.athletes a on a.id = c.athlete_id
    left join public.sports s on s.id = a.sport_id
    left join public.schools sc on sc.id = a.school_id
    left join public.positions po on po.id = a.position_id
    left join lateral (
      select pe.id, pe.cote_globale, pe.updated_at from public.partner_evaluations pe
       where pe.athlete_id = a.id and pe.partner_id in (select id from mes)
       order by pe.updated_at desc limit 1) ev on true
   where public.partenaire_voit_athlete(a.id)
   order by 10 desc nulls last, a.last_name, a.first_name
$$;

comment on function public.partenaire_mes_athletes() is
  'W4d + filtres (2026-10-16) : athlètes évalués ou badgés par le partenaire appelant, s''ils lui sont encore visibles. poste/poste_abr et badges[].badge_ref pour la recherche et le filtre Distinctions.';

revoke all on function public.partenaire_mes_athletes() from public, anon, authenticated;
grant execute on function public.partenaire_mes_athletes() to authenticated, service_role;

-- ═══ B. Loi 25 : rien du partenaire sans opt-in actif, sauf pour l'admin ═════
-- CREATE OR REPLACE, signatures et RETURNS inchangés : l'ACL est conservée (comparée en fin de lot).

-- B1. Évaluations partenaires (fiche ; et le lot A1 par délégation).
{{EVAL}}

-- B2. Badges partenaire sur la fiche.
{{BADGES}}

-- B3. Badges Nexus admissibles (portail partenaire) : nommait le partenaire d'un badge déjà posé.
{{ADMISSIBLES}}

-- B4. Recherche recruteur : la ligne partenaire du LATERAL exige l'opt-in actif. cote_partenaire,
--     le filtre « 4+ étoiles » et le tri lisent cette même ligne. La plus récente (règle confirmée
--     par BP), départagée par l'identifiant à date égale — comme le client (retenirCotePartenaire).
{{RSA}}

-- ═══ C. Demande de visibilité au jeune ══════════════════════════════════════

-- C1. Types de notification : jeune et parent (listes complètes, l'ancienne + un).
alter table public.athlete_notifications drop constraint athlete_notifications_type_check;
alter table public.athlete_notifications add constraint athlete_notifications_type_check
  check (type = any (array['PROFILE_VIEWED', 'ADDED_TO_FAVORITES', 'SUGGESTION_APPROVED', 'SUGGESTION_REJECTED', 'COACH_REPORT_UPDATED', 'COACH_VERIFIED', 'COACH_MODIFIED_PROFILE', 'COACH_DISTINCTION_ADDED', 'COACH_EVALUATION_UPDATED', 'PROFILE_MILESTONE', 'PROFILE_TIP', 'ADMIN_BROADCAST', 'TEAM_INVITATION', 'SCHOOL_CLAIM_REJECTED', 'COACH_CLAIMED', 'AMBASSADEUR_PALIER_3', 'AMBASSADEUR_PALIER_5', 'PARTENAIRE_EVALUATION', 'PARTENAIRE_BADGE', 'PARTENAIRE_EVALUATION_RECUE', 'PARTENAIRE_VISIBILITE_DEMANDE']::text[]));
alter table public.parent_notifications drop constraint parent_notifications_type_check;
alter table public.parent_notifications add constraint parent_notifications_type_check
  check (type = any (array['CHILD_FAVORITED', 'CHILD_PIPELINE_STAGE', 'CHILD_VISIT_PLANNED', 'CHILD_PARTNER_VISIBILITY_REQUEST']::text[]));
alter table public.push_file drop constraint push_file_genre_check;
alter table public.push_file add constraint push_file_genre_check
  check (genre = any (array['BADGE_COACH', 'BADGE_PARTENAIRE', 'EVALUATION_COACH', 'EVALUATION_PARTENAIRE', 'CARTE_PARTENAIRE', 'VISIBILITE_PARTENAIRE']::text[]));

-- C2. Le texte du push (une seule source, jamais de cote ni de badge).
{{TEXTES}}

-- C3. La file : un push de demande ne part pas si la demande n'attend plus le jeune.
{{PTF}}

-- C4. Naissance d'une demande, pour une carte qui attend l'opt-in du jeune.
create function public.partenaire_demander_visibilite(p_carte uuid)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_carte public.partenaire_prospects%rowtype;
  v_ath   public.athletes%rowtype;
  v_org   text;
  v_notif uuid;
  v_titre text;
  v_texte constant text := 'Accepte d''être visible des partenaires pour que ton évaluation s''affiche.';
begin
  select * into v_carte from public.partenaire_prospects where id = p_carte;
  if not found or v_carte.statut <> 'CONFIRMEE_ATTENTE_OPTIN' or v_carte.reservee_athlete is null then
    return null;
  end if;
  -- Rien à rendre visible : pas de demande.
  if v_carte.cote_globale is null
     and coalesce(cardinality(v_carte.badges_partenaire), 0) + coalesce(cardinality(v_carte.badges_nexus), 0) = 0 then
    return null;
  end if;
  select * into v_ath from public.athletes where id = v_carte.reservee_athlete;
  if not found or coalesce(public.is_partner_eligible_athlete(v_ath.id), false) then
    return null;
  end if;
  select organization_name into v_org from public.media_partners where id = v_carte.partner_id;
  v_titre := coalesce(nullif(btrim(v_org), ''), 'Un partenaire') || ' t''a évalué.';

  -- Une seule demande ouverte par (jeune, partenaire) : la nouvelle carte s'y ajoute.
  update public.athlete_notifications n
     set metadata = jsonb_set(n.metadata, '{cartes}',
                              (n.metadata->'cartes') || jsonb_build_array(p_carte::text))
   where n.athlete_id = v_ath.id and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
     and n.metadata->>'partner_id' = v_carte.partner_id::text
     and n.metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT')
     and not (n.metadata->'cartes') ? p_carte::text
  returning n.id into v_notif;
  if v_notif is not null
     or exists (select 1 from public.athlete_notifications n
                 where n.athlete_id = v_ath.id and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
                   and n.metadata->>'partner_id' = v_carte.partner_id::text
                   and n.metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT')) then
    return v_notif;
  end if;

  -- A RETIRÉ son opt-in (il l'a déjà eu : la date d'activation reste après un retrait) : une seule
  -- demande après le retrait, tous partenaires confondus. Une demande née après la dernière
  -- activation est forcément née après le retrait (entre les deux, le jeune était visible).
  if v_ath.partner_visibility_opted_in_at is not null
     and exists (select 1 from public.athlete_notifications n
                  where n.athlete_id = v_ath.id and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
                    and n.created_at >= v_ath.partner_visibility_opted_in_at) then
    return null;
  end if;

  -- Pas de doublon avec W4 : la proposition « C'est toi ? » de cette carte devient la demande.
  update public.athlete_notifications n
     set type = 'PARTENAIRE_VISIBILITE_DEMANDE', title = v_titre, message = v_texte, read = false,
         metadata = n.metadata || jsonb_build_object(
           'partner_id', v_carte.partner_id::text, 'cartes', jsonb_build_array(p_carte::text),
           'etat', 'EN_ATTENTE', 'depuis_proposition', true)
   where n.id = (select n2.id from public.athlete_notifications n2
                  where n2.athlete_id = v_ath.id and n2.type = 'PARTENAIRE_EVALUATION'
                    and n2.metadata->>'carte_id' = p_carte::text
                  order by n2.created_at desc limit 1)
  returning n.id into v_notif;
  if v_notif is null then
    insert into public.athlete_notifications (athlete_id, type, title, message, metadata)
    values (v_ath.id, 'PARTENAIRE_VISIBILITE_DEMANDE', v_titre, v_texte,
            jsonb_build_object('partner_id', v_carte.partner_id::text, 'cartes', jsonb_build_array(p_carte::text),
                               'etat', 'EN_ATTENTE'))
    returning id into v_notif;
  end if;

  perform public.push_mettre_en_file(v_ath.id, 'CARTES_PARTENAIRES', 'VISIBILITE_PARTENAIRE',
            'visibilite:' || v_carte.partner_id, v_org,
            jsonb_build_object('cloche', false, 'notification_id', v_notif));
  return v_notif;
end $$;

comment on function public.partenaire_demander_visibilite(uuid) is
  'Demande de visibilité au jeune pour une carte qui attend son opt-in : une par (jeune, partenaire), une seule après un retrait, convertit la proposition W4. Interne.';

-- C5. Une demande se règle : ACCEPTEE si le jeune est devenu visible, sinon CADUQUE quand plus
--     aucune de ses cartes n'attend.
create function public.partenaire_regler_demandes_visibilite(p_athlete uuid)
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_n integer;
begin
  if coalesce(public.is_partner_eligible_athlete(p_athlete), false) then
    update public.athlete_notifications
       set metadata = metadata || jsonb_build_object('etat', 'ACCEPTEE', 'reglee_le', now()), read = true
     where athlete_id = p_athlete and type = 'PARTENAIRE_VISIBILITE_DEMANDE'
       and metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT');
  else
    update public.athlete_notifications n
       set metadata = n.metadata || jsonb_build_object('etat', 'CADUQUE', 'reglee_le', now())
     where n.athlete_id = p_athlete and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
       and n.metadata->>'etat' in ('EN_ATTENTE', 'DEMANDE_PARENT')
       and not exists (select 1 from public.partenaire_prospects c
                        where c.reservee_athlete = p_athlete and c.statut = 'CONFIRMEE_ATTENTE_OPTIN'
                          and (n.metadata->'cartes') ? c.id::text);
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- C6. Triggers : ils ne bloquent JAMAIS l'écriture qui les déclenche.
create function public.trg_partenaire_demande_sur_carte()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  begin
    if tg_op = 'UPDATE' and new.statut = 'CONFIRMEE_ATTENTE_OPTIN' and old.statut is distinct from new.statut then
      perform public.partenaire_demander_visibilite(new.id);
    elsif old.statut = 'CONFIRMEE_ATTENTE_OPTIN' and old.reservee_athlete is not null
          and (tg_op = 'DELETE' or new.statut is distinct from old.statut) then
      perform public.partenaire_regler_demandes_visibilite(old.reservee_athlete);
    end if;
  exception when others then
    raise warning 'trg_partenaire_demande_sur_carte: carte % — %', coalesce(new.id, old.id), sqlerrm;
  end;
  return null;
end $$;

create trigger trg_partenaire_demande_sur_carte
after update of statut or delete on public.partenaire_prospects
for each row execute function public.trg_partenaire_demande_sur_carte();

create function public.trg_partenaire_demande_sur_optin()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  begin
    perform public.partenaire_regler_demandes_visibilite(new.id);
  exception when others then
    raise warning 'trg_partenaire_demande_sur_optin: athlète % — %', new.id, sqlerrm;
  end;
  return null;
end $$;

create trigger trg_partenaire_demande_sur_optin
after update of partner_visibility_opt_in, partner_visibility_parental_consent on public.athletes
for each row
when (old.partner_visibility_opt_in is distinct from new.partner_visibility_opt_in
      or old.partner_visibility_parental_consent is distinct from new.partner_visibility_parental_consent)
execute function public.trg_partenaire_demande_sur_optin();

-- C7. « Accepter » : le chemin existant (set_my_partner_visibility) ; sous 14 ans, la demande part
--     au parent lié (portail parent) au lieu d'activer. Jamais la cote ni les badges au parent.
create function public.accepter_visibilite_partenaire(p_notification uuid, p_policy_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_notif public.athlete_notifications%rowtype;
  v_ath   public.athletes%rowtype;
  v_res   jsonb;
  v_org   text;
begin
  select n.* into v_notif
    from public.athlete_notifications n join public.athletes a on a.id = n.athlete_id
   where n.id = p_notification and n.type = 'PARTENAIRE_VISIBILITE_DEMANDE'
     and a.user_id = auth.uid() and auth.uid() is not null
   for update of n;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'introuvable');
  end if;
  if v_notif.metadata->>'etat' is distinct from 'EN_ATTENTE' then
    return jsonb_build_object('ok', false, 'reason', 'deja_traitee', 'etat', v_notif.metadata->>'etat');
  end if;
  select * into v_ath from public.athletes where id = v_notif.athlete_id;

  v_res := public.set_my_partner_visibility(true, p_policy_version);
  if coalesce((v_res->>'ok')::boolean, false) then
    perform public.partenaire_regler_demandes_visibilite(v_ath.id);
    return jsonb_build_object('ok', true, 'etat', 'ACCEPTEE');
  end if;
  if v_res->>'reason' is distinct from 'parent_required' then
    return v_res;
  end if;

  if not exists (select 1 from public.parent_athletes pa where pa.athlete_id = v_ath.id) then
    return jsonb_build_object('ok', false, 'reason', 'parent_absent');
  end if;
  select organization_name into v_org from public.media_partners where id::text = v_notif.metadata->>'partner_id';
  if not exists (select 1 from public.parent_notifications pn
                  where pn.athlete_id = v_ath.id and pn.type = 'CHILD_PARTNER_VISIBILITY_REQUEST' and not pn.read) then
    perform public.emit_parent_notification(
      v_ath.id, 'CHILD_PARTNER_VISIBILITY_REQUEST', 'Demande de visibilité partenaires',
      coalesce(nullif(btrim(v_ath.first_name), ''), 'Votre enfant') || ' aimerait être visible des partenaires de Nexus ('
        || coalesce(nullif(btrim(v_org), ''), 'un partenaire') || ' l''a évalué). Votre accord est requis : rendez-vous dans Consentements.',
      jsonb_build_object('athlete_id', v_ath.id, 'route', '/parent/consentements'));
  end if;
  update public.athlete_notifications
     set metadata = metadata || jsonb_build_object('etat', 'DEMANDE_PARENT', 'reglee_le', now()), read = true
   where id = v_notif.id;
  return jsonb_build_object('ok', true, 'etat', 'DEMANDE_PARENT');
end $$;

comment on function public.accepter_visibilite_partenaire(uuid, text) is
  'Bouton « Accepter » d''une demande de visibilité : set_my_partner_visibility(true) ; sous 14 ans, demande au parent lié (parent_notifications).';

-- C8. Droits.
revoke all on function public.partenaire_demander_visibilite(uuid) from public, anon, authenticated;
revoke all on function public.partenaire_regler_demandes_visibilite(uuid) from public, anon, authenticated;
revoke all on function public.trg_partenaire_demande_sur_carte() from public, anon, authenticated;
revoke all on function public.trg_partenaire_demande_sur_optin() from public, anon, authenticated;
revoke all on function public.accepter_visibilite_partenaire(uuid, text) from public, anon, authenticated;
grant execute on function public.partenaire_demander_visibilite(uuid) to service_role;
grant execute on function public.partenaire_regler_demandes_visibilite(uuid) to service_role;
grant execute on function public.accepter_visibilite_partenaire(uuid, text) to authenticated, service_role;

-- C9. Les cartes qui attendent déjà (prod au 2026-10-16 : aucune).
select public.partenaire_demander_visibilite(c.id)
  from public.partenaire_prospects c where c.statut = 'CONFIRMEE_ATTENTE_OPTIN';

-- ═══ Gardes finales : ACL comparées EN ENTIER, signatures uniques ════════════
do $$
declare
  r    record;
  vus  text[];
begin
  for r in select * from (values
      ('public.cotes_partenaires_athletes(uuid[])', array['authenticated', 'postgres', 'service_role']),
      ('public.partenaire_mes_athletes()', array['authenticated', 'postgres', 'service_role']),
      ('public.evaluations_partenaires_athlete(uuid)', array['authenticated', 'postgres', 'service_role']),
      ('public.badges_partenaires_athlete(uuid)', array['authenticated', 'postgres', 'service_role']),
      ('public.partenaire_badges_nexus_admissibles(uuid)', array['authenticated', 'postgres', 'service_role']),
      ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', array['authenticated', 'postgres', 'service_role']),
      ('public.push_textes(text,text,integer,text)', array['postgres', 'service_role']),
      ('public.push_traiter_file(timestamptz)', array['postgres', 'service_role']),
      ('public.partenaire_demander_visibilite(uuid)', array['postgres', 'service_role']),
      ('public.partenaire_regler_demandes_visibilite(uuid)', array['postgres', 'service_role']),
      ('public.trg_partenaire_demande_sur_carte()', array['postgres', 'service_role']),
      ('public.trg_partenaire_demande_sur_optin()', array['postgres', 'service_role']),
      ('public.accepter_visibilite_partenaire(uuid,text)', array['authenticated', 'postgres', 'service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = to_regprocedure(r.f);
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL % = %, attendu %', r.f, vus, r.veut;
    end if;
  end loop;
  if (select prosecdef from pg_proc where oid = 'public.cotes_partenaires_athletes(uuid[])'::regprocedure) then
    raise exception 'NEXUS: cotes_partenaires_athletes doit rester SECURITY INVOKER';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes', 'recruiter_search_athletes',
                        'evaluations_partenaires_athlete', 'badges_partenaires_athlete', 'accepter_visibilite_partenaire')) <> 6 then
    raise exception 'NEXUS: surcharge inattendue';
  end if;
  raise notice 'NEXUS lot 20261016170000 : cartes, Loi 25, demande de visibilité — fonctions et ACL exactes — OK';
end $$;
