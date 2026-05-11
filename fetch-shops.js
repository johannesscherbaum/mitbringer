// Shops von OpenStreetMap laden und direkt in Supabase importieren
// Ausführen mit: node fetch-shops.js
// Optionen:
//   node fetch-shops.js --radius 20       (km um Mittelpunkt, default: 20)
//   node fetch-shops.js --all-germany     (ganz Deutschland, dauert länger)
//   node fetch-shops.js --dry-run         (nur anzeigen, nicht importieren)

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// ── Config ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const ALL_GERMANY = args.includes('--all-germany')
const DRY_RUN    = args.includes('--dry-run')
const radiusArg  = args.find(a => a.startsWith('--radius=') || args[args.indexOf('--radius') + 1])
const RADIUS_M   = ALL_GERMANY ? null : (parseInt(args[args.indexOf('--radius') + 1]) || 20) * 1000

// Read env
let SUPABASE_URL, SUPABASE_SERVICE_KEY
try {
  const env = readFileSync('.env.local', 'utf8')
  SUPABASE_URL        = env.match(/^SUPABASE_URL=(.+)$/m)?.[1]?.trim()
  SUPABASE_SERVICE_KEY = env.match(/^SUPABASE_SERVICE_KEY=(.+)$/m)?.[1]?.trim()
} catch {}
SUPABASE_URL        = SUPABASE_URL        || process.env.SUPABASE_URL
SUPABASE_SERVICE_KEY = SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY === 'HIER_SERVICE_KEY_EINTRAGEN') {
  console.error('❌ SUPABASE_URL und SUPABASE_SERVICE_KEY müssen in .env.local stehen')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── OSM Config ────────────────────────────────────────────────────────────────
const MITTELPUNKT = { lat: 49.4401, lng: 11.8626 } // Amberg (nur für Radius-Modus)

const SHOP_TYPE_MAP = {
  supermarket: 'Supermarkt', convenience: 'Supermarkt', bakery: 'Bäckerei',
  butcher: 'Metzgerei', greengrocer: 'Obst & Gemüse', deli: 'Feinkost',
  cheese: 'Käse', beverages: 'Getränkemarkt', organic: 'Bio-Laden',
  farm: 'Hofladen', seafood: 'Fisch', confectionery: 'Süßwaren',
  pasta: 'Feinkost', alcohol: 'Getränkemarkt', wine: 'Getränkemarkt',
}

const SHOP_FILTER = 'supermarket|convenience|bakery|butcher|greengrocer|deli|cheese|beverages|organic|farm|confectionery|wine|alcohol'

// ── OSM opening_hours parser ──────────────────────────────────────────────────
const OSM_DAY_MAP = {
  mo:'mo',tu:'tu',we:'we',th:'th',fr:'fr',sa:'sa',su:'su',
  mon:'mo',tue:'tu',wed:'we',thu:'th',fri:'fr',sat:'sa',sun:'su',
}
const DAY_ORDER = ['mo','tu','we','th','fr','sa','su']

function parseOsmHours(raw) {
  if (!raw) return null
  const result = { mo:null,tu:null,we:null,th:null,fr:null,sa:null,su:null }
  const rules = raw.split(';').map(s=>s.trim()).filter(Boolean)
  for (const rule of rules) {
    const m = rule.match(/^([A-Za-z,\- ]+?)\s+([\d:]+\s*[-–]\s*[\d:]+)$/)
    if (!m) continue
    const timePart = m[2].trim().replace(/\s*[-–]\s*/,'-')
    const affected = []
    for (const seg of m[1].split(',').map(s=>s.trim())) {
      const range = seg.split(/[-–]/).map(s=>OSM_DAY_MAP[s.trim().toLowerCase()]).filter(Boolean)
      if (range.length===2) {
        const s=DAY_ORDER.indexOf(range[0]),e=DAY_ORDER.indexOf(range[1])
        if (s<=e) for(let i=s;i<=e;i++) affected.push(DAY_ORDER[i])
        else { for(let i=s;i<7;i++) affected.push(DAY_ORDER[i]); for(let i=0;i<=e;i++) affected.push(DAY_ORDER[i]) }
      } else if (range.length===1) affected.push(range[0])
    }
    for (const d of affected) if (d in result) result[d]=timePart
  }
  return Object.values(result).some(v=>v!==null) ? result : null
}

// ── Overpass query ────────────────────────────────────────────────────────────
function buildQuery() {
  if (ALL_GERMANY) {
    return `[out:json][timeout:120];(
      node["shop"~"${SHOP_FILTER}"]["name"]["addr:city"](51.0,5.8,55.1,15.1);
      way["shop"~"${SHOP_FILTER}"]["name"]["addr:city"](51.0,5.8,55.1,15.1);
    );out center;`
  }
  return `[out:json][timeout:60];(
    node["shop"~"${SHOP_FILTER}"](around:${RADIUS_M},${MITTELPUNKT.lat},${MITTELPUNKT.lng});
    way["shop"~"${SHOP_FILTER}"](around:${RADIUS_M},${MITTELPUNKT.lat},${MITTELPUNKT.lng});
  );out center;`
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(ALL_GERMANY
    ? '📡 Lade alle Lebensmittelshops in Deutschland von OpenStreetMap…'
    : `📡 Lade Shops im ${RADIUS_M/1000}km-Umkreis um Amberg…`)
  if (DRY_RUN) console.log('⚠️  Dry-Run — nichts wird gespeichert\n')

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(buildQuery()),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mitbringer-App/1.0' }
  })
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${await res.text().then(t=>t.slice(0,200))}`)

  const data = await res.json()
  console.log(`   ${data.elements.length} Rohdaten empfangen`)

  // Parse
  const shops = []
  for (const el of data.elements) {
    const tags = el.tags || {}
    const name = tags.name; if (!name) continue
    const lat  = el.lat ?? el.center?.lat
    const lng  = el.lon ?? el.center?.lon
    shops.push({
      name,
      shop_type:     SHOP_TYPE_MAP[tags.shop] || tags.shop || null,
      address:       tags['addr:street'] ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' '+tags['addr:housenumber'] : ''}` : null,
      city:          tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || null,
      lat:           lat ? parseFloat(lat.toFixed(6)) : null,
      lng:           lng ? parseFloat(lng.toFixed(6)) : null,
      phone:         tags.phone || tags['contact:phone'] || null,
      website:       tags.website || tags['contact:website'] || null,
      opening_hours: parseOsmHours(tags.opening_hours),
      items:         [],
      verified:      false,
    })
  }

  // Deduplicate
  const unique = shops
    .sort((a,b) => a.name.localeCompare(b.name,'de'))
    .filter((s,i,arr) => i===arr.findIndex(x=>x.name===s.name && x.city===s.city))

  const withHours = unique.filter(s=>s.opening_hours).length
  console.log(`\n✅ ${unique.length} eindeutige Shops (${withHours} mit Öffnungszeiten)\n`)

  // By type
  const byType = {}
  for (const s of unique) { const t=s.shop_type||'Sonstiges'; byType[t]=(byType[t]||0)+1 }
  for (const [t,n] of Object.entries(byType).sort()) console.log(`   ${t.padEnd(24)} ${n}x`)

  if (DRY_RUN) { console.log('\n[Dry-Run] Fertig — nichts wurde gespeichert.'); return }

  // ── Import into Supabase ────────────────────────────────────────────────────
  console.log('\n📤 Importiere in Supabase…')

  // Get existing shops to avoid duplicates
  const { data: existing } = await supabase.from('shops').select('name,city')
  const existingSet = new Set((existing||[]).map(s=>`${s.name}||${s.city}`))

  const toInsert = unique.filter(s => !existingSet.has(`${s.name}||${s.city}`))
  const toUpdate = unique.filter(s =>  existingSet.has(`${s.name}||${s.city}`))

  console.log(`   ${toInsert.length} neu  ·  ${toUpdate.length} bereits vorhanden (werden aktualisiert)`)

  // Insert in batches of 100
  let inserted=0, updated=0, errors=0
  for (let i=0; i<toInsert.length; i+=100) {
    const batch = toInsert.slice(i, i+100)
    const { error } = await supabase.from('shops').insert(batch)
    if (error) { console.error(`   ❌ Insert Fehler batch ${i}: ${error.message}`); errors++ }
    else inserted += batch.length
    process.stdout.write(`\r   Importiert: ${inserted}/${toInsert.length}`)
  }

  // Update existing (opening hours + phone/website might be new)
  for (const s of toUpdate) {
    const { error } = await supabase.from('shops')
      .update({ phone: s.phone, website: s.website, opening_hours: s.opening_hours, lat: s.lat, lng: s.lng })
      .eq('name', s.name).eq('city', s.city)
    if (error) errors++
    else updated++
  }

  console.log(`\n\n✅ Fertig!`)
  console.log(`   ${inserted} neue Shops importiert`)
  console.log(`   ${updated} bestehende Shops aktualisiert`)
  if (errors>0) console.log(`   ⚠️  ${errors} Fehler`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
