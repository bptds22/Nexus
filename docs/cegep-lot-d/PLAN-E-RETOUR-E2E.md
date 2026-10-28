# Lot E — retour du test de bout en bout de BP (2026-10-28) : plan, risques, 1.4.6, questions

Règle : tout reste sous les interrupteurs (`lancement_collegial`, `lancement_universitaire`, OFF en prod). Seul E0
(bouton « Dicter ») change la prod tout de suite. Même méthode par lot : local, rejeu prod, résumé 3 lignes, GO.

## Lots (dans l'ordre proposé)

| Lot | Contenu | Base / web | Ce qui change en prod sous OFF |
|---|---|---|---|
| **E0** | D1 — retirer « Dicter » des notes (`components/shared/ChampNote.tsx`, 7 surfaces web/mobile). | web | **Le bouton disparaît** (web au Promote ; appli à la 1.4.6). |
| **E1** | Base « cibles universitaires » (A1, C3) : un cégépien cible une université (`athlete_targets`), le recruteur universitaire voit qui cible SON université ; RPC de recherche des universités pour le cégépien (C1 : sport, programme d'études, province, langue, coordonnées pour la carte). Tout exige `lancement_universitaire` ON. | base | Rien : RPC refusées / vides sous OFF, universités toujours masquées. |
| **E2** | Base « pages d'équipes universitaires » (A2) : `can_edit_team_page` ouvre l'équipe universitaire à SON recruteur universitaire sous ON (aujourd'hui admin seul, D5a). | base | Rien (personne n'est recruteur universitaire sous OFF). |
| **E3** | Base « cycle libre » (A3) : cycle = baccalauréat, certificat, maîtrise, doctorat ou autre + libellé libre ; RPC et contrôles mis à jour. | base | Rien (table lue par l'admin seul sous OFF). |
| **E4** | Web recruteur universitaire : tuile « Athlètes qui me ciblent » (A1), éditeur et page publique d'équipe `/universite/[école]/[équipe]` (A2, fanions, camps, besoins), cycle libre dans l'éditeur (A3). | web | Rien (routes 404 sous OFF, portail inaccessible). |
| **E5** | Processus de recrutement (B4, B5) : « Ajouter un prospect » à 3 types (Secondaire, Collégial, Civil) ; type de ligue de l'athlète dans le kanban, le tableau, les filtres et l'export, pour les deux recruteurs. | base (lecture du type) + web | **À trancher (Q4)** : la colonne « type » serait visible tout de suite par les recruteurs collégiaux en prod. |
| **E6** | Parcours du cégépien (C1 à C6) : « Trouver mon université » (universités QC + Canada, carte du Canada, filtres sport / programme / province / langue), « Mon parcours » vers l'université, « Mes cibles » universitaires, « Quand l'université cogne », « Ma visibilité » (universités qui consultent), balayage de tous ses textes « cégep » / « recruteur ». | web | Rien : le cégépien n'existe pas sous `lancement_collegial` OFF. |
| **E7** | D2, D3 : clé MapTiler locale ; marche à suivre de l'inscription locale ; « Tu joues pour… » → « École secondaire ou cégep » sous ON. | web / doc | Rien (texte sous ON). |

## Risques
1. **Cibles et masquage (E1) :** l'athlète ne lit pas les universités (D1a). Les cibles universitaires passent
   par des RPC DEFINER sous ON ; il ne faut rouvrir ni `schools` ni `teams` en lecture directe (la 1.4.5 lit la base).
2. **Pages d'équipes (E2, E4) :** les éditeurs d'équipe téléversent sous le `school_id` (`can_edit_school_page`, déjà
   bon depuis D5a) ; les fanions, camps et besoins passent par `can_edit_team_page` → un seul point à ouvrir.
3. **Recherche de prospects collégiaux (E5) :** le lot C0 ferme les écritures recruteur collégial → cégépien. « Collégial »
   pour un recruteur collégial = transfert seulement ? (Q5). Pour l'universitaire : les cégépiens sous ON seulement (D3a/D3c).
4. **Type de ligue (E5) :** dérivé de l'école de la fiche (SECONDAIRE / CEGEP / LIGUE_CIVILE) ; fiche sans école →
   « Inconnu ». L'export et les filtres changent pour tous les recruteurs : non-régression à prouver.
5. **Textes du cégépien (E6) :** beaucoup de pages partagées avec le secondaire. Règle unique « contexte de
   l'athlète » (comme `estRecruteurUniversitaire`), testée, plutôt que des conditions éparpillées.
6. **Carte du Canada (E6) :** la carte actuelle est cadrée sur le Québec ; 59 universités, coordonnées à vérifier
   (`schools.lat/lng` des 47 universités D1b : probablement vides → géocodage à faire, sources citées).
7. **MapTiler (E7) :** le worktree n'a PAS de `NEXT_PUBLIC_MAPTILER_KEY` (seul `.env.example`, valeur vide) et
   `dev-d.sh` ne la passe pas → « Invalid key » est LOCAL. L'arbre partagé a une clé dans `.env.local` ; la prod sera
   vérifiée par une capture headless de la carte publique (sans contournement).

## Ce qui va dans la 1.4.6 (s'ajoute à D4-MOBILE.md)
- E0 : « Dicter » retiré des notes mobiles (`ChampNote` partagé, `FilNotesSuiviMobile`, `RecruteurListeDetailMobile`).
- E1/E6 : parcours du cégépien mobile (recherche d'universités `RechercheMobile`, Mon parcours, Mes cibles,
  Ma visibilité, textes du panneau Plus).
- E4 : tuile « qui me ciblent » du tableau de bord mobile ; pages d'équipes universitaires en lecture (renvoi web pour
  l'édition, comme le cégep).
- E5 : `CreerProspectMobile` à 3 types, type de ligue dans le pipeline mobile.
- E3 : affichage du cycle libre (page universitaire mobile, Q4 de D5).

## Proposition « Quand l'université cogne » (C4) — 8 critères, sur le modèle du module 3
1. Mon programme d'études est offert (et ses conditions d'admission connues).
2. Ma cote R est à jour et je connais la cote d'admission visée.
3. Mon DEC est sur la bonne voie (cours préalables du programme).
4. J'ai une vidéo de match récente (moins de 12 mois) et mes statistiques collégiales.
5. Je connais les bourses : athlétiques (U SPORTS) et d'études, et leurs dates limites.
6. Je sais dans quelle ligue je joue ensuite : RSEQ au Québec ou U SPORTS ailleurs, et l'admissibilité U SPORTS.
7. J'ai parlé avec l'entraîneur et je sais quel rôle on me propose (temps de jeu, encadrement).
8. Le budget est clair : droits de scolarité, résidence, langue d'enseignement, distance de la maison.

## Tes décisions (questions courtes)
- **Q1** — E0 en prod tout de suite (web au prochain Promote, appli à la 1.4.6) : OK ?
- **Q2** — Cycle libre (A3) : liste fermée « baccalauréat, certificat, maîtrise, doctorat » + « autre » avec texte libre, ou texte entièrement libre ?
- **Q3** — Pages d'équipes universitaires (A2) : éditables par le recruteur universitaire de l'université seulement (pas de coach universitaire sur Nexus) ?
- **Q4** — Type de ligue dans le pipeline (B5) : livré tout de suite aux recruteurs collégiaux (visible en prod), ou sous `lancement_universitaire` ?
- **Q5** — « Ajouter un prospect » → Collégial pour un recruteur COLLÉGIAL : transferts entre cégeps (sous `lancement_collegial`, malgré le verrou C0), ou réservé au recruteur universitaire ?
- **Q6** — Parcours universitaire du cégépien (E6) : seulement sous `lancement_universitaire` ON (sinon il garde le parcours actuel, adapté « cégep »), ou dès `lancement_collegial` ON ?
- **Q7** — « Quand l'université cogne » : la liste de 8 ci-dessus te va (ou tes changements) ?
- **Q8** — Carte du Canada : géocoder les 47 universités hors Québec (adresse du campus principal, source citée) ?
- **Q9** — Ordre des lots : E0, puis E1-E3 (base), E4-E6 (web), E7 ; ou un autre ordre ?
