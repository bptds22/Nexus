# Alias Ultimate dans matchs_recherche — relevés (2026-10-09, GO BP)

Migration `20261009151209_matchs_recherche_alias_ultimate` · rollback
`supabase/rollback/20261009151209_rollback_matchs_recherche_alias_ultimate.sql`.
Mesure : `compter.sql` (vraie RPC, recruteur Pro, tous types, toutes dates à venir).

| | md5 de la fonction | ACL |
|---|---|---|
| avant (local = prod) | `144b250665c1db48d45c6bdee414ebd9` | `{postgres, authenticated, service_role}` |
| après (local = prod) | `e11baa87dedf0a43677cfddb863770f2` | inchangée |
| après rollback (local) | `144b250665c1db48d45c6bdee414ebd9` | inchangée |

Seules les lignes Ultimate bougent ; les 24 autres (dont « tous sports ») sont identiques.

| Sport | Local avant | Local après | Prod avant | Prod après |
|---|---|---|---|---|
| Ultimate frisbee | 32 | **47** | 32 | **47** |
| Ultimate (libellé brut) | 15 | 47 | 15 | 47 |
| (tous sports) | 3021 | 3021 | 9839 | 9839 |
| Basketball | 578 | 578 | 3459 | 3459 |
| Volleyball | 1148 | 1148 | 2585 | 2585 |
| Futsal | 39 | 39 | 1748 | 1748 |
| Flag football | 553 | 553 | 1026 | 1026 |
| Football | 423 | 423 | 629 | 629 |
| Soccer | 194 | 194 | 231 | 231 |
| Rugby | 24 | 24 | 85 | 85 |
| Baseball | 15 | 15 | 23 | 23 |
| 15 autres sports du menu | 0 | 0 | 0 | 0 |

Rollback testé en local : comptes identiques à « avant », md5 d'origine.
