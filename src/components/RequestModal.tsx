import React, { useState } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const SL: Record<string, string> = { open: 'Offen', assigned: 'Angenommen', completed: 'Erledigt', cancelled: 'Abgesagt' }

export function RequestModal({ r, canTake, busy, onAccept, onClose, currentUserId }: {
  r: any; canTake: boolean; busy: boolean; onAccept: () => void; onClose: () => void; currentUserId?: string
}) {
  const isRequester = String(currentUserId) === String(r.requester_id)
  const isBringer   = r.status === 'assigned' && String(currentUserId) === String(r.bringer_id)
  const showContact = r.status === 'assigned' && (isRequester || isBringer)
  const itemList: any[] = r.items?.length > 0 ? r.items : [{ text: r.item_text }]
  const [checked, setChecked] = useState<boolean[]>(() => itemList.map(() => false))
  const allChecked = checked.every(Boolean)
  const checkedCount = checked.filter(Boolean).length

  function toggleAll() { setChecked(itemList.map(() => !allChecked)) }

  function print() {
    const win = window.open('', '_blank')
    if (!win) return
    const date = format(new Date(r.needed_by), "EEEE, dd. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })
    win.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"/>
      <title>Einkaufszettel – ${r.shop_name || r.shop_name_free || 'Mitbringer'}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;padding:32px;max-width:480px}.logo{font-size:22px;font-weight:700;color:#1D9E75;margin-bottom:4px}.shop{font-size:20px;font-weight:700;margin:16px 0 4px}.meta{font-size:13px;color:#888;margin-bottom:20px}.items{border-top:2px solid #1D9E75;padding-top:12px}.item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #eee;align-items:flex-start}.num{font-size:13px;color:#aaa;font-weight:700;min-width:20px;padding-top:1px}.item-name{font-size:16px;font-weight:600}.item-qty{font-size:13px;color:#555;margin-top:2px}.item-note{font-size:12px;color:#888;font-style:italic;margin-top:2px}.checkbox{width:20px;height:20px;border:2px solid #ccc;border-radius:4px;margin-top:2px;flex-shrink:0}.footer{margin-top:24px;font-size:12px;color:#aaa;border-top:1px solid #eee;padding-top:12px}.delivery{margin-top:16px;padding:10px 14px;background:#f8f8f8;border-radius:8px;font-size:13px}@media print{body{padding:16px}}</style>
      </head><body>
      <div class="logo">🛍 Mitbringer</div>
      <div class="shop">${r.shop_name || r.shop_name_free || 'Shop'}</div>
      <div class="meta">Benötigt: ${date}${r.category_name ? ' · ' + r.category_name : ''}</div>
      <div class="items">${itemList.map((it, i) => `<div class="item"><div class="checkbox"></div><div class="num">${i+1}.</div><div><div class="item-name">${it.text}</div>${it.quantity ? `<div class="item-qty">${it.quantity}</div>` : ''}${it.notes ? `<div class="item-note">${it.notes}</div>` : ''}</div></div>`).join('')}</div>
      ${r.delivery_address ? `<div class="delivery">📬 Liefern an: <strong>${r.delivery_address}</strong></div>` : ''}
      <div class="footer">Erstellt mit Mitbringer · ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de })}</div>
      <script>window.onload=()=>{window.print()}<\/script></body></html>`)
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
          <div style={{ fontSize: 13, color: 'var(--gray-400)', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            <span>🕐 {format(new Date(r.needed_by), "EEE dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}</span>
            {r.category_name && <span>{r.category_icon} {r.category_name}</span>}
            {r.delivery_address && <span>📬 {r.delivery_address}</span>}
            {showContact && r.requester_first && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--green-light)', borderRadius: 6 }}>
                <span>👤 <strong>{r.requester_first} {r.requester_last}</strong></span>
                {r.requester_phone && (
                  <a href={`tel:${r.requester_phone}`} style={{ color: 'var(--green-dark)', fontWeight: 600 }}>📞 {r.requester_phone}</a>
                )}
              </span>
            )}
          </div>

          {/* Shopping list */}
          <div style={{ borderTop: '2px solid var(--green)', paddingTop: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 10px' }}>
              <div className="section-title" style={{ margin: 0 }}>
                Einkaufszettel
                {checkedCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>{checkedCount}/{itemList.length} erledigt</span>}
              </div>
              <button type="button" className="btn btn-sm"
                style={{ fontSize: 11, padding: '3px 8px', background: allChecked ? 'var(--green-light)' : undefined }}
                onClick={toggleAll}>{allChecked ? '✓ Alle abhaken' : 'Alle abhaken'}</button>
            </div>
            {itemList.map((it: any, idx: number) => (
              <div key={idx} onClick={() => setChecked(prev => prev.map((v, i) => i === idx ? !v : v))}
                style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: idx < itemList.length - 1 ? '1px solid var(--gray-100)' : 'none', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ width: 22, height: 22, border: `2px solid ${checked[idx] ? 'var(--green)' : 'var(--gray-200)'}`, borderRadius: 4, flexShrink: 0, background: checked[idx] ? 'var(--green)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}>
                  {checked[idx] && <span style={{ color: '#fff', fontSize: 14, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 700, minWidth: 20, flexShrink: 0 }}>{idx + 1}.</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: 15, textDecoration: checked[idx] ? 'line-through' : 'none', color: checked[idx] ? 'var(--gray-400)' : 'var(--gray-900)', transition: 'all .15s' }}>{it.text}</span>
                  {it.quantity && <span style={{ fontSize: 13, color: checked[idx] ? 'var(--gray-200)' : 'var(--gray-400)' }}>{it.quantity}</span>}
                  {it.notes && <span style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>({it.notes})</span>}
                </div>
              </div>
            ))}
            {allChecked && itemList.length > 0 && (
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
                  <a href={`tel:${r.bringer_phone}`} style={{ color: 'var(--green-dark)', fontWeight: 600, fontSize: 12 }}>📞 {r.bringer_phone}</a>
                )}
              </div>
            </div>
          )}

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
