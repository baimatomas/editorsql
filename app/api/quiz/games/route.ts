import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../lib/supabaseAdmin'
import { teacherFromAuthHeader } from '../lib/quizAuth'

/**
 * Crea una partida nueva con un código de 6 dígitos.
 * El docente avanza el estado con PATCH /api/quiz/games/[code].
 */
export async function POST(request: Request) {
  if (!teacherFromAuthHeader(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const supabase = getSupabaseAdmin()

    // Reintenta con distintos códigos ante colisión (improbable)
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const { data, error } = await supabase
        .from('games')
        .insert({ code, status: 'lobby', current_question: -1 })
        .select()
        .single()
      if (!error) return NextResponse.json({ game: data })
      // 23505 = unique_violation → probar otro código
      if ((error as { code?: string }).code !== '23505') throw error
    }
    throw new Error('No se pudo generar un código de partida único')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
