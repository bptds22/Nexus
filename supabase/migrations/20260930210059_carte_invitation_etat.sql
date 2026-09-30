-- 20260930210059_carte_invitation_etat (appliquée en prod le 2026-09-30, 21:00 UTC)
-- ════════════════════════════════════════════════════════════════════════════
-- CARTE PROSPECT — ÉTAT DE L'INVITATION (décision BP 2026-09-30).
--
-- Constat prod : une carte créée avec une adresse déjà invitée dans les 90
-- jours (règle DEJA_INVITE du lot C) n'affichait RIEN — l'invitation était
-- écartée à raison, mais en silence, alors que le formulaire promettait un
-- courriel. Le recruteur ne pouvait pas savoir.
--
-- cartes_prospect.invitation_etat :
--   · 'ENVOYEE'     — posé quand send-invitation-carte pose invitee_le ;
--   · 'NON_ENVOYEE' — posé par cartes_prospect_inviter quand l'invitation
--                     est ÉCARTÉE (compte existant, désabonné, déjà invité) ;
--   · NULL          — pas d'adresse, ou envoi en attente / en échec.
-- La RAISON n'est jamais exposée au recruteur : COMPTE_EXISTANT dirait qu'un
-- compte (peut-être d'un mineur) existe à cette adresse ; DEJA_INVITE
-- trahirait la carte d'une AUTRE unité. La table des invitations reste
-- réservée à l'admin ; seul l'état binaire vit sur la carte, sous sa RLS.
--
-- Écrite par la base seulement : carte_invitation_garde (même patron que
-- carte_fusion_garde, lot E) ignore toute valeur venue du client ; le
-- déclencheur d'invitation lève la garde le temps de sa propre écriture.
-- Journal : une ligne INVITATION_NON_ENVOYEE, sans acteur (constat système),
-- que l'Historique rend en toutes lettres.
--
-- ADDITIVE : une colonne nullable, une valeur de journal ajoutée, une
-- fonction + un trigger nouveaux, UNE fonction redéfinie
-- (cartes_prospect_inviter). Rien de retiré.
-- Rollback : supabase/rollback/20260930210059_rollback_carte_invitation_etat.sql
-- ════════════════════════════════════════════════════════════════════════════

-- 1. La colonne.
alter table public.cartes_prospect
  add column invitation_etat text
  check (invitation_etat is null or invitation_etat in ('ENVOYEE', 'NON_ENVOYEE'));

-- 2. Le journal accepte le constat.
alter table public.cartes_prospect_journal drop constraint cartes_prospect_journal_action_check;
alter table public.cartes_prospect_journal add constraint cartes_prospect_journal_action_check
  check (action in ('CREEE','ETAPE','GRADE','RELANCE','VISITE','DRAPEAU','MODIFIEE','NOTE','LISTE',
                    'INVITATION','INVITATION_NON_ENVOYEE'));

-- 3. La garde : invitation_etat ne s'écrit que par la base.
--    Ordre des BEFORE (alphabétique) : b_avant_update a déjà remis invitee_le
--    à son ancienne valeur pour un appel authentifié — un invitee_le NOUVEAU
--    ici ne peut venir que de l'edge function (service_role).
create function public.carte_invitation_garde()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('nexus.invitation_carte', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.invitation_etat := null;
  elsif new.invitee_le is not null and new.invitee_le is distinct from old.invitee_le then
    new.invitation_etat := 'ENVOYEE';
  else
    new.invitation_etat := old.invitation_etat;
  end if;
  return new;
end $$;

create trigger trg_carte_c_invitation before insert or update on public.cartes_prospect
  for each row execute function public.carte_invitation_garde();

-- 4. Le déclencheur d'invitation : corps de prod (lot C), plus le constat
--    quand l'invitation est écartée. L'UPDATE ne touche aucune colonne
--    surveillée par le journal ni par le rapprochement ; derniere_activite
--    reçoit now() — l'instant même de la création.
create or replace function public.cartes_prospect_inviter()
returns trigger language plpgsql security definer set search_path = public set row_security = off as $$
declare
  v_adresse text;
  v_emp     text;
  v_motif   text;
  v_id      uuid;
begin
  if new.courriel is null or btrim(new.courriel) = '' then return new; end if;
  v_adresse := lower(btrim(new.courriel));
  v_emp := public.empreinte_courriel(v_adresse);
  -- Deux cégeps qui créent la même adresse au même instant : l'un attend l'autre.
  perform pg_advisory_xact_lock(hashtext('carte-invitation:' || v_emp));

  v_motif := case
    when exists (select 1 from public.athletes a where lower(btrim(a.email)) = v_adresse)
      or exists (select 1 from public.users u where lower(btrim(u.email)) = v_adresse)
      or exists (select 1 from auth.users au where lower(btrim(au.email)) = v_adresse)
      then 'COMPTE_EXISTANT'
    when exists (select 1 from public.courriel_desabonnements_adresses d where d.empreinte = v_emp)
      then 'DESABONNE'
    when exists (select 1 from public.cartes_prospect_invitations i
                  where i.empreinte = v_emp and i.statut in ('A_ENVOYER','EN_COURS','ENVOYE')
                    and i.created_at > now() - interval '90 days')
      then 'DEJA_INVITE'
  end;

  insert into public.cartes_prospect_invitations (carte_id, unite_cegep_id, empreinte, statut, motif)
  values (new.id, new.unite_cegep_id, v_emp, case when v_motif is null then 'A_ENVOYER' else 'ECARTE' end, v_motif)
  returning id into v_id;

  if v_motif is null then
    perform public.envoyer_invitation_carte(v_id);
  else
    -- Constat neutre : l'état sur la carte, la ligne au journal. Jamais le motif.
    perform set_config('nexus.invitation_carte', 'on', true);
    update public.cartes_prospect set invitation_etat = 'NON_ENVOYEE' where id = new.id;
    perform set_config('nexus.invitation_carte', '', true);
    -- clock_timestamp : après la ligne CREEE (now()), dans l'ordre du geste.
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details, created_at)
    values (new.id, null, 'INVITATION_NON_ENVOYEE', '{}'::jsonb, clock_timestamp());
  end if;
  return new;
end $$;

-- 5. Rétro-remplissage depuis la table des invitations. Triggers coupés :
--    la dernière activité (purge à 12 mois) ne doit pas bouger.
alter table public.cartes_prospect disable trigger user;
update public.cartes_prospect c
   set invitation_etat = case i.statut when 'ECARTE' then 'NON_ENVOYEE' else 'ENVOYEE' end
  from public.cartes_prospect_invitations i
 where i.carte_id = c.id and i.statut in ('ECARTE', 'ENVOYE') and c.invitation_etat is null;
alter table public.cartes_prospect enable trigger user;
insert into public.cartes_prospect_journal (carte_id, acteur, action, details, created_at)
select i.carte_id, null, 'INVITATION_NON_ENVOYEE', '{}'::jsonb, i.created_at + interval '1 millisecond'
  from public.cartes_prospect_invitations i
 where i.statut = 'ECARTE' and i.carte_id is not null
   and not exists (select 1 from public.cartes_prospect_journal j
                    where j.carte_id = i.carte_id and j.action = 'INVITATION_NON_ENVOYEE');

-- 6. ACL — comparaison de la liste COMPLÈTE triée (CLAUDE.md, 2026-09-07).
--    La fonction nouvelle hérite des default privileges (anon, authenticated) :
--    on les retire, comme pour toute fonction de trigger du lot C.
revoke all on function public.carte_invitation_garde() from public, anon, authenticated;
do $$
declare
  r record; vus text[];
begin
  for r in select * from (values
      ('public.carte_invitation_garde()'::regprocedure,  array['postgres','service_role']),
      ('public.cartes_prospect_inviter()'::regprocedure, array['postgres','service_role'])
    ) as t(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;

  if (select count(*) from pg_trigger where tgname = 'trg_carte_c_invitation'
        and tgrelid = 'public.cartes_prospect'::regclass and tgenabled = 'O') <> 1 then
    raise exception 'NEXUS: trg_carte_c_invitation absent ou inactif';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.cartes_prospect'::regclass
               and not tgisinternal and tgenabled <> 'O') then
    raise exception 'NEXUS: un trigger de cartes_prospect est resté désactivé';
  end if;
end $$;
