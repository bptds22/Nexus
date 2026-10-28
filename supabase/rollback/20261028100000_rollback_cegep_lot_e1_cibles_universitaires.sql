-- Rollback du lot E1 cégep : remet les policies de masquage D1a / D5a dans leur texte d'origine, retire la lecture
-- des équipes universitaires par le cégépien et le contrôle des cibles universitaires.
-- À jouer avant toute cible universitaire réelle (sinon les compter d'abord).
drop trigger athlete_targets_universite on public.athlete_targets;
drop function nexus_prive.cible_universite_permise();
drop policy universites_lisibles_cegepiens on public.teams;
alter policy universites_masquees on public.schools
  using ((type <> 'UNIVERSITE'::text) or (select public.is_admin()) or (id = (select nexus_prive.mon_universite())));
alter policy universites_masquees on public.teams
  using ((select public.is_admin()) or (not (school_id = any ((select nexus_prive.ids_universites())::uuid[])))
         or (school_id = (select nexus_prive.mon_universite())));
alter policy university_programs_read on public.university_programs
  using ((select public.is_admin()) or (school_id = (select nexus_prive.mon_universite())));
drop function nexus_prive.cegepien_sous_on();
