'use client'

import { useState } from 'react'
import { useDB } from '@/app/providers'

export default function TableBrowser() {
  const { tables, ready, savedQueries, loadQuery, deleteQuery } = useDB()
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['saved']))

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

  return (
    <div className="py-2">
      {/* Saved Queries */}
      <div className="mb-2">
        <button
          onClick={() => toggle('saved')}
          className="flex items-center w-full text-left px-3 py-1 text-xs text-gray-400 hover:bg-[#37373d]"
        >
          <span className="text-[10px] mr-1.5 w-2">
            {expanded.has('saved') ? '▼' : '▶'}
          </span>
          <span className="text-orange-400 font-medium">Saved Queries</span>
          {savedQueries.length > 0 && (
            <span className="ml-1 text-gray-600">({savedQueries.length})</span>
          )}
        </button>
        {expanded.has('saved') && (
          <div>
            {savedQueries.length === 0 && (
              <div className="ml-5 pl-3 py-1 text-[10px] text-gray-600">
                Aún no guardaste consultas
              </div>
            )}
            {savedQueries.map((q) => (
              <div key={q.id} className="group flex items-center ml-5 pl-3 pr-2 py-0.5 hover:bg-[#37373d] cursor-pointer" onClick={() => loadQuery(q.id)}>
                <svg className="w-3 h-3 text-gray-600 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 2h12v12H2V2zm1 1v10h10V3H3zm2 2h6v1H5V5zm0 3h6v1H5V8zm0 3h4v1H5v-1z"/>
                </svg>
                <span className="ml-1.5 text-xs text-gray-300 flex-1 truncate">{q.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteQuery(q.id) }}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-[10px] px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[#3c3c3c] mb-2" />

      {/* Tables */}
      {tables.length === 0 ? (
        <div className="px-3 text-xs text-gray-500">
          No hay tablas aún.<br />
          Ejecutá un schema SQL arriba.
        </div>
      ) : (
        <div>
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
      )}
    </div>
  )
}
