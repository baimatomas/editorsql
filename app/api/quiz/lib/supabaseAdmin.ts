import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con service_role — SOLO servidor.
 * Nunca importar desde componentes cliente.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key || key.includes('PEGA_TU')) {
    throw new Error(
      'Supabase no configurado en el servidor: faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Todas las tablas del juego viven en el schema "preguntas"
    db: { schema: 'preguntas' },
  })
}
