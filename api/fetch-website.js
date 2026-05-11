import { getUser, cors } from './_supabase.js'
export default async function handler(req, res) {
  cors(res); if (req.method === 'OPTIONS') return res.status(200).end()
  const user = await getUser(req); if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
  const { url } = req.query; if (!url) return res.status(400).json({ error: 'URL fehlt' })
  try {
    const target = url.startsWith('http') ? url : 'https://' + url
    const r = await fetch(target, { headers: { 'User-Agent': 'Mitbringer-App/1.0' }, signal: AbortSignal.timeout(5000) })
    const html = await r.text()
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null
    const desc  = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() || null
    const urlObj = new URL(target)
    res.json({ title, description: desc, favicon: `${urlObj.protocol}//${urlObj.host}/favicon.ico`, url: target })
  } catch { res.json({ title: null, description: null, favicon: null, url }) }
}
