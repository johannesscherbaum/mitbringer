# Mitbringer

Community-Plattform für lokale Einkaufsanfragen. Nutzer stellen Anfragen für Einkäufe, andere Mitglieder nehmen diese an und bringen die Artikel mit.

## Tech Stack
- **Frontend:** React + TypeScript + Vite
- **Backend:** Vercel Serverless Functions (`api/index.js`, CommonJS)
- **Datenbank:** Supabase (PostgreSQL) mit RLS
- **Hosting:** Vercel — https://mitbringer.vercel.app
- **Git:** https://github.com/johannesscherbaum/mitbringer

## Supabase
- **Projekt-ID:** `ewltwxencmpqinesthde`
- **URL:** `https://ewltwxencmpqinesthde.supabase.co`
- **Region:** eu-central-1

### DB Schema
- `profiles` — Nutzerprofile (id UUID, first_name, last_name, role, address, city, postal_code, lat, lng, radius_km, phone)
- `categories` — Artikel-Kategorien (id, name, icon, sort_order)
- `shops` — Geschäfte (id, name, shop_type, address, city, lat, lng, phone, website, opening_hours JSONB, items TEXT[], verified)
- `requests` — Anfragen (id, requester_id, item_text, items JSONB, category_id, shop_id, shop_name_free, needed_by, delivery_address, status)
- `assignments` — Annahmen (id, request_id, bringer_id, status)

### Rollen
- `orderer` — Besteller
- `bringer` — Mitbringer
- `both` — Beides
- `superadmin` — Admin (erster registrierter User)

## Projektstruktur
```
mitbringer/
├── api/
│   ├── index.js          ← Einzige Vercel Serverless Function (CommonJS)
│   └── package.json      ← {"type":"commonjs"} — KRITISCH!
├── src/
│   ├── App.tsx           ← Shell, Navigation, Auth-Guard
│   ├── api.ts            ← Frontend API-Client
│   ├── AuthContext.tsx   ← Auth + Profil (id: string = UUID)
│   ├── useUserLocation.ts← Standort aus Profil lat/lng oder Geocoding
│   ├── openingHours.ts   ← OSM Öffnungszeiten-Parser
│   ├── index.css         ← Design System (CSS-Variablen)
│   ├── components/
│   │   └── RequestModal.tsx ← Geteiltes Anfragen-Modal (Feed + Profil)
│   └── pages/
│       ├── FeedPage.tsx       ← Anfragen-Übersicht, Kacheln, Filter
│       ├── NewRequestPage.tsx ← Neue Anfrage mit Einkaufszettel
│       ├── ShopsPage.tsx      ← Karte + Kacheln + Detailansicht
│       ├── ProfilePage.tsx    ← Profil, eigene Anfragen, Aufträge
│       ├── AdminPage.tsx      ← User/Anfragen-Verwaltung
│       ├── LoginPage.tsx
│       └── RegisterPage.tsx
├── backend/
│   └── server.js         ← Lokaler Express-Server (nur dev)
├── fetch-shops.js        ← OSM Import → Supabase
├── vercel.json           ← Routing via ?route= Query-Params
├── .env.local            ← Secrets (nicht im Git!)
└── package.json
```

## Routing-Prinzip (wichtig!)
Vercel leitet alle `/api/*` Requests auf `/api/index` um und übergibt die Route als Query-Parameter:
```
/api/requests     → /api/index?route=requests
/api/shops/5      → /api/index?route=shops&id=5
/api/my/requests  → /api/index?route=my&sub=requests
```
Das `api/index.js` liest `req.query.route`, `req.query.id`, `req.query.sub`.

## Lokale Entwicklung
```bash
npm run dev    # Express (Port 3001) + Vite (Port 3000)
```
Nutzt `backend/server.js` + `db.json` lokal — kein Supabase.

## Deployment
```bash
git add .
git commit -m "..."
git push
vercel --prod
```

## Vercel Environment Variables
| Key | Beschreibung |
|---|---|
| `SUPABASE_URL` | `https://ewltwxencmpqinesthde.supabase.co` |
| `SUPABASE_SERVICE_KEY` | service_role key (bypasses RLS) |
| `VITE_SUPABASE_URL` | gleich wie SUPABASE_URL |
| `VITE_SUPABASE_ANON_KEY` | anon key |

## Wichtige Eigenheiten
- **RLS auf profiles:** Supabase JS Client gibt `null` zurück bei JOINs auf `profiles`. Lösung: `loadProfiles()` Funktion in `api/index.js` die bei Fehler auf `auth.admin.getUserById()` zurückfällt.
- **UUIDs:** `profile.id` ist ein String (UUID), nicht number. Vergleiche immer mit `String(a) === String(b)`.
- **Shop-Import:** `node fetch-shops.js` lädt Shops von OpenStreetMap direkt in Supabase. `--all-germany` für ganz Deutschland.
- **Bounding Box:** Shop-Filter nutzt lat/lng Bounding Box statt alle 29k Shops zu laden.
- **api/package.json:** `{"type":"commonjs"}` ist zwingend — sonst Vercel 500er.

## Features
- Anfragen mit Einkaufszettel (mehrere Artikel + Menge + Hinweis)
- Sortierung nach Distanz vom Nutzerstandort
- Filter nach Status, Kategorie, Shop
- Shop-Detailansicht mit Karte, Öffnungszeiten, Website
- Öffnungszeiten aus OSM (automatisch beim Import)
- Kontaktdaten sichtbar nur nach Annahme (Anfrager ↔ Mitbringer)
- Interaktive Checkliste im Anfragen-Modal
- Druckansicht pro Anfrage
- Admin: User-Verwaltung, Rollen, alle Anfragen
- Konto löschen (mit doppelter Bestätigung)
