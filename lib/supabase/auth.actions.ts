import { createClient } from '@/lib/supabase/client'

// ── SIGN UP ──────────────────────────────────────────────────
// role: 'COACH' | 'RECRUTEUR' | 'ATHLETE'
//
// Works in tandem with the `handle_new_auth_user` trigger on auth.users
// (migration 20260423030000). The trigger mirrors the signup into
// public.users from auth.raw_user_meta_data in the common case. The
// upsert below is a belt-and-braces fallback so this helper is
// functionally independent of the trigger — if the trigger is ever
// disabled or fails, the row still ends up in public.users.
export async function signUp(
  email: string,
  password: string,
  role: 'COACH' | 'RECRUTEUR' | 'ATHLETE',
  firstName: string,
  lastName: string,
  extraMetadata?: Record<string, unknown>
) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,           // stored in raw_user_meta_data → triggers handle_new_auth_user
        first_name: firstName,
        last_name: lastName,
        ...(extraMetadata ?? {}),
      },
    },
  })

  if (error) return { error }

  // Defensive upsert: idempotent against the trigger. Common path =
  // trigger wrote the row first, this upsert hits the id-conflict and
  // no-ops on already-correct columns. Failure path = trigger missing,
  // this creates the row. We log but don't hard-fail — the auth
  // session is already valid and the user can sign in regardless; any
  // downstream issues will surface as real symptoms against a missing
  // public.users row.
  if (data.user) {
    const { error: upsertError } = await supabase
      .from('users')
      .upsert({
        id: data.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        status: 'ACTIF',
      }, { onConflict: 'id' })

    if (upsertError) {
      console.error('[signUp] public.users upsert warning:', upsertError)
    }
  }

  return { data }
}

// ── SIGN IN ──────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) return { error }
  return { data }
}

// ── SIGN OUT ─────────────────────────────────────────────────
export async function signOut() {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  return { error }
}

// ── GET CURRENT USER + ROLE ───────────────────────────────────
export async function getCurrentUser() {
  const supabase = createClient()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

// ── GET ROLE FROM SESSION (fast — no DB query) ────────────────
export async function getRole(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  return (session.user.user_metadata?.role as string) ?? null
}
