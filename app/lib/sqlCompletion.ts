'use client'

import { type MutableRefObject } from 'react'

interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
}

interface ObjectInfo {
  name: string
  columns: ColumnInfo[]
}

interface SchemaInfo {
  schema_name: string
  tables: ObjectInfo[]
  views: ObjectInfo[]
}

export function registerSQLCompletion(
  monaco: any,
  schemasRef: MutableRefObject<SchemaInfo[]>
): { dispose: () => void } {
  return monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' '],

    provideCompletionItems: (model: any, position: any) => {
      const textUntil = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })

      const schemas = schemasRef.current
      if (!schemas || schemas.length === 0) return { suggestions: [] }

      const suggestions: any[] = []

      // ── Context: table. → column suggestions ──
      const dotMatch = textUntil.match(/(\w+)\.\s*(\w*)$/)
      if (dotMatch) {
        const tableName = dotMatch[1].toLowerCase()
        const partial = dotMatch[2]
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - partial.length,
          endColumn: position.column,
        }

        for (const schema of schemas) {
          for (const table of [...schema.tables, ...schema.views]) {
            if (table.name.toLowerCase() === tableName) {
              for (const col of table.columns) {
                suggestions.push({
                  label: col.column_name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  detail: `${col.data_type}${col.is_nullable === 'YES' ? '' : ' NOT NULL'}`,
                  insertText: col.column_name,
                  range,
                })
              }
            }
          }
        }
        return { suggestions }
      }

      // ── Context: after FROM / JOIN → tables & views ──
      const fromJoinMatch = textUntil.match(/\b(FROM|JOIN)\s+(\w*)$/i)
      if (fromJoinMatch) {
        const partial = fromJoinMatch[2]
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - partial.length,
          endColumn: position.column,
        }

        for (const schema of schemas) {
          for (const table of schema.tables) {
            suggestions.push({
              label: table.name,
              kind: monaco.languages.CompletionItemKind.Class,
              detail: `${schema.schema_name}.${table.name}`,
              insertText: table.name,
              range,
            })
          }
          for (const view of schema.views) {
            suggestions.push({
              label: view.name,
              kind: monaco.languages.CompletionItemKind.Reference,
              detail: `${schema.schema_name}.${view.name} (vista)`,
              insertText: view.name,
              range,
            })
          }
        }
        return { suggestions }
      }

      // ── General context → tables + views + columns ──
      const word = model.getWordUntilPosition(position)
      const defaultRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn ?? position.column,
        endColumn: word.endColumn ?? position.column,
      }

      for (const schema of schemas) {
        for (const table of schema.tables) {
          suggestions.push({
            label: table.name,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: `${schema.schema_name}.${table.name} (${table.columns.length} cols)`,
            insertText: table.name,
            range: defaultRange,
          })
          for (const col of table.columns) {
            suggestions.push({
              label: col.column_name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: `${table.name}: ${col.data_type}${col.is_nullable === 'YES' ? '' : ' NOT NULL'}`,
              insertText: col.column_name,
              range: defaultRange,
              filterText: col.column_name,
            })
          }
        }
        for (const view of schema.views) {
          suggestions.push({
            label: view.name,
            kind: monaco.languages.CompletionItemKind.Reference,
            detail: `${schema.schema_name}.${view.name} (vista)`,
            insertText: view.name,
            range: defaultRange,
          })
          for (const col of view.columns) {
            suggestions.push({
              label: col.column_name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: `${view.name}: ${col.data_type}${col.is_nullable === 'YES' ? '' : ' NOT NULL'}`,
              insertText: col.column_name,
              range: defaultRange,
              filterText: col.column_name,
            })
          }
        }
      }

      return { suggestions }
    },
  })
}
