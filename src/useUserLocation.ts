import { useState, useEffect } from 'react'
import { UserProfile } from './AuthContext'

// Amberg als letzter Fallback
const FALLBACK = { lat: 49.4401, lng: 11.8626 }

export function useUserLocation(profile: UserProfile | null) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!profile) return

    // 1. Profil hat bereits Koordinaten
    if (profile.lat && profile.lng) {
      setLocation({ lat: profile.lat, lng: profile.lng })
      return
    }

    // 2. Adresse geocodieren
    if (profile.address || profile.city) {
      const q = [profile.address, profile.postal_code, profile.city]
        .filter(Boolean).join(', ') + ', Germany'
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`)
        .then(r => r.json())
        .then(d => {
          if (d.length > 0) {
            setLocation({ lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) })
          } else {
            setLocation(FALLBACK)
          }
        })
        .catch(() => setLocation(FALLBACK))
      return
    }

    // 3. Fallback
    setLocation(FALLBACK)
  }, [profile?.id, profile?.lat, profile?.lng, profile?.address, profile?.city])

  return location ?? FALLBACK
}
