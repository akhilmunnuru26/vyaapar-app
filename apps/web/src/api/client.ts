import { paiseToRupees } from '@retail-management/contracts'

const apiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? ''
const API = `${apiOrigin}/api/v1`

let csrfToken: string | null = null

async function ensureCsrf(): Promise<string> {
  if (csrfToken) return csrfToken
  const res = await fetch(`${API}/auth/csrf`, { credentials: 'include' })
  if (!res.ok) throw new Error('csrf_failed')
  const body = (await res.json()) as { token: string }
  csrfToken = body.token
  return csrfToken
}

export type MeResponse = {
  user: { id: string; name: string; email: string }
  shop: { id: string; name: string; slug: string; timezone: string; role: string }
}

export type ApiOrderRow = {
  id: string
  name: string
  phone: string
  items: string
  amountPaise: number
  paidPaise: number
  outstandingPaise: number
  status: string
  statusLabel: string
  due: string | null
  overdue: boolean
  orderNumber: string
  orderDate: string
}

export type OrderView = {
  id: string
  name: string
  phone: string
  items: string
  amount: number
  paid: number
  status: string
  due: string
  overdue: boolean
}

export function mapOrderRow(row: ApiOrderRow): OrderView {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    items: row.items,
    amount: paiseToRupees(row.amountPaise),
    paid: paiseToRupees(row.paidPaise),
    status: row.statusLabel,
    due: row.due
      ? new Date(`${row.due}T00:00:00`).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—',
    overdue: row.overdue,
  }
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers)
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('x-csrf-token', await ensureCsrf())
  }
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const res = await fetch(path, { ...init, headers, credentials: 'include' })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null
    throw new Error(err?.error?.message ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function fetchMe(): Promise<MeResponse> {
  return apiJson(`${API}/auth/me`)
}

export async function login(email: string, password: string): Promise<MeResponse> {
  csrfToken = null
  const body = await apiJson<MeResponse>(`${API}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  await ensureCsrf()
  return body
}

export async function logout(): Promise<void> {
  await apiJson(`${API}/auth/logout`, { method: 'POST' })
  csrfToken = null
}

export async function fetchOrders(params: { q?: string; status?: string }): Promise<{ data: ApiOrderRow[] }> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.status && params.status !== 'All orders' && params.status !== 'Overdue') {
    search.set('status', params.status)
  }
  const qs = search.toString()
  return apiJson(`${API}/orders${qs ? `?${qs}` : ''}`)
}

export async function recordPayment(orderId: string, amountRupees: number, method = 'cash'): Promise<void> {
  const amountPaise = Math.round(amountRupees * 100)
  await apiJson(`${API}/orders/${orderId}/payments`, {
    method: 'POST',
    body: JSON.stringify({
      amountPaise,
      paidAt: new Date().toISOString(),
      method,
    }),
  })
}

export async function deleteOrder(orderId: string): Promise<void> {
  await apiJson(`${API}/orders/${orderId}`, { method: 'DELETE' })
}
