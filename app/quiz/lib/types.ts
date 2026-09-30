export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  correct_index: number
  time_limit: number
  order_position: number
}

export type GameStatus = 'lobby' | 'running' | 'ended'

export interface QuizGame {
  code: string
  status: GameStatus
  current_question: number
  question_started_at: string | null
  created_at: string
  ended_at: string | null
}

export interface QuizPlayer {
  id: string
  game_code: string
  nickname: string
  score: number
  streak: number
  created_at: string
}

export interface QuizAnswer {
  id: string
  game_code: string
  player_id: string
  question_index: number
  option_index: number
  is_correct: boolean
  time_ms: number
  points: number
}

/** Estado del alumno guardado en sessionStorage al unirse */
export interface PlayerSession {
  gameCode: string
  playerId: string
  nickname: string
}
