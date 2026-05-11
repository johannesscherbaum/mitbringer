import { getServiceClient, getUser, cors } from './_supabase.js'

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
  if (req.method !== 'POST') return res.status(405).end()

  const { request_id } = req.body
  const sb = getServiceClient()
  const { data: r } = await sb.from('requests').select('*').eq('id', request_id).single()
  if (!r) return res.status(404).json({ error: 'Anfrage nicht gefunden' })
  if (r.status !== 'open') return res.status(400).json({ error: 'Anfrage nicht mehr offen' })
  if (r.requester_id === user.id) return res.status(400).json({ error: 'Eigene Anfragen nicht annehmbar' })

  const { error: aErr } = await sb.from('assignments').insert({ request_id, bringer_id: user.id })
  if (aErr) return res.status(409).json({ error: 'Bereits angenommen' })
  await sb.from('requests').update({ status: 'assigned' }).eq('id', request_id)
  res.json({ ok: true })
}
