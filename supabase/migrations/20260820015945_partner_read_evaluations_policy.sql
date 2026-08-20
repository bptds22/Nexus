-- 20260820015945_partner_read_evaluations_policy
--
-- Appliquee en PROD le 2026-08-19 via MCP apply_migration (jamais db push).
-- Le nom de ce fichier reprend la version REELLE stampee par apply_migration —
-- qui pose son propre horodatage, different de celui qu'on choisirait. Chercher
-- toujours par `name` dans schema_migrations, jamais par `version`.
--
-- ── POURQUOI ─────────────────────────────────────────────────────────────────
-- Point 1 du chantier RLS partenaire. PREREQUIS de la restauration de
-- top_athletes_view en security_invoker (migration 20260820020025) : sous
-- INVOKER, la RLS de chaque table de base s'applique, et `evaluations` n'avait
-- AUCUNE branche partenaire.
--
-- Le nom de la policy existante trompe : « authenticated read evaluations »
-- qualifie le ROLE POSTGRES, pas le perimetre. Son corps est une disjonction de
-- roles nommes — coach proprietaire, directeur d'ecole, coach_can_read_athlete_evals,
-- recruteur sur athlete actif, athlete lui-meme, admin. Aucune branche partenaire.
-- Le §D du dossier concluait « la RLS suffit » sur cette lecture erronee ; le
-- §4-bis le corrige.
--
-- Sans cette policy, passer la vue en INVOKER aurait produit une panne MUETTE :
-- le LEFT JOIN LATERAL sur evaluations rend 0 ligne, donc `distinctions` tombe a
-- NULL — l'athlete reste affiche (LEFT JOIN), mais les badges disparaissent et le
-- filtre « Avec distinction » de /partenaire/athletes rend zero resultat. Aucune
-- erreur, aucun log, aucun code HTTP anormal. Un test de fumee passerait.
--
-- ── FORME : policy SEPAREE, pas un ALTER de l'existante ──────────────────────
-- Les policies permissives d'une meme commande sont OR'ees. Ajouter la notre a
-- cote n'altere AUCUN chemin existant et se retire d'un seul DROP. Modifier
-- « authenticated read evaluations » aurait mis en jeu les quatre roles qu'elle
-- sert, pour un gain nul.
--
-- ── ELARGISSEMENT ASSUME ET TEMPORAIRE ───────────────────────────────────────
-- Une policy RLS est par LIGNE, jamais par colonne, et un GRANT colonne ne peut
-- pas cibler les partenaires (ils partagent le role `authenticated` avec les
-- entraineurs et les recruteurs). Il n'existe donc AUCUN moyen d'ouvrir
-- `distinctions` sans ouvrir `rapport_entraineur`.
--
-- Consequence : components/shared/AthleteRecruiterProfileBody.tsx embarque
-- evaluations avec 18 colonnes (14 traits + cote_globale + rapport_entraineur +
-- distinctions + updated_at). Rendu avec viewerMode="partner" sur
-- /partenaire/athletes/[id], cet embed etait VIDE ; il ne l'est plus.
--
-- Arbitrage de BP (2026-08-19) : increment acceptable sur une porte deja ouverte
-- — le meme ecran lit deja 87 colonnes de `athletes` en direct — a CONDITION que
-- la projection RPC (point 5) suive sans delai. Si le point 5 devait etre
-- reporte, ANNULER cette policy plutot que laisser la fenetre ouverte :
--
--   drop policy "approved partners read evaluations of eligible athletes"
--     on public.evaluations;
--
-- ── PREUVE RUNTIME, EN PROD ──────────────────────────────────────────────────
-- Le local N'EST PAS un terrain de preuve valable ici : cinq des six migrations
-- de securite des vues y manquent, il est donc PLUS permissif que la prod
-- (dossier §4-ter). Tous les tests ci-dessous ont tourne en prod via
-- `set local role authenticated` + `request.jwt.claims`.
--
-- Fixture : 5 evaluations — 3 sur 2 athletes eligibles, 2 sur des non-eligibles.
--
--   | test | sujet                          | avant | apres |
--   |------|--------------------------------|-------|-------|
--   | 1.a  | partenaire lespritsportifmedia |     0 |     3 |
--   | 1.b  | athletes distincts lus         |     — |     2 |
--   | 1.c  | toutes sur athletes eligibles  |     — |  true |  <- les 2 non-eligibles restent invisibles
--   | 1.d  | partenaire bpdesfosses         |     0 |     3 |  <- c'est le ROLE qui ouvre, pas le compte
--   | 1.e  | coach caguitard@outlook.com    |     1 |     1 |  <- non-regression
--   | 1.f  | recruteur abdellalimhazzab     |     5 |     5 |  <- non-regression
--
-- Voir docs/security-definer-partner-views-investigation-20260706.md §4-bis.

create policy "approved partners read evaluations of eligible athletes"
  on public.evaluations
  for select
  to authenticated
  using (
    -- is_approved_partner IGNORE son argument : il lit auth.uid() en interne
    -- (verrouille par f6_c2_lock_parameterized_helpers_to_auth_uid). L'argument
    -- est passe pour rester coherent avec les deux vues partenaires, qui
    -- ecrivent deja is_approved_partner(auth.uid()).
    public.is_approved_partner((select auth.uid()))
    -- Celui-ci utilise bien son argument : opt-in partenaire ET (18 ans OU
    -- consentement parental). SECURITY DEFINER, row_security off.
    and public.is_partner_eligible_athlete(athlete_id)
  );

comment on policy "approved partners read evaluations of eligible athletes"
  on public.evaluations is
$c$Ajoutee 2026-08-19. PREREQUIS de la restauration de top_athletes_view en
security_invoker : sans elle, le LEFT JOIN LATERAL sur evaluations rend 0 ligne
pour un partenaire et TOUTES les distinctions tombent a NULL en silence — pas
d'erreur, pas d'ecran vide, un test de fumee passerait.

Portee volontairement limitee aux athletes partenaire-eligibles
(is_partner_eligible_athlete : opt-in ET 18 ans OU consentement parental).

ELARGISSEMENT ASSUME ET TEMPORAIRE : une policy RLS est par LIGNE, jamais par
colonne, et un GRANT colonne ne peut pas cibler les partenaires (ils partagent
le role authenticated). Cette policy rend donc lisibles les 18 colonnes de
evaluations — dont rapport_entraineur — sur /partenaire/athletes/[id], qui les
embarque deja dans sa requete. La fenetre se referme avec la projection RPC
(point 5 du chantier RLS partenaire), tenue pour OBLIGATOIRE. Si ce point 5
devait etre reporte, ANNULER cette policy plutot que laisser la fenetre ouverte.

Voir docs/security-definer-partner-views-investigation-20260706.md, section 4-bis.$c$;
