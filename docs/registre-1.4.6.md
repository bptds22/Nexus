# Registre 1.4.6

Points relevés pendant la 1.4.5, à traiter dans la 1.4.6. Rien ici n'est dans le build 1.4.5.

## « Ajouter à mes cibles » visible pour un partenaire sur la page cégep

- **Constat (émulateur, vrai build 1.4.5, 2026-10-16)** : connecté en partenaire, la page
  `/college/[id]` affiche « Ajouter à mes cibles » (et la page équipe, « Rajouter à mes cibles »).
  Même chose sur le web. Le bouton ne fait rien (seul un athlète peut cibler, RLS « Athletes manage
  own targets »), mais un partenaire ne doit pas le voir.
- **Cause** : `useSchoolTargets` calcule `canTarget`, mais aucune page ne le lit ; le bouton est
  rendu pour tout le monde.
- **Correctif prêt, non poussé** : branche `fix/cibles-partenaire` (`dd078a58`). Règle partagée
  `lib/cibles/visibiliteBouton.ts` (masqué pour `PARTNER`, et tant que la session n'est pas lue),
  exposée par le hook (`visible`) et lue par les sept surfaces : `StatRows`, `CtaCibles`,
  `ProgramPageMobile` (pilule), `TeamHero`, `BesoinsWidget`, `TeamPageMobile` (pilule et besoins).
  Tests `lib/cibles/__tests__/visibiliteBouton.test.ts` ; suite 647 / 0 / 1. À revérifier à
  l'émulateur avant fusion.
- **À trancher** : visiteur déconnecté, recruteur et coach voient toujours un bouton sans effet.

## Mobile — page équipe, phrase « les coachs voient qui les suit »

`components/team-page/TeamPageMobile.tsx` (boîte besoins, `ms.kind === "none"`) dit encore
« les coachs voient qui les suit ». Le web l'a corrigée au lot 0 (« les recruteurs voient qui les
cible ») : la cible se pose sur le cégep et ce sont ses recruteurs qui la lisent.

## Type — `nomAConfirmer` manquant dans `CoachEquipeDetailMobile`

`tsc` : `components/shared/CoachEquipeDetailMobile.tsx(70,3)` — `nomAConfirmer` requis par
`CoachAthlete` depuis `b9285d39` (A2). Sans effet au build (`ignoreBuildErrors`), mais à poser.

## Notes sur le terrain — « mode match » (option B du R6, décision BP 2026-10-17)

Demande : les coachs prennent leurs notes dans OneNote, parce que nos notes ne sont pas claires
pendant un match. La 1.4.5 livre l'option C (champ plus grand, brouillon automatique, bouton
Dicter, gabarits courts — `components/shared/ChampNote.tsx`). Le **mode match** reste à rediscuter :

- écran plein cadre ouvert depuis la carte du match, à une main (zone du pouce) ;
- grosses touches par joueur (numéro de maillot → « Tremblay #7 ») et étiquettes en deux gestes
  (à suivre, vitesse, leadership, à revoir), note vocale facultative ;
- **hors ligne** : file locale envoyée au retour du réseau (les estrades ont un mauvais réseau) ;
- effort estimé : 1 à 2 semaines. Aucun code en 1.4.5.

**Dictée native** : `ChampNote` utilise la voix du navigateur quand elle existe et, sinon (cas de
l'appli iOS, dont la WebView n'expose pas `SpeechRecognition`), met le curseur dans le champ et
indique le micro du clavier. Un vrai bouton de dictée dans l'appli demande un plugin natif
(`@capacitor-community/speech-recognition`) : à décider avec le mode match.
