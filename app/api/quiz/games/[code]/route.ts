import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../lib/supabaseAdmin'
import { teacherFromAuthHeader } from '../../lib/quizAuth'

type GameAction =
  | { action: 'start' | 'next' }           // avanza a la siguiente pregunta
  | { action: 'skip' }                      // corta el tiempo de la pregunta actual
  | { action: 'end' }                       // finaliza la partida
  | { action: 'scores'; scores: Array<{ id: string; score: number; streak: number }> }

/**
 * Mutaciones "de autor" de la partida (protegidas con el JWT del docente).
 * El resto de los clientes (alumnos) solo leen vía anon + RLS.
 */
export async function PATCH(request: Request, { params }: { params: { code: string } }) {
  if (!teacherFromAuthHeader(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const code = params.code

  try {
    const supabase = getSupabaseAdmin()
    const body: GameAction = await request.json()

    if (body.action === 'start' || body.action === 'next') {
      // current_question actual para decidir el siguiente índice
      const { data: game, error: fetchErr } = await supabase
        .from('games')
        .select('current_question, status')
        .eq('code', code)
        .single()
      if (fetchErr) throw fetchErr
      if (game.status === 'ended') throw new Error('La partida ya terminó')

      const nextIndex = body.action === 'start' ? 0 : (game.current_question as number) + 1
      // El tiempo de la pregunta lo define el servidor (question_ends_at):
      // todos los clientes calculan el reloj desde ahí.
      const { data: questions } = await supabase
        .from('questions')
        .select('time_limit')
        .order('order_position', { ascending: true })
      const q = questions?.[nextIndex]
      if (!q) throw new Error('No hay una pregunta en esa posición')
      const endsAt = new Date(Date.now() + (q.time_limit as number) * 1000).toISOString()

      const { data, error } = await supabase
        .from('games')
        .update({
          status: 'running',
          current_question: nextIndex,
          question_started_at: new Date().toISOString(),
          question_ends_at: endsAt,
        })
        .eq('code', code)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ game: data })
    }

    if (body.action === 'skip') {
      // Corta el tiempo de la pregunta actual: todos los clientes ven
      // el reloj en 0 y pasan a los resultados.
      const { data, error } = await supabase
        .from('games')
        .update({ question_ends_at: new Date().toISOString() })
        .eq('code', code)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ game: data })
    }

    if (body.action === 'end') {
      const { data, error } = await supabase
        .from('games')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('code', code)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ game: data })
    }

    if (body.action === 'scores') {
      // Persiste el puntaje calculado por la pantalla del docente
      if (!Array.isArray(body.scores)) return NextResponse.json({ error: 'scores inválido' }, { status: 400 })
      await Promise.all(
        body.scores.map((s) =>
          supabase.from('players').update({ score: s.score, streak: s.streak }).eq('id', s.id)
        )
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// Limpia la partida (jugadores y respuestas) para reutilizar el código
export async function DELETE(request: Request, { params }: { params: { code: string } }) {
  if (!teacherFromAuthHeader(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('games').delete().eq('code', params.code)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
