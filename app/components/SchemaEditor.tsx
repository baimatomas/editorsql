'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useDB, DEFAULT_SCHEMA } from '@/app/providers'
import { registerSQLCompletion } from '@/app/lib/sqlCompletion'
import { setDirty } from '@/app/lib/projectFiles'

const LS_SCHEMA = 'editorsql_schema'

export default function SchemaEditor() {
  const [sql, setSql] = useState(DEFAULT_SCHEMA)
  const sqlRef = useRef(sql)
  const loadedRef = useRef(false)
  const { runSchema, schemaError, ready, schemas } = useDB()
  const runRef = useRef(runSchema)
  const schemasRef = useRef(schemas)
  const disposeRef = useRef<{ dispose: () => void } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(LS_SCHEMA)
    if (stored !== null) setSql(stored)
    loadedRef.current = true
  }, [])

  useEffect(() => { sqlRef.current = sql }, [sql])
  useEffect(() => { schemasRef.current = schemas }, [schemas])
  useEffect(() => { runRef.current = runSchema }, [runSchema])
  useEffect(() => {
    if (!loadedRef.current) return
    const timer = setTimeout(() => {
      try { localStorage.setItem(LS_SCHEMA, sql) } catch {}
    }, 2000)
    return () => clearTimeout(timer)
  }, [sql])

  const handleEditorMount: OnMount = useCallback((_editor, monaco) => {
    _editor.addAction({
      id: 'run-schema',
      label: 'Run Schema',
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c] flex-shrink-0">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Schema SQL
        </span>
        <button
          onClick={handleRun}
          disabled={!ready || !sql.trim()}
          className="px-3 py-0.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium"
        >
Ejecutar Schema
        </button>
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
      {schemaError && (
        <div className="px-3 py-1.5 bg-red-900/40 border-t border-red-800 text-red-300 text-xs font-mono flex-shrink-0">
          {schemaError}
        </div>
      )}
    </div>
  )
}
