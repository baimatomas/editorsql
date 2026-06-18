'use client'

import { useState, useEffect, useRef } from 'react'
import { useDB, DEFAULT_PROJECTS } from '@/app/providers'
import {
  getSessionProjects, saveSessionProject, getSessionProjectData,
  removeSessionProject, promptSaveIfDirty, clearDirty,
  type ProjectData,
} from '@/app/lib/projectFiles'

export default function TableBrowser() {
  const { schemas, ready, savedQueries, loadQuery, deleteQuery, getDump } = useDB()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [projectName, setProjectName] = useState<string | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [sessionProjects, setSessionProjects] = useState<string[]>([])
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

    // Save current to session
    const cur = localStorage.getItem('editorsql_current_project')
    if (cur && !DEFAULT_PROJECTS.includes(cur)) {
      const dump = await getDump()
      const data: ProjectData = {
        name: cur,
        schema: localStorage.getItem('editorsql_schema') ?? '',
        query: localStorage.getItem('editorsql_query') ?? '',
        savedQueries: localStorage.getItem('editorsql_saved_queries') ?? '[]',
        dataDump: dump,
      }
      saveSessionProject(cur, data)
    }

    // Load selected project
    if (DEFAULT_PROJECTS.includes(name)) {
      try {
        const head = await fetch(`/projects/${name}.sql`, { method: 'HEAD' })
        if (!head.ok) throw new Error('Archivo no encontrado')
        localStorage.setItem('editorsql_load_default', name)
        localStorage.setItem('editorsql_current_project', name)
        localStorage.setItem('editorsql_schema', `-- Proyecto: ${name}\n-- Base de datos cargada desde archivo\n-- Escribí tus consultas abajo\nSELECT * FROM `)
        localStorage.setItem('editorsql_query', 'SELECT * FROM ')
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
      localStorage.setItem('editorsql_query', data.query)
      localStorage.setItem('editorsql_saved_queries', data.savedQueries ?? '[]')
      if (data.dataDump) {
        localStorage.setItem('editorsql_restore_data', data.dataDump)
        localStorage.setItem('editorsql_restore_flag', 'true')
      } else {
        localStorage.removeItem('editorsql_restore_flag')
        localStorage.removeItem('editorsql_restore_data')
      }
      localStorage.setItem('editorsql_current_project', name)
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

  const hasAnyObj = schemas.some(s => s.tables.length > 0 || s.views.length > 0 || s.functions.length > 0)

  return (
    <div className="py-2">
      {/* Project switcher dropdown */}
      <div className="relative px-3 pb-2 mb-2 border-b border-[#3c3c3c]" ref={switcherRef}>
        <button
          onClick={() => setSwitcherOpen(!switcherOpen)}
          className="flex items-center w-full text-xs text-green-400 font-semibold gap-1 hover:bg-[#37373d] px-1 py-1 rounded"
        >
          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 1h6l2 2h4v11H2V1zm1 1v11h12V4H9.5L8 3H3z"/>
          </svg>
          <span className="flex-1 truncate text-left">{projectName || 'Sin proyecto'}</span>
          <svg className="w-3 h-3 text-gray-500" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 6l4 4 4-4H4z"/>
          </svg>
        </button>

        {switcherOpen && (
          <div className="absolute left-0 right-3 top-full mt-1 bg-[#2d2d2d] border border-[#3c3c3c] rounded shadow-lg z-50 max-h-72 overflow-y-auto">
            {/* Default projects */}
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Proyectos de ejemplo
            </div>
            {DEFAULT_PROJECTS.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-[#37373d] cursor-pointer"
                onClick={() => switchToProject(name)}
              >
                <svg className="w-3 h-3 text-amber-500 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 1h6l2 2h4v11H2V1zm1 1v11h12V4H9.5L8 3H3z"/>
                </svg>
                <span className="flex-1 truncate capitalize">{name}</span>
                {name === projectName && (
                  <span className="text-[10px] text-green-500">✓</span>
                )}
              </div>
            ))}

            <div className="border-t border-[#3c3c3c] my-1" />

            {/* User session projects */}
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
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-[#37373d] cursor-pointer group"
                  onClick={() => switchToProject(name)}
                >
                  <svg className="w-3 h-3 text-gray-600 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 1h6l2 2h4v11H2V1zm1 1v11h12V4H9.5L8 3H3z"/>
                  </svg>
                  <span className="flex-1 truncate">{name}</span>
                  {name === projectName && (
                    <span className="text-[10px] text-green-500">✓</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFromSession(name) }}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 px-1"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5 4V2.5A1.5 1.5 0 0 1 6.5 1h3A1.5 1.5 0 0 1 11 2.5V4h3.5v1H14l-.8 9.5A1.5 1.5 0 0 1 11.7 16H4.3a1.5 1.5 0 0 1-1.5-1.5L2 5h-.5V4H5zm2-1.5V4h2V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5z"/>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {!hasAnyObj ? (
        <div className="px-3 text-xs text-gray-500">
          No hay objetos aún.<br />
          Ejecutá un schema SQL arriba.
        </div>
      ) : (
        schemas.map((s) => {
          const schemaKey = `schema:${s.schema_name}`
          const isSchemaOpen = expanded.has(schemaKey)
          const totalTables = s.tables.length
          const totalViews = s.views.length
          const totalFuncs = s.functions.length
          if (totalTables === 0 && totalViews === 0 && totalFuncs === 0) return null

          return (
            <div key={s.schema_name} className="mb-1">
              {/* Schema header */}
              <button
                onClick={() => toggle(schemaKey)}
                className="flex items-center w-full text-left px-3 py-1 text-xs text-gray-400 hover:bg-[#37373d] font-medium"
              >
                <span className="text-[10px] mr-1.5 w-2 text-gray-500">
                  {isSchemaOpen ? '▼' : '▶'}
                </span>
                <span className="text-purple-400">Schema: {s.schema_name}</span>
              </button>

              {isSchemaOpen && (
                <div className="ml-3">
                  {/* Tables */}
                  {totalTables > 0 && (
                    <div className="mb-1">
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-2 py-0.5">
                        Tablas ({totalTables})
                      </div>
                      {s.tables.map((t) => {
                        const tKey = `${schemaKey}:table:${t.name}`
                        return (
                          <div key={t.name}>
                            <button
                              onClick={() => toggle(tKey)}
                              className="flex items-center w-full text-left px-3 py-1 text-sm text-gray-300 hover:bg-[#37373d]"
                            >
                              <span className="text-[10px] mr-1.5 text-gray-500 w-2">
                                {expanded.has(tKey) ? '▼' : '▶'}
                              </span>
                              <span className="text-blue-400">{t.name}</span>
                            </button>
                            {expanded.has(tKey) && (
                              <div className="ml-4 border-l border-[#3c3c3c] ml-5 pl-2">
                                {t.columns.map((c) => (
                                  <div key={c.column_name} className="flex items-center gap-1.5 px-2 py-0.5 text-xs">
                                    <svg className="w-3 h-3 text-gray-600 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                                      <rect x="2" y="2" width="12" height="12" rx="1" />
                                    </svg>
                                    <span className="text-gray-300">{c.column_name}</span>
                                    <span className="text-gray-600">{c.data_type}</span>
                                    {c.is_nullable === 'NO' && (
                                      <span className="text-[10px] text-yellow-700 font-medium">NN</span>
                                    )}
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
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-2 py-0.5">
                        Vistas ({totalViews})
                      </div>
                      {s.views.map((v) => {
                        const vKey = `${schemaKey}:view:${v.name}`
                        return (
                          <div key={v.name}>
                            <button
                              onClick={() => toggle(vKey)}
                              className="flex items-center w-full text-left px-3 py-1 text-sm text-gray-300 hover:bg-[#37373d]"
                            >
                              <span className="text-[10px] mr-1.5 text-gray-500 w-2">
                                {expanded.has(vKey) ? '▼' : '▶'}
                              </span>
                              <span className="text-teal-400">{v.name}</span>
                            </button>
                            {expanded.has(vKey) && (
                              <div className="ml-4 border-l border-[#3c3c3c] ml-5 pl-2">
                                {v.columns.map((c) => (
                                  <div key={c.column_name} className="flex items-center gap-1.5 px-2 py-0.5 text-xs">
                                    <svg className="w-3 h-3 text-gray-600 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                                      <rect x="2" y="2" width="12" height="12" rx="1" />
                                    </svg>
                                    <span className="text-gray-300">{c.column_name}</span>
                                    <span className="text-gray-600">{c.data_type}</span>
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
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-2 py-0.5">
                        Funciones ({totalFuncs})
                      </div>
                      {s.functions.map((f) => (
                        <div
                          key={f.name}
                          className="flex items-center gap-1.5 px-6 py-0.5 text-xs text-gray-300 hover:bg-[#37373d]"
                        >
                          <svg className="w-3 h-3 text-orange-400 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M3 2h10v2H3V2zm0 5h10v2H3V7zm0 5h7v2H3v-2z"/>
                          </svg>
                          <span className="text-orange-300">{f.name}()</span>
                          {f.return_type && (
                            <span className="text-gray-600">→ {f.return_type}</span>
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
      )}

      <div className="border-t border-[#3c3c3c] mb-2 mt-2" />

      {/* Saved Queries */}
      <div>
        <button
          onClick={() => toggle('saved')}
          className="flex items-center w-full text-left px-3 py-1 text-xs text-gray-400 hover:bg-[#37373d]"
        >
          <span className="text-[10px] mr-1.5 w-2">
            {expanded.has('saved') ? '▼' : '▶'}
          </span>
          <span className="text-orange-400 font-medium">Saved Queries</span>
          {savedQueries.length > 0 && (
            <span className="ml-1 text-gray-600">({savedQueries.length})</span>
          )}
        </button>
        {expanded.has('saved') && (
          <div>
            {savedQueries.length === 0 && (
              <div className="ml-5 pl-3 py-1 text-[10px] text-gray-600">
                Aún no guardaste consultas
              </div>
            )}
            {savedQueries.map((q) => (
              <div key={q.id} className="group flex items-center ml-5 pl-3 pr-2 py-0.5 hover:bg-[#37373d] cursor-pointer" onClick={() => loadQuery(q.id)}>
                <svg className="w-3 h-3 text-gray-600 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 2h12v12H2V2zm1 1v10h10V3H3zm2 2h6v1H5V5zm0 3h6v1H5V8zm0 3h4v1H5v-1z"/>
                </svg>
                <span className="ml-1.5 text-xs text-gray-300 flex-1 truncate">{q.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteQuery(q.id) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-[10px] px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
