-- ═══════════════════════════════════════════════════════════════════════
-- VITRINE — profil de démonstration entièrement visible aux non-payants
-- ═══════════════════════════════════════════════════════════════════════
--
-- Un unique athlète fictif est rendu IDENTIFIÉ pour tout recruteur, quel
-- que soit son palier, afin de montrer ce que le paywall masque. Il est
-- signalé à l'écran par le ruban « PROFIL DÉMO » (components/shared/
-- DemoRibbon.tsx) : personne ne doit croire contacter un vrai athlète.
--
-- ── CE QUE LE DRAPEAU DÉTEND, ET CE QU'IL NE DÉTEND PAS ───────────────
-- Le masquage d'identité des 3 RPC recruteur est UNE expression, répétée :
--
--   athlete_identity_ok(date_naissance, consentement_parental)  AND  v_tier_ok
--   └──────────── moitié LOI 25 ────────────┘                        └ PAIEMENT ┘
--
-- `is_showcase` ne touche QUE la moitié droite :
--
--   ... AND (v_tier_ok OR a.is_showcase)
--
-- La moitié Loi 25 reste intacte et conjonctive. Un mineur sans
-- consentement parental resterait masqué même marqué vitrine.
--
-- ── LA LIGNE ROUGE : LES COORDONNÉES ──────────────────────────────────
-- Le drapeau ne peut PAS exposer un courriel ni un téléphone, et ce n'est
-- pas une promesse : aucune des 3 RPC ne PROJETTE ces colonnes. Il n'y a
-- rien à mettre à NULL, donc rien qu'un drapeau puisse rallumer. Pour
-- exposer un contact il faudrait AJOUTER une colonne à la projection —
-- pas lever un drapeau.
--
-- ── PORTÉE VOLONTAIREMENT ABSENTE ─────────────────────────────────────
-- `is_showcase` n'est PAS projeté par les RPC dans cette migration :
-- changer un RETURNS TABLE impose DROP + CREATE et la reprise de tous les
-- GRANT sur trois fonctions de chemin chaud. Le front porte encore son
-- repli par identifiant (lib/showcase.ts). Projeter la colonne — et
-- supprimer ce repli — est un second temps, sans urgence.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. LE DRAPEAU ──────────────────────────────────────────────────────
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS is_showcase boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.athletes.is_showcase IS
  'Profil vitrine : identité visible par TOUT recruteur, quel que soit le '
  'palier. Ne détend jamais la Loi 25 ni les coordonnées. Écriture réservée '
  'aux admins (trigger trg_is_showcase_admin_seul). Un seul true possible '
  '(index athletes_is_showcase_unique).';

-- ── 2. UNE SEULE VITRINE, JAMAIS DEUX ─────────────────────────────────
-- Un index unique partiel plutôt qu'un CHECK : il dit la règle au moteur,
-- qui la fait respecter même si l'écriture passe par un chemin imprévu.
CREATE UNIQUE INDEX IF NOT EXISTS athletes_is_showcase_unique
  ON public.athletes ((true)) WHERE is_showcase;

-- ── 3. GARDE-FOU D'ÉCRITURE — SANS LUI LE DRAPEAU EST UNE FAILLE ──────
-- La policy « coaches can update own athletes » laisse un entraîneur
-- écrire sur ses athlètes. Sans ce trigger, il pourrait poser is_showcase
-- sur un VRAI mineur et démasquer son identité pour tous les Free.
CREATE OR REPLACE FUNCTION public.enforce_is_showcase_admin_seul()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.is_showcase IS DISTINCT FROM OLD.is_showcase
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'NEXUS: le drapeau vitrine (is_showcase) est réservé aux administrateurs'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_is_showcase_admin_seul ON public.athletes;
CREATE TRIGGER trg_is_showcase_admin_seul
  BEFORE UPDATE OF is_showcase ON public.athletes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_is_showcase_admin_seul();

-- ── 4. BLACKOUT RSEQ — LA VITRINE EN EST EXEMPTÉE (arbitrage Q4) ──────
-- Un profil fictif n'a aucune intégrité de recrutement à protéger. Écrit
-- ICI plutôt que dans is_messaging_blacked_out : get_active_blackout est
-- la source unique, et l'exemption se propage donc d'un coup au trigger
-- enforce_messaging_blackout ET au bandeau front (useAthleteContactable).
CREATE OR REPLACE FUNCTION public.get_active_blackout(p_athlete uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, libelle text, date_debut date, date_fin date, sport_nom text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select b.id, b.libelle, b.date_debut, b.date_fin, s.nom
  from public.blackout_periods b
  left join public.athletes a on a.id = p_athlete
  left join public.sports   s on s.id = b.sport_id
  where b.actif
    and coalesce(a.is_showcase, false) = false
    and (now() at time zone 'America/Montreal')::date between b.date_debut and b.date_fin
    and (b.sport_id is null or a.sport_id is null or a.sport_id = b.sport_id)
    and (
          (b.promo_min is null and b.promo_max is null)
       or a.annee_diplomation is null
       or (    (b.promo_min is null or a.annee_diplomation >= b.promo_min)
           and (b.promo_max is null or a.annee_diplomation <= b.promo_max))
    )
  order by b.date_fin desc, b.date_debut asc
  limit 1;
$function$;
