'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { Play, X } from 'lucide-react'
import { useDB } from '@/app/providers'
import { registerSQLCompletion } from '@/app/lib/sqlCompletion'
import Button from '@/app/components/ui/Button'
import Badge from '@/app/components/ui/Badge'

export default function QueryEditor() {
  const {
    runQuery, queryError, ready, loading, schemas,
    queryTabs, activeTabId, addQueryTab, closeQueryTab, renameQueryTab, setActiveTabId, setQueryTabSQL,
  } = useDB()

  const activeTab = queryTabs.find(t => t.id === activeTabId)
  const currentSqlRef = useRef(activeTab?.sql ?? '')
  currentSqlRef.current = activeTab?.sql ?? ''

  const loadedRef = useRef(false)
  const runRef = useRef(runQuery)
  const schemasRef = useRef(schemas)
  const disposeRef = useRef<{ dispose: () => void } | null>(null)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const [cursorLine, setCursorLine] = useState(1)
  const [cursorCol, setCursorCol] = useState(1)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { schemasRef.current = schemas }, [schemas])
  useEffect(() => { runRef.current = runQuery }, [runQuery])

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    editor.addAction({
      id: 'run-query',
      label: 'Ejecutar Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => { runRef.current(currentSqlRef.current) },
    })
    disposeRef.current?.dispose()
    disposeRef.current = registerSQLCompletion(monaco, schemasRef)

    editor.onDidChangeCursorPosition((e) => {
      setCursorLine(e.position.lineNumber)
      setCursorCol(e.position.column)
    })
  }, [])

  useEffect(() => {
    loadedRef.current = true
  }, [])

  useEffect(() => {
    return () => {
      disposeRef.current?.dispose()
      disposeRef.current = null
    }
  }, [])

  const [monacoTheme, setMonacoTheme] = useState<'vs-dark' | 'vs'>('vs-dark')

  useEffect(() => {
    const t = document.documentElement.getAttribute('data-theme')
    setMonacoTheme(t === 'light' ? 'vs' : 'vs-dark')
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme')
      setMonacoTheme(theme === 'light' ? 'vs' : 'vs-dark')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const handleRun = () => { runRef.current(currentSqlRef.current) }

  const handleCloseTab = async (tabId: string) => {
    const tab = queryTabs.find(t => t.id === tabId)
    if (!tab || !tab.sql.trim()) {
      closeQueryTab(tabId)
      return
    }
    const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    const { default: Swal } = await import('sweetalert2')
    const result = await Swal.fire({
      title: '¿Cerrar pestaña?',
      text: `Se perderá el contenido de "${tab.name}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cerrar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      background: isLight ? '#fff' : '#2d2d2d',
      color: isLight ? '#1f2937' : '#d4d4d4',
      confirmButtonColor: '#0e639c',
      cancelButtonColor: isLight ? '#9ca3af' : '#6c6c6c',
    })
    if (result.isConfirmed) closeQueryTab(tabId)
  }

  const handleDoubleClick = (tabId: string, currentName: string) => {
    setRenamingId(tabId)
    setRenameValue(currentName)
  }

  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) {
      renameQueryTab(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit()
    if (e.key === 'Escape') setRenamingId(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs bar + Ejecutar */}
      <div className="flex items-stretch bg-surface-elevated border-b border-surface-border overflow-x-auto h-9">
        {queryTabs.map((tab, i) => (
          <div
            key={tab.id}
            className={`group flex items-center gap-1 cursor-pointer text-xs select-none transition-all duration-150 ${
              tab.id === activeTabId
                ? 'bg-surface-card text-txt-body rounded-t-xl border border-surface-border border-b-0 relative z-10'
                : 'text-txt-dim hover:text-txt-muted bg-surface-hover rounded-t-xl border border-surface-border border-b-0'
            }`}
            onClick={() => setActiveTabId(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab.id, tab.name)}
          >
            {renamingId === tab.id ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleRenameKeyDown}
                className="bg-surface-elevated text-txt-body text-xs px-2 py-1 outline-none border border-institutional-400 rounded w-24"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="px-3 py-1.5 truncate max-w-[120px]">{tab.name}</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id) }}
              className={`rounded-full p-0.5 mr-1.5 transition-all duration-150 ${
                tab.id === activeTabId
                  ? 'text-txt-dim hover:text-txt-body hover:bg-black/10'
                  : 'opacity-0 group-hover:opacity-100 text-txt-dim hover:text-txt-muted hover:bg-black/10'
              }`}
            >
              <X size={11} />
            </button>
          </div>
        ))}
        <button
          onClick={() => addQueryTab()}
          className="flex items-center justify-center w-7 text-txt-dim hover:text-txt-body hover:bg-surface-hover rounded-t-lg rounded-b-[14px] text-sm font-bold leading-none transition-all duration-150 border border-surface-border border-b-0"
          title="Nueva pestaña"
        >+</button>
        <div className="flex-1" />
        <div className="flex items-center px-2">
          <Button variant="primary" onClick={handleRun} disabled={!ready || !currentSqlRef.current?.trim() || loading}>
            <Play size={13} />
            {loading ? 'Ejecutando...' : 'Ejecutar'}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 bg-surface-card">
        <Editor
          key={activeTabId}
          height="100%"
          defaultLanguage="sql"
          theme={monacoTheme}
          value={activeTab?.sql ?? ''}
          onChange={(val) => { if (activeTab) setQueryTabSQL(activeTab.id, val ?? '') }}
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

      {/* Error */}
      {queryError && (
        <div className="px-3 py-1.5 text-xs font-mono flex-shrink-0 flex items-center gap-2" style={{ backgroundColor: 'var(--error-bg)', borderTop: '1px solid var(--error-border)', color: 'var(--error-text)' }}>
          <Badge variant="pk">Error</Badge>
          {queryError}
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 py-0.5 bg-surface-card border-t border-surface-border text-[10px] text-txt-dim flex-shrink-0">
        <Badge variant="default">SQL</Badge>
        <span>Ln {cursorLine}, Col {cursorCol}</span>
        <span>Spaces: 2</span>
        <span className={loading ? 'text-yellow-500 font-medium' : 'text-green-600'}>
          {loading ? 'Ejecutando...' : 'Listo'}
        </span>
        <span className="ml-auto text-txt-dim">UTF-8</span>
      </div>
    </div>
  )
}
