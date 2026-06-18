'use client'

import { useState, useEffect, useRef } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { useDB } from '@/app/providers'
import SchemaEditor from '@/app/components/SchemaEditor'
import QueryEditor from '@/app/components/QueryEditor'
import TableBrowser from '@/app/components/TableBrowser'
import ResultTable from '@/app/components/ResultTable'

type PanelKey = 'sidebar' | 'schema' | 'query' | 'results'

const LABELS: Record<PanelKey, string> = {
  sidebar: 'Tablas',
  schema: 'Schema',
  query: 'Query',
  results: 'Resultados',
}

const PROJECT_PREFIX = 'editorsql_project_'

function listProjects(): string[] {
  const names: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PROJECT_PREFIX)) {
      names.push(key.slice(PROJECT_PREFIX.length))
    }
  }
  return names
}

export default function Home() {
  const { getDump } = useDB()
  const [visible, setVisible] = useState<Record<PanelKey, boolean>>({
    sidebar: true,
    schema: true,
    query: true,
    results: true,
  })
  const [showProjects, setShowProjects] = useState(false)
  const [projects, setProjects] = useState<string[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setProjects(listProjects())
  }, [showProjects])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProjects(false)
      }
    }
    if (showProjects) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showProjects])

  const toggle = (key: PanelKey) =>
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))

  const saveProject = async () => {
    const name = prompt('Nombre del proyecto:')
    if (!name || !name.trim()) return
    const key = PROJECT_PREFIX + name.trim()
    const dump = await getDump()
    const data = JSON.stringify({
      schema: localStorage.getItem('editorsql_schema') ?? '',
      query: localStorage.getItem('editorsql_query') ?? '',
      savedQueries: localStorage.getItem('editorsql_saved_queries') ?? '[]',
      dataDump: dump,
    })
    localStorage.setItem(key, data)
  }

  const loadProject = (name: string) => {
    const key = PROJECT_PREFIX + name
    const raw = localStorage.getItem(key)
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      localStorage.setItem('editorsql_schema', data.schema ?? '')
      localStorage.setItem('editorsql_query', data.query ?? '')
      localStorage.setItem('editorsql_saved_queries', data.savedQueries ?? '[]')
      if (data.dataDump) {
        localStorage.setItem('editorsql_restore_data', data.dataDump)
        localStorage.setItem('editorsql_restore_flag', 'true')
      }
      setShowProjects(false)
      location.reload()
    } catch { /* ignore */ }
  }

  const deleteProject = (name: string) => {
    localStorage.removeItem(PROJECT_PREFIX + name)
    setProjects(listProjects())
  }

  const hasAny = visible.sidebar || visible.schema || visible.query || visible.results

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-gray-200">
        <header className="bg-[#007acc] text-white px-4 py-1 text-sm font-semibold flex items-center gap-2 flex-shrink-0">
          <span className="mr-2">EditorSQL</span>
          <span className="text-[11px] font-normal opacity-70 mr-auto">— Práctica PostgreSQL</span>

          <button
            onClick={saveProject}
            className="px-2 py-0.5 text-[11px] rounded border border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            Guardar Proyecto
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProjects(!showProjects)}
              className="px-2 py-0.5 text-[11px] rounded border border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              Abrir Proyecto
            </button>
            {showProjects && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-[#2d2d2d] border border-[#3c3c3c] rounded shadow-lg z-50 max-h-60 overflow-y-auto">
                {projects.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-gray-500">
                    No hay proyectos guardados
                  </div>
                ) : (
                  projects.map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-[#37373d] cursor-pointer group"
                      onClick={() => loadProject(name)}
                    >
                      <span className="flex-1 truncate">{name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteProject(name) }}
                        className="text-gray-600 hover:text-red-400 text-[10px] opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-white/20 mx-1" />

          <div className="flex items-center gap-1">
            {(['sidebar', 'schema', 'query', 'results'] as PanelKey[]).map((key) => (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`px-2 py-0.5 text-[11px] rounded border transition-colors ${
                  visible[key]
                    ? 'bg-white/15 border-white/20 text-white'
                    : 'bg-transparent border-transparent text-white/40 hover:text-white/60'
                }`}
              >
                {LABELS[key]}
              </button>
            ))}
          </div>
        </header>

        {!hasAny ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            Todos los paneles están ocultos. Activá uno desde el header.
          </div>
        ) : (
          <Group orientation="horizontal" className="flex-1">
            {visible.sidebar && (
              <>
                <Panel id="sidebar" defaultSize="18%" minSize="6%" className="bg-[#252526]">
                  <TableBrowser />
                </Panel>
                <Separator className="w-[3px] bg-[#3c3c3c] hover:bg-[#007acc] transition-colors cursor-col-resize" />
              </>
            )}

            <Panel id="main" className="flex flex-col">
              {(visible.schema || visible.query) && (
                <Group orientation="vertical" className="flex-1">
                  <Panel id="editors" defaultSize="65%" minSize="10%">
                    {visible.schema && visible.query ? (
                      <Group orientation="horizontal">
                        <Panel id="schema" defaultSize="50%" minSize="10%">
                          <SchemaEditor />
                        </Panel>
                        <Separator className="w-[3px] bg-[#3c3c3c] hover:bg-[#007acc] transition-colors cursor-col-resize" />
                        <Panel id="query" defaultSize="50%" minSize="10%">
                          <QueryEditor />
                        </Panel>
                      </Group>
                    ) : visible.schema ? (
                      <SchemaEditor />
                    ) : (
                      <QueryEditor />
                    )}
                  </Panel>
                  {visible.results && (
                    <>
                      <Separator className="h-[3px] bg-[#3c3c3c] hover:bg-[#007acc] transition-colors cursor-row-resize" />
                      <Panel id="results" defaultSize="35%" minSize="10%">
                        <ResultTable />
                      </Panel>
                    </>
                  )}
                </Group>
              )}

              {!visible.schema && !visible.query && visible.results && (
                <ResultTable />
              )}
            </Panel>
          </Group>
        )}
    </div>
  )
}
