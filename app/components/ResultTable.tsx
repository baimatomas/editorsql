'use client'

import { Download } from 'lucide-react'
import { useDB } from '@/app/providers'
import Toolbar from '@/app/components/ui/Toolbar'
import Button from '@/app/components/ui/Button'

export default function ResultTable() {
  const { queryResult, queryError, queryTime, loading } = useDB()

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <Toolbar>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Resultados</span>
        </Toolbar>
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
        <Toolbar>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Resultados</span>
        </Toolbar>
        <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
          Ejecutá una consulta para ver resultados
        </div>
      </div>
    )
  }

  if (queryResult.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Toolbar>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Resultados</span>
          {queryTime !== null && (
            <span className="text-[10px] text-gray-600">{queryTime.toFixed(1)} ms</span>
          )}
        </Toolbar>
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
      <Toolbar>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Resultados</span>
        <div className="flex items-center gap-2">
          {queryTime !== null && (
            <span className="text-[10px] text-gray-600">{queryTime.toFixed(1)} ms</span>
          )}
          <Button variant="ghost" onClick={exportCSV}>
            <Download size={12} />
            CSV
          </Button>
        </div>
      </Toolbar>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-surface-card sticky top-0 shadow-sm z-10">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-1.5 text-left text-gray-300 font-semibold border-b border-surface-border whitespace-nowrap"
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
                    className="px-3 py-1 text-gray-300 border-b border-surface-border/40 whitespace-nowrap"
                  >
                    {row[col] === null ? (
                      <span className="text-gray-600 italic">NULL</span>
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
      <div className="flex items-center justify-between px-3 py-1 text-[10px] text-gray-500 bg-surface border-t border-surface-border flex-shrink-0">
        <span>{queryResult.length} fila(s)</span>
      </div>
    </div>
  )
}
