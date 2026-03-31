import { createClient } from '@/lib/supabase/client'

// ── SIGN UP ──────────────────────────────────────────────────
// role: 'COACH' | 'RECRUTEUR' | 'ATHLETE'
export async function signUp(
  email: string,
  password: string,
  role: 'COACH' | 'RECRUTEUR' | 'ATHLETE',
  firstName: string,
  lastName: string
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
      },
    },
  })

  if (error) return { error }

  // Update first_name / last_name in public.users
  if (data.user) {
    await supabase
      .from('users')
      .update({ first_name: firstName, last_name: lastName })
      .eq('id', data.user.id)
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
