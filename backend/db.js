import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const DB_FILE = join(__dir, '..', 'db.json')

const SEED = {
  users: [],
  categories: [
    { id: 1, name: 'Backwaren',              icon: '🍞', sort_order: 1 },
    { id: 2, name: 'Milch & Käse',           icon: '🧀', sort_order: 2 },
    { id: 3, name: 'Obst & Gemüse',          icon: '🍎', sort_order: 3 },
    { id: 4, name: 'Fleisch & Wurst',        icon: '🥩', sort_order: 4 },
    { id: 5, name: 'Getränke',               icon: '🥤', sort_order: 5 },
    { id: 6, name: 'Tiefkühl',               icon: '❄️',  sort_order: 6 },
    { id: 7, name: 'Süßwaren',               icon: '🍬', sort_order: 7 },
    { id: 8, name: 'Konserven & Trockenware',icon: '🥫', sort_order: 8 },
    { id: 9, name: 'Hygiene & Haushalt',     icon: '🧴', sort_order: 9 },
    { id: 10, name: 'Sonstiges',             icon: '📦', sort_order: 10 },
  ],
  shops: [
    { id: 1, name: 'Stadtbäcker Amberg', shop_type: 'Bäckerei',   address: 'Marktplatz 3',      city: 'Amberg', lat: 49.4418, lng: 11.8617, verified: true  },
    { id: 2, name: 'REWE',               shop_type: 'Supermarkt', address: 'Bahnhofstraße 12',  city: 'Amberg', lat: 49.4382, lng: 11.8601, verified: true  },
    { id: 3, name: 'Käse Haas',          shop_type: 'Käse',       address: 'Schrannenplatz 5',  city: 'Amberg', lat: 49.4401, lng: 11.8625, verified: false },
    { id: 4, name: 'Edeka City',         shop_type: 'Supermarkt', address: 'Georgenstraße 8',   city: 'Amberg', lat: 49.4390, lng: 11.8650, verified: true  },
    { id: 5, name: 'Metzgerei Huber',    shop_type: 'Metzgerei',  address: 'Nabburger Str. 2',  city: 'Amberg', lat: 49.4375, lng: 11.8590, verified: false },
    { id: 6, name: 'Alnatura',           shop_type: 'Bio-Laden',  address: 'Spitalstraße 14',   city: 'Amberg', lat: 49.4410, lng: 11.8580, verified: true  },
  ],
  requests: [],
  assignments: [],
  _seq: { users: 10, shops: 6, requests: 0, assignments: 0 }
}

const adapter = new JSONFile(DB_FILE)
export const db = new Low(adapter, SEED)

export async function initDb() {
  await db.read()
  // Ensure all keys exist (safe migration)
  db.data.users       ??= []
  db.data.categories  ??= SEED.categories
  db.data.shops       ??= SEED.shops
  db.data.requests    ??= []
  db.data.assignments ??= []
  db.data._seq        ??= SEED._seq
  await db.write()
}

export function nextId(table) {
  db.data._seq[table] = (db.data._seq[table] ?? 0) + 1
  return db.data._seq[table]
}
