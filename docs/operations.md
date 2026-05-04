# Operations Runbook — Nexus

Operational notes for hand-run workflows that touch production data:
hot-fixes via Studio, cleanup scripts, manual data prep. App-driven
flows are documented in code; this file covers the off-app paths.

---

## Photo upload — Studio loophole

When uploading athlete photos via the Supabase Studio UI for any
reason (test data, hot-fix, manual data prep), do NOT paste the
output of Studio's "Get URL" button into `athletes.photo_url`.
Studio's default is a signed URL with 7-day expiry, even for public
buckets.

The DB enforces this with a CHECK constraint
(`photo_url_not_signed`) — attempts to insert a signed URL will
error with `new row for relation "athletes" violates check
constraint`.

Construct the public URL by hand:

```
${SUPABASE_URL}/storage/v1/object/public/Ath%20Photos/${path}
```

For the `avatars` bucket use `avatars` instead of `Ath Photos`.
Note the URL-encoded space in `Ath%20Photos`.

App-driven uploads use `getPublicUrl()` which returns the correct
form automatically — this only matters for off-app data prep.
