import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

const apiUrl = ((Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'http://localhost:3000').replace(/\/+$/, '')

const TOKEN_KEY = 'papa_session_token'

export type Me = {
  id: string
  username: string
  fullName: string
  role: 'member' | 'tech_admin'
  avatarUrl: string | null
  assemblyName: string
  districtName: string
}

export type Announcement = {
  id: string
  title: string
  body: string
  important: boolean
  level: 'national' | 'district' | 'local'
  author: { fullName: string; username: string; avatarUrl: string | null }
  createdAt: string
}

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code)
  }
}

type AuthSession = { token: string; refreshToken: string; expiresAt: number }
function parseAuthSession(value: string | null | undefined): AuthSession | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<AuthSession>
    return typeof parsed.token === 'string' && typeof parsed.refreshToken === 'string'
      ? { token: parsed.token, refreshToken: parsed.refreshToken, expiresAt: Number(parsed.expiresAt ?? 0) }
      : null
  } catch {
    return null
  }
}

async function request<T>(path: string, init?: RequestInit & { token?: string | null }): Promise<T> {
  const { token: suppliedToken, ...requestInit } = init ?? {}
  const storedToken = suppliedToken ?? await SecureStore.getItemAsync(TOKEN_KEY)
  const session = parseAuthSession(storedToken)
  const send = (accessToken?: string) => {
    const headers = new Headers(requestInit.headers)
    headers.set('Content-Type', 'application/json')
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    else if (storedToken) headers.set('Authorization', `Bearer ${storedToken}`)
    return fetch(`${apiUrl}/api/mobile${path}`, { ...requestInit, headers })
  }
  let res = await send(session?.token)
  if (res.status === 401 && session && path !== '/auth') {
    const refresh = await fetch(`${apiUrl}/api/mobile/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    })
    if (refresh.ok) {
      const fresh = (await refresh.json()) as AuthSession
      await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(fresh))
      res = await send(fresh.token)
    }
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new ApiError(String(body.error ?? 'server'), res.status)
  return body as T
}

export const api = {
  async loadToken() {
    return SecureStore.getItemAsync(TOKEN_KEY)
  },
  async login(identifier: string, password: string) {
    const session = await request<AuthSession>('/auth', { method: 'POST', body: JSON.stringify({ identifier, password }) })
    const token = JSON.stringify(session)
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    return token
  },
  async logout(token: string) {
    const session = parseAuthSession(token)
    await request('/auth', {
      method: 'DELETE',
      token,
      body: session ? JSON.stringify({ refresh_token: session.refreshToken }) : undefined,
    }).catch(() => {})
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  },
  me(token: string) {
    return request<{ user: Me }>('/me', { token })
  },
  announcements(token: string, page = 1) {
    return request<{ items: Announcement[]; hasMore: boolean }>(`/announcements?page=${page}`, { token })
  },
  markAnnouncementsSeen(token: string) {
    return request<{ ok: true }>('/announcements', { method: 'POST', token })
  },
}
