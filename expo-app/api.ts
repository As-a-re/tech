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

async function request<T>(path: string, init?: RequestInit & { token?: string | null }): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (init?.token) headers.Authorization = `Bearer ${init.token}`
  const res = await fetch(`${apiUrl}/api/mobile${path}`, { ...init, headers })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new ApiError(String(body.error ?? 'server'), res.status)
  return body as T
}

export const api = {
  async loadToken() {
    return SecureStore.getItemAsync(TOKEN_KEY)
  },
  async login(identifier: string, password: string) {
    const { token } = await request<{ token: string }>('/auth', { method: 'POST', body: JSON.stringify({ identifier, password }) })
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    return token
  },
  async logout(token: string) {
    await request('/auth', { method: 'DELETE', token }).catch(() => {})
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
