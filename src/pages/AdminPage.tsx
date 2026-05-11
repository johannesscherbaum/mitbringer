import React, { useEffect, useState } from 'react'
import { adminApi } from '../api'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

const ROLES = ['orderer', 'bringer', 'both', 'superadmin']
const ROLE_LABEL: Record<string, string> = {
  orderer: '🛒 Besteller', bringer: '🚶 Mitbringer',
  both: '🤝 Beides', superadmin: '⚙️ Superadmin'
}
const SL: Record<string, string> = {
  open: 'Offen', assigned: 'Angenommen', completed: 'Erledigt', cancelled: 'Abgesagt'
}

type Tab = 'overview' | 'users' | 'requests'

export default function AdminPage() {
  const [tab, setTab]         = useState<Tab>('overview')
  const [stats, setStats]     = useState<any>(null)
  const [users, setUsers]     = useState<any[]>([])
  const [requests, setReqs]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [flash, setFlash]     = useState('')
  const [reqFilter, setReqFilter] = useState('all')
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [s, u, r] = await Promise.all([
        adminApi.stats(), adminApi.users(), adminApi.allRequests()
      ])
      setStats(s); setUsers(u); setReqs(r)
    } catch (e: any) { setFlash('Fehler: ' + e.message) }
    setLoading(false)
  }

  async function changeRole(id: number, role: string) {
    try {
      await adminApi.setRole(id, role)
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
      showFlash('✓ Rolle aktualisiert')
    } catch (e: any) { showFlash('Fehler: ' + e.message) }
  }

  async function deleteUser(id: number, name: string) {
    if (!confirm(`User "${name}" wirklich löschen? Alle seine Anfragen werden ebenfalls gelöscht.`)) return
    try {
      await adminApi.deleteUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
      showFlash('✓ User gelöscht')
    } catch (e: any) { showFlash('Fehler: ' + e.message) }
  }

  async function changeReqStatus(id: number, status: string) {
    try {
      await adminApi.setReqStatus(id, status)
      setReqs(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      showFlash('✓ Status aktualisiert')
    } catch (e: any) { showFlash('Fehler: ' + e.message) }
  }

  function showFlash(msg: string) {
    setFlash(msg); setTimeout(() => setFlash(''), 3000)
  }

  const filteredReqs = requests.filter(r => reqFilter === 'all' || r.status === reqFilter)
  const filteredUsers = users.filter(u =>
    !userSearch ||
    `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase())
  )

  if (loading) return <div className="loading"><div className="spinner" /> Lädt…</div>

  return (
    <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>⚙️ Adminbereich</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Benutzerverwaltung · Anfragen · Statistiken</p>
        </div>

        {flash && <div className="alert alert-info">{flash}</div>}

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([['overview','📊 Übersicht'], ['users','👥 Benutzer'], ['requests','📋 Anfragen']] as [Tab, string][]).map(([id, label]) => (
            <button key={id} className={`btn${tab === id ? ' btn-primary' : ''}`}
              onClick={() => setTab(id)}>{label}</button>
          ))}
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={loadAll}>↻ Aktualisieren</button>
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {[
                ['👥', stats.users, 'Benutzer'],
                ['📋', stats.requests, 'Anfragen gesamt'],
                ['🏪', stats.shops, 'Shops'],
                ['🤝', stats.assignments, 'Aufträge'],
              ].map(([icon, num, label]) => (
                <div key={label as string} className="stat-card">
                  <div style={{ fontSize: 22 }}>{icon}</div>
                  <div className="stat-num">{num}</div>
                  <div className="stat-label">{label as string}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="section-title" style={{ margin: '0 0 12px' }}>Anfragen nach Status</div>
              {[
                ['open',      'Offen',      'var(--green)'],
                ['assigned',  'Angenommen', '#EF9F27'],
                ['completed', 'Erledigt',   '#3B6D11'],
                ['cancelled', 'Abgesagt',   'var(--red)'],
              ].map(([key, label, color]) => {
                const count = stats[key] ?? 0
                const pct   = stats.requests > 0 ? Math.round(count / stats.requests * 100) : 0
                return (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{label}</span><span style={{ fontWeight: 600 }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color as string, borderRadius: 4, transition: 'width .5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Users ── */}
        {tab === 'users' && (
          <>
            <div className="form-group">
              <input className="form-input" placeholder="🔍 Name oder E-Mail suchen…"
                value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 10 }}>
              {filteredUsers.length} Benutzer
            </div>
            {filteredUsers.map(u => (
              <div className="card" key={u.id}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div className="avatar" style={{ width: 42, height: 42, fontSize: 16, flexShrink: 0 }}>
                    {u.first_name[0]}{u.last_name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{u.first_name} {u.last_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>{u.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                      {u.city || '–'} · {u.request_count} Anfragen · {u.assignment_count} Aufträge
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                      Registriert: {format(new Date(u.created_at), 'dd.MM.yyyy', { locale: de })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <select
                      className="form-input"
                      style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
                      value={u.role}
                      onChange={e => changeRole(u.id, e.target.value)}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <button className="btn btn-danger btn-sm"
                      onClick={() => deleteUser(u.id, `${u.first_name} ${u.last_name}`)}>
                      🗑 Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Requests ── */}
        {tab === 'requests' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {['all', 'open', 'assigned', 'completed', 'cancelled'].map(f => (
                <button key={f} className={`btn btn-sm${reqFilter === f ? ' btn-primary' : ''}`}
                  onClick={() => setReqFilter(f)}>
                  {f === 'all' ? 'Alle' : SL[f]}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--gray-400)', alignSelf: 'center' }}>
                {filteredReqs.length} Anfragen
              </span>
            </div>

            {filteredReqs.map(r => (
              <div className="card" key={r.id}>
                <div className="card-header">
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{r.item_text}</div>
                    <div className="card-meta">
                      <span>👤 {r.requester_first} {r.requester_last}</span>
                      {(r.shop_name || r.shop_name_free) && <span>🏪 {r.shop_name || r.shop_name_free}</span>}
                      <span>🕐 {format(new Date(r.needed_by), "dd.MM.yy HH:mm 'Uhr'", { locale: de })}</span>
                      {r.category_name && <span>{r.category_icon} {r.category_name}</span>}
                    </div>
                    {r.bringer_first && (
                      <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>
                        🚶 Mitbringer: {r.bringer_first} {r.bringer_last}
                      </div>
                    )}
                    {r.notes && (
                      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4, fontStyle: 'italic' }}>
                        "{r.notes}"
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <span className={`badge badge-${r.status}`}>{SL[r.status]}</span>
                    <select
                      className="form-input"
                      style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}
                      value={r.status}
                      onChange={e => changeReqStatus(r.id, e.target.value)}
                    >
                      {['open', 'assigned', 'completed', 'cancelled'].map(s => (
                        <option key={s} value={s}>{SL[s]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
  )
}
