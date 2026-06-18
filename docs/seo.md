# SEO Nexus — Checklist post-déploiement

Document accompagnant le SEO Pack v1 (iter SEO 2026-05-31).
Référence : metadata configurée dans `app/layout.tsx`, sitemap dans `app/sitemap.ts`, robots dans `app/robots.ts`, JSON-LD Organization injecté via `<Script>` dans le `<body>` du root layout.

---

## 1. État livré dans cette iter

- ✅ Favicon : `app/favicon.ico` + icons SVG/PNG depuis `public/brand/` (déjà en place)
- ✅ Metadata root layout : title brand+keyword, description "Fais-toi voir, fais-toi recruter", keywords, OG, Twitter Card, robots, canonical, `metadataBase`
- ✅ JSON-LD Organization (Schema.org) injecté dans le body via `next/script`
- ✅ `app/sitemap.ts` : 14 pages publiques (1 home + 3 persona + 6 info + 4 légal)
- ✅ `app/robots.ts` : autorise toutes les routes publiques, bloque auth/app interne/API
- ⚠️ Homepage `app/page.tsx` : pas de metadata override (Client Component, ne peut pas exporter `metadata`). Le default du layout est utilisé — déjà optimisé.

---

## 2. À faire dans Google Search Console (manuel, ~30 min après déploiement)

1. Aller sur https://search.google.com/search-console
2. Ajouter la propriété `nexussports.ca` (préfixe URL ou domaine)
3. **Vérifier la propriété** (méthode recommandée : balise meta) :
   - Récupérer le token de vérification fourni par GSC
   - L'ajouter à `app/layout.tsx` dans le metadata :
     ```ts
     verification: {
       google: "TOKEN_FOURNI_PAR_GSC",
     }
     ```
   - Re-déployer
4. **Soumettre le sitemap** : `https://nexussports.ca/sitemap.xml`
5. **Demander l'indexation** : homepage + 3 pages persona principales
6. Configurer l'URL préférée (avec ou sans `www`)
7. Activer les notifications par email pour les problèmes critiques

## 3. À créer (assets hors-code)

- [ ] **Open Graph image dédiée** : 1200×630 PNG à placer dans `/public/og-image.png`. Doit afficher logo Nexus + slogan "Fais-toi voir, fais-toi recruter" sur fond brand `#111317`. Apparaît quand le site est partagé sur Facebook/LinkedIn/Slack/iMessage/Discord.
  - En attendant, le metadata utilise `/brand/logo-white-red.png` comme placeholder.
  - À mettre à jour dans `app/layout.tsx` ligne `openGraph.images[0].url` ET `twitter.images[0]`.
- [ ] **Logo PNG haute résolution** : 512×512 dans `/public/logo.png` ou conserver `/brand/logo-white-red.png` (déjà 4K). Référencé dans JSON-LD ligne `logo`.
- [ ] **Apple touch icon dédié** : 180×180 PNG dans `app/apple-icon.png` pour les raccourcis iOS. En attendant, `/brand/icon-red.png` (multi-taille) est servi.

## 4. À configurer (services externes)

- [ ] **Google Business Profile** : https://business.google.com — créer une fiche (catégorie "Software Company" ou "Sports Service"). Permet d'apparaître dans le panel Knowledge Graph quand on cherche "Nexus Québec".
- [ ] **Bing Webmaster Tools** : https://www.bing.com/webmasters — équivalent GSC pour Bing/Yahoo. Import direct depuis Google Search Console possible (gain de temps).

## 5. Stratégie de contenu (moyen terme, 1-3 mois)

Créer des pages SEO ciblées pour les recherches longues :
- `/recrutement-sportif-quebec` — cible "recrutement sportif Québec"
- `/sport-etudes-cegep` — cible "Sport-Études CÉGEP"
- `/guide-athlete-recruteur` — cible "comment se faire recruter au CÉGEP"
- `/recruteur-rseq` — cible "recruteur RSEQ" (volume faible mais conversion haute)

Structure SEO recommandée par page :
- 500-1000 mots
- Hiérarchie h1 → h2 → h3 stricte
- Mots-clés naturels (pas de bourrage)
- Liens internes vers les pages persona
- Image avec alt text descriptif
- Bullet points / tableaux pour les recherches "comment X"

## 6. Backlinks à viser (long terme, 3-12 mois)

- **RSEQ** : page partenaires/outils → contacter Sylvain pour demander une mention
- **CÉGEP avec Sport-Études** : sites institutionnels — viser 5-10 mentions
- **Médias sport amateur Québec** : RDS, Cogeco Médias, journaux locaux (La Voix de l'Est, Le Soleil)
- **Partenaires Nexus** : Cody (designer), Chuck (logo), etc., si applicable
- **Blogs spécialisés recrutement étudiant**

## 7. Monitoring SEO

À mettre en place dans les 2 semaines post-launch :
- **Google Analytics 4** (déjà documenté ailleurs ?)
- **Google Search Console** alertes
- **Vercel Analytics** ou Plausible pour le trafic agrégé
- Tracking position des keywords cibles via Ahrefs / SEMRush gratuit ou outils alternatifs

## 8. Tests post-déploiement à exécuter

1. Visiter `https://nexussports.ca/sitemap.xml` → doit afficher le XML avec 14 URLs
2. Visiter `https://nexussports.ca/robots.txt` → doit afficher les règles
3. View source de la homepage → vérifier `<title>`, `<meta description>`, `<script type="application/ld+json">` présents
4. Tester avec https://search.google.com/test/rich-results (coller l'URL `https://nexussports.ca`) → doit reconnaître l'Organization
5. Tester avec https://cards-dev.twitter.com/validator (Twitter Card) → preview correcte
6. Tester avec https://www.opengraph.xyz (Open Graph) → preview correcte (logo + texte)

## 9. Notes importantes

- Le `metadataBase: new URL("https://nexussports.ca")` permet à Next.js de résoudre les URLs relatives dans OG/Twitter sans avoir besoin de hardcoder le domaine partout.
- Le `template: '%s | Nexus'` ajoute automatiquement `| Nexus` au titre de chaque page enfant qui override son `title`.
- Le `lang="fr"` du root layout pourrait être affiné en `fr-CA` pour Google géolocaliser correctement le contenu Canada/Québec. À considérer si le trafic France pose problème.
