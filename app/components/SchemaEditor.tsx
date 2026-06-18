'use client'

import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { useDB } from '@/app/providers'

export default function SchemaEditor() {
  const [sql, setSql] = useState('')
  const { runSchema, schemaError, ready } = useDB()

  const handleRun = () => {
    runSchema(sql)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-[#3c3c3c] flex-shrink-0">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Schema SQL
        </span>
        <button
          onClick={handleRun}
          disabled={!ready || !sql.trim()}
          className="px-3 py-0.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-medium"
        >
          Run Schema
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme="vs-dark"
          value={sql}
          onChange={(val) => setSql(val ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            renderLineHighlight: 'none',
            padding: { top: 6 },
          }}
        />
      </div>
      {schemaError && (
        <div className="px-3 py-1.5 bg-red-900/40 border-t border-red-800 text-red-300 text-xs font-mono flex-shrink-0">
          {schemaError}
        </div>
      )}
    </div>
  )
}
