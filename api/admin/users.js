import { getServiceClient, getUser, cors } from '../_supabase.js'
export default async function handler(req, res) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const user = await getUser(req); if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
  const sb = getServiceClient()
  const { data: me } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'superadmin') return res.status(403).json({ error: 'Kein Zugriff' })
  const { data } = await sb.from('profiles').select('*').order('created_at')
  res.json(data || [])
}
