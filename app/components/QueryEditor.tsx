'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useDB } from '@/app/providers'

const LS_QUERY = 'editorsql_query'

export default function QueryEditor() {
  const [sql, setSql] = useState('SELECT * FROM ')
  const sqlRef = useRef(sql)
  const { runQuery, queryError, ready, loading, queryTemplate, saveQuery } = useDB()
  const runRef = useRef(runQuery)

  useEffect(() => {
    const stored = localStorage.getItem(LS_QUERY)
    if (stored !== null) setSql(stored)
  }, [])

  useEffect(() => { sqlRef.current = sql }, [sql])
  useEffect(() => { localStorage.setItem(LS_QUERY, sql) }, [sql])
  useEffect(() => { runRef.current = runQuery }, [runQuery])

  useEffect(() => {
    if (queryTemplate !== null) {
      setSql(queryTemplate)
    }
  }, [queryTemplate])

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => { runRef.current(sqlRef.current) },
    })
  }, [])

  const handleRun = () => { runRef.current(sqlRef.current) }

  const handleSave = () => {
    const name = prompt('Nombre para la consulta:', '')
    if (name && name.trim()) {
      saveQuery(name.trim(), sqlRef.current)
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
            Save
          </button>
          <button
            onClick={handleRun}
            disabled={!ready || !sql.trim() || loading}
            className="px-3 py-0.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium"
          >
            {loading ? 'Ejecutando...' : 'Run Query'}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme="vs-dark"
          value={sql}
          onChange={(val) => setSql(val ?? '')}
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
