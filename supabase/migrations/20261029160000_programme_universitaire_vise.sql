-- ════════════════════════════════════════════════════════════════════════════
-- Programme universitaire visé du cégépien (chantier cégep, D5 Q6 — décision BP 2026-10-29).
--
-- Le cégépien (école d'ancrage CEGEP) choisit, sous lancement_universitaire ON, le programme universitaire
-- qu'il vise : un programme du catalogue (university_programs) OU un texte libre.
--
-- Données (athletes) :
--   programme_universitaire_vise_id  uuid → university_programs (on delete set null : le libellé reste)
--   programme_universitaire_vise     text — le LIBELLÉ affiché et filtré. Pour un programme du catalogue,
--                                    la base le pose elle-même (« Programme — Université ») : le recruteur
--                                    universitaire d'une autre université ne lit pas ce catalogue (D5a),
--                                    il lit ce libellé. Texte libre : espaces normalisés, 2 à 200 caractères.
-- Droits : aucune policy nouvelle. Les lignes des cégépiens ne sont lues que par l'athlète, l'admin et les
--   recruteurs dont l'unité voit les cégépiens (cegepiens_masques_recruteurs, D3) ; les recruteurs collégiaux
--   et les partenaires ne lisent pas ces lignes. La fiche partenaire ne montre aucun bloc académique.
-- Garde (trigger trg_athletes_programme_universitaire_vise, BEFORE, avant trg_profile_completion) :
--   · une NOUVELLE valeur exige lancement_universitaire ON (42501) et une école CEGEP (42501) ; un programme
--     inconnu est refusé (23503). Un retrait passe toujours (et le « set null » de la clé étrangère).
--   · un athlète qui quitte son cégep perd son programme visé.
-- Complétion : calculate_profile_completion() compte ce champ À LA PLACE du programme CÉGEP visé pour le
--   cégépien sous ON (même poids) ; règle inchangée pour tous les autres. Aucune fiche existante n'est
--   réécrite : le % se recalcule à la prochaine écriture de la fiche, comme d'habitude.
--
-- Rollback : supabase/rollback/20261029160000_rollback_programme_universitaire_vise.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'athletes'
               and column_name in ('programme_universitaire_vise', 'programme_universitaire_vise_id')) then
    raise exception 'NEXUS: 20261029160000 déjà appliquée';
  end if;
  if to_regclass('public.university_programs') is null or to_regprocedure('public.lancement_universitaire_actif()') is null then
    raise exception 'NEXUS: préalables D5a absents';
  end if;
  if to_regprocedure('nexus_prive.est_ecole_cegep(uuid)') is not null then
    raise exception 'NEXUS: nexus_prive.est_ecole_cegep existe déjà';
  end if;
end $$;
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.calculate_profile_completion()'::regprocedure)
     is distinct from '41d6dbdfd31e3f15979a2e825c194a2c' then
    raise exception 'NEXUS: calculate_profile_completion n''est pas le corps attendu';
  end if;
end $$;

alter table public.athletes
  add column programme_universitaire_vise_id uuid references public.university_programs(id) on delete set null,
  add column programme_universitaire_vise text;
alter table public.athletes
  add constraint athletes_programme_universitaire_vise_longueur
    check (programme_universitaire_vise is null or char_length(programme_universitaire_vise) between 2 and 200),
  add constraint athletes_programme_universitaire_vise_libelle
    check (programme_universitaire_vise_id is null or programme_universitaire_vise is not null);
create index athletes_programme_universitaire_vise_id_idx on public.athletes (programme_universitaire_vise_id)
  where programme_universitaire_vise_id is not null;
comment on column public.athletes.programme_universitaire_vise_id is
  'Cégépien : programme universitaire visé, choisi au catalogue (university_programs). Écrit sous lancement_universitaire ON seulement.';
comment on column public.athletes.programme_universitaire_vise is
  'Cégépien : libellé du programme universitaire visé (posé par la base pour un programme du catalogue, sinon texte libre).';

create function nexus_prive.est_ecole_cegep(p_school_id uuid)
returns boolean language sql stable security definer set search_path = public set row_security = off as $f$
  select exists (select 1 from public.schools s where s.id = p_school_id and s.type::text = 'CEGEP');
$f$;
revoke all on function nexus_prive.est_ecole_cegep(uuid) from public, anon;
grant execute on function nexus_prive.est_ecole_cegep(uuid) to authenticated, service_role;

create function public.programme_universitaire_vise_garde()
returns trigger language plpgsql security definer set search_path = public as $f$
declare
  v_cegep boolean := nexus_prive.est_ecole_cegep(new.school_id);
  v_nouveau boolean;
  v_libelle text;
begin
  -- Un athlète qui quitte son cégep perd son programme visé (la donnée ne vaut que pour le cégépien).
  if tg_op = 'UPDATE' and not v_cegep
     and (old.programme_universitaire_vise_id is not null or old.programme_universitaire_vise is not null)
     and new.programme_universitaire_vise_id is not distinct from old.programme_universitaire_vise_id
     and new.programme_universitaire_vise is not distinct from old.programme_universitaire_vise then
    new.programme_universitaire_vise_id := null;
    new.programme_universitaire_vise := null;
    return new;
  end if;
  -- Seule une NOUVELLE valeur est contrôlée : un retrait passe toujours.
  if tg_op = 'INSERT' then
    v_nouveau := new.programme_universitaire_vise_id is not null or new.programme_universitaire_vise is not null;
  else
    v_nouveau := (new.programme_universitaire_vise_id is not null
                    and new.programme_universitaire_vise_id is distinct from old.programme_universitaire_vise_id)
              or (new.programme_universitaire_vise is not null
                    and new.programme_universitaire_vise is distinct from old.programme_universitaire_vise);
  end if;
  if not v_nouveau then
    return new;
  end if;
  if not public.lancement_universitaire_actif() then
    raise exception using errcode = '42501', message = 'NEXUS: Le programme universitaire visé n''est pas encore ouvert.';
  end if;
  if not v_cegep then
    raise exception using errcode = '42501', message = 'NEXUS: Le programme universitaire visé est réservé aux athlètes d''un cégep.';
  end if;
  if new.programme_universitaire_vise_id is not null then
    select left(p.name || ' — ' || s.name, 200) into v_libelle
      from public.university_programs p join public.schools s on s.id = p.school_id
     where p.id = new.programme_universitaire_vise_id and s.type::text = 'UNIVERSITE';
    if v_libelle is null then
      raise exception using errcode = '23503', message = 'NEXUS: Ce programme universitaire n''existe pas.';
    end if;
    new.programme_universitaire_vise := v_libelle;
  else
    new.programme_universitaire_vise := nullif(btrim(regexp_replace(new.programme_universitaire_vise, '\s+', ' ', 'g')), '');
  end if;
  return new;
end $f$;
revoke all on function public.programme_universitaire_vise_garde() from public, anon, authenticated;
grant execute on function public.programme_universitaire_vise_garde() to service_role;

-- « trg_athletes_… » passe avant « trg_profile_completion » (ordre alphabétique des triggers BEFORE) :
-- la complétion voit la valeur normalisée.
create trigger trg_athletes_programme_universitaire_vise
  before insert or update of programme_universitaire_vise_id, programme_universitaire_vise, school_id on public.athletes
  for each row execute function public.programme_universitaire_vise_garde();

create or replace function public.calculate_profile_completion()
 returns trigger
 language plpgsql
as $function$
DECLARE
  simplified_count INTEGER := 0;
  detailed_count INTEGER := 0;
  video_bonus INTEGER := 0;
  total INTEGER;
BEGIN
  -- TIER 1: Simplified fields (12 fields = 60%)
  IF NEW.first_name IS NOT NULL AND NEW.first_name != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.last_name IS NOT NULL AND NEW.last_name != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.date_naissance IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.genre IS NOT NULL AND NEW.genre != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.annee_diplomation IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.sport_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.position_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.numero_jersey IS NOT NULL AND NEW.numero_jersey != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.school_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.taille_pieds IS NOT NULL AND NEW.taille_pieds > 0 THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.poids_lbs IS NOT NULL AND NEW.poids_lbs > 0 THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.cote_globale_entraineur IS NOT NULL AND NEW.cote_globale_entraineur > 0 THEN simplified_count := simplified_count + 1; END IF;

  -- TIER 2: Video (15%)
  IF NEW.video_faits_saillants_url IS NOT NULL AND NEW.video_faits_saillants_url != '' THEN video_bonus := 15; END IF;

  -- TIER 3: Detailed fields (10 fields = 25%)
  IF NEW.moyenne_generale IS NOT NULL AND NEW.moyenne_generale > 0 THEN detailed_count := detailed_count + 1; END IF;
  -- Programme CEGEP vise — REPLI T1 : la nouvelle colonne compte, et
  -- l'ancienne continue de compter tant qu'elle n'est pas videe (T3).
  -- Retirer la seconde branche EN MEME TEMPS que le vidage, jamais avant.
  -- Cégépien sous lancement_universitaire ON (20261029160000) : le programme UNIVERSITAIRE visé
  -- remplace le programme CÉGEP visé, que son profil ne montre plus. Sinon, règle inchangée.
  IF NEW.school_id IS NOT NULL AND public.lancement_universitaire_actif()
     AND nexus_prive.est_ecole_cegep(NEW.school_id) THEN
    IF NEW.programme_universitaire_vise IS NOT NULL AND NEW.programme_universitaire_vise != ''
    THEN detailed_count := detailed_count + 1; END IF;
  ELSIF cardinality(NEW.programmes_vises) > 0
     OR (NEW.programme_cegep_vise IS NOT NULL AND jsonb_array_length(NEW.programme_cegep_vise::jsonb) > 0)
  THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.matieres_fortes IS NOT NULL AND jsonb_array_length(NEW.matieres_fortes::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.notes_coach IS NOT NULL AND NEW.notes_coach != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.envergure IS NOT NULL AND NEW.envergure != '' THEN detailed_count := detailed_count + 1; END IF;
  IF (NEW.test_40_verges IS NOT NULL OR NEW.saut_vertical IS NOT NULL OR NEW.saut_longueur IS NOT NULL OR NEW.developpe_couche IS NOT NULL OR NEW.navette_agilite IS NOT NULL OR NEW.sprint_100m IS NOT NULL) THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.photo_url IS NOT NULL AND NEW.photo_url != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.bio IS NOT NULL AND NEW.bio != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.mentions_academiques IS NOT NULL AND jsonb_array_length(NEW.mentions_academiques::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.regions_cegep_preferees IS NOT NULL AND jsonb_array_length(NEW.regions_cegep_preferees::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;

  total := ROUND((simplified_count::NUMERIC / 12) * 60) + video_bonus + ROUND((detailed_count::NUMERIC / 10) * 25);
  IF total > 100 THEN total := 100; END IF;

  NEW.profile_completion := total;

  -- (Removed in Phase A 2026-05-04: auto-verify block that flipped
  --  NEW.verified := TRUE / NEW.verification_method := 'auto' /
  --  NEW.verified_at := NOW() when total >= 60. Verification is now
  --  100% explicit human consent — no server-side auto-elevation.)

  RETURN NEW;
END;
$function$;
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.calculate_profile_completion()'::regprocedure)
     is distinct from '7ac5adb821b7f8b04bdf21617a008932' then
    raise exception 'NEXUS: nouveau corps de calculate_profile_completion inattendu';
  end if;
end $$;
