import { getServiceClient, getUser, cors } from '../_supabase.js'
export default async function handler(req, res) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const user = await getUser(req); if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
  const { data } = await getServiceClient().from('requests').select('*, shops(name), categories(name)').eq('requester_id', user.id).order('created_at', { ascending: false })
  res.json((data || []).map(r => ({ ...r, shop_name: r.shops?.name, category_name: r.categories?.name, shops: undefined, categories: undefined })))
}
