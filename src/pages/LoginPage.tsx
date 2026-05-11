import React, { useState } from 'react'
import { useAuth } from '../AuthContext'

export default function LoginPage({ onSwitch }: { onSwitch: () => void }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetOk, setResetOk] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setErr('')
    try { await login(email, pw) }
    catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">🛍 Mitbringer</div>
        {!resetMode ? (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Anmelden</h2>
            {err && <div className="alert alert-error">{err}</div>}
            <form onSubmit={submit}>
              <div className="form-group">
                <label className="form-label">E-Mail</label>
                <input className="form-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Passwort</label>
                <input className="form-input" type="password" required value={pw} onChange={e => setPw(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Anmelden…' : 'Anmelden'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button className="btn btn-sm" style={{ border: 'none', color: 'var(--gray-400)' }}
                onClick={() => setResetMode(true)}>Passwort vergessen?</button>
            </div>
            <div className="auth-foot">
              Noch kein Konto? <button onClick={onSwitch}>Jetzt registrieren</button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: 16 }}>Passwort zurücksetzen</h2>
            {resetOk
              ? <div className="alert alert-info">✓ Im lokalen Modus nicht verfügbar. Wende dich an den Admin.</div>
              : <form onSubmit={e => { e.preventDefault(); setResetOk(true) }}>
                  <div className="form-group">
                    <label className="form-label">E-Mail</label>
                    <input className="form-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <button className="btn btn-primary btn-full">Link anfordern</button>
                </form>
            }
            <div className="auth-foot">
              <button onClick={() => { setResetMode(false); setResetOk(false) }}>← Zurück zum Login</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
