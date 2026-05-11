import { getServiceClient, getUser, cors } from '../_supabase.js'
export default async function handler(req, res) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const user = await getUser(req); if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
  const { data } = await getServiceClient().from('assignments').select('*, requests(item_text,items,needed_by,status,shop_name_free,shops(name))').eq('bringer_id', user.id).order('created_at', { ascending: false })
  res.json((data || []).map(a => ({ ...a, item_text: a.requests?.item_text, needed_by: a.requests?.needed_by, req_status: a.requests?.status, shop_name: a.requests?.shops?.name, shop_name_free: a.requests?.shop_name_free, requests: undefined })))
}
