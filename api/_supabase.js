import { createClient } from '@supabase/supabase-js'

export function getSupabase(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}
  )
}

export function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
}

// Haversine distance in km
export function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Verify JWT and return user
export async function getUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const sb = getServiceClient()
  const { data: { user } } = await sb.auth.getUser(token)
  return user
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}
