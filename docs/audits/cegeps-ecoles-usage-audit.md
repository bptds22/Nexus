# Audit d'usage — `/cegeps/[id]` & `/ecoles/[id]`

**Date** : 2026-05-27
**Type** : read-only — aucune modification de code applicatif.
**Objectif** : décider si ces deux routes ont une raison d'exister aujourd'hui (ou dans un avenir proche) ou si elles peuvent être exclues du build mobile.

---

## Partie A — État actuel du code des deux pages

### A.1 — `app/cegeps/[id]/page.tsx`

- **Nombre de lignes** : 38 lignes (39 avec newline final).
- **Imports** : `import Link from "next/link";` — c'est tout.
- **Queries Supabase** : aucune.
- **Composants enfants rendus** : aucun (juste du markup inline + `<Link>` natif Next).
- **Verdict** : **Page placeholder.**

**Contenu intégral** :

```tsx
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   CÉGEP Profile — Placeholder page (Phase 1)
   Will be fleshed out when CÉGEP directories are built.
═══════════════════════════════════════════════════════════════ */

export default async function CegepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-[#060A14] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-white/5 flex items-center justify-center mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10l-10-5L2 10l10 5 10-5z" />
            <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
          </svg>
        </div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Profil CÉGEP
        </h1>
        <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
          La page de profil pour ce CÉGEP (<span className="font-mono text-[#6B7280]">{id}</span>) sera disponible prochainement.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] font-bold text-[#E63946] hover:text-[#D93C3C] transition-colors mt-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
```

### A.2 — `app/ecoles/[id]/page.tsx`

- **Nombre de lignes** : 38 lignes (39 avec newline final).
- **Imports** : `import Link from "next/link";` — c'est tout.
- **Queries Supabase** : aucune.
- **Composants enfants rendus** : aucun (markup inline + `<Link>`).
- **Verdict** : **Page placeholder.**

**Contenu intégral** :

```tsx
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   École Profile — Placeholder page (Phase 1)
   Will be fleshed out when school directories are built.
═══════════════════════════════════════════════════════════════ */

export default async function EcolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-[#060A14] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-white/5 flex items-center justify-center mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Profil d&apos;école
        </h1>
        <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
          La page de profil pour cette école (<span className="font-mono text-[#6B7280]">{id}</span>) sera disponible prochainement.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] font-bold text-[#E63946] hover:text-[#D93C3C] transition-colors mt-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
```

### A.3 — Résumé Partie A

Les deux pages sont des **placeholders quasi-identiques** (mêmes 38 lignes, seuls l'icône SVG et le texte du `<h1>` diffèrent). Aucune query, aucun composant enfant, aucun branchement conditionnel — juste l'affichage de l'`id` reçu dans `params` à des fins de debug visuel.

---

## Partie B — Qui linke vers ces pages ?

### B.1 — Grep direct sur `/cegeps/` et `/ecoles/`

Un seul fichier dans tout le repo référence ces routes :

| Fichier | Ligne | Contexte | Visibilité |
|---|---|---|---|
| [components/shared/EntityLink.tsx](../../components/shared/EntityLink.tsx) | 44 | `case "school": return \`/ecoles/${id}\`;` | UI (route résolue quand un `EntityLink` est rendu avec `type="school"`) |
| [components/shared/EntityLink.tsx](../../components/shared/EntityLink.tsx) | 47 | `case "cegep": return \`/cegeps/${id}\`;` | UI (idem pour `type="cegep"`) |

C'est le SEUL endroit dans la base de code qui construit ces URLs.

### B.2 — Qui invoque `<EntityLink type="school" />` ou `<EntityLink type="cegep" />` ?

**Direct usage des props `type="school"` / `type="cegep"`** : aucune occurrence trouvée. Tous les appels explicites à `<EntityLink>` dans le repo passent `type="coach"`, `type="recruiter"`, ou `type="athlete"` :

- [app/coach/demandes/page.tsx:88](../../app/coach/demandes/page.tsx#L88), [app/coach/demandes/page.tsx:111](../../app/coach/demandes/page.tsx#L111) — `type="recruiter"`, `type="athlete"`
- [app/coach/demandes/[id]/page.tsx:316](../../app/coach/demandes/[id]/page.tsx#L316), [app/coach/demandes/[id]/page.tsx:318](../../app/coach/demandes/[id]/page.tsx#L318), [app/coach/demandes/[id]/page.tsx:401](../../app/coach/demandes/[id]/page.tsx#L401) — `type="recruiter"`, `type="athlete"`
- [components/review/ReviewWidgetConfirmation.tsx:30](../../components/review/ReviewWidgetConfirmation.tsx#L30), [components/review/ReviewWidgetForm.tsx:87](../../components/review/ReviewWidgetForm.tsx#L87), [components/review/ReviewWidgetTeaser.tsx:35](../../components/review/ReviewWidgetTeaser.tsx#L35) — `type="coach"`

**Usage indirect via `RichActivityMessage`** : OUI. Le système d'activités produit des messages avec placeholders `{school}` et `{cegep}` qui sont remplacés à l'affichage par des `<EntityLink>` cliquables.

- [app/components/activities/RichActivityMessage.tsx:15-23](../../app/components/activities/RichActivityMessage.tsx#L15-L23) — le regex `/\{(athlete|coach|recruiter|school|cegep)\}/g` et le mapping `PLACEHOLDER_TO_TYPE` convertissent `{school}` → `EntityLink type="school"` (donc → `/ecoles/{id}`) et `{cegep}` → `EntityLink type="cegep"` (donc → `/cegeps/{id}`).
- [app/components/activities/activityMessages.ts](../../app/components/activities/activityMessages.ts) — événements d'activité qui injectent `{school}` ou `{cegep}` dans leur texte :
  - ligne 59 : `message_received` (portal=coach) → `"{recruiter} ({cegep}) a envoyé un message concernant {athlete}"`
  - ligne 66 : `message_received` (portal=recruiter) → `"{coach} ({school}) a répondu concernant {athlete}"`
  - ligne 105 : `athlete_added` (portal=recruiter) → `"{athlete} de {school} a été ajouté à la plateforme"`
  - ligne 112 : `letter_of_intent` (avec cegep) → `"{athlete} a signé une lettre d'intention avec {cegep}"`
  - ligne 120 : `profile_viewed` (avec cegep) → `"Un recruteur de {cegep} a consulté le profil de {athlete}"`
  - ligne 139 : `new_athlete_in_sport` → `"{athlete} de {school} vient d'être ajouté en sport"`

### B.3 — Conclusion Partie B

Les routes `/cegeps/[id]` et `/ecoles/[id]` **sont effectivement cliquables depuis l'UI** dans tout endroit où le feed d'activités s'affiche (dashboards coach et recruteur). Un utilisateur qui clique sur le nom d'une école ou d'un CÉGEP dans une notification atterrit sur la page placeholder « sera disponible prochainement ».

Ce n'est pas un lien interne/logique ; c'est un lien UI qui produit une expérience cassée pour l'utilisateur.

---

## Partie C — Roadmap & mentions textuelles

### C.1 — Mentions dans les fichiers `.md`

Recherche sur `cegeps/[id]`, `ecoles/[id]`, "comparaison CEGEP", "comparer les CEGEP", "fiche CÉGEP", "fiche école" :

| Fichier | Lignes | Texte |
|---|---|---|
| [docs/capacitor-audit.md](../capacitor-audit.md) | 42, 43, 65, 66, 188, 217 | Mentions techniques (build mobile, `generateStaticParams`, prerender ou retirer). C'est cet audit-ci qui mentionne — aucune autre source dans le repo. |

**Aucune mention de** :
- « comparaison CEGEP » ou « comparer les CEGEP »
- « fiche CÉGEP » / « fiche école » comme feature à venir
- Roadmap publique pour ces pages
- Spec ou design doc qui détaille leur contenu futur

### C.2 — Commentaires `TODO` / `FIXME` / `XXX` dans les fichiers de page

Recherche sur `app/cegeps/**/*.tsx` et `app/ecoles/**/*.tsx` :

| Résultat | Commentaire |
|---|---|
| Aucun match | Les deux pages contiennent juste le commentaire de bloc en tête : `"Will be fleshed out when CÉGEP directories are built."` / `"Will be fleshed out when school directories are built."` — pas de TODO datée, pas de ticket référencé. |

### C.3 — Conclusion Partie C

Il n'y a **aucune trace écrite** d'une intention concrète de développer ces pages (pas de spec, pas de design, pas de ticket, pas de mention dans la roadmap, pas de TODO timestampé). Le seul commentaire qui en parle est dans le code source des pages elles-mêmes (`"Will be fleshed out when..."`), formulé comme une intention vague sans échéance.

L'audit Capacitor (le seul fichier qui les mentionne) **demande la décision**, ne la documente pas.

---

## Partie D — Données disponibles en DB

**Source** : Supabase **local** (container `supabase_db_Nexus`, healthy depuis 3h).

### D.1 — Schéma de la table `schools`

24 colonnes :

```
id, name, type, region, city, address, logo_url, created_at, updated_at,
team_name, website, division, age_category, conference, reseau, langue,
meq_code, has_secondaire, has_collegial, school_registry_id, postal_code,
slug, iso_active, rseq_institution_id
```

Pas de colonne `description`, `principal_name`, `programs_offered`, `founded_year`, `student_count`, ou tout autre champ « descriptif » qui ferait sens dans une fiche publique.

### D.2 — Volumes par type

```
SECONDAIRE   |   830
LIGUE_CIVILE |   264
CEGEP        |    69
Total schools : 1163
```

Note : `LIGUE_CIVILE` n'est PAS routé vers `/ecoles/[id]` ni `/cegeps/[id]` — ce sont des clubs civils par convention (cf. CLAUDE.md). Pertinent uniquement : 69 CÉGEPs + 830 écoles secondaires = **899 pages potentielles**.

### D.3 — Exemples de rows

**3 CEGEPs** :

| id (tronqué) | name | region | city | address | website | langue | has_collegial |
|---|---|---|---|---|---|---|---|
| `fbe59ef8…` | Campus Notre-Dame-de-Foy | Capitale-Nationale | Saint-Augustin-de-Desmaures | 5000 rue Clément Lockquell | (vide) | FR | false |
| `442b3b2a…` | Cégep André-Laurendeau | Montréal | Montréal | 1111 rue Lapierre | (vide) | FR | true |
| `eab74df7…` | Cégep Beauce-Appalaches | Chaudière-Appalaches | Saint-Georges | 1055, 116e Rue Est | (vide) | FR | true |

**3 écoles secondaires** :

| id (tronqué) | name | region | city | address | website | langue | has_secondaire |
|---|---|---|---|---|---|---|---|
| `65fe4b1c…` | Académie adventiste Greaves | Montréal | Montréal | (vide) | (vide) | FR | false |
| `59ff9e48…` | Académie Antoine-Manseau | Lanaudière | Joliette | (vide) | (vide) | FR | false |
| `19dac9c6…` | Académie Chrétienne Rive-Nord | Laval | Laval | (vide) | (vide) | FR | false |

### D.4 — Complétion des champs utiles pour une fiche publique

| Champ | CEGEP (69 rows) | SECONDAIRE (830 rows) | Verdict |
|---|---|---|---|
| `name` | 69 (**100 %**) | 830 (**100 %**) | ✓ universel |
| `region` | 69 (**100 %**) | 830 (**100 %**) | ✓ universel |
| `city` | 69 (**100 %**) | 830 (**100 %**) | ✓ universel |
| `address` | 53 (77 %) | 81 (**10 %**) | ⚠ secondaire vide à 90 % |
| `website` | 4 (**6 %**) | 22 (**3 %**) | ⛔ quasi-absent partout |
| `logo_url` | 53 (77 %) | 80 (**10 %**) | ⚠ secondaire vide à 90 % |
| `postal_code` | 53 (77 %) | 83 (**10 %**) | ⚠ secondaire vide à 90 % |
| `meq_code` | 44 (64 %) | 791 (95 %) | ✓ pour secondaire |

### D.5 — Conclusion Partie D

Sur les 24 colonnes de `schools`, **seules `name`, `region`, `city` sont peuplées à 100 %**. Pour les écoles secondaires, 90 % des rows ont les champs `address`, `website`, `logo_url`, `postal_code` à NULL. Pour les CÉGEPs c'est moins pire (~77 % renseignés) mais la colonne `website` est vide pour **65 CÉGEPs sur 69** (94 %).

**Une fiche publique générée à partir de ces données aujourd'hui afficherait, pour la majorité des écoles secondaires** :

```
Nom de l'école
Région · Ville

(rien d'autre)
```

Ce n'est pas une fiche profil — c'est un duplicate de ce que les athletes cards affichent déjà inline.

---

## Partie E — Recommandation

**Verdict : exclure du build mobile et supprimer les liens cliquables côté UI.**

**Justification** :

1. **Partie A** : pages-placeholders littéralement vides — pas de logique, pas de données, juste 38 lignes de markup statique.
2. **Partie B** : seules cibles d'invocation = activity feed via `EntityLink`. Chaque clic d'utilisateur sur un nom d'école/CÉGEP dans une notification produit une expérience cassée (« sera disponible prochainement »). C'est pire que ne rien rendre cliquable.
3. **Partie C** : aucune trace de roadmap, spec, ticket, ou TODO précisant ce que ces pages devraient contenir. L'intention est restée non-écrite depuis Phase 1.
4. **Partie D** : la DB n'a pas les données pour une fiche utile. 90 % des écoles secondaires n'ont que nom + région + ville. Pas de colonne descriptive (`description`, `programmes`, `effectif`, etc.) — une migration de schéma + un effort de saisie serait requis avant de pouvoir afficher quoi que ce soit d'utile.

**Action concrète recommandée** :

1. **Modifier `components/shared/EntityLink.tsx`** : faire que `type="school"` et `type="cegep"` retournent `"#"` comme le cas `type="trainer"` (déjà géré ligne 50). Conséquence : ces noms s'afficheront en texte bold non-cliquable dans les notifications — état neutre, pas d'expérience cassée.
2. **Supprimer `app/cegeps/[id]/page.tsx` et `app/ecoles/[id]/page.tsx`**. Conséquence : 899 routes mortes en moins dans le build, et le build Capacitor static export n'a plus à les pré-générer ni à les exclure manuellement.
3. **Garder la table `schools`** : elle est utilisée pour bien d'autres choses (rattachement athlete/coach, filtres recherche, etc.). C'est seulement la *vue publique par école* qui est supprimée.

**Si une feature de comparaison CÉGEP arrive plus tard**, l'architecture saine est :
- Une route **unique** `/comparer-cegeps` (ou `/recruteur/cegeps` côté recruteur)
- Filtres/recherche sur la liste de 69 CÉGEPs
- Vue détail dans une drawer/modal côté client, alimentée par une seule query
- **Zéro prerender de fiches individuelles** — 69 routes statiques quasi-vides ajoutent du poids au manifeste mobile pour rien

Cette approche est mieux pour le mobile (un seul écran à charger), mieux pour la maintenance (un seul template), et mieux pour le SEO web futur (une URL pivot que Google peut indexer + paramètres de filtre vs 899 URLs faméliques).
