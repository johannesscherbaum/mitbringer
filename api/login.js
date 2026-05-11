import { getServiceClient, cors } from './_supabase.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body
  const sb = getServiceClient()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) return res.status(401).json({ error: error.message })

  const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single()
  res.json({ token: data.session.access_token, user: profile })
}
