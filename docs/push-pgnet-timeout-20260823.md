# Push — `notify_on_message` expire côté pg_net, et l'échec est muet

**Trouvé le** 2026-08-23, en mesurant le palier 0 de la messagerie de service
(premier envoi réel via `send_admin_message`).
**Statut : DOCUMENTÉ, NON CORRIGÉ.** C'est ce qui bloque le palier 3 (diffusion à
une audience large). Le correctif est un lot à part — voir « Pistes ».
**Mesuré en prod** (`nrloizyemulbhujrqhgx`) sur un envoi réel, pas déduit du code.

---

## 1. Le mécanisme

`trg_notify_on_message` (AFTER INSERT sur `public.messages`) appelle
`notify_on_message()`, qui pour **chaque destinataire** du fil émet un appel HTTP
vers l'edge function `send-push` :

```sql
for r in select p.user_id from public.conversations c
         cross join lateral (values (c.recruiter_id), (c.coach_id), (c.coach_b_id),
                                    (c.parent_id),
                                    ((select a.user_id from public.athletes a
                                       where a.id = c.athlete_id))) as p(user_id)
         where c.id = NEW.conversation_id
           and p.user_id is not null
           and p.user_id <> NEW.sender_id
loop
  perform net.http_post(url := v_url, headers := …, body := …);
end loop;
```

`net.http_post` est appelé **sans paramètre `timeout_milliseconds`**. pg_net applique
donc son défaut : **5 000 ms**.

Et tout le corps est enveloppé dans :

```sql
exception when others then
  raise warning 'notify_on_message a échoué pour message %: %', NEW.id, SQLERRM;
```

## 2. Les chiffres mesurés

Envoi du palier 0, message `b0986235`, 2026-08-23 :

| Observation | Valeur |
|---|---|
| Départ de l'appel (`net._http_response.created`) | 18:52:32.905866 UTC |
| Verdict pg_net | `timed_out = true`, `status_code = NULL` |
| Détail | `Timeout of 5000 ms reached` — DNS 11 ms, TCP/SSL 16 ms, **requête/réponse 4 972 ms** |
| Réponse réelle de l'edge function (`function_edge_logs`) | `POST | 200 | …/functions/v1/send-push` à **18:52:41.782** |
| Durée réelle | **≈ 8,9 s** |
| Jetons d'appareil du destinataire (`device_tokens`) | **42** (130 en base au total) |

La fonction a **réussi**. pg_net avait abandonné **3,9 s plus tôt**.

La ligne `net._http_response` est donc un **faux négatif** : elle dit « échec » sur un
push qui est parti et a abouti. L'inverse est vrai aussi — rien dans cette table ne
prouve qu'une notification a été *affichée* sur un appareil.

## 3. Pourquoi c'est invisible

Trois couches d'aveuglement se superposent :

1. **`net.http_post` est asynchrone.** Il met en file et rend la main immédiatement.
   Le timeout se produit **après** que la transaction d'insertion est validée : le
   message est en base, lisible, et le trigger a déjà rendu `null`.
2. **Le bloc `exception when others` avale tout** en `RAISE WARNING`. Un WARNING
   n'atteint pas le client PostgREST, ne fait pas échouer l'insertion, et ne laisse
   de trace que dans les logs Postgres — que personne ne lit en régime normal.
   (Voir aussi la règle du marqueur `NEXUS:` : sans préfixe, un message d'erreur
   n'atteint jamais l'écran. Ici il n'atteint même pas le client.)
3. **`net._http_response` est élagué** par pg_net (rétention courte). Au moment du
   diagnostic la table ne contenait **qu'une seule ligne**. Une enquête faite le
   lendemain n'aurait rien trouvé du tout.

Résultat : un push qui échoue vraiment est **indiscernable** d'un push qui a réussi,
et les deux sont indiscernables d'un push jamais tenté.

## 4. Pourquoi ça bloque le palier 3

`notify_on_message` émet **un appel HTTP par destinataire**, et `send_admin_message`
insère **un message par destinataire**. Une diffusion à *tous les athlètes actifs*
produit donc N insertions × 1 appel chacune.

Si une réponse pour **un seul** destinataire prend ~8,9 s — ce qui est le cas mesuré,
pour 42 jetons — alors sous charge :

- chaque appel dépasse les 5 s et est marqué `timed_out` ;
- rien ne remonte à l'admin, qui voit « Message envoyé à N destinataires » (la RPC a
  bien fait son travail : les messages SONT en base) ;
- la file `net.http_request_queue` et le worker pg_net encaissent N appels
  concurrents, chacun retenu 5 s ;
- aucune reprise : pg_net **ne rejoue pas** un appel expiré.

Le palier 0 (un destinataire) masque entièrement le problème. Il ne se manifestera
qu'au premier envoi large — c'est-à-dire en production, sur de vrais utilisateurs.

## 5. Pistes (aucune retenue à ce stade)

1. **Timeout explicite.** `net.http_post(..., timeout_milliseconds := 30000)`.
   Une ligne. Corrige le faux négatif, mais garde N appels synchrones retenus long-
   temps, et ne dit toujours rien en cas d'échec réel. Emplâtre, pas remède.
2. **Découplage hors transaction.** Le trigger n'émet plus d'HTTP : il écrit une
   ligne dans une table de file (`push_outbox`), qu'un worker (cron `pg_cron`, ou
   l'edge function elle-même en pull) draine avec état, réessais et trace. C'est le
   patron *outbox*, et c'est la seule piste qui rend l'échec **visible et rejouable**.
3. **Envoi par lot.** `send-push` reçoit **une** requête portant N `user_id` plutôt
   que N requêtes. Réduit d'un facteur N le nombre d'appels ; à combiner avec (1),
   et ne résout toujours pas la visibilité.
4. **Regarder d'abord où passent les 8,9 s.** 42 jetons pour un utilisateur, c'est
   beaucoup — probablement des jetons périmés jamais purgés. Si `send-push` boucle
   séquentiellement sur des jetons morts en attendant chaque timeout FCM, le vrai
   correctif est la purge des jetons + un envoi parallèle côté fonction, et le
   problème de timeout disparaît en grande partie de lui-même.

**Ordre suggéré :** (4) pour mesurer, puis (2) pour la robustesse, (1) et (3) comme
mitigations immédiates si le palier 3 doit partir avant.

---

## Annexe — le dashboard athlète, décision produit non prise

Constaté au même moment, sans lien de cause : **`app/athlete/dashboard/page.tsx` ne
requête ni `conversations` ni `messages`.** Ses sources sont `athletes`,
`athlete_notifications`, `team_invitations`, `recruiter_athlete_views`,
`recruiter_favorites`, `users` et `recruiter_activity_log`.

Un message de service n'écrit dans aucune de ces tables. Le dashboard est donc muet
**par construction**, et il l'est autant pour un message de coach. Ce n'est pas un
filtre à corriger, c'est une surface qui n'existe pas.

Deux options, de coûts très différents, **aucune tranchée** :

- faire écrire `send_admin_message` dans `athlete_notifications` (migration, et une
  question de périmètre : tous les messages, ou seulement la catégorie `service` ?) ;
- donner au dashboard un compteur de messages non lus (code seul — le calcul existe
  déjà dans `lib/messaging/athleteUnread.ts`).

Le badge de la messagerie, lui, **a été corrigé** le 2026-08-23 sur les deux surfaces
(barre latérale web + barre d'onglets mobile) : il ignorait tous les types sauf
`ATHLETE_COACH`.
