'use client'

import { useState, useEffect, useRef } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { useDB, DEFAULT_PROJECTS } from '@/app/providers'
import Header from '@/app/components/Header'
import DERViewer from '@/app/components/DERViewer'
import QueryEditor from '@/app/components/QueryEditor'
import TableBrowser from '@/app/components/TableBrowser'
import ResultTable from '@/app/components/ResultTable'
import {
  saveProjectFile, openProjectFile,
  saveSessionProject, getSessionProjects,
  clearDirty, migrateOldProjects, isDirty,
  type ProjectData,
} from '@/app/lib/projectFiles'

type PanelKey = 'sidebar' | 'schema' | 'query' | 'results'

export default function Home() {
  const { getDump } = useDB()
  const [visible, setVisible] = useState<Record<PanelKey, boolean>>({
    sidebar: true,
    schema: false,
    query: true,
    results: true,
  })

  useEffect(() => {
    migrateOldProjects()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault()
        if (isDirty()) {
          import('sweetalert2').then(({ default: Swal }) => {
            Swal.fire({
              title: '¿Recargar?',
              text: 'Los cambios no guardados se perderán.',
              icon: 'warning',
              showCancelButton: true,
              confirmButtonText: 'Recargar',
              cancelButtonText: 'Cancelar',
              reverseButtons: true,
              background: '#2d2d2d',
              color: '#d4d4d4',
              confirmButtonColor: '#0e639c',
              cancelButtonColor: '#6c6c6c',
            }).then((r) => { if (r.isConfirmed) location.reload() })
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

  const swalBase = () => ({
    background: '#2d2d2d',
    color: '#d4d4d4',
    confirmButtonColor: '#0e639c',
    cancelButtonColor: '#6c6c6c',
    reverseButtons: true,
  })

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

  const hasAny = visible.sidebar || visible.schema || visible.query || visible.results

  return (
    <div className="h-screen flex flex-col bg-surface text-gray-200">
        <Header
          visible={visible}
          onToggle={toggle}
          onNewProject={newProject}
          onSaveProject={saveProject}
          onSaveAsProject={saveAsProject}
          onOpenProject={openProject}
        />

        {!hasAny ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            Todos los paneles están ocultos. Activá uno desde el header.
          </div>
        ) : (
          <Group orientation="horizontal" className="flex-1">
            {visible.sidebar && (
              <>
                <Panel id="sidebar" defaultSize="17%" minSize="6%" className="bg-surface-card">
                  <TableBrowser />
                </Panel>
                <Separator className="w-[3px] bg-surface-border hover:bg-institutional-500 transition-colors duration-150 cursor-col-resize" />
              </>
            )}

            <Panel id="main" className="flex flex-col">
              {(visible.schema || visible.query) && (
                <Group orientation="vertical" className="flex-1">
                  <Panel id="editors" defaultSize="65%" minSize="10%">
                    {visible.schema && visible.query ? (
                      <Group orientation="horizontal">
                        <Panel id="query" defaultSize="50%" minSize="10%">
                          <QueryEditor />
                        </Panel>
                        <Separator className="w-[3px] bg-surface-border hover:bg-institutional-500 transition-colors duration-150 cursor-col-resize" />
                        <Panel id="schema" defaultSize="50%" minSize="10%">
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
