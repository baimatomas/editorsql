'use client'

export interface ProjectData {
  name: string
  schema: string
  query: string
  savedQueries: string
  dataDump: string
}

const SESSION_LIST = 'editorsql_session_list'
const SESSION_PREFIX = 'editorsql_session_'
const DIRTY = 'editorsql_dirty'

export function getSessionProjects(): string[] {
  try {
    const raw = localStorage.getItem(SESSION_LIST)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveSessionProject(name: string, data: ProjectData): void {
  try {
    localStorage.setItem(SESSION_PREFIX + name, JSON.stringify(data))
    const list = getSessionProjects()
    if (!list.includes(name)) {
      list.push(name)
      localStorage.setItem(SESSION_LIST, JSON.stringify(list))
    }
  } catch { /* quota */ }
}

export function removeSessionProject(name: string): void {
  try {
    localStorage.removeItem(SESSION_PREFIX + name)
    localStorage.removeItem('editorsql_project_' + name)
    const list = getSessionProjects().filter(n => n !== name)
    localStorage.setItem(SESSION_LIST, JSON.stringify(list))
  } catch { /* ignore */ }
}

export function getSessionProjectData(name: string): ProjectData | null {
  try {
    const raw = localStorage.getItem(SESSION_PREFIX + name)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setDirty(): void {
  try { localStorage.setItem(DIRTY, '1') } catch {}
}

export function clearDirty(): void {
  try { localStorage.setItem(DIRTY, '0') } catch {}
}

export function isDirty(): boolean {
  return localStorage.getItem(DIRTY) === '1'
}

export function migrateOldProjects(): void {
  const existing = getSessionProjects()
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('editorsql_project_')) {
      const name = key.slice('editorsql_project_'.length)
      if (!existing.includes(name)) {
        try {
          const raw = localStorage.getItem(key)
          if (raw) {
            const d = JSON.parse(raw)
            saveSessionProject(name, {
              name,
              schema: d.schema ?? '',
              query: d.query ?? '',
              savedQueries: d.savedQueries ?? '[]',
              dataDump: d.dataDump ?? '',
            })
          }
        } catch { /* ignore malformed entries */ }
      }
    }
  }
}

export async function promptSaveIfDirty(getDump: () => Promise<string>): Promise<boolean> {
  if (!isDirty()) return true

  const { default: Swal } = await import('sweetalert2')

  const confirmResult = await Swal.fire({
    title: '¿Querés guardar los cambios?',
    text: 'Tenés cambios sin guardar en un archivo.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Descartar',
    reverseButtons: true,
    background: '#2d2d2d',
    color: '#d4d4d4',
    confirmButtonColor: '#0e639c',
    cancelButtonColor: '#6c6c6c',
  })
  if (!confirmResult.isConfirmed) return true // discard

  let name = localStorage.getItem('editorsql_current_project')
  if (!name) {
    const promptResult = await Swal.fire({
      title: 'Nombre del proyecto',
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
    if (!promptResult.isConfirmed || !promptResult.value?.trim()) return false
    name = promptResult.value.trim()
  }
  if (!name) return false
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
  if (!ok) return false // user cancelled file dialog

  saveSessionProject(trimmed, data)
  localStorage.setItem('editorsql_current_project', trimmed)
  clearDirty()
  return true
}

export async function saveProjectFile(name: string, data: string): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${name}.json`,
        types: [{ accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(data)
      await writable.close()
      return true
    }
  } catch (e: any) {
    if (e.name === 'AbortError') return false
  }

  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export async function openProjectFile(): Promise<ProjectData | null> {
  let file: File | null = null

  try {
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ accept: { 'application/json': ['.json'] } }],
        multiple: false,
      })
      file = await handle.getFile()
    }
  } catch (e: any) {
    if (e.name === 'AbortError') return null
  }

  if (!file) {
    file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = () => resolve(input.files?.[0] ?? null)
      input.click()
      setTimeout(() => resolve(null), 30000)
    })
    if (!file) return null
  }

  const text = await file.text()
  const parsed = JSON.parse(text)
  return {
    name: parsed.name || file.name.replace(/\.json$/i, ''),
    schema: parsed.schema ?? '',
    query: parsed.query ?? '',
    savedQueries: parsed.savedQueries ?? '[]',
    dataDump: parsed.dataDump ?? '',
  }
}
