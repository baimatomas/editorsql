'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Lightbulb, ChevronRight, Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import { useDB } from '@/app/providers'
import { getExercisesForDatabase, type Exercise, type ExerciseFeedback } from '@/app/lib/exercises'

const ADMIN_TOKEN_KEY = 'editorsql_admin_token'

function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}

export default function ExercisePanel() {
  const { gradeQuery, queryResult, addQueryTab } = useDB()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [loading, setLoading] = useState(false)
  const [adminToken, setAdminToken] = useState<string | null>(getAdminToken())
  const [editingExercise, setEditingExercise] = useState<Partial<Exercise> | null>(null)
  const [isNew, setIsNew] = useState(false)

  const project = typeof window !== 'undefined' ? localStorage.getItem('editorsql_current_project') ?? '' : ''

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/exercises')
        const data: Record<string, Exercise[]> = await res.json()
        const apiExercises = data[project]
        if (apiExercises && apiExercises.length > 0) {
          setExercises(apiExercises)
          return
        }
      } catch {}
      setExercises(getExercisesForDatabase(project))
    }
    load()
    setSelectedExercise(null)
    setFeedback(null)
    setShowHint(false)
  }, [project])

  const saveExercises = async (updated: Exercise[]) => {
    if (!adminToken) return
    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ [project]: updated }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      setExercises(updated)
    } catch (e) {
      alert('Error al guardar: ' + (e as Error).message)
    }
  }

  const handleSelect = (ex: Exercise) => {
    setSelectedExercise(ex)
    setFeedback(null)
    setShowHint(false)
    setEditingExercise(null)
    addQueryTab(ex.title, `-- ========================================\n-- Ejercicio: ${ex.title}\n-- ========================================\n-- Escribí acá tu consulta y presioná Ctrl+Enter\n-- Luego hacé clic en "Corregir" en el panel de Ejercicios\n`)
  }

  const handleGrade = async () => {
    if (!selectedExercise) return
    if (!queryResult) return
    setLoading(true)
    const result = await gradeQuery(selectedExercise.solution)
    setFeedback(result)
    setLoading(false)
  }

  const handleAdd = () => {
    setEditingExercise({ id: `${project}-${Date.now()}`, title: '', description: '', hint: '', solution: '' })
    setIsNew(true)
    setSelectedExercise(null)
    setFeedback(null)
  }

  const handleEdit = (ex: Exercise) => {
    setEditingExercise({ ...ex })
    setIsNew(false)
  }

  const handleDelete = async (ex: Exercise) => {
    const updated = exercises.filter(e => e.id !== ex.id)
    await saveExercises(updated)
  }

  const handleSave = async () => {
    if (!editingExercise || !editingExercise.title || !editingExercise.description || !editingExercise.solution) return
    if (isNew) {
      const updated = [...exercises, editingExercise as Exercise]
      await saveExercises(updated)
    } else {
      const updated = exercises.map(e => e.id === editingExercise.id ? editingExercise as Exercise : e)
      await saveExercises(updated)
    }
    setEditingExercise(null)
    setIsNew(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-surface-border flex items-center justify-between">
        <h2 className="text-xs font-semibold text-txt-body uppercase tracking-wider">Ejercicios</h2>
        {adminToken && (
          <button onClick={handleAdd} className="text-txt-dim hover:text-txt-body transition-colors" title="Nuevo ejercicio">
            <Plus size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-xs">
        {exercises.length === 0 ? (
          <p className="text-[11px] text-txt-dim italic">No hay ejercicios disponibles para este proyecto.</p>
        ) : (
          <div className="space-y-0.5">
            {exercises.map((ex) => (
              <div key={ex.id} className="group flex items-center gap-1">
                <button
                  onClick={() => handleSelect(ex)}
                  className={`flex-1 text-left px-2 py-1.5 rounded text-[11px] transition-colors duration-75 flex items-center gap-1.5 ${
                    selectedExercise?.id === ex.id
                      ? 'bg-institutional-500/20 text-institutional-300 border-l-2 border-institutional-400'
                      : 'hover:bg-surface-hover text-txt-body border-l-2 border-transparent'
                  }`}
                >
                  <ChevronRight size={10} className="flex-shrink-0" />
                  <span>{ex.title}</span>
                </button>
                {adminToken && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(ex)} className="p-1 text-txt-dim hover:text-txt-body rounded hover:bg-surface-hover" title="Editar">
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => handleDelete(ex)} className="p-1 text-txt-dim hover:text-red-400 rounded hover:bg-surface-hover" title="Eliminar">
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {editingExercise && (
          <div className="border border-surface-border rounded-lg p-3 space-y-2 bg-surface-card">
            <div className="text-[10px] font-semibold text-txt-dim uppercase tracking-wider">
              {isNew ? 'Nuevo ejercicio' : 'Editar ejercicio'}
            </div>
            <div>
              <label className="text-[10px] text-txt-dim block mb-0.5">Título</label>
              <input
                type="text"
                value={editingExercise.title || ''}
                onChange={(e) => setEditingExercise({ ...editingExercise, title: e.target.value })}
                className="w-full px-2 py-1 text-[11px] rounded border border-surface-border bg-surface text-txt-body focus:outline-none focus:border-institutional-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-txt-dim block mb-0.5">Enunciado</label>
              <textarea
                value={editingExercise.description || ''}
                onChange={(e) => setEditingExercise({ ...editingExercise, description: e.target.value })}
                className="w-full px-2 py-1 text-[11px] rounded border border-surface-border bg-surface text-txt-body focus:outline-none focus:border-institutional-500 resize-none"
                rows={3}
              />
            </div>
            <div>
              <label className="text-[10px] text-txt-dim block mb-0.5">Pista</label>
              <input
                type="text"
                value={editingExercise.hint || ''}
                onChange={(e) => setEditingExercise({ ...editingExercise, hint: e.target.value })}
                className="w-full px-2 py-1 text-[11px] rounded border border-surface-border bg-surface text-txt-body focus:outline-none focus:border-institutional-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-txt-dim block mb-0.5">Solución (SQL)</label>
              <textarea
                value={editingExercise.solution || ''}
                onChange={(e) => setEditingExercise({ ...editingExercise, solution: e.target.value })}
                className="w-full px-2 py-1 text-[11px] font-mono rounded border border-surface-border bg-surface text-txt-body focus:outline-none focus:border-institutional-500 resize-none"
                rows={2}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={!editingExercise.title || !editingExercise.description || !editingExercise.solution}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-institutional-600 text-white hover:bg-institutional-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Save size={11} /> Guardar
              </button>
              <button onClick={() => { setEditingExercise(null); setIsNew(false) }}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border border-surface-border text-txt-dim hover:text-txt-body transition-colors">
                <X size={11} /> Cancelar
              </button>
            </div>
          </div>
        )}

        {selectedExercise && !editingExercise && (
          <div className="border-t border-surface-border pt-3 mt-3 space-y-2">
            <div>
              <div className="text-[10px] font-semibold text-txt-dim uppercase tracking-wider mb-0.5">Ejercicio</div>
              <div className="text-xs font-medium text-txt-body">{selectedExercise.title}</div>
              <p className="text-[11px] text-txt-muted mt-1 leading-relaxed">{selectedExercise.description}</p>
            </div>

            {selectedExercise.hint && (
              <div>
                <button
                  onClick={() => setShowHint(!showHint)}
                  className="flex items-center gap-1 text-[11px] text-institutional-400 hover:text-institutional-300 transition-colors"
                >
                  <Lightbulb size={12} />
                  {showHint ? 'Ocultar pista' : 'Mostrar pista'}
                </button>
                {showHint && (
                  <p className="text-[11px] text-txt-muted mt-1 italic pl-4 border-l-2 border-institutional-500/30">
                    {selectedExercise.hint}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={handleGrade}
              disabled={!queryResult || loading}
              className={`w-full px-3 py-1.5 rounded text-[11px] font-medium transition-all duration-100 ${
                !queryResult || loading
                  ? 'bg-surface-border/50 text-txt-dim cursor-not-allowed'
                  : 'bg-institutional-600 text-white hover:bg-institutional-500 active:scale-[0.98]'
              }`}
            >
              {loading ? 'Corrigiendo…' : 'Corregir'}
            </button>

            {feedback && (
              <div className={`rounded-lg border p-3 space-y-1.5 ${
                feedback.correct
                  ? 'border-emerald-600/40 bg-emerald-600/10'
                  : 'border-red-600/40 bg-red-600/10'
              }`}>
                <div className="flex items-center gap-1.5">
                  {feedback.correct
                    ? <CheckCircle2 size={14} className="text-emerald-400" />
                    : <XCircle size={14} className="text-red-400" />
                  }
                  <span className={`text-xs font-medium ${feedback.correct ? 'text-emerald-300' : 'text-red-300'}`}>
                    {feedback.correct ? 'Correcto' : 'Con errores'}
                  </span>
                </div>
                <p className="text-[11px] text-txt-muted">{feedback.details}</p>
                {!feedback.correct && (
                  <div className="text-[10px] text-txt-dim space-y-0.5 pt-1 border-t border-surface-border/50">
                    <div>Columnas esperadas: {feedback.expectedColumns.join(', ') || '(ninguna)'}</div>
                    <div>Columnas obtenidas: {feedback.studentColumns.join(', ') || '(ninguna)'}</div>
                    <div>Filas esperadas: {feedback.expectedRows} · Filas obtenidas: {feedback.studentRows}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
