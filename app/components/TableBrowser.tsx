'use client'

import { useState } from 'react'
import { useDB } from '@/app/providers'

export default function TableBrowser() {
  const { tables, ready } = useDB()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (name: string) => {
    const next = new Set(expanded)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setExpanded(next)
  }

  if (!ready) {
    return (
      <div className="p-4 text-xs text-gray-500">
        Inicializando PostgreSQL...
      </div>
    )
  }

  if (tables.length === 0) {
    return (
      <div className="p-4 text-xs text-gray-500">
        No hay tablas aún.<br />
        Ejecutá un schema SQL arriba.
      </div>
    )
  }

  return (
    <div className="py-2">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 mb-1">
        Tablas ({tables.length})
      </div>
      {tables.map((t) => (
        <div key={t.table_name}>
          <button
            onClick={() => toggle(t.table_name)}
            className="flex items-center w-full text-left px-3 py-1 text-sm text-gray-300 hover:bg-[#37373d]"
          >
            <span className="text-[10px] mr-1.5 text-gray-500 w-2">
              {expanded.has(t.table_name) ? '▼' : '▶'}
            </span>
            <span className="text-blue-400">{t.table_name}</span>
          </button>
          {expanded.has(t.table_name) && (
            <div className="ml-4 border-l border-[#3c3c3c] ml-5 pl-2">
              {t.columns.map((c) => (
                <div
                  key={c.column_name}
                  className="flex items-center gap-1.5 px-2 py-0.5 text-xs"
                >
                  <svg className="w-3 h-3 text-gray-600 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="2" y="2" width="12" height="12" rx="1" />
                  </svg>
                  <span className="text-gray-300">{c.column_name}</span>
                  <span className="text-gray-600">{c.data_type}</span>
                  {c.is_nullable === 'NO' && (
                    <span className="text-[10px] text-yellow-700 font-medium">NN</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
