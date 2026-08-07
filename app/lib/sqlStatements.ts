export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let i = 0
  const n = sql.length

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
      if (current.trim()) statements.push(current.trim())
      current = ''
      i++
      continue
    }

    current += ch
    i++
  }

  if (current.trim()) statements.push(current.trim())
  return statements
}
