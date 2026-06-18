'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { PGlite } from '@electric-sql/pglite'

interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

interface ObjectInfo {
  name: string
  columns: ColumnInfo[]
}

interface FuncInfo {
  name: string
  return_type: string | null
}

interface SchemaInfo {
  schema_name: string
  tables: ObjectInfo[]
  views: ObjectInfo[]
  functions: FuncInfo[]
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

export const DEFAULT_SCHEMA = `-- Tabla de estudiantes
CREATE TABLE estudiantes (
    id_estudiante   SERIAL PRIMARY KEY,
    nombre          VARCHAR(50)  NOT NULL,
    apellido        VARCHAR(50)  NOT NULL,
    email           VARCHAR(100),
    cuil            VARCHAR(20),
    ciudad          VARCHAR(50),
    fecha_registro  DATE         NOT NULL
);

INSERT INTO estudiantes (nombre, apellido, email, cuil, ciudad, fecha_registro) VALUES
('Mateo',     'González',  'mateo.gonzalez@email.com',     '20-35421876-4', 'Buenos Aires', '2023-03-15'),
('Valentina', 'Rodríguez', NULL,                           '27-28934521-7', 'Córdoba',      '2023-07-22'),
('Santiago',  'Fernández', 'santiago.fernandez@email.com', '20-41256734-2', 'Rosario',      '2024-01-08'),
('Lucía',     'López',     'lucia.lopez@email.com',        '27-39812345-1', NULL,           '2024-02-14'),
('Rodrigo',   'Torres',    'rodrigo.torres@email.com',     '20-44123678-5', 'Buenos Aires', '2024-10-03'),
('Agustina',  'Herrera',   'agustina.herrera@email.com',   '27-36754321-8', 'Rosario',      '2024-08-17'),
('Facundo',   'Castro',    NULL,                           '20-42987654-3', 'Mendoza',      '2024-07-29'),
('Daniela',   'Medina',    'daniela.medina@email.com',     '27-40123456-6', 'Córdoba',      '2024-06-11'),
('Carla',     'Suárez',    'carla.suarez@email.com',       '27-45678901-2', 'Buenos Aires', '2024-11-20'),
('Ignacio',   'García',    'ignacio.garcia@email.com',     '20-38765432-9', 'Mendoza',      '2023-11-05'),
('Florencia', 'García',    NULL,                           '27-37654321-0', 'Rosario',      '2023-09-18'),
('Tomás',     'Garcé',     'tomas.garce@email.com',        '20-43219876-7', 'Buenos Aires', '2024-05-30'),
('Nicolás',   'Vargas',    'nicolas.vargas@email.com',     '20-41876543-4', 'Córdoba',      '2024-04-18'),
('Camila',    'Ríos',      'camila.rios@email.com',        '27-44321098-1', NULL,           '2024-03-07'),
('Leandro',   'Álvarez',   NULL,                           '20-33167842-9', 'Buenos Aires', '2023-05-30');

-- Tabla de cursos
CREATE TABLE cursos (
    id_curso        SERIAL PRIMARY KEY,
    titulo          VARCHAR(100) NOT NULL,
    categoria       VARCHAR(50)  NOT NULL,
    precio          NUMERIC(10,2),
    duracion_horas  INTEGER
);

INSERT INTO cursos (titulo, categoria, precio, duracion_horas) VALUES
('Introducci\u00f3n a la Estad\u00edstica', 'Estad\u00edstica',      4200.00, 30),
('Estad\u00edstica Inferencial',       'Estad\u00edstica',      6200.00, 60),
('Python para Datos',             'Programaci\u00f3n',     5800.00, 50),
('R para An\u00e1lisis de Datos',      'Programaci\u00f3n',     5200.00, 45),
('SQL desde Cero',                'Bases de Datos',   4800.00, 35),
('Dise\u00f1o de Bases de Datos',      'Bases de Datos',   6500.00, 55),
('Machine Learning Aplicado',     'Machine Learning', 8900.00, 80),
('Redes Neuronales',              'Machine Learning', 9500.00, 90),
('Visualizaci\u00f3n con Tableau',     'Visualizaci\u00f3n',    5000.00, 40),
('SQL desde cero para datos',     'Bases de Datos',   4500.00, 35);`

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
    try { localStorage.setItem(LS_SAVED, JSON.stringify(savedQueries)) } catch {}
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
      // Get tables and views with column info and type
      const objectsResult = await pglite.query(`
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

      // Group by schema
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
        })
      }

      // Get functions
      let funcRows: Array<{ specific_schema: string; routine_name: string; data_type: string | null }> = []
      try {
        const funcResult = await pglite.query(`
          SELECT specific_schema, routine_name, data_type
          FROM information_schema.routines
          WHERE specific_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          ORDER BY specific_schema, routine_name
        `)
        funcRows = funcResult.rows as typeof funcRows
      } catch { /* routines table might not be available in some PGlite builds */ }

      // Build schema array
      const result: SchemaInfo[] = Array.from(schemaMap.entries()).map(([schema_name, data]) => ({
        schema_name,
        tables: Array.from(data.tables.entries()).map(([name, columns]) => ({ name, columns })),
        views: Array.from(data.views.entries()).map(([name, columns]) => ({ name, columns })),
        functions: funcRows
          .filter(r => r.specific_schema === schema_name)
          .map(r => ({ name: r.routine_name, return_type: r.data_type })),
      }))

      setSchemas(result)
    } catch {
      setSchemas([])
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

    const dumpFlag = localStorage.getItem('editorsql_restore_flag')
    const defaultFlag = localStorage.getItem('editorsql_load_default')

    if (dumpFlag !== 'true' && !defaultFlag) return

    const restore = async () => {
      try {
        if (dumpFlag === 'true') {
          const dump = localStorage.getItem('editorsql_restore_data')
          if (dump && dump.trim()) {
            await db.exec(dump)
          }
          localStorage.removeItem('editorsql_restore_flag')
          localStorage.removeItem('editorsql_restore_data')
        } else if (defaultFlag) {
          const res = await fetch(`/projects/${defaultFlag}.sql`)
          if (!res.ok) throw new Error(`No se pudo descargar ${defaultFlag}.sql`)
          const sql = await res.text()
          await db.exec(sql)
          localStorage.removeItem('editorsql_load_default')
        }
        await refreshTables(db)
      } catch (e) {
        setSchemaError('Error al restaurar proyecto: ' + (e as Error).message)
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
        ready, schemas, schemaError, queryError, queryResult, loading,
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
