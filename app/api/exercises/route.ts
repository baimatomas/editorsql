import { NextResponse } from 'next/server'
import { put, list } from '@vercel/blob'
import crypto from 'crypto'

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

async function loadExercises(): Promise<Record<string, unknown[]>> {
  try {
    const { blobs } = await list({ prefix: 'exercises.json', limit: 1 })
    if (blobs.length === 0) return {}
    const res = await fetch(blobs[0].url)
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

export async function GET() {
  const data = await loadExercises()
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!auth || !verifyToken(auth)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  await put('exercises.json', JSON.stringify(body, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })

  return NextResponse.json({ ok: true })
}
