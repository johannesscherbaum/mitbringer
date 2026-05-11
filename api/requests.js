import { getServiceClient, getUser, distKm, cors } from './_supabase.js'

const DAY_KEYS = ['su','mo','tu','we','th','fr','sa']

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const sb = getServiceClient()

  if (req.method === 'GET') {
    const { lat, lng } = req.query
    const { data: reqs } = await sb.from('requests')
      .select('*, profiles!requester_id(first_name,last_name,email,phone), categories(name,icon), shops(name,opening_hours)')
      .in('status', ['open','assigned'])
      .order('needed_by')

    if (!reqs) return res.json([])

    // Get assignments for bringer info
    const reqIds = reqs.map(r => r.id)
    const { data: asgns } = await sb.from('assignments')
      .select('request_id, bringer_id, profiles!bringer_id(first_name,last_name,phone)')
      .in('request_id', reqIds)

    const asgMap = {}
    for (const a of (asgns || [])) asgMap[a.request_id] = a

    const today = DAY_KEYS[new Date().getDay()]
    const uLat = lat ? parseFloat(lat) : null
    const uLng = lng ? parseFloat(lng) : null

    let rows = reqs.map(r => {
      const asgn = asgMap[r.id]
      const oh = r.shops?.opening_hours
      return {
        ...r,
        requester_first: r.profiles?.first_name,
        requester_last:  r.profiles?.last_name,
        requester_email: r.profiles?.email,
        requester_phone: r.profiles?.phone,
        category_name:   r.categories?.name,
        category_icon:   r.categories?.icon,
        shop_name:       r.shops?.name,
        shop_hours_today: oh ? (oh[today] || null) : undefined,
        bringer_id:    asgn?.bringer_id || null,
        bringer_first: asgn?.profiles?.first_name || null,
        bringer_last:  asgn?.profiles?.last_name  || null,
        bringer_phone: asgn?.profiles?.phone       || null,
        distance_km: (uLat && uLng && r.shops?.lat && r.shops?.lng)
          ? parseFloat(distKm(uLat, uLng, r.shops.lat, r.shops.lng).toFixed(1))
          : null,
        profiles: undefined, categories: undefined, shops: undefined
      }
    })

    if (uLat && uLng) {
      rows.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999))
    }
    return res.json(rows)
  }

  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })

  if (req.method === 'POST') {
    const { items, item_text, category_id, shop_id, shop_name_free, needed_by, delivery_address } = req.body
    if (!needed_by) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
    const itemsList = items?.length > 0 ? items : [{ text: item_text }]
    if (!itemsList[0]?.text) return res.status(400).json({ error: 'Mindestens ein Artikel benötigt' })

    const { data, error } = await sb.from('requests').insert({
      requester_id: user.id,
      item_text: itemsList.map(i => i.text).join(', '),
      items: itemsList,
      category_id: category_id || null,
      shop_id: shop_id || null,
      shop_name_free: shop_name_free || null,
      needed_by, delivery_address: delivery_address || null
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })

    // Auto-learn items into shop
    if (shop_id) {
      const { data: shop } = await sb.from('shops').select('items').eq('id', shop_id).single()
      if (shop) {
        const existing = shop.items || []
        const toAdd = itemsList.map(i => i.text.trim()).filter(t => !existing.some(e => e.toLowerCase() === t.toLowerCase()))
        if (toAdd.length > 0) await sb.from('shops').update({ items: [...existing, ...toAdd] }).eq('id', shop_id)
      }
    }
    return res.json(data)
  }
  res.status(405).end()
}
