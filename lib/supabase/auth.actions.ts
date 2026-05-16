import { createClient } from '@/lib/supabase/client'

// ── SIGN UP ──────────────────────────────────────────────────
// role: 'COACH' | 'RECRUTEUR' | 'ATHLETE'
// context (optional): 'scolaire' | 'collegial' | 'ligue_civile'
//   — discriminates the onboarding flow for COACH between school
//     and civil-league branches. Phase 6.2 dropped any coach_league
//     pseudo-role; the wizard now switches on users.context.
//
// public.users row is created entirely by the handle_new_auth_user
// trigger on auth.users (migration 20260516150000), which reads
// role / first_name / last_name / context from raw_user_meta_data
// (set via options.data below). The trigger is SECURITY DEFINER so
// it bypasses RLS + GRANT — necessary because the only INSERT
// policy on public.users is TO service_role, and a client-side
// INSERT/upsert from `authenticated` reliably returned 42501.
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

  // No client-side public.users write here on purpose. The
  // handle_new_auth_user trigger on auth.users (migration
  // 20260516150000) reads role / first_name / last_name / context
  // out of raw_user_meta_data (set above in options.data) and writes
  // the full public.users row as SECURITY DEFINER. That bypasses
  // RLS + GRANT, which is what we need — the only INSERT policy on
  // public.users is TO service_role, so any client-side INSERT or
  // upsert from `authenticated` fails 42501.

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
