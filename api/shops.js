import { getServiceClient, getUser, distKm, cors } from './_supabase.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const sb = getServiceClient()

  if (req.method === 'GET') {
    const { lat, lng, radius } = req.query
    let { data: shops } = await sb.from('shops').select('*').order('name')
    if (!shops) return res.json([])

    if (lat && lng) {
      const uLat = parseFloat(lat), uLng = parseFloat(lng)
      shops = shops.map(s => ({
        ...s,
        distance_km: s.lat && s.lng ? parseFloat(distKm(uLat, uLng, s.lat, s.lng).toFixed(1)) : null
      }))
      if (radius) shops = shops.filter(s => s.distance_km == null || s.distance_km <= parseFloat(radius))
      shops.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999))
    }
    return res.json(shops)
  }

  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })

  if (req.method === 'POST') {
    const { name, shop_type, address, city, lat, lng, phone, website, items, opening_hours } = req.body
    if (!name || !city) return res.status(400).json({ error: 'Name und Stadt sind Pflicht' })
    const { data, error } = await sb.from('shops').insert({ name, shop_type, address, city, lat, lng, phone, website, items: items || [], opening_hours }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  res.status(405).end()
}
