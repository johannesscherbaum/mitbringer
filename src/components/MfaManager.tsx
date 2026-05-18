import React, { useEffect, useState } from 'react'
import supabase from '../supabase'

export function MfaManager() {
  const [status,   setStatus]   = useState<'loading'|'off'|'pending'|'on'>('loading')
  const [qr,       setQr]       = useState('')
  const [secret,   setSecret]   = useState('')
  const [factorId, setFactorId] = useState('')
  const [code,     setCode]     = useState('')
  const [err,      setErr]      = useState('')
  const [saving,   setSaving]   = useState(false)

  useEffect(() => { checkStatus() }, [])

  async function checkStatus() {
    setStatus('loading')
    const { data } = await supabase.auth.mfa.listFactors()
    const verified = data?.totp?.find((f: any) => f.status === 'verified')
    const pending  = data?.totp?.find((f: any) => f.status === 'unverified')
    if (verified)     { setFactorId(verified.id); setStatus('on') }
    else if (pending) { setFactorId(pending.id);  setStatus('pending') }
    else              { setStatus('off') }
  }

  async function enroll() {
    setSaving(true); setErr('')
    // First need to sign in via supabase (we only have our own token)
    // We ask user to re-authenticate via supabase session check
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      setErr('Bitte zuerst ab- und wieder anmelden, dann MFA einrichten.')
      setSaving(false); return
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Mitbringer' })
    if (error) { setErr(error.message); setSaving(false); return }
    setQr(data.totp.qr_code)
    setSecret(data.totp.secret)
    setFactorId(data.id)
    setStatus('pending')
    setSaving(false)
  }

  async function verify() {
    setSaving(true); setErr('')
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId })
    if (!challenge) { setErr('Challenge fehlgeschlagen'); setSaving(false); return }
    const { error } = await supabase.auth.mfa.verify({
      factorId, challengeId: challenge.id, code: code.replace(/\s/g,'')
    })
    if (error) { setErr('Ungültiger Code — bitte nochmal versuchen.'); setSaving(false); return }
    setStatus('on'); setQr(''); setSecret(''); setCode('')
    setSaving(false)
  }

  async function unenroll() {
    if (!confirm('MFA wirklich deaktivieren?')) return
    setSaving(true)
    await supabase.auth.mfa.unenroll({ factorId })
    setStatus('off'); setFactorId(''); setSaving(false)
  }

  if (status === 'loading') return null

  return (
    <div>
      <div className="section-title" style={{ margin: '0 0 10px' }}>Zwei-Faktor-Authentifizierung (MFA)</div>

      {status === 'off' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>MFA ist nicht aktiv</div>
          <button className="btn btn-sm btn-primary" onClick={enroll} disabled={saving}>
            {saving ? '…' : 'MFA aktivieren'}
          </button>
        </div>
      )}

      {status === 'pending' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 12 }}>
            Scanne den QR-Code mit deiner Authenticator-App (z.B. Google Authenticator, Authy).
          </p>
          {err && <div className="alert alert-error">{err}</div>}
          {qr && (
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <img src={qr} alt="MFA QR Code" style={{ width: 180, height: 180, border: '1px solid var(--gray-100)', borderRadius: 8 }} />
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
                Oder manuell eingeben: <code style={{ background: 'var(--gray-100)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{secret}</code>
              </div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Code aus der App eingeben</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" type="text" inputMode="numeric" maxLength={7}
                placeholder="123 456" value={code} onChange={e => setCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verify()} autoComplete="one-time-code" />
              <button className="btn btn-primary btn-sm" onClick={verify}
                disabled={saving || code.replace(/\s/g,'').length < 6}>
                {saving ? '…' : '✓'}
              </button>
            </div>
          </div>
          <button className="btn btn-sm" onClick={() => { setStatus('off'); setQr(''); setCode('') }}>Abbrechen</button>
        </div>
      )}

      {status === 'on' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--green)', fontSize: 16 }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>MFA aktiv</span>
          </div>
          <button className="btn btn-danger btn-sm" onClick={unenroll} disabled={saving}>
            {saving ? '…' : 'Deaktivieren'}
          </button>
        </div>
      )}
    </div>
  )
}
