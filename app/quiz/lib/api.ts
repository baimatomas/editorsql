'use client'

/**
 * Helpers para llamar a las rutas /api/quiz/* con el JWT del docente.
 * Mismo token que el editor: editorsql_admin_token en localStorage.
 */
export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('editorsql_admin_token')
}

export function isAdmin(): boolean {
  return !!getAdminToken()
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (res.status === 401) {
    // Token vencido/inválido → limpiar y avisar
    localStorage.removeItem('editorsql_admin_token')
    throw new Error('Sesión de docente vencida. Iniciá sesión nuevamente.')
  }
  return res
}

export async function apiQuiz<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await request(path, options)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`)
  return data as T
}

export async function loginTeacher(username: string, password: string): Promise<string> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Error de login')
  return (data as { token: string }).token
}
