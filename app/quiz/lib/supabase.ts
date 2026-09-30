import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase del browser (rol anon/publishable).
 * Las mutaciones "de autor" van por /api/quiz/* con el JWT del docente.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: { persistSession: false },
    // Todas las tablas del juego viven en el schema "preguntas"
    db: { schema: 'preguntas' },
  }
)
