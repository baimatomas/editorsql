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

interface DBContextType {
  ready: boolean
  tables: TableInfo[]
  schemaError: string | null
  queryError: string | null
  queryResult: unknown[] | null
  loading: boolean
  runSchema: (sql: string) => Promise<void>
  runQuery: (sql: string) => Promise<void>
}

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
      setLoading(true)
      try {
        const result = await db.query(sql)
        setQueryResult(result.rows as unknown[])
        setLoading(false)
      } catch (e) {
        setQueryError((e as Error).message)
        setLoading(false)
      }
    },
    [db]
  )

  return (
    <DBContext.Provider
      value={{ ready, tables, schemaError, queryError, queryResult, loading, runSchema, runQuery }}
    >
      {children}
    </DBContext.Provider>
  )
}
