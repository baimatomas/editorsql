'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2, XCircle, Lightbulb, ChevronRight, Plus, Pencil, Trash2, Save, X, Upload, Download, RefreshCw } from 'lucide-react'
import { useDB } from '@/app/providers'
import { getExercisesForDatabase, type Exercise, type ExerciseFeedback } from '@/app/lib/exercises'

const ADMIN_TOKEN_KEY = 'editorsql_admin_token'

function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}

function validateImportData(json: unknown, currentProject: string): { valid: boolean; summary: string; errors: string[]; data: Record<string, Exercise[]> | null } {
  const errors: string[] = []
  const result: Record<string, Exercise[]> = {}

  if (Array.isArray(json)) {
    if (json.length === 0) {
      return { valid: true, summary: 'El archivo no contiene ejercicios.', errors: [], data: { [currentProject]: [] } }
    }
    const validated: Exercise[] = []
    for (let i = 0; i < json.length; i++) {
      const item = json[i]
      const idx = i + 1
      if (!item || typeof item !== 'object') {
        errors.push(`Ejercicio #${idx}: no es un objeto válido`)
        continue
      }
      let hasError = false
      if (!item.id || typeof item.id !== 'string') { errors.push(`Ejercicio #${idx}: 'id' debe ser un texto no vacío`); hasError = true }
      if (!item.title || typeof item.title !== 'string') { errors.push(`Ejercicio #${idx}: falta 'title'`); hasError = true }
      if (!item.description || typeof item.description !== 'string') { errors.push(`Ejercicio #${idx}: falta 'description'`); hasError = true }
      if (!item.solution || typeof item.solution !== 'string') { errors.push(`Ejercicio #${idx}: falta 'solution'`); hasError = true }
      if (hasError) continue
      validated.push({ id: item.id, title: item.title, description: item.description, hint: item.hint || '', solution: item.solution })
    }
    if (errors.length > 0) return { valid: false, summary: '', errors, data: null }
    result[currentProject] = validated
    return { valid: true, summary: `Se importarán ${validated.length} ejercicio(s) para "${currentProject}".`, errors: [], data: result }
  }

  if (typeof json === 'object' && json !== null) {
    const entries = Object.entries(json as Record<string, unknown>)
    if (entries.length === 0) return { valid: true, summary: 'El archivo no contiene proyectos.', errors: [], data: {} }
    const summaryParts: string[] = []
    for (const [proj, exercises] of entries) {
      if (!Array.isArray(exercises)) { errors.push(`"${proj}": el valor debe ser un array`); continue }
      const validated: Exercise[] = []
      for (let i = 0; i < exercises.length; i++) {
        const item = exercises[i]
        const idx = i + 1
        if (!item || typeof item !== 'object') { errors.push(`${proj} / Ejercicio #${idx}: no es un objeto válido`); continue }
        let hasError = false
        if (!item.id || typeof item.id !== 'string') { errors.push(`${proj} / Ejercicio #${idx}: 'id' debe ser un texto no vacío`); hasError = true }
        if (!item.title || typeof item.title !== 'string') { errors.push(`${proj} / Ejercicio #${idx}: falta 'title'`); hasError = true }
        if (!item.description || typeof item.description !== 'string') { errors.push(`${proj} / Ejercicio #${idx}: falta 'description'`); hasError = true }
        if (!item.solution || typeof item.solution !== 'string') { errors.push(`${proj} / Ejercicio #${idx}: falta 'solution'`); hasError = true }
        if (hasError) continue
        validated.push({ id: item.id, title: item.title, description: item.description, hint: item.hint || '', solution: item.solution })
      }
      if (validated.length > 0) { result[proj] = validated; summaryParts.push(`${validated.length} en "${proj}"`) }
    }
    if (errors.length > 0) return { valid: false, summary: '', errors, data: null }
    if (summaryParts.length === 0) return { valid: true, summary: 'No se encontraron ejercicios válidos en el archivo.', errors: [], data: result }
    return { valid: true, summary: `Se importarán ${summaryParts.join(', ')}.`, errors: [], data: result }
  }

  return { valid: false, summary: '', errors: ['Formato no reconocido: se esperaba un array de ejercicios o un objeto con proyectos.'], data: null }
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'preview' | 'error' | 'done'>('idle')
  const [importSummary, setImportSummary] = useState('')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importData, setImportData] = useState<Record<string, Exercise[]> | null>(null)

  const project = typeof window !== 'undefined' ? localStorage.getItem('editorsql_current_project') ?? '' : ''

  const loadExercisesFromApi = useCallback(async () => {
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
  }, [project])

  useEffect(() => {
    loadExercisesFromApi()
    setSelectedExercise(null)
    setFeedback(null)
    setShowHint(false)
    setImportStatus('idle')
    setImportErrors([])
    setImportSummary('')
    setImportData(null)
  }, [project, loadExercisesFromApi])

  const saveExercises = async (updated: Exercise[]) => {
    if (!adminToken) return
    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ [project]: updated }),
      })
      if (!res.ok) { const text = await res.text(); throw new Error(text) }
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const result = validateImportData(json, project)
      if (!result.valid) {
        setImportErrors(result.errors)
        setImportStatus('error')
        return
      }
      setImportSummary(result.summary)
      setImportData(result.data)
      setImportStatus('preview')
    } catch (err) {
      setImportErrors(['El archivo no contiene un JSON válido: ' + (err as Error).message])
      setImportStatus('error')
    }
    e.target.value = ''
  }

  const handleImportConfirm = async () => {
    if (!importData || !adminToken) return
    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(importData),
      })
      if (!res.ok) { const text = await res.text(); throw new Error(text) }
      const reloadRes = await fetch('/api/exercises')
      const reloadData: Record<string, Exercise[]> = await reloadRes.json()
      const reloaded = reloadData[project]
      if (reloaded) setExercises(reloaded)
      setImportStatus('done')
      setTimeout(() => setImportStatus('idle'), 3000)
    } catch (e) {
      setImportErrors(['Error al importar: ' + (e as Error).message])
      setImportStatus('error')
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch('/api/exercises')
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'exercises.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Error al exportar: ' + (e as Error).message)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-surface-border flex items-center justify-between">
        <h2 className="text-xs font-semibold text-txt-body uppercase tracking-wider">Ejercicios</h2>
        <div className="flex items-center gap-1">
          <button onClick={loadExercisesFromApi} className="text-txt-dim hover:text-txt-body transition-colors" title="Refrescar ejercicios">
            <RefreshCw size={13} />
          </button>
          {adminToken && (
            <button onClick={handleAdd} className="text-txt-dim hover:text-txt-body transition-colors" title="Nuevo ejercicio">
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 text-xs">
        {exercises.length === 0 ? (
          <p className="text-[11px] text-txt-dim italic">No hay ejercicios disponibles para este proyecto.</p>
        ) : (
          <div className="space-y-0.5">
            {exercises.map((ex) => (
              <div key={ex.id}>
                <div className="group flex items-center gap-1">
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
                {selectedExercise?.id === ex.id && !editingExercise && (
                  <div className="ml-1 pl-3 border-l-2 border-institutional-500/30 pb-2 mt-2 space-y-2">
                    <div>
                      <div className="text-[10px] font-semibold text-txt-dim uppercase tracking-wider mb-0.5">Ejercicio</div>
                      <div className="text-xs font-medium text-txt-body">{ex.title}</div>
                      <p className="text-[11px] text-txt-muted mt-1 leading-relaxed">{ex.description}</p>
                    </div>

                    {ex.hint && (
                      <div>
                        <button
                          onClick={() => setShowHint(showHint ? false : true)}
                          className="flex items-center gap-1 text-[11px] text-institutional-400 hover:text-institutional-300 transition-colors"
                        >
                          <Lightbulb size={12} />
                          {showHint ? 'Ocultar pista' : 'Mostrar pista'}
                        </button>
                        {showHint && (
                          <p className="text-[11px] text-txt-muted mt-1 italic pl-4 border-l-2 border-institutional-500/30">
                            {ex.hint}
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

        {adminToken && (
          <div className="border-t border-surface-border pt-3 mt-3 space-y-2">
            <div className="text-[10px] font-semibold text-txt-dim uppercase tracking-wider">Importar / Exportar</div>

            {importStatus === 'idle' && (
              <div className="flex gap-2">
                <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileSelect} hidden />
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border border-surface-border text-txt-dim hover:text-txt-body hover:bg-surface-hover transition-colors">
                  <Upload size={11} /> Importar JSON
                </button>
                <button onClick={handleExport}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border border-surface-border text-txt-dim hover:text-txt-body hover:bg-surface-hover transition-colors">
                  <Download size={11} /> Exportar JSON
                </button>
              </div>
            )}

            {importStatus === 'preview' && (
              <div className="space-y-2">
                <p className="text-[11px] text-txt-body">{importSummary}</p>
                <div className="flex gap-2">
                  <button onClick={handleImportConfirm}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-institutional-600 text-white hover:bg-institutional-500 transition-colors">
                    <Upload size={11} /> Confirmar importación
                  </button>
                  <button onClick={() => setImportStatus('idle')}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border border-surface-border text-txt-dim hover:text-txt-body transition-colors">
                    <X size={11} /> Cancelar
                  </button>
                </div>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="space-y-1.5">
                <div className="text-[11px] text-red-400 font-medium">Errores en el archivo:</div>
                {importErrors.map((err, i) => (
                  <p key={i} className="text-[10px] text-red-300">• {err}</p>
                ))}
                <button onClick={() => setImportStatus('idle')}
                  className="text-[11px] text-txt-dim hover:text-txt-body underline transition-colors">Volver</button>
              </div>
            )}

            {importStatus === 'done' && (
              <p className="text-[11px] text-emerald-400">✓ Importado exitosamente.</p>
            )}
          </div>
        )}


      </div>
    </div>
  )
}
