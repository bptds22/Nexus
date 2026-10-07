-- 20261007201544_carte_renvoi_telephone — APPLIQUÉE en prod le 2026-10-07
-- (GO BP) sous cette version (fichier préparé sous 20261007210000).
-- Vérifié après l'apply : pg_get_functiondef md5 7b7ca7b0… = ce fichier,
-- ACL {authenticated,postgres,service_role} inchangée, 353 autres fonctions
-- public inchangées.
-- ════════════════════════════════════════════════════════════════════════════
-- « COPIER LE TEXTE » POUR UNE CARTE TÉLÉPHONE SEULEMENT (lot 2 cartes,
-- décisions BP 2026-10-07).
--
-- journaliser_renvoi_invitation note à l'historique qu'un recruteur a copié
-- le texte d'invitation pour l'envoyer lui-même. Elle refusait toute carte
-- sans courriel (22023) : le texte à copier d'une carte qui n'a qu'un
-- TÉLÉPHONE (à la création, dans le panneau, après l'ajout d'un numéro) ne
-- laissait donc aucune trace. Elle accepte désormais « courriel OU
-- téléphone » ; refus si la carte n'a ni l'un ni l'autre. Même ligne
-- INVITATION_RENVOYEE, mêmes droits (authenticated, avec la garde
-- carte_ecriture_ok : l'unité seulement).
--
-- Nexus n'envoie toujours RIEN au numéro : la fonction ne fait qu'écrire la
-- trace d'un envoi fait par le recruteur, depuis son propre téléphone.
--
-- Additive : une fonction redéfinie, signature et ACL inchangées.
-- Rollback : supabase/rollback/20261007201544_rollback_carte_renvoi_telephone.sql
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.journaliser_renvoi_invitation(p_carte uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.carte_ecriture_ok(p_carte) then
    raise exception 'NEXUS: carte introuvable ou hors de ton unité' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cartes_prospect c
                  where c.id = p_carte
                    and ((c.courriel is not null and btrim(c.courriel) <> '')
                         or (c.telephone is not null and btrim(c.telephone) <> ''))) then
    raise exception 'NEXUS: cette carte n''a ni courriel ni téléphone' using errcode = '22023';
  end if;
  insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
  values (p_carte, auth.uid(), 'INVITATION_RENVOYEE', '{}'::jsonb);
  update public.cartes_prospect set derniere_activite = now() where id = p_carte;
end $$;

-- ACL — inchangée, reposée explicitement (un CREATE OR REPLACE la garde, mais
-- le gate ne doit rien supposer).
revoke all on function public.journaliser_renvoi_invitation(uuid) from public, anon;
grant execute on function public.journaliser_renvoi_invitation(uuid) to authenticated;

-- GATE — liste complète triée (règle 2026-09-07), jamais par inclusion.
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
