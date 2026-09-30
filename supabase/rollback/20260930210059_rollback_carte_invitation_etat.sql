-- Rollback de 20260930210059_carte_invitation_etat.
-- Rend cartes_prospect_inviter à son corps de prod (lot C), retire la garde,
-- les lignes INVITATION_NON_ENVOYEE du journal, la valeur du contrôle et la
-- colonne. Les invitations elles-mêmes (cartes_prospect_invitations) ne sont
-- pas touchées : la migration ne les a jamais modifiées.

drop trigger trg_carte_c_invitation on public.cartes_prospect;
drop function public.carte_invitation_garde();

CREATE OR REPLACE FUNCTION public.cartes_prospect_inviter()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
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

  if v_motif is null then perform public.envoyer_invitation_carte(v_id); end if;
  return new;
end $function$

;

delete from public.cartes_prospect_journal where action = 'INVITATION_NON_ENVOYEE';
alter table public.cartes_prospect_journal drop constraint cartes_prospect_journal_action_check;
alter table public.cartes_prospect_journal add constraint cartes_prospect_journal_action_check
  check (action in ('CREEE','ETAPE','GRADE','RELANCE','VISITE','DRAPEAU','MODIFIEE','NOTE','LISTE','INVITATION'));

alter table public.cartes_prospect drop column invitation_etat;

-- ACL de la fonction restaurée : CREATE OR REPLACE la conserve ; on le vérifie.
do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.cartes_prospect_inviter()'::regprocedure;
  if vus is distinct from array['postgres','service_role'] then
    raise exception 'NEXUS: ACL de cartes_prospect_inviter = %, attendu {postgres,service_role}', vus;
  end if;
end $$;
