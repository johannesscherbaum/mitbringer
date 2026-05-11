import React, { useState } from 'react'
import { useAuth } from '../AuthContext'

export default function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
  const { register } = useAuth()
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '', password2: '',
    role: 'orderer', address: '', city: '', postal_code: '', radius_km: 5, phone: ''
  })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.password2) { setErr('Passwörter stimmen nicht überein.'); return }
    if (form.password.length < 8) { setErr('Mindestens 8 Zeichen.'); return }
    setLoading(true); setErr('')
    try {
      // Geocode address to coordinates
      let lat = null, lng = null
      if (form.address && form.city) {
        try {
          const q = encodeURIComponent(`${form.address}, ${form.postal_code} ${form.city}, Germany`)
          const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`)
          const d = await r.json()
          if (d.length > 0) { lat = parseFloat(d[0].lat); lng = parseFloat(d[0].lon) }
        } catch {}
      }
      await register({ ...form, password2: undefined, lat, lng, phone: form.phone || null })
    }
    catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  const isBringer = form.role === 'bringer' || form.role === 'both'

  return (
    <div className="auth-wrap" style={{ alignItems: 'flex-start', paddingTop: 32 }}>
      <div className="auth-card">
        <div className="auth-logo">🛍 Mitbringer</div>
        <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Konto erstellen</h2>
        {err && <div className="alert alert-error">{err}</div>}
        <form onSubmit={submit}>
          <div className="section-title">Ich möchte…</div>
          <div className="type-grid">
            {[['orderer','🛒','Besteller','Ich stelle Anfragen'],
              ['bringer','🚶','Mitbringer','Ich bringe Dinge mit']].map(([r, icon, name, desc]) => (
              <div key={r} className={`type-card${form.role === r ? ' selected' : ''}`} onClick={() => set('role', r)}>
                <div className="type-card-icon">{icon}</div>
                <div className="type-card-name">{name}</div>
                <div className="type-card-desc">{desc}</div>
              </div>
            ))}
          </div>
          <div className={`type-card${form.role === 'both' ? ' selected' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', marginBottom: 14 }}
            onClick={() => set('role', 'both')}>
            <div style={{ fontSize: 22 }}>🤝</div>
            <div><div className="type-card-name">Beides</div><div className="type-card-desc">Bestellen & Mitbringen</div></div>
          </div>

          <div className="section-title">Persönliche Daten</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Vorname</label>
              <input className="form-input" required value={form.first_name} onChange={e => set('first_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Nachname</label>
              <input className="form-input" required value={form.last_name} onChange={e => set('last_name', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">E-Mail</label>
            <input className="form-input" type="email" required value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Passwort</label>
              <input className="form-input" type="password" required placeholder="Min. 8 Zeichen"
                value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Wiederholen</label>
              <input className="form-input" type="password" required
                value={form.password2} onChange={e => set('password2', e.target.value)} />
            </div>
          </div>

          <div className="section-title">Standort</div>
          <div className="form-group">
            <label className="form-label">Straße & Nr.</label>
            <input className="form-input" placeholder="Musterstraße 1" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">PLZ</label>
              <input className="form-input" placeholder="92224" value={form.postal_code} onChange={e => set('postal_code', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Stadt</label>
              <input className="form-input" placeholder="Amberg" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Telefon (optional)</label>
            <input className="form-input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+49 9621 12345" />
            <p className="form-hint">Wird nach Annahme einer Anfrage für Besteller/Mitbringer sichtbar.</p>
          </div>

          {isBringer && (
            <>
              <div className="section-title">Mitbringer-Einstellungen</div>
              <div className="form-group">
                <label className="form-label">Aktionsradius: <strong>{form.radius_km} km</strong></label>
                <input type="range" min={1} max={25} value={form.radius_km}
                  onChange={e => set('radius_km', Number(e.target.value))} />
              </div>
            </>
          )}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Wird erstellt…' : 'Konto erstellen'}
          </button>
        </form>
        <div className="auth-foot">Schon ein Konto? <button onClick={onSwitch}>Anmelden</button></div>
      </div>
    </div>
  )
}
