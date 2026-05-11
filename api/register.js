import { getServiceClient, cors } from './_supabase.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password, first_name, last_name, role, address, city, postal_code, radius_km, lat, lng, phone } = req.body
  if (!email || !password || !first_name || !last_name)
    return res.status(400).json({ error: 'Pflichtfelder fehlen' })

  const sb = getServiceClient()

  // Check if first user → superadmin
  const { count } = await sb.from('profiles').select('*', { count: 'exact', head: true })
  const isFirst = count === 0

  const { data, error } = await sb.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: {
      first_name, last_name,
      role: isFirst ? 'superadmin' : (role || 'orderer'),
      address, city, postal_code,
      radius_km: radius_km || 5,
      lat, lng, phone
    }
  })
  if (error) return res.status(400).json({ error: error.message })

  // Sign in to get token
  const { data: session, error: signInErr } = await sb.auth.signInWithPassword({ email, password })
  if (signInErr) return res.status(400).json({ error: signInErr.message })

  const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single()
  res.json({ token: session.session.access_token, user: profile })
}
