'use client'

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react'
import { useDB, type ObjectInfo } from '@/app/providers'
import Toolbar from '@/app/components/ui/Toolbar'
import Button from '@/app/components/ui/Button'

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
  const [mousePos, setMousePos] = useState<Position | null>(null)
  const [scale, setScale] = useState(1)

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

  const width = Math.max(1200, ...Array.from(layout.values()).map(({ x }) => x + BOX_WIDTH + 80))
  const height = Math.max(800, ...Array.from(layout.values()).map(({ y, height }) => y + height + 80))

  const getPoint = (e: ReactMouseEvent<SVGSVGElement | SVGGElement>): Position => {
    const rect = svgRef.current?.getBoundingClientRect()
    return {
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
    }
  }

  const getContentPoint = (e: ReactMouseEvent<SVGSVGElement | SVGGElement>): Position => {
    const p = getPoint(e)
    return { x: p.x / scale, y: p.y / scale }
  }

  const startDrag = (e: ReactMouseEvent<SVGGElement>, key: string) => {
    const pos = layout.get(key)
    if (!pos) return
    const point = getContentPoint(e)
    setDragging({ key, offsetX: point.x - pos.x, offsetY: point.y - pos.y })
  }

  const moveDrag = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!dragging) return
    const point = getContentPoint(e)
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
    <div className="flex flex-col h-full bg-surface">
      <Toolbar>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-txt-muted uppercase tracking-wider">
          <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
            <ellipse cx="16" cy="10" rx="10" ry="3.5" stroke="#818cf8" strokeWidth="2"/>
            <line x1="6" y1="10" x2="6" y2="22" stroke="#818cf8" strokeWidth="2"/>
            <line x1="26" y1="10" x2="26" y2="22" stroke="#818cf8" strokeWidth="2"/>
            <ellipse cx="16" cy="22" rx="10" ry="3.5" stroke="#818cf8" strokeWidth="2"/>
          </svg>
          Diagrama DER
        </span>
        <div className="relative ml-auto">
          <Button variant="ghost" onClick={() => setTablePickerOpen((open) => !open)}>
            Tablas ({visibleTables.length}/{tables.length})
          </Button>
          {tablePickerOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 max-h-80 overflow-auto rounded border border-surface-border bg-surface-elevated shadow-lg z-50 animate-fade-in">
              <div className="flex gap-1 p-2 border-b border-surface-border">
                <Button variant="primary" onClick={() => setHiddenTables(new Set())}>
                  Mostrar todas
                </Button>
                <Button variant="ghost" onClick={() => setHiddenTables(new Set(tables.map((table) => table.key)))}>
                  Ocultar todas
                </Button>
              </div>
              {tables.map((table) => {
                const isHidden = hiddenTables.has(table.key)
                return (
                  <button
                    key={table.key}
                    onClick={() => toggleTable(table.key)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left text-txt-muted hover:bg-surface-hover transition-colors duration-100"
                  >
                    <span className={isHidden ? 'text-gray-600' : 'text-institutional-400'}>{isHidden ? '◌' : '●'}</span>
                    <span className="flex-1 truncate">{table.name}</span>
                    <span className="text-[10px] text-gray-600">{table.schema}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="icon" onClick={() => setScale((s) => Math.max(0.25, +(s - 0.1).toFixed(2)))}>
            <ZoomOut size={14} />
          </Button>
          <span className="text-xs text-gray-400 w-8 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <Button variant="icon" onClick={() => setScale((s) => Math.min(2, +(s + 0.1).toFixed(2)))}>
            <ZoomIn size={14} />
          </Button>
        </div>
        <Button variant="secondary" onClick={refreshTables}>
          <RefreshCw size={12} />
          Refrescar
        </Button>
      </Toolbar>

      <div className="flex-1 overflow-auto">
        {visibleTables.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-xs text-txt-dim bg-surface">
            <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
              <ellipse cx="16" cy="10" rx="10" ry="3.5" stroke="#4b5563" strokeWidth="1.5"/>
              <line x1="6" y1="10" x2="6" y2="22" stroke="#4b5563" strokeWidth="1.5"/>
              <line x1="26" y1="10" x2="26" y2="22" stroke="#4b5563" strokeWidth="1.5"/>
              <ellipse cx="16" cy="22" rx="10" ry="3.5" stroke="#4b5563" strokeWidth="1.5"/>
            </svg>
            <span className="text-gray-600">No hay tablas visibles en el DER</span>
            <span className="text-gray-700">Activá tablas desde el selector superior derecho</span>
          </div>
        ) : (
          <svg
            ref={svgRef}
            width={width * scale}
            height={height * scale}
            className="min-w-full min-h-full select-none"
            onMouseMove={moveDrag}
            onMouseUp={() => setDragging(null)}
            onMouseLeave={() => setDragging(null)}
          >
            <defs>
              {/* Grid background */}
              <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="var(--svg-grid-dot)" opacity="0.5"/>
              </pattern>

              {/* Table drop shadow */}
              <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.5"/>
              </filter>
              <filter id="shadow-highlight" x="-10%" y="-10%" width="130%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#818cf8" flood-opacity="0.25"/>
              </filter>

              {/* Edge glow on hover */}
              <filter id="edge-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>

              <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#8b5cf6" />
              </marker>
              <marker id="arrow-active" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#818cf8" />
              </marker>
            </defs>

            <g transform={`scale(${scale})`}>
              <rect x="0" y="0" width={width} height={height} fill="url(#grid)" />
              {edges.map((edge) => {
                const path = edgePath(edge)
                const active = hoveredEdge?.key === edge.key
                return (
                  <g key={edge.key}
                    onMouseEnter={(e) => { setHoveredEdge(edge); setMousePos(getPoint(e)) }}
                    onMouseMove={(e) => setMousePos(getPoint(e))}
                    onMouseLeave={() => { setHoveredEdge(null); setMousePos(null) }}
                    filter={active ? 'url(#edge-glow)' : undefined}
                  >
                    <path d={path.d} fill="none" stroke="transparent" strokeWidth="16" />
                    <path
                      d={path.d}
                      fill="none"
                      stroke={active ? '#a5b4fc' : '#6d6d80'}
                      strokeWidth={active ? 2.5 : 1.5}
                      markerEnd={active ? 'url(#arrow-active)' : 'url(#arrow)'}
                      opacity={active ? 1 : 0.55}
                      style={{ transition: 'opacity 0.15s' }}
                    />
                    {active && (
                      <path d={path.d} fill="none" stroke="#818cf8" strokeWidth={1} opacity="0.4" markerEnd="url(#arrow-active)" />
                    )}
                  </g>
                )
              })}

              {Array.from(layout.values()).map(({ x, y, height: boxHeight, table }) => {
                const highlighted = isHighlightedTable(table.key)
                const headerPath = `M ${x} ${y + 8}
                  Q ${x} ${y} ${x + 8} ${y}
                  L ${x + BOX_WIDTH - 8} ${y}
                  Q ${x + BOX_WIDTH} ${y} ${x + BOX_WIDTH} ${y + 8}
                  L ${x + BOX_WIDTH} ${y + HEADER_HEIGHT}
                  L ${x} ${y + HEADER_HEIGHT} Z`
                return (
                  <g key={table.key} filter={highlighted ? 'url(#shadow-highlight)' : 'url(#shadow)'}>
                    <rect
                      x={x}
                      y={y}
                      width={BOX_WIDTH}
                      height={boxHeight}
                      rx="8"
                      fill="var(--svg-table-body)"
                      stroke={highlighted ? '#818cf8' : 'var(--svg-grid-dot)'}
                      strokeWidth={highlighted ? 2 : 1}
                    />
                    <g onMouseDown={(e) => startDrag(e, table.key)} className="cursor-move">
                      <path d={headerPath} fill={highlighted ? 'var(--svg-table-header-highlight)' : 'var(--svg-table-header)'} />
                      <text x={x + 12} y={y + 20} fill="var(--svg-table-text)" fontSize="13" fontWeight="600" pointerEvents="none">
                        {table.name}
                      </text>
                      <text x={x + BOX_WIDTH - 12} y={y + 20} fill={highlighted ? '#c7d2fe' : 'var(--svg-schema-text)'} fontSize="10" textAnchor="end" pointerEvents="none">
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
                            fill={highlightedColumn ? '#2a1f0e' : index % 2 === 0 ? 'transparent' : '#ffffff03'}
                          />
                          {/* PK/FK badge */}
                          {column.is_primary_key && (
                            <circle cx={x + 14} cy={rowY + 12} r="5" fill="#ca8a04" opacity="0.8" />
                          )}
                          {isFk && !column.is_primary_key && (
                            <circle cx={x + 14} cy={rowY + 12} r="5" fill="#7c3aed" opacity="0.6" />
                          )}
                          {/* PK/FK label */}
                          {column.is_primary_key && (
                            <text x={x + 22} y={rowY + 16} fill="#eab308" fontSize="9" fontWeight="700" fontFamily="monospace">PK</text>
                          )}
                          {isFk && !column.is_primary_key && (
                            <text x={x + 22} y={rowY + 16} fill="#a78bfa" fontSize="9" fontWeight="700" fontFamily="monospace">FK</text>
                          )}
                          {/* Column name */}
                          <text
                            x={x + (column.is_primary_key || isFk ? 40 : 12)}
                            y={rowY + 16}
                            fill={highlightedColumn ? '#fde68a' : '#d4d4d4'}
                            fontSize="11"
                            fontWeight={column.is_primary_key || highlightedColumn ? 600 : 400}
                          >
                            {column.column_name}
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
            </g>

            {hoveredEdge && mousePos && (() => {
              const edge = hoveredEdge
              const fromName = layout.get(edge.from)?.table.name ?? edge.from
              const toName = layout.get(edge.to)?.table.name ?? edge.to
              const text = `${fromName}.${edge.column} → ${toName}.${edge.targetColumn}`
              const tw = text.length * 6.5 + 24
              return (
                <g filter="url(#shadow)">
                  <rect x={mousePos.x + 14} y={mousePos.y - 28} width={tw} height="24" rx="6" fill="#0f1d2f" stroke="#818cf8" strokeWidth="1.5" />
                  <text x={mousePos.x + 14 + tw / 2} y={mousePos.y - 11} fill="#c7d2fe" fontSize="11" textAnchor="middle" fontWeight="500">
                    {text}
                  </text>
                </g>
              )
            })()}
          </svg>
        )}
      </div>
    </div>
  )
}
