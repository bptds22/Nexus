'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

type UserProfile = {
  id: string
  email: string
  role: string
  status: string
  first_name: string | null
  last_name: string | null
  school_id: string | null
  avatar_url: string | null
}

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Get initial session
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) {
        setUser(null)
        setLoading(false)
        return
      }

      supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
        .then(({ data }) => {
          setUser(data)
          setLoading(false)
        })
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session?.user) {
          setUser(null)
          return
        }

        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        setUser(data)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const isCoach     = user?.role === 'COACH'
  const isRecruteur = user?.role === 'RECRUTEUR'
  const isAthlete   = user?.role === 'ATHLETE'
  const isAdmin     = user?.role === 'ADMIN'

  return { user, loading, isCoach, isRecruteur, isAthlete, isAdmin }
}
