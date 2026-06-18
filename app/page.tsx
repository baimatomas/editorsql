'use client'

import { DBProvider } from '@/app/providers'
import SchemaEditor from '@/app/components/SchemaEditor'
import QueryEditor from '@/app/components/QueryEditor'
import TableBrowser from '@/app/components/TableBrowser'
import ResultTable from '@/app/components/ResultTable'

export default function Home() {
  return (
    <DBProvider>
      <div className="h-screen flex flex-col bg-[#1e1e1e] text-gray-200">
        <header className="bg-[#007acc] text-white px-4 py-1 text-sm font-semibold flex items-center gap-2 flex-shrink-0">
          <span>EditorSQL</span>
          <span className="text-[11px] font-normal opacity-70">— Práctica PostgreSQL en el navegador</span>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-56 bg-[#252526] border-r border-[#3c3c3c] overflow-y-auto flex-shrink-0">
            <TableBrowser />
          </aside>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 w-1/2 border-r border-[#3c3c3c]">
                <SchemaEditor />
              </div>
              <div className="flex-1 w-1/2">
                <QueryEditor />
              </div>
            </div>
            <div className="h-[200px] flex-shrink-0 border-t border-[#3c3c3c]">
              <ResultTable />
            </div>
          </div>
        </div>
      </div>
    </DBProvider>
  )
}
