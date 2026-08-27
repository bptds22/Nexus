# Badges — règles d'attribution et de retrait

**Décidé le 2026-08-26 par BP.** Ce document est la trace qui manquait : jusqu'ici la
règle n'existait que dans le corps d'une migration, appliquée en prod via MCP puis
rapatriée au dépôt par `4b0159a`. Aucun commit de décision, aucune note produit.

---

## 1. Partition par auteur — la règle de base (inchangée)

Un coach ne manipule **que les badges qu'il a lui-même attribués**, et seulement ceux
d'origine `saisie`.

**Pourquoi.** Un badge est un jugement signé. Le retirer, c'est contredire le jugement
de quelqu'un d'autre sur un athlète qu'il connaît peut-être mieux. Deux coachs qui
suivent le même athlète (école + club civil, par exemple) doivent pouvoir coexister
sans se défaire mutuellement.

**Conséquence assumée :** les jeux de badges sont **disjoints par `attribue_par`**.
Il n'y a donc ni dernier-écrit-gagne, ni fusion, ni conflit — chacun édite sa part.

Écrit à trois endroits qui doivent rester d'accord :

| Où | Quoi |
|---|---|
| Policy `athlete_badges retrait` | `using (attribue_par = auth.uid() or is_admin())` |
| RPC `appliquer_badges_saisie` | clause `WHERE` du retrait doux |
| `lib/queries/shared/athleteBadges.ts` | découpage `miens` / `autres` |

La RPC est `SECURITY DEFINER` avec `row_security = off` : **la policy ne la protège
pas**, sa propre clause `WHERE` est le seul garde. C'est là qu'il faut corriger une
règle de portée, jamais dans la policy seule.

---

## 2. Administrateur universel — **nouveau, 2026-08-26**

`is_admin()` peut retirer **tout badge**, quelle qu'en soit l'origine
(`saisie`, `suggestion`, `transposition`) et quel qu'en soit l'auteur.

**Le défaut qui l'a motivé.** Test device du 26 août, sur Gabriel Mandziuk : un badge
« Leadership » (`capitaine`) refusait de se désélectionner. Sa ligne :

```
origine      = 'transposition'
attribue_par = a0000000-…-a3   (Nexus Coach Civil)
created_at   = 2026-08-05
```

Deux verrous se cumulaient, et le second était **invisible** :

1. `attribue_par` ≠ coach connecté — verrou voulu, correctement expliqué à l'écran ;
2. `origine = 'transposition'` — la clause `and ab.origine = 'saisie'` du retrait
   excluait ces lignes **pour tout le monde**. Ni leur auteur, ni un administrateur ne
   pouvaient les retirer par le picker. Un badge repris de l'ancien format était
   **indélébile par l'interface**, sans que rien ne le dise.

**Raison de la décision.** Un administrateur est le recours quand plus personne ne peut
agir. Une donnée montrée aux recruteurs ne doit jamais devenir irréparable.

**Migration :** `20260826180000_badges_admin_retire_toute_origine.sql`.
La policy n'a **pas** été touchée — elle autorisait déjà l'administrateur sur n'importe
quelle ligne. Seule la clause de la RPC changeait quelque chose.

> ⚠ **Contrat solidaire.** La portée du remplacement s'élargit, donc l'exigence sur
> `p_entrees` aussi : un administrateur doit envoyer **tous** les badges qu'il veut
> conserver, `transposition` et `suggestion` compris. `chargerBadgesAthlete` les verse
> désormais dans `miens` quand `estAdmin`. Les deux changements ne se séparent pas —
> appliquer la migration sans le client, c'est perdre des badges au premier
> enregistrement admin. Le retrait étant **doux** (`retire_le`, jamais `DELETE`), une
> telle perte se répare :
>
> ```sql
> update public.athlete_badges
>    set retire_le = null, retire_par = null
>  where athlete_id = '<id>' and origine <> 'saisie' and retire_le > now() - interval '1 day';
> ```

---

## 3. Origines

| `origine` | D'où ça vient | Qui peut retirer |
|---|---|---|
| `saisie` | picker coach / admin | son auteur, ou un admin |
| `suggestion` | proposée par l'athlète, approuvée | chemin `appliquer_distinctions_suggerees`, ou un admin |
| `transposition` | reprise de l'ancien `evaluations.distinctions` (migration du 25 août) | **un admin seulement** |

Un badge conservé **garde son origine** : présent dans `p_entrees`, le `not exists` du
retrait l'épargne et l'`INSERT` retombe sur `on conflict … do nothing`. Il n'est jamais
requalifié en `saisie`.

---

## 4. Ce que l'écran dit, et pourquoi il le dit ainsi

**Avant :** une note collective — « seul leur auteur peut les retirer » — sous une
section « Attribués par quelqu'un d'autre ». Fausse une fois sur deux : pour une
`transposition`, l'auteur ne pouvait rien non plus. La phrase envoyait chercher une
personne qui n'avait aucun pouvoir.

**Maintenant :** la section s'appelle « Verrouillés », sans note collective, et
**chaque tuile porte sa raison** :

- `Attribué par <prénom>` — partition par auteur (repli : « Attribué par quelqu'un
  d'autre » quand la RLS de `users` ne laisse pas lire le prénom, cas d'un auteur ADMIN
  vu par un coach) ;
- `Historique (transposition)` ;
- `Issu d'une suggestion de l'athlète`.

---

## 5. Le conflit silencieux — corrigé

**Avant :** un badge déjà attribué par quelqu'un d'autre restait **cochable** dans la
grille. Le coach le cochait, enregistrait, et rien ne se passait : la RPC finit sur
`on conflict (athlete_id, badge_id, contexte) where retire_le is null do nothing`,
l'index unique partiel refusant un doublon vivant. Aucune erreur, aucun message. Le
coach croyait avoir attribué le badge ; il s'affichait toujours au nom de l'autre.

**Maintenant :** la tuile est **verrouillée en amont**, avec sa raison lisible sous le
libellé — « Déjà — attribué par Marc ». Pas seulement en `title` : sur mobile il n'y a
pas de survol, et c'est précisément là que le geste partait dans le vide.

---

## 6. Plafond

`PLAFOND_BADGES = 5`, **toutes familles confondues** (les honneurs n'en sont plus
exemptés — migration `20260826010127`). Le plafond compte l'**union** `miens + autres` :
en base, `badge_plafond` ne regarde pas qui a attribué. Afficher « 3/5 » quand la base
en voit 5 ferait échouer l'enregistrement sans explication.

Le nombre ne vient pas d'une règle métier : **5 badges tiennent sur une ligne au web**,
et `AdaptiveBadgesRow` est bâti dessus. Depuis le 2026-08-26, la taille des badges est
constante (`lg`, 136 px) et la disposition mobile passe à **2 par rangée** — le plafond,
lui, ne change pas.
