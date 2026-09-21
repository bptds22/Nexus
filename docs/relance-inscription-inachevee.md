# Relance « inscription inachevée »

Relevé prod du 2026-09-21. **Aucun courriel n'est parti.**

## État (2026-09-21)

| Pièce | Où | État |
|---|---|---|
| Correctif cul-de-sac web civil | `fix/onboarding-civil-sport` (`0c9978a`) | poussé, **pas en prod** |
| Journal, désabonnements, définition, écran admin, destinataires | migration `20260921152458_admin_comptes_athletes_sans_fiche` | **en prod** (2026-09-21), empreintes identiques au local, refus hors admin vérifiés |
| Écran `/admin/athletes` | `app/admin/athletes/page.tsx` | build vert |
| Jeton de désabonnement signé | `lib/courriel/jetonDesabonnement.ts` + jumeau `supabase/functions/_shared/` | 6 tests verts (dont l'égalité des jumeaux) |
| Page `/desabonnement` + `POST /api/desabonnement` | web seulement | testées en local (formulaire, un clic RFC 8058, rejeu, jeton faux, GET refusé) |
| Pied LCAP dans `renderEmail` | `_shared/emailLayout.ts` | optionnel — les six courriels existants inchangés |
| Fonction d'envoi | `supabase/functions/send-relance-inscription` | écrite, **jamais exécutée** (pas de Deno local) |

## Ordre de mise en prod — chaque étape sur GO de BP

1. Correctif civil → `main` (il débloque des athlètes réels, indépendant du reste).
2. Migration `20260921152458` en prod (`apply_migration`), puis vérif :
   ACL des 3 fonctions et 2 tables, `select count(*) from
   admin_comptes_athletes_sans_fiche()` sous le compte admin ≈ 67.
3. Secrets — **les mêmes valeurs des deux côtés pour DESABONNEMENT_SECRET** :
   - Vercel (Production) : `DESABONNEMENT_SECRET` (≥ 32 caractères aléatoires) ;
   - Supabase (secrets des fonctions) : `DESABONNEMENT_SECRET` (même valeur),
     `RELANCE_SECRET` (dédié), `RELANCE_TEST_DESTINATAIRES=bptds22@gmail.com`.
     `RESEND_API_KEY` et `APP_URL` existent déjà.
4. Web (`feat/relance-inscription`) → `main` : la page de désabonnement doit
   être EN LIGNE avant qu'un seul lien parte.
5. Déployer `send-relance-inscription`.
6. **Envoi de TEST** à bptds22@gmail.com seulement (mode `test`) — vérifier
   rendu, lien de désabonnement, bouton natif Gmail. Le lien du test est RÉEL :
   le cliquer inscrit le compte admin au registre (à retirer ensuite).
7. Mode `apercu` → nombre attendu ≈ 32 → mode `envoi` avec
   `"confirmer": "ENVOYER <nombre>"`. **Sur GO explicite seulement.**

### Appels (à lancer par BP)

```bash
F=https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-relance-inscription
H=(-H "Authorization: Bearer $SUPABASE_ANON_KEY" -H "x-relance-secret: $RELANCE_SECRET" -H "Content-Type: application/json")
curl -s "${H[@]}" -d '{"mode":"test","a":"bptds22@gmail.com"}' $F
curl -s "${H[@]}" -d '{"mode":"test","a":"bptds22@gmail.com","fournisseur":"apple"}' $F
curl -s "${H[@]}" -d '{"mode":"apercu","campagne":"inscription_inachevee_v1"}' $F
curl -s "${H[@]}" -d '{"mode":"envoi","campagne":"inscription_inachevee_v1","confirmer":"ENVOYER 32"}' $F
```

Une ligne restée `RESERVE` (plantage entre réservation et envoi) bloque la
personne — c'est voulu. La libérer : `update relances_inscription set statut =
'ECHEC', erreur = 'libéré à la main' where id = '…'`. La clé d'idempotence
Resend (24 h) empêche un doublon si l'envoi était réellement parti.

## Segmentation des 67 comptes ATHLETE sans fiche

| Segment | Total | Apple | Google | Courriel | privaterelay |
|---|---|---|---|---|---|
| (a) `/consentements` passé | 33 | 5 | 15 | 13 | **0** |
| (b) jamais passé | 34 | 19 | 14 | 1 | 10 |

**Segment (a), pour la relance : 32.** Un compte est exclu comme **doublon
probable** : même nom et même date de naissance qu'une fiche active sous un
autre compte. La personne est déjà inscrite ; la relancer l'inviterait à créer
un doublon. L'écran admin porte le badge « Doublon probable ».

Dans (a) :
- 16 mineurs (âge déclaré sur `/consentements`), 17 adultes, 0 sous 14 ans ;
- 22 sur 33 ont coché le consentement marketing.

**Segment (b) : aucun indice d'âge.** `/consentements` est précisément l'écran
qui demande la date de naissance ; sans lui, rien. Apple et Google ne
transmettent pas d'âge. Conformément à la décision, **on ne leur écrit pas**.
Ce segment peut contenir des moins de 14 ans refusés par le blocage Loi 25 —
leur écrire serait les relancer vers un refus.

La liste nominative vit dans `/admin/athletes`, filtre « Inscription
inachevée → consentement passé », une fois la migration appliquée.

## Brouillon

**Objet :** Ton profil Nexus n'est pas terminé
**Préentête :** Quelques minutes pour que les recruteurs puissent te trouver.
**De :** `Nexus <info@nexussports.ca>` — **Répondre à :** `info@nexussports.ca`

> **Salut {prénom},**
>
> Tu as créé ton compte Nexus le {date d'inscription}, mais ton profil n'est
> pas terminé. Tant qu'il ne l'est pas, les recruteurs des cégeps ne peuvent
> pas te trouver.
>
> Ça ne prend que quelques minutes.
>
> Pour être franc : ton profil n'a pas été enregistré en cours de route, donc
> tu repars du début. Tes consentements, eux, sont déjà faits — tu ne les
> referas pas.
>
> **Connecte-toi avec {Apple | Google | ton adresse courriel}**, le même moyen
> que la première fois. Avec un autre, tu créerais un deuxième compte.
>
> [ Terminer mon profil ] → `https://nexussports.ca/auth`
>
> ---
> Tu reçois ce courriel parce que tu as créé un compte athlète sur Nexus.
> [Ne plus recevoir ces courriels]({lien de désabonnement})
> Nexus — 856, rue Basile-Routhier, Repentigny (Québec) · info@nexussports.ca

### Notes sur le texte
- **« tu repars du début » vaut pour tout le segment**, pas seulement pour
  l'app : un compte sans fiche n'a, par définition, rien d'enregistré. Le web
  sauve à chaque étape, mais ces 33 n'ont passé aucune étape.
- **« quelques minutes »** (décision BP) : « 3 minutes » n'était pas mesuré —
  le web a 4 étapes, l'app 3 écrans.
- **Le fournisseur est la phrase la plus utile du courriel.** Un Apple qui
  revient par courriel crée un second compte ATHLETE vide — le doublon naît
  précisément de la relance.
- Le CTA pointe `/auth` sans paramètre : la redirection post-connexion
  (`computeDispatchDestination`) envoie déjà un compte non onboardé vers le
  bon assistant.
- Gabarit : `renderEmail` de `supabase/functions/_shared/emailLayout.ts`,
  étendu d'un pied `lcap` optionnel (raison, désabonnement, adresse postale,
  support). Le prénom est échappé dans `email.ts` — renderEmail n'échappe rien.

## LCAP

- **Identification** (nom, adresse postale, moyen de contact) et **mécanisme de
  désabonnement** : dans le pied ci-dessus.
- **Consentement** : 22 sur 33 ont un consentement marketing exprès. Pour les
  autres, la création de compte des 6 derniers mois peut soutenir un
  consentement tacite (demande de renseignements, art. 10(10)) — inscriptions
  du 2026-07-02 au 2026-09-18, donc valable jusqu'en janvier–mars 2027.
  **Ce n'est pas un avis juridique**, à valider.
- **Désabonnement** : doit fonctionner **60 jours** après l'envoi et être
  appliqué en **10 jours ouvrables** au plus.

### Le désabonnement (fait)
- **Registre** `courriel_desabonnements` : une ligne par compte, valable pour
  toute relance ou nouvelle — pas par campagne. `relance_inscription_cibles()`
  l'exclut. Aucune adresse stockée.
- **Jeton** : `<user_id>.<HMAC-SHA256>` avec préfixe versionné, signé par la
  fonction d'envoi, vérifié par la route. Pas de connexion exigée (LCAP).
- **Le lien du courriel CONFIRME, il n'écrit pas** : les passerelles de
  sécurité ouvrent les liens, un GET qui écrit désabonnerait des gens qui
  n'ont rien demandé. Seul un POST écrit (bouton de la page, ou bouton natif
  Gmail / Apple Mail via `List-Unsubscribe-Post`).
- Effet immédiat, bien sous les 10 jours ouvrables exigés.

## Apple — « Sign in with Apple for Email Communication »

**Pour cette campagne : non bloquant.** Le segment (a) ne contient **aucune**
adresse `privaterelay.appleid.com` : les 5 comptes Apple ont partagé leur vraie
adresse. Les 10 relais sont tous dans (b), qu'on n'écrit pas.

**Au-delà de la campagne : ça compte.** 29 comptes ont une adresse relais,
dont 15 avec une fiche. Toute invitation d'équipe, tout courriel parent ou
avis qui leur est envoyé est jeté si la source n'est pas enregistrée.

**Je ne peux pas vérifier l'enregistrement depuis le dépôt.** À faire dans le
portail :

1. developer.apple.com → Certificates, Identifiers & Profiles → **Services** →
   **Sign in with Apple for Email Communication** → Configure.
2. Sous **Email Sources**, ajouter le domaine `nexussports.ca` **et**
   l'adresse `info@nexussports.ca`.
3. Apple vérifie le **SPF**. État DNS relevé le 2026-09-21 :
   - `nexussports.ca` : `v=spf1 include:spf.protection.outlook.com -all`
     (Outlook seulement) ;
   - `send.nexussports.ca` (return-path Resend) : `v=spf1 include:amazonses.com ~all` ;
   - DKIM `resend._domainkey.nexussports.ca` présent ; DMARC `p=none`.

   Si le portail refuse `nexussports.ca` pour SPF, enregistrer aussi
   `send.nexussports.ca`, le domaine qui passe réellement SPF pour les envois
   Resend. **Point non vérifié** : je n'ai pas confirmé quel domaine Apple
   contrôle, le From ou le return-path.
4. Test : écrire à un compte relais de test, et vérifier la livraison dans
   Resend.

## Journal (fait, dans la migration)

`relances_inscription` : une ligne **réservée avant** l'appel Resend
(`RESERVE`), puis `ENVOYE` avec l'id Resend, ou `ECHEC`. L'index unique partiel
`(user_id, campagne) where statut <> 'ECHEC'` interdit un second envoi réussi
ou en cours, même en concurrence ; un échec peut être retenté. Écriture
service_role seulement, lecture admin. La colonne « Relance » de l'écran admin
le lit.

Campagne proposée : `inscription_inachevee_v1`.
