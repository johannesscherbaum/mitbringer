import { useState, useEffect } from 'react'
import { UserProfile } from './AuthContext'

const FALLBACK = { lat: 49.4401, lng: 11.8626 } // Amberg

function coordsFromProfile(profile: UserProfile | null) {
  if (!profile) return null
  const lat = (profile as any).lat
  const lng = (profile as any).lng
  if (lat && lng) return { lat: Number(lat), lng: Number(lng) }
  return null
}

export function useUserLocation(profile: UserProfile | null) {
  // Initialize directly from profile if coords available — no delay
  const [location, setLocation] = useState<{ lat: number; lng: number }>(
    () => coordsFromProfile(profile) ?? FALLBACK
  )

  useEffect(() => {
    if (!profile) return

    // 1. Profile has coords — use immediately
    const coords = coordsFromProfile(profile)
    if (coords) {
      setLocation(coords)
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
