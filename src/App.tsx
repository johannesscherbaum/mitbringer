import React, { useState } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import LoginPage      from './pages/LoginPage'
import RegisterPage   from './pages/RegisterPage'
import FeedPage       from './pages/FeedPage'
import NewRequestPage from './pages/NewRequestPage'
import ShopsPage      from './pages/ShopsPage'
import ProfilePage    from './pages/ProfilePage'
import AdminPage      from './pages/AdminPage'

type Page = 'feed' | 'new' | 'shops' | 'profile' | 'admin'

const NAV = [
  { id: 'feed'    as Page, label: 'Anfragen', icon: '🏠' },
  { id: 'new'     as Page, label: 'Neu',      icon: '➕' },
  { id: 'shops'   as Page, label: 'Shops',    icon: '🗺' },
  { id: 'profile' as Page, label: 'Profil',   icon: '👤' },
]

function Inner() {
  const { profile, loading } = useAuth()
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [page, setPage] = useState<Page>('feed')

  if (loading) return <div className="loading"><div className="spinner" /> Wird geladen…</div>

  if (!profile) return authMode === 'login'
    ? <LoginPage    onSwitch={() => setAuthMode('register')} />
    : <RegisterPage onSwitch={() => setAuthMode('login')} />

  const isAdmin  = profile.role === 'superadmin'
  const initials = `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
  const allNav   = isAdmin ? [...NAV, { id: 'admin' as Page, label: 'Admin', icon: '⚙️' }] : NAV

  return (
    <>
      {/* ── Top navbar ── */}
      <nav className="navbar">
        <div className="navbar-inner">
          <span className="navbar-logo">🛍 Mitbringer <small>v{__APP_VERSION__}</small></span>
          <div className="nav-links">
            {allNav.map(n => (
              <button key={n.id}
                className={`nav-btn${page === n.id ? ' active' : ''}${n.id === 'admin' ? ' admin' : ''}`}
                onClick={() => setPage(n.id)}>
                <span className="nb-icon">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>
          <div className="navbar-user">
            <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initials}</div>
            <span>{profile.first_name} {profile.last_name}</span>
          </div>
        </div>
      </nav>

      {/* ── Pages ── */}
      {page === 'feed'    && <FeedPage />}
      {page === 'new'     && <NewRequestPage onCreated={() => setPage('feed')} />}
      {page === 'shops'   && <ShopsPage />}
      {page === 'profile' && <ProfilePage />}
      {page === 'admin'   && isAdmin && <AdminPage />}

      {/* ── Mobile bottom nav ── */}
      <nav className="bottom-nav">
        {allNav.map(n => (
          <button key={n.id}
            className={`bottom-nav-btn${page === n.id ? ' active' : ''}${n.id === 'admin' ? ' admin' : ''}`}
            onClick={() => setPage(n.id)}>
            <span>{n.icon}</span>{n.label}
          </button>
        ))}
      </nav>
    </>
  )
}

export default function App() {
  return <AuthProvider><Inner /></AuthProvider>
}
