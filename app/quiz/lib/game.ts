/**
 * Puntaje estilo Kahoot: base 1000 proporcional a la velocidad,
 * + bonus por racha de aciertos.
 */
export function computePoints(timeMs: number, timeLimitSec: number, streakBefore: number): number {
  const capped = Math.min(Math.max(timeMs, 0), timeLimitSec * 1000)
  const base = Math.round(1000 * (1 - capped / (timeLimitSec * 1000) / 2))
  const streakBonus = Math.min(streakBefore, 5) * 100
  return base + streakBonus
}

/** Colores y formas de las 4 opciones (identidad propia, no clona Kahoot) */
export const OPTION_STYLES = [
  { name: 'triángulo', color: 'rose', shape: 'triangle' },
  { name: 'rombo', color: 'sky', shape: 'diamond' },
  { name: 'círculo', color: 'amber', shape: 'circle' },
  { name: 'cuadrado', color: 'emerald', shape: 'square' },
] as const

export const OPTION_CLASSES = [
  {
    bg: 'bg-gradient-to-br from-rose-500/90 to-rose-700/90 hover:from-rose-400 hover:to-rose-600 border-rose-300/40',
    glow: 'shadow-[0_0_40px_-8px_rgba(244,63,94,0.6)]',
    icon: '▲',
  },
  {
    bg: 'bg-gradient-to-br from-sky-500/90 to-sky-700/90 hover:from-sky-400 hover:to-sky-600 border-sky-300/40',
    glow: 'shadow-[0_0_40px_-8px_rgba(14,165,233,0.6)]',
    icon: '◆',
  },
  {
    bg: 'bg-gradient-to-br from-amber-500/90 to-amber-700/90 hover:from-amber-400 hover:to-amber-600 border-amber-300/40',
    glow: 'shadow-[0_0_40px_-8px_rgba(245,158,11,0.6)]',
    icon: '●',
  },
  {
    bg: 'bg-gradient-to-br from-emerald-500/90 to-emerald-700/90 hover:from-emerald-400 hover:to-emerald-600 border-emerald-300/40',
    glow: 'shadow-[0_0_40px_-8px_rgba(16,185,129,0.6)]',
    icon: '■',
  },
]

export function isValidNickname(nick: string): boolean {
  return nick.trim().length >= 1 && nick.trim().length <= 20
}

/** Errores amigables para el alumno */
export function friendlyJoinError(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err)
  if (msg.includes('players_game_code_nickname_key') || msg.includes('duplicate key')) {
    return 'Ese nombre ya está en uso en esta partida. Probá con otro.'
  }
  if (msg.includes('PGRST116') || msg.includes('no rows')) {
    return 'El código no corresponde a ninguna partida activa.'
  }
  return 'No se pudo unir a la partida. Verificá el código e intentá de nuevo.'
}

/** Clave de sessionStorage para el estado del alumno */
export const PLAYER_SESSION_KEY = 'preguntas_player_session'
