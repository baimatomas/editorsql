import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'
import fs from 'fs'
import path from 'path'

export async function GET(_request: Request, { params }: { params: { name: string } }) {
  const { name } = params

  // Try Blob first
  try {
    const { blobs } = await list({ prefix: `projects/${name}.sql`, limit: 1 })
    if (blobs.length > 0) {
      const res = await fetch(blobs[0].url, { cache: 'no-cache' })
      if (res.ok) {
        const sql = await res.text()
        return new Response(sql, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    }
  } catch {}

  // Fallback to local public/ directory
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
