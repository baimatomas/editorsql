'use client'

import { Group, Panel, Separator } from 'react-resizable-panels'
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
          <div className="bg-[#252526] overflow-y-auto" style={{ flex: '30 1 0px' }}>
            <TableBrowser />
          </div>
          <div className="w-[3px] bg-[#3c3c3c] hover:bg-[#007acc] transition-colors cursor-col-resize flex-shrink-0" />
          <div className="flex flex-col" style={{ flex: '100 1 0px' }}>
            <Group orientation="vertical" className="flex-1">
              <Panel defaultSize={65} minSize={20}>
                <Group orientation="horizontal">
                  <Panel defaultSize={50} minSize={15}>
                    <SchemaEditor />
                  </Panel>
                  <Separator className="w-[3px] bg-[#3c3c3c] hover:bg-[#007acc] transition-colors cursor-col-resize" />
                  <Panel defaultSize={50} minSize={15}>
                    <QueryEditor />
                  </Panel>
                </Group>
              </Panel>
              <Separator className="h-[3px] bg-[#3c3c3c] hover:bg-[#007acc] transition-colors cursor-row-resize" />
              <Panel defaultSize={35} minSize={10}>
                <ResultTable />
              </Panel>
            </Group>
          </div>
        </div>
      </div>
    </DBProvider>
  )
}
