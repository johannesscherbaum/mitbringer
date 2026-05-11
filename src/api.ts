const BASE = '/api'

function token() { return localStorage.getItem('mb_token') }
export function setToken(t: string) { localStorage.setItem('mb_token', t) }
export function clearToken() { localStorage.removeItem('mb_token') }
export function hasToken() { return !!token() }

async function req<T>(method: string, path: string, body?: unknown, authed = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authed) { const t = token(); if (t) headers['Authorization'] = `Bearer ${t}` }
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Serverfehler')
  return data as T
}

export const api = {
  register:      (body: unknown)        => req<any>('POST',  '/register',  body),
  login:         (email: string, pw: string) => req<any>('POST', '/login', { email, password: pw }),
  me:            ()                     => req<any>('GET',   '/me',                  undefined, true),
  updateMe:      (body: unknown)        => req<any>('PATCH', '/me',                  body,      true),

  categories:    ()                     => req<any[]>('GET', '/categories'),
  shops:         (lat?: number, lng?: number, radius?: number) => {
    const params = new URLSearchParams()
    if (lat    != null) params.set('lat',    String(lat))
    if (lng    != null) params.set('lng',    String(lng))
    if (radius != null) params.set('radius', String(radius))
    const qs = params.toString()
    return req<any[]>('GET', `/shops${qs ? '?' + qs : ''}`)
  },
  addShop:       (body: unknown)        => req<any>('POST',  '/shops',               body,      true),
  updateShop:    (id: number, body: unknown) => req<any>('PATCH', `/shops/${id}`,    body,      true),
  fetchWebsite:  (url: string)              => req<any>('GET',   `/fetch-website?url=${encodeURIComponent(url)}`, undefined, true),

  requests:      (lat?: number, lng?: number) => { const p = new URLSearchParams(); if (lat != null) p.set('lat', String(lat)); if (lng != null) p.set('lng', String(lng)); return req<any[]>('GET', `/requests${p.toString() ? '?' + p : ''}`); },
  createRequest: (body: unknown)        => req<any>('POST',  '/requests',            body,      true),
  cancelRequest: (id: number)           => req<any>('PATCH', `/requests/${id}/cancel`, {},      true),
  updateRequest: (id: number, body: unknown) => req<any>('PATCH', `/requests/${id}`,       body,    true),
  deleteRequest: (id: number)           => req<any>('DELETE', `/requests/${id}`,            undefined, true),
  acceptRequest: (request_id: number)   => req<any>('POST',  '/assignments',         { request_id }, true),

  myRequests:    ()                     => req<any[]>('GET', '/my/requests',    undefined, true),
  myAssignments: ()                     => req<any[]>('GET', '/my/assignments', undefined, true),
}

export const adminApi = {
  stats:        ()                           => req<any>('GET',    '/admin/stats',                  undefined, true),
  users:        ()                           => req<any[]>('GET',  '/admin/users',                  undefined, true),
  setRole:      (id: number, role: string)   => req<any>('PATCH',  `/admin/users/${id}/role`,        { role },  true),
  deleteUser:   (id: number)                 => req<any>('DELETE', `/admin/users/${id}`,             undefined, true),
  allRequests:  ()                           => req<any[]>('GET',  '/admin/requests',               undefined, true),
  setReqStatus: (id: number, status: string) => req<any>('PATCH',  `/admin/requests/${id}/status`, { status }, true),
}
