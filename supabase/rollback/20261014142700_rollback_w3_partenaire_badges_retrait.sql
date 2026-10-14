-- Rollback de 20261014142700_w3_partenaire_badges_retrait.sql.
-- ⚠ PERDUS (relever avant) : le catalogue des badges partenaire, les badges
-- posés (y compris retirés / masqués) et la trace des évaluations retirées.
-- Les évaluations partenaire ENCORE EN PLACE ne sont pas touchées (table W2).
-- Le bucket partner-badges RESTE : Supabase refuse de supprimer un bucket en
-- SQL (storage.protect_delete). Sans ses policies d'écriture il est inerte ;
-- le vider puis le supprimer par le dashboard (Storage) si voulu. La lecture
-- publique reste, pour que les icônes déjà servies ne cassent pas d'un coup.
begin;

drop policy if exists "partner badges admin insert" on storage.objects;
drop policy if exists "partner badges admin update" on storage.objects;
drop policy if exists "partner badges admin delete" on storage.objects;

drop function public.retirer_evaluation_partenaire(uuid);
drop function public.badges_partenaires_athlete(uuid);
drop function public.coach_masquer_badge_partenaire(uuid, boolean);
drop function public.retirer_badge_partenaire(uuid);
drop function public.partenaire_attribuer_badge(uuid, uuid);
drop function public.partenaire_mes_badges();
drop function public.admin_enregistrer_badge_partenaire(uuid, uuid, text, text, boolean, integer);
drop function public.admin_badges_partenaire(uuid);

drop table public.partner_evaluation_retraits;
drop table public.partner_athlete_badges;
drop table public.partner_badges;

do $$
begin
  if to_regclass('public.partner_badges') is not null
     or to_regclass('public.partner_athlete_badges') is not null
     or to_regclass('public.partner_evaluation_retraits') is not null then
    raise exception 'NEXUS: rollback W3 incomplet (tables)';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
               and proname in ('admin_badges_partenaire', 'admin_enregistrer_badge_partenaire',
                               'partenaire_mes_badges', 'partenaire_attribuer_badge',
                               'retirer_badge_partenaire', 'coach_masquer_badge_partenaire',
                               'badges_partenaires_athlete', 'retirer_evaluation_partenaire')) then
    raise exception 'NEXUS: rollback W3 incomplet (fonctions)';
  end if;
  -- W2 intacte.
  if to_regclass('public.partner_evaluations') is null then
    raise exception 'NEXUS: partner_evaluations disparue — le rollback W3 ne doit pas toucher W2';
  end if;
end $$;

commit;
