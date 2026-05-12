import React, { useEffect, useState } from 'react'
import { RequestModal } from '../components/RequestModal'
import { useAuth } from '../AuthContext'
import { useUserLocation } from '../useUserLocation'
import { api } from '../api'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const SL: Record<string, string> = { open: 'Offen', assigned: 'Angenommen', completed: 'Erledigt', cancelled: 'Abgesagt' }

// ── Request Detail Modal ──────────────────────────────────────────────────────
// ── Main page ─────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const { profile } = useAuth()
  const userLoc = useUserLocation(profile)
  const [rows,         setRows]         = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [flash,        setFlash]        = useState('')
  const [busy,         setBusy]         = useState<number | null>(null)
  const [modalReq,     setModalReq]     = useState<any | null>(null)
  const [catFilter,    setCatFilter]    = useState('')
  const [shopFilter,   setShopFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState<'all'|'open'|'assigned'>('all')

  const isAdmin = profile?.role === 'superadmin'
  const [showAll, setShowAll] = useState(false)

  useEffect(() => { load() }, [userLoc.lat, userLoc.lng, showAll])

  async function load() {
    setLoading(true)
    try { setRows(await api.requests(userLoc.lat, userLoc.lng, showAll)) } catch {}
    setLoading(false)
  }

  async function accept(id: number) {
    setBusy(id)
    try { await api.acceptRequest(id); setFlash('✓ Auftrag angenommen!'); setModalReq(null); load() }
    catch (e: any) { setFlash('Fehler: ' + e.message) }
    setBusy(null); setTimeout(() => setFlash(''), 3000)
  }

  const canBring = profile?.role === 'bringer' || profile?.role === 'both' || profile?.role === 'superadmin'
  const categories = [...new Set(rows.map(r => r.category_name).filter(Boolean))].sort()
  const shops      = [...new Set(rows.map(r => r.shop_name || r.shop_name_free).filter(Boolean))].sort()
  const filtered   = rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (catFilter  && r.category_name !== catFilter) return false
    if (shopFilter && (r.shop_name || r.shop_name_free) !== shopFilter) return false
    return true
  })

  if (loading) return <div className="loading"><div className="spinner" /> Lädt…</div>

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Anfragen</h2>
        <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--gray-400)' }}>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>{rows.filter(r=>r.status==='open').length} offen</span>
          <span>{rows.filter(r=>r.status==='assigned').length} unterwegs</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {(['all','open','assigned'] as const).map(s => (
          <button key={s} className={`btn btn-sm${statusFilter === s ? ' btn-primary' : ''}`}
            onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'Alle' : SL[s]}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: 'var(--gray-200)', margin: '0 2px' }} />
        {categories.length > 0 && (
          <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
            value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">Alle Kategorien</option>
            {categories.map(c => <option key={c as string}>{c as string}</option>)}
          </select>
        )}
        {shops.length > 0 && (
          <select className="form-input" style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
            value={shopFilter} onChange={e => setShopFilter(e.target.value)}>
            <option value="">Alle Shops</option>
            {shops.map(s => <option key={s as string}>{s as string}</option>)}
          </select>
        )}
        {(catFilter || shopFilter || statusFilter !== 'all') && (
          <button className="btn btn-sm" onClick={() => { setCatFilter(''); setShopFilter(''); setStatusFilter('all') }}>✕</button>
        )}
        {isAdmin && (
          <button className={`btn btn-sm${showAll ? ' btn-primary' : ''}`}
            style={{ marginLeft: 'auto' }}
            onClick={() => setShowAll(v => !v)}>
            {showAll ? '⚙️ Alle' : '⚙️ Nur aktive'}
          </button>
        )}
        <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{filtered.length} Anfragen</span>
      </div>

      {flash && <div className="alert alert-info">{flash}</div>}

      {filtered.length === 0
        ? <div className="empty"><div className="empty-icon">🎉</div><h3>Keine Anfragen</h3><p>Leg die erste an!</p></div>
        : (
          <div className="tile-grid">
            {filtered.map(r => {
              const itemList: any[] = r.items?.length > 0 ? r.items : [{ text: r.item_text }]
              const isOwn   = profile?.id === r.requester_id
              const canTake = r.status === 'open' && canBring && !isOwn

              return (
                <div className="tile" key={r.id} style={{ cursor: 'pointer' }}
                  onClick={() => setModalReq(r)}>

                  {/* Shop + badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                        {r.shop_name || r.shop_name_free || <span style={{ color: 'var(--gray-400)' }}>Shop unbekannt</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {r.distance_km != null && <span style={{ color: 'var(--green)', fontWeight: 600 }}>📍 {r.distance_km} km</span>}
                        {r.shop_hours_today !== undefined && (
                          <span style={{ color: r.shop_hours_today ? 'var(--green-dark)' : 'var(--red)' }}>
                            {r.shop_hours_today ? `🕐 ${r.shop_hours_today}` : 'geschlossen'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`badge badge-${r.status}`} style={{ flexShrink: 0 }}>{SL[r.status]}</span>
                  </div>

                  <div style={{ height: 1, background: 'var(--gray-100)', margin: '4px 0 8px' }} />

                  {/* First item preview */}
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                    {itemList[0].text}
                    {itemList[0].quantity && <span style={{ color: 'var(--gray-400)', fontWeight: 400, marginLeft: 5 }}>· {itemList[0].quantity}</span>}
                    {itemList.length > 1 && <span style={{ color: 'var(--gray-400)', fontWeight: 400, marginLeft: 6 }}>+{itemList.length - 1} weitere</span>}
                  </div>

                  {/* Time + meta */}
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: canTake ? 10 : 0 }}>
                    <span>🕐 {format(new Date(r.needed_by), "EEE dd.MM. HH:mm 'Uhr'", { locale: de })}</span>
                    {r.category_name && <span>{r.category_icon} {r.category_name}</span>}
                  </div>

                  {/* Bringer */}
                  {r.status === 'assigned' && (
                    <div style={{ fontSize: 12, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '5px 8px', background: 'var(--amber-light)', borderRadius: 6 }}>
                      <div className="avatar" style={{ width: 20, height: 20, fontSize: 10, background: '#EF9F27', color: '#fff' }}>
                        {r.bringer_first?.[0] ?? '?'}
                      </div>
                      {r.bringer_first ? `${r.bringer_first} ${r.bringer_last} bringt es mit` : 'Wird gebracht'}
                    </div>
                  )}

                  {/* Accept button — stop propagation so tile click doesn't fire */}
                  {canTake && (
                    <button className="btn btn-primary btn-full" disabled={busy === r.id}
                      onClick={e => { e.stopPropagation(); accept(r.id) }}>
                      {busy === r.id ? 'Wird angenommen…' : '✓ Annehmen'}
                    </button>
                  )}

                  {isOwn && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 8, textAlign: 'center' }}>Deine Anfrage</div>}
                </div>
              )
            })}
          </div>
        )
      }

      {/* Detail modal */}
      {modalReq && (
        <RequestModal
          r={modalReq}
          canTake={modalReq.status === 'open' && canBring && profile?.id !== modalReq.requester_id}
          busy={busy === modalReq.id}
          onAccept={() => accept(modalReq.id)}
          onClose={() => setModalReq(null)}
          currentUserId={profile?.id}
        />
      )}
    </div>
  )
}
