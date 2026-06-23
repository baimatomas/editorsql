import { NextResponse } from 'next/server'
import { put, list, del } from '@vercel/blob'
import crypto from 'crypto'

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

async function loadIndex(): Promise<Record<string, { label: string }>> {
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

async function saveIndex(data: Record<string, { label: string }>): Promise<void> {
  await put(INDEX_BLOB, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export async function PUT(request: Request, { params }: { params: { name: string } }) {
  const auth = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || !verifyToken(auth)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { name } = params
  const index = await loadIndex()
  if (!index[name]) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const ct = request.headers.get('content-type') || ''
  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Content-Type debe ser multipart/form-data' }, { status: 400 })
  }

  const form = await request.formData()
  const label = (form.get('label') as string)?.trim()
  const file = form.get('file') as File | null

  if (label) index[name].label = label

  if (file) {
    if (!file.name.endsWith('.sql')) return NextResponse.json({ error: 'Solo se aceptan archivos .sql' }, { status: 400 })
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'El archivo excede el límite de 4 MB' }, { status: 400 })
    const sql = await file.text()
    await put(`projects/${name}.sql`, sql, {
      access: 'public',
      contentType: 'text/plain',
      addRandomSuffix: false,
      allowOverwrite: true,
    })
  }

  await saveIndex(index)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request, { params }: { params: { name: string } }) {
  const auth = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || !verifyToken(auth)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { name } = params
  const index = await loadIndex()
  if (!index[name]) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  // Delete SQL blob
  try {
    const { blobs } = await list({ prefix: `projects/${name}.sql`, limit: 1 })
    if (blobs.length > 0) await del(blobs[0].url)
  } catch {}

  // Delete associated exercises
  try {
    const { blobs } = await list({ prefix: 'exercises.json', limit: 1 })
    if (blobs.length > 0) {
      const res = await fetch(blobs[0].url, { cache: 'no-cache' })
      if (res.ok) {
        const exercises: Record<string, unknown> = await res.json()
        delete exercises[name]
        await put('exercises.json', JSON.stringify(exercises, null, 2), {
          access: 'public',
          contentType: 'application/json',
          addRandomSuffix: false,
          allowOverwrite: true,
        })
      }
    }
  } catch {}

  // Remove from index
  delete index[name]
  await saveIndex(index)

  return NextResponse.json({ ok: true })
}
