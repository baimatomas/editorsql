'use client'

import { motion } from 'framer-motion'
import { Check, X, HelpCircle } from 'lucide-react'
import type { QuizAnswer, QuizQuestion } from '../lib/types'
import AnswerGrid from './AnswerGrid'
import Scoreboard, { type ScoreRow } from './Scoreboard'

/**
 * Pantalla de resultados de una pregunta (compartida host + alumno):
 * opción correcta, conteos, quiénes acertaron y scoreboard acumulado.
 */
export default function QuestionResults({
  question,
  answers,
  players,
  myPlayerId,
  myChosen,
  myEarned,
  myStreak,
}: {
  question: QuizQuestion
  answers: QuizAnswer[]            // respuestas de ESTA pregunta
  players: ScoreRow[]              // puntaje acumulado
  myPlayerId?: string              // presente en la vista del alumno
  myChosen?: number | null
  myEarned?: number
  myStreak?: number
}) {
  const counts = question.options.map((_, i) => answers.filter((a) => a.option_index === i).length)
  const byPlayer = new Map(answers.map((a) => [a.player_id, a]))
  const answeredPlayers = players
    .filter((p) => byPlayer.has(p.id))
    .sort((a, b) => Number(byPlayer.get(b.id)?.is_correct) - Number(byPlayer.get(a.id)?.is_correct))
  const notAnswered = players.filter((p) => !byPlayer.has(p.id))
  const myRank = myPlayerId ? [...players].sort((a, b) => b.score - a.score).findIndex((p) => p.id === myPlayerId) + 1 : 0

  return (
    <div className="space-y-6">
      {/* Resultado personal (solo alumno) */}
      {myPlayerId && (
        <div className="text-center">
          {byPlayer.has(myPlayerId) && byPlayer.get(myPlayerId)!.is_correct ? (
            <div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1], rotate: [0, 8, 0] }}
                transition={{ duration: 0.5 }}
                className="text-6xl mb-2"
              >
                ✅
              </motion.div>
              <h2 className="text-2xl md:text-3xl font-bold text-emerald-300">¡Correcto!</h2>
              <p className="text-lg font-bold text-fuchsia-200 tabular-nums animate-pop-in">
                +{(myEarned ?? byPlayer.get(myPlayerId)!.points).toLocaleString('es-AR')} puntos
              </p>
              {(myStreak ?? 1) >= 2 && (
                <p className="text-orange-300 text-sm font-bold mt-1 animate-pop-in">🔥 racha x{myStreak}</p>
              )}
            </div>
          ) : myChosen != null ? (
            <div>
              <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5 }} className="text-6xl mb-2">
                ❌
              </motion.div>
              <h2 className="text-2xl md:text-3xl font-bold text-rose-300">Incorrecto</h2>
            </div>
          ) : (
            <div>
              <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5 }} className="text-6xl mb-2">
                ⏱️
              </motion.div>
              <h2 className="text-2xl md:text-3xl font-bold text-violet-200">No respondiste</h2>
            </div>
          )}
        </div>
      )}

      {/* Opciones con conteo + correcta */}
      <AnswerGrid
        options={question.options}
        counts={counts}
        correctIndex={question.correct_index}
        reveal="correct"
        chosen={myChosen}
        columns={2}
      />

      {/* Quiénes acertaron y quiénes no */}
      <div className="grid md:grid-cols-2 gap-3 max-w-2xl mx-auto">
        <div className="preguntas-card p-4">
          <h3 className="text-xs uppercase tracking-widest text-emerald-300/80 mb-2.5 flex items-center gap-1.5">
            <Check size={13} /> Acertaron ({answeredPlayers.filter((p) => byPlayer.get(p.id)?.is_correct).length})
          </h3>
          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {answeredPlayers.filter((p) => byPlayer.get(p.id)?.is_correct).map((p) => (
              <span
                key={p.id}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium animate-chip-in ${
                  p.id === myPlayerId
                    ? 'bg-emerald-400/30 border-emerald-200/70 text-white'
                    : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
                }`}
              >
                {p.nickname} <span className="opacity-60 tabular-nums">+{byPlayer.get(p.id)?.points}</span>
              </span>
            ))}
            {answeredPlayers.filter((p) => byPlayer.get(p.id)?.is_correct).length === 0 && (
              <span className="text-xs text-violet-200/40 self-center">Nadie acertó 😬</span>
            )}
          </div>
        </div>
        <div className="preguntas-card p-4">
          <h3 className="text-xs uppercase tracking-widest text-rose-300/80 mb-2.5 flex items-center gap-1.5">
            <X size={13} /> No acertaron ({answeredPlayers.filter((p) => !byPlayer.get(p.id)?.is_correct).length})
          </h3>
          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {answeredPlayers.filter((p) => !byPlayer.get(p.id)?.is_correct).map((p) => (
              <span
                key={p.id}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                  p.id === myPlayerId
                    ? 'bg-rose-400/30 border-rose-200/70 text-white'
                    : 'bg-rose-500/15 border-rose-400/40 text-rose-100'
                }`}
              >
                {p.nickname}
              </span>
            ))}
            {notAnswered.length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-violet-200/40 flex items-center gap-1">
                <HelpCircle size={10} /> {notAnswered.length} sin responder
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Scoreboard acumulado */}
      <div className="pt-2">
        <Scoreboard
          rows={players}
          highlightId={myPlayerId}
          title="Puntaje acumulado"
        />
        {myPlayerId && myRank > 5 && (
          <p className="text-center text-sm text-fuchsia-200/70 mt-2">
            Vos estás <span className="font-bold">{myRank}°</span> de {players.length}
          </p>
        )}
      </div>
    </div>
  )
}
