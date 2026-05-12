const { createClient } = require('@supabase/supabase-js')

function sb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

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

async function loadProfiles(ids) {
  if (!ids || !ids.length) return {}
  const { data, error } = await sb()
    .from('profiles')
    .select('id,first_name,last_name,email,phone')
    .in('id', ids)
  if (error || !data) {
    console.error('loadProfiles error:', error?.message)
    // Fallback via auth admin API
    const map = {}
    for (const uid of ids) {
      try {
        const { data: u } = await sb().auth.admin.getUserById(uid)
        if (u?.user) {
          const m = u.user.user_metadata || {}
          map[uid] = { id: uid, first_name: m.first_name || '?', last_name: m.last_name || '', email: u.user.email || '', phone: m.phone || null }
        }
      } catch {}
    }
    return map
  }
  return Object.fromEntries(data.map(p => [p.id, p]))
}

const DAY_KEYS = ['su','mo','tu','we','th','fr','sa']

async function enrichRequests(reqs, uLat, uLng) {
  const today   = DAY_KEYS[new Date().getDay()]
  const shopIds = [...new Set(reqs.map(r=>r.shop_id).filter(Boolean))]
  const catIds  = [...new Set(reqs.map(r=>r.category_id).filter(Boolean))]
  const reqIds  = reqs.map(r=>r.id)
  const reqUids = [...new Set(reqs.map(r=>r.requester_id).filter(Boolean))]

  const { data: asgns } = await sb().from('assignments').select('request_id,bringer_id').in('request_id', reqIds)
  const bringerIds = [...new Set((asgns||[]).map(a=>a.bringer_id).filter(Boolean))]
  const allProfileIds = [...new Set([...reqUids, ...bringerIds])]

  const [shopsRes, catsRes, profileMap] = await Promise.all([
    shopIds.length ? sb().from('shops').select('id,name,lat,lng,opening_hours').in('id', shopIds) : Promise.resolve({ data: [] }),
    catIds.length  ? sb().from('categories').select('id,name,icon').in('id', catIds) : Promise.resolve({ data: [] }),
    loadProfiles(allProfileIds)
  ])

  const shopMap = Object.fromEntries((shopsRes.data||[]).map(s=>[s.id,s]))
  const catMap  = Object.fromEntries((catsRes.data||[]).map(c=>[c.id,c]))
  const asgMap  = {}
  for (const a of (asgns||[])) asgMap[a.request_id] = a

  return reqs.map(r => {
    const shop    = shopMap[r.shop_id]
    const cat     = catMap[r.category_id]
    const reqP    = profileMap[r.requester_id]
    const asgn    = asgMap[r.id]
    const bringer = profileMap[asgn?.bringer_id]
    const oh      = shop?.opening_hours
    const dk      = (uLat&&uLng&&shop?.lat&&shop?.lng) ? parseFloat(distKm(uLat,uLng,shop.lat,shop.lng).toFixed(1)) : null
    return {
      ...r,
      requester_first: reqP?.first_name    || null,
      requester_last:  reqP?.last_name     || null,
      requester_email: reqP?.email         || null,
      requester_phone: reqP?.phone         || null,
      category_name:   cat?.name           || null,
      category_icon:   cat?.icon           || null,
      shop_name:       shop?.name          || null,
      shop_hours_today: oh ? (oh[today]||null) : undefined,
      bringer_id:      asgn?.bringer_id    || null,
      bringer_first:   bringer?.first_name || null,
      bringer_last:    bringer?.last_name  || null,
      bringer_phone:   bringer?.phone      || null,
      distance_km: dk
    }
  })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const route = req.query.route || ''
  const id    = req.query.id    || ''
  const sub   = req.query.sub   || ''

  try {

  if (route === 'debug') {
    const { data: reqs } = await sb().from('requests').select('id,item_text,shop_id,status').limit(5)
    const profiles = await loadProfiles(['2254fbc7-ac20-465f-a12b-baadd2aa9baa','d22f14be-bc7d-4ecc-81e9-b5b6a46ccc81'])
    return res.json({ reqs, profiles, env: { hasUrl: !!process.env.SUPABASE_URL, hasKey: !!process.env.SUPABASE_SERVICE_KEY } })
  }

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

  if (route === 'login' && req.method === 'POST') {
    const { email, password } = req.body
    const { data, error } = await sb().auth.signInWithPassword({ email, password })
    if (error) return res.status(401).json({ error: error.message })
    const { data: profile } = await sb().from('profiles').select('*').eq('id', data.user.id).single()
    return res.json({ token: data.session.access_token, user: profile })
  }

  if (route === 'me') {
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })

    if (req.method === 'DELETE') {
      await sb().from('assignments').delete().eq('bringer_id', user.id)
      await sb().from('requests').delete().eq('requester_id', user.id)
      await sb().from('profiles').delete().eq('id', user.id)
      await sb().auth.admin.deleteUser(user.id)
      return res.json({ ok: true })
    }

    if (req.method === 'GET') {
      const { data } = await sb().from('profiles').select('*').eq('id', user.id).single()
      return res.json(data)
    }
    if (req.method === 'PATCH') {
      const allowed = ['radius_km','address','city','postal_code','lat','lng','phone']
      const update = {}
      for (const f of allowed) if (req.body[f] !== undefined) update[f] = req.body[f] ?? null
      if (req.body.radius_km !== undefined) update.radius_km = Number(req.body.radius_km)
      const { data } = await sb().from('profiles').update(update).eq('id', user.id).select().single()
      return res.json(data)
    }
  }

  if (route === 'categories' && req.method === 'GET') {
    const { data } = await sb().from('categories').select('*').order('sort_order')
    return res.json(data || [])
  }

  if (route === 'shops') {
    if (req.method === 'GET' && !id) {
      const { lat, lng, radius } = req.query
      const uLat = lat ? parseFloat(lat) : null
      const uLng = lng ? parseFloat(lng) : null
      const uRadius = radius ? parseFloat(radius) : 20
      if (uLat && uLng) {
        const latDelta = uRadius / 111
        const lngDelta = uRadius / (111 * Math.cos(uLat * Math.PI / 180))
        const { data: shops } = await sb().from('shops').select('*')
          .gte('lat', uLat - latDelta).lte('lat', uLat + latDelta)
          .gte('lng', uLng - lngDelta).lte('lng', uLng + lngDelta)
          .order('name').limit(2000)
        if (!shops) return res.json([])
        return res.json(shops
          .map(s => ({ ...s, distance_km: s.lat && s.lng ? parseFloat(distKm(uLat,uLng,s.lat,s.lng).toFixed(1)) : null }))
          .filter(s => s.distance_km == null || s.distance_km <= uRadius)
          .sort((a,b) => (a.distance_km??999)-(b.distance_km??999)))
      }
      const { data: shops } = await sb().from('shops').select('*').order('name').limit(500)
      return res.json(shops || [])
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
    if (req.method === 'PATCH' && id) {
      const allowed = ['name','shop_type','address','city','lat','lng','phone','website','items','opening_hours']
      const update = {}
      for (const f of allowed) if (req.body[f] !== undefined) update[f] = req.body[f]
      if (req.body.verified !== undefined && await isAdmin(user.id)) update.verified = req.body.verified
      const { data, error } = await sb().from('shops').update(update).eq('id', id).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.json(data)
    }
  }

  if (route === 'requests') {
    if (req.method === 'GET' && !id) {
      const { lat, lng, radius, all } = req.query
      const uLat = lat ? parseFloat(lat) : null
      const uLng = lng ? parseFloat(lng) : null
      const uRadius = radius ? parseFloat(radius) : 999
      const today = DAY_KEYS[new Date().getDay()]
      const currentUser = await getUser(req)
      const currentUserId = currentUser?.id

      let query = sb().from('requests').select('*').order('needed_by')
      if (!all) query = query.in('status', ['open','assigned'])
      const { data: reqs } = await query
      if (!reqs || reqs.length === 0) return res.json([])

      let result = await enrichRequests(reqs, uLat, uLng)

      if (uLat && uLng) {
        result = result.filter(r => r.requester_id === currentUserId || r.distance_km == null || r.distance_km <= uRadius)
        result.sort((a,b) => (a.distance_km??999)-(b.distance_km??999))
      }
      return res.json(result)
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

    if (id) {
      const { data: r } = await sb().from('requests').select('requester_id,status').eq('id', id).single()
      if (!r) return res.status(404).json({ error: 'Nicht gefunden' })
      const admin = await isAdmin(user.id)
      if (r.requester_id !== user.id && !admin) return res.status(403).json({ error: 'Keine Berechtigung' })
      if (req.method === 'PATCH') {
        const update = {}
        const { status, items, item_text, needed_by, delivery_address, shop_id, shop_name_free } = req.body
        if (status !== undefined) update.status = status
        if (items  !== undefined) { update.items = items; update.item_text = items.map(i=>i.text).join(', ') }
        if (item_text !== undefined && !items) update.item_text = item_text
        if (needed_by !== undefined) update.needed_by = needed_by
        if (delivery_address !== undefined) update.delivery_address = delivery_address
        if (shop_id          !== undefined) update.shop_id          = shop_id
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

  if (route === 'my') {
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
    if (sub === 'requests') {
      const { data: reqs } = await sb().from('requests').select('*').eq('requester_id', user.id).order('created_at', { ascending: false })
      if (!reqs || !reqs.length) return res.json([])
      return res.json(await enrichRequests(reqs, null, null))
    }
    if (sub === 'assignments') {
      const { data: asgns } = await sb().from('assignments').select('request_id').eq('bringer_id', user.id).order('created_at', { ascending: false })
      if (!asgns || !asgns.length) return res.json([])
      const reqIds = asgns.map(a => a.request_id)
      const { data: reqs } = await sb().from('requests').select('*').in('id', reqIds)
      if (!reqs || !reqs.length) return res.json([])
      return res.json(await enrichRequests(reqs, null, null))
    }
  }

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

  if (route === 'admin') {
    const user = await getUser(req)
    if (!user) return res.status(401).json({ error: 'Nicht eingeloggt' })
    if (!await isAdmin(user.id)) return res.status(403).json({ error: 'Kein Zugriff' })
    if (sub === 'stats') {
      const [u, r, a, s] = await Promise.all([
        sb().from('profiles').select('*', { count: 'exact', head: true }),
        sb().from('requests').select('status'),
        sb().from('assignments').select('*', { count: 'exact', head: true }),
        sb().from('shops').select('*', { count: 'exact', head: true }),
      ])
      const reqs = r.data||[]
      return res.json({ users: u.count, requests: reqs.length, open: reqs.filter(x=>x.status==='open').length, assigned: reqs.filter(x=>x.status==='assigned').length, completed: reqs.filter(x=>x.status==='completed').length, cancelled: reqs.filter(x=>x.status==='cancelled').length, assignments: a.count, shops: s.count })
    }
    if (sub === 'users' && !id) {
      const { data } = await sb().from('profiles').select('*').order('created_at')
      return res.json(data||[])
    }
    if (sub === 'users' && id && req.method === 'PATCH') {
      const { role } = req.body
      if (!['orderer','bringer','both','superadmin'].includes(role)) return res.status(400).json({ error: 'Ungültige Rolle' })
      const { data } = await sb().from('profiles').update({ role }).eq('id', id).select().single()
      return res.json(data)
    }
    if (sub === 'users' && id && req.method === 'DELETE') {
      if (id === user.id) return res.status(400).json({ error: 'Eigenen Account nicht löschbar' })
      await sb().from('assignments').delete().eq('bringer_id', id)
      await sb().from('requests').delete().eq('requester_id', id)
      await sb().from('profiles').delete().eq('id', id)
      await sb().auth.admin.deleteUser(id)
      return res.json({ ok: true })
    }
    if (sub === 'requests') {
      const { data: reqs } = await sb().from('requests').select('*').order('created_at', { ascending: false })
      if (!reqs || !reqs.length) return res.json([])
      const uids = [...new Set(reqs.map(r=>r.requester_id).filter(Boolean))]
      const shopIds = [...new Set(reqs.map(r=>r.shop_id).filter(Boolean))]
      const catIds  = [...new Set(reqs.map(r=>r.category_id).filter(Boolean))]
      const [pm, shopsRes, catsRes] = await Promise.all([
        loadProfiles(uids),
        shopIds.length ? sb().from('shops').select('id,name').in('id', shopIds) : Promise.resolve({ data: [] }),
        catIds.length  ? sb().from('categories').select('id,name,icon').in('id', catIds) : Promise.resolve({ data: [] }),
      ])
      const shopMap = Object.fromEntries((shopsRes.data||[]).map(s=>[s.id,s]))
      const catMap  = Object.fromEntries((catsRes.data||[]).map(c=>[c.id,c]))
      return res.json(reqs.map(r => ({
        ...r,
        requester_first: pm[r.requester_id]?.first_name || null,
        requester_last:  pm[r.requester_id]?.last_name  || null,
        requester_email: pm[r.requester_id]?.email      || null,
        category_name:   catMap[r.category_id]?.name    || null,
        category_icon:   catMap[r.category_id]?.icon    || null,
        shop_name:       shopMap[r.shop_id]?.name       || null,
      })))
    }
  }

  return res.status(404).json({ error: 'Route nicht gefunden: ' + route })

  } catch(err) {
    console.error('API Error:', err)
    return res.status(500).json({ error: err.message || 'Interner Serverfehler' })
  }
}
