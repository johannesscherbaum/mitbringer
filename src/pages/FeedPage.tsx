import React, { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { useUserLocation } from '../useUserLocation'
import { api } from '../api'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const SL: Record<string, string> = { open: 'Offen', assigned: 'Angenommen', completed: 'Erledigt', cancelled: 'Abgesagt' }

// ── Request Detail Modal ──────────────────────────────────────────────────────
function RequestModal({ r, canTake, busy, onAccept, onClose, currentUserId }: {
  r: any; canTake: boolean; busy: boolean; onAccept: () => void; onClose: () => void; currentUserId?: number
}) {
  const isRequester = currentUserId === r.requester_id
  const isBringer   = r.status === 'assigned' && r.bringer_id != null
  const showContact = r.status === 'assigned' && (isRequester || !canTake)
  const itemList2: any[] = r.items?.length > 0 ? r.items : [{ text: r.item_text }]
  const [checked, setChecked] = useState<boolean[]>(() => itemList2.map(() => false))
  const allChecked = checked.every(Boolean)
  const checkedCount = checked.filter(Boolean).length

  function toggleAll() {
    const next = !allChecked
    setChecked(itemList2.map(() => next))
  }
  const itemList: any[] = r.items?.length > 0 ? r.items : [{ text: r.item_text }]

  function print() {
    const win = window.open('', '_blank')
    if (!win) return
    const date = format(new Date(r.needed_by), "EEEE, dd. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })
    win.document.write(`
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="UTF-8" />
        <title>Einkaufszettel – ${r.shop_name || r.shop_name_free || 'Mitbringer'}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, sans-serif; padding: 32px; max-width: 480px; }
          .logo { font-size: 22px; font-weight: 700; color: #1D9E75; margin-bottom: 4px; }
          .shop { font-size: 20px; font-weight: 700; margin: 16px 0 4px; }
          .meta { font-size: 13px; color: #888; margin-bottom: 20px; }
          .items { border-top: 2px solid #1D9E75; padding-top: 12px; }
          .item { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eee; align-items: flex-start; }
          .num { font-size: 13px; color: #aaa; font-weight: 700; min-width: 20px; padding-top: 1px; }
          .item-name { font-size: 16px; font-weight: 600; }
          .item-qty { font-size: 13px; color: #555; margin-top: 2px; }
          .item-note { font-size: 12px; color: #888; font-style: italic; margin-top: 2px; }
          .checkbox { width: 20px; height: 20px; border: 2px solid #ccc; border-radius: 4px; margin-top: 2px; flex-shrink: 0; }
          .footer { margin-top: 24px; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
          .delivery { margin-top: 16px; padding: 10px 14px; background: #f8f8f8; border-radius: 8px; font-size: 13px; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <div class="logo">🛍 Mitbringer</div>
        <div class="shop">${r.shop_name || r.shop_name_free || 'Shop'}</div>
        <div class="meta">
          Benötigt: ${date}
          ${r.category_name ? ' · ' + r.category_name : ''}
        </div>
        <div class="items">
          ${itemList.map((it, i) => `
            <div class="item">
              <div class="checkbox"></div>
              <div class="num">${i + 1}.</div>
              <div>
                <div class="item-name">${it.text}</div>
                ${it.quantity ? `<div class="item-qty">${it.quantity}</div>` : ''}
                ${it.notes ? `<div class="item-note">${it.notes}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        ${r.delivery_address ? `<div class="delivery">📬 Liefern an: <strong>${r.delivery_address}</strong></div>` : ''}
        <div class="footer">Erstellt mit Mitbringer · ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de })}</div>
        <script>window.onload = () => { window.print() }<\/script>
      </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--gray-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{r.shop_name || r.shop_name_free || 'Shop unbekannt'}</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>
                {r.distance_km != null && <span style={{ color: 'var(--green)', fontWeight: 600, marginRight: 10 }}>📍 {r.distance_km} km</span>}
                {r.shop_hours_today !== undefined && (
                  <span style={{ color: r.shop_hours_today ? 'var(--green-dark)' : 'var(--red)' }}>
                    {r.shop_hours_today ? `🕐 Heute ${r.shop_hours_today}` : 'Heute geschlossen'}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className={`badge badge-${r.status}`}>{SL[r.status]}</span>
              <button className="btn btn-sm" onClick={onClose}>✕</button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 16 }}>
          {/* Meta */}
          <div style={{ fontSize: 13, color: 'var(--gray-400)', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            <span>🕐 {format(new Date(r.needed_by), "EEE dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}</span>
            {r.category_name && <span>{r.category_icon} {r.category_name}</span>}
            {r.delivery_address && (
              <span>
                📬 {r.delivery_address}
                {showContact && r.requester_first && (
                  <strong style={{ color: 'var(--gray-900)', marginLeft: 6 }}>
                    → {r.requester_first} {r.requester_last}
                    {r.requester_phone && (
                      <a href={`tel:${r.requester_phone}`} style={{ color: 'var(--green)', marginLeft: 8 }}>
                        📞 {r.requester_phone}
                      </a>
                    )}
                  </strong>
                )}
              </span>
            )}
          </div>

          {/* Shopping list */}
          <div style={{ borderTop: '2px solid var(--green)', paddingTop: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 10px' }}>
              <div className="section-title" style={{ margin: 0 }}>
                Einkaufszettel
                {checkedCount > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>
                    {checkedCount}/{itemList2.length} erledigt
                  </span>
                )}
              </div>
              <button type="button" className="btn btn-sm"
                style={{ fontSize: 11, padding: '3px 8px', background: allChecked ? 'var(--green-light)' : undefined }}
                onClick={toggleAll}>
                {allChecked ? '✓ Alle abhaken' : 'Alle abhaken'}
              </button>
            </div>
            {itemList2.map((it: any, idx: number) => (
              <div key={idx}
                onClick={() => setChecked(prev => prev.map((v, i) => i === idx ? !v : v))}
                style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: idx < itemList2.length - 1 ? '1px solid var(--gray-100)' : 'none', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{
                  width: 22, height: 22, border: `2px solid ${checked[idx] ? 'var(--green)' : 'var(--gray-200)'}`,
                  borderRadius: 4, flexShrink: 0,
                  background: checked[idx] ? 'var(--green)' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .15s'
                }}>
                  {checked[idx] && <span style={{ color: '#fff', fontSize: 14, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 700, minWidth: 20, flexShrink: 0 }}>{idx + 1}.</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 15, textDecoration: checked[idx] ? 'line-through' : 'none', color: checked[idx] ? 'var(--gray-400)' : 'var(--gray-900)', transition: 'all .15s' }}>
                    {it.text}
                  </span>
                  {it.quantity && <span style={{ fontSize: 13, color: checked[idx] ? 'var(--gray-200)' : 'var(--gray-400)' }}>{it.quantity}</span>}
                  {it.notes && <span style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>({it.notes})</span>}
                </div>
              </div>
            ))}
            {allChecked && itemList2.length > 0 && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--green-light)', borderRadius: 6, fontSize: 13, color: 'var(--green-dark)', fontWeight: 500, textAlign: 'center' }}>
                ✓ Alle Artikel eingepackt!
              </div>
            )}
          </div>

          {/* Bringer info */}
          {r.status === 'assigned' && (
            <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--amber-light)', borderRadius: 8, marginBottom: 12 }}>
              <div className="avatar" style={{ width: 26, height: 26, fontSize: 11, background: '#EF9F27', color: '#fff' }}>
                {r.bringer_first?.[0] ?? '?'}
              </div>
              <div>
                <div>{r.bringer_first ? `${r.bringer_first} ${r.bringer_last} bringt es mit` : 'Wird gerade gebracht'}</div>
                {showContact && r.bringer_phone && (
                  <a href={`tel:${r.bringer_phone}`} style={{ color: 'var(--green-dark)', fontWeight: 600, fontSize: 12 }}>
                    📞 {r.bringer_phone}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            {canTake && (
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={e => { e.stopPropagation(); onAccept() }}>
                {busy ? 'Wird angenommen…' : '✓ Annehmen'}
              </button>
            )}
            <button className="btn" onClick={print} title="Drucken">🖨 Drucken</button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
