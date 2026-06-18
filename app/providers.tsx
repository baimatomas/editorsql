'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { PGlite } from '@electric-sql/pglite'

interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

interface TableInfo {
  table_name: string
  columns: ColumnInfo[]
}

interface SavedQuery {
  id: string
  name: string
  sql: string
  createdAt: number
}

interface DBContextType {
  ready: boolean
  tables: TableInfo[]
  schemaError: string | null
  queryError: string | null
  queryResult: unknown[] | null
  loading: boolean
  runSchema: (sql: string) => Promise<void>
  runQuery: (sql: string) => Promise<void>
  savedQueries: SavedQuery[]
  saveQuery: (name: string, sql: string) => void
  deleteQuery: (id: string) => void
  queryTemplate: string | null
  loadQuery: (id: string) => void
  getDump: () => Promise<string>
}

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
  const [tables, setTables] = useState<TableInfo[]>([])
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [queryResult, setQueryResult] = useState<unknown[] | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [queryTemplate, setQueryTemplate] = useState<string | null>(null)
  const [restoreAttempted, setRestoreAttempted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(LS_SAVED)
    if (stored) {
      try { setSavedQueries(JSON.parse(stored)) } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_SAVED, JSON.stringify(savedQueries))
  }, [savedQueries])

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

  const refreshTables = useCallback(async (pglite: PGlite) => {
    try {
      const result = await pglite.query(`
        SELECT table_name, column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `)
      const rows = result.rows as Array<{
        table_name: string
        column_name: string
        data_type: string
        is_nullable: string
        column_default: string | null
      }>
      const map = new Map<string, ColumnInfo[]>()
      for (const row of rows) {
        if (!map.has(row.table_name)) map.set(row.table_name, [])
        map.get(row.table_name)!.push({
          column_name: row.column_name,
          data_type: row.data_type,
          is_nullable: row.is_nullable,
          column_default: row.column_default,
        })
      }
      const tbls: TableInfo[] = Array.from(map.entries()).map(
        ([table_name, columns]) => ({ table_name, columns })
      )
      setTables(tbls)
    } catch {
      setTables([])
    }
  }, [])

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

      // Build CREATE TABLE
      const colDefs = cols.map(c => {
        let def = `"${c.column_name}" ${c.data_type}`
        if (c.is_nullable === 'NO') def += ' NOT NULL'
        if (c.column_default !== null) def += ` DEFAULT ${c.column_default}`
        return def
      })
      if (pkCols.length > 0) {
        colDefs.push(`PRIMARY KEY (${pkCols.map(c => `"${c}"`).join(', ')})`)
      }

      dump += `DROP TABLE IF EXISTS "${name}" CASCADE;\n`
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
        await refreshTables(db)
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

      const trimmed = sql.trim()
      if (!trimmed) return

      const noComments = trimmed
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim()
      const firstWord = noComments.split(/\s+/)[0]?.toUpperCase()
      const allowed = ['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE']

      if (!allowed.includes(firstWord)) {
        setQueryError('Este panel solo permite consultas SELECT. Usá el panel Schema para modificar la base de datos.')
        return
      }

      setLoading(true)
      try {
        const result = await db.query(trimmed)
        setQueryResult(result.rows as unknown[])
        setLoading(false)
      } catch (e) {
        setQueryError((e as Error).message)
        setLoading(false)
      }
    },
    [db]
  )

  const saveQuery = useCallback((name: string, sql: string) => {
    setSavedQueries((prev) => [
      { id: crypto.randomUUID(), name, sql, createdAt: Date.now() },
      ...prev,
    ])
  }, [])

  const deleteQuery = useCallback((id: string) => {
    setSavedQueries((prev) => prev.filter((q) => q.id !== id))
  }, [])

  const loadQuery = useCallback((id: string) => {
    const q = savedQueries.find((q) => q.id === id)
    if (q) setQueryTemplate(q.sql)
  }, [savedQueries])

  // Auto-restore project data after PGlite initialization
  useEffect(() => {
    if (!db || !ready || restoreAttempted) return
    setRestoreAttempted(true)

    const flag = localStorage.getItem('editorsql_restore_flag')
    if (flag !== 'true') return

    const restore = async () => {
      try {
        // Execute saved data dump (DDL + INSERTs)
        const dump = localStorage.getItem('editorsql_restore_data')
        if (dump && dump.trim()) {
          await db.exec(dump)
        }
        await refreshTables(db)
        localStorage.removeItem('editorsql_restore_flag')
        localStorage.removeItem('editorsql_restore_data')
      } catch (e) {
        setSchemaError('Error al restaurar proyecto: ' + (e as Error).message)
        localStorage.removeItem('editorsql_restore_flag')
        localStorage.removeItem('editorsql_restore_data')
      }
    }

    restore()
  }, [db, ready, refreshTables, restoreAttempted])

  return (
    <DBContext.Provider
      value={{
        ready, tables, schemaError, queryError, queryResult, loading,
        runSchema, runQuery,
        savedQueries, saveQuery, deleteQuery,
        queryTemplate, loadQuery,
        getDump,
      }}
    >
      {children}
    </DBContext.Provider>
  )
}
