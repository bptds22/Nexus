-- ════════════════════════════════════════════════════════════════════════════
-- CARTE PROSPECT — RAPPEL D'INVITATION ENVOYÉ PAR NEXUS (décision BP 2026-09-30).
--
-- « Renvoyer l'invitation » ENVOIE un courriel : même fonction
-- (send-invitation-carte) et même gabarit que l'invitation automatique,
-- « Rappel : » dans l'objet, désabonnement et adresse postale.
--
-- RÈGLE (BP 2026-09-30, option « seulement si partie ») : le rappel n'est
-- possible que si l'invitation automatique de CETTE carte est PARTIE, vers
-- la MÊME adresse, et que cette adresse n'a depuis ni compte Nexus ni
-- désabonnement. Tout autre cas répond « Impossible d'envoyer à cette
-- adresse », sans distinction : aucun oracle (la mention neutre regroupe
-- déjà « déjà invitée » et « ne peut pas en recevoir »), et la règle des
-- 90 jours entre unités reste intacte.
-- Limites : au plus un envoi par 7 jours (l'invitation automatique compte
-- comme le premier) ; au plus 3 rappels par carte.
--
-- MOUVANTS :
--   · cartes_prospect.renvois_invitation (0..3) et .dernier_renvoi_le — écrits
--     par la base seulement (carte_invitation_garde, étendue) ;
--   · cartes_prospect_rappels : une ligne par rappel DEMANDÉ (serveur seul,
--     comme cartes_prospect_invitations) ; purgée avec son invitation (FK) ;
--   · demander_rappel_invitation(carte) → jsonb {etat, ...} : décide, réserve,
--     appelle l'edge function ;
--   · finaliser_rappel_carte(rappel, resend_id) : appelée par l'edge function
--     sur un 2xx de Resend SEULEMENT — compteur, date, état ENVOYEE, journal
--     INVITATION_RAPPEL signé par le recruteur qui a demandé.
--
-- ADDITIVE : deux colonnes, une table, une valeur de journal, trois fonctions
-- nouvelles ; UNE fonction redéfinie (carte_invitation_garde, même ACL).
-- S'applique APRÈS 20260930210059 et 20260930210110.
-- Rollback : supabase/rollback/20261001005953_rollback_carte_rappel_invitation.sql
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Le compteur et la date, sur la carte (lisibles par l'unité, sous la RLS de la carte).
alter table public.cartes_prospect
  add column renvois_invitation integer not null default 0
    check (renvois_invitation between 0 and 3),
  add column dernier_renvoi_le timestamptz;

-- 2. Les rappels demandés (serveur seulement).
create table public.cartes_prospect_rappels (
  id            uuid primary key default gen_random_uuid(),
  carte_id      uuid references public.cartes_prospect(id) on delete set null,
  -- L'invitation d'origine : son jeton sert au désabonnement (même adresse).
  invitation_id uuid not null references public.cartes_prospect_invitations(id) on delete cascade,
  demande_par   uuid not null,
  statut        text not null default 'A_ENVOYER' check (statut in ('A_ENVOYER','EN_COURS','ENVOYE','ECHEC')),
  resend_id     text,
  erreur        text,
  created_at    timestamptz not null default now(),
  envoye_le     timestamptz
);
create index cartes_prospect_rappels_carte_idx on public.cartes_prospect_rappels (carte_id, created_at desc);
alter table public.cartes_prospect_rappels enable row level security;
revoke all on public.cartes_prospect_rappels from public, anon, authenticated;

-- 3. Le journal accepte le rappel.
alter table public.cartes_prospect_journal drop constraint cartes_prospect_journal_action_check;
alter table public.cartes_prospect_journal add constraint cartes_prospect_journal_action_check
  check (action in ('CREEE','ETAPE','GRADE','RELANCE','VISITE','DRAPEAU','MODIFIEE','NOTE','LISTE',
                    'INVITATION','INVITATION_NON_ENVOYEE','INVITATION_RENVOYEE','INVITATION_RAPPEL'));

-- 4. La garde protège aussi le compteur et la date (corps de prod + deux lignes).
create or replace function public.carte_invitation_garde()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('nexus.invitation_carte', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.invitation_etat := null;
    new.renvois_invitation := 0;
    new.dernier_renvoi_le := null;
  else
    if new.invitee_le is not null and new.invitee_le is distinct from old.invitee_le then
      new.invitation_etat := 'ENVOYEE';
    else
      new.invitation_etat := old.invitation_etat;
    end if;
    new.renvois_invitation := old.renvois_invitation;
    new.dernier_renvoi_le := old.dernier_renvoi_le;
  end if;
  return new;
end $$;

-- 5. L'appel HTTP : même patron qu'envoyer_invitation_carte (lot C) — secret
--    au vault, tout avalé : un appel raté laisse la ligne A_ENVOYER.
create function public.envoyer_rappel_carte(p_rappel uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_secret text;
  v_url    text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-invitation-carte';
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'CARTE_INVITATION_SECRET' limit 1;
  if v_secret is null then return; end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-carte-invitation-secret', v_secret),
    body    := jsonb_build_object('rappel_id', p_rappel)
  );
exception when others then
  raise warning 'envoyer_rappel_carte: % : %', p_rappel, sqlerrm;
end $$;

-- 6. La demande. Réponse : {etat: ENVOI_LANCE | EN_COURS | TROP_TOT | LIMITE | IMPOSSIBLE}.
--    IMPOSSIBLE ne dit JAMAIS pourquoi.
create function public.demander_rappel_invitation(p_carte uuid)
returns jsonb language plpgsql security definer set search_path = public set row_security = off as $$
declare
  c        record;
  v_inv    record;
  v_adr    text;
  v_dernier timestamptz;
  v_id     uuid;
begin
  if auth.uid() is null or not public.carte_ecriture_ok(p_carte) then
    raise exception 'NEXUS: carte introuvable ou hors de ton unité' using errcode = '42501';
  end if;
  -- Un seul rappel à la fois par carte : deux clics concurrents, un seul passe.
  select id, courriel, invitation_etat, invitee_le, renvois_invitation, dernier_renvoi_le
    into c from public.cartes_prospect where id = p_carte for update;

  v_adr := lower(btrim(coalesce(c.courriel, '')));
  select i.id, i.empreinte into v_inv from public.cartes_prospect_invitations i
   where i.carte_id = p_carte and i.statut = 'ENVOYE' limit 1;

  if v_adr = '' or c.invitation_etat is distinct from 'ENVOYEE' or v_inv.id is null
     or v_inv.empreinte <> public.empreinte_courriel(v_adr)
     or exists (select 1 from public.athletes a where lower(btrim(a.email)) = v_adr)
     or exists (select 1 from public.users u where lower(btrim(u.email)) = v_adr)
     or exists (select 1 from auth.users au where lower(btrim(au.email)) = v_adr)
     or exists (select 1 from public.courriel_desabonnements_adresses d where d.empreinte = v_inv.empreinte) then
    return jsonb_build_object('etat', 'IMPOSSIBLE');
  end if;

  if c.renvois_invitation >= 3 then
    return jsonb_build_object('etat', 'LIMITE', 'renvois', c.renvois_invitation);
  end if;

  -- Un rappel en vol (moins de 15 minutes) : on ne double pas.
  if exists (select 1 from public.cartes_prospect_rappels r
              where r.carte_id = p_carte and r.statut in ('A_ENVOYER','EN_COURS')
                and r.created_at > now() - interval '15 minutes') then
    return jsonb_build_object('etat', 'EN_COURS');
  end if;

  v_dernier := greatest(c.invitee_le, c.dernier_renvoi_le);
  if v_dernier is not null and v_dernier + interval '7 days' > now() then
    return jsonb_build_object('etat', 'TROP_TOT', 'dernier_le', v_dernier, 'disponible_le', v_dernier + interval '7 days');
  end if;

  insert into public.cartes_prospect_rappels (carte_id, invitation_id, demande_par)
  values (p_carte, v_inv.id, auth.uid()) returning id into v_id;
  perform public.envoyer_rappel_carte(v_id);
  return jsonb_build_object('etat', 'ENVOI_LANCE');
end $$;

-- 7. La confirmation, par l'edge function, sur un 2xx de Resend seulement.
--    Idempotente : seule une ligne EN_COURS se finalise.
create function public.finaliser_rappel_carte(p_rappel uuid, p_resend_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  update public.cartes_prospect_rappels
     set statut = 'ENVOYE', envoye_le = now(), resend_id = p_resend_id, erreur = null
   where id = p_rappel and statut = 'EN_COURS'
  returning carte_id, demande_par into r;
  if r.carte_id is null then return false; end if;

  perform set_config('nexus.invitation_carte', 'on', true);
  update public.cartes_prospect
     set renvois_invitation = least(renvois_invitation + 1, 3),
         dernier_renvoi_le = now(),
         invitation_etat = 'ENVOYEE'
   where id = r.carte_id;
  perform set_config('nexus.invitation_carte', '', true);

  insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
  values (r.carte_id, r.demande_par, 'INVITATION_RAPPEL', jsonb_build_object('le', now()));
  return true;
end $$;

-- 8. ACL — liste COMPLÈTE triée (CLAUDE.md, 2026-09-07).
revoke all on function public.envoyer_rappel_carte(uuid) from public, anon, authenticated;
revoke all on function public.finaliser_rappel_carte(uuid, text) from public, anon, authenticated;
revoke all on function public.demander_rappel_invitation(uuid) from public, anon;
grant execute on function public.demander_rappel_invitation(uuid) to authenticated;
do $$
declare
  r record; vus text[];
begin
  for r in select * from (values
      ('public.carte_invitation_garde()'::regprocedure,          array['postgres','service_role']),
      ('public.envoyer_rappel_carte(uuid)'::regprocedure,        array['postgres','service_role']),
      ('public.finaliser_rappel_carte(uuid,text)'::regprocedure, array['postgres','service_role']),
      ('public.demander_rappel_invitation(uuid)'::regprocedure,  array['authenticated','postgres','service_role'])
    ) as t(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;

  select array_agg(t.g order by t.g) into vus
    from pg_class c,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.cartes_prospect_rappels'::regclass;
  if vus is distinct from array['postgres','service_role'] then
    raise exception 'NEXUS: ACL de cartes_prospect_rappels = %, attendu {postgres,service_role}', vus;
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.cartes_prospect_rappels'::regclass) then
    raise exception 'NEXUS: RLS absente sur cartes_prospect_rappels';
  end if;
end $$;
