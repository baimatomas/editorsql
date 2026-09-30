'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Pencil, Trash2, Loader2, ListOrdered, Clock, Upload, Copy, Check, Bot } from 'lucide-react'
import { apiQuiz, isAdmin, loginTeacher } from '../lib/api'
import type { QuizQuestion } from '../lib/types'
import QuestionForm from '../components/QuestionForm'

const AI_PROMPT = `Actuá como creador de contenido para un juego de preguntas estilo quiz para estudiantes.

Temática: [TEMA — p.ej. SQL, historia argentina, sistema solar]
Cantidad de preguntas: [CANTIDAD — p.ej. 10]
Nivel: [NIVEL — p.ej. primer año de secundaria]

Generame ÚNICAMENTE un JSON válido (sin explicaciones, sin markdown, sin texto antes ni después) con esta estructura exacta:

[
  {
    "pregunta": "¿Qué comando se usa para consultar datos de una tabla?",
    "opciones": ["SELECT", "INSERT", "UPDATE", "DELETE"],
    "correcta": 0,
    "tiempo": 20
  }
]

Reglas:
- "pregunta": consola clara y concreta, máximo 500 caracteres.
- "opciones": entre 2 y 4 opciones, todas plausibles, sin numerarlas.
- "correcta": el ÍNDICE de la opción correcta (0 = primera, 1 = segunda, 2 = tercera, 3 = cuarta).
- "tiempo": segundos para responder (usá 10, 20, 30 o 60).
- Dificultad progresiva: las primeras fáciles, las últimas desafiantes.
- Nada de preguntas de opinión ni con más de una respuesta válida.

Respondeme solo el JSON, empezando con [ y terminando con ].`

export default function QuizAdmin() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<QuizQuestion | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [importingBusy, setImportingBusy] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string; errores?: Array<{ item: number; motivo: string }> } | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
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

  const importJson = async () => {
    setImportResult(null)
    let parsed: unknown
    try {
      // Tolerante: recorta texto alrededor del JSON (p.ej. si la IA lo envuelve en ```json)
      const cleaned = jsonText.replace(/```(?:json)?/gi, '').trim()
      const start = cleaned.indexOf('[')
      const end = cleaned.lastIndexOf(']')
      if (start === -1 || end === -1 || end < start) throw new Error('No se encontró un array [ ... ] en el texto pegado')
      parsed = JSON.parse(cleaned.slice(start, end + 1))
    } catch (err) {
      setImportResult({ ok: false, msg: 'JSON inválido: ' + (err as Error).message })
      return
    }
    setImportingBusy(true)
    try {
      const res = await apiQuiz<{ imported: number }>('/api/quiz/questions/bulk', {
        method: 'POST',
        body: JSON.stringify({ questions: parsed }),
      })
      setImportResult({ ok: true, msg: `✅ Se importaron ${res.imported} preguntas correctamente.` })
      setJsonText('')
      load()
    } catch (err) {
      const e = err as Error & { payload?: { errores?: Array<{ item: number; motivo: string }> } }
      setImportResult({ ok: false, msg: e.message, errores: e.payload?.errores })
    } finally {
      setImportingBusy(false)
    }
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT)
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2000)
    } catch { /* sin permisos de clipboard */ }
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
            setImporting(false)
          }}
        />
      ) : importing ? (
        <div className="space-y-5 animate-slide-up">
          {/* Prompt para la IA */}
          <div className="preguntas-card p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Bot size={18} className="text-cyan-300" />
                Generá las preguntas con una IA
              </h2>
              <button
                onClick={copyPrompt}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/20 transition-all"
              >
                {copiedPrompt ? <Check size={13} /> : <Copy size={13} />}
                {copiedPrompt ? '¡Copiado!' : 'Copiar prompt'}
              </button>
            </div>
            <p className="text-sm text-violet-200/60 mb-3">
              Copiá este prompt, pegalo en un chat de IA (ChatGPT, Gemini, Claude...), reemplazá{' '}
              <code className="text-fuchsia-200 bg-fuchsia-500/15 px-1.5 py-0.5 rounded">[TEMA]</code> y{' '}
              <code className="text-fuchsia-200 bg-fuchsia-500/15 px-1.5 py-0.5 rounded">[CANTIDAD]</code>, y la respuesta
              pegala acá abajo.
            </p>
            <pre className="text-[11px] leading-relaxed bg-black/40 border border-violet-400/20 rounded-xl p-4 max-h-64 overflow-auto whitespace-pre-wrap text-violet-100/80 font-mono">
              {AI_PROMPT}
            </pre>
          </div>

          {/* Pegar JSON */}
          <div className="preguntas-card p-6">
            <h2 className="font-bold text-lg flex items-center gap-2 mb-3">
              <Upload size={18} className="text-fuchsia-300" />
              Pegar JSON de preguntas
            </h2>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={'[\n  {\n    "pregunta": "¿Cuánto es 2 + 2?",\n    "opciones": ["3", "4", "5", "22"],\n    "correcta": 1,\n    "tiempo": 10\n  }\n]'}
              rows={10}
              className="preguntas-input w-full px-4 py-3 text-xs font-mono resize-y"
            />
            {importResult && (
              <div
                className={`mt-3 rounded-lg px-4 py-3 text-sm border animate-pop-in ${
                  importResult.ok
                    ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-400/30 text-rose-200'
                }`}
              >
                <p>{importResult.msg}</p>
                {importResult.errores && importResult.errores.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs list-disc list-inside text-rose-200/80">
                    {importResult.errores.slice(0, 10).map((e) => (
                      <li key={e.item}>
                        Pregunta {e.item}: {e.motivo}
                      </li>
                    ))}
                    {importResult.errores.length > 10 && <li>...y {importResult.errores.length - 10} más</li>}
                  </ul>
                )}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={importJson}
                disabled={importingBusy || jsonText.trim().length === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm
                           bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400
                           transition-all disabled:opacity-40"
              >
                {importingBusy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                Importar preguntas
              </button>
              <button
                onClick={() => {
                  setImporting(false)
                  setImportResult(null)
                }}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm border border-white/15 text-violet-200/60 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => {
                setImporting(false)
                setCreating(true)
              }}
              className="flex items-center justify-center gap-2 py-4 rounded-xl font-bold
                         bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:from-fuchsia-400 hover:to-violet-400
                         shadow-lg shadow-fuchsia-900/40 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              + Nueva pregunta
            </button>
            <button
              onClick={() => setImporting(true)}
              className="flex items-center justify-center gap-2 py-4 rounded-xl font-bold
                         border border-cyan-400/40 text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20
                         transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Upload size={17} />
              Importar JSON
            </button>
          </div>

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
