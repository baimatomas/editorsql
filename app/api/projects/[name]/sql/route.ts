import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { blobUrl } from '@/app/lib/blob'
import { DEFAULT_PROJECTS } from '@/app/lib/projects'

export async function GET(_request: Request, { params }: { params: { name: string } }) {
  const { name } = params

  // Built-in projects ship with the app; serve directly from public/.
  if (DEFAULT_PROJECTS.includes(name)) {
    try {
      const filePath = path.join(process.cwd(), 'public', 'projects', `${name}.sql`)
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf-8')
        return new Response(sql, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    } catch {}
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  // User projects: try Blob via direct public URL.
  try {
    const url = blobUrl(`projects/${name}.sql`)
    if (url) {
      const res = await fetch(url, { cache: 'no-cache' })
      if (res.ok) {
        const sql = await res.text()
        return new Response(sql, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    }
  } catch {}

  // Fallback to local public/ directory.
  try {
    const filePath = path.join(process.cwd(), 'public', 'projects', `${name}.sql`)
    if (fs.existsSync(filePath)) {
      const sql = fs.readFileSync(filePath, 'utf-8')
      return new Response(sql, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  } catch {}

  return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
}
