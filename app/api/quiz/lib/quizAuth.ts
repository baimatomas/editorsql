import crypto from 'crypto'

/**
 * Verificación del JWT del docente (idéntico al patrón de las rutas
 * existentes del editor: HS256 firmado con TEACHER_PASS).
 * Vive en app/api/quiz/lib para que la sección de preguntas sea
 * autosuficiente y se pueda separar en su propio proyecto.
 */
export function verifyTeacherToken(token: string): boolean {
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

export function teacherFromAuthHeader(request: Request): boolean {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return verifyTeacherToken(token)
}
