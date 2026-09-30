import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../lib/supabaseAdmin'
import { teacherFromAuthHeader } from '../../lib/quizAuth'

type BulkItem = Record<string, unknown>
type Normalized = { prompt: string; options: string[]; correct_index: number; time_limit: number }

/**
 * Acepta claves en español o inglés:
 *   pregunta|prompt, opciones|options, correcta|correct_index, tiempo|time_limit
 * "correcta" puede ser el índice (0 = primera) o el texto de la opción.
 */
function normalizeItem(raw: unknown): { ok: true; value: Normalized } | { ok: false; motivo: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, motivo: 'no es un objeto' }
  }
  const r = raw as BulkItem

  const promptRaw = r.prompt ?? r.pregunta ?? r.question
  if (typeof promptRaw !== 'string' || promptRaw.trim().length === 0 || promptRaw.trim().length > 500) {
    return { ok: false, motivo: 'la pregunta debe tener entre 1 y 500 caracteres ("pregunta")' }
  }

  const optionsRaw = r.options ?? r.opciones
  if (!Array.isArray(optionsRaw) || optionsRaw.length < 2 || optionsRaw.length > 4) {
    return { ok: false, motivo: 'debe tener entre 2 y 4 opciones ("opciones")' }
  }
  const options = optionsRaw.map((o) => String(o ?? '').trim())
  if (options.some((o) => o.length === 0 || o.length > 120)) {
    return { ok: false, motivo: 'todas las opciones deben tener entre 1 y 120 caracteres' }
  }

  let correctRaw = r.correct_index ?? r.correcta
  if (correctRaw === undefined || correctRaw === null) {
    return { ok: false, motivo: 'falta la opción correcta ("correcta")' }
  }
  if (typeof correctRaw === 'string') {
    const byText = options.findIndex((o) => o.toLowerCase() === correctRaw!.toString().trim().toLowerCase())
    if (byText === -1) {
      return { ok: false, motivo: `"correcta" (${correctRaw}) no coincide con ninguna opción` }
    }
    correctRaw = byText
  }
  const correct = Number(correctRaw)
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    return { ok: false, motivo: `"correcta" debe ser un índice entre 0 y ${options.length - 1}` }
  }

  let time = 20
  if (r.time_limit !== undefined || r.tiempo !== undefined) {
    time = Number(r.time_limit ?? r.tiempo)
    if (!Number.isInteger(time) || time < 5 || time > 120) {
      return { ok: false, motivo: '"tiempo" debe ser un número de segundos entre 5 y 120' }
    }
  }

  return { ok: true, value: { prompt: promptRaw.trim(), options, correct_index: correct, time_limit: time } }
}

const MAX_PER_BATCH = 100

export async function POST(request: Request) {
  if (!teacherFromAuthHeader(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const list = Array.isArray(body) ? body : body?.questions

    if (!Array.isArray(list) || list.length === 0) {
      return NextResponse.json(
        { error: 'El JSON debe ser un array de preguntas, ej: [{ "pregunta": ..., "opciones": [...], "correcta": 0 }]' },
        { status: 400 }
      )
    }
    if (list.length > MAX_PER_BATCH) {
      return NextResponse.json({ error: `Máximo ${MAX_PER_BATCH} preguntas por importación` }, { status: 400 })
    }

    const normalizadas: Normalized[] = []
    const errores: Array<{ item: number; motivo: string }> = []
    list.forEach((raw, i) => {
      const n = normalizeItem(raw)
      if (n.ok) normalizadas.push(n.value)
      else errores.push({ item: i + 1, motivo: n.motivo })
    })

    // Todo-o-nada: si algo es inválido no se importa nada (evita duplicados al reintentar)
    if (errores.length > 0) {
      return NextResponse.json(
        { error: `${errores.length} de ${list.length} preguntas inválidas. No se importó nada.`, errores },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true })

    const rows = normalizadas.map((q, i) => ({
      prompt: q.prompt,
      options: q.options,
      correct_index: q.correct_index,
      time_limit: q.time_limit,
      order_position: (count ?? 0) + i + 1,
    }))

    const { error } = await supabase.from('questions').insert(rows)
    if (error) throw error

    return NextResponse.json({ imported: normalizadas.length })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
