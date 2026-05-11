import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { useUserLocation } from '../useUserLocation'
import { DAY_KEYS, DAY_LABELS, todayHours, type OpeningHours } from '../openingHours'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const TYPES = ['Bäckerei','Supermarkt','Metzgerei','Käse','Bio-Laden','Getränkemarkt','Obst & Gemüse','Feinkost','Hofladen','Wochenmarkt','Sonstiges']
const RADII = [5, 10, 20, 50, 100]
const TODAY_KEY = (['su','mo','tu','we','th','fr','sa'] as const)[new Date().getDay()]

function emptyHours(): OpeningHours {
  return { mo: null, tu: null, we: null, th: null, fr: null, sa: null, su: null }
}

function HoursEditor({ value, onChange }: { value: OpeningHours; onChange: (h: OpeningHours) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '4px 8px', alignItems: 'center', fontSize: 13 }}>
      {DAY_KEYS.map(k => (
        <React.Fragment key={k}>
          <span style={{ color: 'var(--gray-400)', fontWeight: 500 }}>{DAY_LABELS[k]}</span>
          <input className="form-input" style={{ padding: '4px 8px', fontSize: 12 }}
            placeholder="07:00-18:00 oder leer"
            value={(value as any)[k] || ''}
            onChange={e => onChange({ ...value, [k]: e.target.value || null })} />
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Detail modal ─────────────────────────────────────────────────────────────
function ShopDetail({ shop, onClose, onEdit }: { shop: any; onClose: () => void; onEdit: () => void }) {
  const oh: OpeningHours | null = shop.opening_hours
  const th = todayHours(oh)
  const [webMeta, setWebMeta] = useState<any | null>(null)

  useEffect(() => {
    if (shop.website) {
      api.fetchWebsite(shop.website)
        .then(setWebMeta)
        .catch(() => {})
    }
  }, [shop.website])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto', padding: 0 }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{shop.name}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {shop.shop_type && <span style={{ fontSize: 12, background: 'var(--gray-100)', color: 'var(--gray-400)', padding: '2px 8px', borderRadius: 20 }}>{shop.shop_type}</span>}
              {shop.verified && <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ Verifiziert</span>}
              {shop.distance_km != null && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>📍 {shop.distance_km} km</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={onEdit}>✏️</button>
            <button className="btn btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Map */}
        {shop.lat && shop.lng && (
          <div style={{ height: 200 }}>
            <MapContainer center={[shop.lat, shop.lng]} zoom={16} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[shop.lat, shop.lng]}>
                <Popup>{shop.name}</Popup>
              </Marker>
            </MapContainer>
          </div>
        )}

        <div style={{ padding: 16 }}>
          {/* Address + contact */}
          <div style={{ marginBottom: 14 }}>
            {(shop.address || shop.city) && (
              <div style={{ fontSize: 14, marginBottom: 6 }}>
                📍 {[shop.address, shop.city].filter(Boolean).join(', ')}
              </div>
            )}
            {shop.phone && (
              <div style={{ fontSize: 14, marginBottom: 4 }}>
                📞 <a href={`tel:${shop.phone}`} style={{ color: 'var(--green)' }}>{shop.phone}</a>
              </div>
            )}
            {shop.website && (
              <div style={{ fontSize: 14 }}>
                🌐 <a href={shop.website.startsWith('http') ? shop.website : 'https://' + shop.website}
                  target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {webMeta?.favicon && <img src={webMeta.favicon} style={{ width: 14, height: 14 }} onError={e => (e.currentTarget.style.display='none')} />}
                  {webMeta?.title || shop.website.replace(/^https?:\/\//, '')}
                </a>
                {webMeta?.description && (
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 3 }}>{webMeta.description.slice(0, 120)}{webMeta.description.length > 120 ? '…' : ''}</div>
                )}
              </div>
            )}
          </div>

          {/* Opening hours */}
          {oh ? (
            <div style={{ marginBottom: 14 }}>
              <div className="section-title" style={{ margin: '0 0 8px' }}>Öffnungszeiten</div>
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: '4px 10px', fontSize: 13 }}>
                {DAY_KEYS.map(k => {
                  const v = (oh as any)[k]
                  const isToday = k === TODAY_KEY
                  return (
                    <React.Fragment key={k}>
                      <span style={{ fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--gray-900)' : 'var(--gray-400)' }}>
                        {DAY_LABELS[k]}
                      </span>
                      <span style={{ fontWeight: isToday ? 700 : 400, color: v ? (isToday ? 'var(--gray-900)' : 'var(--gray-700)') : 'var(--red)' }}>
                        {v || 'geschlossen'}
                        {isToday && <span style={{ fontSize: 11, marginLeft: 6, background: v ? 'var(--green-light)' : 'var(--red-light)', color: v ? 'var(--green-dark)' : 'var(--red)', padding: '1px 6px', borderRadius: 20 }}>heute</span>}
                      </span>
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 14 }}>
              Keine Öffnungszeiten hinterlegt
            </div>
          )}

          {/* Items */}
          {shop.items?.length > 0 && (
            <div>
              <div className="section-title" style={{ margin: '0 0 8px' }}>Sortiment</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {shop.items.map((item: string) => (
                  <span key={item} style={{ fontSize: 12, background: 'var(--green-light)', color: 'var(--green-dark)', padding: '3px 10px', borderRadius: 20 }}>{item}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function ShopEdit({ shop, onClose, onSaved, showFlash }: { shop: any; onClose: () => void; onSaved: () => void; showFlash: (m: string) => void }) {
  const [form, setForm] = useState({ ...shop, items: shop.items || [], opening_hours: shop.opening_hours || emptyHours() })
  const [saving, setSaving] = useState(false)
  const [newItem, setNewItem] = useState('')
  const setF = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  function addItem() {
    const t = newItem.trim()
    if (t && !form.items.includes(t)) { setF('items', [...form.items, t]); setNewItem('') }
  }

  async function save() {
    setSaving(true)
    try {
      await api.updateShop(form.id, { name: form.name, shop_type: form.shop_type, address: form.address, city: form.city, phone: form.phone, website: form.website, items: form.items, opening_hours: form.opening_hours })
      onSaved(); showFlash('✓ Shop gespeichert')
    } catch (e: any) { showFlash('Fehler: ' + e.message) }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3>Shop bearbeiten</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name} onChange={e => setF('name', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Typ</label>
            <select className="form-input" value={form.shop_type || ''} onChange={e => setF('shop_type', e.target.value)}>
              <option value="">– wählen –</option>{TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Straße</label><input className="form-input" value={form.address || ''} onChange={e => setF('address', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Stadt</label><input className="form-input" value={form.city || ''} onChange={e => setF('city', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={form.phone || ''} onChange={e => setF('phone', e.target.value)} placeholder="+49 9621 12345" /></div>
          <div className="form-group"><label className="form-label">Website</label><input className="form-input" value={form.website || ''} onChange={e => setF('website', e.target.value)} placeholder="www.beispiel.de" /></div>
        </div>
        <div className="form-group">
          <label className="form-label">Öffnungszeiten</label>
          <HoursEditor value={form.opening_hours} onChange={v => setF('opening_hours', v)} />
        </div>
        <div className="form-group">
          <label className="form-label">Sortiment</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input className="form-input" placeholder="Artikel…" value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }} />
            <button type="button" className="btn btn-sm" onClick={addItem}>+ Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {form.items.map((item: string) => (
              <span key={item} style={{ background: 'var(--green-light)', color: 'var(--green-dark)', padding: '3px 10px', borderRadius: 20, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                {item}
                <button type="button" onClick={() => setF('items', form.items.filter((i: string) => i !== item))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green-dark)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>{saving ? 'Speichern…' : '✓ Speichern'}</button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ShopsPage() {
  const { profile } = useAuth()
  const userLoc = useUserLocation(profile)
  const [shops,      setShops]      = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [radius,     setRadius]     = useState(20)
  const [typeFilter, setTypeFilter] = useState('')
  const [search,     setSearch]     = useState('')
  const [flash,      setFlash]      = useState('')
  const [detailShop, setDetailShop] = useState<any | null>(null)
  const [editShop,   setEditShop]   = useState<any | null>(null)
  const [showAdd,    setShowAdd]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [addForm,    setAddForm]    = useState({ name: '', city: '', shop_type: '', address: '', phone: '', website: '', items: [] as string[], opening_hours: emptyHours() })
  const [newItem,    setNewItem]    = useState('')
  const setAF = (k: string, v: any) => setAddForm(f => ({ ...f, [k]: v }))

  useEffect(() => { load() }, [radius, userLoc.lat, userLoc.lng])

  async function load() {
    setLoading(true)
    try { setShops(await api.shops(userLoc.lat, userLoc.lng, radius)) } catch {}
    setLoading(false)
  }

  function showFlashMsg(msg: string) { setFlash(msg); setTimeout(() => setFlash(''), 3000) }

  async function addShop(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    let lat = null, lng = null
    try {
      const q = encodeURIComponent(`${addForm.address}, ${addForm.city}, Germany`)
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`)
      const d = await r.json()
      if (d.length > 0) { lat = parseFloat(d[0].lat); lng = parseFloat(d[0].lon) }
    } catch {}
    try {
      await api.addShop({ ...addForm, lat, lng })
      setAddForm({ name: '', city: '', shop_type: '', address: '', phone: '', website: '', items: [], opening_hours: emptyHours() })
      setShowAdd(false); load(); showFlashMsg('✓ Shop hinzugefügt')
    } catch (e: any) { showFlashMsg('Fehler: ' + e.message) }
    setSaving(false)
  }

  const shopTypes = [...new Set(shops.map(s => s.shop_type).filter(Boolean))].sort() as string[]
  const filtered  = shops.filter(s => {
    if (typeFilter && s.shop_type !== typeFilter) return false
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.city?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Shops & Geschäfte</h2>
        <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>{filtered.length} Shops · {radius} km Radius</div>
      </div>

      {flash && <div className="alert alert-info">{flash}</div>}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 500 }}>Radius:</span>
          {RADII.map(r => (
            <button key={r} className={`btn btn-sm${radius === r ? ' btn-primary' : ''}`} onClick={() => setRadius(r)}>{r} km</button>
          ))}
        </div>
        <input className="form-input" placeholder="🔍 Shop suchen…" style={{ flex: 1, minWidth: 140 }}
          value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(v => !v)}>
          {showAdd ? '✕' : '+ Shop'}
        </button>
      </div>

      {/* Type quickfilter */}
      {shopTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className={`btn btn-sm${typeFilter === '' ? ' btn-primary' : ''}`} onClick={() => setTypeFilter('')}>Alle</button>
          {shopTypes.map(t => (
            <button key={t} className={`btn btn-sm${typeFilter === t ? ' btn-primary' : ''}`}
              onClick={() => setTypeFilter(typeFilter === t ? '' : t)}>{t}</button>
          ))}
        </div>
      )}

      {/* Map */}
      <div className="map-wrap">
        <MapContainer center={[userLoc.lat, userLoc.lng]} zoom={11} scrollWheelZoom={false}>
          <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Circle center={[userLoc.lat, userLoc.lng]} radius={radius * 1000}
            pathOptions={{ color: 'var(--green)', fillColor: 'var(--green)', fillOpacity: 0.05, weight: 1.5 }} />
          {filtered.filter(s => s.lat && s.lng).map(s => (
            <Marker key={s.id} position={[s.lat, s.lng]} eventHandlers={{ click: () => setDetailShop(s) }}>
              <Popup>
                <strong style={{ cursor: 'pointer' }} onClick={() => setDetailShop(s)}>{s.name}</strong>
                {s.shop_type && <><br /><span style={{ color: '#888' }}>{s.shop_type}</span></>}
                {s.distance_km != null && <><br /><span style={{ color: 'var(--green)' }}>📍 {s.distance_km} km</span></>}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3 style={{ marginBottom: 12 }}>Neues Geschäft</h3>
          <form onSubmit={addShop}>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" required value={addForm.name} onChange={e => setAF('name', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Typ</label>
                <select className="form-input" value={addForm.shop_type} onChange={e => setAF('shop_type', e.target.value)}>
                  <option value="">– wählen –</option>{TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Straße & Nr.</label><input className="form-input" value={addForm.address} onChange={e => setAF('address', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Stadt *</label><input className="form-input" required value={addForm.city} onChange={e => setAF('city', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" value={addForm.phone} onChange={e => setAF('phone', e.target.value)} placeholder="+49 9621 …" /></div>
              <div className="form-group"><label className="form-label">Website</label><input className="form-input" value={addForm.website} onChange={e => setAF('website', e.target.value)} placeholder="www.beispiel.de" /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Öffnungszeiten</label>
              <HoursEditor value={addForm.opening_hours} onChange={v => setAF('opening_hours', v)} />
            </div>
            <div className="form-group">
              <label className="form-label">Sortiment</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input className="form-input" placeholder="Artikel…" value={newItem} onChange={e => setNewItem(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const t = newItem.trim(); if (t && !addForm.items.includes(t)) { setAF('items', [...addForm.items, t]); setNewItem('') } }}} />
                <button type="button" className="btn btn-sm" onClick={() => { const t = newItem.trim(); if (t && !addForm.items.includes(t)) { setAF('items', [...addForm.items, t]); setNewItem('') } }}>+ Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {addForm.items.map(item => (
                  <span key={item} style={{ background: 'var(--green-light)', color: 'var(--green-dark)', padding: '3px 10px', borderRadius: 20, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {item}<button type="button" onClick={() => setAF('items', addForm.items.filter(i => i !== item))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green-dark)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={saving}>{saving ? 'Wird gespeichert…' : 'Shop speichern'}</button>
          </form>
        </div>
      )}

      {/* Shop tiles — compact */}
      {loading
        ? <div className="loading"><div className="spinner" /></div>
        : filtered.length === 0
          ? <div className="empty"><div className="empty-icon">🏪</div><h3>Keine Shops in {radius} km</h3></div>
          : (
            <div className="tile-grid">
              {filtered.map(s => {
                const th = todayHours(s.opening_hours)
                const hasHours = s.opening_hours !== null
                return (
                  <div key={s.id} className="tile" style={{ cursor: 'pointer' }}
                    onClick={() => setDetailShop(s)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, flex: 1, marginRight: 6 }}>{s.name}</div>
                      <button className="btn btn-sm" style={{ padding: '2px 7px', fontSize: 11, flexShrink: 0 }}
                        onClick={e => { e.stopPropagation(); setEditShop(s) }}>✏️</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6, alignItems: 'center' }}>
                      {s.shop_type && <span style={{ fontSize: 11, background: 'var(--gray-100)', color: 'var(--gray-400)', padding: '1px 7px', borderRadius: 20 }}>{s.shop_type}</span>}
                      {s.distance_km != null && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>📍 {s.distance_km} km</span>}
                      {s.verified && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓</span>}
                    </div>
                    {(s.address || s.city) && (
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 6 }}>
                        {s.address ? `${s.address}, ${s.city || ''}` : s.city}
                      </div>
                    )}
                    {/* Today only */}
                    {hasHours && (
                      <div style={{ fontSize: 11 }}>
                        {th
                          ? <span style={{ color: 'var(--green-dark)', background: 'var(--green-light)', padding: '2px 7px', borderRadius: 20 }}>Heute {th}</span>
                          : <span style={{ color: 'var(--red)', background: 'var(--red-light)', padding: '2px 7px', borderRadius: 20 }}>Heute geschlossen</span>
                        }
                      </div>
                    )}
                    {s.items?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {s.items.slice(0, 4).map((item: string) => (
                          <span key={item} style={{ fontSize: 11, background: 'var(--green-light)', color: 'var(--green-dark)', padding: '2px 7px', borderRadius: 20 }}>{item}</span>
                        ))}
                        {s.items.length > 4 && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>+{s.items.length - 4}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
      }

      {/* Detail modal */}
      {detailShop && !editShop && (
        <ShopDetail
          shop={detailShop}
          onClose={() => setDetailShop(null)}
          onEdit={() => { setEditShop(detailShop); setDetailShop(null) }}
        />
      )}

      {/* Edit modal */}
      {editShop && (
        <ShopEdit
          shop={editShop}
          onClose={() => setEditShop(null)}
          onSaved={() => { setEditShop(null); load() }}
          showFlash={showFlashMsg}
        />
      )}
    </div>
  )
}
