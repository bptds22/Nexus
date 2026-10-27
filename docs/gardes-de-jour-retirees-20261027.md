# Gardes de jour retirées des rollbacks et des gabarits — 2026-10-27

Décision de BP (27 oct.) : il n'y a **aucune** règle de jour (« pas le mardi, ni le
mercredi avant midi / avant 5 h ») ; c'était une erreur. Les gardes sont retirées des
fichiers de **rollback** et des **gabarits** (`*.gabarit.sql`). Les fichiers d'apply déjà
exécutés en prod (`apply-2026102x.sql`) ne sont **pas** touchés : ils restent la trace
exacte de ce qui a tourné.

Seule garde gardée : « pas le mercredi avant midi » (veille RSEQ collégiale du mercredi
3 h 55), dans les gabarits d'apply qui figent des comptes de matchs (côtés domicile /
visiteur) : lots 192 et 12. Aucun autre bloc n'a changé ; les gardes md5 internes des
rollbacks portent sur leur texte embarqué, qui n'a pas bougé.

md5 du fichier en LF (contenu du blob git, `git show main:<fichier> | md5sum`) :

| Fichier | md5 avant | md5 après | Changement |
|---|---|---|---|
| docs/cegep-equipes-12/prod/rollback-20261026.sql | 647244e763818c8e9186daa23823abf6 | 3f03ecbf8888abd83828c50fa1f2056c | garde de jour retirée |
| docs/cegep-equipes-12/prod/rollback.gabarit.sql | a054b5b04a1985dfc6f1347508797188 | b3f36aac766f858ef8e69d3d8f9ae6ab | garde de jour retirée |
| docs/cegep-equipes-12/prod/apply.gabarit.sql | 67964fa99de73808782140702fbe4db0 | 59835c4539910fd924ca514723425212 | mercredi midi seulement |
| docs/cegep-equipes-192/prod/rollback-20261026.sql | 63741eb52444ee3d7f2c65c77663b02c | d5ebde6757cdd182485a5153f34642c5 | garde de jour retirée |
| docs/cegep-equipes-192/prod/rollback.gabarit.sql | f8e17efe7c5134b7bb5a44a86122ccc6 | dc2fc3a85845690bbcf330595183fa2c | garde de jour retirée |
| docs/cegep-equipes-192/prod/apply.gabarit.sql | 0f6195b1974fb801ea9522516c2c2acf | 0f86b8007b0e49b0dad80eacf7ae7ab5 | mercredi midi seulement |
| docs/cegep-lot-a/prod/apply.gabarit.sql | c8246a2df5b70e6e4389c1d3570f8b98 | 880f05224b56fe5de4193586ecdeaf72 | garde de jour retirée |
| docs/cegep-lot-b2/prod/rollback-20261026.sql | ff451ea7f5071674f9c9ffadc230d342 | acae325f31ba51f1ff290b719889b7a3 | garde de jour retirée |
| docs/cegep-lot-b2/prod/rollback.gabarit.sql | 9862d1f9df0695bd4edeb7a432bb3c2a | 277ca6f8b015db3072f1e870aa26a15f | garde de jour retirée |
| docs/cegep-lot-b2/prod/apply.gabarit.sql | 52b524804686f0b1b6f78a2bf73ddf4b | 93c7cb3ca48ef8924c66e65f93a9fa09 | garde de jour retirée |
| docs/cegep-lot-b3/prod/rollback-20261026.sql | 5a825393b681b68a5871beb306e79b7b | 138b2b813b586b76bf75f3777426ae1e | garde de jour retirée |
| docs/cegep-lot-b3/prod/rollback.gabarit.sql | 59af476718ab9c77efe4835dd7d0eb5a | eb62686b196111d101be54bb52263163 | garde de jour retirée |
| docs/cegep-lot-b3/prod/apply.gabarit.sql | a5f8f8bf3dd83f37d45e8a67b76d0b56 | 0faba25008cbdea1b4bed8465bf2abe3 | garde de jour retirée |

Le md5 « avant » du rollback B3 est celui cité dans `docs/cegep-lot-b3/preuves-locales-20261026.txt`
(sortie historique, non modifiée).

**Lancer un rollback** : prendre la version de main, en LF (une copie CRLF du checkout
Windows est refusée par les gardes md5 internes) :

```
git show main:docs/cegep-lot-b3/prod/rollback-20261026.sql > rollback-b3.sql
```

Les worktrees des lots (`C:\tmp\nexus-cegep-*`) gardent l'ancienne version, avec la
garde de jour : ne plus les utiliser pour un rollback.
