import { getServiceClient, getUser, cors } from '../_supabase.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })

  const { id } = req.query
  const sb = getServiceClient()

  if (req.method === 'PATCH') {
    const { name, shop_type, address, city, lat, lng, phone, website, items, opening_hours, verified } = req.body
    const update = {}
    if (name          !== undefined) update.name          = name
    if (shop_type     !== undefined) update.shop_type     = shop_type
    if (address       !== undefined) update.address       = address
    if (city          !== undefined) update.city          = city
    if (lat           !== undefined) update.lat           = lat
    if (lng           !== undefined) update.lng           = lng
    if (phone         !== undefined) update.phone         = phone
    if (website       !== undefined) update.website       = website
    if (items         !== undefined) update.items         = items
    if (opening_hours !== undefined) update.opening_hours = opening_hours
    if (verified !== undefined) {
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'superadmin') update.verified = verified
    }
    const { data, error } = await sb.from('shops').update(update).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }
  res.status(405).end()
}
