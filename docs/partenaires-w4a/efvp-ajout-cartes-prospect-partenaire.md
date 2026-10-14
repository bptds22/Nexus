# Ajout à l'ÉFVP — Cartes prospects partenaire (lot W4, 2026-10-14)

À intégrer dans l'évaluation des facteurs relatifs à la vie privée de Nexus (document unique,
au niveau de Nexus). Responsable : RPRP, Bruno-Philippe Desfosses Simard.

## Le traitement

Un **partenaire évaluateur** (organisation approuvée, autorisée à évaluer, pour des sports
précis) repère un jeune qui n'est pas inscrit sur Nexus. Il crée une **carte prospect** et lui
envoie lui-même un lien d'inscription, par texto depuis son propre téléphone. Si le jeune
s'inscrit et confirme que la carte le concerne, l'évaluation et les badges du partenaire passent
sur son profil, aux règles déjà en place (W2, W3, W3b).

Nexus peut aussi **rapprocher** une carte d'un athlète déjà inscrit (même nom, même équipe ou
école, même sport). Ces rapprochements ne sont vus que par l'administrateur. Ils sont proposés au
jeune, qui décide seul ; une proposition automatique n'existe que si le jeune a déjà rendu son
profil visible aux partenaires.

## Particularité : collecte sans le consentement de la personne concernée

La carte est créée **avant** tout contact du jeune avec Nexus, sur l'initiative d'un tiers. Le
jeune peut être mineur (14 à 17 ans). C'est le point sensible du traitement ; les mesures
ci-dessous y répondent.

## Renseignements, et ce qui est exclu

| Recueilli (minimum) | Exclu, par construction |
|---|---|
| Prénom, nom | Courriel, téléphone, adresse |
| Sport, position | Photo |
| École ou équipe | Date de naissance |
| Année de graduation | Texte libre (pas de rapport écrit) |
| Évaluation chiffrée et badges, facultatifs | |
| Attestation du partenaire : « 14 ans ou plus » | |

Moins de 14 ans : l'inscription sur Nexus est refusée à tous les points d'entrée (aucun parcours
de consentement parental n'existe pour cet âge). Une carte pour un jeune de moins de 14 ans ne
peut donc jamais être réclamée ; elle expire.

## Mesures de protection

- **Accès.** La carte n'est visible que du partenaire qui l'a créée et de l'administrateur.
  Jamais des recruteurs, des coachs, des autres partenaires ni de la recherche. Tables sans
  aucun droit d'accès direct ; tout passe par des fonctions contrôlées.
- **Durée.** 60 jours, sans prolongation, puis suppression automatique quotidienne.
- **Refus.** « Ce n'est pas moi » par le lien : suppression immédiate. Sur une proposition de
  rapprochement : la carte n'est pas rattachée à ce jeune, et le partenaire n'en sait rien.
- **Consentement au transfert.** Rien n'est transféré sans le clic du jeune **et** sans son
  consentement « visibilité partenaire » (pour un 14-17 ans, son parent est avisé par le
  mécanisme existant). Sans ce consentement, la carte attend jusqu'à l'échéance, puis disparaît.
- **Lien.** Jeton aléatoire de 256 bits ; seule son empreinte est conservée ; réservé au premier
  compte athlète qui l'ouvre ; révocable ; la page vue sans connexion n'affiche que le nom du
  partenaire, jamais celui du jeune.
- **Ne pas révéler qu'un mineur est sur Nexus.** Le partenaire ne voit jamais qu'un rapprochement
  existe, sauf proposition automatique à un jeune qui lui est déjà visible. Ses statuts sont
  masqués ; l'export d'accès qui le concerne retire tout rapprochement.
- **Erreur de personne.** L'administrateur peut défaire une réclamation pendant 7 jours
  (évaluation retirée avec trace, badges retirés, carte restaurée).
- **Traces.** Journal des gestes sans nom, conservé 12 mois ; l'instantané d'une carte réclamée
  (nécessaire à l'annulation) est effacé après 7 jours.
- **Plafond.** 50 cartes actives par partenaire, contre le fichage de masse.

## Droits des personnes

- **Accès / portabilité.** L'export `/admin/loi25` inclut les cartes : pour un athlète, ce qui le
  vise (réclamation, propositions) ; pour un partenaire, ses gestes et ses cartes actives.
- **Rectification / suppression.** Le jeune refuse ou ignore la carte (elle disparaît) ; il peut
  retirer son consentement « visibilité partenaire » ; l'administrateur supprime une carte sur
  demande.

## Risques résiduels

1. Un homonyme dans la même école reçoit une proposition : il ne voit qu'une évaluation faite par
   un partenaire ; rien ne passe sans son clic ; annulation possible 7 jours.
2. Le partenaire dont la carte est proposée par l'administrateur ne peut pas la modifier pendant
   la proposition ; le message reste neutre (« pour l'instant »).
3. Le lien est transmis par le partenaire hors de Nexus (texto) : Nexus n'en contrôle pas la
   diffusion ; la réservation au premier compte et l'annulation par l'admin limitent l'effet
   d'un transfert du lien.
