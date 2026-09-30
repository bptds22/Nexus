-- 20260930210110_carte_renvoi_invitation (appliquée en prod le 2026-09-30, 21:01 UTC)
-- ════════════════════════════════════════════════════════════════════════════
-- CARTE PROSPECT — « RENVOYER L'INVITATION » PAR SON PROPRE CANAL (BP 2026-09-30).
--
-- Le bouton apparaît TOUJOURS quand la carte a un courriel, quel que soit
-- l'état de l'invitation automatique : c'est ce qui ne révèle rien (ni
-- compte existant, ni invitation d'une autre unité). Il ouvre la feuille de
-- partage (mobile) ou copie le texte (ordinateur) ; le recruteur envoie de
-- son téléphone ou de son courriel. NEXUS N'ENVOIE RIEN : aucun appel
-- réseau, aucune ligne dans cartes_prospect_invitations.
--
-- Seule la trace passe par la base : journaliser_renvoi_invitation(carte)
--   · Pro de l'unité de la carte (carte_ecriture_ok : carte non fusionnée) ;
--   · la carte doit porter un courriel ;
--   · une ligne INVITATION_RENVOYEE au journal, signée par l'appelant ;
--   · la dernière activité est rafraîchie, comme pour une note (lot C).
--
-- ADDITIVE : une valeur de journal ajoutée, une fonction nouvelle.
-- S'applique APRÈS 20260930210059_carte_invitation_etat (reprend son contrôle).
-- Rollback : supabase/rollback/20260930210110_rollback_carte_renvoi_invitation.sql
-- ════════════════════════════════════════════════════════════════════════════

alter table public.cartes_prospect_journal drop constraint cartes_prospect_journal_action_check;
alter table public.cartes_prospect_journal add constraint cartes_prospect_journal_action_check
  check (action in ('CREEE','ETAPE','GRADE','RELANCE','VISITE','DRAPEAU','MODIFIEE','NOTE','LISTE',
                    'INVITATION','INVITATION_NON_ENVOYEE','INVITATION_RENVOYEE'));

create function public.journaliser_renvoi_invitation(p_carte uuid)
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

-- ACL — liste COMPLÈTE triée (CLAUDE.md, 2026-09-07) : anon retiré.
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
