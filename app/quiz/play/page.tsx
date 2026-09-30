'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Hourglass, WifiOff, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { computePoints, PLAYER_SESSION_KEY } from '../lib/game'
import type { PlayerSession, QuizAnswer, QuizGame, QuizQuestion } from '../lib/types'
import TimerRing from '../components/TimerRing'
import AnswerGrid from '../components/AnswerGrid'
import QuestionResults from '../components/QuestionResults'
import Podium from '../components/Podium'

type Phase = 'waiting' | 'question' | 'answered' | 'results' | 'ended'

export default function QuizPlay() {
  const router = useRouter()
  const [session, setSession] = useState<PlayerSession | null>(null)
  const [ready, setReady] = useState(false)
  const [game, setGame] = useState<QuizGame | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [phase, setPhase] = useState<Phase>('waiting')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [earned, setEarned] = useState(0)
  const [myStreak, setMyStreak] = useState(0)
  const [questionAnswers, setQuestionAnswers] = useState<QuizAnswer[]>([])
  const [players, setPlayers] = useState<{ id: string; nickname: string; score: number; streak: number }[]>([])
  const [disconnected, setDisconnected] = useState(false)

  const shownQuestionRef = useRef<number>(-2)
  const startRef = useRef<number>(0)
  const sessionRef = useRef<PlayerSession | null>(null)

  // Recupera la sesión del alumno
  useEffect(() => {
    const stored = sessionStorage.getItem(PLAYER_SESSION_KEY)
    if (!stored) {
      router.replace('/quiz')
      return
    }
    const s = JSON.parse(stored) as PlayerSession
    setSession(s)
    sessionRef.current = s
    setReady(true)
  }, [router])

  // Carga la partida + suscripción realtime
  useEffect(() => {
    if (!ready || !session) return
    let active = true

    const load = async () => {
      const { data: g } = await supabase
        .from('games')
        .select('*')
        .eq('code', session.gameCode)
        .maybeSingle()
      if (!active) return
      if (!g) {
        router.replace('/quiz')
        return
      }
      setGame(g as QuizGame)
      if ((g as QuizGame).current_question >= 0) {
        // Se unió con el juego en curso: no muestra la pregunta que ya arrancó
        shownQuestionRef.current = (g as QuizGame).current_question
      }
      const { data: qs } = await supabase
        .from('questions')
        .select('*')
        .order('order_position', { ascending: true })
      if (active && qs) setQuestions(qs as QuizQuestion[])
    }
    load()

    const channel = supabase
      .channel(`play:${session.gameCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'preguntas', table: 'games', filter: `code=eq.${session.gameCode}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as QuizGame
          setGame(row)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setDisconnected(false)
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setDisconnected(true)
      })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [ready, session?.gameCode, router])

  // Reacción a cambios del juego
  useEffect(() => {
    if (!game) return
    if (game.status === 'ended') {
      setPhase('ended')
      // Trae el podio con puntajes persistidos por el docente
      supabase
        .from('players')
        .select('id, nickname, score, streak')
        .eq('game_code', game.code)
        .order('score', { ascending: false })
        .then(({ data }) => {
          if (data) setPlayers(data)
        })
      return
    }
    if (game.status === 'running' && game.current_question >= 0) {
      if (game.current_question !== shownQuestionRef.current) {
        shownQuestionRef.current = game.current_question
        startRef.current = Date.now()
        setChosen(null)
        setEarned(0)
        setQuestionAnswers([])
        const q = questions[game.current_question]
        setSecondsLeft(q?.time_limit ?? 20)
        setPhase('question')
      }
    } else if (game.status === 'running' && game.current_question === -1) {
      setPhase('waiting')
    }
  }, [game, questions])

  // Timer local de la pregunta: lo define question_ends_at (el docente puede cortarlo antes)
  useEffect(() => {
    if ((phase !== 'question' && phase !== 'answered') || !game || game.current_question < 0) return
    if (!game.question_ends_at) return
    const endsAt = new Date(game.question_ends_at).getTime()
    const id = setInterval(() => {
      const left = Math.ceil((endsAt - Date.now()) / 1000)
      setSecondsLeft(left)
      if (left <= 0) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [phase, game?.current_question, game?.question_ends_at])

  // Al acabarse el tiempo (o si el docente corta) → resultados
  useEffect(() => {
    if ((phase === 'question' || phase === 'answered') && secondsLeft <= 0) {
      setPhase('results')
    }
  }, [secondsLeft, phase])

  // Resultados: respuestas de la pregunta + puntaje acumulado (polling liviano)
  useEffect(() => {
    if (phase !== 'results' || !session || !game || game.current_question < 0) return
    const qi = game.current_question
    const fetchResults = async () => {
      const { data: ans } = await supabase
        .from('answers')
        .select('*')
        .eq('game_code', session.gameCode)
        .eq('question_index', qi)
      const { data: pls } = await supabase
        .from('players')
        .select('id, nickname, score, streak')
        .eq('game_code', session.gameCode)
        .order('score', { ascending: false })
      if (ans) setQuestionAnswers(ans as QuizAnswer[])
      if (pls) setPlayers(pls)
    }
    fetchResults()
    const id = setInterval(fetchResults, 2500)
    return () => clearInterval(id)
  }, [phase, session, game?.current_question])

  const answer = useCallback(
    async (optionIndex: number) => {
      if (!session || !game || chosen !== null) return
      const q = questions[game.current_question]
      if (!q) return
      const timeMs = Math.max(Date.now() - startRef.current, 0)
      const isCorrect = optionIndex === q.correct_index
      const points = computePoints(timeMs, q.time_limit, myStreak)

      setChosen(optionIndex)
      setPhase('answered')

      const row: Omit<QuizAnswer, 'id'> = {
        game_code: session.gameCode,
        player_id: session.playerId,
        question_index: game.current_question,
        option_index: optionIndex,
        is_correct: isCorrect,
        time_ms: timeMs,
        points: isCorrect ? points : 0,
      }
      const { error: insErr } = await supabase.from('answers').insert(row)
      if (insErr && !String(insErr.message).includes('duplicate key')) {
        // Si no se pudo registrar, igual mostramos feedback para no trabar el juego
        console.error('answers insert:', insErr)
      }

      // El resultado completo se muestra cuando termina el tiempo (fase results)
      setTimeout(() => {
        if (isCorrect) {
          setEarned(points)
          setMyStreak((s) => s + 1)
        } else {
          setMyStreak(0)
        }
      }, 400)
    },
    [session, game, questions, chosen, myStreak]
  )

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-300" />
      </main>
    )
  }

  const current = game && game.current_question >= 0 ? questions[game.current_question] : null
  const myRank = players.findIndex((p) => p.id === session?.playerId) + 1

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-6">
      {/* Barra de estado */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6 text-sm">
        <span className="text-violet-200/50">
          Hola, <span className="text-fuchsia-200 font-semibold">{session?.nickname}</span>
        </span>
        {disconnected && (
          <span className="flex items-center gap-1 text-amber-300/80 text-xs">
            <WifiOff size={12} /> reconectando...
          </span>
        )}
        <span className="font-bold tracking-[0.25em] text-violet-300/70">{session?.gameCode}</span>
      </div>

      <AnimatePresence mode="wait">
        {/* Esperando en el lobby / entre preguntas */}
        {(phase === 'waiting' || (phase !== 'ended' && !current)) && (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex-1 flex flex-col items-center justify-center text-center"
          >
            <Hourglass size={40} className="text-fuchsia-300 animate-glow-pulse rounded-full p-2 mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {game?.status === 'lobby' ? '¡Estás dentro!' : 'Preparate...'}
            </h2>
            <p className="text-violet-200/50 max-w-xs">
              {game?.status === 'lobby'
                ? 'Esperando a que el docente empiece la partida. ¡Mantené esta pestaña abierta!'
                : 'La próxima pregunta aparece en un toque.'}
            </p>
          </motion.div>
        )}

        {/* Pregunta */}
        {phase === 'question' && current && (
          <motion.div
            key={`q-${game!.current_question}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="w-full max-w-2xl"
          >
            <div className="flex justify-center mb-6">
              <TimerRing secondsLeft={secondsLeft} total={current.time_limit} size={72} />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-center mb-8 leading-snug">{current.prompt}</h2>
            <AnswerGrid
              options={current.options}
              onAnswer={answer}
              chosen={chosen}
              columns={2}
            />
          </motion.div>
        )}

        {/* Respondió: esperando al resto */}
        {phase === 'answered' && (
          <motion.div
            key="answered"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center"
          >
            <div className="animate-float-up text-4xl">📨</div>
            <h2 className="text-2xl font-bold mb-2">¡Respuesta enviada!</h2>
            <p className="text-violet-200/50 mb-4">Esperando el resto de la clase...</p>
            {current && (
              <div className="scale-75 origin-top">
                <TimerRing secondsLeft={secondsLeft} total={current.time_limit} size={64} />
              </div>
            )}
          </motion.div>
        )}

        {/* Resultados de la pregunta */}
        {phase === 'results' && current && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl"
          >
            <div className="flex items-center justify-center gap-2 mb-6 text-amber-300">
              <Eye size={15} />
              <span className="text-xs uppercase tracking-[0.3em]">Resultados de la pregunta</span>
            </div>
            <QuestionResults
              question={current}
              answers={questionAnswers}
              players={players}
              myPlayerId={session!.playerId}
              myChosen={chosen}
              myEarned={earned}
              myStreak={myStreak}
            />
            <p className="text-center text-violet-200/40 text-sm mt-8">Esperando al docente...</p>
          </motion.div>
        )}

        {/* Podio final */}
        {phase === 'ended' && (
          <motion.div key="ended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 w-full">
            {myRank > 0 && (
              <p className="text-center text-violet-200/60 mb-4">
                Quedaste <span className="text-fuchsia-200 font-bold">{myRank}°</span> de {players.length}
              </p>
            )}
            <Podium
              players={players.map((p) => ({ ...p, game_code: session!.gameCode, created_at: '' }))}
              highlightId={session?.playerId}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
