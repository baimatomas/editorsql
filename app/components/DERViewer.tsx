'use client'

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { useDB, type ObjectInfo } from '@/app/providers'

const BOX_WIDTH = 230
const HEADER_HEIGHT = 30
const ROW_HEIGHT = 24
const GAP_X = 90
const GAP_Y = 70
const COLS = 3

type DiagramTable = ObjectInfo & { schema: string; key: string }
type Position = { x: number; y: number }
type DragState = { key: string; offsetX: number; offsetY: number }
type Edge = {
  key: string
  from: string
  to: string
  column: string
  targetColumn: string
}

function defaultPosition(index: number): Position {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  return {
    x: 40 + col * (BOX_WIDTH + GAP_X),
    y: 40 + row * (220 + GAP_Y),
  }
}

function tableHeight(table: DiagramTable): number {
  return HEADER_HEIGHT + Math.max(table.columns.length, 1) * ROW_HEIGHT + 12
}

export default function DERViewer() {
  const { schemas, refreshTables } = useDB()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [positions, setPositions] = useState<Record<string, Position>>({})
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [hiddenTables, setHiddenTables] = useState<Set<string>>(new Set())
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null)

  const tables = useMemo<DiagramTable[]>(() => {
    return schemas.flatMap((schema) =>
      schema.tables.map((table) => ({
        ...table,
        schema: schema.schema_name,
        key: `${schema.schema_name}.${table.name}`,
      }))
    )
  }, [schemas])

  useEffect(() => {
    setPositions((prev) => {
      const next: Record<string, Position> = {}
      tables.forEach((table, index) => {
        next[table.key] = prev[table.key] ?? defaultPosition(index)
      })
      return next
    })
    setHiddenTables((prev) => new Set(Array.from(prev).filter((key) => tables.some((table) => table.key === key))))
  }, [tables])

  const visibleTables = useMemo(() => {
    return tables.filter((table) => !hiddenTables.has(table.key))
  }, [tables, hiddenTables])

  const layout = useMemo(() => {
    const map = new Map<string, { x: number; y: number; height: number; table: DiagramTable }>()
    visibleTables.forEach((table, index) => {
      const pos = positions[table.key] ?? defaultPosition(index)
      map.set(table.key, { x: pos.x, y: pos.y, height: tableHeight(table), table })
    })
    return map
  }, [positions, visibleTables])

  const visibleKeys = useMemo(() => new Set(visibleTables.map((table) => table.key)), [visibleTables])

  const edges = useMemo<Edge[]>(() => {
    return visibleTables.flatMap((table) =>
      (table.foreignKeys ?? []).map((fk, index) => ({
        key: `${table.key}.${fk.column_name}.${fk.foreign_table_schema}.${fk.foreign_table_name}.${fk.foreign_column_name}.${index}`,
        from: table.key,
        to: `${fk.foreign_table_schema}.${fk.foreign_table_name}`,
        column: fk.column_name,
        targetColumn: fk.foreign_column_name,
      }))
    ).filter((edge) => visibleKeys.has(edge.from) && visibleKeys.has(edge.to))
  }, [visibleKeys, visibleTables])

  const width = Math.max(900, ...Array.from(layout.values()).map(({ x }) => x + BOX_WIDTH + 80))
  const height = Math.max(520, ...Array.from(layout.values()).map(({ y, height }) => y + height + 80))

  const getPoint = (e: ReactMouseEvent<SVGSVGElement | SVGGElement>): Position => {
    const rect = svgRef.current?.getBoundingClientRect()
    return {
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    }
  }

  const startDrag = (e: ReactMouseEvent<SVGGElement>, key: string) => {
    const pos = layout.get(key)
    if (!pos) return
    const point = getPoint(e)
    setDragging({ key, offsetX: point.x - pos.x, offsetY: point.y - pos.y })
  }

  const moveDrag = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!dragging) return
    const point = getPoint(e)
    setPositions((prev) => ({
      ...prev,
      [dragging.key]: {
        x: Math.max(10, point.x - dragging.offsetX),
        y: Math.max(10, point.y - dragging.offsetY),
      },
    }))
  }

  const toggleTable = (key: string) => {
    setHiddenTables((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const edgePath = (edge: Edge) => {
    const from = layout.get(edge.from)!
    const to = layout.get(edge.to)!
    const fromColumnIndex = Math.max(0, from.table.columns.findIndex((column) => column.column_name === edge.column))
    const toColumnIndex = Math.max(0, to.table.columns.findIndex((column) => column.column_name === edge.targetColumn))
    const fromY = from.y + HEADER_HEIGHT + fromColumnIndex * ROW_HEIGHT + ROW_HEIGHT / 2
    const toY = to.y + HEADER_HEIGHT + toColumnIndex * ROW_HEIGHT + ROW_HEIGHT / 2
    const fromIsLeft = from.x > to.x
    const startX = fromIsLeft ? from.x : from.x + BOX_WIDTH
    const endX = fromIsLeft ? to.x + BOX_WIDTH : to.x
    const dx = Math.max(70, Math.abs(endX - startX) / 2)
    const c1x = startX + (fromIsLeft ? -dx : dx)
    const c2x = endX + (fromIsLeft ? dx : -dx)
    return {
      d: `M ${startX} ${fromY} C ${c1x} ${fromY}, ${c2x} ${toY}, ${endX} ${toY}`,
      labelX: (startX + endX) / 2,
      labelY: (fromY + toY) / 2,
    }
  }

  const isHighlightedTable = (key: string) => hoveredEdge?.from === key || hoveredEdge?.to === key
  const isHighlightedColumn = (tableKey: string, columnName: string) => {
    if (!hoveredEdge) return false
    return (
      (hoveredEdge.from === tableKey && hoveredEdge.column === columnName) ||
      (hoveredEdge.to === tableKey && hoveredEdge.targetColumn === columnName)
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c] flex-shrink-0">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">DER</span>
        <div className="relative ml-auto">
          <button
            onClick={() => setTablePickerOpen((open) => !open)}
            className="px-3 py-0.5 text-xs rounded border border-[#3c3c3c] text-gray-300 hover:text-white hover:bg-[#37373d]"
          >
            Tablas ({visibleTables.length}/{tables.length})
          </button>
          {tablePickerOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 max-h-80 overflow-auto rounded border border-[#3c3c3c] bg-[#2d2d2d] shadow-lg z-50">
              <div className="flex gap-1 p-2 border-b border-[#3c3c3c]">
                <button
                  onClick={() => setHiddenTables(new Set())}
                  className="flex-1 px-2 py-1 text-[11px] rounded bg-[#0e639c] text-white hover:bg-[#1177bb]"
                >
                  Mostrar todas
                </button>
                <button
                  onClick={() => setHiddenTables(new Set(tables.map((table) => table.key)))}
                  className="flex-1 px-2 py-1 text-[11px] rounded bg-[#3c3c3c] text-gray-200 hover:bg-[#4a4a4a]"
                >
                  Ocultar todas
                </button>
              </div>
              {tables.map((table) => {
                const isHidden = hiddenTables.has(table.key)
                return (
                  <button
                    key={table.key}
                    onClick={() => toggleTable(table.key)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-300 hover:bg-[#37373d]"
                  >
                    <span className={isHidden ? 'text-gray-600' : 'text-blue-400'}>{isHidden ? '◌' : '●'}</span>
                    <span className="flex-1 truncate">{table.name}</span>
                    <span className="text-[10px] text-gray-600">{table.schema}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <button
          onClick={refreshTables}
          className="px-3 py-0.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded font-medium"
        >
          Refrescar DER
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {visibleTables.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No hay tablas visibles en el DER.
          </div>
        ) : (
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="min-w-full min-h-full select-none"
            onMouseMove={moveDrag}
            onMouseUp={() => setDragging(null)}
            onMouseLeave={() => setDragging(null)}
          >
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#7c3aed" />
              </marker>
              <marker id="arrow-active" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#facc15" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const path = edgePath(edge)
              const active = hoveredEdge?.key === edge.key
              const fromName = layout.get(edge.from)?.table.name ?? edge.from
              const toName = layout.get(edge.to)?.table.name ?? edge.to
              return (
                <g key={edge.key} onMouseEnter={() => setHoveredEdge(edge)} onMouseLeave={() => setHoveredEdge(null)}>
                  <path d={path.d} fill="none" stroke="transparent" strokeWidth="14" />
                  <path
                    d={path.d}
                    fill="none"
                    stroke={active ? '#facc15' : '#7c3aed'}
                    strokeWidth={active ? 3 : 1.5}
                    markerEnd={active ? 'url(#arrow-active)' : 'url(#arrow)'}
                    opacity={active ? 1 : 0.75}
                  />
                  {active && (
                    <g>
                      <rect x={path.labelX - 90} y={path.labelY - 18} width="180" height="22" rx="4" fill="#111827" stroke="#facc15" />
                      <text x={path.labelX} y={path.labelY - 3} fill="#fde68a" fontSize="10" textAnchor="middle">
                        {fromName}.{edge.column} → {toName}.{edge.targetColumn}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}

            {Array.from(layout.values()).map(({ x, y, height: boxHeight, table }) => {
              const highlighted = isHighlightedTable(table.key)
              return (
                <g key={table.key}>
                  <rect
                    x={x}
                    y={y}
                    width={BOX_WIDTH}
                    height={boxHeight}
                    rx="6"
                    fill="#252526"
                    stroke={highlighted ? '#facc15' : '#3c3c3c'}
                    strokeWidth={highlighted ? 2.5 : 1}
                  />
                  <g onMouseDown={(e) => startDrag(e, table.key)} className="cursor-move">
                    <rect x={x} y={y} width={BOX_WIDTH} height={HEADER_HEIGHT} rx="6" fill={highlighted ? '#7c3aed' : '#0e639c'} />
                    <text x={x + 12} y={y + 20} fill="#fff" fontSize="12" fontWeight="600" pointerEvents="none">
                      {table.name}
                    </text>
                    <text x={x + BOX_WIDTH - 12} y={y + 20} fill="#bfdbfe" fontSize="10" textAnchor="end" pointerEvents="none">
                      {table.schema}
                    </text>
                  </g>

                  {table.columns.map((column, index) => {
                    const isFk = (table.foreignKeys ?? []).some((fk) => fk.column_name === column.column_name)
                    const highlightedColumn = isHighlightedColumn(table.key, column.column_name)
                    const rowY = y + HEADER_HEIGHT + index * ROW_HEIGHT
                    return (
                      <g key={column.column_name}>
                        <rect
                          x={x}
                          y={rowY}
                          width={BOX_WIDTH}
                          height={ROW_HEIGHT}
                          fill={highlightedColumn ? '#3b2f13' : index % 2 === 0 ? '#1f1f1f' : '#252526'}
                        />
                        <text x={x + 10} y={rowY + 16} fill={highlightedColumn ? '#fde68a' : column.is_primary_key ? '#facc15' : isFk ? '#c4b5fd' : '#d4d4d4'} fontSize="11" fontWeight={column.is_primary_key || highlightedColumn ? 700 : 400}>
                          {column.is_primary_key ? 'PK ' : isFk ? 'FK ' : ''}{column.column_name}
                        </text>
                        <text x={x + BOX_WIDTH - 10} y={rowY + 16} fill={highlightedColumn ? '#fbbf24' : '#6b7280'} fontSize="10" textAnchor="end">
                          {column.data_type}
                        </text>
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}
