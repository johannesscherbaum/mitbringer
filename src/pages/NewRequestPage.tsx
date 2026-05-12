import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { useUserLocation } from '../useUserLocation'

interface ListItem { text: string; quantity: string; notes: string }

function newItem(): ListItem { return { text: '', quantity: '', notes: '' } }

export default function NewRequestPage({ onCreated }: { onCreated: () => void }) {
  const { profile } = useAuth()
  const userLoc = useUserLocation(profile)

  const [cats,      setCats]      = useState<any[]>([])
  const [shops,     setShops]     = useState<any[]>([])
  const [shopSuggestions, setShopSuggestions] = useState<any[]>([])

  // Shopping list
  const [items,     setItems]     = useState<ListItem[]>([newItem()])

  // Other fields
  const [categoryId,  setCategoryId]  = useState('')
  const [shopId,      setShopId]      = useState('')
  const [shopFree,    setShopFree]    = useState('')
  const [selectedShop, setSelectedShop] = useState<any | null>(null)
  const [shopSearch,  setShopSearch]  = useState('')
  const [shopOpen,    setShopOpen]    = useState(false)
  const [delivery,    setDelivery]    = useState('')
  const [date,        setDate]        = useState(() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })
  const [time,        setTime]        = useState('10:00')
  const [err,         setErr]         = useState('')
  const [loading,     setLoading]     = useState(false)
  const [done,        setDone]        = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.categories().then(setCats).catch(() => {})
    if (profile?.address) setDelivery([profile.address, profile.city].filter(Boolean).join(', '))
  }, [profile?.id])

  useEffect(() => {
    api.shops(userLoc.lat, userLoc.lng).then(setShops).catch(() => {})
  }, [userLoc.lat, userLoc.lng])

  // Shop suggestions from items text
  useEffect(() => {
    if (selectedShop || !items[0].text) { setShopSuggestions([]); return }
    const q = items.map(i => i.text.toLowerCase()).join(' ')
    const sugg = shops.filter(s =>
      s.items?.some((si: string) => q.includes(si.toLowerCase()) || si.toLowerCase().includes(q.split(' ')[0]))
    ).slice(0, 3)
    setShopSuggestions(sugg)
  }, [items, shops, selectedShop])

  useEffect(() => {
    function handler(e: MouseEvent) { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShopOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Item list helpers
  function setItem(idx: number, key: keyof ListItem, val: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it))
  }
  function addItem() { setItems(prev => [...prev, newItem()]) }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  function selectShop(shop: any) {
    setSelectedShop(shop); setShopId(String(shop.id))
    setShopFree(''); setShopSearch(''); setShopOpen(false)
  }
  function clearShop() { setSelectedShop(null); setShopId(''); setShopSearch('') }

  const filteredShops = shops.filter(s => {
    if (!shopSearch) return true
    const q = shopSearch.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q) || s.address?.toLowerCase().includes(q)
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter(i => i.text.trim())
    if (validItems.length === 0) { setErr('Mindestens ein Artikel wird benötigt.'); return }
    setLoading(true); setErr('')
    try {
      await api.createRequest({
        items: validItems.map(i => ({ text: i.text.trim(), quantity: i.quantity || null, notes: i.notes || null })),
        category_id:      categoryId ? Number(categoryId) : null,
        shop_id:          shopId ? Number(shopId) : null,
        shop_name_free:   shopId ? null : (shopFree || null),
        needed_by:        new Date(`${date}T${time}:00`).toISOString(),
        delivery_address: delivery || null
      })
      setDone(true)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  if (done) return (
    <div className="page">
      <div style={{ textAlign: 'center', padding: '60px 16px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2>Anfrage veröffentlicht!</h2>
        <p style={{ color: 'var(--gray-400)', margin: '12px 0 28px', fontSize: 14 }}>Ein Mitbringer meldet sich bald!</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={onCreated}>Zur Übersicht</button>
          <button className="btn" onClick={() => { setDone(false); setItems([newItem()]); setSelectedShop(null) }}>Neue Anfrage</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="page">
      {err && <div className="alert alert-error">{err}</div>}
      <form onSubmit={submit}>

        {/* ── Shop ── */}
        <div className="card">
          <div className="section-title" style={{ margin: '0 0 10px' }}>Bei welchem Shop?</div>

          {/* Shop suggestions based on items */}
          {shopSuggestions.length > 0 && !selectedShop && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 6 }}>Vorschläge passend zu deinen Artikeln:</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {shopSuggestions.map(s => (
                  <button key={s.id} type="button" className="btn btn-sm"
                    style={{ background: 'var(--green-light)', borderColor: 'var(--green-mid)', color: 'var(--green-dark)' }}
                    onClick={() => selectShop(s)}>
                    🏪 {s.name} {s.distance_km != null ? `· ${s.distance_km} km` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={dropRef} style={{ position: 'relative' }}>
            {selectedShop ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1.5px solid var(--green)', borderRadius: 'var(--rs)', background: 'var(--green-light)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedShop.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                    {[selectedShop.shop_type, selectedShop.address, selectedShop.city].filter(Boolean).join(' · ')}
                    {selectedShop.distance_km != null && <span style={{ color: 'var(--green)', marginLeft: 6 }}>📍 {selectedShop.distance_km} km</span>}
                  </div>
                </div>
                <button type="button" className="btn btn-sm" onClick={clearShop}>✕</button>
              </div>
            ) : (
              <input className="form-input" placeholder="🔍 Shop suchen…"
                value={shopSearch} onChange={e => { setShopSearch(e.target.value); setShopOpen(true) }}
                onFocus={() => setShopOpen(true)} />
            )}

            {shopOpen && !selectedShop && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 500, background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--rs)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxHeight: 260, overflowY: 'auto', marginTop: 4 }}>
                {filteredShops.length === 0
                  ? <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--gray-400)' }}>Kein Shop gefunden</div>
                  : filteredShops.map(s => (
                    <div key={s.id} onClick={() => selectShop(s)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--gray-50)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                      <div style={{ fontWeight: 500, fontSize: 14, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{s.name}{s.shop_type ? <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 12, marginLeft: 6 }}>({s.shop_type})</span> : null}</span>
                        <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, flexShrink: 0 }}>📍 {s.distance_km != null ? `${s.distance_km} km` : '– km'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                        {s.address ? `${s.address}, ${s.city || ''}` : s.city || 'Adresse nicht hinterlegt'}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {!selectedShop && (
            <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
              <input className="form-input" value={shopFree} onChange={e => setShopFree(e.target.value)}
                placeholder="Oder Freitext: z. B. Bäckerei Hiltner, Amberg" />
            </div>
          )}
        </div>

        {/* ── Einkaufszettel ── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Einkaufszettel</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <select className="form-input" style={{ fontSize: 12, padding: '4px 8px' }}
                  value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">Kategorie (optional)</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ background: 'var(--gray-50)', borderRadius: 'var(--rs)', padding: 10, border: '1px solid var(--gray-100)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 9 }}>
                    {idx + 1}
                  </div>
                  <input className="form-input" style={{ flex: 1 }}
                    placeholder={`Artikel ${idx + 1}, z. B. Brezen, Parmesan, Bio-Milch…`}
                    value={item.text} onChange={e => setItem(idx, 'text', e.target.value)}
                    required={idx === 0} />
                  {items.length > 1 && (
                    <button type="button" className="btn btn-sm btn-danger" style={{ padding: '6px 8px', flexShrink: 0 }}
                      onClick={() => removeItem(idx)}>✕</button>
                  )}
                </div>
                <div className="form-row" style={{ paddingLeft: 32 }}>
                  <input className="form-input" style={{ fontSize: 13 }}
                    placeholder="Menge (z. B. 6 Stück, 500g)"
                    value={item.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)} />
                  <input className="form-input" style={{ fontSize: 13 }}
                    placeholder="Hinweis (Sorte, Marke…)"
                    value={item.notes} onChange={e => setItem(idx, 'notes', e.target.value)} />
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-sm" style={{ marginTop: 10, width: '100%', borderStyle: 'dashed' }}
            onClick={addItem}>
            + Weiteren Artikel hinzufügen
          </button>
        </div>

        {/* ── Wann & Wo ── */}
        <div className="card">
          <div className="section-title" style={{ margin: '0 0 10px' }}>Wann & Wo liefern?</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Datum *</label>
              <input className="form-input" type="date" required value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Spätestens um *</label>
              <input className="form-input" type="time" required value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Lieferadresse / Treffpunkt</label>
            <input className="form-input" value={delivery} onChange={e => setDelivery(e.target.value)}
              placeholder="Adresse oder Beschreibung" />
          </div>
        </div>

        <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
          {loading ? 'Wird veröffentlicht…' : `📢 ${items.filter(i=>i.text.trim()).length} Artikel anfragen`}
        </button>
      </form>
    </div>
  )
}