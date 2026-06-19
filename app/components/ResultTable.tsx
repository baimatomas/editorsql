'use client'

import { useDB } from '@/app/providers'

export default function ResultTable() {
  const { queryResult, queryError, loading } = useDB()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-500">
        Ejecutando consulta...
      </div>
    )
  }

  if (queryError) {
    return null
  }

  if (!queryResult) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-500">
        Ejecutá una consulta para ver resultados
      </div>
    )
  }

  if (queryResult.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-500">
        La consulta se ejecutó correctamente sin resultados para mostrar
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
      <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 py-1 bg-[#252526] border-b border-[#3c3c3c] flex-shrink-0">
        <span>Resultados</span>
        <button onClick={exportCSV} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium normal-case tracking-normal">
          Exportar CSV
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#2d2d2d] sticky top-0">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-1.5 text-left text-gray-400 font-medium border-b border-[#3c3c3c] whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(queryResult as Record<string, unknown>[]).map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}>
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-1 text-gray-300 border-b border-[#3c3c3c] whitespace-nowrap"
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
      <div className="px-3 py-1 text-[10px] text-gray-500 bg-[#252526] border-t border-[#3c3c3c] flex-shrink-0">
        {queryResult.length} fila(s)
      </div>
    </div>
  )
}
