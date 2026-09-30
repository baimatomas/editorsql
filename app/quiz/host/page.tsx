'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Loader2, Play, SkipForward, Flag, Copy, Check, Users, Eye,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { apiQuiz, isAdmin, loginTeacher } from '../lib/api'
import type { QuizAnswer, QuizGame, QuizPlayer, QuizQuestion } from '../lib/types'
import TimerRing from '../components/TimerRing'
import AnswerGrid from '../components/AnswerGrid'
import Podium from '../components/Podium'
import QuestionResults from '../components/QuestionResults'

type Phase = 'idle' | 'lobby' | 'question' | 'reveal' | 'podium'

export default function QuizHost() {
  const [teacher, setTeacher] = useState<boolean | null>(null)
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  const [phase, setPhase] = useState<Phase>('idle')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [game, setGame] = useState<QuizGame | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [players, setPlayers] = useState<QuizPlayer[]>([])
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [streaks, setStreaks] = useState<Record<string, number>>({})
  const [secondsLeft, setSecondsLeft] = useState(0)

  const gameRef = useRef<QuizGame | null>(null)
  const playersRef = useRef<QuizPlayer[]>([])
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTeacher(isAdmin())
  }, [])

  // Suscripción realtime al canal de la partida
  useEffect(() => {
    if (!game) return
    const channel = supabase
      .channel(`game:${game.code}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'preguntas', table: 'players', filter: `game_code=eq.${game.code}` },
        (payload) => {
          const p = payload.new as QuizPlayer
          setPlayers((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'preguntas', table: 'answers', filter: `game_code=eq.${game.code}` },
        (payload) => {
          const a = payload.new as QuizAnswer
          setAnswers((prev) => (prev.some((x) => x.id === a.id) ? prev : [...prev, a]))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [game?.code])

  // Mantener refs sincronizados
  useEffect(() => {
    playersRef.current = players
  }, [players])
  useEffect(() => {
    gameRef.current = game
  }, [game])

  // Recalcula puntaje/racha totales cuando llegan respuestas
  const recomputeScores = useCallback(() => {
    const totals: Record<string, number> = {}
    const correctCount: Record<string, number> = {}
    const streak: Record<string, number> = {}
    const ordered = [...answers].sort((a, b) => a.question_index - b.question_index)
    for (const a of ordered) {
      totals[a.player_id] = (totals[a.player_id] ?? 0) + a.points
      if (a.is_correct) {
        correctCount[a.player_id] = (correctCount[a.player_id] ?? 0) + 1
        streak[a.player_id] = (streak[a.player_id] ?? 0) + 1
      } else {
        streak[a.player_id] = 0
      }
    }
    setScores(totals)
    setStreaks(streak)
    return { totals, streak }
  }, [answers])

  // Persistir puntajes en players (con debounce) durante el reveal
  useEffect(() => {
    if (phase !== 'reveal') return
    const { totals, streak } = recomputeScores()
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      apiQuiz(`/api/quiz/games/${gameRef.current?.code}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'scores',
          scores: playersRef.current.map((p) => ({
            id: p.id,
            score: totals[p.id] ?? 0,
            streak: streak[p.id] ?? 0,
          })),
        }),
      }).catch(() => {})
    }, 800)
  }, [answers, phase, recomputeScores])

  // Timer de la pregunta: lo define question_ends_at (el docente puede cortarlo antes)
  useEffect(() => {
    if (phase !== 'question' || !game?.question_ends_at) return
    const endsAt = new Date(game.question_ends_at).getTime()
    const tick = () => {
      const left = Math.ceil((endsAt - Date.now()) / 1000)
      setSecondsLeft(left)
      if (left <= 0) {
        setPhase('reveal')
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [phase, game?.question_ends_at, game?.current_question])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setLoginLoading(true)
    try {
      const token = await loginTeacher(loginUser, loginPass)
      localStorage.setItem('editorsql_admin_token', token)
      setTeacher(true)
    } catch (err) {
      setLoginError((err as Error).message)
    } finally {
      setLoginLoading(false)
    }
  }

  const createGame = async () => {
    setCreating(true)
    setError(null)
    try {
      // Reset local
      setPlayers([])
      setAnswers([])
      setScores({})
      setStreaks({})
      const { questions: qs } = await apiQuiz<{ questions: QuizQuestion[] }>('/api/quiz/questions')
      if (qs.length === 0) throw new Error('No hay preguntas cargadas. Crealas en "Gestionar preguntas".')
      setQuestions(qs)
      const { game: g } = await apiQuiz<{ game: QuizGame }>('/api/quiz/games', { method: 'POST' })
      setGame(g)
      setPhase('lobby')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const sendAction = async (action: 'start' | 'next' | 'skip' | 'end') => {
    try {
      // Al finalizar, persistir los puntajes ANTES de cerrar la partida:
      // el podio de los alumnos se lee de la tabla players.
      if (action === 'end') {
        try {
          const { totals, streak: streakMap } = recomputeScores()
          await apiQuiz(`/api/quiz/games/${game!.code}`, {
            method: 'PATCH',
            body: JSON.stringify({
              action: 'scores',
              scores: playersRef.current.map((p) => ({
                id: p.id,
                score: totals[p.id] ?? 0,
                streak: streakMap[p.id] ?? 0,
              })),
            }),
          })
        } catch { /* el polling del alumno converge igual */ }
      }

      const { game: g } = await apiQuiz<{ game: QuizGame }>(`/api/quiz/games/${game!.code}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      })
      setGame(g)
      if (action === 'end') setPhase('podium')
      else if (action === 'skip') {
        // el UPDATE por realtime dispara el timer en 0 → reveal
        setSecondsLeft(0)
      } else {
        // NO se resetean las respuestas: recomputeScores acumula el puntaje
        // de todas las preguntas; el filtro por pregunta es answersForCurrent.
        setSecondsLeft(questions[g.current_question]?.time_limit ?? 20)
        setPhase('question')
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const current = game && game.current_question >= 0 ? questions[game.current_question] : null
  const answersForCurrent = current
    ? answers.filter((a) => a.question_index === game!.current_question)
    : []
  const counts = current ? current.options.map((_, i) => answersForCurrent.filter((a) => a.option_index === i).length) : []

  const earlyReturn =
    teacher === null ? (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-300" />
      </main>
    ) : !teacher ? (
      <main className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="preguntas-card p-8 w-full max-w-sm animate-pop-in space-y-4">
          <h1 className="font-bold text-xl mb-2">Acceso docente</h1>
          <p className="text-sm text-violet-200/60">Iniciá sesión para lanzar una partida.</p>
          <input
            value={loginUser}
            onChange={(e) => setLoginUser(e.target.value)}
            placeholder="Usuario"
            autoFocus
            className="preguntas-input w-full px-4 py-3 text-sm"
          />
          <input
            type="password"
            value={loginPass}
            onChange={(e) => setLoginPass(e.target.value)}
            placeholder="Contraseña"
            className="preguntas-input w-full px-4 py-3 text-sm"
          />
          {loginError && <p className="text-rose-300 text-sm">{loginError}</p>}
          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 transition-all disabled:opacity-50"
          >
            {loginLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Ingresar'}
          </button>
          <a href="/quiz" className="block text-center text-xs text-violet-200/40 hover:text-violet-200 pt-2">
            ← Volver
          </a>
        </form>
      </main>
    ) : null

  if (earlyReturn) return earlyReturn

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <a href="/quiz" className="flex items-center gap-2 text-violet-200/60 hover:text-violet-100 text-sm transition-colors">
            <ArrowLeft size={16} /> Hub de Preguntas
          </a>
          {game && (
            <div className="flex items-center gap-2 text-sm text-violet-200/50">
              <Users size={14} />
              {players.length} jugador{players.length !== 1 ? 'es' : ''}
            </div>
          )}
        </div>

        {error && (
          <p className="mb-6 text-rose-300 text-sm bg-rose-500/10 border border-rose-400/30 rounded-lg px-4 py-3 animate-pop-in">
            {error}
          </p>
        )}

        <AnimatePresence mode="wait">
          {/* ---------- Inicio ---------- */}
          {phase === 'idle' && (
            <motion.div key="idle" exit={{ opacity: 0, y: -20 }} className="text-center py-16">
              <h1 className="text-4xl font-bold mb-4">
                ¿Listo para{' '}
                <span className="bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                  lanzar la partida
                </span>
                ?
              </h1>
              <p className="text-violet-200/60 mb-10">
                Se genera un código de 6 dígitos que tus alumnos ingresan desde el hub.
              </p>
              <button
                onClick={createGame}
                disabled={creating}
                className="px-10 py-5 rounded-2xl font-bold text-xl
                           bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:from-fuchsia-400 hover:to-violet-400
                           shadow-xl shadow-fuchsia-900/50 transition-all hover:scale-105 active:scale-95
                           disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-3 mx-auto"
              >
                {creating ? <Loader2 size={22} className="animate-spin" /> : <Play size={22} />}
                {creating ? 'Creando partida...' : 'Crear partida'}
              </button>
            </motion.div>
          )}

          {/* ---------- Lobby ---------- */}
          {phase === 'lobby' && game && (
            <motion.div key="lobby" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-violet-300/60 mb-2">Código de partida</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(game.code)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
                className="group relative animate-glow-pulse rounded-2xl px-10 py-4 mb-2"
                title="Copiar código"
              >
                <span className="animate-shimmer text-7xl md:text-8xl font-bold tracking-[0.15em]">{game.code}</span>
                {copied ? (
                  <Check size={20} className="absolute -right-2 top-0 text-emerald-300" />
                ) : (
                  <Copy size={16} className="absolute -right-2 top-0 text-violet-300/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
              <p className="text-sm text-violet-200/40 mb-10">
                Los alumnos entran desde <span className="text-violet-200">/quiz</span> con este código
              </p>

              <div className="flex flex-wrap justify-center gap-2.5 min-h-[120px] max-w-2xl mx-auto mb-10">
                {players.length === 0 && (
                  <p className="text-violet-200/40 text-sm self-center">Esperando a que se sumen los jugadores...</p>
                )}
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="animate-chip-in px-4 py-2 rounded-full border border-violet-400/30 bg-violet-500/15 font-semibold text-sm"
                  >
                    {p.nickname}
                  </div>
                ))}
              </div>

              <button
                onClick={() => sendAction('start')}
                disabled={players.length === 0}
                className="px-10 py-4 rounded-2xl font-bold text-lg
                           bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400
                           shadow-xl shadow-emerald-900/40 transition-all hover:scale-105 active:scale-95
                           disabled:opacity-30 disabled:hover:scale-100 flex items-center gap-3 mx-auto"
              >
                <Play size={20} />
                Empezar el juego
              </button>
            </motion.div>
          )}

          {/* ---------- Pregunta ---------- */}
          {phase === 'question' && game && current && (
            <motion.div key={`q-${game.current_question}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs uppercase tracking-widest text-violet-300/50">
                  Pregunta {game.current_question + 1} / {questions.length}
                </span>
                <TimerRing secondsLeft={secondsLeft} total={current.time_limit} />
              </div>

              <h2 className="text-2xl md:text-4xl font-bold text-center mb-10 leading-snug">{current.prompt}</h2>

              <AnswerGrid options={current.options} counts={counts} columns={2} />

              <div className="mt-6 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-violet-200/50">
                  <Users size={15} />
                  {answersForCurrent.length} de {players.length} respondieron
                </div>
                <button
                  onClick={() => sendAction('skip')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm border transition-all
                              ${answersForCurrent.length >= players.length && players.length > 0
                                ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-200 animate-glow-pulse'
                                : 'border-violet-400/30 text-violet-200/70 hover:bg-violet-500/20'}`}
                >
                  <SkipForward size={15} />
                  {answersForCurrent.length >= players.length && players.length > 0
                    ? '¡Todos respondieron! Terminar pregunta'
                    : 'Terminar pregunta ahora'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ---------- Revelación ---------- */}
          {phase === 'reveal' && game && current && (
            <motion.div key={`r-${game.current_question}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex items-center justify-center gap-2 mb-6 text-amber-300">
                <Eye size={16} />
                <span className="text-xs uppercase tracking-[0.3em]">Resultados · Pregunta {game.current_question + 1}</span>
              </div>

              <QuestionResults
                question={current}
                answers={answersForCurrent}
                players={players.map((p) => ({
                  id: p.id,
                  nickname: p.nickname,
                  score: scores[p.id] ?? 0,
                  streak: streaks[p.id] ?? 0,
                }))}
              />

              <div className="flex justify-center gap-3 mt-8">
                <button
                  onClick={() => sendAction('next')}
                  disabled={game.current_question >= questions.length - 1}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold
                             bg-gradient-to-r from-fuchsia-500 to-violet-500 hover:from-fuchsia-400 hover:to-violet-400
                             transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                >
                  <SkipForward size={18} /> Siguiente pregunta
                </button>
                <button
                  onClick={() => sendAction('end')}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold border border-rose-400/40 text-rose-200
                             hover:bg-rose-500/20 transition-all"
                >
                  <Flag size={18} /> Finalizar
                </button>
              </div>
            </motion.div>
          )}

          {/* ---------- Podio ---------- */}
          {phase === 'podium' && (
            <motion.div key="podium" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Podium
                players={players.map((p) => ({ ...p, score: scores[p.id] ?? 0 }))}
                onRestart={() => {
                  setPhase('idle')
                  setGame(null)
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
