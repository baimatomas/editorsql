'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Database, Table2, Eye, FunctionSquare, FolderOpen, Trash2, RefreshCw, ChevronRight, ChevronDown, FolderKanban, Hash, Calendar, FileText, ToggleLeft, HelpCircle, Plus, Pencil, Save, Upload, X } from 'lucide-react'
import { useDB, DEFAULT_PROJECTS, type ObjectInfo, type ColumnInfo } from '@/app/providers'
import Badge from '@/app/components/ui/Badge'
import {
  getSessionProjects, saveSessionProject, getSessionProjectData,
  removeSessionProject, promptSaveIfDirty, clearDirty,
  type ProjectData,
} from '@/app/lib/projectFiles'
import { swalTheme } from '@/app/lib/swalConfig'
import { type ProjectEntry } from '@/app/lib/projects'

type CtxTarget =
  | { kind: 'table'; schema: string; table: ObjectInfo }
  | { kind: 'view'; schema: string; view: ObjectInfo }
  | { kind: 'column'; schema: string; table: ObjectInfo; column: ColumnInfo }

function typeIcon(type: string) {
  const t = type.toLowerCase()
  if (/^(int|smallint|bigint|tinyint|serial|decimal|numeric|real|float|double|money)/.test(t)) return Hash
  if (/^(date|time|timestamp|interval)/.test(t)) return Calendar
  if (/^(char|varchar|text|clob|nchar|nvarchar|ntext|json|xml)/.test(t)) return FileText
  if (/^bool/.test(t)) return ToggleLeft
  return HelpCircle
}

// ── Context-menu helper components ────────────────────────────

function CtxItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-[12px] text-txt-body hover:bg-institutional-500/15 transition-colors duration-75"
    >
      {children}
    </button>
  )
}

function CtxSubItem({ label, open, onEnter, children }: { label: string; open: boolean; onEnter: () => void; children: React.ReactNode }) {
  return (
    <div className="relative" onMouseEnter={onEnter}>
      <div className="w-full text-left px-3 py-1.5 text-[12px] text-txt-body hover:bg-institutional-500/15 transition-colors duration-75 flex items-center justify-between">
        {label}
        <ChevronRight className="w-3 h-3 text-txt-dim" />
      </div>
      {open && (
        <div className="absolute left-full top-0 min-w-[180px] rounded-lg border border-surface-border bg-surface-card shadow-xl py-1 text-xs z-50">
          {children}
        </div>
      )}
    </div>
  )
}

export default function TableBrowser() {
  const { schemas, ready, getDump, refreshTables, queryTabs, activeTabId, setQueryTabSQL } = useDB()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [projectName, setProjectName] = useState<string | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [sessionProjects, setSessionProjects] = useState<string[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ target: CtxTarget; x: number; y: number } | null>(null)
  const [ctxSub, setCtxSub] = useState<string | null>(null)
  const switcherRef = useRef<HTMLDivElement>(null)
  const [exampleProjects, setExampleProjects] = useState<ProjectEntry[]>([])
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [editingProject, setEditingProject] = useState<{ name?: string; label: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setProjectName(localStorage.getItem('editorsql_current_project'))
    setSessionProjects(getSessionProjects())
    setAdminToken(localStorage.getItem('editorsql_admin_token'))
    fetch('/api/projects').then(r => r.ok && r.json()).then(d => {
      if (d?.projects) setExampleProjects(d.projects)
    }).catch(() => {})
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
    const isExample = exampleProjects.some(p => p.name === cur) || (cur ? DEFAULT_PROJECTS.includes(cur) : false)
    if (cur && !isExample) {
      const dump = await getDump()
      const data: ProjectData = {
        name: cur,
        schema: localStorage.getItem('editorsql_schema') ?? '',
        query: localStorage.getItem('editorsql_query_tabs') ?? '[]',
        savedQueries: localStorage.getItem('editorsql_saved_queries') ?? '[]',
        dataDump: dump,
      }
      saveSessionProject(cur, data)
      localStorage.removeItem('editorsql_remote')
    }

    const isTargetExample = exampleProjects.some(p => p.name === name) || DEFAULT_PROJECTS.includes(name)
    if (isTargetExample) {
      try {
        const head = await fetch(`/api/projects/${name}/sql`, { method: 'HEAD' })
        if (!head.ok) throw new Error('Archivo no encontrado')
        localStorage.setItem('editorsql_load_default', name)
        localStorage.setItem('editorsql_current_project', name)
        localStorage.setItem('editorsql_schema', `-- Proyecto: ${name}\n-- Base de datos cargada desde archivo\n-- Usá este panel para crear y modificar tablas (CREATE TABLE, INSERT, ALTER, etc.)`)
        localStorage.setItem('editorsql_saved_queries', '[]')
        localStorage.removeItem('editorsql_restore_flag')
        localStorage.removeItem('editorsql_restore_data')
        localStorage.setItem('editorsql_remote', name)
      } catch (e) {
        const { default: Swal } = await import('sweetalert2')
        await Swal.fire(swalTheme({ icon: 'error', title: 'Error', text: 'Error al cargar proyecto: ' + (e as Error).message, confirmButtonText: 'OK' }))
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
    if (exampleProjects.some(p => p.name === name)) return
    removeSessionProject(name)
    setSessionProjects(getSessionProjects())
  }

  const handleAddProject = () => {
    setEditingProject({ label: '' })
    setSwitcherOpen(true)
  }

  const handleRefreshProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      const d = await res.json()
      if (d?.projects) setExampleProjects(d.projects)
    } catch {}
  }

  const handleEditProject = (p: ProjectEntry) => {
    setEditingProject({ name: p.name, label: p.label })
    setSwitcherOpen(true)
  }

  const handleDeleteProject = async (p: ProjectEntry) => {
    if (!adminToken) return
    const { default: Swal } = await import('sweetalert2')
    const result = await Swal.fire(swalTheme({
      title: `¿Eliminar "${p.label}"?`,
      html: `Se eliminará la base de datos del servidor y también se borrarán los ejercicios asociados.<br><br>Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
    }))
    if (!result.isConfirmed) return
    try {
      const res = await fetch(`/api/projects/${p.name}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (!res.ok) { const text = await res.text(); throw new Error(text) }
      const refresh = await fetch('/api/projects')
      const d = await refresh.json()
      if (d?.projects) setExampleProjects(d.projects)
      Swal.fire(swalTheme({
        icon: 'success', title: 'Eliminado', text: `"${p.label}" se eliminó correctamente.`, timer: 2000, showConfirmButton: false,
      }))
    } catch (e) {
      Swal.fire(swalTheme({ icon: 'error', title: 'Error', text: (e as Error).message, confirmButtonText: 'OK' }))
    }
  }

  const handleSaveProject = async () => {
    if (!editingProject || !editingProject.label.trim() || !adminToken) return
    const isNew = !editingProject.name
    const file = fileInputRef.current?.files?.[0]
    const { default: Swal } = await import('sweetalert2')
    if (isNew && !file) { Swal.fire(swalTheme({ icon: 'error', title: 'Error', text: 'Debe seleccionar un archivo .sql', confirmButtonText: 'OK' })); return }
    if (file) {
      if (!file.name.endsWith('.sql')) { Swal.fire(swalTheme({ icon: 'error', title: 'Error', text: 'Solo se aceptan archivos .sql', confirmButtonText: 'OK' })); return }
      if (file.size > 4 * 1024 * 1024) { Swal.fire(swalTheme({ icon: 'error', title: 'Error', text: 'El archivo excede el límite de 4 MB', confirmButtonText: 'OK' })); return }
    }

    const body = new FormData()
    body.set('label', editingProject.label.trim())
    if (file) body.set('file', file)

    try {
      const url = isNew ? '/api/projects' : `/api/projects/${editingProject.name}`
      const method = isNew ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${adminToken}` },
        body,
      })
      if (!res.ok) {
        const err = await res.json()
        Swal.fire(swalTheme({ icon: 'error', title: 'Error', text: err.error || 'Error al guardar', confirmButtonText: 'OK' }))
        return
      }
      const data = await fetch('/api/projects')
      const d = await data.json()
      if (d?.projects) setExampleProjects(d.projects)
      setEditingProject(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      Swal.fire(swalTheme({
        icon: 'success', title: isNew ? 'Creado' : 'Actualizado', text: `"${editingProject.label.trim()}" se guardó correctamente.`, timer: 2000, showConfirmButton: false,
      }))
    } catch (e) {
      Swal.fire(swalTheme({ icon: 'error', title: 'Error', text: (e as Error).message, confirmButtonText: 'OK' }))
    }
  }

  const ctxClose = useCallback(() => { setCtxMenu(null); setCtxSub(null) }, [])

  function appendToActiveTab(sql: string) {
    const tab = queryTabs.find(t => t.id === activeTabId)
    const cur = tab?.sql ?? ''
    const sep = cur.trim() ? '\n\n' : ''
    setQueryTabSQL(activeTabId, cur + sep + sql)
    ctxClose()
  }

  // ── SQL generators ──────────────────────────────────────────

  function q(s: string) { return `"${s}"` }

  function genSelectStar(t: { schema: string; table: ObjectInfo }) {
    return `-- ===== SELECT todos los registros de ${t.table.name} =====\nSELECT * FROM ${q(t.schema)}.${q(t.table.name)} LIMIT 100;`
  }
  function genSelectCount(t: { schema: string; table: ObjectInfo }) {
    return `-- ===== Contar registros en ${t.table.name} =====\nSELECT COUNT(*) FROM ${q(t.schema)}.${q(t.table.name)};`
  }
  function genSelectColumns(t: { schema: string; table: ObjectInfo }) {
    const cols = t.table.columns.map(c => `  ${q(c.column_name)}`).join(',\n')
    return `-- ===== SELECT columnas específicas de ${t.table.name} =====\nSELECT\n${cols}\nFROM ${q(t.schema)}.${q(t.table.name)}\nLIMIT 100;`
  }
  function genInsert(t: { schema: string; table: ObjectInfo }) {
    const names = t.table.columns.map(c => q(c.column_name)).join(', ')
    const vals = t.table.columns.map(c => {
      const tp = c.data_type.toLowerCase()
      if (/^(int|smallint|bigint|tinyint|serial|decimal|numeric|real|float|double|money)/.test(tp)) return `0  -- ${c.column_name}`
      if (/^(date|time|timestamp)/.test(tp)) return `'2024-01-01'  -- ${c.column_name}`
      if (/^(char|varchar|text|clob|nchar|nvarchar|ntext)/.test(tp)) return `''  -- ${c.column_name}`
      if (/^bool/.test(tp)) return `TRUE  -- ${c.column_name}`
      return `DEFAULT  -- ${c.column_name}`
    }).join(',\n  ')
    return `-- ===== Plantilla INSERT para ${t.table.name} =====\nINSERT INTO ${q(t.schema)}.${q(t.table.name)} (\n  ${names}\n) VALUES (\n  ${vals}\n);`
  }
  function genUpdate(t: { schema: string; table: ObjectInfo }) {
    const pk = t.table.columns.filter(c => c.is_primary_key)
    const where = pk.length ? pk.map(c => `${q(c.column_name)} = valor_${c.column_name}`).join(' AND ') : 'condición'
    return `-- ===== Plantilla UPDATE para ${t.table.name} =====\nUPDATE ${q(t.schema)}.${q(t.table.name)}\nSET "columna" = nuevo_valor\nWHERE ${where};`
  }
  function genDelete(t: { schema: string; table: ObjectInfo }) {
    const pk = t.table.columns.filter(c => c.is_primary_key)
    const where = pk.length ? pk.map(c => `${q(c.column_name)} = valor_${c.column_name}`).join(' AND ') : 'condición'
    return `-- ===== Plantilla DELETE para ${t.table.name} =====\nDELETE FROM ${q(t.schema)}.${q(t.table.name)}\nWHERE ${where};`
  }
  function genDrop(t: { schema: string; table: ObjectInfo }) {
    return `-- ===== Eliminar tabla ${t.table.name} =====\nDROP TABLE IF EXISTS ${q(t.schema)}.${q(t.table.name)};`
  }
  function genTruncate(t: { schema: string; table: ObjectInfo }) {
    return `-- ===== Vaciar tabla ${t.table.name} =====\nTRUNCATE TABLE ${q(t.schema)}.${q(t.table.name)};`
  }
  function genCreateTable(t: { schema: string; table: ObjectInfo }) {
    const cols = t.table.columns.map(c => {
      let def = `  ${q(c.column_name)} ${c.data_type}`
      if (c.is_primary_key) return def + ' PRIMARY KEY'
      if (c.is_nullable === 'NO') def += ' NOT NULL'
      if (c.column_default) def += ` DEFAULT ${c.column_default}`
      return def
    })
    const fks = (t.table.foreignKeys ?? []).map(fk =>
      `  FOREIGN KEY (${q(fk.column_name)}) REFERENCES ${q(fk.foreign_table_schema)}.${q(fk.foreign_table_name)}(${q(fk.foreign_column_name)})`
    )
    return `-- ===== CREATE TABLE ${t.table.name} (ingeniería inversa) =====\nCREATE TABLE ${q(t.schema)}.${q(t.table.name)} (\n${[...cols, ...fks].join(',\n')}\n);`
  }
  function genDescribe(t: { schema: string; table: ObjectInfo }) {
    return `-- ===== Describir estructura de ${t.table.name} =====\nSELECT column_name, data_type, is_nullable, column_default\nFROM information_schema.columns\nWHERE table_schema = '${t.schema}' AND table_name = '${t.table.name}'\nORDER BY ordinal_position;`
  }

  function genAlterAddCol(t: { schema: string; table: ObjectInfo }) {
    return `-- ===== Agregar columna a ${t.table.name} =====\nALTER TABLE ${q(t.schema)}.${q(t.table.name)} ADD COLUMN "nombre_columna" tipo_dato;`
  }
  function genAlterRenameTable(t: { schema: string; table: ObjectInfo }) {
    return `-- ===== Renombrar tabla ${t.table.name} =====\nALTER TABLE ${q(t.schema)}.${q(t.table.name)} RENAME TO nuevo_nombre;`
  }
  function genAlterDropCol(t: { schema: string; table: ObjectInfo }, col: string) {
    return `-- ===== Eliminar columna "${col}" de ${t.table.name} =====\nALTER TABLE ${q(t.schema)}.${q(t.table.name)} DROP COLUMN ${q(col)};`
  }
  function genAlterRenameCol(t: { schema: string; table: ObjectInfo }, col: string) {
    return `-- ===== Renombrar columna "${col}" en ${t.table.name} =====\nALTER TABLE ${q(t.schema)}.${q(t.table.name)} RENAME COLUMN ${q(col)} TO nuevo_nombre;`
  }
  function genAlterColType(t: { schema: string; table: ObjectInfo }, col: string) {
    return `-- ===== Cambiar tipo de columna "${col}" en ${t.table.name} =====\nALTER TABLE ${q(t.schema)}.${q(t.table.name)} ALTER COLUMN ${q(col)} TYPE nuevo_tipo;`
  }
  function genSetNotNull(t: { schema: string; table: ObjectInfo }, col: string) {
    return `-- ===== Establecer NOT NULL en "${col}" =====\nALTER TABLE ${q(t.schema)}.${q(t.table.name)} ALTER COLUMN ${q(col)} SET NOT NULL;`
  }
  function genDropNotNull(t: { schema: string; table: ObjectInfo }, col: string) {
    return `-- ===== Quitar NOT NULL en "${col}" =====\nALTER TABLE ${q(t.schema)}.${q(t.table.name)} ALTER COLUMN ${q(col)} DROP NOT NULL;`
  }
  function genSetDefault(t: { schema: string; table: ObjectInfo }, col: string) {
    return `-- ===== Establecer DEFAULT en "${col}" =====\nALTER TABLE ${q(t.schema)}.${q(t.table.name)} ALTER COLUMN ${q(col)} SET DEFAULT valor_por_defecto;`
  }

  function genSelectColumn(t: { schema: string; table: ObjectInfo }, col: string) {
    return `-- ===== SELECT columna "${col}" de ${t.table.name} =====\nSELECT ${q(col)} FROM ${q(t.schema)}.${q(t.table.name)} LIMIT 100;`
  }
  function genWhereColumn(t: { schema: string; table: ObjectInfo }, col: string) {
    return `-- ===== Filtrar por "${col}" =====\nSELECT * FROM ${q(t.schema)}.${q(t.table.name)} WHERE ${q(col)} = valor LIMIT 100;`
  }
  function genOrderByColumn(t: { schema: string; table: ObjectInfo }, col: string) {
    return `-- ===== Ordenar por "${col}" =====\nSELECT * FROM ${q(t.schema)}.${q(t.table.name)} ORDER BY ${q(col)} ASC LIMIT 100;`
  }
  function genGroupByColumn(t: { schema: string; table: ObjectInfo }, col: string) {
    return `-- ===== Agrupar por "${col}" =====\nSELECT ${q(col)}, COUNT(*) AS total\nFROM ${q(t.schema)}.${q(t.table.name)}\nGROUP BY ${q(col)}\nORDER BY total DESC;`
  }

  // View generators
  function genViewSelectStar(v: { schema: string; view: ObjectInfo }) {
    return `-- ===== SELECT de la vista ${v.view.name} =====\nSELECT * FROM ${q(v.schema)}.${q(v.view.name)} LIMIT 100;`
  }
  function genViewSelectCount(v: { schema: string; view: ObjectInfo }) {
    return `-- ===== Contar registros en la vista ${v.view.name} =====\nSELECT COUNT(*) FROM ${q(v.schema)}.${q(v.view.name)};`
  }
  function genCreateView(v: { schema: string; view: ObjectInfo }) {
    const cols = v.view.columns.map(c => `  ${q(c.column_name)}`).join(',\n')
    return `-- ===== CREATE OR REPLACE vista ${v.view.name} =====\nCREATE OR REPLACE VIEW ${q(v.schema)}.${q(v.view.name)} AS\nSELECT\n${cols}\nFROM ${q(v.schema)}."nombre_tabla_origen"\nWHERE condición;`
  }
  function genDropView(v: { schema: string; view: ObjectInfo }) {
    return `-- ===== Eliminar vista ${v.view.name} =====\nDROP VIEW IF EXISTS ${q(v.schema)}.${q(v.view.name)};`
  }
  function genDescribeView(v: { schema: string; view: ObjectInfo }) {
    return `-- ===== Describir vista ${v.view.name} =====\nSELECT column_name, data_type, is_nullable\nFROM information_schema.columns\nWHERE table_schema = '${v.schema}' AND table_name = '${v.view.name}'\nORDER BY ordinal_position;`
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
          <FolderKanban size={14} className="flex-shrink-0 text-institutional-400" />
          <span className="flex-1 truncate text-left">{projectName || 'Sin proyecto'}</span>
          <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />
        </button>

        {switcherOpen && (
          <div className="absolute left-0 right-3 top-full mt-1 bg-surface-elevated border border-surface-border rounded shadow-lg z-50 max-h-80 overflow-y-auto animate-fade-in">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest flex items-center justify-between">
              <span>Proyectos de ejemplo</span>
              <div className="flex items-center gap-1">
                <button onClick={handleRefreshProjects} className="text-txt-dim hover:text-txt-body transition-colors" title="Refrescar proyectos">
                  <RefreshCw size={12} />
                </button>
                {adminToken && (
                  <button onClick={handleAddProject} className="text-txt-dim hover:text-txt-body transition-colors" title="Agregar proyecto">
                    <Plus size={13} />
                  </button>
                )}
              </div>
            </div>
            {exampleProjects.map((p) => (
              <div key={p.name}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-txt-muted hover:bg-surface-hover cursor-pointer group transition-colors duration-100"
                onClick={() => { if (!editingProject) switchToProject(p.name) }}
              >
                <FolderKanban size={14} className="text-institutional-400 flex-shrink-0" />
                <span className="flex-1 truncate">{p.label}</span>
                {p.name === projectName && (
                  <Badge variant="pk">activo</Badge>
                )}
                {adminToken && !editingProject && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleEditProject(p) }} className="p-0.5 text-txt-dim hover:text-txt-body" title="Editar">
                      <Pencil size={11} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(p) }} className="p-0.5 text-txt-dim hover:text-red-400" title="Eliminar">
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {editingProject && (
              <div className="px-3 py-2 border-t border-surface-border space-y-2">
                <div className="text-[10px] font-semibold text-txt-dim uppercase tracking-wider">
                  {editingProject.name ? 'Editar proyecto' : 'Nuevo proyecto'}
                </div>
                <div>
                  <label className="text-[10px] text-txt-dim block mb-0.5">Label</label>
                  <input type="text" value={editingProject.label}
                    onChange={(e) => setEditingProject({ ...editingProject, label: e.target.value })}
                    className="w-full px-2 py-1 text-[11px] rounded border border-surface-border bg-surface text-txt-body focus:outline-none focus:border-institutional-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-txt-dim block mb-0.5">
                    {editingProject.name ? 'Archivo .sql (dejar vacío para mantener el actual)' : 'Archivo .sql'}
                  </label>
                  <input type="file" accept=".sql" ref={fileInputRef}
                    className="w-full text-[11px] text-txt-muted file:mr-2 file:py-1 file:px-2.5 file:border file:border-surface-border file:rounded file:text-[11px] file:bg-surface file:text-txt-body hover:file:bg-surface-hover"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSaveProject} disabled={!editingProject.label.trim()}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-institutional-600 text-white hover:bg-institutional-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <Save size={11} /> Guardar
                  </button>
                  <button onClick={() => { setEditingProject(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border border-surface-border text-txt-dim hover:text-txt-body transition-colors">
                    <X size={11} /> Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-surface-border my-1" />

            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Mis proyectos
            </div>
            {sessionProjects.filter(n => !exampleProjects.some(p => p.name === n) && !DEFAULT_PROJECTS.includes(n)).length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-gray-500">
                No hay proyectos en la sesión
              </div>
            ) : (
              sessionProjects.filter(n => !exampleProjects.some(p => p.name === n) && !DEFAULT_PROJECTS.includes(n)).map((name) => (
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
                              onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ target: { kind: 'table', schema: s.schema_name, table: t }, x: e.clientX, y: e.clientY }); setCtxSub(null) }}
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
                                  <div key={c.column_name} className="flex items-center gap-1 px-2 py-0.5 text-[11px] hover:bg-surface-hover/50 transition-colors duration-75"
                                    onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ target: { kind: 'column', schema: s.schema_name, table: t, column: c }, x: e.clientX, y: e.clientY }); setCtxSub(null) }}
                                  >
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
                              onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ target: { kind: 'view', schema: s.schema_name, view: v }, x: e.clientX, y: e.clientY }); setCtxSub(null) }}
                              className="flex items-center w-full text-left px-3 py-1 text-xs text-txt-muted hover:bg-surface-hover hover:border-l-2 hover:border-emerald-600/50 transition-colors duration-100 border-l-2 border-transparent"
                            >
                              {expanded.has(vKey) ? <ChevronDown size={10} className="mr-1.5 text-gray-500 flex-shrink-0" /> : <ChevronRight size={10} className="mr-1.5 text-gray-500 flex-shrink-0" />}
                              <Eye size={12} className="mr-1.5 text-emerald-500 flex-shrink-0" />
                              <span className="text-emerald-400">{v.name}</span>
                            </button>
                            {expanded.has(vKey) && (
                              <div className="ml-5 pl-2 border-l border-surface-border animate-fade-in">
                                {v.columns.map((c) => (
                                  <div key={c.column_name} className="flex items-center gap-1 px-2 py-0.5 text-[11px]"
                                    onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ target: { kind: 'column', schema: s.schema_name, table: v, column: c }, x: e.clientX, y: e.clientY }); setCtxSub(null) }}
                                  >
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

      {/* ── Context menu ─────────────────────────────────────── */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={ctxClose} />
          <div
            className="fixed z-50 min-w-[190px] rounded-lg border border-surface-border bg-surface-card shadow-xl py-1 text-xs"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            {ctxMenu.target.kind === 'table' && (() => {
              const t = ctxMenu.target
              return (<>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-txt-dim uppercase tracking-wider border-b border-surface-border mb-1">{t.table.name}</div>

                <CtxItem onClick={() => appendToActiveTab(genSelectStar(t))}>SELECT * (LIMIT 100)</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genSelectCount(t))}>SELECT COUNT(*)</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genSelectColumns(t))}>SELECT columnas</CtxItem>
                <div className="border-t border-surface-border my-1" />
                <CtxItem onClick={() => appendToActiveTab(genInsert(t))}>INSERT (template)</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genUpdate(t))}>UPDATE (template)</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genDelete(t))}>DELETE (template)</CtxItem>
                <div className="border-t border-surface-border my-1" />
                <CtxItem onClick={() => appendToActiveTab(genCreateTable(t))}>CREATE TABLE</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genDrop(t))}>DROP TABLE</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genTruncate(t))}>TRUNCATE</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genDescribe(t))}>DESCRIBE</CtxItem>
                <div className="border-t border-surface-border my-1" />
                <CtxSubItem label="ALTER ›" open={ctxSub?.startsWith('alter') ?? false} onEnter={() => setCtxSub('alter')}>
                  <CtxItem onClick={() => appendToActiveTab(genAlterAddCol(t))}>ADD COLUMN</CtxItem>
                  <CtxSubItem label="DROP COLUMN ›" open={ctxSub === 'alter-drop'} onEnter={() => setCtxSub('alter-drop')}>
                    {t.table.columns.map(c => (
                      <CtxItem key={c.column_name} onClick={() => appendToActiveTab(genAlterDropCol(t, c.column_name))}>{c.column_name}</CtxItem>
                    ))}
                  </CtxSubItem>
                  <CtxSubItem label="RENAME COLUMN ›" open={ctxSub === 'alter-rename'} onEnter={() => setCtxSub('alter-rename')}>
                    {t.table.columns.map(c => (
                      <CtxItem key={c.column_name} onClick={() => appendToActiveTab(genAlterRenameCol(t, c.column_name))}>{c.column_name}</CtxItem>
                    ))}
                  </CtxSubItem>
                  <CtxItem onClick={() => appendToActiveTab(genAlterRenameTable(t))}>RENAME TABLE</CtxItem>
                  <CtxSubItem label="ALTER TYPE ›" open={ctxSub === 'alter-type'} onEnter={() => setCtxSub('alter-type')}>
                    {t.table.columns.map(c => (
                      <CtxItem key={c.column_name} onClick={() => appendToActiveTab(genAlterColType(t, c.column_name))}>{c.column_name}</CtxItem>
                    ))}
                  </CtxSubItem>
                </CtxSubItem>
              </>)
            })()}

            {ctxMenu.target.kind === 'view' && (() => {
              const v = ctxMenu.target
              return (<>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-txt-dim uppercase tracking-wider border-b border-surface-border mb-1">{v.view.name}</div>
                <CtxItem onClick={() => appendToActiveTab(genViewSelectStar(v))}>SELECT * (LIMIT 100)</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genViewSelectCount(v))}>SELECT COUNT(*)</CtxItem>
                <div className="border-t border-surface-border my-1" />
                <CtxItem onClick={() => appendToActiveTab(genCreateView(v))}>CREATE OR REPLACE VIEW</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genDropView(v))}>DROP VIEW</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genDescribeView(v))}>DESCRIBE</CtxItem>
              </>)
            })()}

            {ctxMenu.target.kind === 'column' && (() => {
              const c = ctxMenu.target
              const t = { schema: c.schema, table: c.table }
              const colName = c.column.column_name
              return (<>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-txt-dim uppercase tracking-wider border-b border-surface-border mb-1">{c.table.name}.{colName}</div>
                <CtxItem onClick={() => appendToActiveTab(genSelectColumn(t, colName))}>SELECT columna</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genWhereColumn(t, colName))}>WHERE condición</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genOrderByColumn(t, colName))}>ORDER BY</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genGroupByColumn(t, colName))}>GROUP BY</CtxItem>
                <div className="border-t border-surface-border my-1" />
                <CtxItem onClick={() => appendToActiveTab(genAlterDropCol(t, colName))}>ALTER… DROP COLUMN</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genAlterRenameCol(t, colName))}>ALTER… RENAME COLUMN</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genAlterColType(t, colName))}>ALTER… TYPE</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genSetNotNull(t, colName))}>SET NOT NULL</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genDropNotNull(t, colName))}>DROP NOT NULL</CtxItem>
                <CtxItem onClick={() => appendToActiveTab(genSetDefault(t, colName))}>SET DEFAULT</CtxItem>
              </>)
            })()}
          </div>
        </>
      )}

    </div>
  )
}
