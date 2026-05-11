import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db, initDb, nextId } from './db.js'

const app = express()
const PORT = 3001
const SECRET = 'mitbringer-dev-secret'

app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

function auth(req, res, next) {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht eingeloggt' })
  try { req.user = jwt.verify(h.slice(7), SECRET); next() }
  catch { res.status(401).json({ error: 'Token ungültig' }) }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Kein Zugriff' })
  next()
}

function safe(user) { const { password, ...rest } = user; return rest }

// Haversine distance in km
function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, role, address, city, postal_code, radius_km, lat, lng, phone } = req.body
    if (!email || !password || !first_name || !last_name)
      return res.status(400).json({ error: 'Pflichtfelder fehlen' })
    if (db.data.users.find(u => u.email === email))
      return res.status(409).json({ error: 'E-Mail bereits registriert' })
    const isFirst = db.data.users.length === 0
    const user = {
      id: nextId('users'), email, password: await bcrypt.hash(password, 10),
      first_name, last_name,
      role: isFirst ? 'superadmin' : (role || 'orderer'),
      address: address || null, city: city || null,
      postal_code: postal_code || null,
      radius_km: radius_km || 5,
      lat: lat || null, lng: lng || null,
      phone: phone || null,
      rating: null, rating_count: 0,
      created_at: new Date().toISOString()
    }
    db.data.users.push(user)
    await db.write()
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '30d' })
    res.json({ token, user: safe(user) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = db.data.users.find(u => u.email === email)
    if (!user) return res.status(401).json({ error: 'E-Mail nicht gefunden' })
    if (!await bcrypt.compare(password, user.password))
      return res.status(401).json({ error: 'Falsches Passwort' })
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '30d' })
    res.json({ token, user: safe(user) })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/me', auth, (req, res) => {
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'Nicht gefunden' })
  res.json(safe(user))
})

app.patch('/api/me', auth, async (req, res) => {
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'Nicht gefunden' })
  const { radius_km, address, city, postal_code, lat, lng, phone } = req.body
  if (radius_km   !== undefined) user.radius_km   = radius_km
  if (address     !== undefined) user.address     = address
  if (city        !== undefined) user.city        = city
  if (postal_code !== undefined) user.postal_code = postal_code
  if (lat         !== undefined) user.lat         = lat
  if (lng         !== undefined) user.lng         = lng
  if (phone       !== undefined) user.phone       = phone || null
  await db.write()
  res.json(safe(user))
})

// ── Categories ────────────────────────────────────────────────────────────────
app.get('/api/categories', (_req, res) => {
  res.json([...db.data.categories].sort((a, b) => a.sort_order - b.sort_order))
})

// ── Shops ─────────────────────────────────────────────────────────────────────
app.get('/api/shops', (req, res) => {
  const { lat, lng, radius } = req.query
  let shops = [...db.data.shops].sort((a, b) => a.name.localeCompare(b.name, 'de'))

  // Distance filter + annotation
  if (lat && lng) {
    const uLat = parseFloat(lat), uLng = parseFloat(lng)
    shops = shops
      .map(s => ({
        ...s,
        distance_km: s.lat && s.lng ? parseFloat(distKm(uLat, uLng, s.lat, s.lng).toFixed(1)) : null
      }))
      .filter(s => !radius || s.distance_km === null || s.distance_km <= parseFloat(radius))
      .sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999))
  }

  res.json(shops)
})

app.post('/api/shops', auth, async (req, res) => {
  const { name, shop_type, address, city, lat, lng, items } = req.body
  if (!name || !city) return res.status(400).json({ error: 'Name und Stadt sind Pflicht' })
  const shop = {
    id: nextId('shops'), name,
    shop_type: shop_type || null,
    address: address || null, city,
    lat: lat || null, lng: lng || null,
    phone: phone || null, website: website || null,
    items: items || [],
    opening_hours: opening_hours || null,
    verified: false,
    created_at: new Date().toISOString()
  }
  db.data.shops.push(shop)
  await db.write()
  res.json(shop)
})

app.patch('/api/shops/:id', auth, async (req, res) => {
  const id   = Number(req.params.id)
  const shop = db.data.shops.find(s => s.id === id)
  if (!shop) return res.status(404).json({ error: 'Nicht gefunden' })
  // Only admin or original adder can edit
  const { name, shop_type, address, city, lat, lng, phone, website, items, opening_hours, verified } = req.body
  if (name          !== undefined) shop.name          = name
  if (shop_type     !== undefined) shop.shop_type     = shop_type
  if (address       !== undefined) shop.address       = address
  if (city          !== undefined) shop.city          = city
  if (lat           !== undefined) shop.lat           = lat
  if (lng           !== undefined) shop.lng           = lng
  if (items         !== undefined) shop.items         = items
  if (phone         !== undefined) shop.phone         = phone
  if (website       !== undefined) shop.website       = website
  if (opening_hours !== undefined) shop.opening_hours = opening_hours
  if (verified      !== undefined && req.user.role === 'superadmin') shop.verified = verified
  await db.write()
  res.json(shop)
})

// ── Website metadata fetch ───────────────────────────────────────────────────
app.get('/api/fetch-website', auth, async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'URL fehlt' })

  try {
    const target = url.startsWith('http') ? url : 'https://' + url
    const r = await fetch(target, {
      headers: { 'User-Agent': 'Mitbringer-App/1.0' },
      signal: AbortSignal.timeout(5000)
    })
    const html = await r.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : null

    // Extract description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)
    const description = descMatch ? descMatch[1].trim() : null

    // Normalize URL for favicon
    const urlObj = new URL(target)
    const favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`

    res.json({ title, description, favicon, url: target })
  } catch (e) {
    res.status(200).json({ title: null, description: null, favicon: null, url })
  }
})

// ── Requests ──────────────────────────────────────────────────────────────────
const DAY_KEYS_SRV = ['su','mo','tu','we','th','fr','sa']

function enrichRequest(r) {
  const requester  = db.data.users.find(u => u.id === r.requester_id)
  const category   = db.data.categories.find(c => c.id === r.category_id)
  const shop       = db.data.shops.find(s => s.id === r.shop_id)
  const assignment = db.data.assignments.find(a => a.request_id === r.id)
  const bringer    = assignment ? db.data.users.find(u => u.id === assignment.bringer_id) : null

  // Today's opening hours
  let shop_hours_today = undefined
  if (shop?.opening_hours) {
    const dayKey = DAY_KEYS_SRV[new Date().getDay()]
    shop_hours_today = shop.opening_hours[dayKey] || null
  }

  return {
    ...r,
    requester_first: requester?.first_name, requester_last: requester?.last_name,
    requester_email: requester?.email,
    requester_phone: requester?.phone || null,
    category_name: category?.name, category_icon: category?.icon,
    shop_name: shop?.name,
    shop_hours_today,
    bringer_first: bringer?.first_name, bringer_last: bringer?.last_name,
    bringer_phone: bringer?.phone || null,
  }
}

app.get('/api/requests', (req, res) => {
  const { lat, lng } = req.query
  const uLat = lat ? parseFloat(lat) : null
  const uLng = lng ? parseFloat(lng) : null

  let rows = db.data.requests
    .filter(r => r.status === 'open' || r.status === 'assigned')
    .map(r => {
      const enriched = enrichRequest(r)
      // Add shop distance if user coords provided
      const shop = db.data.shops.find(s => s.id === r.shop_id)
      let distance_km = null
      if (uLat && uLng && shop?.lat && shop?.lng) {
        distance_km = parseFloat(distKm(uLat, uLng, shop.lat, shop.lng).toFixed(1))
      }
      return { ...enriched, distance_km }
    })

  // Sort by distance if available, else by needed_by
  if (uLat && uLng) {
    rows.sort((a, b) => {
      if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km
      if (a.distance_km != null) return -1
      if (b.distance_km != null) return 1
      return new Date(a.needed_by) - new Date(b.needed_by)
    })
  } else {
    rows.sort((a, b) => new Date(a.needed_by) - new Date(b.needed_by))
  }

  res.json(rows)
})

app.post('/api/requests', auth, async (req, res) => {
  const { item_text, items, category_id, shop_id, shop_name_free, quantity, notes, needed_by, delivery_address } = req.body
  if (!needed_by) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
  // Support both legacy item_text and new items array
  const itemsList = items?.length > 0 ? items : [{ text: item_text, quantity: quantity || null, notes: notes || null }]
  if (!itemsList[0]?.text) return res.status(400).json({ error: 'Mindestens ein Artikel wird benötigt' })
  const request = {
    id: nextId('requests'), requester_id: req.user.id,
    item_text: itemsList.map(i => i.text).join(', '), // summary for backwards compat
    items: itemsList,
    category_id: category_id || null,
    shop_id: shop_id || null, shop_name_free: shop_name_free || null,
    needed_by, delivery_address: delivery_address || null,
    status: 'open', created_at: new Date().toISOString()
  }
  // Auto-learn: alle Artikel zum Shop hinzufügen
  if (shop_id) {
    const shop = db.data.shops.find(s => s.id === shop_id)
    if (shop) {
      if (!shop.items) shop.items = []
      for (const item of itemsList) {
        const normalized = item.text.trim().toLowerCase()
        const already = shop.items.some(i => i.trim().toLowerCase() === normalized)
        if (!already) shop.items.push(item.text.trim())
      }
    }
  }

  db.data.requests.push(request)
  await db.write()
  res.json(request)
})

app.patch('/api/requests/:id', auth, async (req, res) => {
  const id = Number(req.params.id)
  const r  = db.data.requests.find(r => r.id === id)
  if (!r) return res.status(404).json({ error: 'Nicht gefunden' })
  if (r.requester_id !== req.user.id) return res.status(403).json({ error: 'Keine Berechtigung' })
  if (r.status !== 'open') return res.status(400).json({ error: 'Nur offene Anfragen können bearbeitet werden' })
  const { item_text, category_id, shop_id, shop_name_free, quantity, notes, needed_by, delivery_address } = req.body
  if (items            !== undefined) { r.items = items; r.item_text = items.map(i => i.text).join(', ') }
  if (item_text        !== undefined && !items) r.item_text = item_text
  if (category_id      !== undefined) r.category_id      = category_id || null
  if (shop_id          !== undefined) r.shop_id          = shop_id || null
  if (shop_name_free   !== undefined) r.shop_name_free   = shop_name_free || null
  if (needed_by        !== undefined) r.needed_by        = needed_by
  if (delivery_address !== undefined) r.delivery_address = delivery_address || null
  await db.write()
  res.json(r)
})

app.delete('/api/requests/:id', auth, async (req, res) => {
  const id = Number(req.params.id)
  const r  = db.data.requests.find(r => r.id === id)
  if (!r) return res.status(404).json({ error: 'Nicht gefunden' })
  if (r.requester_id !== req.user.id && req.user.role !== 'superadmin')
    return res.status(403).json({ error: 'Keine Berechtigung' })
  db.data.requests    = db.data.requests.filter(x => x.id !== id)
  db.data.assignments = db.data.assignments.filter(a => a.request_id !== id)
  await db.write()
  res.json({ ok: true })
})

app.patch('/api/requests/:id/cancel', auth, async (req, res) => {
  const id = Number(req.params.id)
  const r  = db.data.requests.find(r => r.id === id)
  if (!r) return res.status(404).json({ error: 'Nicht gefunden' })
  if (r.requester_id !== req.user.id && req.user.role !== 'superadmin')
    return res.status(403).json({ error: 'Keine Berechtigung' })
  r.status = 'cancelled'; await db.write(); res.json({ ok: true })
})

app.post('/api/assignments', auth, async (req, res) => {
  const { request_id } = req.body
  const r = db.data.requests.find(r => r.id === request_id)
  if (!r) return res.status(404).json({ error: 'Anfrage nicht gefunden' })
  if (r.status !== 'open') return res.status(400).json({ error: 'Anfrage nicht mehr offen' })
  if (r.requester_id === req.user.id) return res.status(400).json({ error: 'Eigene Anfragen nicht annehmbar' })
  if (db.data.assignments.find(a => a.request_id === request_id && a.bringer_id === req.user.id))
    return res.status(409).json({ error: 'Bereits angenommen' })
  const assignment = { id: nextId('assignments'), request_id, bringer_id: req.user.id, status: 'accepted', created_at: new Date().toISOString() }
  db.data.assignments.push(assignment)
  r.status = 'assigned'; await db.write(); res.json(assignment)
})

app.get('/api/my/requests', auth, (_req, res) => {
  res.json(db.data.requests
    .filter(r => r.requester_id === _req.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(r => ({ ...r, shop_name: db.data.shops.find(s => s.id === r.shop_id)?.name, category_name: db.data.categories.find(c => c.id === r.category_id)?.name })))
})

app.get('/api/my/assignments', auth, (_req, res) => {
  res.json(db.data.assignments
    .filter(a => a.bringer_id === _req.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(a => {
      const r = db.data.requests.find(r => r.id === a.request_id)
      return { ...a, item_text: r?.item_text, needed_by: r?.needed_by, req_status: r?.status, shop_name_free: r?.shop_name_free, shop_name: db.data.shops.find(s => s.id === r?.shop_id)?.name }
    }))
})

// ── Admin ─────────────────────────────────────────────────────────────────────
app.get('/api/admin/users', auth, adminOnly, (_req, res) => {
  res.json(db.data.users.map(u => ({
    ...safe(u),
    request_count:    db.data.requests.filter(r => r.requester_id === u.id).length,
    assignment_count: db.data.assignments.filter(a => a.bringer_id === u.id).length
  })).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
})

app.patch('/api/admin/users/:id/role', auth, adminOnly, async (req, res) => {
  const user = db.data.users.find(u => u.id === Number(req.params.id))
  if (!user) return res.status(404).json({ error: 'Nicht gefunden' })
  if (!['orderer','bringer','both','superadmin'].includes(req.body.role))
    return res.status(400).json({ error: 'Ungültige Rolle' })
  user.role = req.body.role; await db.write(); res.json(safe(user))
})

app.delete('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id)
  if (id === req.user.id) return res.status(400).json({ error: 'Eigenen Account nicht löschbar' })
  db.data.users       = db.data.users.filter(u => u.id !== id)
  db.data.requests    = db.data.requests.filter(r => r.requester_id !== id)
  db.data.assignments = db.data.assignments.filter(a => a.bringer_id !== id)
  await db.write(); res.json({ ok: true })
})

app.get('/api/admin/requests', auth, adminOnly, (_req, res) => {
  res.json(db.data.requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(enrichRequest))
})

app.patch('/api/admin/requests/:id/status', auth, adminOnly, async (req, res) => {
  const r = db.data.requests.find(r => r.id === Number(req.params.id))
  if (!r) return res.status(404).json({ error: 'Nicht gefunden' })
  if (!['open','assigned','completed','cancelled'].includes(req.body.status))
    return res.status(400).json({ error: 'Ungültiger Status' })
  r.status = req.body.status; await db.write(); res.json({ ok: true })
})

app.get('/api/admin/stats', auth, adminOnly, (_req, res) => {
  res.json({
    users: db.data.users.length, requests: db.data.requests.length,
    open: db.data.requests.filter(r => r.status === 'open').length,
    assigned: db.data.requests.filter(r => r.status === 'assigned').length,
    completed: db.data.requests.filter(r => r.status === 'completed').length,
    cancelled: db.data.requests.filter(r => r.status === 'cancelled').length,
    assignments: db.data.assignments.length, shops: db.data.shops.length,
  })
})

// ── Start ─────────────────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🛍  Mitbringer API  →  http://localhost:${PORT}`)
    if (db.data.users.length === 0) console.log(`👤  Erster User wird automatisch Superadmin!`)
  })
})
