import React, { createContext, useContext, useEffect, useState } from 'react'
import { api, setToken, clearToken, hasToken } from './api'
import supabase from './supabase'

export interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'orderer' | 'bringer' | 'both' | 'superadmin'
  address?: string
  city?: string
  postal_code?: string
  radius_km?: number
  rating?: number
  rating_count?: number
  phone?: string | null
  lat?: number | null
  lng?: number | null
}

export interface MfaChallenge {
  factorId: string
  challengeId: string
  email: string
  password: string
}

interface Ctx {
  profile: UserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ mfa?: MfaChallenge }>
  verifyMfa: (challenge: MfaChallenge, code: string) => Promise<void>
  register: (data: Record<string, unknown>) => Promise<void>
  signOut: () => void
  refreshProfile: () => Promise<void>
}

const AuthCtx = createContext<Ctx>({
  profile: null, loading: true,
  login: async () => ({}), verifyMfa: async () => {},
  register: async () => {}, signOut: () => {}, refreshProfile: async () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (hasToken()) {
      api.me().then(setProfile).catch(() => clearToken()).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email: string, password: string): Promise<{ mfa?: MfaChallenge }> {
    const { data: sbData, error: sbErr } = await supabase.auth.signInWithPassword({ email, password })
    if (sbErr) throw new Error(sbErr.message)

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      const factors = sbData.user?.factors?.filter((f: any) => f.status === 'verified') || []
      const totp = factors.find((f: any) => f.factor_type === 'totp')
      if (totp) {
        const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: totp.id })
        if (cErr) throw new Error(cErr.message)
        await supabase.auth.signOut()
        return { mfa: { factorId: totp.id, challengeId: challenge.id, email, password } }
      }
    }

    await supabase.auth.signOut()
    const { token, user } = await api.login(email, password)
    setToken(token); setProfile(user)
    return {}
  }

  async function verifyMfa(challenge: MfaChallenge, code: string) {
    await supabase.auth.signInWithPassword({ email: challenge.email, password: challenge.password })
    const { error } = await supabase.auth.mfa.verify({
      factorId: challenge.factorId,
      challengeId: challenge.challengeId,
      code: code.replace(/\s/g, '')
    })
    if (error) throw new Error('Ungültiger Code')
    await supabase.auth.signOut()
    const { token, user } = await api.login(challenge.email, challenge.password)
    setToken(token); setProfile(user)
  }

  async function register(data: Record<string, unknown>) {
    const { token, user } = await api.register(data)
    setToken(token); setProfile(user)
  }

  function signOut() { clearToken(); setProfile(null) }
  async function refreshProfile() { const user = await api.me(); setProfile(user) }

  return (
    <AuthCtx.Provider value={{ profile, loading, login, verifyMfa, register, signOut, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
