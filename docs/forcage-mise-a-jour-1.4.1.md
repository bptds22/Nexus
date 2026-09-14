# Forçage de mise à jour vers 1.4.1 — la commande et sa règle de timing

**Rien n'est activé.** Ce document contient la requête à jouer le jour J et sa
contrepartie de repli. État au moment de l'écriture : `force_update_enabled`
vaut `false`, les minimales sont à `1.4.0`.

---

## ⚠️ LA RÈGLE DE TIMING — non négociable

**N'active le mur qu'APRÈS avoir confirmé, de tes yeux, que 1.4.1 est
téléchargeable sur les DEUX magasins.**

Pas « soumis », pas « en revue », pas « approuvé » : **téléchargeable**. Va sur
les deux fiches depuis un appareil qui n'a pas l'app, et installe-la.

- App Store — https://apps.apple.com/ca/app/nexus/id6785596805
- Play Store — https://play.google.com/store/apps/details?id=ca.nexussports.app

La raison est mécanique : le mur est plein écran et sans fermeture. Activé
pendant qu'un magasin sert encore 1.4.0, il enferme ce parc-là dans un écran
qui lui demande d'installer une version que son magasin ne propose pas. Le
déploiement Play est par ailleurs progressif — une fiche « publiée » peut
n'atteindre qu'une fraction des appareils pendant des heures.

Et il y a pire que l'attente : **les deux magasins ne basculent pas ensemble.**
Si un seul est prêt, n'active QUE sa plateforme (les minimales sont séparées).

---

## La commande d'activation

`app_settings` est en écriture sous `is_admin()` — l'éditeur SQL est `postgres`,
`auth.uid()` y est NULL, et l'UPDATE serait refusé. D'où le préambule, identique
à celui des annonces. L'id admin est **résolu par courriel**, jamais collé en
dur.

```sql
begin;
  select set_config('role', 'authenticated', true);
  select set_config('request.jwt.claims',
                    json_build_object('sub', id, 'role', 'authenticated')::text, true)
    from public.users where email = 'bptds22@gmail.com';

  -- 1. Les minimales. Le mur mord SOUS cette valeur.
  update public.app_settings set value = '1.4.1', updated_at = now()
   where key in ('min_version_ios', 'min_version_android');

  -- 2. Les recommandées — la bannière douce. Même valeur : personne ne doit
  --    voir une bannière l'invitant vers une version déjà exigée.
  update public.app_settings set value = '1.4.1', updated_at = now()
   where key in ('suggested_version_ios', 'suggested_version_android');

  -- 3. L'interrupteur du MUR. Il ne garde QUE le dur : le souple tourne déjà,
  --    indépendamment de lui.
  update public.app_settings set value = 'true', updated_at = now()
   where key = 'force_update_enabled';

  -- Contrôle AVANT de valider. Relis les cinq lignes.
  select key, value from public.app_settings
   where key in ('force_update_enabled','min_version_ios','min_version_android',
                 'suggested_version_ios','suggested_version_android')
   order by key;
commit;
```

**Une seule plateforme prête ?** Retire l'autre des `in (...)` aux étapes 1 et 2.
L'étape 3 peut être jouée : une minimale restée à `1.4.0` ne mure personne.

---

## Le repli

Une seule ligne suffit à libérer tout le parc :

```sql
begin;
  select set_config('role', 'authenticated', true);
  select set_config('request.jwt.claims',
                    json_build_object('sub', id, 'role', 'authenticated')::text, true)
    from public.users where email = 'bptds22@gmail.com';

  update public.app_settings set value = 'false', updated_at = now()
   where key = 'force_update_enabled';
commit;
```

⚠️ **Le repli n'est pas instantané pour qui est déjà muré.** Le verdict « dur »
est mémorisé en `localStorage` (clé `nx-version-blocage`) — c'est délibéré :
sans ça, un usager bloqué coupe le réseau, relance, et le fail-open sur erreur
lui ouvrirait la porte. Conséquence : après le repli, un usager muré reste muré
jusqu'à ce que son app relise les réglages avec du réseau.

Le blocage en cache retient **la version à laquelle il s'appliquait** : il cesse
de mordre dès que l'usager a mis à jour. Personne ne reste enfermé après avoir
fait ce qu'on lui demandait.

Pour lever aussi le souple : remettre les `suggested_version_*` à `1.4.0`.

---

## Ce que le mur NE PEUT PAS atteindre

Le gate est né le **2026-08-27** (`e06461c`). Toute version construite avant ne
le contient pas — et **un binaire sans gate ne peut être mis à jour de force par
aucun réglage**. Vérifié par ascendance git, pas par dates :

| Version | Gate | Peut être murée ? |
|---|---|---|
| Android 1.2 (code 4) → 1.3.0 (code 8) | ❌ | **Jamais** |
| Android 1.4.0 **code 9** | ❌ | **Jamais** |
| Android 1.4.0 code 10 | ✅ | Oui |
| Android 1.4.1 code 11 | ✅ | Oui |
| iOS 1.2 (build 7) → 1.2.3 (build 10) | ❌ | **Jamais** |
| iOS 1.4.0 **builds 11, 12, 13** | ❌ | **Jamais** |
| iOS 1.4.0 build 14 | ✅ | Oui |

**Le piège est là** : « 1.4.0 » ne dit pas si le gate est présent. iOS build 13
et build 14 portent la même chaîne `1.4.0`, l'un a le gate et l'autre non. Or le
gate compare la VERSION et jamais le BUILD — choix délibéré et documenté, les
compteurs de build étant désynchronisés entre les deux magasins. Il n'existe
donc aucun réglage capable de les distinguer.

Ces parcs-là ne se rattrapent que par l'incitation hors app : courriel, push
d'annonce (`send_push_announcement`), message de service.

---

## Ce que le mur affiche

Liens de magasin **codés dans le binaire** (`lib/config/appStores.ts`), la base
n'étant qu'une surcharge facultative — d'où l'absence normale des clés
`store_url_ios` / `store_url_android` dans `app_settings`. Le raisonnement est
consigné à la source : une URL erronée en base enverrait tout le monde dans le
vide, y compris ceux qu'on cherche à dépanner.

Le levier reste disponible si une fiche changeait d'adresse : créer la clé
suffit, elle prend le pas sur la constante.

Message du mur, modifiable via `force_update_message` :

> Cette version de Nexus n'est plus prise en charge. Installe la dernière
> version pour continuer.
