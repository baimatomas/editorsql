'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { Play, Save } from 'lucide-react'
import { useDB } from '@/app/providers'
import { registerSQLCompletion } from '@/app/lib/sqlCompletion'
import { setDirty } from '@/app/lib/projectFiles'
import Toolbar from '@/app/components/ui/Toolbar'
import Button from '@/app/components/ui/Button'
import Badge from '@/app/components/ui/Badge'

const LS_QUERY = 'editorsql_query'

export default function QueryEditor() {
  const [sql, setSql] = useState('-- Ejecutá las consultas con Ctrl + Enter\n')
  const sqlRef = useRef(sql)
  const loadedRef = useRef(false)
  const { runQuery, queryError, ready, loading, queryTemplate, saveQuery, schemas } = useDB()
  const runRef = useRef(runQuery)
  const schemasRef = useRef(schemas)
  const disposeRef = useRef<{ dispose: () => void } | null>(null)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const [cursorLine, setCursorLine] = useState(1)
  const [cursorCol, setCursorCol] = useState(1)

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
    editorRef.current = editor
    editor.addAction({
      id: 'run-query',
      label: 'Ejecutar Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => { runRef.current(sqlRef.current) },
    })
    disposeRef.current?.dispose()
    disposeRef.current = registerSQLCompletion(monaco, schemasRef)

    editor.onDidChangeCursorPosition((e) => {
      setCursorLine(e.position.lineNumber)
      setCursorCol(e.position.column)
    })
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
      <Toolbar>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Query SQL
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} disabled={!ready || !sql.trim()}>
            <Save size={12} />
            Guardar query
          </Button>
          <Button variant="secondary" onClick={handleRun} disabled={!ready || !sql.trim() || loading}>
            <Play size={12} />
            {loading ? 'Ejecutando...' : 'Ejecutar'}
          </Button>
        </div>
      </Toolbar>
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
        <div className="px-3 py-1.5 bg-red-900/40 border-t border-red-800 text-red-300 text-xs font-mono flex-shrink-0 flex items-center gap-2">
          <Badge variant="pk">Error</Badge>
          {queryError}
        </div>
      )}
      <div className="flex items-center gap-3 px-3 py-0.5 bg-[#007acc] text-[10px] text-white flex-shrink-0">
        <span className="font-semibold">SQL</span>
        <span className="text-white/70">Ln {cursorLine}, Col {cursorCol}</span>
        <span className="text-white/70">Spaces: 2</span>
        <span className="ml-auto text-white/50">UTF-8</span>
      </div>
    </div>
  )
}
