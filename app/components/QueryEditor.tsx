'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useDB } from '@/app/providers'
import { registerSQLCompletion } from '@/app/lib/sqlCompletion'
import { setDirty } from '@/app/lib/projectFiles'

const LS_QUERY = 'editorsql_query'

export default function QueryEditor() {
  const [sql, setSql] = useState('-- Ejecutá las consultas con Ctrl + Enter\n')
  const sqlRef = useRef(sql)
  const loadedRef = useRef(false)
  const { runQuery, queryError, ready, loading, queryTemplate, saveQuery, schemas } = useDB()
  const runRef = useRef(runQuery)
  const schemasRef = useRef(schemas)
  const disposeRef = useRef<{ dispose: () => void } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(LS_QUERY)
    if (stored !== null) setSql(stored)
    loadedRef.current = true
  }, [])

  useEffect(() => { sqlRef.current = sql }, [sql])
  useEffect(() => { schemasRef.current = schemas }, [schemas])
  useEffect(() => { if (loadedRef.current) try { localStorage.setItem(LS_QUERY, sql) } catch {} }, [sql])
  useEffect(() => { runRef.current = runQuery }, [runQuery])

  useEffect(() => {
    if (queryTemplate !== null) {
      setSql(queryTemplate)
      setDirty()
    }
  }, [queryTemplate])

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editor.addAction({
      id: 'run-query',
      label: 'Ejecutar Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => { runRef.current(sqlRef.current) },
    })
    disposeRef.current?.dispose()
    disposeRef.current = registerSQLCompletion(monaco, schemasRef)
  }, [])

  useEffect(() => {
    return () => {
      disposeRef.current?.dispose()
      disposeRef.current = null
    }
  }, [])

  const handleRun = () => { runRef.current(sqlRef.current) }

  const handleSave = async () => {
    const { default: Swal } = await import('sweetalert2')
    const result = await Swal.fire({
      title: 'Nombre para la consulta',
      input: 'text',
      inputPlaceholder: 'Ingresá el nombre...',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      background: '#2d2d2d',
      color: '#d4d4d4',
      confirmButtonColor: '#0e639c',
      cancelButtonColor: '#6c6c6c',
      inputValidator: (v) => { if (!v?.trim()) return 'El nombre no puede estar vacío' },
    })
    if (result.isConfirmed && result.value?.trim()) {
      saveQuery(result.value.trim(), sqlRef.current)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c] flex-shrink-0">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Query SQL
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!ready || !sql.trim()}
            className="px-2 py-0.5 text-xs text-gray-400 hover:text-white border border-[#3c3c3c] hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed rounded font-medium"
          >
Guardar query
          </button>
          <button
            onClick={handleRun}
            disabled={!ready || !sql.trim() || loading}
            className="px-3 py-0.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium"
          >
            {loading ? 'Ejecutando...' : 'Ejecutar Query'}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme="vs-dark"
          value={sql}
          onChange={(val) => { setSql(val ?? ''); setDirty() }}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            renderLineHighlight: 'none',
            padding: { top: 6 },
          }}
        />
      </div>
      {queryError && (
        <div className="px-3 py-1.5 bg-red-900/40 border-t border-red-800 text-red-300 text-xs font-mono flex-shrink-0">
          {queryError}
        </div>
      )}
    </div>
  )
}
