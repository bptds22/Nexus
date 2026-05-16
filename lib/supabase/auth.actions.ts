import { createClient } from '@/lib/supabase/client'

// ── SIGN UP ──────────────────────────────────────────────────
// role: 'COACH' | 'RECRUTEUR' | 'ATHLETE'
// context (optional): 'scolaire' | 'collegial' | 'ligue_civile'
//   — discriminates the onboarding flow for COACH between school
//     and civil-league branches. Phase 6.2 dropped any coach_league
//     pseudo-role; the wizard now switches on users.context.
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
  extraMetadata?: Record<string, unknown>,
  context?: 'scolaire' | 'collegial' | 'ligue_civile',
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
        ...(context ? { context } : {}),
        ...(extraMetadata ?? {}),
      },
    },
  })

  if (error) return { error }

  // UPDATE the missing fields. The handle_new_auth_user trigger
  // (SECURITY DEFINER) already inserted the row with id, email, role,
  // status — see pg function. The previous defensive `upsert` here
  // hit code 42501 because authenticated has no INSERT grant on
  // public.users (only service_role does, via the "Service role can
  // insert users" policy). PostgREST's upsert sends INSERT...ON
  // CONFLICT, and even when the conflict branch would take the UPDATE
  // path, the INSERT permission check still has to pass — it didn't.
  // Pure UPDATE goes through "users update own" (id = auth.uid()),
  // which authenticated does have, so this lands the remaining
  // fields without touching the GRANT or RLS.
  //
  // `context` is the school/league/CÉGEP discriminator (DB CHECK:
  // 'scolaire' | 'collegial' | 'ligue_civile'). The trigger doesn't
  // read it from raw_user_meta_data, so this UPDATE is the only path
  // that lands it in public.users.context — keep it in sync if the
  // trigger is ever extended.
  if (data.user) {
    const { error: updateError } = await supabase
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        ...(context ? { context } : {}),
      })
      .eq('id', data.user.id)

    if (updateError) {
      // Non-blocking — the auth session is already valid. The
      // onboarding wizard re-writes most of these fields per-step
      // anyway and can recover from a missed initial seed.
      console.error('[signUp] public.users update failed:', updateError.message)
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
