# Lot D5 — « Ma page » pour les universités (diagnostic et plan, 2026-10-28)

Demande de BP (revue le 2026-10-28) : la même « Ma page » que le cégep, pour l'université, sous `lancement_universitaire`,
invisible hors admin sous OFF. Programmes d'études PRÉ-REMPLIS comme au cégep (option B) : première analyse à partir du
site officiel de chaque université (Québec d'abord, puis le reste du Canada avec D1b), premier cycle seulement
(baccalauréats, certificats), sources citées, liste attendue contre liste obtenue ; ensuite l'université gère elle-même
(ajouter, retirer, modifier). Décisions : Q1 /universite/[école] ; Q2 nom, cycle, faculté et lien facultatifs ; Q3 version
réduite sous ON ; Q4 aussi dans la 1.4.6 ; Q5 pages d'équipes plus tard ; Q6 programme visé un jour, pas maintenant.
Ordre : la faille d'écriture (recruteur rattaché à une université) est fermée en premier, dans D5a, après D1b.

**Comment les programmes des cégeps ont été pré-remplis (juillet 2026, `scripts/seed-cegep-programs.mjs`) :** deux
fichiers (`data/import/cegep_programs.json` : 86 établissements publics, programmes avec nom, code MEQ et type ;
`cegep_programs_prives_verifie.json` : collèges privés vérifiés à la main contre leurs sites officiels le 24 juillet,
adresses fournies par BP). Rapprochés aux écoles Nexus par ressemblance des noms (indice de Jaccard), 3 corrections
manuelles, 8 établissements écartés (à distance, écoles spécialisées). Stocké dans `school_programs` : nom, code,
type, `is_displayed = true`, `source = 'seed'`. Résultat : 1 263 programmes pour 61 cégeps.

## Diagnostic : la « Ma page » du cégep aujourd'hui

**Tables (lecture : tout compte connecté ; écriture : `can_edit_school_page` / `can_edit_team_page`) :**
- `school_page_content` : une ligne par école. Identité (surnom, slogan, ville, couleurs, logo), texte « à propos »,
  vidéo du campus, statistiques de parcours (`stat_usports`, `stat_usa`, `stat_diplomation`), liste d'universités
  (`universities`), sections masquées (`hidden_sections`).
- `school_campus_cards` (5 au plus), `school_news` (5 au plus).
- `school_programs` : les programmes d'études du cégep (DEC), type `preuniversitaire` ou `technique`
  (contrainte CHECK), code MEQ, `is_displayed`, `source` `seed` ou `manuel`. Environ 1 263 lignes viennent d'un import
  (`scripts/seed-cegep-programs.mjs`) ; le reste est saisi à la main.
- Page d'équipe : `team_page_content`, `team_pennants` (fanions), `team_events` (camps, calendrier),
  `team_position_needs` (besoins par poste).
- Fichiers : buckets publics `school-logos` et `campus-photos`, rangés par école.

**Qui modifie :**
- `can_edit_school_page(école)` : l'admin plateforme, ou un compte RECRUTEUR rattaché à cette école. Aucune exigence
  d'abonnement.
- `can_edit_team_page(équipe)` : l'admin, un coach de l'équipe, ou un compte de l'école (coach directeur ou
  recruteur).
- Aucune des deux ne regarde le type d'école ni le contexte du compte. Aujourd'hui, un recruteur rattaché à une
  université pourrait donc déjà écrire sa page par l'API. Ce compte ne peut pas exister sous OFF (verrous D0, D2a),
  mais c'est à fermer ou à assumer dans D5.

**L'éditeur (web seulement) :**
- `/recruteur/ma-page` → `PagesTab`. La page de l'école compte 9 sections : identité, affiche des sports, saison en
  cours, campus, à propos, programmes, parcours, nouvelles, plateforme.
- Chaque équipe a son éditeur : fanions, en-tête, calendrier et camps, présentation, besoins, recrues engagées.
- Les sauvegardes sont immédiates, par des RPC transactionnelles (`replace_school_programs`, `replace_school_cards`…).

**La page publique :**
- `/college/[école]` et `/college/[école]/[équipe]`, lues avec la clé service.
- La page est « configurée » quand la ligne `school_page_content` existe ; sinon, une page dégradée.
- On y trouve l'affiche des équipes, la saison (données RSEQ), le nombre de recrues et d'abonnés, le campus, la
  section études (« TOUS LES PROGRAMMES »), le parcours et les nouvelles.
- Les universités en sont exclues en dur depuis D1a : `.neq("type", "UNIVERSITE")` pour l'école, refus pour
  l'équipe. Pas de page /college dans le sitemap.

**Mobile :** `MaPageMobile` dit seulement que la page se modifie sur le web. Les pages publiques mobiles
(`ProgramPageMobile`, `TeamPageMobile`) lisent la base directement, et les règles D1a leur cachent les universités.

**Programmes d'études :**
- Oui, il y a déjà une section : `school_programs` + `ProgramsSection` dans l'éditeur, `AcademicPlanche` sur la page
  publique.
- Elle est taillée pour les DEC : type `preuniversitaire` / `technique`, code MEQ, import, et un rapprochement avec le
  « programme visé » de l'athlète (catalogue `cegep_programs`, `cegep_program_labels`).
- Rien n'existe pour les baccalauréats.

**Propre au cégep, à adapter :** la section Parcours (« Passés en U SPORTS », « NCAA/NJCAA », sélecteur
d'universités), les textes (« Page du CÉGEP », « Collège | Nexus », « Collège introuvable »), la route `/college`,
la contrainte de type des programmes et les fermetures volontaires de D1a, D2b et D3b.

## Plan

### D5a — base (migration, rejeu prod, GO)
1. **Programmes d'études universitaires :** une table dédiée, `university_programs`, plutôt que de tordre
   `school_programs` (qui reste le domaine des DEC et de son catalogue).
   - Colonnes : école, nom, cycle (baccalauréat, certificat), faculté (facultatif), lien (facultatif), affiché,
     position, `source` (`seed` pour le pré-remplissage, `manuel` pour l'université), source citée (URL).
   - Pré-remplissage : lot de données à part (comme D1), Québec d'abord puis le reste du Canada, sur GO.
   - Écriture : par une RPC transactionnelle `replace_university_programs`, sur le modèle de `savePrograms`.
2. **Qui modifie :** `can_edit_school_page` / `can_edit_team_page` restent valables pour une université, à une
   condition de plus : sous ON seulement (`lancement_universitaire_actif()`), et pour un compte au contexte
   universitaire de cette université. Sous OFF, personne d'autre que l'admin.
3. **Lecture de la page universitaire :**
   - Les écoles universitaires restent masquées en base (D1a).
   - La page publique passe par la clé service (web), comme aujourd'hui. Seule la fermeture en dur est levée sous ON.
4. **Rejeu :** sous OFF, rien ne s'ouvre (écriture refusée, page 404). Sous ON, le recruteur universitaire écrit SA page
   et pas une autre ; le recruteur collégial ne la touche pas. Banc des fonctions : 0 fuite.

### D5b — web (après D5a en prod)
1. **Portail :** « Ma page » revient pour le recruteur universitaire, sous ON.
2. **Éditeur :**
   - Mêmes sections que le cégep, sauf « Parcours », qui ne parle que de recrues vers l'université.
   - La section « Programmes d'études » remplit `university_programs`, à la main, sans import ni code MEQ.
   - Les libellés disent « université ».
3. **Page publique :** une route universitaire (Q1) lue par la clé service, qui ne répond que sous ON (404 sous OFF).
   Même gabarit visuel que /college : affiche des équipes, campus, à propos, programmes d'études, nouvelles. Pas de
   « saison en cours » RSEQ hors Québec.
4. **Essais :** captures OFF et ON, recruteur universitaire, recruteur collégial, visiteur anonyme, build et tests verts.

### Ce qui va dans la 1.4.6 mobile
- Panneau « Plus » : « Ma page » pour le recruteur universitaire, avec le même texte que le cégep (« se modifie sur le
  web »). L'éditeur reste web seulement.
- Page publique mobile de l'université : `ProgramPageMobile` lit la base directement, et la base cache les
  universités. Il faudrait donc une RPC de lecture qui ne répond que sous ON (Q4). Sinon, la page universitaire
  reste web seulement dans la 1.4.6.

## Risques
1. **Faille actuelle :** `can_edit_school_page` accepte déjà un recruteur rattaché à une université. Elle est sans
   effet sous OFF, mais D5a doit la cadrer en premier (sous ON, sa propre université seulement).
2. **Fermetures à lever :** les loaders /college, la policy `universites_masquees` et la garde du portail. Chacune
   doit s'ouvrir sous ON seulement, sans rouvrir les listes ni le mobile 1.4.5 (qui lit la base directement).
3. **Contenu vide au lancement :** une page universitaire n'est « configurée » que quand l'université l'a remplie.
   D'ici là, la page est dégradée ou absente (Q3).
4. **Médias :** logos et photos du campus dans des buckets publics. Un fichier téléversé sous ON reste lisible par son
   adresse, même si la page est fermée ensuite.

## Tes décisions (questions courtes)
- **Q1 — Adresse publique :** `/universite/[école]` (ma proposition) ou la même route `/college/...` ?
- **Q2 — Programmes d'études :** quels champs ? Ma proposition : nom, cycle (baccalauréat, certificat, maîtrise,
  doctorat), faculté et lien facultatifs.
- **Q3 — Page non remplie :** sous ON, page dégradée visible (nom, équipes) ou rien tant que l'université ne l'a pas
  remplie ?
- **Q4 — Mobile 1.4.6 :** page publique universitaire aussi dans l'app (une RPC de lecture à ajouter), ou web
  seulement pour l'instant ?
- **Q5 — Pages d'équipes universitaires** (fanions, camps, besoins) : dans D5, ou plus tard ?
- **Q6 — Rapprochement avec l'athlète :** plus tard, un « programme universitaire visé » pour le cégépien, ou jamais ?
