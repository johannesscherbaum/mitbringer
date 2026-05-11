const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY

function sb() { return createClient(SUPABASE_URL, SERVICE_KEY) }

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

async function getUser(req) {
  const token = req.headers.authorization?.replace('Bearer ','')
  if (!token) return null
  const { data: { user } } = await sb().auth.getUser(token)
  return user
}

async function isAdmin(userId) {
  const { data } = await sb().from('profiles').select('role').eq('id', userId).single()
  return data?.role === 'superadmin'
}

const DAY_KEYS = ['su','mo','tu','we','th','fr','sa']

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const url   = req.url.replace(/^\/api/, '').split('?')[0]
  const parts = url.split('/').filter(Boolean)
  const route = parts[0]

  try {

  // ── POST /register ──────────────────────────────────────────────────────────
  if (route === 'register' && req.method === 'POST') {
    const { email, password, first_name, last_name, role, address, city, postal_code, radius_km, lat, lng, phone } = req.body
    if (!email || !password || !first_name || !last_name) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
    const { count } = await sb().from('profiles').select('*', { count: 'exact', head: true })
    const finalRole = count === 0 ? 'superadmin' : (role || 'orderer')
    const { data, error } = await sb().auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { first_name, last_name, role: finalRole, address, city, postal_code, radius_km: radius_km||5, lat, lng, phone }
    })
    if (error) return res.status(400).json({ error: error.message })
    const { data: session } = await sb().auth.signInWithPassword({ email, password })
    const { data: profile } = await sb().from('profiles').select('*').eq('id', data.user.id).single()
    return res.json({ token: session.session.access_token, user: profile })
  }

  // ── POST /login ─────────────────────────────────────────────────────────────
  if (route === 'login' && req.method === 'POST') {
    const { email, password } = req.body
    const { data, error } = await sb().auth.signInWithPassword({ email, password })
    if (error) return res.status(401).json({ error: error.message })
    const { data: profile } = await sb().from('profiles').select('*').eq('id', data.user.id).single()
    return res.json({ token: data.session.access_token, user: profile })
  }

  // ── GET/PATCH /me ────────────────────────────────────────────────────────────
  if (route === 'me') {
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
    if (req.method === 'GET') {
      const { data } = await sb().from('profiles').select('*').eq('id', user.id).single()
      return res.json(data)
    }
    if (req.method === 'PATCH') {
      const fields = ['radius_km','address','city','postal_code','lat','lng','phone']
      const update = {}
      for (const f of fields) if (req.body[f] !== undefined) update[f] = req.body[f] || null
      const { data } = await sb().from('profiles').update(update).eq('id', user.id).select().single()
      return res.json(data)
    }
  }

  // ── GET /categories ──────────────────────────────────────────────────────────
  if (route === 'categories' && req.method === 'GET') {
    const { data } = await sb().from('categories').select('*').order('sort_order')
    return res.json(data || [])
  }

  // ── Shops ────────────────────────────────────────────────────────────────────
  if (route === 'shops') {
    if (req.method === 'GET' && !parts[1]) {
      const { lat, lng, radius } = req.query
      let { data: shops } = await sb().from('shops').select('*').order('name')
      if (!shops) return res.json([])
      if (lat && lng) {
        const uLat = parseFloat(lat), uLng = parseFloat(lng)
        shops = shops.map(s => ({ ...s, distance_km: s.lat && s.lng ? parseFloat(distKm(uLat,uLng,s.lat,s.lng).toFixed(1)) : null }))
        if (radius) shops = shops.filter(s => s.distance_km == null || s.distance_km <= parseFloat(radius))
        shops.sort((a,b) => (a.distance_km??999)-(b.distance_km??999))
      }
      return res.json(shops)
    }
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
    if (req.method === 'POST') {
      const { name, shop_type, address, city, lat, lng, phone, website, items, opening_hours } = req.body
      if (!name || !city) return res.status(400).json({ error: 'Name und Stadt sind Pflicht' })
      const { data, error } = await sb().from('shops').insert({ name, shop_type, address, city, lat, lng, phone, website, items: items||[], opening_hours }).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }
    if (req.method === 'PATCH' && parts[1]) {
      const id = parts[1]
      const allowed = ['name','shop_type','address','city','lat','lng','phone','website','items','opening_hours']
      const update = {}
      for (const f of allowed) if (req.body[f] !== undefined) update[f] = req.body[f]
      if (req.body.verified !== undefined && await isAdmin(user.id)) update.verified = req.body.verified
      const { data, error } = await sb().from('shops').update(update).eq('id', id).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }
  }

  // ── Requests ─────────────────────────────────────────────────────────────────
  if (route === 'requests') {
    if (req.method === 'GET' && !parts[1]) {
      const { lat, lng } = req.query
      const { data: reqs } = await sb().from('requests')
        .select('*, profiles!requester_id(first_name,last_name,email,phone), categories(name,icon), shops(name,lat,lng,opening_hours)')
        .in('status', ['open','assigned']).order('needed_by')
      if (!reqs) return res.json([])
      const reqIds = reqs.map(r => r.id)
      const { data: asgns } = await sb().from('assignments')
        .select('request_id,bringer_id,profiles!bringer_id(first_name,last_name,phone)').in('request_id', reqIds)
      const asgMap = {}
      for (const a of (asgns||[])) asgMap[a.request_id] = a
      const today = DAY_KEYS[new Date().getDay()]
      const uLat = lat ? parseFloat(lat) : null, uLng = lng ? parseFloat(lng) : null
      let rows = reqs.map(r => {
        const a = asgMap[r.id], oh = r.shops?.opening_hours
        return {
          ...r,
          requester_first: r.profiles?.first_name, requester_last: r.profiles?.last_name,
          requester_email: r.profiles?.email, requester_phone: r.profiles?.phone,
          category_name: r.categories?.name, category_icon: r.categories?.icon,
          shop_name: r.shops?.name,
          shop_hours_today: oh ? (oh[today]||null) : undefined,
          bringer_id: a?.bringer_id||null, bringer_first: a?.profiles?.first_name||null,
          bringer_last: a?.profiles?.last_name||null, bringer_phone: a?.profiles?.phone||null,
          distance_km: (uLat&&uLng&&r.shops?.lat&&r.shops?.lng) ? parseFloat(distKm(uLat,uLng,r.shops.lat,r.shops.lng).toFixed(1)) : null,
          profiles: undefined, categories: undefined, shops: undefined
        }
      })
      if (uLat&&uLng) rows.sort((a,b)=>(a.distance_km??999)-(b.distance_km??999))
      return res.json(rows)
    }
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
    if (req.method === 'POST') {
      const { items, item_text, category_id, shop_id, shop_name_free, needed_by, delivery_address } = req.body
      if (!needed_by) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
      const itemsList = items?.length > 0 ? items : [{ text: item_text }]
      if (!itemsList[0]?.text) return res.status(400).json({ error: 'Mindestens ein Artikel benötigt' })
      const { data, error } = await sb().from('requests').insert({
        requester_id: user.id, item_text: itemsList.map(i=>i.text).join(', '), items: itemsList,
        category_id: category_id||null, shop_id: shop_id||null, shop_name_free: shop_name_free||null,
        needed_by, delivery_address: delivery_address||null
      }).select().single()
      if (error) return res.status(500).json({ error: error.message })
      if (shop_id) {
        const { data: shop } = await sb().from('shops').select('items').eq('id', shop_id).single()
        if (shop) {
          const existing = shop.items||[]
          const toAdd = itemsList.map(i=>i.text.trim()).filter(t=>!existing.some(e=>e.toLowerCase()===t.toLowerCase()))
          if (toAdd.length>0) await sb().from('shops').update({ items: [...existing,...toAdd] }).eq('id', shop_id)
        }
      }
      return res.json(data)
    }
    if (parts[1]) {
      const id = parts[1]
      const { data: r } = await sb().from('requests').select('requester_id,status').eq('id', id).single()
      if (!r) return res.status(404).json({ error: 'Nicht gefunden' })
      const admin = await isAdmin(user?.id)
      if (r.requester_id !== user?.id && !admin) return res.status(403).json({ error: 'Keine Berechtigung' })
      if (req.method === 'PATCH') {
        const update = {}
        const { status, items, item_text, needed_by, delivery_address, shop_name_free } = req.body
        if (status !== undefined) update.status = status
        if (items  !== undefined) { update.items = items; update.item_text = items.map(i=>i.text).join(', ') }
        if (item_text !== undefined) update.item_text = item_text
        if (needed_by !== undefined) update.needed_by = needed_by
        if (delivery_address !== undefined) update.delivery_address = delivery_address
        if (shop_name_free   !== undefined) update.shop_name_free   = shop_name_free
        const { data } = await sb().from('requests').update(update).eq('id', id).select().single()
        return res.json(data)
      }
      if (req.method === 'DELETE') {
        await sb().from('assignments').delete().eq('request_id', id)
        await sb().from('requests').delete().eq('id', id)
        return res.json({ ok: true })
      }
    }
  }

  // ── POST /assignments ────────────────────────────────────────────────────────
  if (route === 'assignments' && req.method === 'POST') {
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
    const { request_id } = req.body
    const { data: r } = await sb().from('requests').select('*').eq('id', request_id).single()
    if (!r) return res.status(404).json({ error: 'Nicht gefunden' })
    if (r.status !== 'open') return res.status(400).json({ error: 'Nicht mehr offen' })
    if (r.requester_id === user.id) return res.status(400).json({ error: 'Eigene Anfrage' })
    const { error } = await sb().from('assignments').insert({ request_id, bringer_id: user.id })
    if (error) return res.status(409).json({ error: 'Bereits angenommen' })
    await sb().from('requests').update({ status: 'assigned' }).eq('id', request_id)
    return res.json({ ok: true })
  }

  // ── /my/* ────────────────────────────────────────────────────────────────────
  if (route === 'my') {
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
    if (parts[1] === 'requests') {
      const { data } = await sb().from('requests').select('*, shops(name), categories(name)').eq('requester_id', user.id).order('created_at', { ascending: false })
      return res.json((data||[]).map(r => ({ ...r, shop_name: r.shops?.name, category_name: r.categories?.name, shops: undefined, categories: undefined })))
    }
    if (parts[1] === 'assignments') {
      const { data } = await sb().from('assignments').select('*, requests(item_text,items,needed_by,status,shop_name_free,shops(name))').eq('bringer_id', user.id).order('created_at', { ascending: false })
      return res.json((data||[]).map(a => ({ ...a, item_text: a.requests?.item_text, needed_by: a.requests?.needed_by, req_status: a.requests?.status, shop_name: a.requests?.shops?.name, shop_name_free: a.requests?.shop_name_free, requests: undefined })))
    }
  }

  // ── GET /fetch-website ───────────────────────────────────────────────────────
  if (route === 'fetch-website' && req.method === 'GET') {
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
    const { url } = req.query
    try {
      const target = url.startsWith('http') ? url : 'https://' + url
      const r = await fetch(target, { headers: { 'User-Agent': 'Mitbringer/1.0' }, signal: AbortSignal.timeout(5000) })
      const html = await r.text()
      const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null
      const desc  = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() || null
      const urlObj = new URL(target)
      return res.json({ title, description: desc, favicon: `${urlObj.protocol}//${urlObj.host}/favicon.ico`, url: target })
    } catch { return res.json({ title: null, description: null, favicon: null, url }) }
  }

  // ── /admin/* ──────────────────────────────────────────────────────────────────
  if (route === 'admin') {
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
    if (!await isAdmin(user.id)) return res.status(403).json({ error: 'Kein Zugriff' })
    if (parts[1] === 'stats') {
      const [u, r, a, s] = await Promise.all([
        sb().from('profiles').select('*', { count: 'exact', head: true }),
        sb().from('requests').select('status'),
        sb().from('assignments').select('*', { count: 'exact', head: true }),
        sb().from('shops').select('*', { count: 'exact', head: true }),
      ])
      const reqs = r.data||[]
      return res.json({ users: u.count, requests: reqs.length, open: reqs.filter(x=>x.status==='open').length, assigned: reqs.filter(x=>x.status==='assigned').length, completed: reqs.filter(x=>x.status==='completed').length, cancelled: reqs.filter(x=>x.status==='cancelled').length, assignments: a.count, shops: s.count })
    }
    if (parts[1] === 'users' && req.method === 'GET') {
      const { data } = await sb().from('profiles').select('*').order('created_at')
      return res.json(data||[])
    }
    if (parts[1] === 'users' && parts[2] && req.method === 'PATCH') {
      const { role } = req.body
      if (!['orderer','bringer','both','superadmin'].includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' })
      const { data } = await sb().from('profiles').update({ role }).eq('id', parts[2]).select().single()
      return res.json(data)
    }
    if (parts[1] === 'users' && parts[2] && req.method === 'DELETE') {
      const id = parts[2]
      if (id === user.id) return res.status(400).json({ error: 'Eigenen Account nicht löschbar' })
      await sb().from('assignments').delete().eq('bringer_id', id)
      await sb().from('requests').delete().eq('requester_id', id)
      await sb().from('profiles').delete().eq('id', id)
      await sb().auth.admin.deleteUser(id)
      return res.json({ ok: true })
    }
    if (parts[1] === 'requests') {
      const { data } = await sb().from('requests').select('*, profiles!requester_id(first_name,last_name,email), categories(name,icon), shops(name)').order('created_at', { ascending: false })
      return res.json((data||[]).map(r => ({ ...r, requester_first: r.profiles?.first_name, requester_last: r.profiles?.last_name, requester_email: r.profiles?.email, category_name: r.categories?.name, category_icon: r.categories?.icon, shop_name: r.shops?.name, profiles: undefined, categories: undefined, shops: undefined })))
    }
  }

  return res.status(404).json({ error: 'Route nicht gefunden' })

  } catch(err) {
    console.error('API Error:', err)
    return res.status(500).json({ error: err.message || 'Interner Serverfehler' })
  }
}