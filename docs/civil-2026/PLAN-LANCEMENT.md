# Import civil 2026-27 — plan du jour du lancement

Décisions BP 2026-10-27 : les lots 3 à 5 partent en prod **le jour du lancement seulement**, juste avant ON ;
pas de masque RLS ; le verrou du lot 7 tient les équipes importées fermées tant que `lancement_civil` est OFF.

## Avant le jour J
- Lot 7 en prod (migration `20261027150000`, `lot7/prod/COMMANDES.md`) : interrupteur OFF, verrou en place.
- Web fusionné et déployé (interrupteur OFF : les destinations 18+ restent cachées).
- Lot 8 (mobile) livré dans la **1.4.6** et publiée sur les deux magasins (sélecteur filtré, destinations 18+,
  vocabulaire et ordre des divisions côté mobile).
- Lots 3, 4 et 5 prouvés en local sur la base mise dans l'état de la prod, fichiers psql prêts (md5 notés).

## Jour J, dans cet ordre (une seule session en prod)
1. Relevé prod en lecture seule : `lancement_civil` = false, 0 ligne dans `equipes_sources`, dernière version.
2. Lot 3 (équipes -18), lot 4 (équipes 18+), lot 5 (matchs à venir + terrains géocodés) : psql, chaque fichier
   md5 vérifié, Tee-Object, contrôles après chaque lot. Le verrou refuse toute inscription dans ces équipes.
3. **Force update vers la 1.4.6, AVANT d'ouvrir** (décision BP 2026-10-27, point 4) : dans /admin/settings,
   `min_version_ios` et `min_version_android` = `1.4.6` (et `suggested_version_*` = `1.4.6`), puis
   `force_update_enabled` = `true`. Vérifier qu'une 1.4.5 voit l'écran bloquant.
4. **Puis** `lancement_civil` → `true` dans /admin/settings.
5. Contrôles après ON : un athlète rejoint une équipe importée (web et 1.4.6) ; les destinations 18+ et le
   filtre Type apparaissent dans Trouve ton cégep ; le cœur sur un club s'ajoute à « Mes cibles ».

## Retour arrière
- Fermer : `lancement_civil` → `false` (le verrou reprend aussitôt ; les rattachements déjà faits restent).
- Lot 3 : son rollback refuse dès qu'une équipe créée a une ligne liée (athlète, coach, match…). Lots 4 et 5 : même règle, à écrire.
