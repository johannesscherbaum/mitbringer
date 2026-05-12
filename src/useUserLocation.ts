import { useState, useEffect } from 'react'
import { UserProfile } from './AuthContext'

const FALLBACK = { lat: 49.4401, lng: 11.8626 } // Amberg

export function useUserLocation(profile: UserProfile | null) {
  const [location, setLocation] = useState<{ lat: number; lng: number }>(FALLBACK)

  useEffect(() => {
    if (!profile) return

    // 1. Profile already has coords — use immediately
    if ((profile as any).lat && (profile as any).lng) {
      setLocation({ lat: (profile as any).lat, lng: (profile as any).lng })
      return
    }

    // 2. Geocode from address
    if (profile.address || profile.city) {
      const q = [profile.address, (profile as any).postal_code, profile.city]
        .filter(Boolean).join(', ') + ', Germany'
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`)
        .then(r => r.json())
        .then(d => {
          if (d.length > 0) setLocation({ lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) })
          else setLocation(FALLBACK)
        })
        .catch(() => setLocation(FALLBACK))
      return
    }

    setLocation(FALLBACK)
  }, [profile?.id, (profile as any)?.lat, (profile as any)?.lng, profile?.address, profile?.city])

  return location
}
