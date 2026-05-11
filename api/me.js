import { getServiceClient, getUser, cors } from './_supabase.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })

  const sb = getServiceClient()

  if (req.method === 'GET') {
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).single()
    if (error) return res.status(404).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'PATCH') {
    const { radius_km, address, city, postal_code, lat, lng, phone } = req.body
    const update = {}
    if (radius_km   !== undefined) update.radius_km   = radius_km
    if (address     !== undefined) update.address     = address
    if (city        !== undefined) update.city        = city
    if (postal_code !== undefined) update.postal_code = postal_code
    if (lat         !== undefined) update.lat         = lat
    if (lng         !== undefined) update.lng         = lng
    if (phone       !== undefined) update.phone       = phone || null
    const { data, error } = await sb.from('profiles').update(update).eq('id', user.id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  res.status(405).end()
}
