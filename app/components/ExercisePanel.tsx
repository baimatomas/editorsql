'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Lightbulb, ChevronRight } from 'lucide-react'
import { useDB } from '@/app/providers'
import { getExercisesForDatabase, type Exercise, type ExerciseFeedback } from '@/app/lib/exercises'

export default function ExercisePanel() {
  const { gradeQuery, queryResult, addQueryTab } = useDB()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const project = localStorage.getItem('editorsql_current_project') ?? ''
    setExercises(getExercisesForDatabase(project))
    setSelectedExercise(null)
    setFeedback(null)
    setShowHint(false)
  }, [])

  const handleSelect = (ex: Exercise) => {
    setSelectedExercise(ex)
    setFeedback(null)
    setShowHint(false)

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-surface-border">
        <h2 className="text-xs font-semibold text-txt-body uppercase tracking-wider">Ejercicios</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-xs">
        {exercises.length === 0 ? (
          <p className="text-[11px] text-txt-dim italic">No hay ejercicios disponibles para este proyecto.</p>
        ) : (
          <div className="space-y-0.5">
            {exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => handleSelect(ex)}
                className={`w-full text-left px-2 py-1.5 rounded text-[11px] transition-colors duration-75 flex items-center gap-1.5 ${
                  selectedExercise?.id === ex.id
                    ? 'bg-institutional-500/20 text-institutional-300 border-l-2 border-institutional-400'
                    : 'hover:bg-surface-hover text-txt-body border-l-2 border-transparent'
                }`}
              >
                <ChevronRight size={10} className="flex-shrink-0" />
                <span>{ex.title}</span>
              </button>
            ))}
          </div>
        )}

        {selectedExercise && (
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
