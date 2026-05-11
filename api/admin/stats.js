import { getServiceClient, getUser, cors } from '../_supabase.js'
export default async function handler(req, res) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const user = await getUser(req); if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
  const sb = getServiceClient()
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'superadmin') return res.status(403).json({ error: 'Kein Zugriff' })
  const [u, r, a, s] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }),
    sb.from('requests').select('status'),
    sb.from('assignments').select('*', { count: 'exact', head: true }),
    sb.from('shops').select('*', { count: 'exact', head: true }),
  ])
  const reqs = r.data || []
  res.json({ users: u.count, requests: reqs.length, open: reqs.filter(x=>x.status==='open').length, assigned: reqs.filter(x=>x.status==='assigned').length, completed: reqs.filter(x=>x.status==='completed').length, cancelled: reqs.filter(x=>x.status==='cancelled').length, assignments: a.count, shops: s.count })
}
