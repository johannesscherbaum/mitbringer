import { getServiceClient, getUser, cors } from '../_supabase.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })

  const { id } = req.query
  const sb = getServiceClient()

  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'superadmin'

  if (req.method === 'PATCH') {
    const { status, items, item_text, needed_by, delivery_address, shop_name_free } = req.body
    const { data: r } = await sb.from('requests').select('requester_id,status').eq('id', id).single()
    if (!r) return res.status(404).json({ error: 'Nicht gefunden' })
    if (r.requester_id !== user.id && !isAdmin) return res.status(403).json({ error: 'Keine Berechtigung' })

    const update = {}
    if (status           !== undefined) update.status           = status
    if (items            !== undefined) { update.items = items; update.item_text = items.map(i => i.text).join(', ') }
    if (item_text        !== undefined) update.item_text        = item_text
    if (needed_by        !== undefined) update.needed_by        = needed_by
    if (delivery_address !== undefined) update.delivery_address = delivery_address
    if (shop_name_free   !== undefined) update.shop_name_free   = shop_name_free

    const { data, error } = await sb.from('requests').update(update).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  if (req.method === 'DELETE') {
    const { data: r } = await sb.from('requests').select('requester_id').eq('id', id).single()
    if (!r) return res.status(404).json({ error: 'Nicht gefunden' })
    if (r.requester_id !== user.id && !isAdmin) return res.status(403).json({ error: 'Keine Berechtigung' })
    await sb.from('assignments').delete().eq('request_id', id)
    await sb.from('requests').delete().eq('id', id)
    return res.json({ ok: true })
  }
  res.status(405).end()
}
