-- Lot T — écriture de teams réservée aux coachs (constat BP 2026-10-28, essai prod du même jour).
-- Les policies « Coaches create / update / delete teams » ne testent que school_id = current_user_school_id(), TO
-- public, sans rôle : un athlète (son école de fiche), un recruteur collégial (son cégep) ou tout autre compte
-- rattaché à une école peut créer, modifier ou supprimer les équipes de cette école.
-- Correctif : trois policies RESTRICTIVES (une par commande) qui exigent un compte COACH ou ADMIN. Les policies
-- permissives existantes ne bougent pas : un coach garde exactement ses droits, l'admin aussi (il n'a aucune
-- policy d'écriture permissive sur teams ; il passe par la clé service ou les RPC admin). Les fonctions SECURITY
-- DEFINER (inscription coach, RSEQ, nettoyage) et la clé service ne sont pas concernées par la RLS.
-- Écrivains légitimes dans le code : lib/queries/coach/createTeam.ts, app/coach/equipes/[teamId], onboarding du coach
-- civil, CoachEquipeDetailMobile — tous en compte COACH.

do $garde$
begin
  if md5(pg_get_functiondef('public.is_coach()'::regprocedure)) <> '8161151d6ad303c86962e31c1122f6d5' then
    raise exception 'NEXUS: lot T — is_coach() a changé depuis le relevé ; régénérer';
  end if;
end $garde$;

create policy teams_ecriture_coachs_insert on public.teams as restrictive for insert to public
  with check ((select public.is_coach()) or (select public.is_admin()));
create policy teams_ecriture_coachs_update on public.teams as restrictive for update to public
  using ((select public.is_coach()) or (select public.is_admin()))
  with check ((select public.is_coach()) or (select public.is_admin()));
create policy teams_ecriture_coachs_delete on public.teams as restrictive for delete to public
  using ((select public.is_coach()) or (select public.is_admin()));
