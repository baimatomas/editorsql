'use client'

import { useMemo } from 'react'
import { useDB, type ObjectInfo } from '@/app/providers'

const BOX_WIDTH = 230
const HEADER_HEIGHT = 30
const ROW_HEIGHT = 24
const GAP_X = 90
const GAP_Y = 70
const COLS = 3

export default function DERViewer() {
  const { schemas, refreshTables } = useDB()

  const tables = useMemo(() => {
    return schemas.flatMap((schema) =>
      schema.tables.map((table) => ({
        ...table,
        schema: schema.schema_name,
        key: `${schema.schema_name}.${table.name}`,
      }))
    )
  }, [schemas])

  const layout = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; height: number; table: ObjectInfo & { schema: string; key: string } }>()

    tables.forEach((table, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const height = HEADER_HEIGHT + Math.max(table.columns.length, 1) * ROW_HEIGHT + 12
      positions.set(table.key, {
        x: 40 + col * (BOX_WIDTH + GAP_X),
        y: 40 + row * (220 + GAP_Y),
        height,
        table,
      })
    })

    return positions
  }, [tables])

  const width = Math.max(900, Math.min(COLS, Math.max(tables.length, 1)) * (BOX_WIDTH + GAP_X) + 80)
  const rows = Math.max(1, Math.ceil(tables.length / COLS))
  const height = Math.max(520, rows * (220 + GAP_Y) + 80)

  const edges = tables.flatMap((table) =>
    (table.foreignKeys ?? []).map((fk) => ({
      from: table.key,
      to: `${fk.foreign_table_schema}.${fk.foreign_table_name}`,
      column: fk.column_name,
      targetColumn: fk.foreign_column_name,
    }))
  ).filter((edge) => layout.has(edge.from) && layout.has(edge.to))

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c] flex-shrink-0">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">DER</span>
        <button
          onClick={refreshTables}
          className="px-3 py-0.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded font-medium"
        >
          Refrescar DER
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {tables.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No hay tablas para diagramar todavía.
          </div>
        ) : (
          <svg width={width} height={height} className="min-w-full min-h-full">
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#7c3aed" />
              </marker>
            </defs>

            {edges.map((edge, i) => {
              const from = layout.get(edge.from)!
              const to = layout.get(edge.to)!
              const startX = from.x + BOX_WIDTH
              const startY = from.y + HEADER_HEIGHT + ROW_HEIGHT
              const endX = to.x
              const endY = to.y + HEADER_HEIGHT + ROW_HEIGHT
              const midX = startX + (endX - startX) / 2
              return (
                <g key={`${edge.from}:${edge.column}:${i}`}>
                  <path
                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth="1.5"
                    markerEnd="url(#arrow)"
                    opacity="0.85"
                  />
                  <text x={midX + 4} y={(startY + endY) / 2 - 4} fill="#a78bfa" fontSize="10">
                    {edge.column} → {edge.targetColumn}
                  </text>
                </g>
              )
            })}

            {Array.from(layout.values()).map(({ x, y, height: boxHeight, table }) => (
              <g key={table.key}>
                <rect x={x} y={y} width={BOX_WIDTH} height={boxHeight} rx="6" fill="#252526" stroke="#3c3c3c" />
                <rect x={x} y={y} width={BOX_WIDTH} height={HEADER_HEIGHT} rx="6" fill="#0e639c" />
                <text x={x + 12} y={y + 20} fill="#fff" fontSize="12" fontWeight="600">
                  {table.name}
                </text>
                <text x={x + BOX_WIDTH - 12} y={y + 20} fill="#bfdbfe" fontSize="10" textAnchor="end">
                  {table.schema}
                </text>

                {table.columns.map((column, index) => {
                  const isFk = (table.foreignKeys ?? []).some((fk) => fk.column_name === column.column_name)
                  const rowY = y + HEADER_HEIGHT + index * ROW_HEIGHT
                  return (
                    <g key={column.column_name}>
                      <rect x={x} y={rowY} width={BOX_WIDTH} height={ROW_HEIGHT} fill={index % 2 === 0 ? '#1f1f1f' : '#252526'} />
                      <text x={x + 10} y={rowY + 16} fill={column.is_primary_key ? '#facc15' : isFk ? '#c4b5fd' : '#d4d4d4'} fontSize="11" fontWeight={column.is_primary_key ? 700 : 400}>
                        {column.is_primary_key ? 'PK ' : isFk ? 'FK ' : ''}{column.column_name}
                      </text>
                      <text x={x + BOX_WIDTH - 10} y={rowY + 16} fill="#6b7280" fontSize="10" textAnchor="end">
                        {column.data_type}
                      </text>
                    </g>
                  )
                })}
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}
