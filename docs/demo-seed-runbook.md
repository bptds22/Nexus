# Demo / Beta Seed — Runbook

**One-line summary:** every demo row is tagged by the email pattern
`demo+%@nexussports.ca`. Seeding and teardown are a matched pair. Teardown is a
single ordered transaction that returns every table to its pre-seed count.
**The wipe is a one-command, count-reversible operation — not a launch-day improvisation.**

Files (in `supabase/seed/`):

| File | Purpose |
|---|---|
| `demo_baseline.sql` | Read-only count snapshot. Run before seed, after seed, after teardown. |
| `demo_batch_test.sql` | Seeds a 2-athlete + 1-recruiter batch to rehearse the logic. |
| `demo_batch_test_teardown.sql` | Reverts the batch. Proves the logic before the full run. |
| `demo_seed.sql` | The full 37-account seed (4 recruiters, 3 coaches, 30 athletes). |
| `demo_teardown.sql` | **The launch-day wipe.** Ordered, transactional, reversible. |

---

## The anchor (why teardown is one predicate)

Every demo user — athletes, coaches, recruiters, and later the self-registered
beta friends — uses an email of the form `demo+<something>@nexussports.ca`.
Nothing else tags demo data. Consequences:

- Teardown resolves all demo entities from `users.email LIKE 'demo+%@nexussports.ca'`.
- The two admin accounts (`bpdesfosses@gmail.com`, the SUPER_ADMIN login) never
  match the pattern, so **they are never touched** by any demo operation.
- Beta friends are told to register as `demo+<name>@nexussports.ca`, so they fold
  into the exact same teardown with zero extra work.

---

## Why teardown is ORDERED, not a cascade (the audited gotchas)

1. **`users → athletes` is SET NULL**, not cascade. Deleting users first would
   orphan athletes *and* erase the email anchor. So the script **stashes athlete
   ids first**, before deleting anything.
2. **4 child tables are NO ACTION** (they *block* an athlete delete):
   `recruiter_favorites`, `recruiter_notes`, `recruiter_athlete_views`,
   `recruiter_pipeline`. These are deleted **before** athletes.
3. The other ~21 children are **ON DELETE CASCADE** — deleting athletes fans
   them out automatically.

Order: stash → delete 4 NO-ACTION children → delete subscriptions/badges/evals →
delete athletes (cascade) → delete users → delete `auth.users`.

---

## Why the kanban statuses are coherent (the trigger contract)

`trg_sync_global_status` on `recruiter_pipeline` propagates pipeline stage to
`athletes.recruitment_status`, **but only for pro/all_star recruiters**. All 4
demo recruiters are seeded `all_star` (step 2 of the seed) so the cascade fires.

- Athletes **in** a pipeline: status is set **by the cascade** from their highest
  stage (ENGAGE/LETTRE_SIGNEE→RECRUTE, EN_DISCUSSION/VISITE_PLANIFIEE→EN_PROCESSUS,
  IDENTIFIE/CONTACTE→OUVERT). The seed does NOT hand-set these.
- Athletes with **no** pipeline row: the cascade never fires, so the seed sets
  their status explicitly (step 7) — OUVERT for most, RETIRE for one.

This is why the seed order is users → subs → athletes → pipeline → quiet-update.
Changing the order breaks status/column coherence.

---

## Photos

15 athletes (`demo+ath01..15`) have a `photo_url`; 15 do not (realistic).
`photo_url` stores a **full public URL** into the `avatars` bucket:

```
<photo_host>/storage/v1/object/public/avatars/demo-ath-NN.jpg
```

`<photo_host>` is the single `\set photo_host` line at the top of `demo_seed.sql`.
**Change that one line when moving local → OVH.**

- Local: `http://localhost:54321` (confirm port via `supabase status`)
- OVH:   `https://<your-supabase-domain>`

**You upload the 15 image files** to the `avatars` bucket (Studio → Storage →
avatars), named exactly `demo-ath-01.jpg` … `demo-ath-15.jpg`. They must be
adult / AI-adult faces — never real or realistic minors, even though profiles
read as 14–17. The age field is fiction; the face cannot be.

**Storage note:** teardown deletes DB rows, not Storage objects. After a wipe,
the 15 image files remain in the bucket (harmless, 15 files). For a fully clean
revert, delete them manually in Studio, or leave them — re-seeding reuses the
same filenames.

---

## Apply commands (byte-safe, accents preserved)

The seed contains accented French. Pipe through `docker exec` to avoid the
PowerShell accent-mangling issue.

### Local (Docker container `supabase_db_Nexus`)

```powershell
# copy files into the container, then run with psql -f (preserves UTF-8)
docker cp supabase\seed\demo_baseline.sql        supabase_db_Nexus:/tmp/
docker cp supabase\seed\demo_seed.sql            supabase_db_Nexus:/tmp/
docker cp supabase\seed\demo_teardown.sql        supabase_db_Nexus:/tmp/
docker cp supabase\seed\demo_batch_test.sql      supabase_db_Nexus:/tmp/
docker cp supabase\seed\demo_batch_test_teardown.sql supabase_db_Nexus:/tmp/

# run one:
docker exec -i supabase_db_Nexus psql -U postgres -d postgres -f /tmp/demo_seed.sql
```

### OVH (when stood up)

Same pattern, pointed at the OVH Postgres connection string:

```bash
psql "postgresql://postgres:<pw>@<ovh-host>:5432/postgres" -f demo_seed.sql
```

Remember to change the `\set photo_host` line first, and re-upload the 15 photos
to the OVH `avatars` bucket.

---

## The proven sequence (do it in this order, every time)

```
# 1. BASELINE — capture the "before"
psql -f demo_baseline.sql   > before.txt

# 2. REHEARSE on a tiny batch (non-negotiable first run)
psql -f demo_batch_test.sql
psql -f demo_baseline.sql   > after_batch_seed.txt     # counts went up
psql -f demo_batch_test_teardown.sql
psql -f demo_baseline.sql   > after_batch_teardown.txt
#    -> diff before.txt after_batch_teardown.txt  MUST be identical (bar timestamp)
#    -> only proceed if it is.

# 3. FULL SEED
psql -f demo_seed.sql
psql -f demo_baseline.sql   > after_full_seed.txt       # 37 demo users, status spread
#    -> upload the 15 photos to the avatars bucket
#    -> take marketing screenshots / run beta

# 4. LAUNCH-DAY WIPE
psql -f demo_teardown.sql
psql -f demo_baseline.sql   > after_teardown.txt
#    -> diff before.txt after_teardown.txt  MUST be identical (bar timestamp)
#    -> that equality IS the proof the wipe was clean. Now go live.
```

---

## THE LAUNCH-DAY TEARDOWN COMMAND (the one to remember)

```powershell
docker exec -i supabase_db_Nexus psql -U postgres -d postgres -f /tmp/demo_teardown.sql
```

(or the OVH `psql "<conn>" -f demo_teardown.sql` equivalent)

Then run `demo_baseline.sql` and confirm the demo-tagged counts are all **0** and
the global counts match `before.txt`. Done.

---

## Beta accounts (separate from this seed)

The marketing demo above is `public.users`-only and sufficient for screenshots
and recruiter-side browsing. For the **beta**, friends self-register (real
`auth.users`) using `demo+<name>@nexussports.ca`. You then elevate them manually
(role + `subscriptions.tier='all_star'`). Because they share the anchor, the same
`demo_teardown.sql` removes them — including the `auth.users` rows (step 5).
