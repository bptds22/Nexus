# Preuves — lot 1 cartes (migration 20261007193918, base LOCALE)

Ordre (docker exec depuis l'outil **PowerShell**, `docker cp` puis `psql -f`) :

1. `1-fixtures.sql` — six athlètes adultes fictifs `77770000-…` (équipe Les Estacades, football).
2. `node 2-preuve-rest.mjs creer` — 11 cartes créées par PostgREST sous JWT du recruteur Pro `…003a`.
   Exige `SUPABASE_ANON_KEY` (ou `anon.txt` à côté du script).
3. `3-rapprochements.sql` — candidats, file évaluée, fusion simulée de « Hugo Fusionpreuve ».
4. `node 2-preuve-rest.mjs invitations` puis `4-invitations-etat.sql`.
5. `5-rollback-en-transaction.sql` et `6-non-regression-en-transaction.sql` — tout en `BEGIN … ROLLBACK` :
   n'efface rien de la base locale.

Le 5 et le 6 incluent le rollback par copie : régénérer s'il change.
Nettoyage : supprimer les invitations, puis les cartes `nom like '%preuve' or nom = 'Prevost'`, puis les athlètes `77770000-%`.

## Signataire et ordre de déploiement (7-preuve-signataire.mjs)

`SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` exigés ; lancer avec
`node --experimental-strip-types`. Resend est SIMULÉ (aucun courriel ne part).
- `creer <suffixe> ajout|creation` puis `envoyer supabase/functions/send-invitation-carte/traiter.ts`, puis `etat`.
- Base d'abord : `envoyer` avec l'ANCIENNE traiter.ts (`git show d8bd42ed:…/traiter.ts`,
  copiée À CÔTÉ de traiter.ts pour ses imports relatifs, supprimée après).
- Edge d'abord : appliquer le rollback, `creer … creation`, `reclamation-naive`
  (variante écartée : 42703, ligne restée A_ENVOYER), puis `envoyer` (nouvelle).
  Ré-appliquer la migration ensuite.
