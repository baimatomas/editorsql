'use client'

import { Info } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { useDB, DEFAULT_PROJECTS } from '@/app/providers'
import Header from '@/app/components/Header'
import DERViewer from '@/app/components/DERViewer'
import QueryEditor from '@/app/components/QueryEditor'
import TableBrowser from '@/app/components/TableBrowser'
import ResultTable from '@/app/components/ResultTable'
import ExercisePanel from '@/app/components/ExercisePanel'
import {
  saveProjectFile, openProjectFile,
  saveSessionProject, getSessionProjects,
  clearDirty, migrateOldProjects, isDirty,
  type ProjectData,
} from '@/app/lib/projectFiles'
import { hasExercisesForDatabase } from '@/app/lib/exercises'
import { swalTheme } from '@/app/lib/swalConfig'

type PanelKey = 'sidebar' | 'schema' | 'query' | 'results' | 'exercises'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-txt-dim whitespace-nowrap">{label}</span>
      <span className="text-txt-body text-right">{value}</span>
    </div>
  )
}

export default function Home() {
  const { getDump } = useDB()
  const [visible, setVisible] = useState<Record<PanelKey, boolean>>({
    sidebar: true,
    schema: false,
    query: true,
    results: true,
    exercises: false,
  })
  const [exercisesAvailable, setExercisesAvailable] = useState(false)

  useEffect(() => {
    const project = localStorage.getItem('editorsql_current_project')
    const isAdmin = !!localStorage.getItem('editorsql_admin_token')
    if (project && hasExercisesForDatabase(project)) setExercisesAvailable(true)
    if (isAdmin) setExercisesAvailable(true)
  }, [])

  useEffect(() => {
    migrateOldProjects()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault()
        if (isDirty()) {
          import('sweetalert2').then(({ default: Swal }) => {
            Swal.fire(swalTheme({
              title: '¿Recargar?',
              text: 'Los cambios no guardados se perderán.',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Recargar',
              cancelButtonText: 'Cancelar',
            })).then((r) => { if (r.isConfirmed) location.reload() })
          })
        } else {
          location.reload()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggle = (key: PanelKey) =>
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))

  const swalBase = () => swalTheme()

  const saveProject = async () => {
    const { default: Swal } = await import('sweetalert2')

    let name = localStorage.getItem('editorsql_current_project')
    if (name && DEFAULT_PROJECTS.includes(name)) {
      await Swal.fire({ ...swalBase(), icon: 'error', title: 'Error', text: 'No se puede sobrescribir un proyecto de ejemplo.\nUsá "Guardar Como" para crear una copia con otro nombre.', confirmButtonText: 'OK' })
      return
    }
    if (!name) {
      const result = await Swal.fire({ ...swalBase(), title: 'Nombre del proyecto', input: 'text', inputPlaceholder: 'Ingresá el nombre...', showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', inputValidator: (v) => { if (!v?.trim()) return 'El nombre no puede estar vacío' } })
      if (!result.isConfirmed || !result.value?.trim()) return
      name = result.value.trim()
    }
    if (!name) return
    const trimmed = name.trim()
    const dump = await getDump()
    const data: ProjectData = {
      name: trimmed,
      schema: localStorage.getItem('editorsql_schema') ?? '',
      query: localStorage.getItem('editorsql_query_tabs') ?? '[]',
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
    const { default: Swal } = await import('sweetalert2')

    const result = await Swal.fire({ ...swalBase(), title: 'Guardar como', input: 'text', inputPlaceholder: 'Nombre del proyecto...', showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', inputValidator: (v) => { if (!v?.trim()) return 'El nombre no puede estar vacío' } })
    if (!result.isConfirmed || !result.value?.trim()) return
    const trimmed = result.value.trim()
    if (DEFAULT_PROJECTS.includes(trimmed)) {
      await Swal.fire({ ...swalBase(), icon: 'error', title: 'Error', text: 'No se puede usar el nombre de un proyecto de ejemplo.', confirmButtonText: 'OK' })
      return
    }
    const dump = await getDump()
    const data: ProjectData = {
      name: trimmed,
      schema: localStorage.getItem('editorsql_schema') ?? '',
      query: localStorage.getItem('editorsql_query_tabs') ?? '[]',
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
    localStorage.setItem('editorsql_query_tabs', data.query)
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
    const { default: Swal } = await import('sweetalert2')

    const result = await Swal.fire({ ...swalBase(), title: 'Nombre del nuevo proyecto', input: 'text', inputPlaceholder: 'Ingresá el nombre...', showCancelButton: true, confirmButtonText: 'Crear', cancelButtonText: 'Cancelar', inputValidator: (v) => { if (!v?.trim()) return 'El nombre no puede estar vacío' } })
    if (!result.isConfirmed || !result.value?.trim()) return
    const trimmed = result.value.trim()

    // Save current state to session cache
    const currentName = localStorage.getItem('editorsql_current_project')
    if (currentName && !DEFAULT_PROJECTS.includes(currentName)) {
      const dump = await getDump()
      const data: ProjectData = {
        name: currentName,
        schema: localStorage.getItem('editorsql_schema') ?? '',
        query: localStorage.getItem('editorsql_query_tabs') ?? '[]',
        savedQueries: localStorage.getItem('editorsql_saved_queries') ?? '[]',
        dataDump: dump,
      }
      saveSessionProject(currentName, data)
    }

    // Reset to default
    const defaultTabs = JSON.stringify([{ id: crypto.randomUUID(), name: 'Query1', sql: '-- Ejecutá las consultas con Ctrl + Enter\n' }])
    localStorage.setItem('editorsql_schema', '-- Usá este panel para crear tablas (CREATE TABLE, INSERT, etc.)')
    localStorage.setItem('editorsql_query_tabs', defaultTabs)
    localStorage.setItem('editorsql_saved_queries', '[]')
    localStorage.setItem('editorsql_current_project', trimmed)
    localStorage.removeItem('editorsql_restore_flag')
    localStorage.removeItem('editorsql_restore_data')
    localStorage.removeItem('editorsql_load_default')
    clearDirty()
    location.reload()
  }

  const hasAny = visible.sidebar || visible.schema || visible.query || visible.results || visible.exercises

  return (
    <div className="h-screen flex flex-col panel-gradient text-txt-body">
        <Header
          visible={visible}
          onToggle={toggle}
          onNewProject={newProject}
          onSaveProject={saveProject}
          onSaveAsProject={saveAsProject}
          onOpenProject={openProject}
          exercisesAvailable={exercisesAvailable}
        />

        {!hasAny ? (
          <div className="flex-1 flex items-center justify-center text-sm text-txt-dim">
            Todos los paneles están ocultos. Activá uno desde el header.
          </div>
        ) : (
          <Group orientation="horizontal" className="flex-1">
            {visible.sidebar && (
              <>
                <Panel id="sidebar" defaultSize="17%" minSize="6%" className="panel-gradient">
                  <TableBrowser />
                </Panel>
                <Separator className="w-[3px] bg-surface-border hover:bg-institutional-500 transition-colors duration-150 cursor-col-resize" />
              </>
            )}

            <Panel id="main" className="flex flex-col">
              {(visible.schema || visible.query) && (
                <Group orientation="vertical" className="flex-1">
                  <Panel id="editors" defaultSize="65%" minSize="10%" className="panel-gradient">
                    {visible.schema && visible.query ? (
                      <Group orientation="horizontal">
                        <Panel id="query" defaultSize="50%" minSize="10%" className="panel-gradient">
                          <QueryEditor />
                        </Panel>
                        <Separator className="w-[3px] bg-surface-border hover:bg-institutional-500 transition-colors duration-150 cursor-col-resize" />
                        <Panel id="schema" defaultSize="50%" minSize="10%" className="panel-gradient">
                          <DERViewer />
                        </Panel>
                      </Group>
                    ) : visible.schema ? (
                      <DERViewer />
                    ) : (
                      <QueryEditor />
                    )}
                  </Panel>
                  {visible.results && (
                    <>
                      <Separator className="h-[3px] bg-surface-border hover:bg-institutional-500 transition-colors duration-150 cursor-row-resize" />
                      <Panel id="results" defaultSize="35%" minSize="10%" className="panel-gradient">
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
            {visible.exercises && (
              <>
                <Separator className="w-[3px] bg-surface-border hover:bg-institutional-500 transition-colors duration-150 cursor-col-resize" />
                <Panel id="exercises" defaultSize="22%" minSize="8%" className="panel-gradient">
                  <ExercisePanel />
                </Panel>
              </>
            )}
          </Group>
        )}
        {/* Status bar */}
        <div className="flex items-center h-5 px-2 bg-institutional-800/90 text-[10px] text-white/50 select-none flex-shrink-0 relative">
          <div className="group relative flex items-center">
            <button className="flex items-center gap-1 hover:text-white transition-colors cursor-default">
              <Info size={11} />
              <span className="hidden sm:inline">Entorno de Práctica SQL</span>
            </button>
            <div className="absolute bottom-full left-0 mb-1 w-64 rounded-lg border border-surface-border bg-surface-card shadow-xl z-50 text-txt-body text-xs overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
              <div className="px-3 py-2 border-b border-surface-border bg-institutional-800/10 font-semibold text-txt-body">
                Entorno de Práctica SQL
              </div>
              <div className="p-3 space-y-1.5">
                <Row label="Motor" value="PostgreSQL (PGlite)" />
                <Row label="Versión" value="0.1.0" />
                <Row label="Desarrollo" value="Junio 2026" />
                <Row label="Institución" value="FCEyE – UNR" />
                <Row label="Asignatura" value="Base de Datos" />
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span>PGlite</span>
            <span className="text-white/30">|</span>
            <span>v0.1.0</span>
          </div>
        </div>
    </div>
  )
}
