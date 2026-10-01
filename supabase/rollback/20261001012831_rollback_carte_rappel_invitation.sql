-- Rollback de 20261001012831_carte_rappel_invitation.
-- Retire les rappels (la table, les fonctions, les lignes de journal
-- INVITATION_RAPPEL), le compteur et la date, et rend carte_invitation_garde
-- à son corps de 20260930210059. Les courriels déjà partis le restent.

drop function public.demander_rappel_invitation(uuid);
drop function public.finaliser_rappel_carte(uuid, text);
drop function public.envoyer_rappel_carte(uuid);
drop table public.cartes_prospect_rappels;

create or replace function public.carte_invitation_garde()
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

delete from public.cartes_prospect_journal where action = 'INVITATION_RAPPEL';
alter table public.cartes_prospect_journal drop constraint cartes_prospect_journal_action_check;
alter table public.cartes_prospect_journal add constraint cartes_prospect_journal_action_check
  check (action in ('CREEE','ETAPE','GRADE','RELANCE','VISITE','DRAPEAU','MODIFIEE','NOTE','LISTE',
                    'INVITATION','INVITATION_NON_ENVOYEE','INVITATION_RENVOYEE'));

alter table public.cartes_prospect drop column renvois_invitation, drop column dernier_renvoi_le;

do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.carte_invitation_garde()'::regprocedure;
  if vus is distinct from array['postgres','service_role'] then
    raise exception 'NEXUS: ACL de carte_invitation_garde = %, attendu {postgres,service_role}', vus;
  end if;
end $$;
