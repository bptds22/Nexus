// Uploads the 3 legal PDFs to a `legal-documents` bucket in Supabase Storage.
// Creates the bucket (public read) if it doesn't exist.
//
// Reads SUPABASE_SERVICE_ROLE_KEY from .env.local — uses curl.exe instead of
// the JS SDK because the cloud REST endpoint rejects the new sb_secret_* keys
// when called via .NET WebRequest, but accepts them via curl.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = 'legal-documents';
const FILES = [
  { local: 'assets/legal/confidentialite.pdf', remote: 'confidentialite.pdf' },
  { local: 'assets/legal/conditions.pdf', remote: 'conditions.pdf' },
  { local: 'assets/legal/collecte-donnees.pdf', remote: 'collecte-donnees.pdf' },
];

// 1. Ensure bucket exists.
const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error('listBuckets failed:', listErr.message);
  process.exit(1);
}
const exists = buckets?.find((b) => b.name === BUCKET);
if (!exists) {
  console.log(`Creating bucket ${BUCKET}...`);
  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
  });
  if (createErr) {
    console.error('createBucket failed:', createErr.message);
    process.exit(1);
  }
  console.log(`Bucket ${BUCKET} created.`);
} else {
  console.log(`Bucket ${BUCKET} already exists.`);
}

// 2. Upload each PDF (upsert).
const urls = {};
for (const { local, remote } of FILES) {
  const file = readFileSync(local);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(remote, file, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (error) {
    console.error(`Upload failed for ${remote}: ${error.message}`);
    continue;
  }
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(remote);
  urls[remote] = publicUrl;
  console.log(`OK ${remote}: ${publicUrl}`);
}

console.log('\n=== URLs publiques ===');
console.log(JSON.stringify(urls, null, 2));
