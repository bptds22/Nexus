-- Rollback du lot D5a cégep, étape 2 : retire les programmes universitaires (table, RPC, déclencheur).
-- La table part avec ses lignes : à jouer avant tout pré-remplissage, ou après l'avoir retiré.
drop function public.replace_university_programs(uuid, jsonb, boolean);
drop table public.university_programs;
drop function nexus_prive.university_programs_ecole_universite();
