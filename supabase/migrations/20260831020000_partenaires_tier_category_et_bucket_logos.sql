-- ═══════════════════════════════════════════════════════════════════════
-- PARTENAIRES — hiérarchie d'affichage et logos hébergés chez nous
-- ═══════════════════════════════════════════════════════════════════════
--
-- Deux choses, indissociables :
--
--  1. Un RANG (`tier`) et une ÉTIQUETTE libre (`category`), pour que la
--     page d'accueil cesse d'afficher tous les partenaires au même
--     niveau. `tier` est fermé et nous appartient ; `category` est du
--     texte saisi par l'admin, purement d'affichage.
--
--  2. La fin des URL de logo EXTERNES. Le seul logo en production était
--     une URL Facebook signée, expirée le 2026-08-17 — HTTP 403 depuis.
--     La page d'accueil n'affichait donc plus aucun logo, seulement le
--     repli texte. Réparer l'URL ne servirait à rien : c'est le champ
--     qui accepte n'importe quelle URL qu'il faut fermer.
--
-- ── POURQUOI text + CHECK ET NON UN ENUM POSTGRES ─────────────────────
-- C'est le précédent de cette table : `media_partners_status_check` fait
-- déjà exactement ça pour `status`. Ajouter une valeur à un CHECK est un
-- ALTER ; en retirer une d'un type enum impose de recréer le type.
--
-- ── POURQUOI LES LIMITES SONT SUR LE BUCKET ───────────────────────────
-- `lib/upload/uploadImage.ts` valide, redimensionne et plafonne — mais il
-- tourne dans le navigateur, donc il est contournable. `file_size_limit`
-- et `allowed_mime_types` au niveau du bucket sont le seul filet que le
-- client ne peut pas sauter.
--
-- SVG volontairement EXCLU des types permis : le helper rastérise via
-- canvas (un SVG y perdrait son intérêt), et un SVG stocké tel quel peut
-- porter du script.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. LE RANG ET L'ÉTIQUETTE ─────────────────────────────────────────
ALTER TABLE public.media_partners
  ADD COLUMN IF NOT EXISTS tier     text NOT NULL DEFAULT 'PARTENAIRE',
  ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.media_partners DROP CONSTRAINT IF EXISTS media_partners_tier_check;
ALTER TABLE public.media_partners
  ADD CONSTRAINT media_partners_tier_check
  CHECK (tier IN ('OFFICIEL', 'MAJEUR', 'PARTENAIRE'));

-- 24 caractères : ce n'est pas cosmétique. `category` est un libellé
-- libre qui atterrit SOUS un logo, dans un créneau de largeur fixe. Sans
-- borne, une phrase entière casse la grille de la page d'accueil.
ALTER TABLE public.media_partners DROP CONSTRAINT IF EXISTS media_partners_category_check;
ALTER TABLE public.media_partners
  ADD CONSTRAINT media_partners_category_check
  CHECK (category IS NULL OR length(btrim(category)) BETWEEN 1 AND 24);

COMMENT ON COLUMN public.media_partners.tier IS
  'Rang d''affichage. OFFICIEL = mis en avant, grand format. MAJEUR et '
  'PARTENAIRE partagent la rangée secondaire, MAJEUR d''abord. Départage '
  'à rang égal : homepage_order, puis organization_name.';

COMMENT ON COLUMN public.media_partners.category IS
  'Étiquette d''affichage saisie par l''admin (« Média », « Ligue », '
  '« Équipementier »). Texte libre, JAMAIS de la logique : rien ne doit '
  'brancher sur sa valeur. Juxtaposée au rang, jamais accordée avec lui '
  '(« PARTENAIRE OFFICIEL · Média ») — sinon l''accord en genre casse.';

-- ── 2. LA DONNÉE ACTUELLE ─────────────────────────────────────────────
-- Doit passer AVANT la contrainte de domaine ci-dessous : la ligne porte
-- une URL Facebook que cette contrainte rejetterait.
--
-- logo_url → NULL : l'image est en 403 depuis deux semaines, la page
-- d'accueil affiche déjà le repli texte. Mettre NULL ne change donc RIEN
-- à l'écran — ça rend seulement la base honnête sur ce qu'elle possède.
-- Le fichier sera téléversé par l'admin (lot 2).
--
-- On ne rapatrie PAS l'image Facebook : elle est inaccessible, et
-- ré-héberger le visuel d'un tiers sans son accord n'est pas notre appel.
UPDATE public.media_partners
   SET tier     = 'OFFICIEL',
       category = 'Média',
       logo_url = NULL
 WHERE id = 'a749a5d3-443e-47ca-9a35-533665b278c6';  -- L'Esprit Sportif

-- ── 3. PLUS JAMAIS D'URL EXTERNE ──────────────────────────────────────
-- Contrainte sur le CHEMIN, pas sur l'hôte : le développement local sert
-- le storage depuis 127.0.0.1:54321 et le cloud depuis <ref>.supabase.co.
-- Épingler l'hôte de prod ferait échouer tout upload en local.
--
-- Portée assumée : cette contrainte empêche un collage accidentel d'URL
-- externe (le défaut réel constaté), pas un admin déterminé. L'écriture
-- est déjà réservée aux admins par la policy « Admins update all partners ».
ALTER TABLE public.media_partners DROP CONSTRAINT IF EXISTS media_partners_logo_url_interne;
ALTER TABLE public.media_partners
  ADD CONSTRAINT media_partners_logo_url_interne
  CHECK (logo_url IS NULL
         OR logo_url LIKE '%/storage/v1/object/public/partner-logos/%');

-- ── 4. LE BUCKET ──────────────────────────────────────────────────────
-- 512 Ko : un logo compressé par le helper (512 px de plus grand côté,
-- PNG) pèse quelques dizaines de Ko. 512 Ko laisse de la marge tout en
-- rendant impossible le dépôt d'une photo pleine résolution.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('partner-logos', 'partner-logos', true, 524288,
        ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public            = EXCLUDED.public,
      file_size_limit   = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 5. QUI PEUT ÉCRIRE ────────────────────────────────────────────────
-- Chemin attendu : {media_partners.id}/logo.png
--
-- Fonction plutôt que prédicat inline : le premier segment du chemin est
-- casté en uuid, et un chemin malformé ferait ÉCHOUER la policy avec une
-- erreur de cast au lieu de refuser proprement. Le bloc EXCEPTION rend
-- false. (Les policies `ma_page assets *` de school-logos ont cette
-- exposition ; on ne la reproduit pas ici.)
CREATE OR REPLACE FUNCTION public.can_write_partner_logo(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  BEGIN
    v_id := (NULLIF((storage.foldername(p_name))[1], ''))::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin() THEN
    RETURN true;
  END IF;

  -- Un partenaire peut déposer dans SON dossier, et nulle part ailleurs.
  RETURN EXISTS (
    SELECT 1 FROM public.media_partners mp
     WHERE mp.id = v_id AND mp.user_id = auth.uid()
  );
END;
$function$;

DROP POLICY IF EXISTS "partner logos read"   ON storage.objects;
DROP POLICY IF EXISTS "partner logos insert" ON storage.objects;
DROP POLICY IF EXISTS "partner logos update" ON storage.objects;
DROP POLICY IF EXISTS "partner logos delete" ON storage.objects;

-- Lecture publique : le bucket sert la page d'accueil, qui est anonyme.
CREATE POLICY "partner logos read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'partner-logos');

CREATE POLICY "partner logos insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'partner-logos' AND public.can_write_partner_logo(name));

CREATE POLICY "partner logos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'partner-logos' AND public.can_write_partner_logo(name))
  WITH CHECK (bucket_id = 'partner-logos' AND public.can_write_partner_logo(name));

CREATE POLICY "partner logos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'partner-logos' AND public.can_write_partner_logo(name));
