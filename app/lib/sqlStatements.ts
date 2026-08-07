export interface SqlStatement {
  text: string
  start: number
  end: number
}

export function splitSqlStatementsDetailed(sql: string): SqlStatement[] {
  const statements: SqlStatement[] = []
  let current = ''
  let currentStart = 0
  let i = 0
  const n = sql.length

  const pushStatement = () => {
    const trimmed = current.trim()
    if (trimmed) {
      const start = currentStart + current.indexOf(trimmed)
      statements.push({ text: trimmed, start, end: start + trimmed.length })
    }
    current = ''
  }

  while (i < n) {
    const ch = sql[i]
    const next = sql[i + 1]

    // Line comment
    if (ch === '-' && next === '-') {
      while (i < n && sql[i] !== '\n') {
        current += sql[i]
        i++
      }
      continue
    }

    // Block comment
    if (ch === '/' && next === '*') {
      current += '/*'
      i += 2
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) {
        current += sql[i]
        i++
      }
      if (i < n) {
        current += '*/'
        i += 2
      }
      continue
    }

    // Single-quoted string ('' escapes)
    if (ch === "'") {
      current += ch
      i++
      while (i < n) {
        current += sql[i]
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            current += sql[i + 1]
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }

    // Double-quoted identifier ("" escapes)
    if (ch === '"') {
      current += ch
      i++
      while (i < n) {
        current += sql[i]
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            current += sql[i + 1]
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }

    // Dollar-quoted string ($$...$$ or $tag$...$tag$)
    if (ch === '$') {
      const m = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i))
      if (m) {
        const tag = m[0]
        current += tag
        i += tag.length
        const end = sql.indexOf(tag, i)
        if (end === -1) {
          current += sql.slice(i)
          i = n
        } else {
          current += sql.slice(i, end + tag.length)
          i = end + tag.length
        }
        continue
      }
    }

    // Statement separator
    if (ch === ';') {
      pushStatement()
      i++
      currentStart = i
      continue
    }

    current += ch
    i++
  }

  pushStatement()
  return statements
}

export function splitSqlStatements(sql: string): string[] {
  return splitSqlStatementsDetailed(sql).map(s => s.text)
}

export function hasRealSql(text: string): boolean {
  const noComments = text
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  return noComments.trim().length > 0
}
