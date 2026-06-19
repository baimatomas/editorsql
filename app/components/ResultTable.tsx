'use client'

import { Download } from 'lucide-react'
import { useDB } from '@/app/providers'
import Button from '@/app/components/ui/Button'
import Badge from '@/app/components/ui/Badge'

export default function ResultTable() {
  const { queryResult, queryError, queryTime, loading } = useDB()

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 py-1.5 bg-surface-card border-b border-surface-border flex-shrink-0 shadow-sm">
          <span>Resultados</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
          Ejecutando consulta...
        </div>
      </div>
    )
  }

  if (queryError) {
    return null
  }

  if (!queryResult) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 py-1.5 bg-surface-card border-b border-surface-border flex-shrink-0 shadow-sm">
          <span>Resultados</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
          Ejecutá una consulta para ver resultados
        </div>
      </div>
    )
  }

  if (queryResult.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 py-1.5 bg-surface-card border-b border-surface-border flex-shrink-0 shadow-sm">
          <span>Resultados</span>
          {queryTime !== null && (
            <span className="text-[10px] text-gray-500 font-medium normal-case tracking-normal">
              <Badge variant="type">{queryTime.toFixed(1)} ms</Badge>
            </span>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
          La consulta se ejecutó correctamente sin resultados para mostrar
        </div>
      </div>
    )
  }

  const columns = Object.keys(queryResult[0] as Record<string, unknown>)

  const exportCSV = () => {
    const header = columns.map((c) => `"${c}"`).join(',')
    const rows = (queryResult as Record<string, unknown>[]).map((row) =>
      columns.map((col) => {
        const val = row[col]
        if (val === null) return ''
        return `"${String(val).replace(/"/g, '""')}"`
      }).join(',')
    )
    const csv = [header, ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'resultados.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 py-1.5 bg-surface-card border-b border-surface-border flex-shrink-0 shadow-sm">
        <span>Resultados</span>
        <div className="flex items-center gap-2">
          {queryTime !== null && (
            <Badge variant="type">{queryTime.toFixed(1)} ms</Badge>
          )}
          <Button variant="outline" onClick={exportCSV} className="text-[10px] normal-case tracking-normal">
            <Download size={12} />
            Exportar CSV
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-surface-card sticky top-0 shadow-sm z-10">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-1.5 text-left text-gray-400 font-medium border-b border-surface-border whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(queryResult as Record<string, unknown>[]).map((row, i) => (
              <tr
                key={i}
                className={`${i % 2 === 0 ? 'bg-surface' : 'bg-surface-card'} hover:bg-surface-hover/60 transition-colors duration-75`}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-1 text-gray-300 border-b border-surface-border whitespace-nowrap"
                  >
                    {row[col] === null ? (
                      <Badge variant="nn">NULL</Badge>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-3 py-1 text-[10px] text-gray-500 bg-surface-card border-t border-surface-border flex-shrink-0">
        <span>{queryResult.length} fila(s)</span>
      </div>
    </div>
  )
}
