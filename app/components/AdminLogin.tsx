'use client'

import { useState } from 'react'
import { LogIn, X, Shield } from 'lucide-react'

export default function AdminLogin({
  onLogin,
  onClose,
}: {
  onLogin: (token: string) => void
  onClose: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error de autenticación')
      onLogin(data.token)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-card border border-surface-border rounded-xl shadow-2xl w-80 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <div className="flex items-center gap-2 text-txt-body">
            <Shield size={14} />
            <span className="text-xs font-semibold">Acceso Docente</span>
          </div>
          <button onClick={onClose} className="text-txt-dim hover:text-txt-body transition-colors">
            <X size={14} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-txt-dim uppercase tracking-wider block mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-surface-border bg-surface text-txt-body placeholder:text-txt-dim/50 focus:outline-none focus:border-institutional-500 transition-colors"
              placeholder="docente"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-txt-dim uppercase tracking-wider block mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-surface-border bg-surface text-txt-body placeholder:text-txt-dim/50 focus:outline-none focus:border-institutional-500 transition-colors"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-[11px] text-red-400 bg-red-600/10 rounded px-2 py-1">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-institutional-600 text-white hover:bg-institutional-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-100"
          >
            <LogIn size={13} />
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
