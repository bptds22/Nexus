-- Lot E1 cégep — le cégépien voit et cible les universités, sous lancement_universitaire ON (retour du test de bout en
-- bout de BP, 2026-10-28 : A1, C1, C3 ; décision Q6 : tout sous l'interrupteur universitaire).
-- Sous OFF, rien ne change : les universités restent masquées à tous sauf l'admin (D1a), et personne ne peut les cibler.
--   1. nexus_prive.cegepien_sous_on() : interrupteur ON ET l'appelant est un compte ATHLETE dont la fiche est rattachée
--      à un CÉGEP (même règle que public.athlete_est_cegepien, lot A).
--   2. Lecture : les policies de masquage D1a (schools, teams) et la lecture des programmes universitaires (D5a)
--      s'ouvrent à ce seul lecteur ; une policy permissive lui rend les équipes universitaires (aucune policy
--      existante ne les montre à un athlète). Rien ne s'ouvre pour l'athlète du secondaire, le coach, le recruteur
--      collégial, le partenaire ni anon.
--   3. Écriture : athlete_targets refuse une université sauf pour le cégépien sous ON (ou l'admin) ; la table ne
--      contrôlait aucun type d'école jusqu'ici (0 cible universitaire en prod au 2026-10-28).
--   4. « Athlètes qui me ciblent » (A1) : athletes_targeting_my_cegep() rend déjà les cibles de l'école du recruteur,
--      universités comprises, et le recruteur universitaire voit les cégépiens sous ON (D3c) — rien à changer.
-- Policies de départ gardées par leur texte (relevé prod 2026-10-28) ; le rollback les remet à l'identique.

do $garde$
begin
  if (select regexp_replace(qual, '\s+', ' ', 'g') from pg_policies where schemaname = 'public' and tablename = 'schools' and policyname = 'universites_masquees')
       is distinct from '((type <> ''UNIVERSITE''::text) OR ( SELECT is_admin() AS is_admin) OR (id = ( SELECT nexus_prive.mon_universite() AS mon_universite)))'
     or (select regexp_replace(qual, '\s+', ' ', 'g') from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'universites_masquees')
       is distinct from '(( SELECT is_admin() AS is_admin) OR (NOT (school_id = ANY (( SELECT nexus_prive.ids_universites() AS ids_universites)::uuid[]))) OR (school_id = ( SELECT nexus_prive.mon_universite() AS mon_universite)))'
     or (select regexp_replace(qual, '\s+', ' ', 'g') from pg_policies where schemaname = 'public' and tablename = 'university_programs' and policyname = 'university_programs_read')
       is distinct from '(( SELECT is_admin() AS is_admin) OR (school_id = ( SELECT nexus_prive.mon_universite() AS mon_universite)))' then
    raise exception 'NEXUS: E1 — une policy de masquage a changé depuis le relevé ; régénérer';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.athlete_targets'::regclass and not tgisinternal) then
    raise exception 'NEXUS: E1 — athlete_targets a déjà un déclencheur ; relire';
  end if;
end $garde$;

-- ── 1. Le lecteur cégépien sous ON ───────────────────────────────────────────
create function nexus_prive.cegepien_sous_on() returns boolean
  language sql stable security definer set search_path = public set row_security = off
as $function$
  select public.lancement_universitaire_actif()
     and exists (select 1 from public.users u
                   join public.athletes a on a.user_id = u.id
                   join public.schools s on s.id = a.school_id
                  where u.id = auth.uid() and u.role = 'ATHLETE'::public.user_role and s.type = 'CEGEP');
$function$;
revoke all on function nexus_prive.cegepien_sous_on() from public;
grant execute on function nexus_prive.cegepien_sous_on() to anon, authenticated, service_role;

-- ── 2. Lecture ───────────────────────────────────────────────────────────────
alter policy universites_masquees on public.schools
  using ((type <> 'UNIVERSITE'::text) or (select public.is_admin()) or (id = (select nexus_prive.mon_universite()))
         or (select nexus_prive.cegepien_sous_on()));
alter policy universites_masquees on public.teams
  using ((select public.is_admin()) or (not (school_id = any ((select nexus_prive.ids_universites())::uuid[])))
         or (school_id = (select nexus_prive.mon_universite())) or (select nexus_prive.cegepien_sous_on()));
create policy universites_lisibles_cegepiens on public.teams for select to authenticated
  using ((select nexus_prive.cegepien_sous_on()) and school_id = any ((select nexus_prive.ids_universites())::uuid[]));
alter policy university_programs_read on public.university_programs
  using ((select public.is_admin()) or (school_id = (select nexus_prive.mon_universite())) or (select nexus_prive.cegepien_sous_on()));

-- ── 3. Écriture des cibles ───────────────────────────────────────────────────
create function nexus_prive.cible_universite_permise() returns trigger
  language plpgsql security definer set search_path = public set row_security = off
as $function$
begin
  -- Écritures serveur (clé service, imports) : pas d'utilisateur, pas de règle de rôle.
  if auth.uid() is null then return new; end if;
  if not exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE') then return new; end if;
  if public.is_admin() then return new; end if;
  if not public.lancement_universitaire_actif() then
    raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.' using errcode = '42501';
  end if;
  if not public.athlete_est_cegepien(new.athlete_id) then
    raise exception 'NEXUS: Seuls les athlètes collégiaux peuvent cibler une université.' using errcode = '42501';
  end if;
  return new;
end $function$;
revoke all on function nexus_prive.cible_universite_permise() from public, anon, authenticated;
create trigger athlete_targets_universite before insert or update of school_id, athlete_id on public.athlete_targets
  for each row execute function nexus_prive.cible_universite_permise();
