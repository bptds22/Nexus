import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── Route access rules per role ───────────────────────────────
const ROLE_ROUTES: Record<string, string[]> = {
  COACH:     ['/coach'],
  RECRUTEUR: ['/recruteur'],
  ATHLETE:   ['/athlete'],
  ADMIN:     ['/admin', '/coach', '/recruteur', '/athlete'],
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Public routes — always accessible
  const publicRoutes = ['/', '/auth', '/auth/pro', '/pricing', '/api']
  const isPublic = publicRoutes.some(r => path.startsWith(r)) ||
                   path.startsWith('/_next') ||
                   path.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)

  // Not logged in → redirect to /auth
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  // Logged in — check role-based access
  if (user) {
    const role = user.user_metadata?.role as string

    // Wrong portal → redirect to correct one
    if (path.startsWith('/coach') && role === 'RECRUTEUR') {
      const url = request.nextUrl.clone()
      url.pathname = '/recruteur'
      return NextResponse.redirect(url)
    }
    if (path.startsWith('/recruteur') && role === 'COACH') {
      const url = request.nextUrl.clone()
      url.pathname = '/coach'
      return NextResponse.redirect(url)
    }
    if (path.startsWith('/admin') && role !== 'ADMIN') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
