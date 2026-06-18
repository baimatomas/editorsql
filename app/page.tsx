'use client'

import { useState, useEffect, useRef } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { useDB, DEFAULT_SCHEMA, DEFAULT_PROJECTS } from '@/app/providers'
import SchemaEditor from '@/app/components/SchemaEditor'
import QueryEditor from '@/app/components/QueryEditor'
import TableBrowser from '@/app/components/TableBrowser'
import ResultTable from '@/app/components/ResultTable'
import {
  saveProjectFile, openProjectFile,
  saveSessionProject, getSessionProjects,
  clearDirty, migrateOldProjects,
  type ProjectData,
} from '@/app/lib/projectFiles'

type PanelKey = 'sidebar' | 'schema' | 'query' | 'results'

const LABELS: Record<PanelKey, string> = {
  sidebar: 'Tablas',
  schema: 'Schema',
  query: 'Query',
  results: 'Resultados',
}

export default function Home() {
  const { getDump } = useDB()
  const [visible, setVisible] = useState<Record<PanelKey, boolean>>({
    sidebar: true,
    schema: true,
    query: true,
    results: true,
  })

  useEffect(() => {
    migrateOldProjects()
  }, [])

  const toggle = (key: PanelKey) =>
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))

  const saveProject = async () => {
    let name = localStorage.getItem('editorsql_current_project')
    if (name && DEFAULT_PROJECTS.includes(name)) {
      alert('No se puede sobrescribir un proyecto de ejemplo.\nUsá "Guardar Como" para crear una copia con otro nombre.')
      return
    }
    if (!name) {
      name = prompt('Nombre del proyecto:')
      if (!name || !name.trim()) return
    }
    const trimmed = name.trim()
    const dump = await getDump()
    const data: ProjectData = {
      name: trimmed,
      schema: localStorage.getItem('editorsql_schema') ?? '',
      query: localStorage.getItem('editorsql_query') ?? '',
      savedQueries: localStorage.getItem('editorsql_saved_queries') ?? '[]',
      dataDump: dump,
    }
    const json = JSON.stringify(data)
    const ok = await saveProjectFile(trimmed, json)
    if (ok) {
      saveSessionProject(trimmed, data)
      localStorage.setItem('editorsql_current_project', trimmed)
      clearDirty()
    }
  }

  const saveAsProject = async () => {
    const name = prompt('Guardar como:')
    if (!name || !name.trim()) return
    const trimmed = name.trim()
    if (DEFAULT_PROJECTS.includes(trimmed)) {
      alert('No se puede usar el nombre de un proyecto de ejemplo.')
      return
    }
    const dump = await getDump()
    const data: ProjectData = {
      name: trimmed,
      schema: localStorage.getItem('editorsql_schema') ?? '',
      query: localStorage.getItem('editorsql_query') ?? '',
      savedQueries: localStorage.getItem('editorsql_saved_queries') ?? '[]',
      dataDump: dump,
    }
    const json = JSON.stringify(data)
    const ok = await saveProjectFile(trimmed, json)
    if (ok) {
      saveSessionProject(trimmed, data)
      localStorage.setItem('editorsql_current_project', trimmed)
      clearDirty()
    }
  }

  const openProject = async () => {
    const data = await openProjectFile()
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
    localStorage.setItem('editorsql_current_project', data.name)
    saveSessionProject(data.name, data)
    clearDirty()
    location.reload()
  }

  const newProject = async () => {
    const name = prompt('Nombre del nuevo proyecto:')
    if (!name || !name.trim()) return
    const trimmed = name.trim()

    // Save current state to session cache
    const currentName = localStorage.getItem('editorsql_current_project')
    if (currentName && !DEFAULT_PROJECTS.includes(currentName)) {
      const dump = await getDump()
      const data: ProjectData = {
        name: currentName,
        schema: localStorage.getItem('editorsql_schema') ?? '',
        query: localStorage.getItem('editorsql_query') ?? '',
        savedQueries: localStorage.getItem('editorsql_saved_queries') ?? '[]',
        dataDump: dump,
      }
      saveSessionProject(currentName, data)
    }

    // Reset to default
    localStorage.setItem('editorsql_schema', DEFAULT_SCHEMA)
    localStorage.setItem('editorsql_query', 'SELECT * FROM ')
    localStorage.setItem('editorsql_saved_queries', '[]')
    localStorage.setItem('editorsql_current_project', trimmed)
    localStorage.removeItem('editorsql_restore_flag')
    localStorage.removeItem('editorsql_restore_data')
    clearDirty()
    location.reload()
  }

  const hasAny = visible.sidebar || visible.schema || visible.query || visible.results

  return (
    <div className="h-screen flex flex-col bg-[#1e1e1e] text-gray-200">
        <header className="bg-[#007acc] text-white px-4 py-1 text-sm font-semibold flex items-center gap-2 flex-shrink-0">
          <span className="mr-2">EditorSQL</span>
          <span className="text-[11px] font-normal opacity-70 mr-auto">— FCECON — Asignatura Base de Datos</span>

          <button
            onClick={newProject}
            className="px-2 py-0.5 text-[11px] rounded border border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            Nuevo Proyecto
          </button>

          <button
            onClick={saveProject}
            className="px-2 py-0.5 text-[11px] rounded border border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            Guardar Proyecto
          </button>

          <button
            onClick={saveAsProject}
            className="px-2 py-0.5 text-[11px] rounded border border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            Guardar Como
          </button>

          <button
            onClick={openProject}
            className="px-2 py-0.5 text-[11px] rounded border border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            Abrir Proyecto
          </button>

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
