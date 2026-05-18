import React, { useEffect, useRef, useState } from 'react'
import supabase from '../supabase'
import { RequestModal } from '../components/RequestModal'
import { MfaManager } from '../components/MfaManager'
import { useAuth } from '../AuthContext'
import { api } from '../api'
import { useUserLocation } from '../useUserLocation'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const SL: Record<string, string> = { open:'Offen', assigned:'Angenommen', completed:'Erledigt', cancelled:'Abgesagt' }

export default function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [myReqs,  setMyReqs]  = useState<any[]>([])
  const [myAsgn,  setMyAsgn]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [flash,   setFlash]   = useState('')
  const [editReq, setEditReq] = useState<any | null>(null)
  const [editShops, setEditShops] = useState<any[]>([])
  const [tab,     setTab]     = useState<'requests'|'profile'>('requests')

  // Profile edit state
  const [radius,    setRadius]    = useState(profile?.radius_km ?? 5)
  const [address,   setAddress]   = useState(profile?.address   || '')
  const [city,      setCity]      = useState(profile?.city       || '')
  const [postalCode,setPostalCode]= useState((profile as any)?.postal_code || '')
  const [phone,     setPhone]     = useState((profile as any)?.phone || '')
  const [saving,    setSaving]    = useState(false)
  const [geocoding, setGeocoding] = useState(false)

  useEffect(() => {
    if (profile) {
      setRadius(profile.radius_km ?? 5)
      setAddress(profile.address   || '')
      setCity(profile.city         || '')
      setPostalCode((profile as any)?.postal_code || '')
      setPhone((profile as any)?.phone || '')
      loadData()
    }
  }, [profile?.id])

  async function loadData() {
    setLoading(true)
    try { const [r, a] = await Promise.all([api.myRequests(), api.myAssignments()]); setMyReqs(r); setMyAsgn(a) }
    catch {}
    setLoading(false)
  }

  const [modalReq, setModalReq] = useState<any | null>(null)
  const [busy,     setBusy]     = useState<number | null>(null)

  function showFlash(msg: string) { setFlash(msg); setTimeout(() => setFlash(''), 3000) }

  async function accept(id: number) {
    setBusy(id)
    try { await api.acceptRequest(id); showFlash('✓ Auftrag angenommen!'); setModalReq(null); loadData() }
    catch (e: any) { showFlash('Fehler: ' + e.message) }
    setBusy(null)
  }

  async function deleteAccount() {
    if (!confirm('Konto wirklich löschen? Alle deine Anfragen und Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.')) return
    if (!confirm('Bist du sicher? Das Konto wird unwiderruflich gelöscht.')) return
    try {
      await api.deleteMe()
      signOut()
    } catch (e: any) { showFlash('Fehler: ' + e.message) }
  }

  async function saveProfile() {
    setSaving(true)
    try {
      // Geocode if address changed
      let lat = (profile as any)?.lat, lng = (profile as any)?.lng
      const addrChanged = address !== profile?.address || city !== profile?.city
      if (addrChanged && (address || city)) {
        setGeocoding(true)
        try {
          const q = encodeURIComponent(`${address}, ${postalCode} ${city}, Germany`)
          const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`)
          const d = await r.json()
          if (d.length > 0) { lat = parseFloat(d[0].lat); lng = parseFloat(d[0].lon) }
        } catch {}
        setGeocoding(false)
      }
      await api.updateMe({ radius_km: radius, address, city, postal_code: postalCode, phone: phone || null, lat, lng })
      await refreshProfile()
      showFlash('✓ Profil gespeichert')
    } catch (e: any) { showFlash('Fehler: ' + e.message) }
    setSaving(false)
  }

  async function deleteReq(id: number) {
    if (!confirm('Anfrage wirklich löschen?')) return
    try { await api.deleteRequest(id); loadData(); showFlash('✓ Anfrage gelöscht') }
    catch (e: any) { showFlash('Fehler: ' + e.message) }
  }

  async function saveEdit() {
    if (!editReq) return
    try {
      await api.updateRequest(editReq.id, {
        items: editReq.items,
        item_text: (editReq.items||[]).map((i:any)=>i.text).join(', '),
        needed_by: new Date(`${editReq._date}T${editReq._time}:00`).toISOString(),
        delivery_address: editReq.delivery_address,
        shop_id: editReq.shop_id || null,
        shop_name_free: editReq.shop_name_free || null,
      })
      setEditReq(null); loadData(); showFlash('✓ Anfrage gespeichert')
    } catch (e: any) { showFlash('Fehler: ' + e.message) }
  }

  function openEdit(r: any) {
    const d = new Date(r.needed_by)
    setEditReq({ ...r, _date: d.toISOString().split('T')[0], _time: d.toTimeString().slice(0,5) })
    // Load shops near user, with generous radius so the linked shop shows up
    const lat = (profile as any)?.lat, lng = (profile as any)?.lng
    api.shops(lat || undefined, lng || undefined, 100)
      .then(shops => {
        setEditShops(shops)
      }).catch(() => {})
  }

  const initials  = profile ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase() : '?'
  const isBringer = profile?.role === 'bringer' || profile?.role === 'both' || profile?.role === 'superadmin'
  const roleLabel = { orderer:'🛒 Besteller', bringer:'🚶 Mitbringer', both:'🤝 Beides', superadmin:'⚙️ Superadmin' }[profile?.role ?? 'orderer']

  return (
    <div className="page">
      {flash && <div className="alert alert-info">{flash}</div>}

      {/* Profile header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="avatar" style={{ width: 50, height: 50, fontSize: 18 }}>{initials}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 17 }}>{profile?.first_name} {profile?.last_name}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>{roleLabel}{profile?.city ? ` · ${profile.city}` : ''}</div>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button className={`btn${tab==='requests' ? ' btn-primary' : ''}`} onClick={() => setTab('requests')}>
          📋 Meine Anfragen
        </button>
        <button className={`btn${tab==='profile' ? ' btn-primary' : ''}`} onClick={() => setTab('profile')}>
          ⚙️ Profil bearbeiten
        </button>
      </div>

      {/* ── Profil bearbeiten ── */}
      {tab === 'profile' && (
        <div className="card">
          <div className="section-title" style={{ margin: '0 0 14px' }}>Persönliche Daten</div>

          <div className="form-group">
            <label className="form-label">Straße & Nr.</label>
            <input className="form-input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Musterstraße 1" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">PLZ</label>
              <input className="form-input" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="92224" />
            </div>
            <div className="form-group">
              <label className="form-label">Stadt</label>
              <input className="form-input" value={city} onChange={e => setCity(e.target.value)} placeholder="Amberg" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Telefon (optional)</label>
            <input className="form-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49 9621 12345" />
            <p className="form-hint">Wird nach Annahme einer Anfrage für den Mitbringer/Anfrager sichtbar.</p>
          </div>

          {isBringer && (
            <>
              <div className="divider" />
              <div className="section-title" style={{ margin: '0 0 10px' }}>Mitbringer-Einstellungen</div>
              <label className="form-label">Aktionsradius: <strong>{radius} km</strong></label>
              <input type="range" min={1} max={100} value={radius}
                onChange={e => setRadius(Number(e.target.value))} style={{ margin: '6px 0 4px' }} />
              <p className="form-hint">Anfragen in diesem Umkreis werden dir angezeigt.</p>
            </>
          )}

          <div className="divider" />
          <button className="btn btn-primary btn-full" onClick={saveProfile} disabled={saving || geocoding}>
            {geocoding ? '📍 Adresse wird geocodiert…' : saving ? 'Speichern…' : '✓ Profil speichern'}
          </button>

          <div className="divider" style={{ marginTop: 24 }} />
          <MfaManager />
          <div className="divider" style={{ marginTop: 16 }} />
          <div style={{ textAlign: 'center' }}>
            <button className="btn btn-sm" style={{ color: 'var(--gray-400)', borderColor: 'var(--gray-200)', fontSize: 12 }}
              onClick={deleteAccount}>
              Konto löschen
            </button>
          </div>
        </div>
      )}

      {/* ── Meine Anfragen ── */}
      {tab === 'requests' && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-num">{myReqs.length}</div><div className="stat-label">Anfragen</div></div>
            <div className="stat-card"><div className="stat-num">{myAsgn.length}</div><div className="stat-label">Mitgebracht</div></div>
            <div className="stat-card"><div className="stat-num">{profile?.rating?.toFixed(1) ?? '–'}</div><div className="stat-label">Bewertung</div></div>
          </div>

          <div className="section-title">Meine Anfragen</div>
          {loading ? <div className="loading"><div className="spinner" /></div>
            : myReqs.length === 0 ? <div className="empty"><p>Noch keine Anfragen erstellt.</p></div>
            : (
              <div className="tile-grid">
                {myReqs.map(r => {
                  const itemList = r.items?.length > 0 ? r.items : [{ text: r.item_text }]
                  return (
                    <div key={r.id} className="tile" style={{ cursor: 'pointer' }} onClick={() => setModalReq(r)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, flex: 1, marginRight: 8 }}>
                          {r.shop_name || r.shop_name_free || '–'}
                        </div>
                        <span className={`badge badge-${r.status}`}>{SL[r.status]}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                        {itemList[0].text}
                        {itemList[0].quantity && <span style={{ color: 'var(--gray-400)', marginLeft: 5 }}>· {itemList[0].quantity}</span>}
                        {itemList.length > 1 && <span style={{ color: 'var(--gray-400)', marginLeft: 5 }}>+{itemList.length-1} weitere</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: r.status === 'open' ? 8 : 0 }}>
                        🕐 {format(new Date(r.needed_by), "dd.MM.yy HH:mm 'Uhr'", { locale: de })}
                      </div>
                      {r.status === 'open' && (
                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => openEdit(r)}>✏️ Bearbeiten</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteReq(r.id)}>🗑</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          }

          {isBringer && (
            <>
              <div className="section-title">Meine Mitbring-Aufträge</div>
              {myAsgn.length === 0 ? <div className="empty"><p>Noch keine Aufträge angenommen.</p></div>
                : (
                  <div className="tile-grid">
                    {myAsgn.map(a => (
                      <div key={a.id} className="tile" style={{ cursor: 'pointer' }} onClick={() => setModalReq({ ...a, status: a.req_status, shop_name: a.shop_name })}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{a.shop_name || a.shop_name_free || '–'}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{a.item_text}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-400)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span>🕐 {format(new Date(a.needed_by), "dd.MM.yy HH:mm 'Uhr'", { locale: de })}</span>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <span className={`badge badge-${a.req_status}`}>{SL[a.req_status] ?? a.req_status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </>
          )}
        </>
      )}

      {/* Edit modal */}
      {editReq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3>Anfrage bearbeiten</h3>
              <button className="btn btn-sm" onClick={() => setEditReq(null)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Einkaufszettel</label>
              {(editReq.items || [{ text: editReq.item_text, quantity: '', notes: '' }]).map((it: any, idx: number) => (
                <div key={idx} style={{ background: 'var(--gray-50)', borderRadius: 'var(--rs)', padding: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 700, paddingTop: 11, flexShrink: 0 }}>{idx+1}.</span>
                    <input className="form-input" placeholder="Artikel" value={it.text}
                      onChange={e => { const its=[...(editReq.items||[])]; its[idx]={...its[idx],text:e.target.value}; setEditReq((r:any)=>({...r,items:its})) }} />
                    {(editReq.items?.length>1) && (
                      <button type="button" className="btn btn-sm btn-danger" style={{ padding:'6px 8px' }}
                        onClick={() => setEditReq((r:any)=>({...r,items:r.items.filter((_:any,i:number)=>i!==idx)}))}>✕</button>
                    )}
                  </div>
                  <div className="form-row" style={{ paddingLeft: 20 }}>
                    <input className="form-input" style={{ fontSize:12 }} placeholder="Menge" value={it.quantity||''}
                      onChange={e => { const its=[...(editReq.items||[])]; its[idx]={...its[idx],quantity:e.target.value}; setEditReq((r:any)=>({...r,items:its})) }} />
                    <input className="form-input" style={{ fontSize:12 }} placeholder="Hinweis" value={it.notes||''}
                      onChange={e => { const its=[...(editReq.items||[])]; its[idx]={...its[idx],notes:e.target.value}; setEditReq((r:any)=>({...r,items:its})) }} />
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-sm" style={{ width:'100%', borderStyle:'dashed' }}
                onClick={() => setEditReq((r:any)=>({...r,items:[...(r.items||[]),{text:'',quantity:'',notes:''}]}))}>
                + Artikel hinzufügen
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">Shop</label>
              <select className="form-input" style={{ marginBottom: 6 }}
                value={editReq.shop_id || ''}
                onChange={e => setEditReq((r:any) => ({ ...r, shop_id: e.target.value ? Number(e.target.value) : null, shop_name_free: e.target.value ? null : r.shop_name_free }))}>
                <option value="">– Bekannten Shop wählen –</option>
                {/* Show currently linked shop even if not in list */}
                {editReq.shop_id && !editShops.find((s:any) => s.id === editReq.shop_id) && (
                  <option value={editReq.shop_id}>{editReq.shop_name || `Shop #${editReq.shop_id}`}</option>
                )}
                {editShops.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` (${s.city})` : ''}</option>)}
              </select>
              {!editReq.shop_id && (
                <input className="form-input" placeholder="Oder Freitext: Bäckerei Hiltner…"
                  value={editReq.shop_name_free||''} onChange={e=>setEditReq((r:any)=>({...r,shop_name_free:e.target.value}))} />
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Datum</label>
                <input className="form-input" type="date" value={editReq._date} onChange={e=>setEditReq((r:any)=>({...r,_date:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Uhrzeit</label>
                <input className="form-input" type="time" value={editReq._time} onChange={e=>setEditReq((r:any)=>({...r,_time:e.target.value}))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Lieferadresse</label>
              <input className="form-input" value={editReq.delivery_address||''} onChange={e=>setEditReq((r:any)=>({...r,delivery_address:e.target.value}))} />
            </div>
            <button className="btn btn-primary btn-full" onClick={saveEdit}>✓ Speichern</button>
          </div>
        </div>
      )}
    {/* Request detail modal */}
      {modalReq && (
        <RequestModal
          r={modalReq}
          canTake={false}
          busy={busy === modalReq.id}
          onAccept={() => accept(modalReq.id)}
          onClose={() => setModalReq(null)}
          currentUserId={profile?.id}
        />
      )}
    </div>
  )
}