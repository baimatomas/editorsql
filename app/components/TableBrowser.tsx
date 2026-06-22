'use client'

import { useState, useEffect, useRef } from 'react'
import { Database, Table2, Eye, FunctionSquare, FolderOpen, Trash2, RefreshCw, ChevronRight, ChevronDown, FolderKanban, Hash, Calendar, FileText, ToggleLeft, HelpCircle } from 'lucide-react'
import { useDB, DEFAULT_PROJECTS } from '@/app/providers'
import Badge from '@/app/components/ui/Badge'
import {
  getSessionProjects, saveSessionProject, getSessionProjectData,
  removeSessionProject, promptSaveIfDirty, clearDirty,
  type ProjectData,
} from '@/app/lib/projectFiles'

function typeIcon(type: string) {
  const t = type.toLowerCase()
  if (/^(int|smallint|bigint|tinyint|serial|decimal|numeric|real|float|double|money)/.test(t)) return Hash
  if (/^(date|time|timestamp|interval)/.test(t)) return Calendar
  if (/^(char|varchar|text|clob|nchar|nvarchar|ntext|json|xml)/.test(t)) return FileText
  if (/^bool/.test(t)) return ToggleLeft
  return HelpCircle
}

export default function TableBrowser() {
  const { schemas, ready, getDump, refreshTables } = useDB()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [projectName, setProjectName] = useState<string | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [sessionProjects, setSessionProjects] = useState<string[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const switcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setProjectName(localStorage.getItem('editorsql_current_project'))
    setSessionProjects(getSessionProjects())
  }, [])

  useEffect(() => {
    if (!switcherOpen) return
    const handle = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [switcherOpen])

  const toggle = (key: string) => {
    const next = new Set(expanded)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExpanded(next)
  }

  const switchToProject = async (name: string) => {
    if (name === projectName) return
    const proceed = await promptSaveIfDirty(getDump)
    if (!proceed) return

    const cur = localStorage.getItem('editorsql_current_project')
    if (cur && !DEFAULT_PROJECTS.includes(cur)) {
      const dump = await getDump()
      const data: ProjectData = {
        name: cur,
        schema: localStorage.getItem('editorsql_schema') ?? '',
        query: localStorage.getItem('editorsql_query_tabs') ?? '[]',
        savedQueries: localStorage.getItem('editorsql_saved_queries') ?? '[]',
        dataDump: dump,
      }
      saveSessionProject(cur, data)
    }

    if (DEFAULT_PROJECTS.includes(name)) {
      try {
        const head = await fetch(`/projects/${name}.sql`, { method: 'HEAD' })
        if (!head.ok) throw new Error('Archivo no encontrado')
        localStorage.setItem('editorsql_load_default', name)
        localStorage.setItem('editorsql_current_project', name)
        localStorage.setItem('editorsql_schema', `-- Proyecto: ${name}\n-- Base de datos cargada desde archivo\n-- Usá este panel para crear y modificar tablas (CREATE TABLE, INSERT, ALTER, etc.)`)
        localStorage.setItem('editorsql_query_tabs', JSON.stringify([{ id: crypto.randomUUID(), name: 'Query1', sql: '-- Ejecutá las consultas con Ctrl + Enter\n' }]))
        localStorage.setItem('editorsql_saved_queries', '[]')
        localStorage.removeItem('editorsql_restore_flag')
        localStorage.removeItem('editorsql_restore_data')
      } catch (e) {
        const { default: Swal } = await import('sweetalert2')
        await Swal.fire({ icon: 'error', title: 'Error', text: 'Error al cargar proyecto: ' + (e as Error).message, confirmButtonText: 'OK', background: '#2d2d2d', color: '#d4d4d4', confirmButtonColor: '#0e639c' })
        return
      }
    } else {
      const data = getSessionProjectData(name)
      if (!data) return
      localStorage.setItem('editorsql_schema', data.schema)
      localStorage.setItem('editorsql_query_tabs', data.query)
      localStorage.setItem('editorsql_saved_queries', data.savedQueries ?? '[]')
      if (data.dataDump) {
        localStorage.setItem('editorsql_restore_data', data.dataDump)
        localStorage.setItem('editorsql_restore_flag', 'true')
      } else {
        localStorage.removeItem('editorsql_restore_flag')
        localStorage.removeItem('editorsql_restore_data')
      }
      localStorage.setItem('editorsql_current_project', name)
      localStorage.removeItem('editorsql_load_default')
    }

    clearDirty()
    setSwitcherOpen(false)
    location.reload()
  }

  const removeFromSession = (name: string) => {
    if (DEFAULT_PROJECTS.includes(name)) return
    removeSessionProject(name)
    setSessionProjects(getSessionProjects())
  }

  if (!ready) {
    return (
      <div className="p-4 text-xs text-gray-500">
        Inicializando PostgreSQL...
      </div>
    )
  }

  return (
    <div className="py-2 text-xs">
      {/* Project switcher */}
      <div className="relative px-3 pb-2 mb-2 border-b border-surface-border" ref={switcherRef}>
        <button
          onClick={() => setSwitcherOpen(!switcherOpen)}
          className="flex items-center w-full text-xs text-institutional-400 font-semibold gap-1.5 hover:bg-surface-hover px-1.5 py-1 rounded transition-colors duration-100"
        >
          <Database size={14} className="flex-shrink-0 text-institutional-400" />
          <span className="flex-1 truncate text-left">{projectName || 'Sin proyecto'}</span>
          <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />
        </button>

        {switcherOpen && (
          <div className="absolute left-0 right-3 top-full mt-1 bg-surface-elevated border border-surface-border rounded shadow-lg z-50 max-h-72 overflow-y-auto animate-fade-in">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Proyectos de ejemplo
            </div>
            {DEFAULT_PROJECTS.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-txt-muted hover:bg-surface-hover cursor-pointer transition-colors duration-100"
                onClick={() => switchToProject(name)}
              >
                <FolderKanban size={14} className="text-institutional-400 flex-shrink-0" />
                <span className="flex-1 truncate capitalize">{name}</span>
                {name === projectName && (
                  <Badge variant="pk">activo</Badge>
                )}
              </div>
            ))}

            <div className="border-t border-surface-border my-1" />

            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Mis proyectos
            </div>
            {sessionProjects.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-gray-500">
                No hay proyectos en la sesión
              </div>
            ) : (
              sessionProjects.map((name) => (
                <div
                  key={name}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-txt-muted hover:bg-surface-hover cursor-pointer group transition-colors duration-100"
                  onClick={() => switchToProject(name)}
                >
                  <FolderOpen size={14} className="text-gray-500 flex-shrink-0" />
                  <span className="flex-1 truncate">{name}</span>
                  {name === projectName && (
                    <Badge variant="pk">activo</Badge>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFromSession(name) }}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 p-0.5 transition-opacity duration-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Schema tree */}
      {schemas.map((s) => {
          const schemaKey = `schema:${s.schema_name}`
          const isSchemaOpen = expanded.has(schemaKey)
          const totalTables = s.tables.length
          const totalViews = s.views.length
          const totalFuncs = s.functions.length

          return (
            <div key={s.schema_name} className="mb-1">
              {/* Schema header */}
              <div className="flex items-center w-full text-xs text-txt-muted font-medium group">
                <button
                  onClick={() => toggle(schemaKey)}
                  className="flex items-center flex-1 text-left px-3 py-1 hover:bg-surface-hover transition-colors duration-100"
                >
                  {isSchemaOpen ? <ChevronDown size={10} className="mr-1.5 text-gray-500 flex-shrink-0" /> : <ChevronRight size={10} className="mr-1.5 text-gray-500 flex-shrink-0" />}
                  <Database size={12} className="mr-1.5 text-institutional-400 flex-shrink-0" />
                  <span className="text-institutional-300">{s.schema_name}</span>
                </button>
                <button
                  onClick={refreshTables}
                  className="p-1 mr-1 rounded text-txt-dim hover:text-white hover:bg-surface-hover transition-colors opacity-0 group-hover:opacity-100"
                  title="Refrescar esquemas"
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              {isSchemaOpen && (
                <div className="ml-3 animate-fade-in">
                  {/* Tables */}
                  {totalTables > 0 && (
                    <div className="mb-1">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        Tablas{' '}<span className="text-gray-600 font-normal normal-case tracking-normal">({totalTables})</span>
                      </div>
                      {s.tables.map((t) => {
                        const tKey = `${schemaKey}:table:${t.name}`
                        const isSelected = selectedTable === tKey
                        return (
                          <div key={t.name}>
                            <button
                              onClick={() => { toggle(tKey); setSelectedTable(isSelected ? null : tKey) }}
                              className={`flex items-center w-full text-left px-3 py-1 text-xs transition-colors duration-100 border-l-2 ${
                                isSelected
                                  ? 'border-institutional-500 bg-surface-hover/40 text-institutional-200'
                                  : 'border-transparent text-txt-muted hover:bg-surface-hover hover:border-gray-600'
                              }`}
                            >
                              {expanded.has(tKey) ? <ChevronDown size={10} className="mr-1.5 text-gray-500 flex-shrink-0" /> : <ChevronRight size={10} className="mr-1.5 text-gray-500 flex-shrink-0" />}
                              <Table2 size={12} className="mr-1.5 text-institutional-400 flex-shrink-0" />
                              <span>{t.name}</span>
                            </button>
                            {expanded.has(tKey) && (
                              <div className="ml-5 pl-2 border-l border-surface-border animate-fade-in">
                                {t.columns.map((c) => (
                                  <div key={c.column_name} className="flex items-center gap-1 px-2 py-0.5 text-[11px] hover:bg-surface-hover/50 transition-colors duration-75">
                                    {(() => { const Icon = typeIcon(c.data_type); return <Icon size={9} className="text-gray-500 flex-shrink-0" />; })()}
                                    <span className="text-txt-muted">{c.column_name}</span>
                                    <Badge variant="type">{c.data_type}</Badge>
                                    {c.is_primary_key && <Badge variant="pk">PK</Badge>}
                                    {(t.foreignKeys ?? []).some((fk) => fk.column_name === c.column_name) && <Badge variant="fk">FK</Badge>}
                                    {c.is_nullable === 'NO' && !c.is_primary_key && <Badge variant="nn">NN</Badge>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Views */}
                  {totalViews > 0 && (
                    <div className="mb-1">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        Vistas{' '}<span className="text-gray-600 font-normal normal-case tracking-normal">({totalViews})</span>
                      </div>
                      {s.views.map((v) => {
                        const vKey = `${schemaKey}:view:${v.name}`
                        return (
                          <div key={v.name}>
                            <button
                              onClick={() => toggle(vKey)}
                              className="flex items-center w-full text-left px-3 py-1 text-xs text-txt-muted hover:bg-surface-hover hover:border-l-2 hover:border-emerald-600/50 transition-colors duration-100 border-l-2 border-transparent"
                            >
                              {expanded.has(vKey) ? <ChevronDown size={10} className="mr-1.5 text-gray-500 flex-shrink-0" /> : <ChevronRight size={10} className="mr-1.5 text-gray-500 flex-shrink-0" />}
                              <Eye size={12} className="mr-1.5 text-emerald-500 flex-shrink-0" />
                              <span className="text-emerald-400">{v.name}</span>
                            </button>
                            {expanded.has(vKey) && (
                              <div className="ml-5 pl-2 border-l border-surface-border animate-fade-in">
                                {v.columns.map((c) => (
                                  <div key={c.column_name} className="flex items-center gap-1 px-2 py-0.5 text-[11px]">
                                    {(() => { const Icon = typeIcon(c.data_type); return <Icon size={9} className="text-gray-500 flex-shrink-0" />; })()}
                                    <span className="text-txt-muted">{c.column_name}</span>
                                    <Badge variant="type">{c.data_type}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Functions */}
                  {totalFuncs > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        Funciones{' '}<span className="text-gray-600 font-normal normal-case tracking-normal">({totalFuncs})</span>
                      </div>
                      {s.functions.map((f) => (
                        <div
                          key={f.name}
                          className="flex items-center gap-1.5 px-6 py-0.5 text-xs text-txt-muted hover:bg-surface-hover transition-colors duration-100"
                        >
                          <FunctionSquare size={12} className="text-violet-500 flex-shrink-0" />
                          <span className="text-violet-400">{f.name}()</span>
                          {f.return_type && (
                            <Badge variant="type">→ {f.return_type}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      }

    </div>
  )
}
