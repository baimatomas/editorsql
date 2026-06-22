'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { PGlite } from '@electric-sql/pglite'
import { setDirty, getSessionProjectData } from '@/app/lib/projectFiles'

export interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
  is_primary_key?: boolean
}

export interface ForeignKeyInfo {
  column_name: string
  foreign_table_schema: string
  foreign_table_name: string
  foreign_column_name: string
}

export interface ObjectInfo {
  name: string
  columns: ColumnInfo[]
  foreignKeys?: ForeignKeyInfo[]
}

interface FuncInfo {
  name: string
  return_type: string | null
}

export interface SchemaInfo {
  schema_name: string
  tables: ObjectInfo[]
  views: ObjectInfo[]
  functions: FuncInfo[]
}

export interface QueryTab {
  id: string
  name: string
  sql: string
}

interface SavedQuery {
  id: string
  name: string
  sql: string
  createdAt: number
}

interface DBContextType {
  ready: boolean
  schemas: SchemaInfo[]
  schemaError: string | null
  queryError: string | null
  queryResult: unknown[] | null
  queryTime: number | null
  loading: boolean
  runSchema: (sql: string) => Promise<void>
  runQuery: (sql: string) => Promise<void>
  savedQueries: SavedQuery[]
  saveQuery: (name: string, sql: string) => void
  deleteQuery: (id: string) => void
  queryTabs: QueryTab[]
  activeTabId: string
  addQueryTab: (name?: string, sql?: string) => string
  closeQueryTab: (id: string) => void
  renameQueryTab: (id: string, name: string) => void
  setActiveTabId: (id: string) => void
  setQueryTabSQL: (id: string, sql: string) => void
  getDump: () => Promise<string>
  refreshTables: () => Promise<void>
  totalRowCount: number
  currentPage: number
  pageSize: number
  setPage: (page: number) => void
}

export const DEFAULT_PROJECTS = ['northwind', 'dvdrental']
const LS_SAVED = 'editorsql_saved_queries'

const DBContext = createContext<DBContextType | null>(null)

export function useDB() {
  const ctx = useContext(DBContext)
  if (!ctx) throw new Error('useDB must be used within DBProvider')
  return ctx
}

export function DBProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<PGlite | null>(null)
  const [ready, setReady] = useState(false)
  const [schemas, setSchemas] = useState<SchemaInfo[]>([])
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [queryResult, setQueryResult] = useState<unknown[] | null>(null)
  const [queryTime, setQueryTime] = useState<number | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const PAGE_SIZE = 1000
  const [totalRowCount, setTotalRowCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const execSqlRef = useRef('')
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [queryTabs, setQueryTabs] = useState<QueryTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [restoreAttempted, setRestoreAttempted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(LS_SAVED)
    if (stored) {
      try { setSavedQueries(JSON.parse(stored)) } catch { /* ignore */ }
    }
  }, [])

  // Load query tabs from localStorage, migrating from old single-query format
  useEffect(() => {
    const stored = localStorage.getItem('editorsql_query_tabs')
    if (stored) {
      try {
        const tabs = JSON.parse(stored) as QueryTab[]
        if (tabs.length > 0) {
          setQueryTabs(tabs)
          const activeId = localStorage.getItem('editorsql_active_tab_id')
          if (activeId && tabs.some(t => t.id === activeId)) {
            setActiveTabId(activeId)
          } else {
            setActiveTabId(tabs[0].id)
          }
          return
        }
      } catch { /* ignore */ }
    }
    // Migrate from old single query
    const oldQuery = localStorage.getItem('editorsql_query')
    const defaultTab: QueryTab = {
      id: crypto.randomUUID(),
      name: 'Query1',
      sql: oldQuery ?? '-- Ejecutá las consultas con Ctrl + Enter\n',
    }
    setQueryTabs([defaultTab])
    setActiveTabId(defaultTab.id)
    try { localStorage.setItem('editorsql_query_tabs', JSON.stringify([defaultTab])) } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(LS_SAVED, JSON.stringify(savedQueries)) } catch {}
  }, [savedQueries])

  useEffect(() => {
    try { localStorage.setItem('editorsql_query_tabs', JSON.stringify(queryTabs)) } catch {}
  }, [queryTabs])

  useEffect(() => {
    if (activeTabId) try { localStorage.setItem('editorsql_active_tab_id', activeTabId) } catch {}
  }, [activeTabId])

  useEffect(() => {
    const init = async () => {
      try {
        const pglite = new PGlite()
        setDb(pglite)
        setReady(true)
      } catch (e) {
        setSchemaError('Error al inicializar PGlite: ' + (e as Error).message)
      }
    }
    init()
  }, [])

  const refreshTables = useCallback(async () => {
    if (!db) return
    try {
      const objectsResult = await db.query(`
        SELECT c.table_schema, c.table_name, c.column_name, c.data_type,
               c.is_nullable, c.column_default, t.table_type
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON c.table_schema = t.table_schema AND c.table_name = t.table_name
        WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY c.table_schema, t.table_type DESC, c.table_name, c.ordinal_position
      `)
      const objRows = objectsResult.rows as Array<{
        table_schema: string
        table_name: string
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string | null
        table_type: string
      }>

      let pkRows: Array<{ table_schema: string; table_name: string; column_name: string }> = []
      try {
        const pkResult = await db.query(`
          SELECT tc.table_schema, tc.table_name, kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
        `)
        pkRows = pkResult.rows as typeof pkRows
      } catch { /* ignore */ }

      let fkRows: Array<{
        table_schema: string
        table_name: string
        column_name: string
        foreign_table_schema: string
        foreign_table_name: string
        foreign_column_name: string
      }> = []
      try {
        const fkResult = await db.query(`
          SELECT tc.table_schema, tc.table_name, kcu.column_name,
                 ccu.table_schema AS foreign_table_schema,
                 ccu.table_name AS foreign_table_name,
                 ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
           AND ccu.constraint_schema = tc.constraint_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
        `)
        fkRows = fkResult.rows as typeof fkRows
      } catch { /* ignore */ }

      const pkSet = new Set(pkRows.map(r => `${r.table_schema}.${r.table_name}.${r.column_name}`))
      const fkMap = new Map<string, ForeignKeyInfo[]>()
      for (const fk of fkRows) {
        const key = `${fk.table_schema}.${fk.table_name}`
        if (!fkMap.has(key)) fkMap.set(key, [])
        fkMap.get(key)!.push({
          column_name: fk.column_name,
          foreign_table_schema: fk.foreign_table_schema,
          foreign_table_name: fk.foreign_table_name,
          foreign_column_name: fk.foreign_column_name,
        })
      }

      const schemaMap = new Map<string, {
        tables: Map<string, ColumnInfo[]>
        views: Map<string, ColumnInfo[]>
      }>()

      for (const row of objRows) {
        if (!schemaMap.has(row.table_schema)) {
          schemaMap.set(row.table_schema, { tables: new Map(), views: new Map() })
        }
        const s = schemaMap.get(row.table_schema)!
        const target = row.table_type === 'VIEW' ? s.views : s.tables
        if (!target.has(row.table_name)) target.set(row.table_name, [])
        target.get(row.table_name)!.push({
          column_name: row.column_name,
          data_type: row.data_type,
          is_nullable: row.is_nullable,
          column_default: row.column_default,
          is_primary_key: pkSet.has(`${row.table_schema}.${row.table_name}.${row.column_name}`),
        })
      }

      let funcRows: Array<{ specific_schema: string; routine_name: string; data_type: string | null }> = []
      try {
        const funcResult = await db.query(`
          SELECT specific_schema, routine_name, data_type
          FROM information_schema.routines
          WHERE specific_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          ORDER BY specific_schema, routine_name
        `)
        funcRows = funcResult.rows as typeof funcRows
      } catch { /* routines table might not be available in some PGlite builds */ }

      const result: SchemaInfo[] = Array.from(schemaMap.entries()).map(([schema_name, data]) => ({
        schema_name,
        tables: Array.from(data.tables.entries()).map(([name, columns]) => ({
          name,
          columns,
          foreignKeys: fkMap.get(`${schema_name}.${name}`) ?? [],
        })),
        views: Array.from(data.views.entries()).map(([name, columns]) => ({ name, columns })),
        functions: funcRows
          .filter(r => r.specific_schema === schema_name)
          .map(r => ({ name: r.routine_name, return_type: r.data_type })),
      }))

      if (!result.some(s => s.schema_name === 'public')) {
        result.push({ schema_name: 'public', tables: [], views: [], functions: [] })
      }

      setSchemas(result)
    } catch (e) {
      console.error('refreshTables error:', e)
      setSchemas([])
    }
  }, [db])

  const getDump = useCallback(async (): Promise<string> => {
    if (!db) return ''

    const tablesResult = await db.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    )
    const tableNames = (tablesResult.rows as Array<{ table_name: string }>).map(r => r.table_name)

    let dump = ''

    const formatValue = (v: unknown): string => {
      if (v === null || v === undefined) return 'NULL'
      if (typeof v === 'number') return String(v)
      if (typeof v === 'boolean') return String(v)
      if (v instanceof Date) return `'${v.toISOString()}'`
      return `'${String(v).replace(/'/g, "''")}'`
    }

    for (const name of tableNames) {
      // Column definitions
      const colResult = await db.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [name]
      )
      const cols = colResult.rows as Array<{
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string | null
      }>

      // Primary key columns
      const pkResult = await db.query(
        `SELECT kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         WHERE tc.table_schema = 'public'
           AND tc.table_name = $1
           AND tc.constraint_type = 'PRIMARY KEY'
         ORDER BY kcu.ordinal_position`,
        [name]
      )
      const pkCols = (pkResult.rows as Array<{ column_name: string }>).map(r => r.column_name)

      // Build CREATE TABLE with serial column sequence support
      const serialCols = cols.filter(c => c.column_default?.includes('nextval('))
      dump += `DROP TABLE IF EXISTS "${name}" CASCADE;\n`
      for (const sc of serialCols) {
        const m = sc.column_default!.match(/nextval\('([^']+)'/)
        if (m) dump += `CREATE SEQUENCE IF NOT EXISTS ${m[1]};\n`
      }

      const colDefs = cols.map(c => {
        let def = `"${c.column_name}" ${c.data_type}`
        if (c.is_nullable === 'NO') def += ' NOT NULL'
        if (c.column_default !== null) def += ` DEFAULT ${c.column_default}`
        return def
      })
      if (pkCols.length > 0) {
        colDefs.push(`PRIMARY KEY (${pkCols.map(c => `"${c}"`).join(', ')})`)
      }

      dump += `CREATE TABLE "${name}" (\n  ${colDefs.join(',\n  ')}\n);\n`

      // Data
      const dataResult = await db.query(`SELECT * FROM "${name}"`)
      const rows = dataResult.rows as Record<string, unknown>[]
      if (rows.length === 0) continue

      const colNames = cols.map(c => c.column_name)
      const colList = colNames.map(c => `"${c}"`).join(', ')

      for (const row of rows) {
        const vals = colNames.map(c => formatValue(row[c]))
        dump += `INSERT INTO "${name}" (${colList}) VALUES (${vals.join(', ')});\n`
      }
    }

    // Foreign key constraints (después de todas las tablas, sin orden de dependencia)
    const fkResult = await db.query(
      `SELECT tc.table_name, kcu.column_name,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
       WHERE tc.table_schema = 'public'
         AND tc.constraint_type = 'FOREIGN KEY'
       ORDER BY tc.table_name, kcu.ordinal_position`
    )
    const fkRows = fkResult.rows as Array<{
      table_name: string
      column_name: string
      foreign_table_name: string
      foreign_column_name: string
    }>
    for (const fk of fkRows) {
      dump += `ALTER TABLE "${fk.table_name}" ADD FOREIGN KEY ("${fk.column_name}") REFERENCES "${fk.foreign_table_name}" ("${fk.foreign_column_name}");\n`
    }

    return dump
  }, [db])

  const runSchema = useCallback(
    async (sql: string) => {
      if (!db) return
      setSchemaError(null)
      setQueryResult(null)
      setQueryError(null)
      try {
        await db.exec(sql)
        await refreshTables()
      } catch (e) {
        setSchemaError((e as Error).message)
      }
    },
    [db, refreshTables]
  )

  const runQuery = useCallback(
    async (sql: string) => {
      if (!db) return
      setQueryError(null)
      setQueryResult(null)
      setQueryTime(null)
      setCurrentPage(0)

      const trimmed = sql.trim()
      if (!trimmed) return

      const noComments = trimmed
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim()
      const firstWord = noComments.split(/\s+/)[0]?.toUpperCase()
      const isQuery = ['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE'].includes(firstWord)

      setLoading(true)
      const start = performance.now()
      try {
        if (isQuery) {
          execSqlRef.current = trimmed

          let total = 0
          try {
            const cnt = await db.query(`SELECT COUNT(*) AS cnt FROM (${trimmed}) AS _p`)
            total = Number((cnt.rows[0] as Record<string, unknown>).cnt)
          } catch {
            total = 0
          }
          setTotalRowCount(total)

          const result = await db.query(`${trimmed} LIMIT ${PAGE_SIZE} OFFSET 0`)
          setQueryResult(result.rows as unknown[])
        } else {
          execSqlRef.current = ''
          setTotalRowCount(0)
          await db.exec(trimmed)
          setQueryResult([])
          await refreshTables()
        }
        setQueryTime(performance.now() - start)
        setLoading(false)
      } catch (e) {
        setQueryTime(performance.now() - start)
        setQueryError((e as Error).message)
        setLoading(false)
      }
    },
    [db, refreshTables]
  )

  const setPage = useCallback(async (page: number) => {
    if (!db || !execSqlRef.current) return
    setQueryError(null)
    setLoading(true)
    const start = performance.now()
    try {
      const result = await db.query(`${execSqlRef.current} LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}`)
      setQueryResult(result.rows as unknown[])
      setCurrentPage(page)
      setQueryTime(performance.now() - start)
      setLoading(false)
    } catch (e) {
      setQueryTime(performance.now() - start)
      setQueryError((e as Error).message)
      setLoading(false)
    }
  }, [db])

  const saveQuery = useCallback((name: string, sql: string) => {
    setSavedQueries((prev) => [
      { id: crypto.randomUUID(), name, sql, createdAt: Date.now() },
      ...prev,
    ])
    setDirty()
  }, [])

  const deleteQuery = useCallback((id: string) => {
    setSavedQueries((prev) => prev.filter((q) => q.id !== id))
    setDirty()
  }, [])

  // Track latest queryTabs + activeTabId via refs for use inside callbacks
  const queryTabsRef = useRef(queryTabs)
  queryTabsRef.current = queryTabs
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId

  const addQueryTab = useCallback((name?: string, sql?: string) => {
    const id = crypto.randomUUID()
    let maxNum = 0
    for (const tab of queryTabsRef.current) {
      const m = tab.name.match(/^Query(\d+)$/)
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
    }
    const newTab: QueryTab = {
      id,
      name: name ?? `Query${maxNum + 1}`,
      sql: sql ?? '-- Ejecutá las consultas con Ctrl + Enter\n',
    }
    setQueryTabs((prev) => [...prev, newTab])
    setActiveTabId(id)
    setDirty()
    return id
  }, [])

  const closeQueryTab = useCallback((id: string) => {
    setQueryTabs((prev) => {
      if (prev.length === 0) return prev
      const idx = prev.findIndex((t) => t.id === id)
      if (idx === -1) return prev
      const next = prev.filter((t) => t.id !== id)
      setDirty()
      if (next.length === 0) {
        const defaultTab: QueryTab = {
          id: crypto.randomUUID(),
          name: 'Query1',
          sql: '-- Ejecutá las consultas con Ctrl + Enter\n',
        }
        setActiveTabId(defaultTab.id)
        return [defaultTab]
      }
      if (id === activeTabIdRef.current) {
        const newIdx = Math.min(idx, next.length - 1)
        setActiveTabId(next[newIdx].id)
      }
      return next
    })
  }, [])

  const setQueryTabSQL = useCallback((id: string, sql: string) => {
    setQueryTabs((prev) => prev.map((t) => (t.id === id ? { ...t, sql } : t)))
    setDirty()
  }, [])

  const renameQueryTab = useCallback((id: string, name: string) => {
    setQueryTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)))
    setDirty()
  }, [])

  // Auto-restore project data after PGlite initialization
  useEffect(() => {
    if (!db || !ready || restoreAttempted) return
    setRestoreAttempted(true)

    const dumpFlag = localStorage.getItem('editorsql_restore_flag')
    const defaultFlag = localStorage.getItem('editorsql_load_default')

    if (dumpFlag !== 'true' && !defaultFlag) {
      let currentProject = localStorage.getItem('editorsql_current_project')
      // On first visit or when a default project doesn't have its SQL loaded (e.g. page reload), reload it
      if (!currentProject) {
        const hint = '-- Proyecto: northwind\n-- Base de datos cargada desde archivo\n-- Usá este panel para crear y modificar tablas (CREATE TABLE, INSERT, ALTER, etc.)'
        localStorage.setItem('editorsql_load_default', 'northwind')
        localStorage.setItem('editorsql_current_project', 'northwind')
        localStorage.setItem('editorsql_schema', hint)
        localStorage.setItem('editorsql_query_tabs', JSON.stringify([{ id: crypto.randomUUID(), name: 'Query1', sql: '-- Ejecutá las consultas con Ctrl + Enter\n' }]))
        localStorage.setItem('editorsql_saved_queries', '[]')
        location.reload()
      } else if (DEFAULT_PROJECTS.includes(currentProject)) {
        // Returning to a default project — re-load its SQL
        localStorage.setItem('editorsql_load_default', currentProject)
        const hint = `-- Proyecto: ${currentProject}\n-- Base de datos cargada desde archivo\n-- Usá este panel para crear y modificar tablas (CREATE TABLE, INSERT, ALTER, etc.)`
        localStorage.setItem('editorsql_schema', hint)
        localStorage.setItem('editorsql_query_tabs', JSON.stringify([{ id: crypto.randomUUID(), name: 'Query1', sql: '-- Ejecutá las consultas con Ctrl + Enter\n' }]))
        localStorage.setItem('editorsql_saved_queries', '[]')
        location.reload()
      } else {
        // Restore user project data from session cache
        const sessionData = getSessionProjectData(currentProject)
        const doRestore = async () => {
          if (sessionData?.dataDump) {
            try {
              await db.exec(sessionData.dataDump)
            } catch (e) {
              console.error('session restore error:', e)
            }
          }
          await refreshTables()
        }
        doRestore()
      }
      return
    }

    const restore = async () => {
      try {
        if (dumpFlag === 'true') {
          const dump = localStorage.getItem('editorsql_restore_data')
          if (dump && dump.trim()) {
            await db.exec(dump)
          }
          localStorage.removeItem('editorsql_restore_flag')
          localStorage.removeItem('editorsql_restore_data')
          localStorage.removeItem('editorsql_load_default')
        } else if (defaultFlag) {
          const res = await fetch(`/projects/${defaultFlag}.sql`)
          if (!res.ok) throw new Error(`No se pudo descargar ${defaultFlag}.sql`)
          const sql = await res.text()
          await db.exec(sql)
          localStorage.removeItem('editorsql_load_default')
        }
        await refreshTables()
      } catch (e) {
        console.error('restore error:', e)
        setSchemaError('Error al restaurar proyecto: ' + (e as Error).message)
        import('sweetalert2').then(({ default: Swal }) => {
          Swal.fire({
            icon: 'error',
            title: 'Error al restaurar proyecto',
            text: (e as Error).message,
            confirmButtonText: 'OK',
            background: '#2d2d2d',
            color: '#d4d4d4',
            confirmButtonColor: '#0e639c',
          })
        })
        localStorage.removeItem('editorsql_restore_flag')
        localStorage.removeItem('editorsql_restore_data')
        localStorage.removeItem('editorsql_load_default')
      }
    }

    restore()
  }, [db, ready, refreshTables, restoreAttempted])

  return (
    <DBContext.Provider
      value={{
        ready, schemas, schemaError, queryError, queryResult, queryTime, loading,
        runSchema, runQuery,
        savedQueries, saveQuery, deleteQuery,
        queryTabs, activeTabId, addQueryTab, closeQueryTab, renameQueryTab, setActiveTabId, setQueryTabSQL,
        getDump, refreshTables,
        totalRowCount, currentPage, pageSize: PAGE_SIZE, setPage,
      }}
    >
      {children}
    </DBContext.Provider>
  )
}
