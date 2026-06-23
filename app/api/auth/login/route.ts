import { NextResponse } from 'next/server'
import crypto from 'crypto'

function signToken(payload: object, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export async function POST(request: Request) {
  const { username, password } = await request.json()

  const teacherUser = process.env.TEACHER_USER
  const teacherPass = process.env.TEACHER_PASS

  if (!teacherUser || !teacherPass) {
    return NextResponse.json({ error: 'Docente no configurado en el servidor' }, { status: 500 })
  }

  if (username !== teacherUser || password !== teacherPass) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
  }

  const token = signToken(
    { sub: username, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 },
    teacherPass
  )

  return NextResponse.json({ token })
}
