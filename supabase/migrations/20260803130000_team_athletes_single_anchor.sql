-- ============================================================================
-- M2 — team_athletes : ancrage UNIQUE STRICT (une seule équipe par athlète)
--
-- CE QUI CHANGE. 20260726123000_team_athletes_one_per_sport.sql avait posé
-- UNIQUE (athlete_id, sport_id) : « une équipe par sport, multi-sport permis ».
-- La décision produit du transfer portal renverse cette prémisse — un athlète
-- a UN SEUL rattachement actif, tous sports confondus. Le multi-sport ne
-- disparaît pas : il redescend dans athletes.parcours_equipes (saisie
-- manuelle, déclaratif façon LinkedIn), là où il ne pilote plus ni le roster,
-- ni le calendrier, ni l'ancrage school_id.
--
-- Conséquence directe : le changement d'école, la montée au CÉGEP, la nouvelle
-- saison et le changement de sport deviennent LE MÊME geste — un transfert —
-- servi par une seule fonction (apply_team_attachment, M3).
--
-- VÉRIFICATION AVANT ÉCRITURE (cloud, lecture seule, 2026-08-03) :
--   5 lignes, 5 athlètes distincts, 0 athlète sur plusieurs équipes,
--   0 doublon (team_id, athlete_id).
-- Aucun nettoyage de données n'est nécessaire. Le bloc DO ci-dessous refait la
-- vérification À L'INTÉRIEUR de la transaction de migration : si une ligne
-- concurrente est apparue entre le diagnostic et l'apply, la migration s'arrête
-- au lieu d'échouer à moitié sur un ADD CONSTRAINT.
--
-- ── POURQUOI UNIQUE (team_id, athlete_id) EST CONSERVÉE ─────────────────────
-- Elle est logiquement redondante (deux lignes de même paire impliqueraient
-- deux lignes de même athlete_id, déjà impossibles). Elle est néanmoins
-- CONSERVÉE, pour une raison concrète et non esthétique :
--   public.apply_team_invitation_acceptance() — trigger vivant sur
--   team_invitations — contient
--       INSERT INTO team_athletes (...) ON CONFLICT (team_id, athlete_id) DO NOTHING
--   ON CONFLICT exige un index unique correspondant EXACTEMENT aux colonnes
--   citées. La dropper ferait échouer ce trigger avec
--   « there is no unique or exclusion constraint matching the ON CONFLICT
--   specification » à la première acceptation d'invitation.
-- Réécrire ce trigger est hors périmètre de la phase 1 ; il sera de toute façon
-- réacheminé vers apply_team_attachment en phase 2, et c'est à ce moment-là que
-- la contrainte redondante pourra tomber.
--
-- ── EFFET DE BORD ASSUMÉ, À TRAITER EN PHASE 2 ──────────────────────────────
-- Les trois chemins d'INSERT direct dans team_athletes qui avalent 23505
-- (onboarding web, onboarding mobile, écran équipe du coach) et le trigger
-- ci-dessus vont désormais BUTER sur cette contrainte quand l'athlète est déjà
-- ancré ailleurs : leur ON CONFLICT / leur catch ne couvre pas
-- team_athletes_athlete_id_key. C'est le comportement voulu — un rattachement
-- silencieux qui écrasait l'ancrage devient un refus explicite — mais il faut
-- que la phase 2 les fasse tous passer par apply_team_attachment, qui sait
-- transférer au lieu de refuser.
-- ============================================================================

-- ── Garde-fou : aucune donnée existante ne doit violer la nouvelle règle ────
DO $$
DECLARE
  v_viol int;
BEGIN
  SELECT count(*) INTO v_viol
  FROM (
    SELECT athlete_id
    FROM public.team_athletes
    GROUP BY athlete_id
    HAVING count(*) > 1
  ) x;

  IF v_viol > 0 THEN
    RAISE EXCEPTION 'M2 ABORT : % athlete(s) rattache(s) a plusieurs equipes — resoudre les doublons AVANT de poser UNIQUE (athlete_id).', v_viol;
  END IF;
END $$;

-- ── Nouvelle contrainte AVANT le drop de l'ancienne ─────────────────────────
-- Ordre volontaire : à aucun instant de la transaction la table n'est sans
-- garde-fou d'unicité côté athlète.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.team_athletes'::regclass
      AND conname  = 'team_athletes_athlete_id_key'
  ) THEN
    ALTER TABLE public.team_athletes
      ADD CONSTRAINT team_athletes_athlete_id_key UNIQUE (athlete_id);
  END IF;
END $$;

-- ── Ancienne règle « une équipe par sport » ─────────────────────────────────
-- C'est un CREATE UNIQUE INDEX nu (pas une contrainte) : DROP INDEX suffit.
DROP INDEX IF EXISTS public.team_athletes_athlete_sport_uidx;

-- ── Documentation ───────────────────────────────────────────────────────────
COMMENT ON CONSTRAINT team_athletes_athlete_id_key ON public.team_athletes IS
  'ANCRAGE UNIQUE STRICT : un athlete = UN SEUL rattachement d''equipe actif, '
  'tous sports confondus. Remplace UNIQUE (athlete_id, sport_id). Le '
  'multi-sport vit dans athletes.parcours_equipes (saisie manuelle). Tout '
  'changement d''equipe passe par public.apply_team_attachment.';

COMMENT ON COLUMN public.team_athletes.sport_id IS
  'Copie denormalisee de teams.sport_id, maintenue par les triggers '
  'team_athletes_set_sport_id_trg et teams_resync_athlete_sport_id_trg. '
  'Ne portait UNIQUE (athlete_id, sport_id) que jusqu''au transfer portal : '
  'l''unicite est desormais sur athlete_id seul. La colonne reste utile pour '
  'filtrer un roster par sport sans jointure. Ne jamais l''ecrire '
  'directement : passer par team_id.';
