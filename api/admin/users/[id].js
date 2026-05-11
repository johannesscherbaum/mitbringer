import { getServiceClient, getUser, cors } from '../../../_supabase.js'
export default async function handler(req, res) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const user = await getUser(req); if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
  const sb = getServiceClient()
  const { data: me } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'superadmin') return res.status(403).json({ error: 'Kein Zugriff' })
  const { id } = req.query
  if (req.method === 'PATCH') {
    const { role } = req.body
    if (!['orderer','bringer','both','superadmin'].includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' })
    const { data, error } = await sb.from('profiles').update({ role }).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }
  if (req.method === 'DELETE') {
    if (id === user.id) return res.status(400).json({ error: 'Eigenen Account nicht löschbar' })
    await sb.from('assignments').delete().eq('bringer_id', id)
    await sb.from('requests').delete().eq('requester_id', id)
    await sb.from('profiles').delete().eq('id', id)
    await sb.auth.admin.deleteUser(id)
    return res.json({ ok: true })
  }
  res.status(405).end()
}
