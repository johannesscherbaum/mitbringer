// Shops + Öffnungszeiten rund um Amberg von OpenStreetMap laden
// Ausführen mit: node fetch-shops.js
// Ergebnis: shops-import.json → Inhalt in db.json unter "shops" einfügen

const MITTELPUNKT = { lat: 49.4401, lng: 11.8626 } // Amberg Marktplatz
const RADIUS_M    = 20000 // 20 km

const SHOP_TYPE_MAP = {
  supermarket:  'Supermarkt',
  convenience:  'Supermarkt',
  bakery:       'Bäckerei',
  butcher:      'Metzgerei',
  greengrocer:  'Obst & Gemüse',
  deli:         'Feinkost',
  cheese:       'Käse',
  beverages:    'Getränkemarkt',
  organic:      'Bio-Laden',
  farm:         'Hofladen',
  seafood:      'Fisch',
  confectionery:'Süßwaren',
}

const query = `[out:json][timeout:40];(
  node["shop"~"supermarket|convenience|bakery|butcher|greengrocer|deli|cheese|beverages|organic|farm"](around:${RADIUS_M},${MITTELPUNKT.lat},${MITTELPUNKT.lng});
  way["shop"~"supermarket|convenience|bakery|butcher|greengrocer|deli|cheese|beverages|organic|farm"](around:${RADIUS_M},${MITTELPUNKT.lat},${MITTELPUNKT.lng});
);out center;`

// ── OSM opening_hours parser ─────────────────────────────────────────────────
// Parst das OSM-Format z. B. "Mo-Fr 07:00-18:00; Sa 07:00-13:00"
// in unser Format { mo, tu, we, th, fr, sa, su }

const OSM_DAY_MAP = {
  mo: 'mo', tu: 'tu', we: 'we', th: 'th', fr: 'fr', sa: 'sa', su: 'su',
  mon: 'mo', tue: 'tu', wed: 'we', thu: 'th', fri: 'fr', sat: 'sa', sun: 'su',
}
const DAY_ORDER = ['mo','tu','we','th','fr','sa','su']

function dayIndex(d) { return DAY_ORDER.indexOf(d) }

function parseOsmHours(raw) {
  if (!raw) return null
  const result = { mo: null, tu: null, we: null, th: null, fr: null, sa: null, su: null }

  // Split by semicolon into rules
  const rules = raw.split(';').map(s => s.trim()).filter(Boolean)

  for (const rule of rules) {
    // Match "Day[-Day] HH:MM-HH:MM" or "Day,Day,... HH:MM-HH:MM"
    const m = rule.match(/^([A-Za-z,\- ]+?)\s+([\d:]+\s*[-–]\s*[\d:]+(?:,\s*[\d:]+\s*[-–]\s*[\d:]+)*)$/)
    if (!m) continue

    const dayPart  = m[1].trim()
    const timePart = m[2].trim().replace(/\s*[-–]\s*/, '-')

    // Parse day ranges like "Mo-Fr" or lists like "Mo,We,Fr"
    const affectedDays = []

    const segments = dayPart.split(',').map(s => s.trim())
    for (const seg of segments) {
      const range = seg.split(/[-–]/).map(s => OSM_DAY_MAP[s.trim().toLowerCase()]).filter(Boolean)
      if (range.length === 2) {
        const start = dayIndex(range[0]), end = dayIndex(range[1])
        if (start <= end) {
          for (let i = start; i <= end; i++) affectedDays.push(DAY_ORDER[i])
        } else {
          // Wrap-around e.g. Sa-Mo
          for (let i = start; i < DAY_ORDER.length; i++) affectedDays.push(DAY_ORDER[i])
          for (let i = 0; i <= end; i++) affectedDays.push(DAY_ORDER[i])
        }
      } else if (range.length === 1) {
        affectedDays.push(range[0])
      }
    }

    for (const day of affectedDays) {
      if (day in result) result[day] = timePart
    }
  }

  // Return null if no days were parsed
  const hasAny = Object.values(result).some(v => v !== null)
  return hasAny ? result : null
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📡 Lade Shops von OpenStreetMap (Overpass API)…')
  console.log(`   Mittelpunkt: Amberg (${MITTELPUNKT.lat}, ${MITTELPUNKT.lng})`)
  console.log(`   Radius: ${RADIUS_M / 1000} km\n`)

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mitbringer-App/1.0 (open source local dev)'
    }
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)

  const data = await res.json()
  console.log(`   ${data.elements.length} Rohdaten empfangen`)

  const shops = []
  let id = 100

  for (const el of data.elements) {
    const tags = el.tags || {}
    const name = tags.name
    if (!name) continue

    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon

    const shopTypeRaw = tags.shop || ''
    const shopType    = SHOP_TYPE_MAP[shopTypeRaw] || shopTypeRaw
    const street      = tags['addr:street'] || null
    const housenr     = tags['addr:housenumber'] || null
    const city        = tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || null
    const address     = street ? `${street}${housenr ? ' ' + housenr : ''}` : null
    const phone       = tags.phone || tags['contact:phone'] || null
    const website     = tags.website || tags['contact:website'] || null
    const opening_hours = parseOsmHours(tags.opening_hours)

    shops.push({
      id: id++,
      name,
      shop_type: shopType || null,
      address,
      city,
      lat:  lat ? parseFloat(lat.toFixed(6)) : null,
      lng:  lng ? parseFloat(lng.toFixed(6)) : null,
      phone,
      website,
      opening_hours,
      items: [],
      verified: false,
      created_at: new Date().toISOString()
    })
  }

  // Sortieren + Duplikate entfernen
  const unique = shops
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .filter((s, i, arr) => i === arr.findIndex(x => x.name === s.name && x.city === s.city))

  const withHours    = unique.filter(s => s.opening_hours !== null).length
  const withoutHours = unique.length - withHours

  console.log(`✅ ${unique.length} eindeutige Shops\n`)

  // Nach Typ gruppiert
  const byType = {}
  for (const s of unique) {
    const t = s.shop_type || 'Sonstiges'
    byType[t] = (byType[t] || 0) + 1
  }
  for (const [type, count] of Object.entries(byType).sort()) {
    console.log(`   ${type.padEnd(22)} ${count}x`)
  }
  console.log(`\n   Mit Öffnungszeiten:    ${withHours}`)
  console.log(`   Ohne Öffnungszeiten:   ${withoutHours}`)

  const { writeFileSync } = await import('fs')
  writeFileSync('shops-import.json', JSON.stringify(unique, null, 2), 'utf8')
  console.log('\n📁 Gespeichert: shops-import.json')
  console.log('👉 Inhalt in db.json unter "shops": [...] einfügen, Server neu starten.\n')
}

main().catch(e => { console.error('❌ Fehler:', e.message); process.exit(1) })
