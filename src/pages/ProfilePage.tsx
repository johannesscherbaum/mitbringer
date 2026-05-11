import React, { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { api } from '../api'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const SL: Record<string, string> = { open:'Offen', assigned:'Angenommen', completed:'Erledigt', cancelled:'Abgesagt' }

function PhoneEditor({ profile, refreshProfile, showFlash }: { profile: any; refreshProfile: () => Promise<void>; showFlash: (m: string) => void }) {
  const [phone,   setPhone]   = useState(profile?.phone || '')
  const [saving,  setSaving]  = useState(false)

  async function save() {
    setSaving(true)
    try { await api.updateMe({ phone: phone || null }); await refreshProfile(); showFlash('✓ Telefon gespeichert') }
    catch (e: any) { showFlash('Fehler: ' + (e as any).message) }
    setSaving(false)
  }

  return (
    <div>
      <label className="form-label">Telefonnummer</label>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input className="form-input" type="tel" value={phone}
          onChange={e => setPhone(e.target.value)} placeholder="+49 9621 12345" />
        <button className="btn btn-sm btn-primary" onClick={save} disabled={saving}>
          {saving ? '…' : 'Speichern'}
        </button>
      </div>
      <p className="form-hint">Wird nach Annahme einer Anfrage für den Mitbringer/Anfrager sichtbar.</p>
    </div>
  )
}

export default function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [myReqs,   setMyReqs]   = useState<any[]>([])
  const [myAsgn,   setMyAsgn]   = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [radius,   setRadius]   = useState(profile?.radius_km ?? 5)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [editReq,  setEditReq]  = useState<any | null>(null)
  const [flash,    setFlash]    = useState('')

  useEffect(() => { if (profile) { setRadius(profile.radius_km ?? 5); loadData() } }, [profile])

  async function loadData() {
    setLoading(true)
    try { const [r, a] = await Promise.all([api.myRequests(), api.myAssignments()]); setMyReqs(r); setMyAsgn(a) }
    catch {}
    setLoading(false)
  }

  function showFlash(msg: string) { setFlash(msg); setTimeout(() => setFlash(''), 3000) }

  async function saveRadius() {
    setSaving(true)
    try { await api.updateMe({ radius_km: radius }); await refreshProfile(); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    catch {}
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
        item_text:        editReq.item_text,
        quantity:         editReq.quantity,
        notes:            editReq.notes,
        shop_name_free:   editReq.shop_name_free,
        needed_by:        new Date(`${editReq._date}T${editReq._time}:00`).toISOString(),
        delivery_address: editReq.delivery_address,
      })
      setEditReq(null); loadData(); showFlash('✓ Anfrage gespeichert')
    } catch (e: any) { showFlash('Fehler: ' + e.message) }
  }

  function openEdit(r: any) {
    const d = new Date(r.needed_by)
    setEditReq({
      ...r,
      _date: d.toISOString().split('T')[0],
      _time: d.toTimeString().slice(0, 5),
    })
  }

  const initials  = profile ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase() : '?'
  const isBringer = profile?.role === 'bringer' || profile?.role === 'both'
  const roleLabel = { orderer:'🛒 Besteller', bringer:'🚶 Mitbringer', both:'🤝 Besteller & Mitbringer', superadmin:'⚙️ Superadmin' }[profile?.role ?? 'orderer']

  return (
    <div className="page">
      {flash && <div className="alert alert-info">{flash}</div>}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div className="avatar" style={{ width: 50, height: 50, fontSize: 18 }}>{initials}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 17 }}>{profile?.first_name} {profile?.last_name}</div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>{roleLabel}{profile?.city ? ` · ${profile.city}` : ''}</div>
          </div>
        </div>
        {isBringer && <>
          <div className="divider" />
          <label className="form-label">Aktionsradius: <strong>{radius} km</strong></label>
          <input type="range" min={1} max={25} value={radius} onChange={e => setRadius(Number(e.target.value))} style={{ margin: '6px 0 10px' }} />
          <button className="btn btn-primary btn-sm" onClick={saveRadius} disabled={saving}>
            {saving ? 'Speichern…' : saved ? '✓ Gespeichert' : 'Radius speichern'}
          </button>
        </>}
        <div className="divider" />
        <PhoneEditor profile={profile} refreshProfile={refreshProfile} showFlash={showFlash} />
        <div className="divider" />
        <button className="btn btn-danger btn-sm" onClick={signOut}>← Abmelden</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-num">{myReqs.length}</div><div className="stat-label">Anfragen</div></div>
        <div className="stat-card"><div className="stat-num">{myAsgn.length}</div><div className="stat-label">Mitgebracht</div></div>
        <div className="stat-card"><div className="stat-num">{profile?.rating?.toFixed(1) ?? '–'}</div><div className="stat-label">Bewertung</div></div>
      </div>

      {/* My requests */}
      <div className="section-title">Meine Anfragen</div>
      {loading ? <div className="loading"><div className="spinner" /></div>
        : myReqs.length === 0 ? <div className="empty"><p>Noch keine Anfragen erstellt.</p></div>
        : (
          <div className="tile-grid">
            {myReqs.map(r => (
              <div key={r.id} className="tile">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1, marginRight: 8 }}>
                    {r.items?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
                        {r.items.map((it: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                            <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600 }}>{idx+1}.</span>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{it.text}</span>
                            {it.quantity && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{it.quantity}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.item_text}</div>
                    )}
                  </div>
                  <span className={`badge badge-${r.status}`}>{SL[r.status]}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
                  <span>{r.shop_name || r.shop_name_free || '–'}</span>
                  <span>🕐 {format(new Date(r.needed_by), "dd.MM.yy HH:mm 'Uhr'", { locale: de })}</span>
                </div>
                {r.status === 'open' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => openEdit(r)}>✏️ Bearbeiten</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteReq(r.id)}>🗑</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }

      {/* My assignments */}
      {isBringer && <>
        <div className="section-title">Meine Mitbring-Aufträge</div>
        {myAsgn.length === 0 ? <div className="empty"><p>Noch keine Aufträge angenommen.</p></div>
          : (
            <div className="tile-grid">
              {myAsgn.map(a => (
                <div key={a.id} className="tile">
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{a.item_text}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span>{a.shop_name || a.shop_name_free || '–'}</span>
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
      </>}

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
              {(editReq.items || [{ text: editReq.item_text, quantity: editReq.quantity, notes: '' }]).map((it: any, idx: number) => (
                <div key={idx} style={{ background: 'var(--gray-50)', borderRadius: 'var(--rs)', padding: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 700, paddingTop: 11, flexShrink: 0 }}>{idx+1}.</span>
                    <input className="form-input" placeholder="Artikel" value={it.text}
                      onChange={e => { const its = [...(editReq.items || [{ text: editReq.item_text, quantity: editReq.quantity, notes: '' }])]; its[idx] = { ...its[idx], text: e.target.value }; setEditReq((r: any) => ({ ...r, items: its, item_text: its.map((i:any)=>i.text).join(', ') })) }} />
                    {(editReq.items?.length > 1) && (
                      <button type="button" className="btn btn-sm btn-danger" style={{ padding: '6px 8px' }}
                        onClick={() => { const its = editReq.items.filter((_:any, i:number) => i !== idx); setEditReq((r:any) => ({ ...r, items: its })) }}>✕</button>
                    )}
                  </div>
                  <div className="form-row" style={{ paddingLeft: 20 }}>
                    <input className="form-input" style={{ fontSize: 12 }} placeholder="Menge" value={it.quantity || ''}
                      onChange={e => { const its = [...(editReq.items || [])]; its[idx] = { ...its[idx], quantity: e.target.value }; setEditReq((r: any) => ({ ...r, items: its })) }} />
                    <input className="form-input" style={{ fontSize: 12 }} placeholder="Hinweis" value={it.notes || ''}
                      onChange={e => { const its = [...(editReq.items || [])]; its[idx] = { ...its[idx], notes: e.target.value }; setEditReq((r: any) => ({ ...r, items: its })) }} />
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-sm" style={{ width: '100%', borderStyle: 'dashed' }}
                onClick={() => setEditReq((r: any) => ({ ...r, items: [...(r.items || []), { text: '', quantity: '', notes: '' }] }))}>
                + Artikel hinzufügen
              </button>
            </div>
            <div className="form-group">
              <label className="form-label">Shop (Freitext)</label>
              <input className="form-input" value={editReq.shop_name_free || ''} onChange={e => setEditReq((r: any) => ({ ...r, shop_name_free: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Datum</label>
                <input className="form-input" type="date" value={editReq._date} onChange={e => setEditReq((r: any) => ({ ...r, _date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Uhrzeit</label>
                <input className="form-input" type="time" value={editReq._time} onChange={e => setEditReq((r: any) => ({ ...r, _time: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Hinweis</label>
              <input className="form-input" value={editReq.notes || ''} onChange={e => setEditReq((r: any) => ({ ...r, notes: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Lieferadresse</label>
              <input className="form-input" value={editReq.delivery_address || ''} onChange={e => setEditReq((r: any) => ({ ...r, delivery_address: e.target.value }))} />
            </div>
            <button className="btn btn-primary btn-full" onClick={saveEdit}>✓ Speichern</button>
          </div>
        </div>
      )}
    </div>
  )
}
