-- ═══════════════════════════════════════════════════════════════
-- 500.A1 — la vedette repasse en français.
--
-- CE QUI S'ÉTAIT PASSÉ
-- La règle ⑤ a envoyé « Arts, lettres et communication » nu chez
-- 500.1E (4 écoles) plutôt que 500.A1 (1). Il restait à 500.A1 deux
-- libellés à UNE école chacun : « Arts, lettres et communication Xtra »
-- et « Arts, Literature and Communication ». L'égalité 1-1 a été
-- tranchée par ordre alphabétique — et c'est l'anglais qui est sorti.
-- Un nom canonique national décidé par un tri alphabétique n'est pas
-- une décision, c'est un accident.
--
-- CE QU'ON NE FAIT PAS
-- Pas de fusion 500.A1 → 500.1E : la question « meme programme MEQ ou
-- non ? » demande une source externe, comme 200.B0/200.B1. Trois
-- colleges prives, impact faible, on attend.
--
-- POURQUOI « Xtra » ET PAS « Arts, lettres et communication »
-- Le libelle nu est deja pris par 500.1E, et l'index unique sur
-- lower(label) l'interdit — c'est precisement l'invariant qui empeche
-- deux entrees identiques dans le selecteur. On promeut donc le
-- libelle francais REEL qui existe deja sous ce code, plutot que
-- d'inventer une chaine ou de coller un code MEQ derriere un nom
-- (la bequille technique servie a un ado, ecartee par la decision 6).
-- « Arts, Literature and Communication » reste CHERCHABLE : un eleve
-- de Marianopolis qui tape « Literature » trouve toujours son entree.
--
-- EN DEUX TEMPS, PAS EN UN
-- cegep_program_labels_vedette_uidx est un index unique partiel non
-- deferrable : un UPDATE unique qui pose la nouvelle vedette avant
-- d'effacer l'ancienne viole la contrainte EN COURS d'instruction.
-- On efface d'abord, on pose ensuite.
-- ═══════════════════════════════════════════════════════════════

UPDATE public.cegep_program_labels l
   SET is_vedette = false
  FROM public.cegep_programs p
 WHERE p.id = l.program_id AND p.code = '500.A1' AND l.is_vedette;

UPDATE public.cegep_program_labels l
   SET is_vedette = true
  FROM public.cegep_programs p
 WHERE p.id = l.program_id AND p.code = '500.A1'
   AND lower(l.label) = 'arts, lettres et communication xtra';

UPDATE public.cegep_programs p
   SET nom_canonique = (SELECT l.label FROM public.cegep_program_labels l
                         WHERE l.program_id = p.id AND l.is_vedette)
 WHERE p.code = '500.A1';

DO $$
DECLARE v text; n integer;
BEGIN
  SELECT nom_canonique INTO v FROM public.cegep_programs WHERE code = '500.A1';
  IF v IS DISTINCT FROM 'Arts, lettres et communication Xtra' THEN
    RAISE EXCEPTION 'NEXUS: vedette 500.A1 inattendue apres renommage : %', v;
  END IF;

  -- L'invariant global reste vrai : une vedette par programme, aucun orphelin.
  SELECT count(*) INTO n FROM public.cegep_programs p
   WHERE NOT EXISTS (SELECT 1 FROM public.cegep_program_labels l
                      WHERE l.program_id = p.id AND l.is_vedette);
  IF n > 0 THEN
    RAISE EXCEPTION 'NEXUS: % programme(s) sans vedette apres renommage', n;
  END IF;
END $$;
