# Registre — migration « réponse à l'admin », en attente du déblocage D6

**Statut : RÉDIGÉE ICI, NON ÉCRITE, NON APPLIQUÉE.** Aucun fichier
`supabase/migrations/*` n'existe pour ce chantier — c'est délibéré : la
discipline D6 est bloquée (`supabase db reset` échoue à 324 migrations, quatre
migrations portent des assertions sur des données de prod, quatre empreintes
`md5(prosrc)` divergent local↔prod). On ne pose pas une ouverture d'écriture
qu'on ne peut pas prouver hors prod.

Les binaires 1.4.1 sont **déjà prêts** et attendent l'interrupteur.

---

## Ce que la migration doit faire — trois gestes, pas un de plus

### 1. Élargir `enforce_admin_thread_readonly`

Le trigger `trg_admin_thread_readonly` refuse aujourd'hui toute insertion dont
l'expéditeur n'est pas l'identité de service. Son propre commentaire porte le
mode d'emploi :

> « v2 (ouverture de la réponse) : élargir CETTE condition, et rien d'autre. »

La condition doit accepter, en plus de l'identité de service, **l'expéditeur
qui est partie au fil** — `is_conversation_participant(NEW.conversation_id,
NEW.sender_id)` couvre déjà exactement ce périmètre, `ADMIN_USER` et `admin_id`
compris. Ne rien élargir d'autre.

### 2. Une policy INSERT `ADMIN_USER`, pour les TROIS rôles

Nécessaire, et pas seulement par confort :

- `athlete_messages_insert` est bornée à `ATHLETE_COACH` → **l'athlète est
  bloqué par la RLS** même une fois le trigger ouvert.
- `messages_insert` exige `role = COACH`, **ou** `RECRUTEUR` **avec
  `user_has_pro()`** → un recruteur gratuit resterait bloqué.

**SANS `user_has_pro()`.** Arbitrage BP : le support n'est jamais payant. C'est
précisément la population visée — « les gens ont des questions et n'écrivent
pas de courriel ».

### 3. Poser le drapeau, dans le MÊME apply

```sql
insert into public.app_settings (key, value, type, description)
values ('admin_reply_open', 'true', 'BOOLEAN',
        'Ouvre le composeur des fils ADMIN_USER dans les apps')
on conflict (key) do update set value = 'true';
```

C'est l'interrupteur que les binaires lisent. **Il doit basculer dans la même
transaction que les deux gestes ci-dessus** : posé avant, les apps montrent un
composeur que la base refuse encore (le chemin défensif rattrape, mais il
affiche « Les réponses ouvrent bientôt » à des gens qui viennent d'écrire).

---

## Ce qu'il ne faut PAS faire

- **Aucun nouvel index.** Les trois index d'unicité admin existent déjà en
  prod : `conversations_admin_athlete_uniq`, `conversations_admin_coach_uniq`,
  `conversations_admin_recruiter_uniq`. Ce sont des index PARTIELS
  (`WHERE conversation_type = 'ADMIN_USER'`), tout comme
  `uq_conversations_recruteur_coach` et `uq_conversations_recruteur_athlete`
  posés au volet 2 — ils ne se voient pas, il n'y a rien à arbitrer entre eux.
- **Aucune touche au CHECK `conversations_participants_by_type`.** Sa branche
  `ADMIN_USER` est correcte et borne déjà le fil à exactement une contrepartie.
- **Aucune touche à `notify_on_message`.** Elle porte déjà `c.admin_id` dans
  les destinataires d'un fil `ADMIN_USER` : la notification de la réponse vers
  l'admin partira sans une ligne de plus.

---

## Vérification après apply

```sql
-- 1. le drapeau est posé
select value from public.app_settings where key = 'admin_reply_open';  -- true

-- 2. les trois rôles peuvent insérer (à jouer sous chaque identité)
--    attendu : succès, et PAS « NEXUS: ce message ne peut pas recevoir de réponse. »

-- 3. l'isolation tient toujours — un user ne voit QUE son fil
select count(*) from public.conversations where conversation_type = 'ADMIN_USER';
--    sous une identité utilisateur : 1 (le sien), jamais 81
```

Puis, sans rien relivrer : **rouvrir l'app sur un binaire 1.4.1 déjà installé.**
Le composeur doit apparaître seul (le drapeau est mis en cache 5 min côté
client — patienter ou forcer un redémarrage de l'app).

---

## Le repli, si ça tourne mal

`update public.app_settings set value = 'false' where key = 'admin_reply_open';`

Les apps se reverrouillent au prochain rafraîchissement du cache, sans
livraison. Le trigger peut rester ouvert : sans drapeau, aucune app ne propose
le composeur.
