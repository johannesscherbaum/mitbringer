import React, { useState } from 'react'
import { useAuth, MfaChallenge } from '../AuthContext'

export default function LoginPage({ onSwitch }: { onSwitch: () => void }) {
  const { login, verifyMfa } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [code,     setCode]     = useState('')
  const [mfa,      setMfa]      = useState<MfaChallenge | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [err,      setErr]      = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setErr('')
    try {
      const result = await login(email, password)
      if (result.mfa) setMfa(result.mfa)
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault(); if (!mfa) return
    setLoading(true); setErr('')
    try { await verifyMfa(mfa, code) }
    catch (e: any) { setErr(e.message); setLoading(false) }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">🛍 Mitbringer</div>

        {mfa ? (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Zwei-Faktor-Authentifizierung</h2>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-400)', marginBottom: 20 }}>
              Gib den Code aus deiner Authenticator-App ein.
            </p>
            {err && <div className="alert alert-error">{err}</div>}
            <form onSubmit={handleMfa}>
              <div className="form-group">
                <label className="form-label">6-stelliger Code</label>
                <input className="form-input" type="text" inputMode="numeric" pattern="[0-9 ]*"
                  value={code} onChange={e => setCode(e.target.value)}
                  placeholder="123 456" maxLength={7} autoFocus autoComplete="one-time-code" />
              </div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading || code.replace(/\s/g,'').length < 6}>
                {loading ? 'Wird geprüft…' : '✓ Bestätigen'}
              </button>
            </form>
            <div className="auth-foot">
              <button onClick={() => { setMfa(null); setCode(''); setErr('') }}>← Zurück</button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Anmelden</h2>
            {err && <div className="alert alert-error">{err}</div>}
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">E-Mail</label>
                <input className="form-input" type="email" required value={email}
                  onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="form-group">
                <label className="form-label">Passwort</label>
                <input className="form-input" type="password" required value={password}
                  onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading ? 'Wird angemeldet…' : 'Anmelden'}
              </button>
            </form>
            <div className="auth-foot">
              Noch kein Konto? <button onClick={onSwitch}>Jetzt registrieren</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
