import { getServiceClient, cors } from './_supabase.js'
export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const { data } = await getServiceClient().from('categories').select('*').order('sort_order')
  res.json(data || [])
}
