-- Messagerie admin — migration 3/3 : LA PROMOTION.
--
-- Les migrations 1 (valeurs d'enum) et 2 (structure) ne désignent PERSONNE :
-- send_admin_message lève « identité de service absente » tant qu'aucune ligne
-- de public.users ne porte is_service_identity. C'est l'état sûr intermédiaire,
-- voulu et documenté. Cette migration le referme.
--
-- Le compte auth lui-même est créé HORS migration (l'API auth admin ne
-- s'appelle pas depuis SQL) : equipe@nexussports.ca, rôle SERVICE, mot de
-- passe aléatoire jamais conservé. La promotion ne touche pas photo_url —
-- l'avatar sera posé dans un second temps, et NULL vaut mieux qu'une URL
-- provisoire qui traînerait.

DO $$
DECLARE
  v_id     uuid;
  v_role   public.user_role;
  v_count  int;
  v_holder uuid;
BEGIN
  ---- 1. Un AUTRE porteur ? -------------------------------------------
  -- L'index unique partiel users_service_identity_uniq ferait échouer
  -- l'UPDATE de toute façon, mais avec un message d'index illisible. Et
  -- surtout : on ne retire JAMAIS l'identité à quelqu'un d'autre en
  -- silence pour se la donner. Conflit réel, arrêt franc.
  SELECT id INTO v_holder
    FROM public.users
   WHERE is_service_identity
     AND lower(email) IS DISTINCT FROM 'equipe@nexussports.ca'
   LIMIT 1;
  IF v_holder IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: une autre ligne porte déjà is_service_identity (%) — rien n''a été promu.', v_holder
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 2. Le compte, par ADRESSE et non par UUID en dur ----------------
  -- L'UUID est généré par l'API auth : le figer ici rendrait la migration
  -- fausse partout ailleurs qu'en production. L'adresse, elle, est la même
  -- dans tous les environnements.
  SELECT count(*) INTO v_count
    FROM public.users WHERE lower(email) = 'equipe@nexussports.ca';

  IF v_count = 0 THEN
    -- PAS une erreur, et c'est délibéré : sur une base neuve (reset local,
    -- CI, nouvel environnement) le compte auth n'existe pas encore, et
    -- faire échouer la migration bloquerait tout le replay pour une étape
    -- qui est manuelle par nature.
    -- Ne rien promouvoir laisse la base dans l'état sûr de la migration 2 :
    -- send_admin_message REFUSE. Aucun message ne part sous une identité
    -- improvisée. Pour finir l'installation : créer le compte auth
    -- (equipe@nexussports.ca, user_metadata role=SERVICE) puis rejouer ce
    -- bloc.
    RAISE WARNING 'NEXUS: compte de service equipe@nexussports.ca absent — promotion NON effectuée, la messagerie admin reste fermée.';
    RETURN;
  END IF;

  IF v_count > 1 THEN
    RAISE EXCEPTION 'NEXUS: % lignes users portent equipe@nexussports.ca — ambiguïté, rien n''a été promu.', v_count
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT id, role INTO v_id, v_role
    FROM public.users WHERE lower(email) = 'equipe@nexussports.ca';

  ---- 3. Le rôle est un GARDE-FOU, pas une décoration ------------------
  -- Si un jour un humain récupère cette adresse, il ne doit pas hériter du
  -- droit d'écrire dans tous les fils ADMIN_USER.
  IF v_role <> 'SERVICE'::public.user_role THEN
    RAISE EXCEPTION 'NEXUS: le compte % porte le rôle % et non SERVICE — promotion refusée.', v_id, v_role
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 4. La promotion --------------------------------------------------
  -- auth.uid() est NULL en migration : trg_service_identity_immutable
  -- laisse passer. Le WHERE NOT is_service_identity rend le rejeu inerte.
  UPDATE public.users
     SET is_service_identity = true
   WHERE id = v_id AND NOT is_service_identity;

  RAISE NOTICE 'NEXUS: identité de service promue — %.', v_id;
END;
$$;
