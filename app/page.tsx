'use client'

import { useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { DBProvider } from '@/app/providers'
import SchemaEditor from '@/app/components/SchemaEditor'
import QueryEditor from '@/app/components/QueryEditor'
import TableBrowser from '@/app/components/TableBrowser'
import ResultTable from '@/app/components/ResultTable'

type PanelKey = 'sidebar' | 'schema' | 'query' | 'results'

const LABELS: Record<PanelKey, string> = {
  sidebar: 'Tablas',
  schema: 'Schema',
  query: 'Query',
  results: 'Resultados',
}

export default function Home() {
  const [visible, setVisible] = useState<Record<PanelKey, boolean>>({
    sidebar: true,
    schema: true,
    query: true,
    results: true,
  })

  const toggle = (key: PanelKey) =>
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))

  const hasAny = visible.sidebar || visible.schema || visible.query || visible.results

  return (
    <DBProvider>
      <div className="h-screen flex flex-col bg-[#1e1e1e] text-gray-200">
        <header className="bg-[#007acc] text-white px-4 py-1 text-sm font-semibold flex items-center gap-2 flex-shrink-0">
          <span className="mr-2">EditorSQL</span>
          <span className="text-[11px] font-normal opacity-70 mr-4">— Práctica PostgreSQL</span>
          <div className="flex items-center gap-1 ml-auto">
            {(['sidebar', 'schema', 'query', 'results'] as PanelKey[]).map((key) => (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`px-2 py-0.5 text-[11px] rounded border transition-colors ${
                  visible[key]
                    ? 'bg-white/15 border-white/20 text-white'
                    : 'bg-transparent border-transparent text-white/40 hover:text-white/60'
                }`}
              >
                {LABELS[key]}
              </button>
            ))}
          </div>
        </header>

        {!hasAny ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            Todos los paneles están ocultos. Activá uno desde el header.
          </div>
        ) : (
          <Group orientation="horizontal" className="flex-1">
            {visible.sidebar && (
              <>
                <Panel id="sidebar" defaultSize="18%" minSize="6%" className="bg-[#252526]">
                  <TableBrowser />
                </Panel>
                <Separator className="w-[3px] bg-[#3c3c3c] hover:bg-[#007acc] transition-colors cursor-col-resize" />
              </>
            )}

            <Panel id="main" className="flex flex-col">
              {(visible.schema || visible.query) && (
                <Group orientation="vertical" className="flex-1">
                  <Panel id="editors" defaultSize="65%" minSize="10%">
                    {visible.schema && visible.query ? (
                      <Group orientation="horizontal">
                        <Panel id="schema" defaultSize="50%" minSize="10%">
                          <SchemaEditor />
                        </Panel>
                        <Separator className="w-[3px] bg-[#3c3c3c] hover:bg-[#007acc] transition-colors cursor-col-resize" />
                        <Panel id="query" defaultSize="50%" minSize="10%">
                          <QueryEditor />
                        </Panel>
                      </Group>
                    ) : visible.schema ? (
                      <SchemaEditor />
                    ) : (
                      <QueryEditor />
                    )}
                  </Panel>
                  {visible.results && (
                    <>
                      <Separator className="h-[3px] bg-[#3c3c3c] hover:bg-[#007acc] transition-colors cursor-row-resize" />
                      <Panel id="results" defaultSize="35%" minSize="10%">
                        <ResultTable />
                      </Panel>
                    </>
                  )}
                </Group>
              )}

              {!visible.schema && !visible.query && visible.results && (
                <ResultTable />
              )}
            </Panel>
          </Group>
        )}
      </div>
    </DBProvider>
  )
}
