-- ═══════════════════════════════════════════════════════════════════════
-- PARTENAIRES — image de carte bord à bord (distincte du logo)
-- ═══════════════════════════════════════════════════════════════════════
--
-- `logo_url` porte une MARQUE : un logo sur fond transparent, qu'on centre
-- dans le créneau avec du remplissage autour (plafonds 65 % / 78 %).
--
-- `card_image_url` porte une COMPOSITION FINIE : l'image remplit la carte
-- bord à bord, coins arrondis compris. Le logo y est déjà intégré.
--
-- ── POURQUOI UNE COLONNE ET NON UN TRAITEMENT CONDITIONNEL ────────────
-- Réutiliser `logo_url` avec un rendu qui dépend du `tier` aurait fait
-- dépendre l'AFFICHAGE d'un champ sans rapport avec le CONTENU. Trois
-- conséquences concrètes :
--   1. Un OFFICIEL rétrogradé en MAJEUR verrait sa composition pleine
--      carte recentrée avec du remplissage — ou tronquée par max-width.
--   2. Un MAJEUR qui fournirait une image de carte ne pourrait pas s'en
--      servir : le rendu bord à bord serait réservé à un rang.
--   3. /partenaires/[id] et PartnerSidebar affichent le logo dans un
--      contexte carré. Une image 2,27:1 y serait illisible — et c'est
--      la raison qui décide : les deux objets doivent COEXISTER.
--
-- Cascade au rendu : card_image_url → sinon logo_url centré → sinon le
-- repli texte. Un partenaire sans image garde le comportement actuel.
--
-- ── MÊME BUCKET, MÊME GARDE ───────────────────────────────────────────
-- partner-logos accueille les deux : ses policies scopent déjà par
-- {media_partners.id}, et le chemin distingue ({id}/logo vs {id}/carte).
-- Pas de bucket à provisionner, pas de policy à écrire.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.media_partners
  ADD COLUMN IF NOT EXISTS card_image_url text;

COMMENT ON COLUMN public.media_partners.card_image_url IS
  'Composition finie qui REMPLIT la carte du bandeau, bord à bord (logo '
  'intégré). Distincte de logo_url, qui est une marque centrée avec du '
  'remplissage. Ratio attendu 2,27:1 (ex. 1360x600) pour un créneau '
  'OFFICIEL de 340x150. Prioritaire sur logo_url au rendu du bandeau ; '
  'les surfaces carrées (/partenaires/[id], PartnerSidebar) continuent '
  'de lire logo_url.';

-- Même contrainte de domaine que logo_url : sur le CHEMIN et non sur
-- l'hôte, pour que les uploads en développement local (127.0.0.1:54321)
-- ne soient pas rejetés. Empêche le collage d'une URL externe — le
-- défaut réel qui a produit le logo Facebook expiré.
ALTER TABLE public.media_partners
  DROP CONSTRAINT IF EXISTS media_partners_card_image_url_interne;
ALTER TABLE public.media_partners
  ADD CONSTRAINT media_partners_card_image_url_interne
  CHECK (card_image_url IS NULL
         OR card_image_url LIKE '%/storage/v1/object/public/partner-logos/%');

-- ── PLAFOND DU BUCKET : 512 Ko -> 1 Mo ────────────────────────────────
-- MESURÉ, pas supposé. Le fichier de L'Esprit Sportif (1360x600, 864 Ko
-- à la source) retombe à ~372 Ko une fois ré-encodé à sa taille native.
-- Ça passe sous 512 Ko — mais la mesure vient d'un encodeur hors
-- navigateur, et `canvas.toBlob` compresse moins bien. 28 % de marge est
-- trop mince pour un chemin dont l'échec est silencieux côté bucket.
--
-- Le plafond du bucket redevient ce qu'il doit être : un FILET EXTÉRIEUR
-- contre un client qui contournerait le helper. Le vrai plafond par usage
-- reste dans l'appel — 512 Ko pour un logo, 900 Ko pour une image de
-- carte — où l'échec produit un message lisible plutôt qu'un rejet muet.
UPDATE storage.buckets
   SET file_size_limit = 1048576
 WHERE id = 'partner-logos';
