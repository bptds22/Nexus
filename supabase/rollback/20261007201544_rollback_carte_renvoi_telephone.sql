-- Rollback de 20261007201544_carte_renvoi_telephone.
-- Republie journaliser_renvoi_invitation telle qu'en prod avant ce lot
-- (20260930210110_carte_renvoi_invitation : courriel obligatoire). Les lignes
-- INVITATION_RENVOYEE déjà écrites pour des cartes téléphone seulement restent.

create or replace function public.journaliser_renvoi_invitation(p_carte uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.carte_ecriture_ok(p_carte) then
    raise exception 'NEXUS: carte introuvable ou hors de ton unité' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cartes_prospect c
                  where c.id = p_carte and c.courriel is not null and btrim(c.courriel) <> '') then
    raise exception 'NEXUS: cette carte n''a pas de courriel' using errcode = '22023';
  end if;
  insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
  values (p_carte, auth.uid(), 'INVITATION_RENVOYEE', '{}'::jsonb);
  update public.cartes_prospect set derniere_activite = now() where id = p_carte;
end $$;

revoke all on function public.journaliser_renvoi_invitation(uuid) from public, anon;
grant execute on function public.journaliser_renvoi_invitation(uuid) to authenticated;
do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.journaliser_renvoi_invitation(uuid)'::regprocedure;
  if vus is distinct from array['authenticated','postgres','service_role'] then
    raise exception 'NEXUS: ACL de journaliser_renvoi_invitation = %, attendu {authenticated,postgres,service_role}', vus;
  end if;
end $$;
