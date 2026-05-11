import React, { createContext, useContext, useEffect, useState } from 'react'
import { api, setToken, clearToken, hasToken } from './api'

export interface UserProfile {
  id: number
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

interface Ctx {
  profile: UserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: Record<string, unknown>) => Promise<void>
  signOut: () => void
  refreshProfile: () => Promise<void>
}

const AuthCtx = createContext<Ctx>({
  profile: null, loading: true,
  login: async () => {}, register: async () => {},
  signOut: () => {}, refreshProfile: async () => {}
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

  async function login(email: string, password: string) {
    const { token, user } = await api.login(email, password)
    setToken(token); setProfile(user)
  }

  async function register(data: Record<string, unknown>) {
    const { token, user } = await api.register(data)
    setToken(token); setProfile(user)
  }

  function signOut() { clearToken(); setProfile(null) }

  async function refreshProfile() {
    const user = await api.me(); setProfile(user)
  }

  return (
    <AuthCtx.Provider value={{ profile, loading, login, register, signOut, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
