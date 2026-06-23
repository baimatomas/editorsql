import { NextResponse } from 'next/server'
import { put, list } from '@vercel/blob'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { slugify, type ProjectMeta, type ProjectEntry } from '@/app/lib/projects'

const INDEX_BLOB = 'projects/index.json'

function verifyToken(token: string): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const secret = process.env.TEACHER_PASS
  if (!secret) return false
  const sig = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url')
  if (sig !== parts[2]) return false
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    if (payload.exp * 1000 < Date.now()) return false
    return true
  } catch {
    return false
  }
}

async function loadIndex(): Promise<Record<string, ProjectMeta>> {
  try {
    const { blobs } = await list({ prefix: INDEX_BLOB, limit: 1 })
    if (blobs.length === 0) return {}
    const res = await fetch(blobs[0].url, { cache: 'no-cache' })
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

async function saveIndex(data: Record<string, ProjectMeta>): Promise<void> {
  await put(INDEX_BLOB, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

async function seedBuiltIn(): Promise<Record<string, ProjectMeta>> {
  const existing = await loadIndex()
  if (Object.keys(existing).length > 0) return existing

  const projectsDir = path.join(process.cwd(), 'public', 'projects')
  let seeded: Record<string, ProjectMeta> = {}

  try {
    const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.sql'))
    for (const file of files) {
      const name = path.parse(file).name
      const label = name.charAt(0).toUpperCase() + name.slice(1)
      const filePath = path.join(projectsDir, file)
      const sql = fs.readFileSync(filePath, 'utf-8')
      const blob = await put(`projects/${name}.sql`, sql, {
        access: 'public',
        contentType: 'text/plain',
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      seeded[name] = { label }
    }
  } catch {
    // no built-in projects directory
  }

  if (Object.keys(seeded).length > 0) {
    await saveIndex(seeded)
    return seeded
  }

  return existing
}

export async function GET() {
  const index = await seedBuiltIn()
  const projects: ProjectEntry[] = Object.entries(index).map(([name, meta]) => ({
    name,
    label: meta.label,
  }))
  return NextResponse.json({ projects })
}

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || !verifyToken(auth)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let label: string
  let sql: string

  const ct = request.headers.get('content-type') || ''
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData()
    label = (form.get('label') as string)?.trim()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Debe adjuntar un archivo .sql' }, { status: 400 })
    if (!file.name.endsWith('.sql')) return NextResponse.json({ error: 'Solo se aceptan archivos .sql' }, { status: 400 })
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'El archivo excede el límite de 4 MB' }, { status: 400 })
    sql = await file.text()
  } else {
    return NextResponse.json({ error: 'Content-Type debe ser multipart/form-data' }, { status: 400 })
  }

  if (!label) return NextResponse.json({ error: 'El label es obligatorio' }, { status: 400 })

  let name = slugify(label)
  if (!name) return NextResponse.json({ error: 'El label no genera un nombre válido' }, { status: 400 })

  const index = await loadIndex()

  // Check collision
  if (index[name]) return NextResponse.json({ error: `Ya existe un proyecto con el label "${index[name].label}"` }, { status: 409 })

  // Save SQL
  await put(`projects/${name}.sql`, sql, {
    access: 'public',
    contentType: 'text/plain',
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  // Save index
  index[name] = { label }
  await saveIndex(index)

  return NextResponse.json({ ok: true, name, label })
}
