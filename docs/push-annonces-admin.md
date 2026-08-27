# Annonces push admin — le mode d'emploi

**Canal parallèle à la messagerie.** Une annonce est une notification push à
titre et texte libres. Elle ne crée aucune conversation, aucun message, et ne
touche pas `notify_on_message`.

Posé le 2026-08-27. Chemin : `send_push_announcement` (RPC) → `send-announcement`
(orchestrateur) → `send-push` (inchangée dans son protocole) → FCM HTTP v1.

---

## 1. L'appel, à copier-coller

Éditeur SQL Supabase. Le préambule fabrique l'identité — la RPC est gardée par
`is_admin()`, qui lit `auth.uid()` : sans lui, l'éditeur SQL est `postgres`,
`auth.uid()` est NULL, et la fonction refuse (c'est voulu).

L'id admin est **résolu par courriel**, jamais collé en dur (règle CLAUDE.md).

### Envoi de test — vers moi seul

```sql
begin;
  select set_config('role', 'authenticated', true);
  select set_config('request.jwt.claims',
                    json_build_object('sub', id, 'role', 'authenticated')::text, true)
    from public.users where email = 'bptds22@gmail.com';

  select public.send_push_announcement(
    'Test Nexus',
    'Si tu vois ceci sur ton écran verrouillé, le canal fonctionne.',
    'me'
  );
commit;
```

### Envoi large — le jour de la campagne

**Au-delà de 5 usagers résolus, l'envoi refuse de partir** sans
`p_confirme_envoi_large := true` — quelle que soit l'audience. Lance-le
d'abord SANS le drapeau : le refus te dit combien d'usagers et de jetons
seraient touchés. C'est l'écran de confirmation, en SQL.

```sql
begin;
  select set_config('role', 'authenticated', true);
  select set_config('request.jwt.claims',
                    json_build_object('sub', id, 'role', 'authenticated')::text, true)
    from public.users where email = 'bptds22@gmail.com';

  select public.send_push_announcement(
    'Nexus 1.4 est disponible',
    'Mets à jour depuis l''App Store pour la dernière version.',
    'all',
    null,          -- p_user_ids : seulement pour l'audience « user »
    true           -- p_confirme_envoi_large : je confirme le nombre annoncé
  );
commit;
```

> Les apostrophes du texte se doublent en SQL : `l''App Store`.

### Audiences

| `p_audience` | Cible | Usagers au 2026-08-27 | Confirmation |
|---|---|---|---|
| `me` | Moi seul (l'admin appelant) | 1 | non |
| `user` | `p_user_ids` (tableau d'uuid) | selon la liste | si > 5 |
| `coachs` | Tous les coachs actifs avec appareil | 5 | non (à ce compte) |
| `recruteurs` | Tous les recruteurs actifs avec appareil | 11 | **oui** |
| `athletes` | Tous les athlètes actifs avec appareil | 52 | **oui** |
| `all` | Athlètes + coachs + recruteurs | 68 | **oui** |

**La confirmation se déclenche sur la TAILLE, pas sur le nom de l'audience :
plus de 5 usagers résolus ⇒ `p_confirme_envoi_large := true` obligatoire.** Le
seuil est la constante `c_seuil` dans la fonction.

Dans tous les cas : `users.status = 'ACTIF'` seulement, et un usager sans jeton
n'est pas une cible (permission refusée, ou app jamais ouverte).

**À savoir :** `coachs` compte aujourd'hui **exactement 5 usagers**, donc il
passe sous le seuil et **part sans rien demander**. Un coach de plus avec un
appareil enregistré, et il basculera de l'autre côté. Baisser `c_seuil` à 1 si
ce silence gêne.

---

## 2. Lire le bilan

```sql
select created_at, title, audience, status,
       targeted_users, users_ok, users_ko,
       targeted_tokens, tokens_sent, tokens_failed, tokens_purged,
       failure_codes, error
  from public.push_announcements
 order by created_at desc
 limit 10;
```

- `users_*` comptent l'**usager** : un usager à 42 jetons pèse 1.
- `tokens_*` comptent les **appareils**.
- `failure_codes` est l'histogramme FCM (`{"INVALID_ARGUMENT": 6}`) — la mesure
  qui manquait pour arbitrer la purge sur des chiffres plutôt qu'à l'intuition.
- `status` : `QUEUED` (l'orchestrateur n'a jamais répondu — anomalie visible),
  `RUNNING`, `DONE`, `ERROR`.

---

## 3. La sonde, et pourquoi la purge ne part pas à l'aveugle

FCM renvoie `INVALID_ARGUMENT` aussi bien pour « ce jeton est invalide » que
pour « ton payload est malformé ». Purger sur ce code sans discernement
viderait `device_tokens` du parc entier sur un seul envoi cassé.

L'orchestrateur envoie donc d'abord à **un** destinataire. Si au moins un de ses
jetons passe, le payload est prouvé valide, et le reste du fan-out part avec la
purge élargie. Si la sonde échoue en totalité : `status = 'ERROR'`, envoi
interrompu, **zéro suppression**.

Conséquence à connaître : un usager dont TOUS les jetons sont invalides ne voit
jamais les siens purgés s'il est le premier de la liste — il est la sonde. Le
suivant règlera le cas.

---

## 4. Procédure de première campagne

1. **Vérifier que mon compte a un appareil** — sinon `'me'` échoue avec
   « aucun appareil pour cette audience ». Se connecter une fois à l'app sur
   l'iPhone suffit (`PushRegistrar` enregistre au passage sur le dashboard).
   ```sql
   select platform, count(*) from public.device_tokens
    where user_id = (select id from public.users where email = 'bptds22@gmail.com')
    group by platform;
   ```
2. **Envoi `'me'`**, iPhone verrouillé, écran éteint. Vérifier la notification.
3. **Lire le bilan** : `status = 'DONE'`, `users_ok = 1`.
4. **`'all'` sans le drapeau** → lire le nombre annoncé par le refus (le
   garde-fou se déclenche au-delà de 5 usagers, pour toute audience).
5. **`'all'` avec le drapeau.**
6. **Relire `failure_codes`** : c'est le premier balayage complet du parc, donc
   la première photo honnête de l'état des 145 jetons.

---

## 5. Ce que ça ne fait pas

- **Aucune trace côté usager.** Pas de fil, pas d'historique dans l'app :
  manquée = perdue. Si le contenu doit être rattrapable, l'envoyer AUSSI par
  `send_admin_message` (le fil de service) — deux gestes, deux canaux.
- **Aucun deep-link.** `data.type = 'announcement'` voyage bien, mais les
  binaires actuels (1.2.3 compris) ne font qu'un `console.log` sur le tap. Le
  routage est la Phase 6. La notification s'affiche quand même : elle vient du
  bloc `notification` de FCM, rendu par l'OS — **aucune mise à jour de l'app
  n'est nécessaire pour qu'une annonce soit vue**, ce qui est précisément ce qui
  rend possible le « mets à jour depuis l'App Store ».
- **Le parc n'est pas la base d'usagers.** 69 personnes ont un appareil
  enregistré ; les autres ne recevront rien, et rien ne le signale.

---

## 6. Retour arrière

- La RPC : `DROP FUNCTION public.send_push_announcement(text,text,text,uuid[],boolean);`
  La table `push_announcements` est un journal — la garder.
- `send-push` : les deux champs ajoutés (`collapse_id`, `purge_invalid`) sont
  optionnels et inertes quand ils sont absents. Pour revenir à la version
  précédente : `git checkout <commit> -- supabase/functions/send-push/index.ts`
  puis redéployer.

Voir aussi `docs/push-pgnet-timeout-20260823.md` (pourquoi un seul appel pg_net
et une réponse 202).
