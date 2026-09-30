'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Pencil, Trash2, Loader2, ListOrdered, Clock } from 'lucide-react'
import { apiQuiz, isAdmin, loginTeacher } from '../lib/api'
import type { QuizQuestion } from '../lib/types'
import QuestionForm from '../components/QuestionForm'

export default function QuizAdmin() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<QuizQuestion | null>(null)
  const [creating, setCreating] = useState(false)
  const [teacher, setTeacher] = useState(false)
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiQuiz<{ questions: QuizQuestion[] }>('/api/quiz/questions')
      setQuestions(data.questions)
    } catch {
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setTeacher(isAdmin())
    if (isAdmin()) load()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setLoginLoading(true)
    try {
      const token = await loginTeacher(loginUser, loginPass)
      localStorage.setItem('editorsql_admin_token', token)
      setTeacher(true)
      load()
    } catch (err) {
      setLoginError((err as Error).message)
    } finally {
      setLoginLoading(false)
    }
  }

  const createOrUpdate = async (q: { id?: string; prompt: string; options: string[]; correct_index: number; time_limit: number }) => {
    if (q.id) {
      await apiQuiz('/api/quiz/questions', { method: 'PUT', body: JSON.stringify(q) })
      setEditing(null)
    } else {
      await apiQuiz('/api/quiz/questions', { method: 'POST', body: JSON.stringify(q) })
      setCreating(false)
    }
    load()
  }

  const remove = async (id: string) => {
    await apiQuiz(`/api/quiz/questions?id=${id}`, { method: 'DELETE' })
    load()
  }

  if (!teacher) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="preguntas-card p-8 w-full max-w-sm animate-pop-in space-y-4">
          <h1 className="font-bold text-xl mb-2">Acceso docente</h1>
          <p className="text-sm text-violet-200/60">Necesitás iniciar sesión para gestionar las preguntas.</p>
          <input
            value={loginUser}
            onChange={(e) => setLoginUser(e.target.value)}
            placeholder="Usuario"
            autoFocus
            className="preguntas-input w-full px-4 py-3 text-sm"
          />
          <input
            type="password"
            value={loginPass}
            onChange={(e) => setLoginPass(e.target.value)}
            placeholder="Contraseña"
            className="preguntas-input w-full px-4 py-3 text-sm"
          />
          {loginError && <p className="text-rose-300 text-sm">{loginError}</p>}
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 transition-all disabled:opacity-50"
          >
            {loginLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Ingresar'}
          </button>
          <a href="/quiz" className="block text-center text-xs text-violet-200/40 hover:text-violet-200 pt-2">
            ← Volver
          </a>
        </form>
      </main>
    )
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <a href="/quiz" className="flex items-center gap-2 text-violet-200/60 hover:text-violet-100 text-sm transition-colors">
          <ArrowLeft size={16} /> Hub de Preguntas
        </a>
        <h1 className="font-bold text-2xl">Banco de preguntas</h1>
        <span className="text-xs text-violet-200/40">{questions.length} preguntas</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-violet-300" />
        </div>
      ) : creating || editing ? (
        <QuestionForm
          initial={editing}
          onSubmit={createOrUpdate}
          onCancel={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      ) : (
        <>
          <button
            onClick={() => setCreating(true)}
            className="w-full mb-6 flex items-center justify-center gap-2 py-4 rounded-xl font-bold
                       bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:from-fuchsia-400 hover:to-violet-400
                       shadow-lg shadow-fuchsia-900/40 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            + Nueva pregunta
          </button>

          <div className="space-y-3">
            {questions.length === 0 && (
              <p className="text-center text-violet-200/40 py-10 text-sm">
                Todavía no hay preguntas. Creá la primera para poder lanzar una partida.
              </p>
            )}
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="preguntas-card p-4 flex items-start gap-4 group hover:border-violet-300/40 transition-colors animate-slide-up"
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <div className="flex items-center gap-1.5 text-violet-300/50 text-xs font-semibold pt-1 flex-shrink-0 w-8">
                  <ListOrdered size={12} /> {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium mb-1.5">{q.prompt}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((o, i) => (
                      <span
                        key={i}
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          i === q.correct_index
                            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                            : 'border-white/10 text-violet-200/40'
                        }`}
                      >
                        {o}
                      </span>
                    ))}
                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-violet-200/40 flex items-center gap-1">
                      <Clock size={9} /> {q.time_limit}s
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditing(q)}
                    className="p-2 rounded-lg hover:bg-white/10 text-violet-200/60 hover:text-white transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => remove(q.id)}
                    className="p-2 rounded-lg hover:bg-rose-500/20 text-violet-200/60 hover:text-rose-300 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
