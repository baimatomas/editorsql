import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../lib/supabaseAdmin'
import { teacherFromAuthHeader } from '../lib/quizAuth'

type QuestionPayload = {
  id?: string
  prompt: string
  options: string[]
  correct_index: number
  time_limit: number
}

function validateQuestion(body: QuestionPayload): string | null {
  if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0 || body.prompt.length > 500) {
    return 'La pregunta debe tener entre 1 y 500 caracteres'
  }
  const opts = body.options
  if (!Array.isArray(opts) || opts.length < 2 || opts.length > 4) {
    return 'Debe haber entre 2 y 4 opciones'
  }
  if (opts.some((o) => typeof o !== 'string' || o.trim().length === 0 || o.length > 120)) {
    return 'Las opciones deben tener entre 1 y 120 caracteres'
  }
  if (!Number.isInteger(body.correct_index) || body.correct_index < 0 || body.correct_index >= opts.length) {
    return 'La opción correcta no es válida'
  }
  if (!Number.isInteger(body.time_limit) || body.time_limit < 5 || body.time_limit > 120) {
    return 'El tiempo debe estar entre 5 y 120 segundos'
  }
  return null
}

// Listar preguntas (ordenadas)
export async function GET(request: Request) {
  if (!teacherFromAuthHeader(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('order_position', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json({ questions: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// Crear pregunta
export async function POST(request: Request) {
  if (!teacherFromAuthHeader(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const invalid = validateQuestion(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
    const { data, error } = await supabase
      .from('questions')
      .insert({
        prompt: body.prompt.trim(),
        options: body.options.map((o: string) => o.trim()),
        correct_index: body.correct_index,
        time_limit: body.time_limit,
        order_position: (count ?? 0) + 1,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ question: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// Actualizar pregunta
export async function PUT(request: Request) {
  if (!teacherFromAuthHeader(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const body: QuestionPayload = await request.json()
    if (!body.id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })
    const invalid = validateQuestion(body)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('questions')
      .update({
        prompt: body.prompt.trim(),
        options: body.options.map((o) => o.trim()),
        correct_index: body.correct_index,
        time_limit: body.time_limit,
      })
      .eq('id', body.id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ question: data })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// Eliminar pregunta
export async function DELETE(request: Request) {
  if (!teacherFromAuthHeader(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Falta el id' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
