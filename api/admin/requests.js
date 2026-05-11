import { getServiceClient, getUser, cors } from '../_supabase.js'
export default async function handler(req, res) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const user = await getUser(req); if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
  const sb = getServiceClient()
  const { data: me } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'superadmin') return res.status(403).json({ error: 'Kein Zugriff' })
  const { data } = await sb.from('requests').select('*, profiles!requester_id(first_name,last_name,email), categories(name,icon), shops(name)').order('created_at', { ascending: false })
  res.json((data||[]).map(r => ({ ...r, requester_first: r.profiles?.first_name, requester_last: r.profiles?.last_name, requester_email: r.profiles?.email, category_name: r.categories?.name, category_icon: r.categories?.icon, shop_name: r.shops?.name, profiles: undefined, categories: undefined, shops: undefined })))
}
