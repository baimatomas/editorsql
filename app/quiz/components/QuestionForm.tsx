'use client'

import { useState } from 'react'
import { Plus, Save, X, Loader2 } from 'lucide-react'
import type { QuizQuestion } from '../lib/types'

const TIME_OPTIONS = [10, 20, 30, 60]

export default function QuestionForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: QuizQuestion | null
  onSubmit: (q: { id?: string; prompt: string; options: string[]; correct_index: number; time_limit: number }) => Promise<void>
  onCancel: () => void
}) {
  const [prompt, setPrompt] = useState(initial?.prompt ?? '')
  const [options, setOptions] = useState<string[]>(
    initial?.options ?? ['', '', '', '']
  )
  const [correct, setCorrect] = useState<number>(initial?.correct_index ?? 0)
  const [timeLimit, setTimeLimit] = useState<number>(initial?.time_limit ?? 20)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const optionStyle = (i: number) =>
    [
      'border-rose-400/50 text-rose-200',
      'border-sky-400/50 text-sky-200',
      'border-amber-400/50 text-amber-200',
      'border-emerald-400/50 text-emerald-200',
    ][i]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const filled = options.map((o) => o.trim())
    const used = filled.filter((o) => o.length > 0)
    if (prompt.trim().length === 0) return setError('Escribí la pregunta.')
    if (used.length < 2) return setError('Necesitás al menos 2 opciones.')
    if (!filled[correct]) return setError('La opción correcta no puede estar vacía.')
    setSaving(true)
    try {
      await onSubmit({
        id: initial?.id,
        prompt: prompt.trim(),
        options: used,
        correct_index: filled.slice(0, filled.length).reduce((acc, o, i) => {
          // recomputar índice sobre las opciones no vacías
          if (o.length === 0 && i < correct) return acc - 1
          return acc
        }, correct),
        time_limit: timeLimit,
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const count = options.length

  return (
    <form onSubmit={submit} className="preguntas-card p-6 space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg flex items-center gap-2">
          {initial ? <Save size={18} className="text-cyan-300" /> : <Plus size={18} className="text-fuchsia-300" />}
          {initial ? 'Editar pregunta' : 'Nueva pregunta'}
        </h2>
        <div className="flex items-center gap-1.5">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTimeLimit(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                timeLimit === t
                  ? 'bg-violet-500/40 border-violet-300/60 text-white'
                  : 'border-violet-400/20 text-violet-200/50 hover:text-violet-100'
              }`}
            >
              {t}s
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
        placeholder="Escribí la pregunta acá..."
        rows={2}
        className="preguntas-input w-full px-4 py-3 text-base resize-none"
      />

      <div className={`grid gap-3 ${count === 4 ? 'grid-cols-2' : count === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {options.map((opt, i) => (
          <div key={i} className="relative">
            <input
              value={opt}
              onChange={(e) => {
                const next = [...options]
                next[i] = e.target.value.slice(0, 120)
                setOptions(next)
              }}
              placeholder={`Opción ${i + 1}`}
              className={`preguntas-input w-full pl-4 pr-16 py-3 text-sm border ${optionStyle(i)}`}
            />
            <button
              type="button"
              onClick={() => setCorrect(i)}
              title="Marcar como correcta"
              className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-all ${
                correct === i
                  ? 'bg-white text-violet-900 border-white'
                  : 'border-white/20 text-white/40 hover:text-white/80'
              }`}
            >
              ✓
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="flex items-center gap-2 text-xs text-violet-200/50">
          <button
            type="button"
            disabled={count >= 4}
            onClick={() => setOptions([...options, ''])}
            className="disabled:opacity-30 hover:text-violet-100 transition-colors"
          >
            + opción
          </button>
          {count > 2 && (
            <button
              type="button"
              onClick={() => {
                const next = options.slice(0, -1)
                setOptions(next)
                if (correct >= next.length) setCorrect(0)
              }}
              className="hover:text-violet-100 transition-colors"
            >
              − opción
            </button>
          )}
        </div>
        <div className="flex-1" />
        {error && <p className="text-rose-300 text-sm self-center">{error}</p>}
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm border border-white/15 text-violet-200/60 hover:text-white transition-colors"
        >
          <X size={15} /> Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm
                     bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:from-fuchsia-400 hover:to-violet-400
                     transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {initial ? 'Guardar cambios' : 'Agregar'}
        </button>
      </div>
    </form>
  )
}
